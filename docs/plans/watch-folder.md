# Watch Folder Feature Plan

**Version:** 1.0  
**Last Updated:** March 2026

---

## Overview

The watch folder feature enables automatic import of credit card statement PDFs when they appear in a user-configured directory. It uses the **watchdog** library's `Observer` to monitor the filesystem for new or moved PDF files, waits for file writes to stabilize, and enqueues files for processing via the shared `processing_queue`. Results are logged to `ProcessingLog` for frontend polling and toast notifications.

This feature is **non-API** — it runs as a background service started at application lifecycle (lifespan) when `Settings.watch_folder` is configured. The API only exposes processing logs for UI feedback.

---

## API Endpoints

### GET /api/statements/processing-logs

**Purpose:** Return recent processing logs for frontend polling (e.g., after watch folder auto-imports).

**Query Params:**
- `unread_only` (default: true): If true, only return logs where `acknowledged == 0`

**Response (200):**
```json
[
  {
    "id": "uuid",
    "fileName": "hdfc_statement.pdf",
    "status": "success",
    "message": "",
    "bank": "hdfc",
    "transactionCount": 35,
    "createdAt": "2026-03-01T12:00:00"
  }
]
```

**Behavior:**
- Ordered by `created_at` descending
- Limited to 20 most recent logs
- Status values: `success`, `error`, `duplicate`, `card_not_found`, `parse_error`

---

### POST /api/statements/processing-logs/{log_id}/ack

**Purpose:** Mark a processing log as acknowledged so it no longer appears in unread list.

**Response (200):**
```json
{"status": "ok"}
```

**Behavior:**
- If log not found, no error; idempotent
- Sets `acknowledged = 1` on the log

---

## Data Model

### ProcessingLog

| Column | Type | Constraints |
|--------|------|-------------|
| id | VARCHAR(36) | PK, uuid4 |
| file_name | VARCHAR(512) | NOT NULL |
| status | VARCHAR(20) | NOT NULL |
| message | TEXT | |
| bank | VARCHAR(50) | |
| transaction_count | INTEGER | default 0 |
| acknowledged | INTEGER | default 0 |
| created_at | DATETIME | default utcnow |

---

