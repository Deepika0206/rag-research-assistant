export type Mode = "agentic" | "baseline";
export type Status = "answered" | "partial" | "evidence_insufficient" | "unchecked";

export interface Source {
  doc: string;
  topic: string;
  text: string;
}

export interface Claim {
  claim_id: string;
  text: string;
  chunk_ids: number[];
  sub_question: number;
}

export interface Relation {
  id: string;
  kind: string;
  value: string | null;
  text: string;
  claim_ids: string[];
}

export interface SubQuestion {
  sub_question: string;
  status: "answered" | "partial" | "evidence_insufficient";
  refinements: number;
  queries_tried: string[];
  missing: string;
}

export interface ChunkRef {
  chunk_id: number;
  doc: string;
  score: number;
}

export interface Verdict {
  claim: string;
  supported: boolean;
  reason: string;
}

export type TraceEvent =
  | { step: "planner"; query_type: string; sub_questions: string[]; fallback: boolean }
  | { step: "retrieve"; sub_question?: string; query: string; attempt?: number; mode?: string; chunks: ChunkRef[] }
  | { step: "draft"; claims: { text: string; chunk_ids: number[] }[]; missing: string; dropped_ids: string[]; parse_error: boolean }
  | { step: "critique"; passed: boolean; verdicts: Verdict[]; incomplete: boolean; critic_error: boolean }
  | { step: "refine"; new_query: string; refinement: number }
  | { step: "sub_result"; sub_question: string; status: string; refinements: number }
  | { step: "synthesize"; status: string; mode: string; n_sentences: number; dropped_sentences: number; relations: string[] };

export interface AskResponse {
  mode: Mode;
  question: string;
  query_type: string | null;
  status: Status;
  answer: string;
  claims: Claim[];
  relations: Relation[];
  sources: Record<string, Source>;
  sub_questions: SubQuestion[];
  trace: TraceEvent[];
  synthesis?: string;
  citations?: number[];
  invalid_citations?: number[];
  latency_ms: number;
  run_id: string | null;
}

export interface SubsectionRecord {
  id: string;
  collection_id: string;
  name: string;
  doc_count: number;
  created_at?: string | null;
}

export interface CollectionRecord {
  id: string;
  name: string;
  is_default: boolean;
  doc_count: number;
  created_at?: string | null;
  subsections: SubsectionRecord[];
}

export interface DocumentChunkPreview {
  chunk_id: number;
  chunk_index: number;
  n_tokens: number;
  text: string;
}

export interface DocumentRecord {
  id: number;
  title: string;
  topic: string;
  path: string;
  collection_id?: string | null;
  collection_name?: string | null;
  subsection_id?: string | null;
  subsection_name?: string | null;
  filename: string;
  file_type: string;
  file_size: number;
  status: "processing" | "indexed" | "failed" | string;
  error_message?: string | null;
  chunk_count: number;
  created_at?: string | null;
  chunks?: DocumentChunkPreview[];
}

export interface UploadDocumentsResponse {
  uploaded: DocumentRecord[];
  errors: { filename: string; error: string }[];
  total_uploaded: number;
  total_errors: number;
}

export type SearchScope =
  | { kind: "all" }
  | { kind: "topic"; topic: string }
  | { kind: "collection"; collectionId: string; name: string }
  | { kind: "subsection"; collectionId: string; subsectionId: string; name: string };
