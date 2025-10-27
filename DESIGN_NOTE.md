# Design Note: Audit Logs Feature

Overview
--------
This design note documents the implementation of the Automated Audit Logging feature added to the Strapi monorepo. The goal is to capture create/update/delete (and related) events performed through Strapi's Content API and admin requests, persist audit records with metadata and diffs, and provide a server-side REST endpoint for querying and filtering audit logs.

High-level goals
-----------------
- Capture all relevant events (entry.create, entry.update, entry.delete, media.*, user.*, publish/unpublish, etc.) emitted via Strapi's eventHub / document-service.
- Persist audit records to a new table/collection `strapi_audit_logs` with searchable fields and indexes.
- Provide an admin REST endpoint to query audit logs with filters (contentType, userId, action, date range) and pagination/sorting.
- Add RBAC control (permission `admin::audit-logs.read`) for access control.
- Add configuration toggles and the ability to exclude specific content types from being audited.
- Ensure diffs for updates are captured efficiently (guarded deep-diff) and safe from catastrophic recursion/compute.

Architecture & Integration Points
---------------------------------
1. Event Capture (Lifecycle service)
   - File: packages/core/admin/ee/server/src/audit-logs/services/lifecycles.ts
   - The service is created via `createAuditLogsLifecycleService(strapi)` and registers an event handler with `strapi.eventHub.subscribe(handleEvent)` in `register()`.
   - It inspects `strapi.requestContext.get()` to determine the request route type (admin or content-api) and user.
   - The service uses an `eventMap` (defaults to a set of event names) to decide which events to log and how to build the payload.
   - Enriches records with `contentType` (UID) and `recordId` (id/documentId) where applicable.

2. Diffing Strategy
   - Implemented `shallowDiff(old, new)` for scalar/flat attribute differences.
   - Implemented `deepDiff(old, new, { maxDepth=5, maxNodes=1000 })` that traverses nested objects up to limits and returns a tree containing changed nodes or `{ __truncated: true }` when limits are exceeded.
   - For update events: If explicit changed fields (`params.data` or `data`) are present, they are preferred. If not present and both `previous` and `result/current` objects are available, `deepDiff` is used and it falls back to `shallowDiff` if deepDiff returns null.

3. Persistence Service
   - File: packages/core/admin/ee/server/src/audit-logs/services/audit-logs.ts
   - Exposes `saveEvent(event)` that persists to `strapi.db.query('admin::audit-log').create({ data: event })`.
   - Exposes `findMany` and `deleteExpiredEvents` for querying and cleanup.

4. REST API and Validation
   - Added controller and validation to expose an admin endpoint `/admin/audit-logs` with query filters for contentType, userId, action, dateFrom/dateTo, pagination, and sorting.
   - Validation file added under audit-logs validation folder.

5. RBAC and EE bootstrap
   - Added `admin-actions.ts` entry and `bootstrap.ts` logic in the EE plugin to register the `admin::audit-logs.read` action when EE features are enabled.

6. Persisted Tables & Indexes
   - Content-type schema for audit-log includes attributes `contentType` and `recordId` and declaration of indexes for `content_type`, `record_id`, and `date`.
   - A migration `packages/core/core/src/migrations/database/2025-10-27-add-audit-logs-indexes.ts` was added to create indexes for existing databases (Postgres/MySQL via Knex); the migration includes down() to drop those indexes.

7. Admin UI (minimal)
   - Added a minimal preview settings page to the admin UI at `/settings/audit-logs`.
   - Client files: packages/core/admin/admin/src/pages/Settings/pages/AuditLogs/index.tsx
   - A plugin registration was added to add a Settings link that requires permission `admin::audit-logs.read`.

Testing
-------
- Unit tests: Added tests for lifecycle behavior and deep-diff utility.
- Integration tests: Added simulated integration tests covering create, update, delete flows and excludeContentTypes behavior. These tests mock `strapi.eventHub`, `strapi.db.query(...).create`, and `strapi.requestContext.get()`.
- Tests are kept fast and deterministic by avoiding heavy runtime bootstrapping.

Configuration and Defaults
--------------------------
- `admin.auditLogs.enabled` — administrative toggle to enable/disable the UI and admin features.
- `auditLog.enabled` — global toggle to enable/disable logging. Defaults to true in code unless config overrides.
- `auditLog.excludeContentTypes` — array of content-type UIDs to exclude from auditing (default: []).
- Retention: Defaults to 90 days; enterprise licensing can cap or override retention days. Implemented `getRetentionDays` logic in lifecycle service to compute retention.

Assumptions
-----------
- The system has an `eventHub` and `requestContext` (Strapi runtime) available and that events contain payload shapes consistent with document-service events.
- The audit-logs table exists (content-type schema will cause creation on the next server start in most Strapi setups). The migration added is a best-effort helper to materialize DB indexes in existing environments.
- Admin UI changes are minimal and intended as a preview; a more complete UI (filters, pagination UI, RBAC settings integration) is planned but not yet implemented.

Limitations & Tradeoffs
-----------------------
- Deep-diff is purposely guarded (maxDepth, maxNodes) to avoid runaway CPU/memory usage. When truncated, audit logs will show `__truncated` markers and may not include the full diff.
- The content-type index metadata in the content-type schema helps new installs, but existing DBs require running the migration or manual index creation.
- Admin UI is minimal to reduce scope; it relies on the admin endpoint and should be expanded if needed.

Future Work
-----------
- Admin UI enhancements:
  - Add filter controls (contentType, user, action, date range), pagination controls, sorting, and nicer table UI.
  - Add role/permission settings UI so `admin::audit-logs.read` is visible and configurable within role management.
  - Add e2e tests for the UI.
- Migrations & backwards-compat:
  - Expand migration to support more edge cases and DB types (SQLite specifics) and ensure zero-downtime migration for large tables.
- Monitoring & sizing:
  - Add metrics and alerts when many audit logs are generated, or when deep-diff truncation happens often.
- Retention & archiving:
  - Support archiving audit logs to external storage or S3, and more flexible retention policies per content-type.
- Performance tuning:
  - Adjust deepDiff heuristics and consider sampling or throttling for noisy endpoints.

Contact / Review
----------------
- Implementation files to review:
  - Lifecycle: packages/core/admin/ee/server/src/audit-logs/services/lifecycles.ts
  - Persistence: packages/core/admin/ee/server/src/audit-logs/services/audit-logs.ts
  - Controller & validation: packages/core/admin/ee/server/src/audit-logs/controllers/audit-logs.ts and validation files
  - Content-type schema: packages/core/admin/ee/server/src/audit-logs/content-types/audit-log.ts
  - Admin UI: packages/core/admin/admin/src/pages/Settings/pages/AuditLogs/index.tsx and plugin registration in packages/core/admin/admin/src/plugins/audit-logs/admin/src/index.tsx
  - Migration: packages/core/core/src/migrations/database/2025-10-27-add-audit-logs-indexes.ts

Revision history
----------------
- 2025-10-27: Initial design note created summarizing lifecycle, persistence, diff logic, tests, and admin UI preview.

