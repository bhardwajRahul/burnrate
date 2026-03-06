# Analytics Feature Plan

**Version:** 1.0  
**Last Updated:** March 2026

---

## Overview

The analytics feature provides aggregated spend data for the Burnrate dashboard and analytics pages. It computes:

1. **Summary** — Total net spend, delta vs prior period, sparkline, card breakdown, credit limit, average monthly spend
2. **Category breakdown** — Amount and percentage per category, sorted descending
3. **Trends** — Monthly net spend aggregation (debits − credits, excluding cc_payment)
4. **Merchants** — Top merchants by spend, sorted descending
5. **Statement periods** — List of distinct statement periods with net spend per period

All endpoints accept common filter parameters: `from`, `to`, `cards`, `categories`, `tags`, `direction`, `amount_min`, `amount_max`.

**Net spend formula (single source of truth):**
```
net = sum(debits, category != cc_payment) − sum(credits, category != cc_payment)
```

CC payment transactions are excluded entirely. Legitimate refunds/reversals (credits with any other category) reduce net spend.

---

## API Endpoints

### GET /api/analytics/summary

**Purpose:** Total spend, delta %, sparkline, card breakdown, credit limit, avg monthly spend.

**Query Params:**
- `from` (date): Start of date range
- `to` (date): End of date range
- `cards` (string): Comma-separated card UUIDs
- `categories` (string): Comma-separated category slugs
- `direction` (string): `incoming` or `outgoing`
- `amount_min` (float)
- `amount_max` (float)
- `tags` (string): Comma-separated tag names

**Response (200):**
```json
{
  "totalSpend": 45000.0,
  "deltaPercent": 12,
  "deltaLabel": "vs last month",
  "period": "This month",
  "sparklineData": [{"value": 12000}, {"value": 15000}, {"value": 18000}],
  "cardBreakdown": [
    {"bank": "hdfc", "last4": "8087", "amount": 30000, "count": 25}
  ],
  "creditLimit": 100000.0,
  "avgMonthlySpend": 42000.0,
  "monthsInRange": 1
}
```

**Delta logic:**
- If `from` and `to` provided: Compare selected period to equivalent prior period (same span in days)
- Else: Compare "this month to date" vs "last month"

---

### GET /api/analytics/categories

**Purpose:** Category breakdown with amounts and percentages.

**Query Params:** Same as summary.

**Response (200):**
```json
{
  "breakdown": [
    {
      "category": "food",
      "amount": 8000,
      "percentage": 17.8,
      "count": 45
    }
  ]
}
```

---

### GET /api/analytics/trends

**Purpose:** Monthly net spend aggregation.

**Query Params:**
- `months` (int, default 12, range 1–24): Number of months to include

**Response (200):**
```json
{
  "trends": [
    {"month": "2025-10", "spend": 12000.0},
    {"month": "2025-11", "spend": 15000.0}
  ]
}
```

---

### GET /api/analytics/merchants

**Purpose:** Top merchants by spend.

**Query Params:** Same as summary, plus:
- `limit` (int, default 10, range 1–50): Max merchants to return

**Response (200):**
```json
{
  "merchants": [
    {"merchant": "SWIGGY", "amount": 5000.0, "count": 25}
  ]
}
```

---

### GET /api/analytics/statement-periods

**Purpose:** All statement periods with net spend computed per period.

**Query Params:**
- `from` (date)
- `to` (date)

**Response (200):**
```json
{
  "periods": [
    {
      "bank": "hdfc",
      "cardLast4": "8087",
      "periodStart": "2026-01-01",
      "periodEnd": "2026-01-31",
      "totalAmountDue": 45000.0,
      "totalSpend": 45000.0,
      "creditLimit": 100000.0
    }
  ]
}
```

---

## Data Model

### Tables Used

- **Transaction** — Primary source for spend calculations
- **Statement** — For statement periods, credit limit
- **TransactionTag** — For tag filtering

### Key Fields

- `Transaction.type`: `debit` or `credit`
- `Transaction.category`: Exclude `cc_payment` from net spend
- `Transaction.amount`, `Transaction.date`, `Transaction.merchant`
- `Transaction.card_id`, `Transaction.bank`, `Transaction.card_last4`

---

## Implementation Details

### Filter Parsing

`_parse_filter_params(cards, categories, direction, amount_min, amount_max, tags)`:
- `cards`: Split by comma, strip, filter empty → list of UUIDs
- `categories`: Same → list of slugs
- `tags`: Same → list of tag names
- `direction`: `incoming` → type=credit, `outgoing` → type=debit

### compute_net_spend

**Signature:** `compute_net_spend(db, from_date, to_date, bank, card_last4, card_ids, categories, direction, amount_min, amount_max, tags) -> float`

