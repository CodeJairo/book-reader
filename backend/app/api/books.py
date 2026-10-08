import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, or_, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.book import Book
from app.models.progress import ReadingProgress
from app.schemas.book import BookCreate, BookUpdate, BookListItem, BookDetail

router = APIRouter(prefix="/books", tags=["Books"])


@router.get("", response_model=List[BookListItem])
async def list_books(
    search: Optional[str] = Query(None, description="Búsqueda por título o autor"),
    is_favorite: Optional[bool] = Query(None, description="Filtrar por favoritos"),
    is_finished: Optional[bool] = Query(None, description="Filtrar por terminados"),
    db: AsyncSession = Depends(get_db),
):
    query = select(Book).options(selectinload(Book.progress)).order_by(desc(Book.updated_at))

    if search:
        search_filter = f"%{search}%"
        query = query.where(
            or_(
                Book.title.ilike(search_filter),
                Book.author.ilike(search_filter)
            )
        )

    if is_favorite is not None:
        query = query.where(Book.is_favorite == is_favorite)

    if is_finished is not None:
        query = query.where(Book.is_finished == is_finished)

    result = await db.execute(query)
    books = result.scalars().all()
    return books


@router.post("", response_model=BookDetail, status_code=status.HTTP_201_CREATED)
async def create_book(
    book_in: BookCreate,
    db: AsyncSession = Depends(get_db)
):
    new_book = Book(
        title=book_in.title,
        author=book_in.author,
        format=book_in.format,
        cover_url=book_in.cover_url,
        content=book_in.content,
        total_pages_estimated=book_in.total_pages_estimated,
    )
    db.add(new_book)
    await db.flush()

    # Crear registro inicial de progreso
    initial_progress = ReadingProgress(
        book_id=new_book.id,
        current_page=0,
        total_pages=max(1, book_in.total_pages_estimated),
        percentage=0.0,
        reading_time_seconds=0
    )
    db.add(initial_progress)
    await db.commit()

    # Recargar con relaciones
    query = select(Book).options(
        selectinload(Book.progress),
        selectinload(Book.annotations)
    ).where(Book.id == new_book.id)
    result = await db.execute(query)
    return result.scalar_one()


@router.get("/{book_id}", response_model=BookDetail)
async def get_book(
    book_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    query = select(Book).options(
        selectinload(Book.progress),
        selectinload(Book.annotations)
    ).where(Book.id == book_id)

    result = await db.execute(query)
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Libro con id '{book_id}' no encontrado"
        )
    return book


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_book(
    book_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    query = select(Book).where(Book.id == book_id)
    result = await db.execute(query)
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Libro con id '{book_id}' no encontrado"
        )
    await db.delete(book)
    await db.commit()
    return None


@router.patch("/{book_id}/favorite", response_model=BookListItem)
async def toggle_favorite(
    book_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    query = select(Book).options(selectinload(Book.progress)).where(Book.id == book_id)
    result = await db.execute(query)
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Libro con id '{book_id}' no encontrado"
        )
    book.is_favorite = not book.is_favorite
    await db.commit()
    await db.refresh(book)
    return book


@router.patch("/{book_id}/finished", response_model=BookListItem)
async def toggle_finished(
    book_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    query = select(Book).options(selectinload(Book.progress)).where(Book.id == book_id)
    result = await db.execute(query)
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Libro con id '{book_id}' no encontrado"
        )
    book.is_finished = not book.is_finished
    await db.commit()
    await db.refresh(book)
    return book
