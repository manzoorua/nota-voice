# Requirements Document

## Introduction

The NotaVoice application currently has basic offline storage capabilities using IndexedDB and a service worker with background sync registration. However, the current implementation has several robustness gaps: no retry logic with exponential backoff, no conflict resolution strategy, no queue ordering guarantees, no storage quota management, placeholder sync functions in the service worker, and transcription persistence limited to a single item in localStorage. This feature enhances the offline queue to provide reliable, ordered, and resilient synchronization of voice notes and transcriptions when connectivity is intermittent or lost.

## Glossary

- **Offline_Queue**: The IndexedDB-based queue that stores voice notes and transcriptions created while the device lacks network connectivity
- **Queue_Manager**: The module responsible for enqueuing, dequeuing, ordering, and managing lifecycle of items in the Offline_Queue
- **Sync_Engine**: The module responsible for attempting to synchronize queued items with the Supabase backend when connectivity is restored
- **Queue_Item**: A single entry in the Offline_Queue representing a voice note or transcription pending synchronization
- **Retry_Policy**: The set of rules governing how failed synchronization attempts are retried, including backoff intervals and maximum attempt counts
- **Conflict_Resolver**: The module responsible for detecting and resolving conflicts between locally queued items and server-side state
- **Storage_Monitor**: The module responsible for tracking IndexedDB storage usage and enforcing quota limits
- **Connectivity_Detector**: The module responsible for determining actual network reachability beyond the browser online/offline events

## Requirements

### Requirement 1: Persistent Queue Storage

**User Story:** As a user, I want my voice notes and transcriptions to be reliably stored locally when I am offline, so that I do not lose any recordings regardless of connectivity state.

#### Acceptance Criteria

1. WHEN a voice note recording completes while the device has no network connectivity, THE Queue_Manager SHALL persist the Queue_Item to IndexedDB within 2 seconds of recording completion
2. WHEN a Queue_Item is persisted to IndexedDB, THE Queue_Manager SHALL store the audio blob (maximum 50 MB per recording), creation timestamp, monotonically increasing sequence number, recording duration in milliseconds, source device identifier, and transcription status (pending, completed, or failed)
3. IF IndexedDB write fails due to a storage error, THEN THE Queue_Manager SHALL retain the Queue_Item in memory and retry the write operation up to 3 times with 500ms delays between attempts
4. IF all IndexedDB write retries are exhausted, THEN THE Queue_Manager SHALL retain the Queue_Item in memory, display a persistent notification to the user indicating the recording could not be saved locally, and provide a visible retry action that the user can invoke manually
5. THE Queue_Manager SHALL maintain FIFO ordering of Queue_Items based on their sequence numbers
6. IF IndexedDB write fails due to storage quota being exceeded, THEN THE Queue_Manager SHALL retain the Queue_Item in memory and notify the user that device storage is full, indicating the amount of storage required to save the pending recording

### Requirement 2: Reliable Connectivity Detection

**User Story:** As a user, I want the application to accurately detect when I have a working network connection, so that synchronization only occurs when the server is actually reachable.

#### Acceptance Criteria

1. WHEN the browser fires an online event, THE Connectivity_Detector SHALL verify actual server reachability by performing an HTTP HEAD request against the Supabase endpoint and SHALL mark the connection as reachable only if a successful response is received within 3 seconds
2. WHILE the device reports online status, THE Connectivity_Detector SHALL perform periodic reachability checks every 30 seconds, skipping a scheduled check if the previous check has not yet completed
3. IF 2 consecutive health checks fail while the browser reports online status, THEN THE Connectivity_Detector SHALL mark the connection as unreachable and suppress all synchronization attempts until connectivity is restored
4. WHEN the health check succeeds after a period of unreachability, THE Connectivity_Detector SHALL require 1 consecutive successful health check before emitting a connectivity-restored event to trigger synchronization
5. THE Connectivity_Detector SHALL expose the current connectivity state as one of three values: offline (browser reports no network), degraded (browser reports online but health check failing), or connected (browser reports online and health check succeeding)
6. WHEN the browser fires an offline event, THE Connectivity_Detector SHALL immediately mark the connection as offline, suppress all synchronization attempts, and cancel any in-flight health checks

### Requirement 3: Ordered Synchronization with Retry

**User Story:** As a user, I want my offline recordings to be synchronized to the server in the order they were created, with automatic retries on failure, so that my notes appear chronologically correct.

