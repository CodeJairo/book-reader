import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.book import Book
from app.models.annotation import Annotation
from app.schemas.annotation import AnnotationCreate, AnnotationUpdate, AnnotationResponse

router = APIRouter(prefix="", tags=["Annotations"])


@router.get("/books/{book_id}/annotations", response_model=List[AnnotationResponse])
async def list_book_annotations(
    book_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(Annotation)
        .where(Annotation.book_id == book_id)
        .order_by(Annotation.page_number, desc(Annotation.created_at))
    )
    result = await db.execute(query)
    return result.scalars().all()


@router.post(
    "/books/{book_id}/annotations",
    response_model=AnnotationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_annotation(
    book_id: uuid.UUID,
    annotation_in: AnnotationCreate,
    db: AsyncSession = Depends(get_db)
):
    # Validar existencia del libro
    book_query = select(Book).where(Book.id == book_id)
    book_res = await db.execute(book_query)
    book = book_res.scalar_one_or_none()
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Libro '{book_id}' no encontrado"
        )

    new_annotation = Annotation(
        book_id=book_id,
        page_number=annotation_in.page_number,
        selected_text=annotation_in.selected_text,
        color=annotation_in.color,
        note=annotation_in.note
    )
    db.add(new_annotation)
    await db.commit()
    await db.refresh(new_annotation)
    return new_annotation


@router.patch("/annotations/{annotation_id}", response_model=AnnotationResponse)
async def update_annotation(
    annotation_id: uuid.UUID,
    annotation_in: AnnotationUpdate,
    db: AsyncSession = Depends(get_db)
):
    query = select(Annotation).where(Annotation.id == annotation_id)
    result = await db.execute(query)
    annotation = result.scalar_one_or_none()
    if not annotation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Anotación '{annotation_id}' no encontrada"
        )

    if annotation_in.note is not None:
        annotation.note = annotation_in.note
    if annotation_in.color is not None:
        annotation.color = annotation_in.color

    await db.commit()
    await db.refresh(annotation)
    return annotation


@router.delete("/annotations/{annotation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_annotation(
    annotation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    query = select(Annotation).where(Annotation.id == annotation_id)
    result = await db.execute(query)
    annotation = result.scalar_one_or_none()
    if not annotation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Anotación '{annotation_id}' no encontrada"
        )
    await db.delete(annotation)
    await db.commit()
    return None
