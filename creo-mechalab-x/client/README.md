# CREO MechaLab X Client

Frontend application for trainee and admin interfaces of CREO MechaLab X.

For full repository documentation (architecture, backend, DB, setup), see the root README:

- `../README.md`

## Tech stack

- React 19 + TypeScript
- Vite
- React Router
- Tailwind CSS
- Framer Motion
- Lucide React icons
- react-pdf / pdfjs-dist
- react-konva / konva

## Main pages

- `/login` – authentication
- `/dashboard` – trainee dashboard and progress
- `/module/:id` – trainee module viewer (PDF)
- `/simulation/:id` – trainee simulation workspace
- `/admin/*` – admin dashboard, trainees, lessons, activity logs

## API integration

Configured in `src/api/http.ts`.

- Default API base URL: `http://localhost:4000`
- Override via `VITE_API_BASE_URL`
- Bearer token is attached from session storage

## Environment variables

Create `client/.env` when needed:

```bash
VITE_API_BASE_URL=http://localhost:4000
VITE_ENABLE_CSV_IMPORT=true
```

## Run locally

```bash
npm install
npm run dev
```

Then open the Vite URL shown in terminal (typically `http://localhost:5173`).

## Scripts

- `npm run dev` – start dev server
- `npm run build` – type-check + build
- `npm run lint` – lint source
- `npm run preview` – preview production build