#### Acceptance Criteria

1. WHEN the Sync_Engine detects a successful response from the synchronization server endpoint after a period of unavailability, THE Sync_Engine SHALL process Queue_Items in FIFO order based on sequence number
2. WHEN a Queue_Item synchronization attempt fails due to a server error response, a request timeout exceeding 30 seconds, or a network error, THE Sync_Engine SHALL retry using exponential backoff starting at 1 second, doubling on each attempt, up to a maximum of 5 retry attempts
3. WHILE a Queue_Item is being synchronized, THE Sync_Engine SHALL mark the item with an in-progress status to prevent duplicate processing
4. IF a Queue_Item exceeds the maximum retry count of 5 attempts, THEN THE Sync_Engine SHALL mark the item as failed, notify the user that the item could not be synchronized, and proceed to the next item in the queue
5. WHEN a Queue_Item receives a success acknowledgment from the server, THE Sync_Engine SHALL remove the item from the Offline_Queue and update the pending count
6. THE Sync_Engine SHALL process one Queue_Item at a time to preserve ordering and avoid overwhelming the server
7. IF connectivity is lost while a Queue_Item synchronization is in-progress, THEN THE Sync_Engine SHALL revert the item status from in-progress to pending and reattempt synchronization when connectivity is restored, counting the interrupted attempt toward the retry limit

### Requirement 4: Conflict Detection and Resolution

**User Story:** As a user, I want the system to handle conflicts between my offline edits and server state gracefully, so that I do not lose data when the same note is modified in multiple places.

#### Acceptance Criteria

1. WHEN the Sync_Engine receives a conflict response (HTTP 409) from the server, THE Conflict_Resolver SHALL retain both the local version and the server version in local storage until the conflict is resolved or the auto-resolution timeout elapses
2. WHEN a conflict is detected, THE Conflict_Resolver SHALL notify the user with the note title, the modification timestamp of each version, and the resolution options within 3 seconds of detection
3. THE Conflict_Resolver SHALL support three resolution strategies: keep local version, keep server version, or keep both as separate notes
4. IF the user does not resolve a conflict within 24 hours, THEN THE Conflict_Resolver SHALL default to keeping both versions as separate notes and mark the conflict as auto-resolved
5. WHILE a conflict is unresolved, THE Sync_Engine SHALL continue processing other non-conflicting Queue_Items
6. WHEN the user selects a resolution strategy, THE Conflict_Resolver SHALL apply the chosen resolution and enqueue the result for synchronization to the server within 2 seconds
7. IF applying a conflict resolution fails during sync, THEN THE Conflict_Resolver SHALL retain both versions, revert the conflict to unresolved state, and notify the user that resolution could not be completed
8. WHEN the "keep both as separate notes" strategy is applied, THE Conflict_Resolver SHALL create the duplicate note with the original title appended by a conflict suffix that includes the resolution timestamp, distinguishable from the original note in the notes list

### Requirement 5: Storage Quota Management

**User Story:** As a user, I want the application to manage local storage space responsibly, so that the offline queue does not consume excessive device storage or cause failures.

#### Acceptance Criteria

1. WHEN a Queue_Item is added to or removed from IndexedDB, THE Storage_Monitor SHALL recalculate the total size in bytes of all stored Queue_Items and update the stored usage value within 2 seconds
2. WHEN the total queue storage exceeds 80% of the quota reported by the StorageManager API estimate, THE Storage_Monitor SHALL display a persistent, dismissible warning notification to the user indicating that offline storage is running low and showing the percentage used
3. WHEN the total queue storage exceeds 95% of the quota reported by the StorageManager API estimate, THE Storage_Monitor SHALL reject new Queue_Item enqueue requests and display a non-dismissible notification to the user indicating that offline storage is full and that items must be synchronized before new items can be queued
4. WHEN a Queue_Item is successfully synchronized and removed, THE Storage_Monitor SHALL update the storage usage tracking and, if usage has dropped below 95% of the estimated quota, re-enable enqueuing of new Queue_Items
5. IF the browser raises a QuotaExceededError during a write operation, THEN THE Storage_Monitor SHALL remove up to 10 of the oldest successfully-synced items from the database and retry the failed write operation once
6. IF the browser raises a QuotaExceededError and no successfully-synced items exist to remove, THEN THE Storage_Monitor SHALL reject the write operation and display a notification to the user indicating that storage is full and pending items must be synchronized before new data can be saved

