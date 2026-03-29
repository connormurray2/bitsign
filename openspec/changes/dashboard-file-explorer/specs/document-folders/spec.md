## ADDED Requirements

### Requirement: Create folder
A user SHALL be able to create a named folder. Folders are scoped to the user's identity key. A user MAY have up to 50 folders. Folder names MUST be non-empty and at most 64 characters.

#### Scenario: Successful folder creation
- **WHEN** user submits a valid folder name
- **THEN** a new folder is persisted and appears in the folder list immediately

#### Scenario: Empty folder name rejected
- **WHEN** user submits an empty or whitespace-only folder name
- **THEN** the system returns a 400 error and the folder is not created

#### Scenario: Folder limit reached
- **WHEN** user already has 50 folders and attempts to create another
- **THEN** the system returns a 400 error indicating the limit

### Requirement: Rename folder
A user SHALL be able to rename any folder they own. The same name constraints apply as for creation.

#### Scenario: Successful rename
- **WHEN** user submits a new valid name for an existing folder they own
- **THEN** the folder is updated and the new name is reflected in the folder list

#### Scenario: Rename another user's folder rejected
- **WHEN** a request is made to rename a folder belonging to a different identity key
- **THEN** the system returns a 404 error

### Requirement: Delete folder
A user SHALL be able to delete a folder they own. Deleting a folder SHALL unassign all documents from it (set their folderId to null) but SHALL NOT delete the documents themselves.

#### Scenario: Folder deleted with documents
- **WHEN** user deletes a folder that contains documents
- **THEN** the folder is removed and those documents appear in the unassigned "root" view

#### Scenario: Empty folder deleted
- **WHEN** user deletes a folder with no documents
- **THEN** the folder is removed with no side effects

### Requirement: Assign document to folder
A user SHALL be able to assign a document to one of their folders. Only the document's creator SHALL be able to assign it to a folder. A document MAY belong to at most one folder at a time. Setting folderId to null removes the document from any folder.

#### Scenario: Document assigned to folder
- **WHEN** the document creator assigns a document to a folder they own
- **THEN** the document's folderId is updated and it appears under that folder

#### Scenario: Document moved to different folder
- **WHEN** user assigns a document that is already in folder A to folder B
- **THEN** the document is moved to folder B (removed from folder A)

#### Scenario: Document unassigned from folder
- **WHEN** user sets folderId to null on a document
- **THEN** the document appears in the unassigned root view

#### Scenario: Non-creator cannot assign folder
- **WHEN** a user who did not create the document attempts to assign it to a folder
- **THEN** the system returns a 403 error

### Requirement: List folders
The system SHALL return all folders owned by the requesting user, ordered by creation date ascending.

#### Scenario: Folders listed for authenticated user
- **WHEN** an authenticated user requests their folder list
- **THEN** the response includes all folders for that identity key with id, name, and document count
