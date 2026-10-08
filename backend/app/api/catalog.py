import hashlib
import json
import logging
import os
import urllib.parse
import urllib.request
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Response, status

from app.schemas.catalog import CatalogSearchResponse, CatalogBookItem
from app.catalog_fallback import FALLBACK_CATALOG

router = APIRouter(prefix="/catalog", tags=["Catalog"])

GUTENDEX_BASE_URL = "https://gutendex.com/books/"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
CACHE_DIR = "/tmp/gutenberg_cache"
os.makedirs(CACHE_DIR, exist_ok=True)

# Cache simple en memoria para búsquedas recientes
_search_cache: Dict[str, Any] = {}


def _get_cache_key(url: str) -> str:
    return hashlib.md5(url.encode()).hexdigest()


logger = logging.getLogger(__name__)


def _fetch_from_gutendex(params: dict) -> dict:
    query_str = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None and v != ""})
    url = f"{GUTENDEX_BASE_URL}?{query_str}" if query_str else GUTENDEX_BASE_URL

    if url in _search_cache:
        return _search_cache[url]

    cache_file = os.path.join(CACHE_DIR, f"search_{_get_cache_key(url)}.json")
    if os.path.exists(cache_file):
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                _search_cache[url] = data
                return data
        except Exception:
            pass

    req = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if len(_search_cache) > 100:
                _search_cache.clear()
            _search_cache[url] = data
            try:
                with open(cache_file, "w", encoding="utf-8") as f:
                    json.dump(data, f)
            except Exception:
                pass
            return data
    except Exception as e:
        logger.warning(f"Aviso al consultar Gutendex ({url}): {e}")
        # Si falló la petición en vivo pero hay caché previo en disco, usarlo
        if os.path.exists(cache_file):
            try:
                with open(cache_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        # Devolver respuesta vacía válida para no congelar ni romper el cliente
        return {"count": 0, "results": [], "next": None}


@router.get("/search", response_model=CatalogSearchResponse)
async def search_catalog(
    search: Optional[str] = Query(None, description="Búsqueda por título o autor"),
    language: Optional[str] = Query("es", description="Código de idioma (es, en, etc., o vacío para todos)"),
    topic: Optional[str] = Query(None, description="Tema o categoría (fiction, philosophy, etc.)"),
    page: int = Query(1, ge=1, description="Número de página"),
):
    params: Dict[str, Any] = {"page": page}
    if search and search.strip():
        params["search"] = search.strip()

    # Gutendex tiene un problema de rendimiento severo cuando se combina 'languages' con 'topic' o 'search'.
    # Si se especifica topic, priorizamos la categoría temática sin limitar idioma en la API remota.
    if topic and topic.strip():
        params["topic"] = topic.strip()
    elif language and language.strip() and language.strip() != "all":
        params["languages"] = language.strip()

    raw_data = _fetch_from_gutendex(params)
    raw_results = raw_data.get("results", [])
    count = raw_data.get("count", 0)
    has_next = raw_data.get("next") is not None

    if not raw_results:
        # Si la API pública de Gutendex demoró o no respondió, servir catálogo de respaldo
        fallback_items = FALLBACK_CATALOG.get("results", [])
        filtered = []
        for b in fallback_items:
            match = True
            if language and language.strip() and language.strip() != "all":
                if language.strip() not in b.get("languages", []):
                    match = False
            if topic and topic.strip():
                subj_str = " ".join(b.get("subjects", [])).lower()
                if topic.strip().lower() not in subj_str:
                    match = False
            if search and search.strip():
                title_author = (b.get("title", "") + " " + " ".join([a.get("name", "") for a in b.get("authors", [])])).lower()
                if search.strip().lower() not in title_author:
                    match = False
            if match:
                filtered.append(b)

        if filtered:
            raw_results = filtered
            count = len(filtered)
            has_next = False
        elif not search and not topic:
            # Si no hay filtros específicos, mostrar todos los de respaldo
            raw_results = fallback_items
            count = len(fallback_items)
            has_next = False

    items = []
    for r in raw_results:
        book_id = r.get("id")
        title = r.get("title", "Sin título")
        authors = [a.get("name", "") for a in r.get("authors", []) if a.get("name")]
        if not authors:
            authors = ["Autor desconocido"]

        languages = r.get("languages", ["es"])
        subjects = r.get("subjects", [])
        formats = r.get("formats", {})

        # Detección de portada
        cover_url = formats.get("image/jpeg")
        if not cover_url and book_id:
            cover_url = f"https://www.gutenberg.org/cache/epub/{book_id}/pg{book_id}.cover.medium.jpg"

        # Detección de enlace EPUB
        epub_url = (
            formats.get("application/epub+zip")
            or f"https://www.gutenberg.org/ebooks/{book_id}.epub3.images"
        )

        items.append(
            CatalogBookItem(
                id=book_id,
                title=title,
                authors=authors,
                languages=languages,
                subjects=subjects[:5],  # Primeras 5 materias
                cover_url=cover_url,
                epub_url=epub_url,
                download_count=r.get("download_count", 0),
            )
        )

    return CatalogSearchResponse(
        count=count,
        page=page,
        has_next=has_next,
        results=items,
    )


@router.get("/download/{book_id}")
async def download_book_epub(book_id: int):
    """
    Descarga el archivo EPUB desde los servidores de Gutenberg y lo transmite
    al frontend sin bloqueos de CORS, utilizando caché en disco.
    """
    cache_path = os.path.join(CACHE_DIR, f"{book_id}.epub")
    if os.path.exists(cache_path) and os.path.getsize(cache_path) > 1000:
        with open(cache_path, "rb") as f:
            content = f.read()
        return Response(
            content=content,
            media_type="application/epub+zip",
            headers={
                "Content-Disposition": f"attachment; filename=\"gutenberg_{book_id}.epub\"",
                "Cache-Control": "public, max-age=86400",
            },
        )

    # Intentar descargar desde las URLs estándar de Gutenberg
    candidate_urls = [
        f"https://www.gutenberg.org/ebooks/{book_id}.epub3.images",
        f"https://www.gutenberg.org/ebooks/{book_id}.epub.images",
        f"https://www.gutenberg.org/ebooks/{book_id}.epub.noimages",
        f"https://www.gutenberg.org/cache/epub/{book_id}/pg{book_id}.epub",
    ]

    downloaded_bytes = None
    for url in candidate_urls:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = resp.read()
                # Verificar encabezado 'PK' (ZIP/EPUB)
                if data.startswith(b"PK") and len(data) > 1000:
                    downloaded_bytes = data
                    break
        except Exception:
            continue

    if not downloaded_bytes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se pudo descargar el archivo EPUB para el libro {book_id} desde Project Gutenberg."
        )

    # Guardar en caché
    try:
        with open(cache_path, "wb") as f:
            f.write(downloaded_bytes)
    except Exception:
        pass

    return Response(
        content=downloaded_bytes,
        media_type="application/epub+zip",
        headers={
            "Content-Disposition": f"attachment; filename=\"gutenberg_{book_id}.epub\"",
            "Cache-Control": "public, max-age=86400",
        },
    )
