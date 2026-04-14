# Content: Comments

Reference for working with AgentOffice comments. Assumes you've read `00-role-and-principles.md`, `01-typical-tasks.md`, `02-platform-overview.md`, and — most importantly for this file — `03-events-and-collaboration.md`.

## What It Is

Comments are threaded discussions anchored to content. Every content type in AgentOffice (documents, databases, slides, flowcharts) supports comments, and comments can be anchored to a specific location within the content (a text range in a doc, a row in a table, a slide in a deck, a node in a flowchart) or to the content item as a whole.

Comments are the primary collaboration interface. Humans talk to you through comments, you talk back through comments, and threads build up around specific content.

**Note:** Most of what you need to understand comments lives in `03-events-and-collaboration.md` — event types, context payloads, anchor types, and how to decide what to do with an incoming comment. This file covers the **operations** on comments. Read 03 first.

## When to Use

Post a comment when:

- You want to leave a note on a doc, row, slide, or node that isn't an edit to the content itself.
- You want to report progress, ask a clarifying question, or flag something for attention.
- You're replying to an existing comment in a thread (almost always — see pattern 1).

Don't post a comment when:

- The request was a direct instruction and the right response is to do the work, not to narrate. Do the work, then optionally reply in the thread to confirm.
- You'd be creating a new top-level comment about the same topic that already has an active thread. Reply in the existing thread instead.

## Typical Patterns

### Pattern 1: Reply to a comment you received as an event

This is the most common pattern. You received a `comment.mentioned`, `comment.on_owned_content`, or `comment.replied` event. The event includes a `context_payload` with everything you need.

1. Read `comment_text` and `content_snippet` from the payload.
2. Read the `thread` history.
3. Classify intent (edit request / question / review / info / ack — see 03).
4. Take action:
   - **Edit request:** make the edit, `reply_to_comment` confirming what you did, `resolve_comment`.
   - **Question:** answer it in `reply_to_comment`, do **not** resolve.
   - **Review:** do the review, `reply_to_comment` with findings, do **not** resolve.
   - **Information:** brief acknowledgment or no reply.
   - **Acknowledgment:** no action, optionally resolve if the thread is complete.

You do **not** need `list_comments` — the thread is already in the event payload.

### Pattern 2: Post a new top-level comment

You finished a task and want to flag the result on the content item. Or you found something that needs human attention and there's no existing thread to reply to.

1. `comment_on_doc` with the doc (or the equivalent for other content types if exposed).
2. Keep the comment short and specific.
3. Don't open multiple top-level threads on the same topic.

### Pattern 3: Resolve a thread

You handled the request. The human didn't close the thread, but the work is done.

1. Make sure your last reply explains what was done.
2. `resolve_comment` on the thread.
3. Don't narrate the resolution separately — the act of resolving is the signal.

Only resolve when you're confident the request has been fully handled and no further discussion is expected.

### Pattern 4: Unresolve a thread

The request wasn't actually complete — maybe a related issue came up, or the fix was wrong.

1. `unresolve_comment` on the thread.
2. Post a reply explaining what's reopened and why.

Don't unresolve threads someone else resolved unless you have a clear reason.

## Comment Operations

| Tool | Purpose |
|------|---------|
| `comment_on_doc` | Post a top-level comment on a document |
| `reply_to_comment` | Reply in an existing thread |
| `resolve_comment` | Mark a thread as resolved |
| `unresolve_comment` | Reopen a previously resolved thread |
| `list_comments` | List comments on a content item |

## Anchor Types (summary)

Comments can be anchored to specific content. The anchor type depends on the content type:

| Content | Anchor types |
|---------|--------------|
| Document | `text-range`, `image`, `table`, `mermaid`, none |
| Database | `row`, none |
| Presentation | `slide`, `element`, none |
| Flowchart | `node`, `edge`, none |

An anchored comment points at exactly the passage, row, or node in question. A comment with no anchor is on the content item as a whole. Full details and the full context_payload schema live in `03-events-and-collaboration.md`.

## Comment Etiquette

- **Be concise.** Short replies beat long explanations. Humans read comment threads quickly.
- **Reference specific content.** "I updated the third paragraph" beats "I made some changes."
- **Explain your reasoning only when non-obvious.** If the edit is self-explanatory, the edit is the explanation.
- **Don't over-resolve.** Only resolve comments when the thread is actually complete. A question from a human isn't done until they say it is.
- **Thread continuity.** Reply in the existing thread rather than opening a new top-level comment about the same topic.
- **Don't post comments as a substitute for doing the work.** If the human asked for an edit, do the edit. Don't just post a comment saying "I'll do this."

## Edge Cases

- **The thread contains a stale reference.** Someone mentions "the version from yesterday" — you may need to check `recent_edits` or read the doc to understand what they're pointing at.
- **Multiple threads on the same content.** Each thread is independent. Treat them separately.
- **A comment mentions several people including you.** Reply once, to you. The others will see your reply in the thread.
- **A `comment.resolved` event for a thread you were active in.** Usually no action — the thread is done. Don't jump back in.
- **A comment references content in a different workspace item.** Follow the reference if needed (`read_doc`, `query_rows`), but don't go on a tour — pull only what you need.

## Anti-Patterns

- **Don't `list_comments` for context you already have.** Comment events deliver the thread in `context_payload.minimal_required_context.thread`. Only call `list_comments` if the event payload is missing the thread or you need comments from a different content item.
- **Don't `resolve_comment` on questions or reviews.** Only resolve when the request has been handled. Let the human close their own questions and reviews.
- **Don't reply to every comment.** Pure FYI comments often just need no reply, or a single word. Empty acknowledgments clutter the thread.
- **Don't `read_doc` reflexively on every incoming comment.** The `content_snippet` in the context payload is almost always enough. Reach for `read_doc` only when the snippet is clearly insufficient.
- **Don't post a stilted "Hello fellow agent" reply to another agent's comment.** Treat them like a coworker. Be direct, do the work, report.
- **Don't post a comment that is a question back when you could answer it yourself.** See `01-typical-tasks.md` — don't stall.
- **Don't create a new top-level comment about a topic that already has an active thread.** Reply in the thread.
