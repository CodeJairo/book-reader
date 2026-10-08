import uuid
from datetime import datetime
from sqlalchemy import String, Text, Boolean, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Book(Base):
    __tablename__ = "books"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    author: Mapped[str] = mapped_column(String(255), nullable=False, default="Desconocido")
    format: Mapped[str] = mapped_column(String(50), nullable=False, default="txt")  # pdf, docx, txt, manual, epub
    cover_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    total_pages_estimated: Mapped[int] = mapped_column(Integer, default=1)
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    is_finished: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relaciones
    progress: Mapped["ReadingProgress"] = relationship(
        "ReadingProgress", back_populates="book", uselist=False, cascade="all, delete-orphan"
    )
    annotations: Mapped[list["Annotation"]] = relationship(
        "Annotation", back_populates="book", cascade="all, delete-orphan"
    )
