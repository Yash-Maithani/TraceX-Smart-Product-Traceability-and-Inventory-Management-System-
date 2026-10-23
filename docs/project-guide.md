# TraceX Project Guide (Start Here)

This guide explains TraceX in plain words for anyone joining the project. Read it before `SPEC.md` or `PROGRESS.md`, which are detailed reference documents.

## What TraceX does

TraceX tracks batches of organic food from the farm to the customer.

1. A **factory manager** records a new **batch**: which product, which farmer and village supplied it, how much, and when it was packed. TraceX works out the expiry date and gives the batch a code like `TX-2026-10-014`.
2. A **quality inspector** checks the batch against an 8-point checklist and gives a verdict: PASSED, FLAGGED or FAILED. A FAILED batch is put on **quality hold** and cannot be dispatched.
3. A **dispatch coordinator** sends batches out in **FEFO** order (First Expired, First Out), so the batch closest to expiry leaves first. Sending a later batch first needs a written reason.
4. Every batch gets a **QR code**. Anyone can scan it and see the product, dates and freshness, but never the farmer's name.
5. **Managers and admins** watch the dashboard, manage the team, approve access requests, and import many batches at once from a CSV file.

Everyone gets **notifications** and live updates, can chat in their role's **channel**, and can comment on batches and inspections. Optional extras: an **AI dispatch audit** and **Google sign-in**, both switched on by keys (see [setup/api-keys.md](setup/api-keys.md)).

## Who can do what

| Role | Main jobs |
|---|---|
| Factory manager | Create and correct batches, bulk import |
| Quality inspector | Inspect batches |
| Dispatch coordinator | Dispatch batches in FEFO order |
| Manager | Everything above except inspecting and dispatching; view the team |
| Admin | Everything, plus team management, archive and restore |
| Super admin | Admin powers, any role channel, and the recycle bin for deleted users |

The exact rules for every endpoint are in [permission-matrix.csv](permission-matrix.csv). Automated tests check every cell of that file.

## How it is built

```text
Browser (React + TypeScript, port 5174)
   |  HTTPS + JSON, sign-in token in the Authorization header
   v
Backend (Java 21 + Spring Boot, port 8081)
   |  live updates stream back to the browser (Server-Sent Events)
   v
MongoDB database (tracex_fresh_dev on your laptop)
```

| Folder | What is in it |
|---|---|
| `backend/src/main/java/com/tracex/controller` | The API endpoints (the URLs the browser calls) |
| `backend/src/main/java/com/tracex/service` | The business rules (FEFO, quality hold, imports, notifications) |
| `backend/src/main/java/com/tracex/model` | What is stored in MongoDB |
| `backend/src/test/java/com/tracex` | Backend tests |
| `frontend/src/features` | One folder per screen (batches, fefo, inspections, team, messages and so on) |
| `frontend/src/components/ui` | Shared buttons, tables, dialogs, badges |
| `frontend/e2e` | Browser tests that click through the real app |
| `docs/progress` | One log per phase: what changed and the test results |

## Running it on your laptop

See the [README](../README.md#running-locally). In short: start MongoDB, run the backend with the `dev` profile, then `npm run dev` in `frontend`, and open http://localhost:5174. The dev database is filled with demo users (`superadmin`, `admin`, `manager`, `factory_mgr`, `inspector`, `coordinator`); their shared password is `SEED_DEFAULT_PASSWORD` in `backend/src/main/resources/application-dev.properties`.

## How the work is organised

The project is built in **phases** (0 to 14). Each phase has a log in `docs/progress/phase-XX.md` with what was built, the decisions taken, and the exact test results. A phase ending in `.1`, `.2` and so on is a fix-up pass on the phase before it.

| Phases | What they built |
|---|---|
| 0 | Studied the old app and wrote the specification |
| 1 to 4 | Backend: sign-in, users, batches, FEFO, inspections, dispatch |
| 5 to 7 | Frontend screens, QR codes and the public trace page |
| 8 | Bulk CSV import; 8.2 fixed the security problems found in review |
| 9 to 11 | Team page and settings, notifications and chat, AI audit and Google sign-in |
| 12 | Legal pages, icons, animations and this guide |
| 13 to 14 | Hardening and going live (not started yet) |

`PROGRESS.md` is the full record. To read it quickly, look at the **Phase Table** at the top, then **Open Issues**, then the phase you care about.

## Words you will see

| Word | Meaning |
|---|---|
| FEFO | First Expired, First Out: dispatch the batch that expires soonest first |
| Quality hold | A batch whose latest inspection FAILED; it cannot be dispatched |
| Freshness tier | READY, WARNING, URGENT or EXPIRED, worked out from days to expiry (EXCEPTION if the date is broken) |
| Soft delete / archive | Hidden, not erased, so the history stays complete |
| `D-12`, `D-19` and so on | A numbered decision in the Decisions table in `PROGRESS.md` and `SPEC.md` |
| `M-01`, `S-02` and so on | A requirement: M is must-have, S is should-have (`SPEC.md` §1) |
| `OI-05` and so on | An open issue in `PROGRESS.md` |
| RBAC | Role-based access control: who may call which endpoint |
| SSE | Server-Sent Events, the live connection that pushes updates to the browser |

## Checks to run before you commit

```powershell
cd backend; .\mvnw.cmd clean verify
cd ..\frontend; npm run lint; npm run typecheck; npm run check:banned; npx vitest run
```

The browser tests (`npx playwright test`) need the backend jar built by `clean verify` and nothing else running on port 5174; the steps are in each phase log's verification section.

Never commit `backend/.env` or `frontend/.env.local`: they hold keys.