### Requirement 6: Queue Status Visibility

**User Story:** As a user, I want to see the current state of my offline queue, so that I know which recordings are pending, syncing, or failed.

#### Acceptance Criteria

1. THE Queue_Manager SHALL expose the count of pending, in-progress, and failed Queue_Items to the user interface, updated within 1 second of any state change
2. WHEN a Queue_Item transitions between states (pending, in-progress, synced, failed), THE Queue_Manager SHALL emit a state change event within 100ms
3. WHILE one or more items exist in the Offline_Queue with a state of pending, in-progress, or failed, THE Queue_Manager SHALL display a persistent non-dismissible indicator showing the total number of unsynced items
4. WHEN a user views the queue status, THE Queue_Manager SHALL display each item with its title (truncated to 80 characters), creation time in the user's local timezone, size in human-readable units (bytes, KB, MB), current state, and retry count, ordered by creation time descending, with a maximum of 50 items per view
5. IF a Queue_Item is in the failed state, THEN THE Queue_Manager SHALL allow the user to manually retry that item, re-enqueuing it with a state of pending
6. WHEN a user requests deletion of a Queue_Item, THE Queue_Manager SHALL prompt for confirmation before permanently removing the item from the queue
7. IF a manual retry of a Queue_Item fails, THEN THE Queue_Manager SHALL increment the retry count, return the item to the failed state, and display an error indication describing the failure reason
8. WHEN the Offline_Queue contains zero items, THE Queue_Manager SHALL display an empty state message indicating that all recordings have been synced

### Requirement 7: Background Sync Integration

**User Story:** As a user, I want synchronization to happen in the background even when the app is not in the foreground, so that my notes are uploaded without requiring me to keep the app open.

#### Acceptance Criteria

1. WHEN a new Queue_Item is added to the Offline_Queue, THE Queue_Manager SHALL register a background sync event with the service worker using a dedicated sync tag
2. WHEN the service worker receives a sync event, THE Sync_Engine SHALL read pending Queue_Items from IndexedDB in FIFO order and process them sequentially, up to a maximum of 50 items per sync event
3. IF the Background Sync API is not supported by the browser, THEN THE Sync_Engine SHALL fall back to synchronizing when the application regains focus
4. WHEN background sync completes successfully for one or more Queue_Items, THE service worker SHALL post a message to any active client windows containing the IDs and new status of the synchronized items
5. THE service worker SHALL retry failed Queue_Items using exponential backoff starting at 1 second with a maximum of 5 retry attempts, and SHALL process items in the same FIFO order as the foreground Sync_Engine
6. IF a Queue_Item fails all retry attempts during background sync, THEN THE Sync_Engine SHALL mark the item status as failed in IndexedDB and SHALL re-register the background sync event to retry remaining pending items on the next browser-scheduled sync opportunity

### Requirement 8: Data Integrity and Recovery

**User Story:** As a user, I want assurance that my queued recordings are not corrupted or lost due to application crashes or unexpected shutdowns, so that I can trust the offline queue with important notes.

#### Acceptance Criteria

1. WHEN a Queue_Item is persisted, THE Queue_Manager SHALL compute a SHA-256 checksum of the audio blob and store it as a field alongside the Queue_Item record
2. WHEN the Sync_Engine initiates synchronization of a Queue_Item, THE Sync_Engine SHALL recompute the SHA-256 checksum of the audio blob and compare it against the stored checksum before transmitting
3. IF a checksum verification fails during synchronization, THEN THE Sync_Engine SHALL mark the Queue_Item status as "corrupted", halt synchronization of that item, and display a persistent notification to the user indicating which recording failed integrity verification
4. WHEN the application starts, THE Queue_Manager SHALL verify the checksum of each pending Queue_Item within 5 seconds of launch completion and display a summary notification to the user listing any items detected as corrupted
5. THE Queue_Manager SHALL use IndexedDB transactions to ensure atomic writes, preventing partial Queue_Item storage
6. IF a Queue_Item is marked as corrupted, THEN THE Queue_Manager SHALL retain the original audio blob and present the user with options to retry synchronization, re-record the note, or delete the corrupted item
7. IF an IndexedDB write transaction fails, THEN THE Queue_Manager SHALL not persist any partial data from that transaction and SHALL display a notification to the user indicating the recording was not saved
