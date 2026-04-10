# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
We are building the app described in @../SPEC.md. Read that file for general architectural tasks or to double-check the exact database structure,
tech stack or application architecture.
Keep your replies extremely concise and focus on conveying the key information. No unnecessary fluff, no long code snippet.

## Commands

```bash
npm start          # Dev server at http://localhost:4200
npm run build      # Production build → dist/
npm test           # Run tests with Vitest
ng generate component features/foo/bar   # Scaffold a component
```

> The test runner is **Vitest** (not Karma). To run a single test file: `npx vitest run src/app/path/to/file.spec.ts`

## Project Overview

**MyTraining** is a single-user Angular 21 app for tracking personal training sessions. Full requirements are in [SPEC.md](../SPEC.md).

**Tech stack:**

- Angular 21 (standalone components, signals) + Angular Material 21
- NgRx Signal Store for state management
- JWT auth — token stored in `localStorage`, attached via `HttpInterceptor`
- Backend: FastAPI + MongoDB Atlas at base URL `/api/v1`

## Planned Folder Structure

```
src/app/
├── core/
│   ├── auth/         # JWT interceptor, auth guard, auth service
│   ├── models/       # TypeScript interfaces (domain models)
│   └── services/     # API services (one per resource)
├── features/
│   ├── auth/         # Login page
│   ├── dashboard/    # Home / recent sessions summary
│   ├── sessions/     # Session list, detail, create/edit
│   ├── exercises/    # Exercise library
│   ├── catalogs/     # Training types and muscle groups
│   └── profile/      # User profile (read-only)
├── shared/
│   ├── components/   # Reusable UI components
│   └── pipes/
└── store/            # NgRx Signal Store feature stores
```

All feature routes are lazy-loaded. The project is currently in early scaffolding — these directories do not exist yet.

## Domain Model Hierarchy

```
Session → WorkoutUnit → ExecutedSet → Exercise
```

`totalLoad` is computed at every level (`load × reps` → sum up) via NgRx `withComputed()` and is **never stored in the database**.

## State Management (NgRx Signal Store)

Seven feature stores under `src/app/store/`:

| Store                | Scope                           | Loaded at startup | Reset on destroy |
| -------------------- | ------------------------------- | ----------------- | ---------------- |
| `authStore`          | Current user + JWT              | —                 | —                |
| `sessionsStore`      | Session list + selected session | —                 | —                |
| `workoutUnitsStore`  | Units of current session        | —                 | ✅               |
| `executedSetsStore`  | Sets of current unit            | —                 | ✅               |
| `exercisesStore`     | Full exercise library           | ✅ AppComponent   | —                |
| `trainingTypesStore` | Training types catalog          | ✅ AppComponent   | —                |
| `muscleGroupsStore`  | Muscle groups catalog           | ✅ AppComponent   | —                |

After every mutating operation (create/update/delete), stores reload their data from the API. `workoutUnitsStore` and `executedSetsStore` reset `onDestroy` via `withHooks()`.

## Routing

All routes except `/auth/login` are protected by `AuthGuard` (checks JWT in `authStore`). Workout units and executed sets are managed **inline** within `SessionDetailPage` — no dedicated routes. The exercise picker is a non-routed Material dialog.

Navigation layout is responsive via `BreakpointObserver`: hamburger sidenav drawer on small screens, `mat-toolbar` with inline links on large screens.

## Auth Flow

- JWT stored in `localStorage` on login
- `HttpInterceptor` in `core/auth/` attaches the `Authorization: Bearer <token>` header to all `/api/v1` requests
- `AuthGuard` reads token from `authStore` to protect routes
- No public registration page — user accounts are created directly on the backend
