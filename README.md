# 📖 Book Reader - Biblioteca Personal, Tienda Libre y Espacio de Estudio

**Book Reader** es una plataforma moderna de lectura y estudio offline-first. Te permite gestionar tu biblioteca personal de libros y documentos (**EPUB, PDF, Word DOCX, TXT y apuntes manuales**), explorar e importar más de **70,000 libros gratuitos del dominio público** (Project Gutenberg), resaltar y tomar notas con exportación a Markdown, personalizar tu experiencia con **1 o 2 columnas de lectura**, sincronizar tu progreso y escuchar contenido mediante **Text-to-Speech**.

Diseñado bajo un enfoque **Mobile-First**, con un frontend en **TypeScript (Vite)** y una arquitectura desacoplada conectada a un backend en **FastAPI (Python)** con base de datos relacional **PostgreSQL 16**, orquestados localmente con **Docker Compose**.

---

## 🎯 Características Principales

### 🌐 Tienda de Libros Gratuitos (+70,000 Obras)
- **Catálogo Gutenberg Integrado**: Acceso directo a miles de obras clásicas del dominio público (Cervantes, Dante, Shakespeare, Dostoievski, etc.).
- **Navegación Fluida**: Filtros rápidos por idioma (*En Español*, *En Inglés*, *Todos*) y por géneros temáticos (*Ficción*, *Filosofía*, *Historia*, *Poesía*).
- **Cancelación Reactiva & Cero Bloqueos**: Búsqueda asíncrona con `AbortController` para transiciones inmediatas entre categorías sin bloqueos de interfaz.
- **Acción Dual**: Opción de `📥 Añadir a Mi Biblioteca` para leer después o `📖 Leer Ahora` para abrir directamente en el lector.
- **Proxy Anti-CORS con Resiliencia**: Backend FastAPI con caché multinivel en memoria/disco y catálogo de contingencia curado para navegación garantizada.

### 📚 Biblioteca Personal Persistente (Offline-First)
- **Almacenamiento Híbrido**: Sincronización transparente entre **PostgreSQL** y **IndexedDB** local para disponibilidad offline instantánea.
- **Portadas Dinámicas & EPUB Covers**: Generación algorítmica de portadas elegantes con Canvas HTML5 y extracción automática de portadas incrustadas en EPUBs.
- **Tarjeta "Continuar Leyendo"**: Destaca tu última lectura activa con porcentaje completado, página exacta y botón de reanudación directa.
- **Gestión Completa**: Filtros por *Todos*, *En progreso*, *Favoritos* (⭐) o *Terminados* (✓), con eliminación y confirmación accesible.

### ✍️ Formatos Soportados & Creación Manual
- **EPUB (.epub)**: Extracción estructurada de capítulos mediante `JSZip`, lectura de spine oficial y preservación de jerarquía.
- **PDF (.pdf)**: Extracción y renderizado de texto mediante `pdfjs-dist`.
- **Microsoft Word (.docx)**: Procesamiento limpio de documentos mediante `mammoth`.
- **Texto Plano (.txt)**: Carga instantánea de archivos de texto.
- **Drag & Drop**: Arrastra cualquier archivo sobre la biblioteca para importarlo automáticamente.
- **Nuevo Apunte / Documento**: Bottom sheet móvil estilizado para redactar notas rápidas o pegar artículos, con botón directo de *Guardar y Leer*.

### 📖 Experiencia de Lectura Personalizable
- **Selector de Columnas de Lectura**:
  - `📄 1 Columna (Página simple)`: Columna centrada y cómoda para lectura enfocada página por página.
  - `📖 2 Columnas (Doble página)`: Distribución estilo libro abierto para pantallas de tablet y escritorio, con salvaguarda responsiva en móviles.
- **Modos de Visualización**:
  - **Modo Libro**: Paginación inteligente con animación suave de paso de página y contadores reales (*Página X / Y* o *Páginas 1-2 / Y*).
  - **Modo Scroll Continuo**: Flujo vertical continuo con memoria de posición.
