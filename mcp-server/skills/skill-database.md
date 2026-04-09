# AgentOffice — Agent Skill: Working with Databases

## Overview

AgentOffice databases are structured data tables similar to Airtable or NocoDB. Each table has typed columns, and data is accessed through rows. Databases support relationships between tables, computed fields, and multiple view types.

## Column Types (25 Types)

### Text Types
| Type | Description | Notes |
|------|-------------|-------|
| SingleLineText | Short text field | Default column type |
| LongText | Multi-line text | Supports longer content |
| Email | Email address | Validated format |
| URL | Web URL | Clickable link |
| PhoneNumber | Phone number | Text with phone formatting |

### Number Types
| Type | Description | Notes |
|------|-------------|-------|
| Number | Integer or decimal | General purpose |
| Decimal | Precise decimal | Configurable decimal places |
| Currency | Monetary value | 10 currencies: USD, CNY, EUR, GBP, AUD, CAD, SGD, KRW, INR, JPY |
| Percent | Percentage | Displayed as % |
| Rating | Star/icon rating | 1-10 scale, multiple icon styles (star, heart, fire, etc.) |
| AutoNumber | Auto-incrementing | System-managed, read-only |

### Date & Time Types
| Type | Description | Notes |
|------|-------------|-------|
| Date | Calendar date | Formats: YYYY/MM/DD, YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY |
| DateTime | Date + time | Same date formats + HH:mm |

### Selection Types
| Type | Description | Notes |
|------|-------------|-------|
| Checkbox | Boolean toggle | True/false |
| SingleSelect | One option from list | Color-coded options |
| MultiSelect | Multiple options | Color-coded, multiple selections |

### Relationship & Computed Types
| Type | Description | Notes |
|------|-------------|-------|
| Links | Link to another table | Creates a relationship between tables; can link single or multiple records |
| Lookup | Value from linked record | Pulls a field value through a Links column |
| Rollup | Aggregate from linked records | Functions: sum, avg, count, min, max |
| Formula | Computed expression | Custom formula on other columns |

### Other Types
| Type | Description | Notes |
|------|-------------|-------|
| Attachment | File uploads | Up to 10 files, 50MB each |
| JSON | Raw JSON data | Flexible structured data |
| User | System user reference | Links to workspace members |
| CreatedBy | Auto-set creator | System-managed, read-only |
| LastModifiedBy | Auto-set modifier | System-managed, read-only |

### Read-Only Columns
These columns are system-managed and cannot be written to:
ID, AutoNumber, CreatedTime, LastModifiedTime, CreatedBy, LastModifiedBy, Formula, Rollup, Lookup

## View Types

| View | Description | Best For |
|------|-------------|----------|
| Grid | Spreadsheet-style rows and columns | General data viewing and editing |
| Kanban | Card board grouped by a SingleSelect column | Workflow tracking, status management |
| Gallery | Visual cards with optional cover image | Media-rich records, profiles |
| Form | Data entry form | Collecting structured input |

## Querying Data

Use `query_rows` with filtering and sorting:

**Filter syntax:** `(ColumnName,operator,value)`

**Operators:**
- `eq` / `neq` — Equal / not equal
- `like` / `nlike` — Contains / not contains
- `gt` / `gte` / `lt` / `lte` — Greater/less than (or equal)
- `is` / `isnot` — Null-safe equality
- `checked` / `notchecked` — For checkbox columns

**Examples:**
- `(Status,eq,Active)` — Status equals "Active"
- `(Amount,gt,1000)` — Amount greater than 1000
- `(Name,like,John)` — Name contains "John"

**Sorting:** `sort=-Amount,Name` (prefix `-` for descending)

## Linked Records

Databases support relationships between tables via Links columns:

- **Creating a link:** When inserting/updating a row, provide the linked row ID(s) in the Links column
- **Querying linked data:** Use Lookup columns to pull fields through relationships, or Rollup to aggregate
- **Cross-table references:** Use this to build relational data models (e.g., Projects → Tasks, Customers → Orders)

## Best Practices

### Data Modeling
- Use descriptive column names — they serve as the schema for both humans and agents
- Choose the most specific column type (e.g., Currency instead of Number for monetary values)
- Use Links to connect related tables rather than duplicating data
- Add Lookup/Rollup columns for commonly needed cross-table data

### Working with Rows
- When inserting rows, include all required fields — omitting a field sets it to null
- When updating rows, only send the fields you want to change
- For batch operations (inserting many rows), group them to minimize API calls
- Check column types with `describe_table` before inserting — sending wrong types causes errors

### Responding to Row Comments
- When someone comments on a row, the `context_payload` includes the row anchor with `row_id`
- Use `query_rows` with the row ID to get current field values if you need more context
- If asked to fix a value, use `update_row` and then `resolve_comment`
- If the issue is more complex (e.g., "this data looks wrong"), investigate the related data before responding
