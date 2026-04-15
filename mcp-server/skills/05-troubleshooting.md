# Troubleshooting

When a tool call fails or returns something unexpected, the goal is to diagnose — not to retry, not to wrap everything in defensive try/catch, not to give up and tell the human "something went wrong." This file covers the errors you'll actually hit and how to handle each one.

## Core Rule: Symptom → Cause → Fix

For every problem:

1. **Read the error or the unexpected value carefully.** The message usually tells you what's wrong.
2. **Figure out the real cause.** Don't guess. If you can't tell, make one targeted follow-up call to check.
3. **Fix the cause, not the symptom.** Retrying a call that failed for a real reason just fails the same way.

If you've tried twice and it still doesn't work, stop and tell the human what you've observed. Don't try a third blind fix.

## Authentication Errors

### `401 Unauthorized`

Your token is missing, expired, or wrong.

- **First check:** Is the MCP server actually receiving `AOSE_TOKEN` from the MCP host's env block? If you were invoked via `npx` and the env vars weren't passed, you'd see this. The token is never persisted to `~/.aose-mcp/config.json` — only the base URL lives there.
- **Fix:** Tell the human. This isn't something you can fix from inside a tool call — they need to re-set `AOSE_TOKEN` in the MCP host config, or re-run `npx aose-mcp set-url` if the URL is wrong. Don't retry.

### `403 Forbidden`

You authenticated, but you don't have permission for this specific action.

- **Common cause:** You're trying to edit something you don't own, and the workspace requires ownership. Or you're trying to access a table in a scope you're not approved for.
- **Fix:** Read the error body — it usually names the resource and the missing permission. Tell the human what you were trying to do and what permission is missing. They can adjust permissions or do the action themselves.

## Not Found

### `404 Not Found` on a doc/table/row

The ID you're using doesn't point to anything.

- **Don't assume the content was deleted.** The common cause is a stale ID — from a cached reference, an old event payload, or a typo.
- **Check:** `list_docs` filtered by title if it's a doc, or `list_tables` for tables. Find the real current ID.
- **If it genuinely doesn't exist:** tell the human and ask. Don't create a new one with that name and pretend the problem is solved.

## Database Errors

### `insert_row` / `update_row` with column type mismatch

Symptom: error like "value for column X must be a Number" or "invalid email format for column Y".

- **Cause:** You sent the wrong type. aose database columns are strongly typed. Sending `"123"` to a `Number` column or an invalid email to an `Email` column fails.
- **Fix:** Call `describe_table` on this table (once) to see the column types. Coerce your values correctly. `describe_table` results are worth remembering for the rest of the session so you don't need to call it again.

### `query_rows` returns an empty array unexpectedly

- **Possibility 1:** The filter `(Column,op,value)` didn't match anything. Column names are case-sensitive and must match exactly how the table defined them.
- **Possibility 2:** The column name in your filter is wrong (maybe it has a typo or wrong capitalization). The API returns empty rather than a "bad column" error in some cases.
- **Check:** Call `describe_table` to see the exact column names, then re-run `query_rows` with the corrected filter.

### Writing to a read-only column

Symptom: error when you include a column like `Id`, `CreatedTime`, `CreatedBy`, `Formula`, `Rollup`, or `Lookup` in an insert/update payload.

- **Cause:** Those columns are system-managed. You can read them but not write them.
- **Fix:** Remove them from the payload. Only send columns you intend to set.

### Linked record column: you sent a raw string instead of a row ID

Symptom: `Links` column error or the link silently doesn't appear.

- **Cause:** `Links` columns expect a row ID (or an array of row IDs for multi-link), not the display value.
- **Fix:** Look up the target row's ID first with `query_rows` on the linked table, then pass the ID.

## Document Errors

### `update_doc` with an `anchor_id` that doesn't exist

Symptom: the update didn't apply, or you get a "anchor not found" error.

- **Cause:** The anchor ID you used is stale — probably from an old event payload, and the document was edited since then, invalidating that anchor.
- **Fix:** Read the doc, locate the section by content, apply the edit at the current location. Or, if the human asked via a fresh comment, use the `write_back_target` from the most recent event, not an older one.

### `read_doc` returns a doc without the section you expected

- **Cause:** Someone edited it. Check `recent_edits` in the most recent event payload, or just re-read the section.
- **Don't:** Assume the doc is "broken" and create a new one. The old content is probably elsewhere — moved, merged, or renamed.

## Comment Errors

### `reply_to_comment` with an unknown `parent_comment_id`

- **Cause:** The parent comment got deleted, or you have the wrong ID.
- **Fix:** `list_comments` on the content item to find the current thread, then reply to the right comment.

### You called `resolve_comment` but the thread is still open

- **Possibility 1:** Someone reopened it — check for a `comment.unresolved` event in your queue.
- **Possibility 2:** You resolved it but the human unresolved it immediately, signaling they wanted more from you. Read the latest reply and respond substantively.

## Event Errors

### `get_unread_events` returns the same events again after you processed them

- **Cause:** You didn't `ack_events` after handling them.
- **Fix:** After processing each event, collect their IDs and pass them to `ack_events`. Unacked events come back.

### `catchup_events` returns far fewer events than you expected

- **Cause:** There's a limit on how far back catchup reaches. Very old events may not be in the buffer.
- **Fix:** This is not an error. You can't recover events older than the platform's retention window. Tell the human if they're asking about something from a long time ago.

## MCP Host / Connection Errors

These aren't things you can fix from inside a tool call — they're environmental:

- **"MCP server not responding"** — The MCP host process died or can't reach the gateway. Tell the human, suggest they check `npx aose-mcp` is running, or restart the MCP host.
- **Intermittent tool timeouts** — The gateway might be slow. One retry is fine. If the second attempt also times out, stop retrying and tell the human.

## When You Really Don't Know What's Wrong

Stop guessing. Tell the human plainly:

- What you were trying to do (one sentence)
- What you observed (the exact error message or the unexpected value)
- What you already checked (one or two things you verified)
- What you'd like to try next, or a question

This is a coworker-level diagnostic report. Much better than retrying blindly five times or saying "it didn't work" with no details.

## What Not to Do

- **Don't wrap every tool call in try/catch.** The MCP host surfaces errors to you automatically. Wrapping everything is `openclaw`-style over-defense and hides real signal.
- **Don't invent error cases that can't happen.** "What if the table is empty?" → empty isn't an error. Handle it as valid data (`rows.length === 0`), not as a failure.
- **Don't retry on errors you haven't diagnosed.** If you don't know why it failed, the retry doesn't know either.
- **Don't swallow errors silently and continue.** If `insert_row` fails, the row is not there. Don't move on pretending it is.
- **Don't paste a raw stack trace at the human.** Summarize the symptom in one or two sentences. If they ask for the full error, give it to them.
