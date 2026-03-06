# Card Management Feature Plan

**Version:** 1.0  
**Last Updated:** March 2026

---

## Overview

Card management provides CRUD operations for credit cards. Cards are required for statement processing — a statement is only imported if its `bank` and `card_last4` match a registered card. Cards are created during setup or added via settings update; the dedicated cards API provides listing and deletion.

**Key concepts:**
- **Card** = bank + last4 (unique together)
- **Linking:** Statements and transactions reference cards via `bank` + `card_last4`; `Transaction.card_id` links to `Card.id` when resolved
- **Cascade:** Deleting a card deletes associated transactions (and their tags), and statements matching `bank` + `card_last4`

---

## API Endpoints

### GET /api/cards

**Purpose:** List all registered cards.

**Response (200):**
```json
[
  {
    "id": "uuid",
    "bank": "hdfc",
    "last4": "8087",
    "name": null
  }
]
```

---

### DELETE /api/cards/{card_id}

**Purpose:** Delete a card and all associated transactions and statements.

**Response (200):**
```json
{
  "status": "success",
  "message": "Card and associated data deleted"
}
```

**Status Codes:**
- `404` — Card not found

---

## Data Model

### Card

| Column | Type | Constraints |
|--------|------|-------------|
| id | VARCHAR(36) | PK, uuid4 |
| bank | VARCHAR(50) | NOT NULL |
| last4 | VARCHAR(4) | NOT NULL |
| name | VARCHAR(255) | |
| created_at | DATETIME | |
| | | UNIQUE(bank, last4) |

### Statement

- `card_last4` — Matches `Card.last4` for same bank
- No FK to Card; logical link via (bank, last4)

### Transaction

- `card_id` — FK to Card (nullable)
- `bank`, `card_last4` — Denormalized for display/filtering

---

## Implementation Details

### Card Creation

- **Setup:** `POST /api/settings/setup` with `cards: [{bank, last4, name}]`
- **Settings update:** `PUT /api/settings` with `cards: [{bank, last4, name}]` — adds new cards only (no duplicate bank+last4)

### Card Deletion

1. Find card by id
2. Get all transaction IDs for this card
3. Delete `TransactionTag` where `transaction_id IN (txn_ids)`
4. Delete `Transaction` where `card_id == card_id`
5. Delete `Statement` where `bank == card.bank` AND `card_last4 == card.last4`
6. Delete `Card`
7. Commit

### last4 Normalization

- On create: `last4[-4:]` if len >= 4, else as-is
- Stored as 4-char string

### bank Normalization

- Stored lowercase: `bank.lower()`

---

## Edge Cases

### Invalid Input

| Scenario | Handling |
|---------|----------|
| Invalid card_id (delete) | 404 |
| Duplicate (bank, last4) on create | Unique constraint; insert fails (handled in settings) |

### Duplicate Data

| Scenario | Handling |
|----------|----------|
| Same card added twice | Unique constraint on (bank, last4) |

### Missing Data

| Scenario | Handling |
|----------|----------|
| Card not found | 404 |
| No cards | Empty list |

### Concurrent Access

| Scenario | Handling |
|----------|----------|
| Delete card during statement processing | Statement processor may have already resolved card_id; cascade deletes transactions |
| Add card during processing | New statements for that card can be processed |

### Cascade Behavior

| Scenario | Handling |
|----------|----------|
| Delete card | Transactions, TransactionTags, Statements (matching bank+last4) deleted |
| Orphaned transactions | None; card_id FK ensures referential integrity |

---

## Error Handling

| Error | HTTP | Response |
|-------|------|----------|
| Card not found | 404 | "Card not found" |

---

## Security Considerations

- **Card ID:** UUID; not guessable
- **last4:** Only last 4 digits stored; minimal exposure

---

## Testing Strategy

### Existing Tests

- **test_api.py:** `TestSetup` — cards registered via setup
- **test_api.py:** `TestStatementManagement` — delete statement cascades
- Card delete not explicitly tested in test_api

### Recommended Additional Tests

- Delete card cascades to transactions and statements
- List cards returns all
- Delete non-existent card returns 404

---

## Integration Points

### Statement Processing

- Before parsing: `registered_cards = db.query(Card).filter(Card.bank == bank).all()`; if empty, return `card_not_found`
- After parsing: `card = db.query(Card).filter(Card.bank == bank, Card.last4 == card_last4).first()`; if not found, return `card_not_found`
- Transaction creation: `card_id = card.id` when card resolved

