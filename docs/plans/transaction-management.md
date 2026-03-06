# Transaction Management Feature Plan

**Version:** 1.0  
**Last Updated:** March 2026

---

## Overview

Transaction management provides listing, filtering, search, pagination, and tagging of credit card transactions. Transactions are created during statement processing and are the primary data for analytics. The backend exposes:

1. **Listing** — GET /api/transactions with filters and pagination
2. **Filtering** — By card, date range, category, search, tags, direction, amount range
3. **Search** — Full-text search on merchant and description (SQL LIKE with escaped wildcards)
4. **Pagination** — limit (1–500), offset
5. **Tagging** — Get/update tags per transaction (max 3 tags, 10 chars each)
6. **CSV Export** — Client-side only; frontend fetches filtered transactions and generates CSV

---

## API Endpoints

### GET /api/transactions

**Purpose:** Query transactions with filters. Returns paginated list plus total count and total amount.

**Query Params:**
- `card` (string): Filter by single card UUID
- `cards` (string): Comma-separated card UUIDs (overrides `card` if both present)
- `from` (date): Start date (inclusive)
- `to` (date): End date (inclusive)
- `category` (string): Filter by category slug
- `search` (string): Search in merchant and description (case-insensitive LIKE)
- `tags` (string): Comma-separated tag names; transaction must have ALL tags
- `direction` (string): `incoming` (credit) or `outgoing` (debit)
- `amount_min` (float): Minimum amount
- `amount_max` (float): Maximum amount
- `limit` (int, default 100, range 1–500): Page size
- `offset` (int, default 0, ge 0): Pagination offset

**Response (200):**
```json
{
  "transactions": [
    {
      "id": "uuid",
      "statementId": "uuid",
      "date": "2026-01-15",
      "merchant": "SWIGGY",
      "amount": 450.0,
      "type": "debit",
      "category": "food",
      "description": null,
      "bank": "hdfc",
      "cardLast4": "8087",
      "cardId": "uuid",
      "tags": ["work"]
    }
  ],
  "total": 150,
  "totalAmount": 45000.0
}
```

**Notes:**
- `total`: Count of transactions matching filters, excluding `cc_payment` from aggregate
- `totalAmount`: Net spend (debits − credits) for filtered set, excluding `cc_payment`
- Transactions in list include `cc_payment`; only aggregate metrics exclude them

---

### GET /api/transactions/{transaction_id}/tags

**Purpose:** Return tags for a transaction.

**Response (200):**
```json
{"tags": ["work", "reimbursable"]}
```

**Status Codes:**
- `200` — Always (empty list if no tags)

---

### PUT /api/transactions/{transaction_id}/tags

**Purpose:** Replace tags for a transaction. Max 3 tags, each max 10 chars.

**Request:**
```json
{"tags": ["work", "reimbursable"]}
```

**Response (200):**
```json
{"tags": ["work", "reimbursable"]}
```

**Status Codes:**
- `400` — More than 3 tags
- `404` — Transaction not found

---

## Data Model

### Transaction

| Column | Type | Constraints |
|--------|------|-------------|
| id | VARCHAR(36) | PK |
| statement_id | VARCHAR(36) | FK → statements.id ON DELETE CASCADE |
| date | DATE | NOT NULL |
| merchant | VARCHAR(512) | NOT NULL |
| amount | FLOAT | NOT NULL |
| type | VARCHAR(20) | NOT NULL (debit/credit) |
| category | VARCHAR(50) | NOT NULL |
| description | TEXT | |
| card_id | VARCHAR(36) | FK → cards.id |
| bank | VARCHAR(50) | |
| card_last4 | VARCHAR(4) | |
| created_at | DATETIME | |

### TransactionTag

| Column | Type | Constraints |
|--------|------|-------------|
| id | VARCHAR(36) | PK |
| transaction_id | VARCHAR(36) | FK → transactions.id ON DELETE CASCADE |
| tag | VARCHAR(12) | NOT NULL |
| created_at | DATETIME | |

---

## Implementation Details

### Filter Logic

