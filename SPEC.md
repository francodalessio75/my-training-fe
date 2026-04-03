# SPEC.md — MyTraining

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture & Tech Stack](#2-architecture--tech-stack)
3. [Data Models](#3-data-models)
4. [API Endpoints](#4-api-endpoints)
5. [Features & User Stories](#5-features--user-stories)
6. [State Management](#6-state-management)
7. [Routing & Pages](#7-routing--pages)

---

## 1. Project Overview

### Description

**MyTraining** is a personal web application that allows a single user to plan, record, and review their training sessions. It provides a structured way to track workout progress over time by organizing sessions into workout units and executed sets tied to specific exercises.

### Goals

- Allow the user to log training sessions quickly and intuitively.
- Provide a structured hierarchy: Session → Workout Unit → Executed Set → Exercise.
- Categorize exercises by training type for filtering and analytics.
- Authenticate securely via JWT.
- Offer a clean, responsive UI using Angular Material.

### Future Goals

- Analytics and progress charts (e.g. volume over time, personal records).
- Exportable training reports (PDF / CSV).

### Target User

A single athlete or fitness enthusiast who wants to self-manage and track their personal training history.

---

## 2. Architecture & Tech Stack

### Frontend

| Concern | Technology |
|---|---|
| Framework | Angular 21 (standalone components, signals) |
| UI Library | Angular Material 21 |
| State Management | NgRx Signal Store |
| HTTP Client | Angular `HttpClient` |
| Auth | JWT (stored in `localStorage`, attached via `HttpInterceptor`) |
| IDE | VS Code + Angular CLI MCP Server + Angular Material Blocks MCP Server |

### Backend

| Concern | Technology |
|---|---|
| Language | Python 3.12+ |
| Framework | FastAPI |
| Database | MongoDB Atlas (via Motor / Beanie ODM) |
| Auth | JWT (OAuth2 Password Bearer) |
| API Style | RESTful JSON API |
| Containerization | Docker + Docker Compose |

### Frontend Project Structure

```
src/
├── app/
│   ├── core/
│   │   ├── auth/               # JWT interceptor, auth guard, auth service
│   │   ├── models/             # TypeScript interfaces (domain models)
│   │   └── services/           # API services (sessions, exercises, etc.)
│   ├── features/
│   │   ├── auth/               # Login page
│   │   ├── dashboard/          # Home / summary page
│   │   ├── sessions/           # Session list, detail, create/edit
│   │   ├── exercises/          # Exercise library management
│   │   ├── catalogs/           # Training types and muscle groups
│   │   └── profile/            # User profile
│   ├── shared/
│   │   ├── components/         # Reusable UI components
│   │   └── pipes/              # Shared pipes
│   └── store/                  # NgRx Signal Store feature stores
```

### MCP Servers Configuration (`.vscode/mcp.json`)

```json
{
  "servers": {
    "angular-cli": {
      "command": "npx",
      "args": ["-y", "@angular/cli", "mcp"]
    },
    "ngm-dev-blocks": {
      "command": "npx",
      "args": ["-y", "@ngm-dev/cli", "mcp", "full/path/to/angular/project"]
    }
  }
}
```

---

## 3. Data Models

### User

```typescript
interface User {
  id: string;
  email: string;
  displayName: string;
  description?: string;
}
```

### TrainingType

```typescript
interface TrainingType {
  id: string;
  name: string;           // e.g. "PUSH", "PULL", "LEGS", "MIXED"
  description: string;
}
```

### MuscleGroup

```typescript
interface MuscleGroup {
  id: string;
  name: string;           // e.g. "Chest", "Hamstrings", "Quadriceps"
  description?: string;
}
```

### Exercise

```typescript
interface Exercise {
  id: string;
  name: string;
  trainingTypeId: string;
  trainingType?: TrainingType;      // populated on read
  muscleGroupId: string;
  muscleGroup?: MuscleGroup;        // populated on read
  executionDescription: string;     // how to perform the exercise
  loadDescription: string;          // describes how to evaluate a single unit of load
                                    // e.g. "kg on barbell", "body weight"
  notes?: string;
}
```

### ExecutedSet

```typescript
interface ExecutedSet {
  id: string;
  exerciseId: string;
  exercise?: Exercise;              // populated on read
  load: number;                     // raw load value
  loadDescription: string;          // describes execution variations
                                    // e.g. "80kg barbell, paused at bottom"
  repetitions: number;
  notes?: string;

  // Computed via withComputed() in executedSetsStore, never stored
  readonly totalLoad: number;       // load × repetitions
}
```

### WorkoutUnit

```typescript
interface WorkoutUnit {
  id: string;
  trainingTypeId: string;           // may differ from individual exercises,
  trainingType?: TrainingType;      // e.g. MIXED for heterogeneous circuits
  executedSets: ExecutedSet[];
  totalLoadDescription: string;     // user-written text (required)
  notes?: string;

  // Computed via withComputed() in workoutUnitsStore, never stored
  readonly totalLoad: number;       // sum of all ExecutedSet.totalLoad
}
```

### Session

```typescript
interface Session {
  id: string;
  userId: string;
  name: string;
  date: string;                     // ISO date
  workoutUnits: WorkoutUnit[];
  totalLoadDescription: string;     // user-written text (required)
  notes?: string;
  createdAt: string;
  updatedAt: string;

  // Computed via withComputed() in sessionsStore, never stored
  readonly totalLoad: number;       // sum of all WorkoutUnit.totalLoad
}
```

### Computed Load Rules

| Level | Formula |
|---|---|
| `ExecutedSet.totalLoad` | `load × repetitions` |
| `WorkoutUnit.totalLoad` | `sum of ExecutedSet.totalLoad` |
| `Session.totalLoad` | `sum of WorkoutUnit.totalLoad` |

> Computed values are implemented using NgRx Signal Store's `withComputed()` hook and are never persisted to the database.

### Catalog Collections Summary

| Collection | Purpose | Editable |
|---|---|---|
| `training-types` | Training type labels (PUSH, PULL, LEGS, MIXED, …) | ✅ User-editable |
| `muscle-groups` | Muscle group catalog (Chest, Hamstrings, …) | ✅ User-editable |
| `exercises` | Exercise library, references both catalogs above | ✅ User-editable |

> All catalogs are pre-seeded from the database. The user can extend them at any time. New entries can be added by inserting a new document — no schema or code changes required.

---

## 4. API Endpoints

Base URL: `/api/v1`

> Computed fields (`totalLoad` at set, unit, and session level) are calculated on the **frontend**. The API never returns nor stores them.

### Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/login` | Login, returns JWT access token |
| POST | `/auth/refresh` | Refresh access token |
| GET | `/auth/me` | Get current authenticated user |

> User registration is handled directly on the backend. No public register endpoint is exposed to the frontend.

### Training Types

| Method | Endpoint | Description |
|---|---|---|
| GET | `/training-types` | List all training types |
| POST | `/training-types` | Create a training type |
| PUT | `/training-types/{id}` | Update a training type |
| DELETE | `/training-types/{id}` | Delete a training type |

### Muscle Groups

| Method | Endpoint | Description |
|---|---|---|
| GET | `/muscle-groups` | List all muscle groups |
| POST | `/muscle-groups` | Create a muscle group |
| PUT | `/muscle-groups/{id}` | Update a muscle group |
| DELETE | `/muscle-groups/{id}` | Delete a muscle group |

### Exercises

| Method | Endpoint | Description |
|---|---|---|
| GET | `/exercises` | List all exercises (supports `?trainingTypeId=`, `?muscleGroupId=`) |
| GET | `/exercises/{id}` | Get exercise detail |
| POST | `/exercises` | Create an exercise |
| PUT | `/exercises/{id}` | Update an exercise |
| DELETE | `/exercises/{id}` | Delete an exercise |

### Sessions

| Method | Endpoint | Description |
|---|---|---|
| GET | `/sessions` | List all sessions (supports `?date=`, `?from=`, `?to=`, `?limit=`, `?skip=`) |
| GET | `/sessions/{id}` | Get full session detail (with workout units and executed sets) |
| POST | `/sessions` | Create a new session |
| PUT | `/sessions/{id}` | Update a session |
| DELETE | `/sessions/{id}` | Delete a session |

### Workout Units

| Method | Endpoint | Description |
|---|---|---|
| POST | `/sessions/{sessionId}/units` | Add a workout unit to a session |
| PUT | `/sessions/{sessionId}/units/{unitId}` | Update a workout unit |
| DELETE | `/sessions/{sessionId}/units/{unitId}` | Remove a workout unit |
| PATCH | `/sessions/{sessionId}/units/reorder` | Reorder workout units |

### Executed Sets

| Method | Endpoint | Description |
|---|---|---|
| POST | `/sessions/{sessionId}/units/{unitId}/sets` | Add an executed set |
| PUT | `/sessions/{sessionId}/units/{unitId}/sets/{setId}` | Update an executed set |
| DELETE | `/sessions/{sessionId}/units/{unitId}/sets/{setId}` | Remove an executed set |
| PATCH | `/sessions/{sessionId}/units/{unitId}/sets/reorder` | Reorder executed sets |

---

## 5. Features & User Stories

### 🔐 Authentication

- **US-01** — As a user, I can log in with email and password.
- **US-02** — As a logged-in user, I am automatically redirected to the dashboard; unauthenticated routes are guarded.
- **US-03** — As a user, my session persists across page reloads via stored JWT in localStorage.

> User registration is handled directly on the backend. No public register page in the frontend.

### 🏠 Dashboard

- **US-04** — As a user, I can see a list of my recent training sessions on the dashboard.
- **US-05** — As a user, I can see my total session count for the current week and current month.

### 📋 Session Management

- **US-06** — As a user, I can create a new training session with a name, date, notes and total load description.
- **US-07** — As a user, I can view a paginated list of all my past sessions sorted by date, where each row shows the session name, date, and the list of workout units with their training type.
- **US-08** — As a user, I can filter my sessions by specific date or date range.
- **US-09** — As a user, I can open a session and progressively drill into its details: workout units → executed sets.
- **US-10** — As a user, I can edit any field of a session.
- **US-11** — As a user, I can delete a session after confirming a confirmation dialog.

### 🏋️ Workout Units

- **US-12** — As a user, I can add one or more workout units to a session, specifying training type, total load description and optional notes.
- **US-13** — As a user, I can edit any field of a workout unit directly inline within the session detail page.
- **US-14** — As a user, I can reorder workout units within a session via drag and drop.
- **US-15** — As a user, I can remove a workout unit from a session after confirming a dialog.

### 💪 Executed Sets

- **US-16** — As a user, I can add one or more executed sets to a workout unit, specifying load, load description, repetitions and optional notes.
- **US-17** — As a user, I select the exercise for an executed set via a dedicated dialog, filterable by training type.
- **US-18** — As a user, I can add multiple sets in rapid sequence without closing the form (quick add).
- **US-19** — As a user, I can edit any field of an executed set directly inline within the session detail page.
- **US-20** — As a user, I can reorder executed sets within a workout unit via drag and drop.
- **US-21** — As a user, I can remove an executed set after confirming a dialog.

### 📚 Exercise Library

- **US-22** — As a user, I can browse all available exercises, filterable by training type and muscle group.
- **US-23** — As a user, I can view the full detail of an exercise (name, training type, muscle group, execution description, load description, notes).
- **US-24** — As a user, I can create a new exercise.
- **US-25** — As a user, I can edit an existing exercise.
- **US-26** — As a user, I can delete an exercise after confirming a dialog. If the exercise is referenced by one or more executed sets, deletion is **blocked** and a warning is shown.

> The exercise library is pre-seeded from the database. The user can extend it with custom exercises at any time.

### 🏷️ Training Types

- **US-27** — As a user, I can view the list of all training types.
- **US-28** — As a user, I can create a new training type with a name and description.
- **US-29** — As a user, I can edit an existing training type.
- **US-30** — As a user, I can delete a training type after confirming a dialog. If the training type is referenced by any exercise or workout unit, deletion is **blocked** and a warning is shown.

### 🦵 Muscle Groups

- **US-31** — As a user, I can view the list of all muscle groups.
- **US-32** — As a user, I can create a new muscle group with a name and optional description.
- **US-33** — As a user, I can edit an existing muscle group.
- **US-34** — As a user, I can delete a muscle group after confirming a dialog. If the muscle group is referenced by any exercise, deletion is **blocked** and a warning is shown.

> ⚠️ A confirmation dialog is required for **all delete actions** throughout the app.

### User Stories Summary

| Group | Stories |
|---|---|
| 🔐 Authentication | US-01 → US-03 |
| 🏠 Dashboard | US-04 → US-05 |
| 📋 Session Management | US-06 → US-11 |
| 🏋️ Workout Units | US-12 → US-15 |
| 💪 Executed Sets | US-16 → US-21 |
| 📚 Exercise Library | US-22 → US-26 |
| 🏷️ Training Types | US-27 → US-30 |
| 🦵 Muscle Groups | US-31 → US-34 |

---

## 6. State Management

All state is managed with **NgRx Signal Store**. Each feature has its own dedicated store. HTTP calls are handled in the store's methods, delegating to Angular services for API communication.

> **Refresh policy:** all stores automatically reload their data after every create, update, or delete operation, ensuring the UI is always in sync with the backend.

### Auth Store (`authStore`)

| State | Type | Description |
|---|---|---|
| `currentUser` | `User \| null` | Authenticated user |
| `token` | `string \| null` | JWT access token (mirrored from localStorage) |
| `isLoading` | `boolean` | Auth operation in progress |
| `error` | `string \| null` | Auth error message |

**Methods:** `login()`, `logout()`, `loadCurrentUser()`

### Sessions Store (`sessionsStore`)

| State | Type | Description |
|---|---|---|
| `sessions` | `Session[]` | Paginated list of sessions |
| `selectedSession` | `Session \| null` | Currently open session with full detail |
| `totalCount` | `number` | Total number of sessions (for pagination) |
| `isLoading` | `boolean` | Fetch in progress |
| `error` | `string \| null` | Error message |

**Methods:** `loadSessions()`, `loadSession(id)`, `createSession()`, `updateSession()`, `deleteSession()`

**Computed (`withComputed()`):**
```typescript
withComputed(({ selectedSession }) => ({
  totalLoad: computed(() =>
    selectedSession()?.workoutUnits.reduce((acc, u) => acc + u.totalLoad(), 0) ?? 0
  )
}))
```

### Workout Units Store (`workoutUnitsStore`)

| State | Type | Description |
|---|---|---|
| `workoutUnits` | `WorkoutUnit[]` | Workout units of the current session |
| `selectedUnit` | `WorkoutUnit \| null` | Currently selected workout unit |
| `isLoading` | `boolean` | Operation in progress |
| `error` | `string \| null` | Error message |

**Methods:** `loadUnits(sessionId)`, `addUnit()`, `updateUnit()`, `deleteUnit()`, `reorderUnits()`

**Computed (`withComputed()`):**
```typescript
withComputed(({ workoutUnits }) => ({
  totalLoad: computed(() =>
    workoutUnits().reduce((acc, u) => acc + u.totalLoad(), 0)
  )
}))
```

**Lifecycle (`withHooks()`):** store is reset `onDestroy` when navigating away from a session.

### Executed Sets Store (`executedSetsStore`)

| State | Type | Description |
|---|---|---|
| `executedSets` | `ExecutedSet[]` | Executed sets of the current workout unit |
| `isLoading` | `boolean` | Operation in progress |
| `error` | `string \| null` | Error message |

**Methods:** `loadSets(sessionId, unitId)`, `addSet()`, `updateSet()`, `deleteSet()`, `reorderSets()`

**Computed (`withComputed()`):**
```typescript
withComputed(({ executedSets }) => ({
  totalLoad: computed(() =>
    executedSets().reduce((acc, s) => acc + s.load * s.repetitions, 0)
  )
}))
```

**Lifecycle (`withHooks()`):** store is reset `onDestroy` when navigating away.

### Exercises Store (`exercisesStore`)

| State | Type | Description |
|---|---|---|
| `exercises` | `Exercise[]` | Full exercise library |
| `isLoading` | `boolean` | Fetch in progress |
| `error` | `string \| null` | Error message |

**Methods:** `loadExercises()`, `createExercise()`, `updateExercise()`, `deleteExercise()`

> Used by the exercise selection dialog. Loaded once at app startup and refreshed after every create, update or delete.

### Training Types Store (`trainingTypesStore`)

| State | Type | Description |
|---|---|---|
| `trainingTypes` | `TrainingType[]` | All training types |
| `isLoading` | `boolean` | Fetch in progress |
| `error` | `string \| null` | Error message |

**Methods:** `loadTrainingTypes()`, `createTrainingType()`, `updateTrainingType()`, `deleteTrainingType()`

> Loaded once at app startup and refreshed after every create, update or delete.

### Muscle Groups Store (`muscleGroupsStore`)

| State | Type | Description |
|---|---|---|
| `muscleGroups` | `MuscleGroup[]` | All muscle groups |
| `isLoading` | `boolean` | Fetch in progress |
| `error` | `string \| null` | Error message |

**Methods:** `loadMuscleGroups()`, `createMuscleGroup()`, `updateMuscleGroup()`, `deleteMuscleGroup()`

> Loaded once at app startup and refreshed after every create, update or delete.

### App Startup Loading

`trainingTypesStore`, `muscleGroupsStore` and `exercisesStore` are loaded once in **`AppComponent`** on initialization:

```typescript
// app.component.ts
export class AppComponent {
  private trainingTypesStore = inject(TrainingTypesStore);
  private muscleGroupsStore = inject(MuscleGroupsStore);
  private exercisesStore = inject(ExercisesStore);

  constructor() {
    this.trainingTypesStore.loadTrainingTypes();
    this.muscleGroupsStore.loadMuscleGroups();
    this.exercisesStore.loadExercises();
  }
}
```

### Stores Summary

| Store | Scope | Startup | Reset onDestroy |
|---|---|---|---|
| `authStore` | Auth & current user | — | — |
| `sessionsStore` | Session list & selected session | — | — |
| `workoutUnitsStore` | Units of current session | — | ✅ |
| `executedSetsStore` | Sets of current unit | — | ✅ |
| `exercisesStore` | Exercise library | ✅ AppComponent | — |
| `trainingTypesStore` | Training types catalog | ✅ AppComponent | — |
| `muscleGroupsStore` | Muscle groups catalog | ✅ AppComponent | — |

---

## 7. Routing & Pages

All routes except `/auth/login` are protected by an `AuthGuard` that checks the JWT token in `authStore`.

```
/                                     → redirect to /dashboard
/auth/login                           → LoginPage

/dashboard                            → DashboardPage                [AuthGuard]

/sessions                             → SessionListPage              [AuthGuard]
/sessions/new                         → SessionFormPage (create)     [AuthGuard]
/sessions/:id                         → SessionDetailPage            [AuthGuard]
/sessions/:id/edit                    → SessionFormPage (edit)       [AuthGuard]

/exercises                            → ExerciseListPage             [AuthGuard]
/exercises/new                        → ExerciseFormPage (create)    [AuthGuard]
/exercises/:id                        → ExerciseDetailPage           [AuthGuard]
/exercises/:id/edit                   → ExerciseFormPage (edit)      [AuthGuard]

/catalogs/training-types              → TrainingTypeListPage         [AuthGuard]
/catalogs/training-types/new          → TrainingTypeFormPage (create)[AuthGuard]
/catalogs/training-types/:id/edit     → TrainingTypeFormPage (edit)  [AuthGuard]

/catalogs/muscle-groups               → MuscleGroupListPage          [AuthGuard]
/catalogs/muscle-groups/new           → MuscleGroupFormPage (create) [AuthGuard]
/catalogs/muscle-groups/:id/edit      → MuscleGroupFormPage (edit)   [AuthGuard]

/profile                              → ProfilePage                  [AuthGuard]
```

### Notes

- Workout units and executed sets are **not routed** — they are managed inline within `SessionDetailPage`.
- The exercise picker dialog is a **non-routed dialog** opened from within `SessionDetailPage`.
- `/catalogs` groups training types and muscle groups under a common parent route for navigation clarity.
- All form pages (create/edit) share the same component, driven by the presence of `:id` in the route.

### Navigation Layout

- **Small screens** — hamburger icon opening a **sidenav drawer** (`mat-sidenav`).
- **Large screens** — **top navigation bar** with inline nav links (`mat-toolbar`).
- Responsive switching handled via Angular Material **`BreakpointObserver`**.

### Profile Page

Contains: user display name, email, and description. Read-only at this stage.

---

*Last updated: April 2026*
