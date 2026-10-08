import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.book import Book
from app.models.progress import ReadingProgress
from app.schemas.progress import ReadingProgressUpdate, ReadingProgressResponse
from app.schemas.book import BookListItem

router = APIRouter(prefix="", tags=["Progress"])


@router.get("/progress/latest", response_model=BookListItem | None)
async def get_latest_reading(db: AsyncSession = Depends(get_db)):
    """Obtiene el libro con actividad de lectura más reciente para la tarjeta 'Continuar leyendo'."""
    query = (
        select(Book)
        .join(ReadingProgress, Book.id == ReadingProgress.book_id)
        .options(selectinload(Book.progress))
        .where(ReadingProgress.percentage < 100.0)
        .order_by(desc(ReadingProgress.last_read_at))
        .limit(1)
    )
    result = await db.execute(query)
    latest_book = result.scalar_one_or_none()

    if not latest_book:
        # Fallback al libro más recientemente actualizado si no hay lecturas activas incompletas
        fallback_query = (
            select(Book)
            .options(selectinload(Book.progress))
            .order_by(desc(Book.updated_at))
            .limit(1)
        )
        fallback_res = await db.execute(fallback_query)
        latest_book = fallback_res.scalar_one_or_none()

    return latest_book


@router.get("/books/{book_id}/progress", response_model=ReadingProgressResponse)
async def get_book_progress(
    book_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    query = select(ReadingProgress).where(ReadingProgress.book_id == book_id)
    result = await db.execute(query)
    progress = result.scalar_one_or_none()
    if not progress:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Progreso para libro '{book_id}' no encontrado"
        )
    return progress


@router.put("/books/{book_id}/progress", response_model=ReadingProgressResponse)
async def update_book_progress(
    book_id: uuid.UUID,
    progress_in: ReadingProgressUpdate,
    db: AsyncSession = Depends(get_db)
):
    # Verificar que el libro existe
    book_query = select(Book).where(Book.id == book_id)
    book_res = await db.execute(book_query)
    book = book_res.scalar_one_or_none()
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Libro '{book_id}' no encontrado"
        )

    # Buscar o crear progreso
    query = select(ReadingProgress).where(ReadingProgress.book_id == book_id)
    result = await db.execute(query)
    progress = result.scalar_one_or_none()

    now = datetime.utcnow()
    if not progress:
        progress = ReadingProgress(
            book_id=book_id,
            current_page=progress_in.current_page,
            total_pages=progress_in.total_pages,
            percentage=progress_in.percentage,
            reading_time_seconds=progress_in.reading_time_seconds,
            last_read_at=now
        )
        db.add(progress)
    else:
        progress.current_page = progress_in.current_page
        progress.total_pages = progress_in.total_pages
        progress.percentage = progress_in.percentage
        progress.reading_time_seconds = progress_in.reading_time_seconds
        progress.last_read_at = now

    # Actualizar updated_at del libro
    book.updated_at = now
    if progress_in.percentage >= 99.9:
        book.is_finished = True

    await db.commit()
    await db.refresh(progress)
    return progress