- **Persistencia de Progreso Robusta**: Cálculo de páginas por reflujo del DOM y almacenamiento de tiempo acumulado de lectura.
- **Temas Visuales Globales**: Selector de tema (*Claro*, *Sepia*, *Oscuro*) sin parpadeos (anti-flash), accesible tanto en la biblioteca/tienda como en la barra de lectura.
- **Ajustes Tipográficos**: Control de tamaño de fuente (14px a 32px) mediante bottom sheet táctil / popover de ajustes ("Aa").
- **Atajos de Teclado**:
  - `←` / `→`: Pasar página anterior / siguiente.
  - `Escape`: Volver a la biblioteca.

### 📝 Sistema de Anotaciones y Estudio
- **Subrayado de Texto**: Selección táctil o con cursor para resaltar pasajes con 4 colores temáticos (amarillo, verde, azul y rosa).
- **Notas y Citas**: Añade reflexiones a cada fragmento destacado mediante popovers y formularios modernos.
- **Panel Lateral de Estudio**: Drawer colapsable con buscador interno, listado de citas, edición en línea y navegación directa con un clic a la página donde se encuentra la cita.
- **Exportación a Markdown**: Exporta tus notas y citas a un archivo `.md` estructurado y listo para Obsidian, Notion o tu editor preferido.

### 🔊 Lector por Voz (Text-to-Speech)
- Panel colapsable integrado en la cabecera de lectura.
- Reproducción, pausa y detención con selector de voz nativa del sistema, control de velocidad (0.5x - 2x) y volumen.

---

## 🛠️ Tecnologías y Arquitectura

```text
book-reader/
├── docker-compose.yml          # Orquestación de PostgreSQL 16 + FastAPI
├── backend/                    # Backend en Python (FastAPI + SQLAlchemy asyncpg)
│   ├── app/
│   │   ├── api/                # Endpoints REST (books, progress, annotations, catalog)
│   │   ├── models/             # Modelos relacionales PostgreSQL
│   │   ├── schemas/            # Esquemas Pydantic v2
│   │   ├── catalog_fallback.py # Catálogo de contingencia para Project Gutenberg
│   │   ├── database.py         # Motor asíncrono SQLAlchemy
│   │   └── main.py             # App FastAPI con CORS y ciclo de vida
│   ├── Dockerfile
│   └── requirements.txt
├── src/                        # Frontend en TypeScript (Vite)
│   ├── api/                    # Cliente HTTP con soporte AbortSignal y modo offline
│   ├── app/                    # Controlador de vistas y AppState
│   ├── audio/                  # Servicio de Text-to-Speech (Web Speech API)
│   ├── book/                   # Motor de lectura, paginación, 1/2 columnas y resaltador
│   ├── import/                 # Extractores de EPUB, PDF, DOCX y TXT
│   ├── library/                # Biblioteca, tarjetas y generador de portadas
│   ├── storage/                # Base de datos local IndexedDB
│   ├── store/                  # Vista de Tienda de libros gratuitos Gutenberg
│   ├── study/                  # Exportador de notas a Markdown
│   ├── types/                  # Interfaces y definiciones TypeScript
│   ├── main.ts                 # Punto de entrada
│   └── style.css               # Estilos temáticos responsivos mobile-first
├── package.json
└── tsconfig.json
```

---

## 🚀 Instalación y Puesta en Marcha

### Prerrequisitos
- Node.js 18+ y `pnpm` o `npm`
- Docker y Docker Compose

### 1. Iniciar Base de Datos y Backend (Docker Compose)
Levanta PostgreSQL 16 y el servidor FastAPI:

```bash
docker compose up -d
```

- **API REST**: `http://localhost:8000/api`
- **Documentación Interactiva (Swagger UI)**: `http://localhost:8000/api/docs`
- **Healthcheck**: `http://localhost:8000/api/health`

### 2. Iniciar el Frontend (Desarrollo)
En la raíz del proyecto:

```bash
# Instalar dependencias
pnpm install

# Iniciar servidor Vite (con proxy hacia el backend en el puerto 8000)
pnpm run dev
```

Abre en tu navegador: **`http://localhost:5173`**

### 3. Scripts de Verificación
```bash
# Validar tipos de TypeScript
pnpm run typecheck

# Compilar para producción
pnpm run build

# Ver logs del backend
docker compose logs backend -f

# Detener contenedores Docker
docker compose down
```

---

## 👨‍💻 Autor
**CodeJairo**
