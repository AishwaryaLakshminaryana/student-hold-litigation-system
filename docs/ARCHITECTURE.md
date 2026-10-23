# Architecture and contracts

## Components
- React SPA: accessible navigation, dashboard, record lists, responsive layouts.
- Express API: validation, server-side RBAC, transactional workflows, audit creation.
- PostgreSQL via Prisma: relational integrity, version fields, status history.
- Object storage adapter: intentionally unconfigured; production must use immutable/versioned storage plus malware scanning.
- Identity adapter: development actor is explicit; production requires OIDC validation and MFA policy.

## Permission matrix
- Attorney/Admin: full CRUD, lift confirmation, user/configuration, exports.
- Legal Staff: intake, holds, communications, files, tasks; no final lift or administration.
- Auditor: read records/audit; no mutation/export by default.
- Student Portal: only separately approved, owner-scoped projections. Not implemented in starter UI.
- Institution Contact: secure submission and approved notices only. Not implemented in starter UI.

## Screen map
Sign-in → Dashboard → Students → Student profile → Holds → Hold detail/status history/lift → Matters → Communications → Evidence → Tasks → Notifications → Litigation searches → Reports → Audit → Administration → Settings.

## API implemented
- `GET /api/dashboard`
- `GET /api/students`
- `GET|POST /api/holds`
- `POST /api/holds/:id/status`
- `POST /api/holds/:id/lift`
- `GET /api/tasks`
- `GET /api/matters`
- `GET /api/audit`

The schema includes the remaining entities. Add endpoints using the same Zod validation, `allow(...)` server authorization, Prisma transactions, and append-only audit pattern.

## Hold-lift contract
`POST /api/holds/:id/lift` requires confirmedBy, effectiveAt, proofReference, studentRecipient, supervisorRecipient, and attorneyRecipient. It blocks while open tasks exist, appends status history, creates three notification drafts, creates final verification work, and audits the action. It does not send messages.

## Deployment
Build immutable API and web images, run Prisma migration as a controlled release job, deploy behind TLS/WAF, connect managed PostgreSQL and versioned object storage, centralize non-sensitive telemetry, and keep secrets in the platform secret store. Establish RPO/RTO with counsel and the system owner, then test restore procedures. Values are intentionally not invented here.