## Implementation Details

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Watchdog Observer (recursive)                                   │
│  • Watches Settings.watch_folder                                 │
│  • Events: on_created, on_moved                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  StatementWatchHandler                                           │
│  • _should_process: .pdf suffix, exclude _unlocked                │
│  • _wait_for_file_stable: size stable 1.5s, timeout 15s          │
│  • _enqueue_pdf: processing_queue.submit()                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  processing_queue (ThreadPoolExecutor, max 10)                   │
│  • process_statement() (same as upload)                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  _log_processing_result: Insert ProcessingLog                   │
└─────────────────────────────────────────────────────────────────┘
```

### Startup Flow

1. **Lifespan:** On `app` startup, `init_db()` runs, then `seed_categories()`.
2. **Settings check:** `db.query(Settings).first()`; if `watch_folder` is set:
   - Call `start_watcher(watch_folder, db_session_factory=SessionLocal)`.
   - Store returned `Observer` in global `_watcher_observer`.
3. **Shutdown:** On `app` shutdown, `stop_watcher(observer)` and `processing_queue.shutdown(wait=True)`.

### start_watcher

**Signature:** `start_watcher(watch_path: str, db_session_factory: Callable) -> Optional[Observer]`

**Steps:**
1. `path = Path(watch_path).expanduser().resolve()`
2. `path = _resolve_true_case(path)` — resolve to true filesystem case (macOS APFS)
3. If `not path.exists()` or `not path.is_dir()`: log warning, return `None`
4. Create `StatementWatchHandler(db_session_factory)`
5. Create `Observer()`, schedule handler with `observer.schedule(handler, str(path), recursive=True)`
6. `observer.start()`
7. Start daemon thread: `_initial_scan(path, handler)`
8. Return observer

### _initial_scan

**Purpose:** Process existing PDFs in watch folder at startup.

**Steps:**
1. `pdfs = sorted(watch_dir.rglob("*.pdf"))`
2. Filter with `handler._should_process(p)` — exclude `_unlocked` files
3. For each eligible PDF: `handler._enqueue_pdf(pdf_path, wait_for_stable=False)`
4. Deduplication: handled inside `process_statement` via `file_hash`

### StatementWatchHandler

**Events:** `on_created`, `on_moved`

**on_created:** `event.src_path`; handler checks `_should_process(Path(event.src_path))`; if yes, `_enqueue_pdf(path)`.

**on_moved:** `event.dest_path`; same logic — process destination path (file moved into watch folder).

**on_modified:** Not handled — avoids duplicate processing when file is being written.

### _should_process

- Returns `False` if `path.suffix.lower() != ".pdf"`
- Returns `False` if `"_unlocked" in path.stem` (skip temp unlocked files)
- Returns `True` otherwise

### _wait_for_file_stable

**Purpose:** Wait until file size stops changing (file copy/write complete).

**Parameters:**
- `timeout`: 15.0 seconds
- `interval`: 0.5 seconds

**Logic:**
1. Poll `path.stat().st_size` every `interval`
2. If size equals last size and size > 0:
   - Start/continue stable timer
   - If stable for 1.5 seconds, return `True`
3. Else: reset stable timer, update last_size
4. If deadline exceeded, return `False` (process anyway with warning)

### _enqueue_pdf

**Parameters:**
- `path`: Path to PDF
- `wait_for_stable`: Default True for live events; False for initial scan

**Steps:**
1. If `wait_for_stable` and `not _wait_for_file_stable(path)`: log warning, continue
2. `future = processing_queue.submit(pdf_path=str(path), db_session_factory=...)`
3. `future.add_done_callback(lambda f: self._on_done(path.name, f))`

### _on_done

- `result = future.result()` (may raise)
- On success: `_log_processing_result(db_session_factory, file_name, result)`
- On exception: `_log_processing_result(..., {"status": "error", "message": "Processing failed unexpectedly", "count": 0})`

### _log_processing_result

- Creates new DB session via `db_session_factory()`
- Inserts `ProcessingLog(file_name=..., status=result.get("status"), message=..., bank=..., transaction_count=result.get("count", 0))`
- Commits; on exception rollback and log

### stop_watcher

- `observer.stop()`
- `observer.join(timeout=5)`
- Log "Stopped folder watcher"

### _resolve_true_case

**Purpose:** On macOS APFS (case-insensitive), FSEvents delivers events with the actual on-disk casing. watchdog compares paths case-sensitively, so the watch path must match the real casing.

**Logic:** Iterate path components; for each, scan parent directory for entry whose `name.lower() == component.lower()`; use that entry's resolved path. Fallback to original component on OSError or no match.

---

## Edge Cases

### Invalid Input

| Scenario | Handling |
|---------|----------|
| Non-existent watch path | `start_watcher` returns `None`; log warning |
| Watch path is not a directory | Same |
| Empty watch path | `Path("").expanduser().resolve()` may not exist; returns `None` |

### Duplicate Data

| Scenario | Handling |
|----------|----------|
| Same file processed twice (e.g., copy then move) | `process_statement` deduplicates by `file_hash`; second returns `duplicate` |
| Initial scan + live event for same file | Both enqueued; first to commit wins; second gets duplicate |
| Multiple ProcessingLogs for same file | Each run creates a new log; no deduplication of logs |

### Missing Data

| Scenario | Handling |
|----------|----------|
| Watch folder deleted while running | Observer may continue; events may fail; no explicit handling |
| File deleted before processing | `process_statement` returns `{status: "error", message: "File not found"}` |
| DB session factory fails | Exception in callback; logged; no processing log |

### Concurrent Access

| Scenario | Handling |
|----------|----------|
| Many files dropped at once | All enqueued; max 10 processed concurrently |
| Initial scan + new files during scan | Both enqueue; queue serializes |
| Same file from multiple events | Possible (e.g., move triggers both); hash dedup in process_statement |

### Large Files/Datasets

| Scenario | Handling |
|----------|----------|
| Large PDF | Same as upload; processed in worker |
| Many PDFs in folder | Initial scan enqueues all; processed 10 at a time |
| Deep directory tree | `rglob` traverses; recursive watch may have many inotify handles |

### Encrypted/Corrupted Files

| Scenario | Handling |
|----------|----------|
| Encrypted PDF | Same as upload; unlock attempted |
| Corrupted PDF | Parse fails; `parse_error` or `error` logged |

### External Dependencies

| Scenario | Handling |
|----------|----------|
| watchdog not installed | Import error at startup |
| inotify limit (Linux) | System-dependent; may need `fs.inotify.max_user_watches` increase |
| Permission denied on watch path | `start_watcher` may fail; path.exists() could pass |

---

## Error Handling

| Error | Handling |
|-------|----------|
| Watch path invalid | Return `None`; log warning |
| Processing exception | Log; insert ProcessingLog with status "error" |
| Observer join timeout | 5s timeout; process may exit with observer still running |

---

## Security Considerations

- **Path validation:** `Path(watch_path).expanduser().resolve()` — user-controlled path; must exist and be directory
- **Recursive watch:** Watches entire subtree; user could point to large directory
- **No path traversal:** Watch path is resolved; events are under that path
- **File permissions:** Process must have read access to watch folder and files

---

## Testing Strategy

### Existing Tests

- **test_api.py:** Processing logs are polled by frontend (not directly tested)
- **test_browser.py:** No watch folder specific tests

### Recommended Additional Tests

- `start_watcher` with non-existent path returns None
- `start_watcher` with file (not dir) returns None
- `_should_process` rejects non-PDF, accepts PDF, rejects _unlocked
- `_wait_for_file_stable` with stable file returns True
- `_wait_for_file_stable` with growing file times out
- Initial scan with existing PDFs enqueues them
- Processing log created on success and error
- ack endpoint marks log as acknowledged

---

## Event Types Handled

| Event | Source | Action |
|-------|--------|--------|
| on_created | New file in watch dir | Enqueue if PDF, not _unlocked |
| on_moved | File moved into watch dir | Enqueue dest path if PDF |
| on_modified | File content changed | Not handled (avoids duplicate) |
| on_deleted | File removed | Not handled |

---

## File Stability Logic (Detailed)

When a file is copied or downloaded, the write may take several seconds. Processing a partially written file can cause parse failures.

**Algorithm:**
1. Poll `path.stat().st_size` every 0.5s
2. If size == last_size and size > 0: increment stable counter
3. If stable for 1.5s: return True (file ready)
4. If size changed: reset stable counter
5. If 15s elapsed: return False (process anyway with warning)

**Initial scan:** `wait_for_stable=False` — files assumed complete.

---

## Processing Queue Integration

- **Shared pool:** Same `ThreadPoolExecutor` as bulk upload
- **Max workers:** 10
- **Session:** Each job gets `db_session_factory` to create its own session
- **Callback:** `_on_done` runs in worker thread; `_log_processing_result` creates new session

---

## Platform-Specific Notes

### macOS

- **APFS case-insensitivity:** `_resolve_true_case` ensures watch path matches on-disk casing
- **FSEvents:** Native; no inotify

### Linux

- **inotify:** watchdog uses inotify
- **Limit:** `fs.inotify.max_user_watches` may need increase for deep trees
- **Recursive:** Can create many watches

### Windows

- **ReadDirectoryChangesW:** watchdog uses Windows API
- **Long paths:** May need enablement for deep paths

---

## ProcessingLog Schema and Usage

| Column | Purpose |
|--------|---------|
| file_name | Original filename for display |
| status | success, error, duplicate, card_not_found, parse_error |
| message | Error or info message |
| bank | Detected or used bank |
| transaction_count | Number of transactions imported |
| acknowledged | 0=unread, 1=dismissed |

Frontend polls `GET /api/statements/processing-logs?unread_only=true` (e.g., every 60s), shows toasts for each, then calls `POST /api/statements/processing-logs/{id}/ack` to dismiss.

---

## Initial Scan Timing

- Runs in daemon thread: `threading.Thread(target=_initial_scan, daemon=True)`
- Does not block app startup
- May process many files; all enqueued to shared pool
- Deduplication: `process_statement` checks file_hash; already-imported files return duplicate quickly

---

## Watch Path Validation

- `Path(watch_path).expanduser().resolve()` — resolve `~` and symlinks
- `_resolve_true_case` — on macOS, match actual filesystem casing
- Must exist: `path.exists()`
- Must be directory: `path.is_dir()`
- If invalid: return None, log warning; app continues without watcher

---

## Appendix: Processing Result Status Values

| Status | Meaning |
|--------|---------|
| success | Statement imported; transactions created |
| duplicate | Same file (hash) already imported |
| card_not_found | No matching card; statement not imported |
| parse_error | Parser could not extract transactions; statement saved with status |
| error | Unlock failed, exception, or other error |

---

## Appendix: Watch Folder Best Practices

- Use a dedicated folder (e.g., ~/Downloads/burnrate_statements)
- Avoid watching large directories (e.g., entire home)
- On Linux, increase inotify limit if needed: `echo 524288 | sudo tee /proc/sys/fs/inotify/max_user_watches`

---

## Related Documentation

- **docs/plans/statement-processing.md** — Same process_statement flow
- **docs/plans/settings-and-setup.md** — Watch folder configuration
