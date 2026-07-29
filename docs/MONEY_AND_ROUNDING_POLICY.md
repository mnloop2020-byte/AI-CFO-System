# AI CFO System — Money and Rounding Policy

Date: 2026-07-28

Status: Controlled Pilot policy.

## 1. Scope

All financial amounts in the Pilot use:

- Two fixed decimal places.
- Python `Decimal` for validation, calculations, and business logic.
- `ROUND_HALF_UP` for quantization.
- PostgreSQL `numeric`/`decimal` columns.
- Canonical JSON strings such as `"1234.50"` at API response boundaries.
- A server-calculated source of truth for derived totals.

Currency-specific minor units are Post-Pilot. The Pilot does not yet support
zero-decimal currencies such as JPY or three-decimal currencies such as KWD.
The configured currency is a display and reporting context; it does not
change the two-decimal calculation policy.

## 2. Monetary fields

The following are money and must follow this policy:

| Domain | Fields |
| --- | --- |
| Sales | `unit_price`, `total_amount`, completed revenue and status totals |
| Expenses | `amount`, category totals and review thresholds |
| Inventory | `cost_price`, `selling_price`, cost/selling valuation, estimated replenishment cost |
| Invoices | `total_amount`, `vat_amount`, subtotal, outstanding value |
| Company | `opening_balance`, financial amount thresholds |
| Actions | `financial_impact`, linked/open/collected value |
| Reports/agents | Revenue, expenses, operating result, cash movement, VAT, inventory valuation |

The following numeric values are not money and may remain `float` where
appropriate:

- RAG similarity scores.
- AI confidence/acceptance ratios.
- Timeouts and durations.
- PDF coordinates, dimensions, font sizes, and line spacing.
- File sizes and percentage metrics.

Quantities, reorder levels, counts, days, and fiscal months remain integers.

## 3. Canonical representation

### Python

Financial values are `Decimal` and are quantized to `Decimal("0.01")` with
`ROUND_HALF_UP`.

Examples:

| Input | Canonical amount |
| --- | --- |
| `0.1 + 0.2` using Decimal operands | `0.30` |
| `1.004` | `1.00` |
| `1.005` | `1.01` |
| `-1.005` where negatives are allowed | `-1.01` |
| `1000000000` | `1000000000.00` |

Never construct money with `Decimal(binary_float)`; parse external values
through their decimal text representation.

### PostgreSQL

Live schema inspection reports the existing Sales, Expenses, Inventory,
Invoices, Company opening balance, and Action impact columns as PostgreSQL
`numeric`. Application writes use canonical two-decimal strings.

No database type migration is required by the evidence available at the start
of this phase. A future migration must not reduce precision or round existing
data without a separate snapshot and explicit approval.

### JSON/API

Sensitive monetary response fields are serialized as fixed two-decimal
strings:

```json
{
  "unit_price": "10.00",
  "total_amount": "20.00"
}
```

Requests accept decimal strings. Numeric request values may remain temporarily
accepted for compatibility, but the official frontend sends strings.

### Frontend

- Form state keeps raw decimal text until validation/submission.
- Exact calculations use integer minor units (`bigint` cents), not binary
  floating-point arithmetic.
- API money types are strings.
- Formatting never changes stored or submitted values.

## 4. Validation and negative-value policy

| Field | Negative allowed? | Zero allowed? |
| --- | ---: | ---: |
| Sale unit price | No | Yes |
| Sale total | No | Yes when unit price is zero |
| Expense amount | No | No |
| Inventory cost/selling price | No | Yes |
| Invoice total/VAT | No | Yes |
| Company financial thresholds | No | Yes |
| Company opening balance | Yes | Yes |
| Action financial impact | Preserve domain rule; current generated impacts are non-negative | Yes/nullable |

VAT must not exceed the invoice total. Invoice amounts are user-entered source
facts because the current product has no invoice line-item model; the server
quantizes and validates them but must not claim to derive them from missing
line items. Sales totals are derived by the server from quantity and unit
price, and any client-supplied total remains rejected.

## 5. Rounding boundaries

Round only at defined monetary boundaries:

