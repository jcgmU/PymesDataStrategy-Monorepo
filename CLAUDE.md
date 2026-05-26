# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Arquitectura del Sistema

Monorepo con cuatro servicios principales orquestados por Docker:

| Servicio | Puerto | Tecnología | Directorio |
|---|---|---|---|
| API Gateway | 3000 | Node.js + Express + TypeScript + Prisma + BullMQ | `backend/api/` |
| Worker ETL | 8000 | Python + FastAPI + Polars + SQLAlchemy | `backend/worker/` |
| Dashboard Backend | 3002 | Node.js + Express (JS) | `services/dashboard-pymes/backend/` |
| Dashboard Agent | 8001 | Python + FastAPI + scikit-learn | `services/dashboard-pymes/agent/` |
| Frontend | 3001 | Next.js 15 App Router + React 19 + Tailwind v4 | `frontend/` |

Infraestructura: PostgreSQL (×2), Redis (BullMQ), MinIO (S3-compatible).

**Flujo principal:**
1. Usuario sube CSV/Excel → Frontend → API Gateway
2. API encola job en Redis → Worker ETL lo procesa con Polars
3. Worker detecta anomalías y llama a Gemini para sugerencias
4. Worker hace push del dataset limpio al Dashboard Backend (S2S)
5. Dashboard Backend guarda en PostgreSQL Analytics (JSONB)
6. Dashboard Agent sirve KPIs y chatbot usando Gemini

---

## Arquitectura Hexagonal (API y Worker)

Ambos servicios siguen Hexagonal Architecture con capas estrictas:

- **`domain/`** — Entidades, puertos (interfaces), value objects, errores. Sin dependencias externas.
- **`application/`** — Use cases, servicios de aplicación. Solo depende de `domain/`.
- **`infrastructure/`** — Implementaciones concretas: Prisma, MinIO, BullMQ, JWT, Redis.

En el API Gateway TypeScript, el DI container está en `backend/api/src/infrastructure/config/container.ts` — gestiona singletons de todos los adaptadores.

El concepto **IR (Intermediate Representation)** es central al flujo HITL: las decisiones humanas se codifican como IR (`backend/api/src/domain/ir/IR.ts`), que el Worker luego ejecuta como transformaciones sobre el DataFrame Polars.

---

## Comandos de Desarrollo

Todos los comandos de infraestructura se ejecutan desde `backend/` usando el `Makefile`.

### Infraestructura Docker

```bash
cd backend
make up           # Levanta todos los servicios
make up-build     # Rebuild + levanta
make down         # Para todos
make logs         # Logs de todos los servicios
make api-logs     # Logs del API Gateway
make worker-logs  # Logs del Worker ETL
make ps           # Estado de servicios
make clean        # ⚠️ Elimina volúmenes (pérdida de datos)
```

### Base de Datos (Prisma — desde `backend/`)

```bash
make db-migrate   # Ejecuta migraciones pendientes
make db-generate  # Regenera el cliente Prisma
make db-studio    # Abre Prisma Studio en el navegador
make db-reset     # ⚠️ Reset completo de la DB
make psql         # Abre CLI de PostgreSQL
make redis-cli    # Abre CLI de Redis
```

El schema de Prisma está en `backend/prisma/schema.prisma` (no dentro de `api/`).

### Desarrollo Local (sin Docker)

```bash
# API Gateway (requiere infra corriendo)
make api-dev       # Equivale a: cd api && pnpm dev

# Worker ETL (requiere uv instalado)
make worker-dev    # Equivale a: cd worker && uv run uvicorn src.main:app --reload --port 8000

# Frontend
make frontend-dev  # Equivale a: cd ../frontend && pnpm dev
```

### Linting y Typecheck

```bash
make lint          # ESLint (API) + Ruff (Worker)
make format        # Prettier (API) + Ruff format (Worker)
make typecheck     # tsc --noEmit (API) + mypy (Worker)
```

---

## Tests

### API Gateway (Vitest)

