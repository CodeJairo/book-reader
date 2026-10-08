import uuid
from datetime import datetime
from sqlalchemy import Integer, Float, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ReadingProgress(Base):
    __tablename__ = "reading_progress"

    book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"), primary_key=True
    )
    current_page: Mapped[int] = mapped_column(Integer, default=0)
    total_pages: Mapped[int] = mapped_column(Integer, default=1)
    percentage: Mapped[float] = mapped_column(Float, default=0.0)
    reading_time_seconds: Mapped[int] = mapped_column(Integer, default=0)
    last_read_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relación inversa
    book: Mapped["Book"] = relationship("Book", back_populates="progress")
