# Slotify — Resource Reservation Management System

A full-stack, enterprise-grade resource reservation management system developed for the **PrimeWave Lab Software Engineering Internship Technical Assessment**.

The system enables organizations to manage physical and digital assets (conference rooms, laboratory workstations, shared hardware), schedule conflict-free bookings, track live availability, and prevent reservation clashes under concurrent usage.

---

## 1. System Overview & Architecture

### Core Engineering Principles
- **Clean Architecture & Separation of Concerns:** Clear boundary separation between Presentation, Feature Modules, Domain Logic, and Data Access layers.
- **Feature-Driven Modular Design:** Encapsulated features (`resources`, `reservations`) housing their own business actions, components, hooks, and schemas.
- **Transactional Integrity:** Defensive database-level constraint handling and application-layer conflict detection for robust scheduling guarantees.
- **Strict Typing & Server-side Validation:** End-to-end type safety leveraging TypeScript strict mode and Zod runtime schema validation.

### Directory Structure
```
Slotify/
├── prisma/
│   └── schema.prisma         # Database schema & Prisma client definitions (PostgreSQL)
├── public/                   # Static assets & icons
├── src/
│   ├── app/                  # Next.js App Router (Layouts, route handlers, error boundaries)
│   │   ├── globals.css       # Tailwind CSS design system tokens
│   │   ├── layout.tsx        # Root HTML layout with font configuration
│   │   └── page.tsx          # Application entry landing / welcome page
│   ├── components/           # Shared, domain-agnostic UI primitives (shadcn/ui patterns)
│   │   └── ui/               # Modular UI components (buttons, dialogs, badges, inputs)
│   ├── features/             # Business domain feature modules
│   │   ├── resources/        # Resource catalog, category filters, and asset cards
│   │   └── reservations/     # Booking flows, time-slot pickers, and timeline views
│   ├── lib/                  # Shared utilities and singleton clients
│   │   └── utils.ts          # Class merging utility (clsx + tailwind-merge)
│   └── types/                # Ambient and domain TypeScript interfaces
│       └── next.d.ts         # Framework module declarations
├── .env.example              # Template for environment variables
├── .gitignore                # Version control ignore rules
├── .prettierrc               # Prettier code formatting rules
├── eslint.config.mjs         # ESLint configuration
├── next.config.ts            # Next.js configuration
├── package.json              # Project scripts and dependency declarations
├── tsconfig.json             # TypeScript compiler options (strict mode enabled)
└── README.md                 # Project documentation
```

---

## 2. Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Framework** | Next.js 16 (App Router) | High-performance React Server Components, server actions, and streaming. |
| **Language** | TypeScript (Strict Mode) | Full type-safety across routes, business logic, and database schemas. |
| **Styling** | Tailwind CSS | Modern utility-first CSS using CSS variables for theme flexibility. |
| **Icons & UI** | Lucide React | Consistent, accessible iconography. |
| **Validation** | Zod | Runtime schema validation across server actions and client forms. |
| **ORM & DB** | Prisma ORM + PostgreSQL | Type-safe queries, migration control, and transactional booking locks. |

---

## 3. Local Setup & Getting Started

### Prerequisites
- **Node.js**: `v20.9.0` or later
- **pnpm**: `v10` or later
- **PostgreSQL**: `v14+`

### Installation
1. Clone the repository and navigate into the workspace:
   ```bash
   git clone <repository-url>
   cd Slotify
   ```

