# Temporal Integration Design
**Date:** 2026-04-28
**Author:** Nexus Alpha Team
**Status:** Draft

---

## 1. Context & Vision

Nexus Alpha currently relies on simple `setInterval` loops in `App.tsx` to manage agentic autonomous behavior. This approach is fragile: if the process crashes, state is lost and retries are manual. We are replacing this lightweight loop with **Temporal**, a durable workflow engine that provides automatic retries, state persistence, and visibility into long-running tasks.

This integration will serve as the **backbone** for all orchestration in Nexus Alpha. Subsequent integrations (LangGraph, LangChain) will execute inside Temporal workflows as their stateful core.

---

## 2. Architecture

### 2.1 Components

*   **Temporal Server:** Infrastructure to host workflows and state. Options: [Temporal Cloud](https://temporal.io/cloud) (managed) or self-hosted via Docker.
*   **Nexus Worker:** A dedicated Node.js service that runs alongside the React app. It connects to the Temporal server and executes registered Activities.
*   **Workflow Client:** A thin SDK layer in the Nexus Alpha codebase that triggers workflows and listens for signals.

### 2.2 Data Flow

```
User Action / Autonomous Trigger
        │
        ▼
Temporal Client (Nexus Alpha)
        │
        ▼
Temporal Server (Workflow Queue)
        │
        ├──► Activity: fetchDashboardData (geminiService)
        ├──► Activity: analyzeRepoSynergy (geminiService)
        ├──► Activity: logEvent (supabaseClient)
        └──► Activity: updateAgentState (supabaseClient)
```

### 2.3 Mapped Workflows

| Workflow Name | Trigger | Description |
|---|---|---|
| `fetchMarketDataWorkflow` | Manual / Scheduled | Orchestrates `fetchDashboardData` calls in parallel |
| `agentSyncWorkflow` | Periodic | Syncs agent state with central Nexus via `supabaseData` |
| `pipelineBuildWorkflow` | User Action | Manages the multi-repo synthesis pipeline lifecycle |
| `selfHealingWorkflow` | On Activity Failure | Logs failures and triggers recovery actions |

### 2.4 Activities (The "How")

Activities are isolated, idempotent functions that call our existing service layer.

| Activity Name | Wraps | Purpose |
|---|---|---|
| `fetchMarketDataActivity` | `fetchMarketData()` | Market intelligence retrieval |
| `fetchRepoDataActivity` | `fetchRepoData()` | GitHub repo data retrieval |
| `saveSecretActivity` | `supabaseData.saveSecret()` | Persist API keys |
| `getSecretActivity` | `supabaseData.getSecret()` | Retrieve API keys |
| `logEventActivity` | `supabaseData.logEvent()` | Activity logging |
| `updateAgentStateActivity` | Direct Supabase upsert | Agent state tracking |

### 2.5 Error Handling (Self-Healing)

Temporal provides **native retries** with exponential backoff. We will configure the following policies:

*   `api_timeout`: Retry 3x with 2s backoff.
*   `auth_failure`: Retry 2x, then raise to `selfHealingWorkflow`.
*   `rate_limit`: Retry 5x with 30s backoff.

The custom `handle_integration_failure` function in Supabase will be replaced by Temporal's workflow-level error handling.

---

## 3. Migration Strategy

We will **not** delete the existing `App.tsx` loop immediately. Instead, we will:

1.  Introduce the Temporal Worker as a **new entry point** (`src/workers/temporal.worker.ts`).
2.  Register Activities that wrap our existing services.
3.  Create Workflows that mirror the current autonomous loop logic.
4.  Gradually **replace** the `setInterval` calls in `App.tsx` with calls to start Temporal Workflows.
5.  Remove the old loop once the workflows are validated.

---

## 4. Directory Structure

```
src/
  ├── workers/
  │   ├── temporal.worker.ts      # Worker entry point
  │   └── activities/
  │       ├── index.ts           # Re-exports all activities
  │       ├── market.activities.ts
  │       ├── database.activities.ts
  │       └── agent.activities.ts
  ├── workflows/
  │   ├── index.ts               # Re-exports all workflows
  │   ├── market.workflow.ts
  │   ├── agent-sync.workflow.ts
  │   └── pipeline.workflow.ts
  ├── services/
  │   ├── temporalClient.ts      # New: Temporal client SDK wrapper
  │   └── supabaseClient.ts     # Existing (unchanged)
  └── App.tsx                    # Updated: uses temporalClient instead of setInterval
```

---

## 5. Dependencies

Add the following packages:

```bash
npm install @temporalio/client @temporalio/worker @temporalio/workflow
npm install @temporalio/activity   # if using dependency injection
```

---

## 6. Implementation Order

1.  **Install dependencies and verify Temporal server connectivity.**
2.  **Implement Activities** (one per external call).
3.  **Implement Workflows** (map the current `setInterval` actions).
4.  **Create `temporalClient.ts`** as the bridge to the React app.
5.  **Migrate autonomous loop** in `App.tsx` to use `temporalClient.startWorkflow()`.
6.  **Add observability** (UI polling for workflow status via `temporalClient.getWorkflowHandle()`).
7.  **Validate** by running the app and confirming pipelines execute via Temporal.

---

## 7. Verification

*   Run `npm run dev` and observe that the autonomous loop executes workflows instead of `setInterval`.
*   Confirm in the Temporal Web UI (if running locally) that workflows are created, activities are executed, and retries are applied on simulated failures.
*   Confirm existing Supabase logging still works.
*   No existing functionality should be broken.