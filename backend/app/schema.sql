CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS collections_name_lower_idx
  ON collections (LOWER(name));

CREATE TABLE IF NOT EXISTS subsections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (collection_id, name)
);

CREATE INDEX IF NOT EXISTS subsections_collection_idx ON subsections (collection_id);

CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  path TEXT UNIQUE NOT NULL,
  collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
  subsection_id UUID REFERENCES subsections(id) ON DELETE SET NULL,
  filename TEXT,
  file_type TEXT DEFAULT 'md',
  file_size INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'indexed',
  error_message TEXT,
  stored_path TEXT,
  chunk_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE documents ADD COLUMN IF NOT EXISTS collection_id UUID REFERENCES collections(id) ON DELETE SET NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS subsection_id UUID REFERENCES subsections(id) ON DELETE SET NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS filename TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_type TEXT DEFAULT 'md';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_size INT DEFAULT 0;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'indexed';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS stored_path TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS chunk_count INT NOT NULL DEFAULT 0;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS documents_collection_idx ON documents (collection_id);
CREATE INDEX IF NOT EXISTS documents_subsection_idx ON documents (subsection_id);

CREATE TABLE IF NOT EXISTS chunks (
  id SERIAL PRIMARY KEY,
  doc_id INT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  topic TEXT NOT NULL,
  text TEXT NOT NULL,
  n_tokens INT NOT NULL,
  embedding vector(768) NOT NULL,
  collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
  subsection_id UUID REFERENCES subsections(id) ON DELETE SET NULL,
  UNIQUE (doc_id, chunk_index)
);

ALTER TABLE chunks ADD COLUMN IF NOT EXISTS collection_id UUID REFERENCES collections(id) ON DELETE SET NULL;
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS subsection_id UUID REFERENCES subsections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS chunks_embedding_idx
  ON chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS chunks_topic_idx ON chunks (topic);
CREATE INDEX IF NOT EXISTS chunks_doc_id_idx ON chunks (doc_id);
CREATE INDEX IF NOT EXISTS chunks_collection_idx ON chunks (collection_id);
CREATE INDEX IF NOT EXISTS chunks_subsection_idx ON chunks (subsection_id);

CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  topic TEXT,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  answer TEXT NOT NULL,
  result JSONB NOT NULL,
  latency_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_runs_created_idx ON agent_runs (created_at DESC);
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS request_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS agent_runs_request_id_idx
  ON agent_runs (request_id) WHERE request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
  legacy_run_id UUID UNIQUE REFERENCES agent_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversations_updated_idx
  ON conversations (updated_at DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS conversations_collection_idx
  ON conversations (collection_id);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sequence BIGSERIAL NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  run_id UUID REFERENCES agent_runs(id) ON DELETE SET NULL,
  request_id TEXT,
  response JSONB,
  error TEXT
);
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS sequence BIGSERIAL;

CREATE INDEX IF NOT EXISTS conversation_messages_order_idx
  ON conversation_messages (conversation_id, sequence);
CREATE INDEX IF NOT EXISTS conversation_messages_run_idx
  ON conversation_messages (run_id) WHERE run_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS conversation_messages_request_role_idx
  ON conversation_messages (conversation_id, request_id, role)
  WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS conversation_messages_run_role_idx
  ON conversation_messages (run_id, role)
  WHERE run_id IS NOT NULL;

-- Runs created before conversation persistence remain separate legacy conversations.
INSERT INTO conversations (id, title, created_at, updated_at, legacy_run_id)
SELECT gen_random_uuid()::text,
       COALESCE(NULLIF(LEFT(BTRIM(r.question), 160), ''), 'Legacy research run'),
       r.created_at,
       r.created_at,
       r.id
FROM agent_runs r
WHERE NOT EXISTS (
  SELECT 1 FROM conversations c WHERE c.legacy_run_id = r.id
)
AND NOT EXISTS (
  SELECT 1 FROM conversation_messages m WHERE m.run_id = r.id
)
ON CONFLICT DO NOTHING;

INSERT INTO conversation_messages (
  id, conversation_id, role, content, created_at, run_id, request_id
)
SELECT gen_random_uuid()::text, c.id, 'user', r.question, r.created_at, r.id,
       'legacy-' || r.id::text
FROM agent_runs r
JOIN conversations c ON c.legacy_run_id = r.id
ON CONFLICT DO NOTHING;

INSERT INTO conversation_messages (
  id, conversation_id, role, content, created_at, run_id, request_id, response
)
SELECT gen_random_uuid()::text, c.id, 'assistant', r.answer, r.created_at, r.id,
       'legacy-' || r.id::text, r.result
FROM agent_runs r
JOIN conversations c ON c.legacy_run_id = r.id
ON CONFLICT DO NOTHING;