**Logic:**
1. Base query: `SUM(CASE WHEN type='debit' THEN amount ELSE -amount END)` WHERE `category != 'cc_payment'`
2. Apply date filter: `date >= from_date`, `date <= to_date`
3. Apply bank, card_last4, card_ids
4. Apply `_apply_filters`: card_ids, categories, direction, amount_min, amount_max, tags
5. Return rounded to 2 decimal places

### get_summary

1. `total = compute_net_spend(...)` with all filters
2. Per-card: `GROUP BY bank, card_last4` with same filters; `SUM(CASE...)` per group
3. Return `{total_spend, card_breakdown}`

### get_category_breakdown

1. Query: `Transaction.category`, `SUM(amount)`, `COUNT(id)` WHERE `category != 'cc_payment'`
2. Filter by direction: incoming → type=credit, else type=debit
3. Apply date and other filters
4. `GROUP BY category`
5. Compute total, then percentage per category
6. Return `{total, categories}` with amount, percentage, count

### get_monthly_trends

1. `end = date.today()`, `start = end - timedelta(days=months*31)`
2. Query: `strftime('%Y-%m', date)` as month, `SUM(CASE...)` as spend
3. Filter: `category != 'cc_payment'`, `date >= start`, `date <= end`
4. `GROUP BY month`, `ORDER BY month`
5. Return list of `{month, spend}`

### get_top_merchants

1. Query: `Transaction.merchant`, `SUM(amount)`, `COUNT(id)` WHERE `category != 'cc_payment'`
2. Filter by direction (incoming vs outgoing)
3. Apply date and other filters
4. `GROUP BY merchant`, `ORDER BY SUM(amount) DESC`, `LIMIT limit`
5. Return list of `{merchant, spend, count}`

### Summary Delta Calculation

- **With from/to:** `span = (to - from).days`; `prev_end = from - 1 day`; `prev_start = prev_end - span`; compare current period spend vs prev period
- **Without from/to:** Current = this month to date; Previous = last full month
- `delta = (current - prev) / prev * 100` if prev > 0, else 0

### Credit Limit Aggregation

- Query `Statement` where `credit_limit IS NOT NULL`
- Group by `(bank, card_last4)`; keep most recent (max `period_end`, then `imported_at`)
- Sum credit limits across cards (avoid double-counting shared limits)

### _months_in_range

- If no from/to: return 1
- Else: `(to.year - from.year) * 12 + (to.month - from.month) + 1`, min 1

---

## Edge Cases

### Invalid Input

| Scenario | Handling |
|---------|----------|
| Invalid date format | FastAPI validation; 422 |
| Invalid cards UUID | Filter returns no match; empty result |
| Invalid category slug | Filter returns no match |
| direction not incoming/outgoing | No filter applied |
| amount_min > amount_max | Possible empty result |
| months out of range | Query validation: ge=1, le=24 |
| limit out of range | Query validation: ge=1, le=50 |

### Duplicate Data

| Scenario | Handling |
|----------|----------|
| Same transaction in multiple statements | Not possible; one statement per transaction |
| Duplicate merchants | Grouped by merchant name; sum amounts |

### Missing Data

| Scenario | Handling |
|----------|----------|
| No transactions in range | totalSpend=0, empty breakdown, empty merchants |
| No statements | creditLimit=0, empty periods |
| Empty cards filter | No card filter applied |
| Empty categories filter | No category filter applied |

### Concurrent Access

| Scenario | Handling |
|----------|----------|
| Read during statement processing | SQLite WAL; reads see consistent snapshot |
| Multiple analytics requests | Each gets own session; no locking |

### Large Datasets

| Scenario | Handling |
|----------|----------|
| Many transactions | Aggregation in DB; no full load |
| Long date range | Filter reduces dataset |
| Many categories | All returned; no limit |

### Division by Zero

| Scenario | Handling |
|----------|----------|
| prev_spend = 0 in delta | delta = 0 |
| total = 0 in percentage | percentage = 0 |

### SQL LIKE Injection (Search)

- Search is in transactions endpoint, not analytics
- N/A for analytics

---

## Error Handling

| Error | HTTP | Handling |
|-------|------|----------|
| Invalid date | 422 | FastAPI validation |
| Invalid query param type | 422 | FastAPI validation |
| DB error | 500 | Unhandled; propagates |

---

## Security Considerations

- **Input validation:** Dates, numbers validated by FastAPI
- **SQL injection:** SQLAlchemy ORM; parameterized queries
- **No user input in raw SQL:** All filters via ORM

---

## Testing Strategy

### Existing Tests

- **test_api.py:** `TestAnalytics` — summary, card breakdown, categories, merchants, trends, statement periods

### Recommended Additional Tests

