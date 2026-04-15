# CREO MechaLab X

CREO MechaLab X is a web-based application designed to simulate the Mechatronics NC II training program.

The traditional NC II delivery typically runs for around twenty (20) days. This project aims to compress and optimize that journey into a structured one (1) day interactive digital learning experience.

The platform provides:

- A trainee experience for login, module viewing, and simulation progress tracking.
- An admin experience for trainee management, batch management, CSV import/export, and controlled batch reset flows.
- A PostgreSQL-backed API with role-based authentication and account safety constraints.

## What this project is about

This repository contains a full-stack training system designed for cohort/batch-based delivery:

- **Trainees** can log in, study digital PDF modules, open lesson content, launch wiring simulations, and mark simulations as complete.
- **Admins** can create/manage batches and trainees, import trainees from CSV, export trainee records, and perform guarded reset operations with audit logs.
- **System safety** includes account-role integrity, bootstrap admin controls, and reset/export auditing.

The learning and simulation scope includes:

- Digital PDF modules covering core Mechatronics subjects.
- Interactive wiring simulations with structured difficulty progression.
- Progress tracking and reporting to monitor learner performance and competency growth.

## Repository structure

```
creo-mechalab-x/
  client/         # React + TypeScript frontend (trainee + admin UI)
  server/         # Express API + auth + admin/trainee endpoints
  mechalabx-db/   # PostgreSQL Docker setup + schema/seed/migration SQL
  database/       # Legacy MySQL schema draft (not the active runtime DB)
```

## Core features implemented

### Trainee side
- Session-based login flow (`/api/auth/login`) with JWT-based API access.
- Protected routes for dashboard, module view, and simulation view.
- Dashboard data from `/api/me/dashboard`.
- Simulation completion updates through `/api/me/simulations/:simulationId/complete`.
- PDF module viewing and a Konva-based simulation workspace UI.

### Learning design intent
- Simulations are intended to support level-based competency progression (Level 1 to Level 10).
- The digital flow is designed to improve wiring concept understanding through guided practice.
- Progress data supports performance monitoring and structured reporting outcomes.

### Admin side
- Admin-protected route namespace under `/api/admin/*`.
- Batch listing/creation.
- Trainee listing with search/filter and status toggling.
- Trainee create/update endpoints.
- Separate admin quiz management page at `/admin/quizzes`.
- CSV trainee import and CSV export.
- System reset flow with confirmation checks and audit logging.

### Data and safety
- PostgreSQL schema for trainees, accounts, modules, resources, simulations, and progress.
- Computed module completion view (`v_trainee_module_status`).
- Account role hardening (`admin` vs `trainee`) and protected admin behavior.
- Audit tables for exports and resets.

## Tech stacks present

### Frontend (`client`)
- **Framework/UI:** React 19, React Router, Tailwind CSS, Framer Motion, Lucide Icons
- **Language/Build:** TypeScript, Vite
- **HTTP/Data:** Fetch wrapper + Axios package present
- **Document/Canvas:** `react-pdf`/`pdfjs-dist`, `react-konva`/`konva`
- **Linting:** ESLint

### Backend (`server`)
- **Runtime/API:** Node.js, Express 5
- **Auth/Security:** JWT (`jsonwebtoken`), password hashing (`bcrypt`)
- **Data parsing/upload:** `csv-parse`, `multer`
- **Database clients:** `pg` (active), `mysql2` (present as dependency)
- **Config/Dev:** `dotenv`, `cors`, `nodemon`

### Database & tooling
- **Primary DB:** PostgreSQL 16
- **Containerization:** Docker Compose (Postgres + pgAdmin)
- **SQL assets:** schema, seed data, role safety migration, audit/reset migration, sanity checks

## Current implementation notes

- The active backend entrypoint is `server/index.js`.
- `server/package.json` maps `npm start` to `node index.js`.
- `database/schema.sql` is a legacy MySQL-oriented draft and differs from the active PostgreSQL setup in `mechalabx-db/db`.
- Some admin pages in `client/src/pages/admin` are currently UI-heavy mock/prototype screens; the trainee flow and major admin trainee/batch APIs are wired.

## Prerequisites

- Node.js 18+ (recommended 20+)
- npm 9+
- Docker Desktop (for PostgreSQL + pgAdmin)

## Environment variables

### `server/.env`

Required:

- `DATABASE_URL` (PostgreSQL connection string)
- `JWT_SECRET`

Common optional values used by the API:

- `PORT` (default: `4000`)
- `JWT_EXPIRES_IN` (default: `8h`)
- `ENABLE_DEV_GOD_MODE` (`true` enables the backend-issued Konami/God Mode admin session in non-production only)
- `DEFAULT_TRAINEE_PASSWORD` (used for CSV import)
- `RETURN_GENERATED_PASSWORD` (`true` only for non-production password reveal)
- `ADMIN_EMAILS` (comma-separated allowlist for bootstrap admin behavior)
- `NODE_ENV`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_SECURE` (`true`/`false`)
- `SMTP_FROM`

### `client/.env`

- `VITE_API_BASE_URL` (default fallback in code: `http://localhost:4000`)
- `VITE_ENABLE_CSV_IMPORT` (feature flag for CSV import UI)

