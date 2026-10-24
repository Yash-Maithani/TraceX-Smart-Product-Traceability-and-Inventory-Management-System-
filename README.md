# TraceX

TraceX is a batch-traceability and FEFO (First Expired, First Out) inventory-management system for organic food production and warehouse operations.
The platform records product batches from farm-level raw-material sourcing through production, quality inspection, and warehouse dispatch.
Consumers scanning a product QR code receive a public provenance and freshness verification page with zero personal data exposure.

## Tech Stack

- **Backend**: Java 21, Spring Boot 3.2, Spring Security 6 (stateless JWT + per-request `tokenVersion`), Spring Data MongoDB, Spring Mail, ZXing (QR generation), Springdoc OpenAPI
- **Frontend**: React 18, TypeScript 5, Vite 6, React Router v6, TanStack Query v5, CSS Modules
- **Database**: MongoDB (`tracex_fresh_dev`, `tracex_fresh_test`, `tracex_fresh_e2e`, `tracex_fresh`)
- **Testing**: JUnit 5 & Spring MockMvc (backend), Vitest, Testing Library & `vitest-axe` (frontend unit), Playwright & `@axe-core/playwright` (end-to-end)

New to the project? Read the [Project Guide](docs/project-guide.md) first. It explains what TraceX does, who can do what, how the code is laid out, and the words used in the other documents.

## Prerequisites

- Java 21 JDK (the Maven wrapper `mvnw.cmd` downloads Maven itself)
- Node.js 20 and npm
- MongoDB running locally on `mongodb://localhost:27017` (the backend tests and the dev profile both expect it)
- Windows PowerShell for the helper scripts in `scripts/`

## Running Locally

### Backend (API on port `8081`)

```powershell
cd backend
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=dev"
```

The `dev` profile must be named explicitly. With no profile set, the backend applies production rules and refuses to start without real secrets (`JWT_SECRET`, `TRACE_TOKEN_SECRET`, `FRONTEND_URL`, `PUBLIC_TRACE_BASE_URL`). The Docker image sets `SPRING_PROFILES_ACTIVE=prod`.

### Frontend (Vite dev server on port `5174`)

```powershell
cd frontend
npm install
npm run dev
```

## Environment Variables (Names Only)

### Backend (`backend/.env.example`)

- `SPRING_PROFILES_ACTIVE`
- `SERVER_PORT`
- `SPRING_DATA_MONGODB_URI`
- `JWT_SECRET`
- `JWT_EXPIRATION_SECONDS`
- `TRACE_TOKEN_SECRET`
- `PUBLIC_TRACE_BASE_URL`
- `FRONTEND_URL`
- `BUSINESS_TIME_ZONE`
- `SEED_ENABLED`
- `SEED_DEFAULT_PASSWORD`
- `MAIL_HOST`
- `MAIL_PORT`
- `MAIL_USERNAME`
- `MAIL_PASSWORD`
- `MAIL_FROM`
- `GOOGLE_CLIENT_ID`
- `GEMINI_API_KEY`
- `NVIDIA_API_KEY`

The AI dispatch audit and Google sign-in stay hidden until their keys are set. See [docs/setup/api-keys.md](docs/setup/api-keys.md) for how to get the keys for free and where to put them. Never commit a `.env` file.

### Frontend (`frontend/.env.example`)

- `VITE_API_BASE_URL`
- `VITE_PUBLIC_TRACE_BASE_URL`
- `VITE_GOOGLE_CLIENT_ID`

## Running Tests

### Backend Test Suite

```powershell
cd backend
.\mvnw.cmd test
```

### Frontend Static Checks & Unit Tests

```powershell
cd frontend
npm run typecheck
npm run lint
npm run check:banned
npm run check:api-drift
npm run check:permissions-drift
npx vitest run
```

### End-to-End Tests (Playwright)

```powershell
cd frontend
npx playwright test
```

Before running the browser tests, build the backend jar (`.\mvnw.cmd clean verify` in `backend`), stop any dev server on port `5174`, run `scripts\e2e-reset.ps1`, and start the backend with `java -jar target/tracex-backend-1.0.0-SNAPSHOT.jar --spring.profiles.active=e2e` from `backend`.

## Documentation

- [Project Guide (`docs/project-guide.md`)](docs/project-guide.md): start here
- [API Key Setup (`docs/setup/api-keys.md`)](docs/setup/api-keys.md)
- [System Specification (`SPEC.md`)](SPEC.md)
- [Design System (`DESIGN.md`)](DESIGN.md): colours, type, components and copy rules for the UI
- UI/UX redesign evidence: [audit](docs/06-ui/AUDIT.md), [research](docs/06-ui/RESEARCH.md), [imagery](docs/06-ui/IMAGERY.md), [before](docs/screenshots/before/) and [after](docs/screenshots/after/) screenshots
- [Project Progress & Verification Log (`PROGRESS.md`)](PROGRESS.md)
- [Permission Matrix (`docs/permission-matrix.csv`)](docs/permission-matrix.csv)
- Historical, from before the rebuild (describe the old Node app, not this code): [`docs/BRIEF.md`](docs/BRIEF.md), [`docs/HANDOFF.md`](docs/HANDOFF.md)