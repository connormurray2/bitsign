## Why

The current dashboard is a static list split into three fixed sections ("Awaiting Your Signature", "Documents I Signed", "Documents I Created"). As a user's document count grows, finding and organizing documents becomes tedious — there's no way to search, filter by status, or group related documents together.

## What Changes

- Replace the static three-section layout with a unified, interactive file-explorer-style view
- Add user-defined folders so documents can be organized into named categories
- Add a search bar to filter documents by title in real time
- Add status/role filter controls (All, Pending, Complete, Created by me, Signed by me)
- Persist folder assignments per user (stored server-side, keyed to identity key)
- Documents can belong to one folder at a time; unassigned documents appear in an "All Documents" root view

## Capabilities

### New Capabilities
- `document-folders`: Create, rename, delete, and assign documents to user-defined folders; folder data stored in the database keyed to the user's identity key
- `dashboard-explorer`: Unified dashboard UI with search, status filters, folder sidebar, and document list replacing the current static sections

### Modified Capabilities
<!-- No existing specs to modify -->

## Impact

- New `Folder` model in Prisma schema (columns: id, ownerKey, name, createdAt)
- New `documentFolderId` optional foreign key on `Document` model (or a join table)
- New API routes: `GET/POST/DELETE /api/folders`, `PATCH /api/documents/[id]/folder`
- `useDocumentList` hook extended or replaced with a richer hook supporting search/filter params
- `src/app/dashboard/page.tsx` substantially rewritten
- New components: `FolderSidebar`, `DocumentExplorer`, `SearchBar`
