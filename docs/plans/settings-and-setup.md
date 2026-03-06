# Settings and Setup Feature Plan

**Version:** 1.0  
**Last Updated:** March 2026

---

## Overview

Settings and setup provide the initial onboarding flow and ongoing configuration:

1. **Setup wizard** — One-time `POST /api/settings/setup` with name, DOB, cards, optional watch folder
2. **Settings CRUD** — GET/PUT for name, DOB, watch_folder
3. **Watch folder config** — Stored in Settings; watcher started/restarted on change
4. **Folder browser** — `POST /api/settings/browse-folder` launches native file dialog, returns selected path

---

## API Endpoints

### GET /api/settings

**Purpose:** Return settings + cards, or `{setup_complete: false}` if no settings exist.

**Response (200) — Setup complete:**
```json
{
  "setup_complete": true,
  "settings": {
    "id": 1,
    "name": "John Doe",
    "dob_day": "09",
    "dob_month": "02",
    "dob_year": "1999",
    "watch_folder": "/path/to/statements",
    "created_at": "2026-01-01T00:00:00",
    "updated_at": "2026-01-01T00:00:00"
  },
  "cards": [
    {"id": "uuid", "bank": "hdfc", "last4": "8087", "name": null}
  ]
}
```

**Response (200) — Not setup:**
```json
{"setup_complete": false}
```

---

### POST /api/settings/setup

**Purpose:** Create settings + cards (one-time). Start folder watcher if watch_folder set.

**Request:**
```json
{
  "name": "John Doe",
  "dob_day": "09",
  "dob_month": "02",
  "dob_year": "1999",
  "watch_folder": "/path/to/statements",
  "cards": [
    {"bank": "hdfc", "last4": "8087", "name": null}
  ]
}
```

**Response (200):**
```json
{
  "status": "success",
  "message": "Setup complete",
  "watcher_started": true
}
```

**Status Codes:**
- `400` — Setup already completed. Use PUT to update.

---

### PUT /api/settings

**Purpose:** Update settings and optionally add cards. Restart folder watcher if watch_folder changed.

**Request:**
```json
{
  "name": "New Name",
  "dob_day": "10",
  "dob_month": "03",
  "dob_year": "2000",
  "watch_folder": "/new/path",
  "cards": [
    {"bank": "icici", "last4": "1234", "name": "ICICI Card"}
  ]
}
```

All fields optional. `cards` adds new cards only (no duplicate bank+last4).

**Response (200):**
```json
{
  "status": "success",
  "message": "Settings updated",
  "cards_added": 1
}
```

**Status Codes:**
- `404` — Setup not completed. Use POST /setup first.

---

### POST /api/settings/browse-folder

**Purpose:** Open native folder picker dialog and return the selected path.

**Response (200):**
```json
{"path": "/Users/john/statements"}
```

**Behavior:**
- **macOS:** `osascript -e 'POSIX path of (choose folder with prompt "Select watch folder")'`
- **Linux:** `zenity --file-selection --directory --title=Select watch folder`
- **Windows:** Not implemented; returns `{"path": ""}`
- **Timeout:** 120 seconds
- **Cancelled:** Returns `{"path": ""}`
- **Error:** Returns `{"path": ""}` (exception caught)

---

## Data Model

### Settings

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PK, autoincrement |
| name | VARCHAR(255) | NOT NULL |
| dob_day | VARCHAR(2) | |
| dob_month | VARCHAR(2) | |
| dob_year | VARCHAR(4) | |
| watch_folder | VARCHAR(1024) | |
| created_at | DATETIME | |
| updated_at | DATETIME | |

### Card

- See card-management.md. Cards created via setup or settings update.

---

## Implementation Details

### Setup Flow

1. Check existing: `db.query(Settings).first()`; if exists → 400
2. Create Settings with name, dob_*, watch_folder
3. For each card in body.cards: create Card(bank=lower, last4=last4[-4:], name)
4. Commit
5. If watch_folder: `start_watcher(watch_folder)`; store observer globally
6. Return success

### Update Flow

1. Get settings; if not exists → 404
2. Update name, dob_*, watch_folder if provided
3. If cards provided: for each, check `(bank, last4) not in existing`; add new only
4. Commit
5. Stop old watcher (if any)
6. If watch_folder: start new watcher
7. Return success with cards_added count

### Folder Browser

- Uses `subprocess.run` with `capture_output=True`, `text=True`, `timeout=120`
- macOS: AppleScript `choose folder`
- Linux: zenity (requires zenity installed)
- Exception: return empty path

---

## Edge Cases

### Invalid Input

| Scenario | Handling |
|---------|----------|
| Setup when already done | 400 "Setup already completed. Use PUT" |
| PUT when not setup | 404 "Use POST /setup first" |
| Empty name | Stored as-is (no validation) |
| Invalid DOB format | Stored as string; no validation |
| Invalid watch_folder path | Stored; watcher may fail to start |