1. **cards:** Split by comma, strip; filter `Transaction.card_id.in_(card_ids)`
2. **card:** Single card filter; `Transaction.card_id == card`
3. **from_date:** `Transaction.date >= from_date`
4. **to_date:** `Transaction.date <= to_date`
5. **category:** `Transaction.category == category`
6. **direction:** `incoming` → `type == 'credit'`; `outgoing` → `type == 'debit'`
7. **search:** `_escape_like(search)`; then `merchant ILIKE %escaped%` OR `description ILIKE %escaped%` with `escape='\'`
8. **tags:** Subquery `TransactionTag.transaction_id` WHERE `tag IN (tag_names)`; filter `Transaction.id IN (subquery)` — requires ALL tags
9. **amount_min:** `Transaction.amount >= amount_min`
10. **amount_max:** `Transaction.amount <= amount_max`

### _escape_like

**Purpose:** Prevent SQL LIKE wildcard injection. User input may contain `%`, `_`, `\`.

**Logic:**
- Replace `\` → `\\`
- Replace `%` → `\%`
- Replace `_` → `\_`
- Use `escape='\'` in SQLAlchemy `ilike()`

### Total Amount Calculation

- Base query with all filters
- `filtered_ids = q.with_entities(Transaction.id)` — get IDs of matching transactions
- `metrics_q = q.filter(Transaction.category != 'cc_payment')` — exclude cc_payment
- `total_count = metrics_q.count()`
- `total_amount = SUM(CASE WHEN type='debit' THEN amount ELSE -amount END)` WHERE `category != 'cc_payment'` AND `id IN filtered_ids`
- Round to 2 decimal places

### Tag Update

1. Validate: `len(payload.tags) > 3` → 400
2. Validate each tag: `str(t).strip()[:10]`; skip empty; max 3
3. Delete existing `TransactionTag` for transaction
4. Insert new tags
5. Commit

### CSV Export

- **Backend:** No dedicated CSV endpoint
- **Frontend:** `Transactions.tsx` fetches filtered transactions (possibly paginated; for export, may need to fetch all or use a higher limit), builds CSV string client-side, triggers download via `showSaveFilePicker` or `<a download>`

---

## Edge Cases

### Invalid Input

| Scenario | Handling |
|---------|----------|
| Invalid card UUID | No match; empty or filtered result |
| Invalid date format | FastAPI 422 |
| Empty search string | No search filter applied |
| limit > 500 | Query validation: le=500 |
| limit < 1 | Query validation: ge=1 |
| offset < 0 | Query validation: ge=0 |
| tags payload > 3 | HTTP 400 "Maximum 3 tags allowed" |
| Tag > 10 chars | Truncated to 10 |

### Duplicate Data

| Scenario | Handling |
|----------|----------|
| Duplicate tags in payload | Deduplicated by validation (strip, unique) |
| Same tag twice | Stored once per transaction (TransactionTag allows multiple rows; uniqueness not enforced per transaction) |

### Missing Data

| Scenario | Handling |
|----------|----------|
| Transaction not found (tags) | HTTP 404 |
| No transactions match filters | Empty list, total=0, totalAmount=0 |
| card_id null on transaction | Excluded from card filter match |

### Concurrent Access

| Scenario | Handling |
|----------|----------|
| Update tags during list | Each request gets own session; last write wins |
| Delete statement | Cascade deletes transactions and tags |

### Large Datasets

| Scenario | Handling |
|----------|----------|
| Many transactions | Pagination; max limit 500 |
| CSV export of large set | Frontend fetches in chunks or with high limit; may be slow |

### SQL LIKE Injection

| Scenario | Handling |
|----------|----------|
| search = "%" | Escaped to `\%`; matches literal % |
| search = "_" | Escaped to `\_` |
| search = "\\" | Escaped to `\\\\` |

---

## Error Handling

| Error | HTTP | Response |
|-------|------|----------|
| Transaction not found | 404 | `{"detail": "Transaction not found"}` |
| Too many tags | 400 | `{"detail": "Maximum 3 tags allowed"}` |
| Invalid query params | 422 | FastAPI validation error |

---

## Security Considerations

- **Search:** `_escape_like` prevents LIKE wildcard injection
- **Tags:** Max 3, 10 chars; strip and truncate
- **Card IDs:** Passed as query params; validated by DB (no match = filter only)