- Summary with no transactions
- Summary with from/to vs without
- Delta when prev_spend = 0
- Category breakdown with single category
- Trends with empty data
- Merchants limit
- Filter by tags
- Filter by amount range

---

## Net Spend Formula (Detailed)

The net spend is the single source of truth for "how much did I spend" in Burnrate:

```
net_spend = Σ(debit amounts) − Σ(credit amounts)
```

Where:
- **Included:** All transactions matching the filter (date, cards, categories, tags, direction, amount range)
- **Excluded:** Transactions with `category = 'cc_payment'` (bill payments, repayments)
- **Debits:** `type = 'debit'` (purchases, fees)
- **Credits:** `type = 'credit'` (refunds, reversals, cashback — but NOT cc_payment)

**Rationale:** CC payment transactions represent money moving from bank account to pay the card; they are not "spend" in the sense of consumption. Refunds and reversals (credits with category ≠ cc_payment) reduce actual spend.

---

## Filter Application Order

1. Date range (from, to)
2. Card filter (card or cards)
3. Category filter (categories)
4. Direction (incoming/outgoing)
5. Amount range (amount_min, amount_max)
6. Tags (transaction must have ALL specified tags)

All filters are ANDed together.

---

## Category Breakdown Direction Handling

- **direction = "incoming":** Only credit transactions; shows where money came from (refunds, etc.)
- **direction = "outgoing" or unset:** Only debit transactions; shows where money went
- **direction = null:** Default is debits for spend analysis

---

## Credit Limit Aggregation Logic

Statements may have multiple entries per card (different periods). To avoid double-counting:
1. Group by (bank, card_last4)
2. For each group, keep the most recent statement (max period_end, then imported_at)
3. Sum credit_limit across groups
4. Assumption: Each card has one credit limit; multiple statements for same card report same limit

---

## Sparkline Data

- Source: `get_monthly_trends(db, months=6)`
- Returns last 6 months of net spend
- Used for mini chart on dashboard
- If empty: `[{"value": 0}]`

---

## Statement Periods Net Spend

For each statement, net spend is computed via `compute_net_spend(db, period_start, period_end, bank=s.bank, card_last4=s.card_last4)` — not from `Statement.total_spend` (which is sum of debits only). This gives accurate net (debits − credits) per period.

---

## Performance Considerations

- **Aggregations:** All done in SQL; no full table load
- **Indexes:** Consider index on (date, category, card_id) for common filter combinations
- **Large date ranges:** Filter reduces dataset; no pagination on analytics

---

## API Request Examples

### Summary with Filters

```
GET /api/analytics/summary?from=2026-01-01&to=2026-01-31&cards=uuid1,uuid2&direction=outgoing
```

### Categories for Specific Cards

```
GET /api/analytics/categories?cards=uuid1,uuid2,uuid3&categories=food,shopping,travel
```

### Top 20 Merchants

```
GET /api/analytics/merchants?limit=20&from=2026-01-01
```

### Trends for 24 Months

```
GET /api/analytics/trends?months=24
```

---

## Response Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| totalSpend | float | Net spend (debits − credits) excluding cc_payment |
| deltaPercent | int | Percentage change vs comparison period |
| deltaLabel | string | "vs last month" or "vs prior period" |
| period | string | "This month" (when no from/to) |
| sparklineData | array | Last 6 months spend for mini chart |
| cardBreakdown | array | Per-card net spend and count |
| creditLimit | float | Sum of most recent limits per card |
| avgMonthlySpend | float | totalSpend / monthsInRange |
| monthsInRange | int | Calendar months in filter range |

---

## Appendix: SQL Query Patterns

### compute_net_spend (Simplified)

```sql
SELECT SUM(CASE WHEN type='debit' THEN amount ELSE -amount END)
FROM transactions
WHERE category != 'cc_payment'
  AND date >= ? AND date <= ?
  AND (card_id IN (?) OR ?)
  AND (category IN (?) OR ?)
  ...
```

### get_category_breakdown

```sql
SELECT category, SUM(amount) as amount, COUNT(*) as count
FROM transactions
WHERE category != 'cc_payment' AND type = 'debit'
  AND date >= ? AND date <= ?
GROUP BY category
```

### get_monthly_trends

```sql
SELECT strftime('%Y-%m', date) as month, SUM(CASE WHEN type='debit' THEN amount ELSE -amount END) as spend
FROM transactions
WHERE category != 'cc_payment' AND date >= ? AND date <= ?
GROUP BY month
ORDER BY month
```

---

## Related Documentation

- **docs/plans/transaction-management.md** — Transaction filters and data source
- **docs/plans/statement-processing.md** — How transactions are created
- **docs/architecture.md** — System overview and data flow
