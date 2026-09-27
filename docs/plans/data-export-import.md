# Plan: Data Export/Import

## Overview
This feature allows users to backup and restore their Burnrate data (database and statements) via a single ZIP file. This adheres to the local-first philosophy by avoiding any cloud backups.

## Architecture Decisions
- **Export format:** A ZIP archive containing `burnrate.db` and the `statements/` directory.
- **Import mechanism:** A ZIP archive upload. The backend will validate the ZIP contents, create a temporary backup of the existing state, and then replace the database and statements.

## API Contracts

### 1. Export Data
- **Endpoint:** `GET /api/v1/data/export`
- **Response:**
  - `200 OK`: `application/zip` stream.
  - `500 Internal Server Error`: Standard error response if zipping fails.

### 2. Import Data
- **Endpoint:** `POST /api/v1/data/import`
- **Request:** `multipart/form-data` containing a `file` field with the ZIP archive.
- **Response:**
  - `200 OK`: `{"status": "success", "message": "Data imported successfully"}`
  - `400 Bad Request`: If the uploaded file is not a valid ZIP or is missing required files.
  - `500 Internal Server Error`: If extraction or replacement fails.

## Edge Cases & Error Conditions
- **Invalid ZIP file:** The uploaded file is not a ZIP or is corrupted. (Return 400).
- **Missing essential files in ZIP:** The ZIP does not contain `burnrate.db`. (Return 400). Note: The `statements/` directory is optional during import; if absent, only the database is restored (though PDF references in the DB will become orphaned).
- **Path Traversal in ZIP (Zip Slip):** Malicious ZIP files containing paths like `../` to overwrite arbitrary system files. (Validation step must explicitly check and sanitize all paths within the ZIP before extraction).
- **Concurrent DB access during import:** We must ensure the database is not actively being written to during replacement. We will close the current SQLAlchemy engine/connections (or ensure no active transactions), swap the file, and then the app will reload. Since SQLite is used, replacing the file while in WAL mode needs care; we might need to force a checkpoint or just copy over the main `.db` and clear `.db-wal` / `.db-shm`.
- **Import Failure Recovery:** Before replacing, the current `burnrate.db` and `statements/` will be moved to a `.backup` location. If the import fails midway, we revert from the backup.

## Data Models
No changes to existing database schema.

## Security & Privacy
- **Entirely local:** No network dependencies.
- **Zip Slip Prevention (Path Traversal):** The extraction logic will resolve the absolute path of every file in the ZIP. It will assert that the final destination path strictly falls within the target `statements/` directory or root DB directory, aborting if any `../` or absolute path escapes the boundary.
- **Strict ZIP Allowlist:** The import process will reject the ZIP (or ignore invalid entries) if it contains anything other than `burnrate.db` or files under `statements/` ending in `.pdf` or `.csv`. Malicious files like `.exe` or `.py` will not be written to disk.
- **Magic Bytes Validation:** For files ending in `.pdf` or `.csv`, the system will verify the file's magic bytes (e.g., `%PDF-` signature) before passing them to parsing libraries, ensuring the file extension matches the true file format.
- **Resource Limits:** File sizes might be large; the upload endpoint will handle large payloads appropriately but enforce a strict maximum size limit (e.g., 200MB) to prevent denial of service (DoS) attacks.

## Frontend Implementation
- **Location:** Add a new "Data Management" `ElevatedCard` to the existing `Customize.tsx` page.
- **Components:** NeoPOP `Button`, `Typography`, `ElevatedCard` for the section.
- **Flow:**
  - Export: Clicking "Export" triggers a browser download.
  - Import: Clicking "Import" opens a file picker. Selected file is uploaded. During upload and processing, a loading state is shown. On success, the frontend forces a full window reload (`window.location.reload()`) to refresh all state from the new database.
- **React Patterns:** Use `useEffect` cleanup if any polling is done, handle async state properly with cancellation.

## Testing Strategy
- **Backend:** Integration tests for `/api/v1/data/export` (assert ZIP structure) and `/api/v1/data/import` (assert successful import, assert rejection of malicious/invalid ZIPs, assert rollback on failure).
- **Frontend:** Verify UI state transitions (loading -> success/error).
