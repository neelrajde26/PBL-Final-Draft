# MDIS Security Architecture & Hardening Guide
## Maharashtra Drought Intelligence System

This document outlines the authentication protocols, cryptographic standards, secret protection mechanisms, and role-based access control (RBAC) policies in MDIS.

---

### 1. Cryptographic Standards
- **Password Hashing:** Argon2id via `argon2-cffi` (Memory cost: 65,536 KiB, Time cost: 3 iterations, Parallelism: 4 threads). Argon2id provides state-of-the-art resistance against GPU/ASIC brute-force attacks and side-channel timing analysis.
- **Session Tokens:** JSON Web Tokens (JWT) signed with HMAC-SHA256 (`HS256`).
- **Session Transport:** Transported exclusively via `HttpOnly`, `SameSite=Lax`, and `Secure` (in production) cookies under key `mdis_session`. Tokens are never exposed to browser `localStorage` or JavaScript execution context to prevent Cross-Site Scripting (XSS) token theft.

---

### 2. Role-Based Access Control (RBAC)

Three distinct authorization tiers are enforced via FastAPI dependency injection:

| Role | Privileges | Registration Pathway |
|---|---|---|
| `FARMER` | View dashboards, map, historical data, district profiles, receive localized advisories, submit ground-truth field reports. | Public registration defaults strictly to `FARMER`. |
| `RESEARCHER` | All Farmer privileges + raw satellite reduction queries, advanced ML model registry inspection, batch GeoJSON/CSV exports, and inference execution. | Provisioned by Admin. |
| `ADMIN` | All privileges + system user management, activation toggles, background pipeline orchestration triggers, and raw health telemetry. | Bootstrap script only (`admin@mdis.gov.in`); public signup impossible. |

---

### 3. Secret Management & Credential Protection
- **Zero Secrets in Source Control:** `.gitignore` excludes all `.env`, `.env.local`, credentials JSON, and private key files.
- **Google Earth Engine Authentication:**
  - Local development uses Application Default Credentials (ADC) without committed service account JSON keys.
  - Production uses dedicated Workload Identity / IAM service account mapped via environment variable `GEE_PROJECT_ID=gee-pbl`.
  - Credentials remain strictly encapsulated within the backend server. No GEE tokens or private keys are ever transmitted to the frontend or browser.
- **Secret-Safe Logging:** Structlog logger redacts passwords, tokens, and database connection strings from stdout and log files.

---

### 4. Input Validation & API Protection
- **Pydantic Strict Typing:** All incoming request payloads are validated against strict Pydantic schemas before reaching business logic.
- **SQL Injection Prevention:** 100% of SQL executions use parameterized queries (`sqlalchemy.text(...)` with named bind parameters). Raw string concatenation of user input into SQL is strictly forbidden.
- **Rate Limiting:** SlowAPI middleware limits authentication endpoints to 10 requests per minute per IP to defend against brute-force credential stuffing.

