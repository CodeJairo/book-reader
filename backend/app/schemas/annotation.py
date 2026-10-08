import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class AnnotationBase(BaseModel):
    page_number: int = Field(default=0, ge=0)
    selected_text: str = Field(..., min_length=1)
    color: str = Field(default="yellow")
    note: str | None = None


class AnnotationCreate(AnnotationBase):
    pass


class AnnotationUpdate(BaseModel):
    note: str | None = None
    color: str | None = None


class AnnotationResponse(AnnotationBase):
    id: uuid.UUID
    book_id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True