## Local setup and run

1. **Start PostgreSQL and pgAdmin**

   From `mechalabx-db/`:

   ```bash
   docker compose up -d
   ```

   This auto-runs SQL files in `mechalabx-db/db/` on first init.

   The API now attempts to apply the quiz compatibility SQL at startup for existing databases too.
   If your database user cannot run DDL, apply the quiz schema manually:

   ```bash
   psql "$DATABASE_URL" -f "mechalabx-db/db/06_quizzes.sql"
   ```

2. **Install backend dependencies and run API**

   From `server/`:

   ```bash
   npm install
   npm start
   ```

3. **Install frontend dependencies and run client**

   From `client/`:

   ```bash
   npm install
   npm run dev
   ```

4. Open the frontend URL shown by Vite (usually `http://localhost:5173`).

## Local testing credentials

- Seeded admin: `admin@demo.local` / `P@ssw0rd!`
- Seeded trainees: `trainee01@demo.local` .. `trainee25@demo.local` / `P@ssw0rd!`
- Optional God Mode: set `ENABLE_DEV_GOD_MODE=true` in `server/.env`, then enter the Konami code on the login screen. This issues a real backend admin JWT in non-production; it is disabled in production.

## Helpful commands

### Client
- `npm run dev` – start Vite dev server
- `npm run build` – typecheck + production build
- `npm run lint` – run ESLint

### Server
- `npm start` – run API server
- `npm run sanity:db` – run DB sanity checks script
- `node server/scripts/smtp-verify.js` – verify SMTP credentials/config
- `ADMIN_TOKEN=... bash scripts/seed_25_trainees.sh` – seed 25 mock trainees via admin API

## Phase 4 credentials + SMTP

- Configure SMTP with provider credentials and app-specific passwords. Do not use personal mailbox passwords.
- `POST /api/admin/trainees` returns `email_sent` (`true` if sent) and `password_delivery` (`email`, `manual`, or `failed`).
- `POST /api/admin/trainees/:id/resend-credentials` enforces cooldown (5 minutes per trainee account).
- When cooldown is active, resend returns `429` with `retry_after_seconds`.

Production safety checklist:
- Set `NODE_ENV=production`.
- Set `RETURN_GENERATED_PASSWORD=false`.
- Never commit `.env` files.

## API snapshot

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/modules` (authenticated users: admin or trainee)
- `GET /api/trainees` (admin only)
- `GET /api/me/dashboard`
- `GET /api/me/module-status`
- `POST /api/me/simulations/:simulationId/complete`
- `GET /api/admin/auth-check`
- `GET/POST /api/admin/batches`
- `GET/POST /api/admin/quizzes`
- `GET/PATCH/DELETE /api/admin/quizzes/:quizId`
- `POST /api/admin/quizzes/:quizId/publish`
- `POST /api/admin/quizzes/:quizId/archive`
- `POST /api/admin/quizzes/:quizId/clone`
- `POST /api/admin/quizzes/:quizId/questions`
- `PATCH/DELETE /api/admin/quizzes/:quizId/questions/:questionId`
- `POST /api/admin/quizzes/:quizId/questions/:questionId/choices`
- `PATCH/DELETE /api/admin/quizzes/:quizId/questions/:questionId/choices/:choiceId`
- `GET /api/admin/trainees`
- `POST /api/admin/trainees`
- `PUT /api/admin/trainees/:id`
- `PATCH /api/admin/trainees/:id/status`
- `POST /api/admin/trainees/import-csv`
- `GET /api/admin/trainees/export-csv`
- `POST /api/admin/system/reset`

## Endpoint auth checks

Set tokens first:

```bash
API_BASE_URL=http://localhost:4000
ADMIN_TOKEN="<admin_jwt>"
TRAINEE_TOKEN="<trainee_jwt>"
```

Without token (should fail: `401`):

```bash
curl -i "$API_BASE_URL/api/modules"
curl -i "$API_BASE_URL/api/trainees"
```

Admin token (should work for both: `200`):

```bash
curl -i -H "Authorization: Bearer $ADMIN_TOKEN" "$API_BASE_URL/api/modules"
curl -i -H "Authorization: Bearer $ADMIN_TOKEN" "$API_BASE_URL/api/trainees"
```

Trainee token (modules works, trainees denied: `200` then `403`):

```bash
curl -i -H "Authorization: Bearer $TRAINEE_TOKEN" "$API_BASE_URL/api/modules"
curl -i -H "Authorization: Bearer $TRAINEE_TOKEN" "$API_BASE_URL/api/trainees"
```
