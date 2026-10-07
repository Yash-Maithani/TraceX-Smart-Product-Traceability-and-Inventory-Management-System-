# TraceX

TraceX is a batch-traceability and FEFO (First Expired, First Out) inventory-management platform for organic food production and distribution.
It tracks product batches from farm-level raw-material sourcing through production, quality inspection, and warehouse dispatch.
Consumers can scan a batch QR code to view an unauthenticated provenance and freshness page with zero PII exposure.

## Tech Stack

- **Backend**: Java 21, Spring Boot 3.2, Spring Security 6 (stateless JWT + per-request 	okenVersion), Spring Data MongoDB, Spring Mail, ZXing (QR generation), Springdoc OpenAPI
- **Frontend**: React 18, TypeScript 5, Vite 6, React Router v6, TanStack Query v5, CSS Modules
- **Database**: MongoDB (	racex_fresh_dev, 	racex_fresh_test, 	racex_fresh_e2e, 	racex_fresh)
- **Testing**: JUnit 5 & Spring MockMvc (backend), Vitest, Testing Library & itest-axe (frontend unit), Playwright & @axe-core/playwright (end-to-end)

## Running Locally

### Backend (API on port 8081)

`powershell
cd backend
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=dev"
`

### Frontend (Vite dev server on port 5174)

`powershell
cd frontend
npm install
npm run dev
`

## Environment Variables (Names Only)

### Backend (ackend/.env.example)

- SPRING_PROFILES_ACTIVE
- SERVER_PORT
- SPRING_DATA_MONGODB_URI
- JWT_SECRET
- JWT_EXPIRATION_SECONDS
- TRACE_TOKEN_SECRET
- PUBLIC_TRACE_BASE_URL
- FRONTEND_URL
- BUSINESS_TIME_ZONE
- SEED_ENABLED
- SEED_DEFAULT_PASSWORD
- MAIL_HOST
- MAIL_PORT
- MAIL_USERNAME
- MAIL_PASSWORD
- MAIL_FROM
- GOOGLE_CLIENT_ID
- GEMINI_API_KEY
- NVIDIA_API_KEY

### Frontend (rontend/.env.example)

- VITE_API_BASE_URL
- VITE_PUBLIC_TRACE_BASE_URL
- VITE_GOOGLE_CLIENT_ID

## Running Tests

### Backend Test Suite

`powershell
cd backend
.\mvnw.cmd test
`

### Frontend Static Checks & Unit Tests

`powershell
cd frontend
npm run typecheck
npm run lint
npm run check:banned
npm run check:api-drift
npm run check:permissions-drift
npx vitest run
`

### End-to-End Tests (Playwright)

`powershell
cd frontend
npx playwright test
`

## Documentation

- [System Specification (SPEC.md)](SPEC.md)
- [Build Progress & Verification Log (PROGRESS.md)](PROGRESS.md)
- [Project Brief (docs/BRIEF.md)](docs/BRIEF.md)
- [Handoff Summary (docs/HANDOFF.md)](docs/HANDOFF.md)