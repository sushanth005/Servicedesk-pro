<div align="center">

<img src="client/src/logo.png" alt="ServiceDesk Pro Logo" width="96" />

# ServiceDesk Pro

**AI-triaged IT helpdesk & full asset lifecycle management — built on the MERN stack with Groq LLM**

[![Node](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![MongoDB](https://img.shields.io/badge/MongoDB-6%2B-47A248?logo=mongodb&logoColor=white)](https://mongodb.com)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com)
[![Groq AI](https://img.shields.io/badge/Groq-LLaMA%203.3--70B-FF6C37)](https://groq.com)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

</div>

---

## Table of Contents

1. [Overview](#overview)
2. [Key Features](#key-features)
3. [Tech Stack](#tech-stack)
4. [Architecture](#architecture)
5. [Database Schema](#database-schema)
6. [API Reference](#api-reference)
7. [Role Matrix](#role-matrix)
8. [Quick Start](#quick-start)
9. [Environment Variables](#environment-variables)
10. [AI Integration](#ai-integration-groq)
11. [SLA Engine](#sla-engine)
12. [Security](#security)
13. [Testing](#testing)
14. [Project Structure](#project-structure)
15. [Demo Accounts](#demo-accounts)
16. [Deployment](#deployment)
17. [Known Limitations & Notes](#known-limitations--notes)

---

## Overview

**ServiceDesk Pro** is a production-ready, full-stack IT service management platform. It combines intelligent ticket triage (Groq / LLaMA), strict SLA enforcement with business-hours awareness, a complete asset register, a knowledge base, and deep role-based access control — all under one roof.

> Every ticket is classified, prioritised and linked to a candidate knowledge-base fix the moment it arrives — before any human touches it.

---

## Key Features

| Feature | Description |
|---|---|
| 🤖 **AI Triage** | Category, priority, probable issue, confidence & reasoning via Groq. Falls back to keyword classifier with zero config |
| ⏱ **SLA Engine** | Response + resolution due dates per priority, business-hours aware, pause-on-hold, auto-escalation cron sweep |
| 📦 **Asset Lifecycle** | Hardware & software from procurement → retirement. Warranty/licence alerts, vendor linking, ticket association |
| 🔐 **RBAC** | 5 roles × department-scoped visibility. JWT auth, bcrypt passwords, every route protected |
| 📚 **Knowledge Base** | Articles with draft/publish workflow, tag search, AI-ranked suggestions, create-from-ticket |
| 📊 **Reports & Dashboards** | Role-specific dashboards, SLA compliance, technician workload, category/priority trends (Recharts) |
| 🔔 **Notifications** | In-app bell, 30-second polling, per-event alerts |
| 📤 **Exports** | CSV & PDF for tickets, assets and audit trail |
| 🛡 **Audit Trail** | Immutable log of every write: user, role, action, entity, IP — searchable, exportable |
| 🧩 **Admin Panel** | Organisations, users, departments, categories, priorities, SLA policies, business hours & holidays |

---

## Tech Stack

### Frontend — `client/`

| Technology | Version | Purpose |
|---|---|---|
| **React** | 18.3 | UI framework |
| **React Router DOM** | 6.24 | Client-side routing (SPA) |
| **Recharts** | 2.12 | Area, bar, pie charts on dashboards |
| **Lucide React** | 0.400 | SVG icon system |
| **Axios** | 1.7 | HTTP client, API calls |
| **Vite** | 5.3 | Build tool & dev server (ESM, HMR) |
| **Vanilla CSS** | — | Custom design system (no framework) |
| **IBM Plex Sans / Mono** | — | Typography (Google Fonts) |

### Backend — `server/`

| Technology | Version | Purpose |
|---|---|---|
| **Node.js** | ≥ 18 | Runtime |
| **Express** | 4.19 | HTTP server & REST API framework |
| **Mongoose** | 8.5 | ODM for MongoDB |
| **MongoDB** | ≥ 6 | Primary database (16 collections) |
| **JSON Web Tokens** | 9.0 | Stateless auth tokens |
| **bcryptjs** | 2.4 | Password hashing (salt rounds 10) |
| **Zod** | 3.23 | Request validation & schema inference |
| **Helmet** | 7.1 | HTTP security headers |
| **CORS** | 2.8 | Cross-origin allow-list |
| **express-rate-limit** | 7.4 | Login & AI endpoint rate limiting |
| **Multer** | 1.4 | File upload handling (allow-list + size cap) |
| **PDFKit** | 0.15 | Server-side PDF generation for exports |
| **node-cron** | 3.0 | SLA sweep scheduler (default: every minute) |
| **Morgan** | 1.10 | HTTP request logging |
| **dotenv** | 16.4 | Environment variable loading |
| **Groq SDK** | latest | LLaMA 3.3-70B Versatile AI calls |

### Infrastructure

| Tool | Purpose |
|---|---|
| **Docker / docker-compose** | Local MongoDB container |
| **Nodemon** | Dev auto-reload |
| **Node `--test`** | Built-in test runner (no Jest required) |

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│                   Browser (React SPA)            │
│  React Router  ·  Recharts  ·  Axios  ·  Vite   │
└────────────────────────┬─────────────────────────┘
                         │  REST /api/*  (JSON)
                         │  Proxy (dev) or same origin (prod)
┌────────────────────────▼─────────────────────────┐
│               Express API  (Node 18+)            │
│                                                  │
│  ┌──────────┐  ┌────────────┐  ┌─────────────┐  │
│  │  Routes  │  │ Middleware │  │  Services   │  │
│  │ auth     │  │ JWT auth   │  │ ai.js       │  │
│  │ tickets  │  │ RBAC       │  │ sla.js      │  │
│  │ assets   │  │ validate   │  │ analytics   │  │
│  │ articles │  │ audit log  │  │ notify      │  │
│  │ users    │  │ upload     │  │ ticketSvc   │  │
│  │ misc     │  │ sanitise   │  └─────────────┘  │
│  └──────────┘  └────────────┘                   │
│                                                  │
│  node-cron  ──► SLA sweep (every minute)         │
└────────────────────────┬─────────────────────────┘
                         │  Mongoose ODM
┌────────────────────────▼─────────────────────────┐
│                MongoDB (16 collections)          │
│  tickets · users · assets · articles · audit     │
│  organizations · departments · categories        │
│  priorities · slaPolicies · comments · workLogs  │
│  notifications · vendors · savedFilters · counter│
└──────────────────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────┐
│              Groq API  (LLaMA 3.3-70B)           │
│  Triage · Solution ranking · Reply drafting      │
│  Falls back to built-in classifier if no key     │
└──────────────────────────────────────────────────┘
```

---

## Database Schema

### 16 Mongoose Collections

| Collection | Key Fields |
|---|---|
| `organizations` | name, code, timezone, businessHours, holidays |
| `users` | name, email, passwordHash, role, org, departments |
| `departments` | name, org |
| `categories` | name, org, requiresApproval, aiKeywords |
| `priorities` | name, color, org, slaPolicy ref |
| `slaPolicies` | name, responseMin, resolutionMin, org |
| `tickets` | number, title, description, status, priority, category, requester, assignee, sla (due dates + breached flags), attachments, org |
| `comments` | ticket, author, body, type (public/internal), attachments |
| `workLogs` | ticket, technician, minutes, description |
| `assets` | tag, name, type (hardware/software), status, assignedTo, vendor, warrantyExpiry, licenceExpiry |
| `vendors` | name, contact, org |
| `articles` | title, body, tags, category, status (draft/published), votes |
| `auditLogs` | user, role, action, entity, entityId, diff, ip, timestamp |
| `notifications` | user, title, message, type, link, read |
| `savedFilters` | user, name, filters |
| `counter` | Auto-incrementing ticket numbers per org |

---

## API Reference

Base URL: `http://localhost:5000/api`

### Auth
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | — | Create account (org code required) |
| `POST` | `/auth/login` | — | Returns JWT |
| `GET` | `/auth/me` | ✅ | Current user |

### Tickets
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/tickets` | ✅ | List (filters, search, pagination) |
| `POST` | `/tickets` | ✅ | Create (with file upload) |
| `GET` | `/tickets/:id` | ✅ | Detail + comments + timeline |
| `PATCH` | `/tickets/:id` | ✅ | Update fields |
| `POST` | `/tickets/:id/comments` | ✅ | Add comment / internal note |
| `POST` | `/tickets/:id/assign` | admin/manager | Assign to technician |
| `POST` | `/tickets/:id/resolve` | staff | Resolve |
| `POST` | `/tickets/:id/confirm` | requester | Confirm resolution |
| `POST` | `/tickets/:id/reopen` | requester | Reopen (7-day window) |
| `POST` | `/tickets/:id/hold` | staff | Pause SLA clock |
| `POST` | `/tickets/:id/resume` | staff | Resume SLA clock |
| `POST` | `/tickets/:id/worklogs` | staff | Log time |
| `POST` | `/tickets/:id/escalate` | staff | Request escalation |
| `POST` | `/tickets/:id/approve` | manager | Manager approval |
| `GET` | `/tickets/:id/export` | ✅ | PDF export |

### AI
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/ai/triage` | Live triage (called on ticket creation / re-analyse) |
| `POST` | `/ai/suggest` | Solution suggestions for a ticket |

### Assets, Articles, Users, Reports — all under `/api/*` (RBAC enforced)

---

## Role Matrix

| Capability | Admin | IT Manager | Technician | Asset Manager | Employee |
|---|:---:|:---:|:---:|:---:|:---:|
| Own tickets, comments, confirm/reopen | ✅ | ✅ | ✅ | ✅ | ✅ |
| View **all** tickets | ✅ | dept only | dept / assigned | ❌ | own only |
| Assign, escalate, approve | ✅ | ✅ | take unassigned | ❌ | ❌ |
| Work logs, status changes | ✅ | ✅ | ✅ | ❌ | ❌ |
| Full asset management | ✅ | own devices | repair notes | ✅ | own devices |
| Users, SLA, categories, org config | ✅ | read users | ❌ | ❌ | ❌ |
| Reports & audit trail | ✅ | ✅ | workload only | ❌ | ❌ |

> **Department scoping:** a manager or technician with an empty "Departments served" list sees everything in their org. Otherwise, only tickets from those departments (plus their own and, for technicians, tickets assigned to them).

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **MongoDB** ≥ 6 — one of:
  - Local install
  - `docker compose up -d` (runs MongoDB 7 on port 27017)
  - [MongoDB Atlas](https://mongodb.com/atlas) free cluster

### 1. Clone

```bash
git clone https://github.com/your-org/servicedesk-pro.git
cd servicedesk-pro
```

### 2. Server setup

```bash
cd server
cp .env.example .env        # edit values (see Environment Variables below)
npm install
npm run seed                # ⚠ drops & recreates the DB with demo data
npm run dev                 # API at http://localhost:5000
```

### 3. Client setup (new terminal)

```bash
cd client
npm install
npm run dev                 # App at http://localhost:5173
```

The Vite dev server automatically proxies `/api` requests to `localhost:5000`.

---

## Environment Variables

All variables live in `server/.env` (copy from `server/.env.example`).

| Variable | Default | Required | Description |
|---|---|---|---|
| `PORT` | `5000` | No | Express listen port |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/servicedesk_pro` | **Yes** | MongoDB connection string |
| `JWT_SECRET` | `change_this_to_a_long_random_string` | **Yes** | HS256 signing secret — use 32+ random chars in prod |
| `JWT_EXPIRES` | `8h` | No | Token lifetime (e.g. `8h`, `1d`) |
| `CLIENT_URL` | `http://localhost:5173` | **Yes (prod)** | Allowed CORS origin |
| `GROQ_API_KEY` | *(empty)* | No | From [console.groq.com/keys](https://console.groq.com/keys). Omit for fallback mode |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | No | Any Groq-supported model slug |
| `SLA_CRON` | `* * * * *` | No | cron expression for SLA sweep (default: every minute) |
| `NODE_ENV` | `development` | **Yes (prod)** | Set to `production` to enable prod optimisations |

---

## AI Integration (Groq)

The AI layer lives in `server/src/services/ai.js`.

### Triage flow
1. Ticket title + description sent to Groq with a system prompt that **constrains output** to your real category/priority IDs — the model cannot invent values.
2. Response: `{ category, priority, summary, confidence, reasoning }` — stored on the ticket.
3. Re-triggered on demand via "Re-analyse" button.
4. Also fires **live** while the employee types (debounced on the client).

### Solution suggestions
1. MongoDB full-text search retrieves candidate articles by keyword overlap.
2. Groq ranks them, extracts fix steps and drafts a first-reply suggestion.
3. Similar resolved tickets are surfaced alongside.
4. Employees see self-service article suggestions _before_ submitting (reduces ticket volume).

### Fallback mode
When `GROQ_API_KEY` is absent or Groq is unreachable, the app falls back to a **built-in keyword classifier** and TF-IDF-style keyword ranking. The UI indicates which engine answered. Zero downtime.

---

## SLA Engine

Lives in `server/src/services/sla.js` + `utils/businessTime.js`.

- **Policies** → response & resolution minutes per priority.
- **Business hours** → configurable per-org (start/end time, working days, UTC offset).
- **Holidays** → per-org holiday list; holiday days are excluded from the SLA clock.
- **Hold** → `PATCH /tickets/:id/hold` pauses the SLA clock. Wall-clock time on hold is added to the due dates when resumed.
- **Cron sweep** (default every minute):
  - Marks tickets `resolutionBreached` / `responseBreached`.
  - Fires escalation rules: notify assignee, managers, admins; optionally reassign or raise priority.
- SLA compliance % and average first-response time are available in the reports dashboard.

---

## Security

| Control | Implementation |
|---|---|
| Authentication | JWT (HS256), `Authorization: Bearer` header |
| Password storage | bcrypt, 10 salt rounds |
| Route protection | `requireAuth` + `requireRole` middleware on every route |
| Request validation | Zod schemas on all write endpoints |
| NoSQL injection | Mongo operator sanitisation middleware |
| XSS / clickjacking | Helmet (CSP, X-Frame-Options, etc.) |
| CORS | Allow-list via `CLIENT_URL` env var |
| Rate limiting | Login: 20 req/15 min. AI endpoints: separate limiter |
| File uploads | Extension allow-list, MIME check, 10 MB size cap |
| CSV export | Formula-injection protection (values prefixed to prevent `=cmd()`) |
| Audit trail | Immutable log of every successful write |

---

## Testing

```bash
cd server
npm test
```

Uses Node's built-in `--test` runner (no extra dependencies). Tests cover:

- **Business-hours SLA math** — weekends, holidays, timezone offsets, clock pause/resume
- **Fallback AI classifier** — category and priority keyword matching
- **Zod validation rules** — boundary conditions on schema fields

---

## Project Structure

```
servicedesk-pro/
├── docker-compose.yml          # Local MongoDB 7
├── README.md
├── DEPLOYMENT.md
│
├── client/                     # React SPA (Vite)
│   ├── index.html
│   ├── vite.config.js          # /api proxy → :5000
│   ├── package.json
│   └── src/
│       ├── main.jsx            # React root
│       ├── App.jsx             # Routes + auth guard
│       ├── api.js              # Axios instance (base URL, JWT header)
│       ├── styles.css          # Full design system (CSS vars, components)
│       ├── utils.js            # Helpers: ago(), initials(), ROLE_LABEL, useApi hook
│       ├── logo.png            # Brand logo
│       ├── context/
│       │   └── Auth.jsx        # AuthContext (login, logout, register, can())
│       ├── components/
│       │   ├── Layout.jsx      # Shell: full-width header + collapsible sidebar + outlet
│       │   ├── ui.jsx          # Primitives: Avatar, Card, Stat, Modal, Badge, SlaTimer…
│       │   └── CrudManager.jsx # Generic list/create/edit/delete component
│       └── pages/
│           ├── Login.jsx       # Sign in / register (split layout, demo pills)
│           ├── Dashboard.jsx   # Role-specific home (hero, stat cards, charts)
│           ├── Tickets.jsx     # List with filters, search, saved filters
│           ├── TicketNew.jsx   # Create ticket (AI triage preview)
│           ├── TicketDetail.jsx# Thread, SLA, AI suggestions, timeline, work logs
│           ├── Assets.jsx      # Asset register (CRUD, lifecycle, export)
│           ├── Knowledge.jsx   # Article list + editor
│           ├── Reports.jsx     # Charts: SLA, volume, by category/tech
│           ├── Audit.jsx       # Audit trail with CSV/PDF export
│           ├── Users.jsx       # User management
│           ├── Settings.jsx    # Org config: categories, priorities, SLA, hours
│           ├── Workload.jsx    # Technician utilisation
│           ├── Vendors.jsx     # Vendor CRUD
│           ├── Profile.jsx     # Account settings
│           └── Notifications.jsx
│
└── server/                     # Express API (Node 18+)
    ├── package.json
    ├── .env.example
    └── src/
        ├── server.js           # Entry point: listen + cron start
        ├── app.js              # Express app setup
        ├── config.js           # Env validation & export
        ├── constants.js        # Status/role/type enums
        ├── validators.js       # Shared Zod schemas
        ├── seed.js             # Demo data (drops DB first)
        ├── models/             # 16 Mongoose schemas
        │   ├── index.js        # Re-exports all models
        │   ├── Ticket.js       ├── User.js     ├── Asset.js
        │   ├── Article.js      ├── Comment.js  ├── WorkLog.js
        │   ├── Organization.js ├── Department.js
        │   ├── Category.js     ├── Priority.js
        │   ├── SlaPolicy.js    ├── AuditLog.js
        │   ├── Notification.js ├── Vendor.js
        │   ├── SavedFilter.js  └── Counter.js
        ├── routes/
        │   ├── index.js        # Mounts all routers at /api/*
        │   ├── auth.js         # /auth/register, /auth/login, /auth/me
        │   ├── tickets.js      # Full ticket lifecycle (22 endpoints)
        │   ├── assets.js       # Asset CRUD + lifecycle transitions
        │   ├── articles.js     # Knowledge base CRUD + publish flow
        │   ├── users.js        # User list + CRUD (admin/manager)
        │   ├── organizations.js# Org config (admin only)
        │   └── misc.js         # reports, AI, audit, notifications, exports
        ├── services/
        │   ├── ai.js           # Groq triage + suggestions + fallback classifier
        │   ├── sla.js          # SLA sweep cron + escalation engine
        │   ├── analytics.js    # Dashboard aggregation queries
        │   ├── ticketService.js# Complex ticket operations (assign, resolve, etc.)
        │   └── notify.js       # Notification creation helper
        ├── middleware/
        │   ├── auth.js         # requireAuth, requireRole, orgScope
        │   ├── validate.js     # Zod validation wrapper
        │   ├── audit.js        # Auto-log every successful write
        │   ├── upload.js       # Multer config (allow-list, 10 MB cap)
        │   ├── sanitize.js     # Mongo operator injection blocker
        │   └── error.js        # Global error handler
        └── utils/
            ├── businessTime.js # SLA business-hours calculator
            ├── crud.js         # Generic CRUD factory (reduces boilerplate)
            └── exporter.js     # CSV + PDF generation (PDFKit)
```

---

## Demo Accounts

Password for all demo accounts: **`Password@123`**

> Use the quick-fill pills on the sign-in page — no typing required.

| Role | Email | Access level |
|---|---|---|
| **System Admin** | admin@acme.com | Full access including org config |
| **IT Manager** | manager@acme.com | All tickets in all departments, reports |
| **Technician** | tech1@acme.com | Assigned + unassigned tickets in dept |
| **Technician** | tech2@acme.com | Assigned + unassigned tickets in dept |
| **Technician** | tech3@acme.com | Assigned + unassigned tickets in dept |
| **Asset Manager** | assets@acme.com | Full asset register |
| **Employee** | employee1@acme.com | Own tickets + self-service KB |
| **Employee** | employee2–4@acme.com | Own tickets + self-service KB |

Self-registration uses org code **`ACME`** and always creates an Employee account.

---

## Deployment

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for step-by-step instructions covering:
- MongoDB Atlas (free tier)
- Render (API + static frontend)
- Vercel (frontend alternative)
- Environment variable checklist

---

## Known Limitations & Notes

| Topic | Note |
|---|---|
| **SLA timezone** | Fixed UTC offset in minutes — no DST rules. Update in Configuration when your offset changes. |
| **File storage** | Uploads stored on local disk at `server/uploads/`. Use S3/Cloudinary for multi-server or serverless deployments. |
| **Notifications** | Poll every 30 s. Swap in Socket.IO for true push. |
| **SLA hold** | Adds wall-clock hold duration to due dates (not business-hours-aware while paused). |
| **Auto-close** | Resolved tickets not confirmed by requester are closed automatically (configurable days in Settings). |
| **Production** | Set `JWT_SECRET` to 32+ random chars, `NODE_ENV=production`, serve `client/dist` from the same origin or configure `CLIENT_URL`. |
| **Groq rate limits** | Free Groq tier has RPM limits. The fallback classifier activates automatically on 429 errors. |
