# FixGrid AI — Civic Issue Intelligence & Community Innovation Platform

**Tagline:** Connecting Communities. Empowering Innovators. Creating Impact. (`Report. Resolve. Innovate.`)  
**Scope:** Intelligent Civic Issue Management & Community Innovation Platform

---

## Pure JavaScript Architecture

The entire codebase is written in standard **ES Module JavaScript (`.js` and `.jsx`)** with zero TypeScript dependencies:

- **Frontend (`src/`)**: React 19, Vite, Tailwind CSS v4, Motion (`motion/react`), React Router DOM, Lucide React, Recharts, Leaflet + OpenStreetMap.
- **Backend (`server.js`, `server/`)**: Node.js, Express.js, JWT (`jsonwebtoken`), `bcryptjs`, `multer` (validated media uploads), `@google/genai` (server-side Gemini AI).
- **Database (`server/config/db.js`, `prisma/schema.prisma`)**: Relational SQLite (`better-sqlite3`) implementing the full relational schema documented in `prisma/schema.prisma` so the application runs immediately with zero external DB server configuration.

---

## Local Development Demo Accounts

When `DEMO_MODE` is not `"false"`, you can use the **Explore All Six Role Dashboards** switcher on `/auth` or sign in with password (`FixGridDemo#2026` unless overridden by `DEMO_DEFAULT_PASSWORD`):

| Role | Email | Demo Persona |
| :--- | :--- | :--- |
| Citizen | `aarav@citizen.demo` | Aarav Sharma |
| Government Official | `priya.ias@mathura.demo` | Priya Verma |
| Student Innovator | `rohan.cs@gla.demo` | Rohan Deshmukh |
| Faculty Mentor | `dr.mehta@gla.demo` | Dr. Meera Kulkarni |
| Industry / CSR Partner | `kavita.csr@brijtech.demo` | Kavita Nair |
| Platform Administrator | `admin@fixgrid.demo` | Vikramaditya Rao |

All seeded complaints, departments, and organizations are clearly labeled as Mathura demonstration data.

---

## Environment Variables (`.env`)

- `GEMINI_API_KEY`: Enables multimodal Gemini (`gemini-4-hydrogen` + `gemini-embedding-2`) analysis on `/api/complaints`. When unset, FixGrid AI transparently uses its rule-based fallback analyzer.
- `SESSION_SECRET`: Optional HMAC/JWT signing secret (ephemeral cryptographic secret generated automatically in memory if unset).
- `DEMO_MODE`: Set to `false` to disable one-click demo role buttons.
