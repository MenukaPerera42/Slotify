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
- **npm**: `v10.0.0` or later
- **PostgreSQL**: `v14+` (required for later stages)

### Installation
1. Clone the repository and navigate into the workspace:
   ```bash
   git clone <repository-url>
   cd Slotify
   ```

2. Copy the environment configuration:
   ```bash
   cp .env.example .env.local
   ```
   *(Update `DATABASE_URL` with your local PostgreSQL connection string when ready for database stages).*

3. Install project dependencies:
   ```bash
   npm install
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
  - Check constraints (`startTime < endTime`) and GiST exclusion constraints (`no_overlap_confirmed_excl`)
  - Initial migration (`20261013171759_init`) and reusable Prisma singleton client (`src/lib/prisma.ts`)
  - Idempotent database seeder (`prisma/seed.ts`) with demo users, categories, resources, and sample bookings
  - Database architecture & ER diagram documentation (`docs/database-architecture.md`)
- [x] **Stage 3 — Resource Management Feature & Application Shell** *(Completed)*
  - Professional SaaS application shell: collapsible responsive AppSidebar, sticky AppHeader, and demo-user context
  - Reusable UI component library: Button, Card, Badge, Input, Modal, and EmptyState
  - Resource Catalog (`/resources`): responsive grid cards, category badges, location, and capacity indicators
  - Real-time toolbar: full-text search, category filter, status filter (Active/Inactive), and reset controls
  - Resource CRUD forms: Add/Edit modal dialogs with server-side Zod validation and error normalization
  - Soft deactivation & reactivation preserving reservation audit history
  - Dedicated Resource Details view (`/resources/[id]`) with live database specifications and statistics
  - Operations Dashboard overview (`/dashboard`) summarizing resources, categories, and bookings
- [ ] **Stage 4 — Reservation Engine & Conflict Prevention**
  - Time-slot selection, concurrency locking, and overlapping booking prevention
- [ ] **Stage 5 — Dashboard & User Interface Polish**
  - Interactive schedule views, status workflows, and responsive layouts
# Slotify