```bash
cd backend
make test-api                    # Todos los tests del API

cd backend/api
pnpm test                        # Todos los tests
pnpm test -- -t "nombre test"    # Un test específico por nombre
pnpm test:coverage               # Con cobertura (umbral: 70% líneas, 80% ramas)
pnpm test:watch                  # Modo watch
```

Los tests de integración del API usan **Testcontainers** (PostgreSQL y Redis reales), no mocks. Directorio: `backend/api/src/**/*.{test,spec}.ts` y `backend/api/tests/`.

Path aliases disponibles en tests: `@domain`, `@application`, `@infrastructure`.

### Worker ETL (pytest)

```bash
cd backend
make test-worker                          # Todos los tests del worker

cd backend/worker
source .venv/bin/activate
python -m pytest                          # Todos los tests
python -m pytest tests/ruta/test_file.py  # Un archivo específico
python -m pytest -k "nombre_test"         # Un test por nombre
python -m pytest --cov=src --cov-report=html  # Con cobertura
```

El worker usa `uv` para gestión de dependencias Python (no pip directamente).

### Frontend (Vitest + Playwright)

```bash
cd frontend
pnpm test              # Vitest (unit/component)
pnpm test:watch        # Modo watch
pnpm test:e2e          # Playwright E2E
pnpm test:e2e:ui       # Playwright con UI interactiva
pnpm test:e2e:debug    # Playwright en modo debug
```

---

## Frontend — Estructura Clave

- **`app/`** — App Router de Next.js. Rutas: `(auth)/login`, `(auth)/register`, `dashboard/`, `dashboard/[datasetId]/`
- **`components/ui/`** — Componentes base reutilizables
- **`components/features/`** — Features agrupadas: `landing/`, `dashboard/`, `review/`, `dashboard-pymes/`
- **`hooks/api/`** — React Query hooks para cada entidad (`useDatasets`, `useAnomalies`, `useJobStatus`)
- **`hooks/`** — Hooks generales: SSE (`useGlobalSSE`, `useJobSSE`), polling (`useJobPoller`)
- **`store/`** — Zustand: `useAppStore` (global), `useReviewStore` (estado HITL)
- **`lib/api-client.ts`** — Cliente HTTP base con autenticación
- **`lib/api-endpoints.ts`** — Constantes de endpoints

Auth: NextAuth v5 configurada en `frontend/auth.ts` y `frontend/auth.config.ts`. El middleware de protección de rutas está en `frontend/middleware.ts`.

---

## Variables de Entorno

El `.env` principal vive en `backend/.env` (basarse en `backend/.env.example`). Variables críticas:

- `GEMINI_API_KEY` — Requerida para sugerencias AI y chatbot
- `NEXTAUTH_SECRET` — Generar con `openssl rand -base64 32`
- `JWT_SECRET` — Para el API Gateway
- Las credenciales de MinIO, PostgreSQL y Redis tienen defaults de desarrollo

El frontend toma variables de entorno propias en `frontend/.env.local` (ver `frontend/.env.example` si existe).

---

## Documentación Interna (Convenciones Obsidian)

Este repo usa Obsidian como segunda cerebro. Al crear/editar archivos `.md`:

- Usar `[[doble corchete]]` para enlaces internos (nunca rutas relativas)
- Añadir frontmatter YAML con `type`, `tags` y `status`
- Nombres de archivo en Title Case con guiones: `Mi-Nueva-Nota.md`
- Usar callouts `> [!info]`, `> [!warning]`, `> [!todo]`, `> [!tip]`
- Punto de entrada: `00_Dashboard.md` — leer siempre al retomar contexto
- Logs de sesión: `docs/dev-logs/YYYY-MM-DD.md`

### Tags del proyecto

**Componente:** `#frontend` `#backend` `#worker` `#n8n` `#infra`  
**Estado:** `#status/active` `#status/blocked` `#status/completed` `#status/pending-decision`  
**Documental:** `#type/moc` `#type/adr` `#type/research` `#type/dev-log`
