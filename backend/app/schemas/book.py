import uuid
from datetime import datetime
from pydantic import BaseModel, Field
from app.schemas.progress import ReadingProgressResponse
from app.schemas.annotation import AnnotationResponse


class BookBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    author: str = Field(default="Desconocido", max_length=255)
    format: str = Field(default="txt", max_length=50)
    cover_url: str | None = None
    total_pages_estimated: int = Field(default=1, ge=1)


class BookCreate(BookBase):
    content: str = Field(..., min_length=1)


class BookUpdate(BaseModel):
    title: str | None = None
    author: str | None = None
    cover_url: str | None = None
    is_favorite: bool | None = None
    is_finished: bool | None = None


class BookListItem(BookBase):
    id: uuid.UUID
    is_favorite: bool
    is_finished: bool
    created_at: datetime
    updated_at: datetime
    progress: ReadingProgressResponse | None = None

    class Config:
        from_attributes = True


class BookDetail(BookListItem):
    content: str
    annotations: list[AnnotationResponse] = []

    class Config:
        from_attributes = True
