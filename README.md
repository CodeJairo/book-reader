# 📖 Book Reader - Biblioteca Personal y Espacio de Estudio

**Book Reader** es tu biblioteca personal y espacio de lectura offline-first. Te permite almacenar tus libros (PDF, Word DOCX, TXT y apuntes manuales), generar portadas personalizadas, recordar el progreso exacto de lectura para reanudar donde te quedaste, cambiar modos de lectura (libro paginado o scroll continuo) y escuchar tu contenido con Text-to-Speech.

Está construido con un **Frontend en TypeScript moderno (Vite)** y una arquitectura desacoplada conectada a un **Backend en FastAPI (Python)** con base de datos relacional **PostgreSQL 16**, orquestados localmente con **Docker Compose**.

---

## 🎯 Características Principales

### 📚 Biblioteca Personal Persistente
- **Almacenamiento Híbrido**: Tus libros se persisten en **PostgreSQL** y se sincronizan/cachean en **IndexedDB** para disponibilidad offline inmediata.
- **Portadas Dinámicas**: Generación algorítmica de portadas de libro elegantes con canvas HTML5 para cada documento.
- **Tarjeta "Continuar Leyendo"**: Destaca tu última lectura activa con el porcentaje avanzado, página actual y botón de reanudación con un clic.
- **Filtros y Búsqueda**: Busca en tiempo real por título o autor, y filtra por "Todos", "En progreso", "Favoritos" o "Terminados".
- **Gestión Completa**: Marca favoritos (⭐), marca libros como leídos (✓) y elimina libros con confirmación.

### ✍️ Creación y Carga de Archivos
- **Formatos soportados**: PDF (.pdf), Microsoft Word (.docx) y Texto plano (.txt).
- **Drag & Drop**: Arrastra cualquier archivo sobre la biblioteca para importarlo automáticamente.
- **Nuevo Apunte / Documento Manual**: Crea notas o pega texto de conferencias o artículos web directamente con título y autor personalizado.

### 📖 Experiencia de Lectura
- **Modos de Lectura**:
  - **Modo Libro**: Paginación inteligente con animación suave de paso de página y vista a dos columnas en pantallas anchas.
  - **Modo Scroll**: Lectura vertical continua.
- **Auto-guardado reactivo**: Guarda automáticamente la página, porcentaje y tiempo acumulado de lectura.
- **Temas de Lectura**: Claro, Sepia y Oscuro con contraste optimizado.
- **Tipografía adaptable**: Aumenta o disminuye el tamaño de fuente (14px a 32px).
- **Atajos de teclado**:
  - `←` / `→`: Pasar página
  - `+` / `-`: Aumentar o reducir tamaño de fuente
  - `Escape`: Volver a la biblioteca

### 🔊 Lector por Voz (Text-to-Speech)
- Panel colapsable integrado en el lector.
- Reproducción, pausa y detención con selector de voz, velocidad y tono.

---

## 🛠️ Tecnologías y Arquitectura

```text
book-reader/
├── docker-compose.yml          # PostgreSQL 16 + FastAPI
├── backend/                    # Python FastAPI + SQLAlchemy (asyncpg)
│   ├── app/
│   │   ├── api/                # Endpoints REST (/api/books, /api/progress, /api/annotations)
│   │   ├── models/             # Modelos relacionales PostgreSQL
│   │   ├── schemas/            # Schemas Pydantic v2
│   │   ├── database.py         # Motor asíncrono SQLAlchemy
│   │   └── main.py             # App FastAPI con CORS y ciclo de vida
│   ├── Dockerfile
│   └── requirements.txt
├── src/                        # Frontend TypeScript (Vite)
│   ├── api/                    # Cliente HTTP tipado con fallback offline
│   ├── app/                    # Controlador de vistas y estado global
│   ├── audio/                  # Text-to-Speech
│   ├── book/                   # Motor de renderizado y paginación
│   ├── import/                 # Extractores de PDF, DOCX y TXT
│   ├── library/                # Biblioteca, portadas y catálogo
│   ├── storage/                # Base de datos IndexedDB local
│   ├── types/                  # Definiciones e interfaces TypeScript
│   ├── main.ts                 # Punto de entrada
│   └── style.css               # Estilos temáticos responsivos
├── package.json
└── tsconfig.json
```

---

## 🚀 Instalación y Puesta en Marcha

### Prerrequisitos
- Node.js 18+ y npm / pnpm
- Docker y Docker Compose

### 1. Iniciar Base de Datos y Backend (Docker Compose)
Levanta PostgreSQL 16 y la API de FastAPI en segundo plano:

```bash
docker compose up -d
```

- **API REST**: `http://localhost:8000/api`
- **Documentación interactiva (Swagger)**: `http://localhost:8000/api/docs`
- **Healthcheck**: `http://localhost:8000/api/health`

### 2. Iniciar el Frontend (Desarrollo)
En la raíz del proyecto:

```bash
# Instalar dependencias
npm install

# Iniciar servidor Vite (con proxy a /api en el puerto 8000)
npm run dev
```

Abre en tu navegador: **`http://localhost:5173`**

### 3. Comandos Útiles
```bash
# Validar tipos de TypeScript
npm run typecheck

# Compilar para producción
npm run build

# Ver logs del backend
docker compose logs backend -f

# Detener contenedores Docker
docker compose down
```

---

## 👨‍💻 Autor
**CodeJairo**