1. On external request validation.
2. After multiplication or division that produces a monetary result.
3. Before database persistence.
4. Before monetary JSON serialization.

Do not repeatedly convert between `Decimal` and `float`. Aggregations sum
quantized `Decimal` values and quantize the final result once.

## 6. Money Flow Map

### Audited application boundaries

| Boundary | Input/source | Pilot representation | Authoritative operation |
| --- | --- | --- | --- |
| CRM forms | User-entered decimal text | TypeScript string | Validate and normalize before the request |
| Sales API | Quantity + unit price | `int` + `Decimal` | Backend derives `total_amount` |
| Expense API | Recorded expense | `Decimal` | Backend validates positive amount |
| Inventory API | Quantity + prices | `int` + `Decimal` | Backend valuations multiply exact price by integer quantity |
| Invoice API | Total + invoiced VAT | `Decimal` | Backend quantizes and enforces VAT not above total |
| Company settings | Opening balance + thresholds | `Decimal` | Backend validates domain and threshold ordering |
| PostgreSQL/PostgREST | Live financial columns | PostgreSQL `numeric` | Canonical two-decimal strings are written and parsed |
| Deterministic tools | CRM response models | `Decimal` | Sales, accounting, cash flow, inventory, tax, and fraud calculations |
| Action Center | Source records + thresholds | `Decimal` | Detection and impact calculations; strings at JSON/storage boundaries |
| Agents | Deterministic tool facts | Decimal values serialized as text | LLM explains facts but does not calculate authoritative totals |
| Invoice PDF | Validated invoice/company data | `Decimal` | Subtotal, VAT, and total formatted from server values |
| Dashboard/KPIs | API monetary strings | `bigint` minor units | Exact sum/subtract/multiply/compare before localized display |

The audit found and converted monetary `float`/JavaScript `number` use in the
CRM schemas, stores, deterministic tools, Action Engine, invoice PDF service,
CRM forms/tables, module KPI pages, dashboard, cash-flow card, settings, and
Action Center. Remaining floating-point uses are deliberately non-monetary:
RAG similarity, timeouts/durations, PDF geometry, file-size display, and
percentage/ratio presentation. Counts, quantities, days, months, and reorder
levels remain integers.

### Previous flow

```text
HTML number input
→ JavaScript number
→ JSON number
→ Pydantic float
→ Python float calculations
→ PostgreSQL numeric
→ PostgREST JSON number
→ Python float conversion
→ Agent/PDF float calculations
→ JSON number
→ JavaScript Number(...) KPI aggregation
```

### Pilot target flow

```text
HTML decimal text input
→ validated canonical decimal string
→ JSON string
→ Pydantic Decimal + ROUND_HALF_UP
→ Decimal business calculations
→ canonical two-decimal string written to PostgreSQL numeric
→ Decimal reconstructed from PostgREST value through decimal text
→ Decimal deterministic tools/PDF/agent facts
→ fixed two-decimal JSON string
→ frontend bigint minor-unit calculations
→ localized display
```

## 7. Server source-of-truth rules

- Sales `total_amount` is always recalculated from `quantity × unit_price`.
- Frontend cannot submit a Sales total.
- Invoice total/VAT are validated source inputs until invoice line items exist.
- Dashboard, reports, Action Center, and agents calculate from server-verified
  records, not frontend aggregates.
- LLM output never performs authoritative money calculations.
- PDF values come from server-verified Decimal data.

## 8. Required regression coverage

- Exact `0.1 + 0.2 = 0.30`.
- `ROUND_HALF_UP` above and below the half-cent.
- More than two decimal places.
- Negative-value rejection and allowed negative opening balance.
- Zero-value domain rules.
- Very small and maximum accepted amounts.
- VAT cannot exceed invoice total.
- Server-calculated Sales total.
- Decimal JSON serialization/deserialization.
- Deterministic agent and report calculations.
- Invoice PDF and frontend KPI display.
- Arabic/English number presentation.

## 9. Known Pilot limitation

All currencies use two decimal places. Currency-specific precision, foreign
exchange, conversion rates, and multi-currency ledgers are explicitly
Post-Pilot and must not be advertised as current capabilities.
