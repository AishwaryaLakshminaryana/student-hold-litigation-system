# Student Hold & Litigation Tracking System

A production-oriented starter implementation for student-hold matter management. It includes a React/TypeScript UI, Express/TypeScript API, PostgreSQL/Prisma data model, role checks, immutable status history, append-only audit events, litigation match review, task tracking, and a guided hold-lift endpoint.

## Run locally
1. Copy `.env.example` to `.env`.
2. Run `docker compose up -d`.
3. Run `npm install`.
4. Run `npm run prisma:generate -w apps/api` and `npm run db:push -w apps/api`.
5. Run `npm run seed -w apps/api`.
6. Run `npm run dev` and open `http://localhost:5173`.

Development authentication is explicit and marked in the UI. Replace it with validated OpenID Connect before deployment. Uploaded evidence, email delivery, mailbox ingestion, malware scanning, court searches, institution checks, and external notifications are adapters or mocked/unconfigured. Do not use the local storage adapter for production.

## Security checklist
- Disable `DEV_AUTH`; configure OIDC and MFA policy.
- Use TLS, managed PostgreSQL encryption, private networking, and a secrets manager.
- Connect malware scanning before accepting uploads.
- Use immutable/versioned object storage and backup/restore testing.
- Review FERPA, professional-responsibility, privilege, retention, breach-response, and jurisdiction-specific requirements with qualified counsel.
- Run authorization, dependency, SAST, DAST, and restore tests before processing real records.

## Known limitations
This starter does not certify evidentiary compliance, provide legal advice, send email, monitor mailboxes, search courts, scan malware, extract intake files, or verify institution systems. PDF/CSV report endpoints and production object storage are extension points. Demo data is fictitious.
