# TraceX — Master Project Brief

## What is TraceX?

TraceX is a batch-traceability and inventory-management system for an organic food company
(TraceX Technologies, Uttarakhand, India). It tracks batches of produce from raw-material
sourcing through production, quality inspection, and dispatch to the end consumer.

A consumer who scans a QR code on a jar receives a public provenance page (farmer, village,
batch code, expiry, quality verdict) with no login required.

The internal warehouse team uses a protected dashboard to create batches, run quality
inspections, manage dispatch order (FEFO — First Expired First Out), and administer users.

## Reference workspace

`c:\Users\yashm\OneDrive\Desktop\TraceX-Smart-Product-Traceability-and-Inventory-Management-System`

This is a working prototype built by interns. It has a Node.js/Express backend, a Vite+React
frontend, and an incomplete Spring Boot port (`tracex-backend/`). It is read-only: the new
project is rebuilt from scratch in this (`TraceX/`) folder.

## New project goal

Rebuild TraceX as a production-quality Node + React monorepo with:
- Full RBAC, token-version session revocation, and httpOnly cookie option
- Clean Spring Boot Java port (API-compatible) replacing the Node backend in Phase 14
- Full test coverage aligned to docs/traceability.md
- CI-ready Docker Compose for local dev

## Phase structure

| Phase | Summary |
|-------|---------|
| 0 | Audit reference, write SPEC.md and PROGRESS.md (no code) |
| 1 | Project scaffold, config, health check |
| 2 | Auth (register, login, token revocation) |
| 3 | User management CRUD + RBAC middleware |
| 4 | Access-request approval and invite flow |
| 5 | Product catalogue (read from shared collection) |
| 6 | Batch creation, QR, trace token, public trace page |
| 7 | FEFO dispatch queue |
| 8 | Quality inspection |
| 9 | Bulk import (CSV/XLSX) |
| 10 | Notifications + Socket.IO |
| 11 | AI dispatch audit (Gemini + NVIDIA fallback) |
| 12 | Admin panel, soft-delete, restore, login history |
| 13 | E2E tests, accessibility audit, performance baseline |
| 14 | Spring Boot Java port, Docker Compose, runbook |
