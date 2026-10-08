from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db
from app.api.books import router as books_router
from app.api.progress import router as progress_router
from app.api.annotations import router as annotations_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Inicialización de tablas en PostgreSQL
    await init_db()
    yield


app = FastAPI(
    title=settings.APP_TITLE,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# Configuración de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar routers con prefijo /api
app.include_router(books_router, prefix="/api")
app.include_router(progress_router, prefix="/api")
app.include_router(annotations_router, prefix="/api")


@app.get("/api/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.APP_TITLE,
        "version": settings.APP_VERSION,
        "database": "postgresql"
    }
