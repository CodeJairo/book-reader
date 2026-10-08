from app.api.books import router as books_router
from app.api.progress import router as progress_router
from app.api.annotations import router as annotations_router

__all__ = ["books_router", "progress_router", "annotations_router"]
