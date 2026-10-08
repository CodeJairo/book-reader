from typing import List, Optional
from pydantic import BaseModel


class CatalogBookItem(BaseModel):
    id: int
    title: str
    authors: List[str]
    languages: List[str]
    subjects: List[str]
    cover_url: Optional[str] = None
    epub_url: Optional[str] = None
    download_count: int = 0


class CatalogSearchResponse(BaseModel):
    count: int
    page: int
    has_next: bool
    results: List[CatalogBookItem]
