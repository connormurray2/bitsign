## Context

The dashboard (`src/app/dashboard/page.tsx`) fetches from `/api/documents/list` via `useDocumentList` and renders three fixed sections. The `Document` model has no folder concept. All documents are identified by the user's `identityKey` (creator or signer). The app uses Prisma + PostgreSQL, SWR for data fetching, and Tailwind for styling.

## Goals / Non-Goals

**Goals:**
- User-defined folders with create/rename/delete; documents assignable to one folder
- Real-time client-side search filtering document titles
- Status/role filters (All, Pending, Complete, Created, Signed)
- Folder sidebar alongside document list
- Server-side folder persistence per identity key

**Non-Goals:**
- Nested/hierarchical folders (flat list only for v1)
- Bulk document operations (move many at once)
- Shared or collaborative folders
- Sorting beyond default (most recent first)

## Decisions

### 1. Folder storage: new `Folder` model + `documentFolderId` on `Document`

A `Folder` model stores `(id, ownerKey, name, createdAt)`. A nullable `folderId` on `Document` links documents to folders. A document can only be in one folder.

**Alternative considered:** Client-side storage (localStorage). Rejected — folders would be lost on new device/browser; inconsistent with the app's server-side model.

**Alternative considered:** Join table `DocumentFolder`. Rejected — one-folder-per-document constraint is simpler to enforce with a direct FK. A join table adds complexity without benefit given non-Goals exclude multi-folder membership.

### 2. Search is client-side, filtering the already-loaded document list

The `/api/documents/list` response is already fetched and cached by SWR. Search filters this in-memory list with a controlled input — no additional API calls needed.

**Alternative considered:** Server-side search with query params. Rejected — document counts per user are expected to be small (tens to low hundreds); round-tripping for every keystroke adds latency without benefit.

### 3. Unified document list, filters as UI controls (not separate sections)

Replace the three static sections with a single list. A filter bar lets users select: All / Pending My Signature / Created by Me / Signed by Me / Complete. The "Awaiting Your Signature" urgent prompt is preserved as a banner/badge when relevant.

**Alternative considered:** Keep the three sections and add search + folders on top. Rejected — sections become redundant once folders exist; a unified list with filters is more consistent with the file-explorer metaphor.

### 4. Folder sidebar with inline create/rename

A left sidebar lists folders. Clicking a folder filters the document list to that folder. An inline "New Folder" input appends at the bottom. Rename via double-click. No modal required.

### 5. New API routes rather than extending existing list endpoint

- `GET /api/folders` — list user's folders
- `POST /api/folders` — create folder (`{ name }`)
- `PATCH /api/folders/[id]` — rename folder (`{ name }`)
- `DELETE /api/folders/[id]` — delete folder (documents unassigned, not deleted)
- `PATCH /api/documents/[id]/folder` — assign/unassign document to folder (`{ folderId: string | null }`)

Extending `/api/documents/list` was considered but rejected — folder CRUD is a separate concern and should not bloat the list endpoint.

## Risks / Trade-offs

- **Schema migration adds nullable FK to Document**: Low risk — nullable, no backfill needed. Rollback: drop column + Folder table.
- **Client-side search breaks if document list grows large**: Acceptable for current scale; if needed, can add server-side search later without changing the API contract.
- **Drag-and-drop to assign folder** is desirable UX but adds complexity — deferred to follow-on. For v1, a "Move to folder" dropdown on the document card is sufficient.

## Migration Plan

1. Add `Folder` model and `folderId` to `Document` in schema.prisma
2. Run `prisma migrate deploy` (non-destructive, additive only)
3. Deploy new API routes
4. Deploy updated dashboard UI
5. Rollback: revert UI deploy → revert API routes → reverse migration (drop column + table)

## Open Questions

- Should deleting a folder prompt the user, or silently unassign documents? (Proposed: silent unassign with a brief toast notification)
- Should the "Awaiting Your Signature" section remain as a persistent banner regardless of active folder/filter? (Proposed: yes — show as a sticky alert strip at the top if any pending items exist)
