## 1. Database Schema

- [x] 1.1 Add `Folder` model to `prisma/schema.prisma` with fields: `id`, `ownerKey`, `name`, `createdAt`
- [x] 1.2 Add optional `folderId` FK on `Document` model referencing `Folder`
- [x] 1.3 Run `prisma migrate dev --name add-folders` and verify migration

## 2. Folder API Routes

- [x] 2.1 Create `src/app/api/folders/route.ts` — `GET` (list user's folders with document counts) and `POST` (create folder, enforce 50-folder limit and name validation)
- [x] 2.2 Create `src/app/api/folders/[id]/route.ts` — `PATCH` (rename) and `DELETE` (delete, unassign docs)
- [x] 2.3 Create `src/app/api/documents/[id]/folder/route.ts` — `PATCH` to assign/unassign folderId, creator-only enforcement

## 3. Data Layer

- [x] 3.1 Update `/api/documents/list` response to include `folderId` on each document
- [x] 3.2 Create `src/hooks/useFolders.ts` SWR hook for `GET /api/folders`
- [x] 3.3 Add mutation helpers in `src/lib/folderApi.ts` for create/rename/delete folder and assign-document-to-folder (wrapping fetch calls, used by components)

## 4. Folder Sidebar Component

- [x] 4.1 Create `src/components/dashboard/FolderSidebar.tsx` — renders "All Documents" root entry plus folder list with document counts
- [x] 4.2 Implement inline "New Folder" creation input at bottom of sidebar
- [x] 4.3 Implement double-click inline rename for folder names
- [x] 4.4 Implement delete action per folder (with confirmation tooltip/popover noting documents will be unassigned)

## 5. Document Explorer Component

- [x] 5.1 Create `src/components/dashboard/DocumentExplorer.tsx` — unified document list accepting filtered document array as prop
- [x] 5.2 Add search input (controlled) with client-side substring filter on document title (case-insensitive)
- [x] 5.3 Add filter pill/tab controls: All, Awaiting My Signature, Created by Me, Signed by Me, Complete
- [x] 5.4 Add "Move to folder" dropdown on `DocumentCard` when user is the creator — calls assign-folder mutation
- [x] 5.5 Implement "No results" empty state when search/filter yields nothing

## 6. Pending Signature Alert Strip

- [x] 6.1 Create `src/components/dashboard/PendingSignatureStrip.tsx` — shows highlighted strip with links to sign when pendingSignature list is non-empty
- [x] 6.2 Render strip at top of dashboard, outside folder/search/filter scope (always visible if applicable)

## 7. Dashboard Page Rewire

- [x] 7.1 Rewrite `src/app/dashboard/page.tsx` to compose `FolderSidebar` + `DocumentExplorer` + `PendingSignatureStrip`
- [x] 7.2 Wire active folder state: selected folderId filters the document list passed to `DocumentExplorer`
- [x] 7.3 Combine created/signed/pendingSignature arrays into a single de-duplicated list for the unified view; attach role metadata (creator/signer) per document for filter logic
- [x] 7.4 Update layout to side-by-side (sidebar + main) on desktop, stacked on mobile