---

## Testing Strategy

### Existing Tests

- **test_api.py:** `TestTransactions` — list all, filter by card, filter by type, filter by date, pagination, search
- **test_api.py:** `TestTags` — create tag, list tags, assign to transaction, delete tag

### Recommended Additional Tests

- Filter by tags (single and multiple)
- Filter by amount range
- Search with special chars (%, _)
- Tag update with 3 tags, 4 tags
- Tag truncation at 10 chars
- totalAmount excludes cc_payment
- Pagination edge cases (offset beyond total)

---

## CSV Export (Client-Side)

The backend does not provide a CSV export endpoint. The frontend (`Transactions.tsx`) implements export by:

1. Fetching transactions with current filters (may use high limit or paginate)
2. Building CSV string: header row + data rows
3. Triggering download via `showSaveFilePicker` (File System Access API) or `<a download>`
4. Warning: "Do not save this file in your statements watch folder to avoid re-processing"

**Columns typically exported:** Date, Merchant, Amount, Type, Category, Bank, Card Last4, Tags

---

## Tag vs TagDefinition

- **TransactionTag:** Links transaction to a tag string (stored per transaction)
- **TagDefinition:** Optional master list of tag names (for UI autocomplete)
- Transaction tags are free-form strings (max 10 chars); no requirement to match TagDefinition
- Filter by tags: matches `TransactionTag.tag` IN (provided names)

---

## Search Behavior

- **Case-insensitive:** `ilike` for merchant and description
- **Substring:** `%search%` — matches anywhere in field
- **Multiple words:** Treated as single substring (e.g., "amazon pay" matches "AMAZON PAY INDIA")
- **Special chars:** Escaped for LIKE (%, _, \)

---

## Total vs TotalAmount

- **total:** Count of transactions in filtered set, excluding cc_payment from the count used for aggregate
- **totalAmount:** Net spend (debits − credits) for filtered set, excluding cc_payment
- **transactions:** List includes cc_payment transactions; they appear in the list but not in total/totalAmount

---

## Pagination Semantics

- **limit:** Max rows returned (1–500)
- **offset:** Skip first N rows
- **total:** Total matching rows (for "showing X of Y")
- **Order:** `Transaction.date DESC` (newest first)

---

## API Request Examples

### List with All Filters

```
GET /api/transactions?cards=uuid1,uuid2&from=2026-01-01&to=2026-01-31&category=food&search=swiggy&tags=work,reimbursable&direction=outgoing&amount_min=100&amount_max=5000&limit=50&offset=0
```

### Update Tags

**Request:** `PUT /api/transactions/{id}/tags`

```json
{"tags": ["work", "reimbursable", "q4"]}
```

Max 3 tags; each truncated to 10 chars.

---

## Transaction Response Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| id | string | UUID |
| statementId | string | Parent statement |
| date | string | ISO date |
| merchant | string | Merchant/description |
| amount | float | Transaction amount |
| type | string | "debit" or "credit" |
| category | string | Category slug |
| description | string | Raw description |
| bank | string | Bank identifier |
| cardLast4 | string | Last 4 of card |
| cardId | string | Card UUID (if resolved) |
| tags | array | Tag strings |

---

## Appendix: Filter Combination Examples

| Use Case | Params |
|----------|--------|
| All HDFC transactions | cards={hdfc card uuid} |
| January 2026 spend | from=2026-01-01, to=2026-01-31 |
| Food only | category=food |
| Search "amazon" | search=amazon |
| Reimbursable | tags=reimbursable |
| Large purchases | amount_min=10000 |
| Credits only | direction=incoming |
| Multi-card | cards=uuid1,uuid2,uuid3 |

---

## Appendix: Tag Validation Rules

- Max 3 tags per transaction
- Each tag max 10 characters (truncated)
- Empty tags stripped
- No duplicate check (same tag twice stored as two rows — consider dedup)

---

## Related Documentation

- **docs/plans/statement-processing.md** — Transaction creation
- **docs/plans/analytics.md** — Uses same filters
- **docs/plans/category-system.md** — Category values
