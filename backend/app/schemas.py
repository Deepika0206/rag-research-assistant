from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.config import MAX_QUESTION_CHARS


class AskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")        # unknown fields are rejected

    question: str = Field(min_length=3, max_length=MAX_QUESTION_CHARS)
    topic: str | None = Field(default=None, max_length=40)
    collection_id: str | None = Field(default=None, max_length=64)
    subsection_id: str | None = Field(default=None, max_length=64)
    conversation_id: str | None = Field(default=None, min_length=1, max_length=128)
    message_id: str | None = Field(default=None, min_length=1, max_length=128)
    mode: Literal["agentic", "baseline"] = "agentic"

    @model_validator(mode="after")
    def require_conversation_for_message(self):
        if bool(self.conversation_id) != bool(self.message_id):
            raise ValueError("conversation_id and message_id must be provided together.")
        return self

    @field_validator("question")
    @classmethod
    def clean_question(cls, v: str) -> str:
        v = " ".join(v.split())                      # collapse spaces and new lines
        if len(v) < 3:
            raise ValueError("The question is too short.")
        return v


class ConversationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=128)
    title: str = Field(default="New Research Chat", min_length=1, max_length=160)
    collection_id: str | None = Field(default=None, max_length=64)

    @field_validator("id", "title")
    @classmethod
    def clean_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be empty.")
        return value


class ConversationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=160)
    is_pinned: bool | None = None
    collection_id: str | None = Field(default=None, max_length=64)

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Conversation title cannot be empty.")
        return value


class ImportedMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(min_length=1, max_length=128)
    role: Literal["user", "assistant"]
    content: str
    timestamp: str
    response: dict[str, Any] | None = None
    error: str | None = None


class ImportedConversation(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(min_length=1, max_length=128)
    title: str = Field(min_length=1, max_length=160)
    created_at: str
    updated_at: str
    is_pinned: bool = False
    collection_id: str | None = None
    messages: list[ImportedMessage]


class ConversationImport(BaseModel):
    model_config = ConfigDict(extra="forbid")

    conversations: list[ImportedConversation]


class CollectionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=80)

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        v = " ".join(v.split()).strip()
        if not v:
            raise ValueError("Collection name cannot be empty.")
        return v


class CollectionRename(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=80)

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        v = " ".join(v.split()).strip()
        if not v:
            raise ValueError("Collection name cannot be empty.")
        return v


class SubsectionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=80)

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        v = " ".join(v.split()).strip()
        if not v:
            raise ValueError("Subsection name cannot be empty.")
        return v


class SubsectionRename(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=80)

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        v = " ".join(v.split()).strip()
        if not v:
            raise ValueError("Subsection name cannot be empty.")
        return v
