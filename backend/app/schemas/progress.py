import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class ReadingProgressBase(BaseModel):
    current_page: int = Field(default=0, ge=0)
    total_pages: int = Field(default=1, ge=1)
    percentage: float = Field(default=0.0, ge=0.0, le=100.0)
    reading_time_seconds: int = Field(default=0, ge=0)


class ReadingProgressUpdate(ReadingProgressBase):
    pass


class ReadingProgressResponse(ReadingProgressBase):
    book_id: uuid.UUID
    last_read_at: datetime

    class Config:
        from_attributes = True