### Duplicate Data

| Scenario | Handling |
|----------|----------|
| Duplicate card (bank+last4) on update | Skip; not added |
| Duplicate card on setup | Both added; unique constraint would fail — cards use unique(bank, last4) |

### Missing Data

| Scenario | Handling |
|----------|----------|
| No settings | GET returns setup_complete: false |
| Cards empty on setup | Valid; no cards |
| zenity not installed (Linux) | subprocess fails; empty path |

### Concurrent Access

| Scenario | Handling |
|----------|----------|
| Setup race | First wins; second gets 400 |
| Update during watcher run | Stop old, start new |

### External Dependencies

| Scenario | Handling |
|----------|----------|
| osascript not found (macOS) | Unlikely; fallback none |
| zenity not found (Linux) | Empty path |
| Dialog timeout | 120s; then exception, empty path |
| User cancels dialog | returncode != 0; empty path |

---

## Error Handling

| Error | HTTP | Response |
|-------|------|----------|
| Setup already done | 400 | "Setup already completed. Use PUT /api/settings to update." |
| Not setup on PUT | 404 | "Setup not completed. Use POST /api/settings/setup first." |

---

## Security Considerations

- **Path:** watch_folder is user-provided; resolved with `expanduser`, `resolve` in watcher
- **DOB/name:** Used for PDF password generation; not logged
- **Folder browser:** Launches system dialog; path returned is user-selected

---

## Testing Strategy

### Existing Tests

- **test_api.py:** `TestSetup` — setup wizard, settings readable, cards registered
- **test_browser.py:** `TestSetupWizard` — redirect to setup or dashboard
- **tests/test_browser.py:** Folder browser not tested

### Recommended Additional Tests

- Setup when already done returns 400
- PUT when not setup returns 404
- Update adds new cards only
- Update restarts watcher
- browse-folder returns path on success (mock subprocess)
- browse-folder returns empty on cancel

---

## Watcher Lifecycle

1. **Startup:** If Settings.watch_folder set, `start_watcher` called; observer stored globally
2. **Setup:** If body.watch_folder, start watcher after commit
3. **Update:** Stop old watcher, start new if watch_folder set
4. **Shutdown:** lifespan yields; stop watcher, shutdown processing queue

---

## Card Addition Logic (Update)

```python
existing = {(c.bank, c.last4) for c in db.query(Card).all()}
for card_in in body.cards:
    bank = card_in.bank.lower()
    last4 = card_in.last4[-4:] if len(card_in.last4) >= 4 else card_in.last4
    if (bank, last4) not in existing:
        db.add(Card(...))
        cards_added += 1
        existing.add((bank, last4))
```

No removal of cards via update; use cards API delete.

---

## Folder Browser Platform Support

| Platform | Tool | Notes |
|----------|------|-------|
| macOS | osascript (AppleScript) | Built-in |
| Linux | zenity | Must be installed (e.g., `apt install zenity`) |
| Windows | (none) | Returns empty path |

---

## DOB Usage

- **Purpose:** PDF password generation (bank-specific formats like NAME4+DDMM)
- **Storage:** dob_day, dob_month, dob_year as strings (2, 2, 4 chars)
- **Validation:** None; invalid values may cause unlock failure

---

## Settings Update Partial Update

Only provided fields are updated. Example: `{"name": "New Name"}` updates only name; watch_folder and cards unchanged.

---

## Single Settings Row

The app assumes a single settings row (`db.query(Settings).first()`). No multi-tenant or multi-user support.

---

## browse-folder Implementation

```python
if system == "Darwin":
    result = subprocess.run(
        ["osascript", "-e", 'POSIX path of (choose folder with prompt "Select watch folder")'],
        capture_output=True, text=True, timeout=120,
    )
    path = result.stdout.strip().rstrip("/") if result.returncode == 0 else ""
elif system == "Linux":
    result = subprocess.run(
        ["zenity", "--file-selection", "--directory", "--title=Select watch folder"],
        capture_output=True, text=True, timeout=120,
    )
    path = result.stdout.strip() if result.returncode == 0 else ""
```

Exception or non-zero returncode yields empty path.

---

## Appendix: Setup vs Update Decision Tree

```
User submits form
       │
       ▼
  GET /api/settings
       │
       ├─► setup_complete: false → POST /api/settings/setup
       │
       └─► setup_complete: true  → PUT /api/settings
```

---

## Appendix: Settings Fields

| Field | Required (Setup) | Editable (Update) |
|-------|------------------|-------------------|
| name | Yes | Yes |
| dob_day | No | Yes |
| dob_month | No | Yes |
| dob_year | No | Yes |
| watch_folder | No | Yes |
| cards | No (can be []) | Add only (no remove) |

---

## Related Documentation

- **docs/plans/card-management.md** — Card creation via setup/update
- **docs/plans/watch-folder.md** — Watcher started from settings