2. Copy the environment configuration:
   ```bash
   cp .env.example .env
   ```
   *(Set `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, and local demo passwords before migrating and seeding.)*

3. Install project dependencies:
   ```bash
   pnpm install
   ```

---

## 4. Development Scripts

- **`npm run dev`**: Start the Next.js development server on `http://localhost:3000`.
- **`npm run build`**: Create an optimized production build.
- **`npm run start`**: Serve the production build locally.
- **`npm run lint`**: Execute ESLint rules check across the codebase.
- **`npm run typecheck`**: Run static TypeScript analysis with `--noEmit`.
- **`npm run format`**: Run Prettier code formatting.
- **`npm run db:migrate`**: Apply Prisma migrations to the PostgreSQL database.
- **`npm run db:seed`**: Execute repeatable database seeder (`prisma/seed.ts`).

---

## 5. Development Roadmap & Implementation Status

- [x] **Stage 1 — Project Foundation** *(Completed)*
  - Next.js App Router initialization with TypeScript strict mode
  - Tailwind CSS setup with accessible SaaS design tokens
  - Foundational packages (`zod`, `lucide-react`, `prisma`, `clsx`, `tailwind-merge`)
  - Clean feature-oriented modular architecture
  - Tooling, `.env.example`, `.prettierrc`, and `.gitignore` setup
  - Verification across type checking, linting, build, and local server startup
- [x] **Stage 2 — Database Architecture & Domain Models** *(Completed)*
  - PostgreSQL domain models with UUID primary keys (`User`, `ResourceCategory`, `Resource`, `Reservation`)
  - Check constraints (`startTime < endTime`) and GiST exclusion constraints (`no_overlap_blocking_excl`)
  - Initial migration (`20261013171759_init`) and reusable Prisma singleton client (`src/lib/prisma.ts`)
  - Idempotent database seeder (`prisma/seed.ts`) with demo users, categories, resources, and sample bookings
  - Database architecture & ER diagram documentation (`docs/database-architecture.md`)
- [x] **Stage 3 — Resource Management Feature & Application Shell** *(Completed)*
  - Professional SaaS application shell: collapsible responsive AppSidebar, sticky AppHeader, and authenticated user context
  - Reusable UI component library: Button, Card, Badge, Input, Modal, and EmptyState
  - Resource Catalog (`/resources`): responsive grid cards, category badges, location, and capacity indicators
  - Real-time toolbar: full-text search, category filter, status filter (Active/Inactive), and reset controls
  - Resource CRUD forms: Add/Edit modal dialogs with server-side Zod validation and error normalization
  - Soft deactivation & reactivation preserving reservation audit history
  - Dedicated Resource Details view (`/resources/[id]`) with live database specifications and statistics
- [x] **Stage 3.1 — CSS Stabilization, Design System Repair & UI Refinement** *(Completed)*
  - Diagnosed PostCSS pipeline mismatch with Webpack build under Tailwind CSS v4
  - Installed `@tailwindcss/postcss` and created `postcss.config.mjs`
  - Fully restored automated scanning and utility class generation (`.bg-blue-600`, `.flex`, `.rounded-xl`, etc.)
  - Aligned semantic palette to spec: `#F6F7FB` canvas, `#FFFFFF` surfaces, `#2563EB` primary, `#111827` text
  - Completed headless Chrome visual verification across desktop (1280x800) and mobile (375x812) viewports
- [x] **Stage 4 — Authentication, RBAC & Reservation Domain Preparation** *(Completed)*
  - Auth.js credential login, server-side role checks, approval-ready status migration, and pending/approved overlap protection
- [ ] **Stage 5 — Booking Requests & Approval Workflow**
  - Member requests, admin approval/rejection, cancellation, and conflict-friendly errors

---

## Stage 4 authentication and local assessment

Auth.js Credentials handles login, logout, CSRF protection, and an encrypted HTTP-only session cookie (8-hour maximum age). Argon2id hashes are stored in `users.passwordHash`. Each protected server render or mutation reloads the current user from PostgreSQL, so role changes and deactivation take effect immediately. Set a strong `AUTH_SECRET` in the ignored `.env` file; use `openssl rand -base64 32` to generate it. Set `AUTH_URL` to the exact application origin (including port). HTTPS deployments use secure cookies.

Public registration is disabled. To create or refresh local demo credentials, set `SLOTIFY_DEMO_ADMIN_PASSWORD` and `SLOTIFY_DEMO_MEMBER_PASSWORD` to different 12+ character secrets in ignored `.env`, then run `npm run db:seed`. The seed is additive: it never deletes existing reservations or resources. Demo emails are `alex.admin@primewave.local` (ADMIN) and `sarah.chen@primewave.local` (MEMBER); David and Emily use the member password as well. Keep the passwords local and do not commit `.env`.

| Operation | ADMIN | MEMBER |
|---|---:|---:|
| Browse resources and calendar | Yes | Yes |
| View reservations | All | Own |
| Create/edit/deactivate resources | Yes | No |
| View users and change roles | Yes | No |
| Approve/reject requests | Stage 5 | No |
| Submit/cancel own requests | No | Stage 5 |

Reservation statuses are `PENDING`, `APPROVED`, `REJECTED`, and `CANCELLED`. Six preexisting `CONFIRMED` records were migrated to `APPROVED` on the local database. PostgreSQL enforces `[startTime, endTime)` overlap exclusion for `PENDING` and `APPROVED`, valid time order, status transitions, and last-active-admin protection. Resource and user deletion is restricted when reservation history exists; inactive resources reject new pending or approved reservations. Application instants are stored in UTC (`timestamptz`); business presentation uses `Asia/Colombo` (Sri Lanka).

Stage 5 should add booking and approval actions with server-side identity checks and translate PostgreSQL exclusion error `23P01` into a useful slot-conflict message.