### Settings and Setup

- Cards created via `POST /api/settings/setup` and `PUT /api/settings` with `cards` array
- No dedicated "add card" endpoint; use settings update
- Cards are part of settings response

### Analytics and Transactions

- Filter by `card` or `cards` (card UUIDs)
- Card breakdown in analytics uses `(bank, card_last4)` from transactions

---

## Card Lifecycle

1. **Creation:** User completes setup or updates settings with card (bank, last4)
2. **Usage:** Statement processing matches statements to cards; transactions get `card_id`
3. **Listing:** GET /api/cards returns all
4. **Deletion:** DELETE /api/cards/{id} cascades to transactions, tags, statements

---

## Design Decisions

### Why No Card Update?

- Cards are identified by (bank, last4); changing would break statement linkage
- Name is optional display field; could add update in future
- Simpler API: create (via settings) and delete only

### Why Unique (bank, last4)?

- Prevents duplicate registration of same physical card
- Statement processor needs unique match when multiple cards per bank

### Why Cascade Delete?

- Orphaned transactions would have no card context
- Statements for deleted card are no longer relevant
- Clean data model

---

## Future Enhancements

- Card update (name only)
- Card archival (soft delete)
- Card nicknames/aliases
- Card-level spending limits
- Multi-currency support per card

---

## API Request/Response Examples

### List Cards

**Request:** `GET /api/cards`

**Response:**
```json
[
  {"id": "a1b2c3d4-...", "bank": "hdfc", "last4": "8087", "name": null},
  {"id": "e5f6g7h8-...", "bank": "axis", "last4": "9735", "name": "Axis Flip"}
]
```

### Delete Card

**Request:** `DELETE /api/cards/a1b2c3d4-e5f6-7890-abcd-ef1234567890`

**Response (200):**
```json
{"status": "success", "message": "Card and associated data deleted"}
```

**Response (404):**
```json
{"detail": "Card not found"}
```

---

## Database Cascade Details

When a card is deleted:

1. **TransactionTag:** `DELETE FROM transaction_tags WHERE transaction_id IN (SELECT id FROM transactions WHERE card_id = ?)`
2. **Transaction:** `DELETE FROM transactions WHERE card_id = ?`
3. **Statement:** `DELETE FROM statements WHERE bank = ? AND card_last4 = ?`
4. **Card:** `DELETE FROM cards WHERE id = ?`

Order matters for FK constraints; SQLAlchemy handles via `synchronize_session=False` for bulk deletes.

---

## Card Creation via Setup

**Request:** `POST /api/settings/setup`

```json
{
  "name": "John Doe",
  "dob_day": "09",
  "dob_month": "02",
  "dob_year": "1999",
  "watch_folder": null,
  "cards": [
    {"bank": "hdfc", "last4": "8087", "name": null},
    {"bank": "hdfc", "last4": "1234", "name": "HDFC Regalia"}
  ]
}
```

Cards are created with `bank.lower()`, `last4[-4:]`. Name is optional.

---

## Card Creation via Settings Update

**Request:** `PUT /api/settings`

```json
{
  "cards": [
    {"bank": "icici", "last4": "5678", "name": "ICICI Amazon"}
  ]
}
```

Only adds cards not already present (by bank+last4). Returns `cards_added` count.

---

## Appendix: Card Data Flow

```
Setup/Settings Update
        │
        ▼
   Create Card(s)
   (bank, last4, name)
        │
        ▼
   Statement Upload
        │
        ▼
   process_statement
        │
        ├─► No cards for bank? → card_not_found
        │
        ├─► Parse PDF → card_last4
        │
        ├─► Match Card(bank, last4)? → card_not_found if no match
        │
        └─► Create Statement + Transactions (card_id = card.id)
        │
        ▼
   Analytics/Transactions
   Filter by card_id
```

---

## Appendix: Supported Banks for Cards

Cards can be registered for any bank. Statement processing supports:
hdfc, icici, axis, sbi, amex, idfc_first, indusind, kotak, sc, yes, au, rbl, federal, indian_bank.

Cards for other banks (e.g., "custom_bank") would not receive statements until a parser is added.

---

## Troubleshooting

**"Card not found" on statement upload:**
- Ensure card is registered via setup or settings
- Check bank and last4 match (case-insensitive for bank)
- For multiple cards per bank, parser must extract card_last4

**Card not in list after setup:**
- Verify cards array in request
- Check for duplicate (bank, last4) — may be silently skipped on update
