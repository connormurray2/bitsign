## ADDED Requirements

### Requirement: Unified document list
The dashboard SHALL display all documents relevant to the user (created, pending signature, signed) in a single unified list rather than fixed separate sections. The default view SHALL show all documents sorted by most recently updated.

#### Scenario: Dashboard loads with documents
- **WHEN** an authenticated user opens the dashboard
- **THEN** all their documents appear in a single list ordered by updatedAt descending

#### Scenario: Empty state
- **WHEN** the user has no documents
- **THEN** an empty state message with a "Create your first document" prompt is shown

### Requirement: Pending signature alert strip
When a user has documents awaiting their signature, a persistent alert strip SHALL appear at the top of the dashboard regardless of the active folder or filter, prompting them to sign.

#### Scenario: Pending items exist
- **WHEN** the user has one or more documents pending their signature
- **THEN** a highlighted strip at the top lists those documents with direct sign links

#### Scenario: No pending items
- **WHEN** the user has no documents pending their signature
- **THEN** the alert strip is not shown

### Requirement: Real-time search
The dashboard SHALL provide a search input that filters the visible document list by title in real time (client-side). The search MUST be case-insensitive and match any substring of the document title.

#### Scenario: Search filters documents
- **WHEN** user types into the search input
- **THEN** only documents whose titles contain the typed string (case-insensitive) are shown

#### Scenario: Search cleared
- **WHEN** user clears the search input
- **THEN** all documents in the current view are shown again

#### Scenario: No matches
- **WHEN** the search string matches no document titles
- **THEN** a "No results" empty state is shown

### Requirement: Status and role filters
The dashboard SHALL provide filter controls to narrow the document list by status or the user's role. Filter options SHALL include: All, Awaiting My Signature, Created by Me, Signed by Me, Complete.

#### Scenario: Filter by role
- **WHEN** user selects "Created by Me"
- **THEN** only documents where the user is the creator are shown

#### Scenario: Filter by status
- **WHEN** user selects "Complete"
- **THEN** only documents with COMPLETE status are shown

#### Scenario: Awaiting My Signature filter
- **WHEN** user selects "Awaiting My Signature"
- **THEN** only documents where the user is a signer with PENDING or NOTIFIED status are shown

#### Scenario: All filter
- **WHEN** user selects "All"
- **THEN** all documents are shown (subject to active folder and search)

### Requirement: Folder sidebar
The dashboard SHALL display a sidebar listing the user's folders. Clicking a folder SHALL filter the document list to only documents assigned to that folder. A root "All Documents" entry SHALL always be present and selected by default.

#### Scenario: Select folder
- **WHEN** user clicks a folder in the sidebar
- **THEN** the document list shows only documents assigned to that folder

#### Scenario: Select All Documents
- **WHEN** user clicks "All Documents" in the sidebar
- **THEN** the document list shows documents regardless of folder assignment

#### Scenario: Folder with document count
- **WHEN** folders are listed in the sidebar
- **THEN** each folder shows the number of documents it contains

### Requirement: Create folder from sidebar
A user SHALL be able to create a new folder directly from the sidebar without navigating away.

#### Scenario: Inline folder creation
- **WHEN** user clicks "New Folder" in the sidebar and submits a name
- **THEN** the folder is created and appears in the sidebar, selected immediately

### Requirement: Rename folder from sidebar
A user SHALL be able to rename a folder by double-clicking its name in the sidebar.

#### Scenario: Rename via double-click
- **WHEN** user double-clicks a folder name
- **THEN** an inline edit input appears; on confirm the folder is renamed

### Requirement: Delete folder from sidebar
A user SHALL be able to delete a folder via a context action in the sidebar. The user SHALL be informed that documents will be unassigned.

#### Scenario: Delete folder
- **WHEN** user clicks delete on a folder and confirms
- **THEN** the folder is removed and its documents appear in the root view

### Requirement: Assign document to folder
From the document list, a user SHALL be able to move a document (that they created) to a folder via a dropdown control on the document card.

#### Scenario: Move to folder
- **WHEN** creator selects a folder from the "Move to" dropdown on a document card
- **THEN** the document is assigned to that folder and moves to the appropriate filtered view

#### Scenario: Move to folder hidden for non-creators
- **WHEN** a user who did not create the document views the document card
- **THEN** the "Move to" folder control is not shown
