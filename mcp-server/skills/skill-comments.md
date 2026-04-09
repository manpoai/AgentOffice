# AgentOffice — Agent Skill: Comment-Based Collaboration

## How Comments Work

Comments are the primary collaboration interface between humans and agents in AgentOffice. Every content type (document, database, presentation, flowchart) supports threaded comments with optional anchoring to specific content elements.

## Comment Events You Receive

| Event | Trigger | When |
|-------|---------|------|
| `comment.mentioned` | Someone @mentions you in a comment | You're explicitly called to attention |
| `comment.on_owned_content` | Someone comments on content you created | You're the content owner |
| `comment.replied` | Someone replies to your comment | A thread you participated in continues |
| `comment.resolved` | Someone resolves your comment | Your feedback has been addressed |
| `comment.unresolved` | Someone reopens your comment | Previously addressed feedback needs revisiting |

## Context Payload

When you receive a comment event, it includes a `context_payload` with:

```json
{
  "version": 2,
  "target": {
    "type": "doc",
    "id": "doc:xxx",
    "title": "Document Title"
  },
  "anchor": {
    "type": "text-range",
    "id": "anchor-id",
    "label": "Text selection",
    "preview": "...selected text...",
    "meta": { "quote": "..." }
  },
  "summary": {
    "comment_text": "The actual comment",
    "comment_author": "moonyaan",
    "text_summary": "Comment on document paragraph"
  },
  "minimal_required_context": {
    "content_snippet": "...500 chars before and after the anchor...",
    "thread": [
      { "id": "cmt_1", "author": "moonyaan", "text": "Previous message", "timestamp": 1234567890 }
    ]
  },
  "write_back_target": {
    "target_id": "doc:xxx",
    "anchor_type": "text-range",
    "anchor_id": "anchor-id"
  },
  "recent_edits": [
    { "actor": "moonyaan", "timestamp": 1234567800, "description": "Updated section 2" }
  ]
}
```

### Anchor Types

| Anchor Type | Content Type | What It Points To |
|-------------|-------------|-------------------|
| `text-range` | Document | A selected text passage |
| `row` | Database | A specific row in a table |
| `slide` | Presentation | A specific slide (by index) |
| `element` | Presentation | A specific element on a slide |
| `node` | Flowchart | A specific node |
| `edge` | Flowchart | A specific edge/connection |
| `image` | Document | An embedded image |
| `table` | Document | An inline table |
| `mermaid` | Document | A mermaid diagram block |
| (none) | Any | Comment on the entire content item |

## Decision Framework

When you receive a comment, follow this process:

### Step 1: Understand the Context
- Read the `comment_text` — what is the human saying?
- Read the `content_snippet` — what content is this about?
- Read the `thread` history — is this a new conversation or a continuation?
- Check `recent_edits` — has something just changed?

### Step 2: Determine Intent
Based on the comment content, determine what the human wants:

| Signal | Likely Intent | Example |
|--------|---------------|---------|
| "Please change...", "Fix...", "Update..." | **Edit request** | "Please fix the typo in line 3" |
| "Why...", "How...", "What does..." | **Question** | "Why did we choose this approach?" |
| "Review...", "Check...", "Look at..." | **Review request** | "Can you review the data model?" |
| "FYI", "Note:", informational tone | **Information** | "FYI we changed the API endpoint" |
| "Great", "Looks good", "Approved" | **Acknowledgment** | "This looks correct, thanks" |

### Step 3: Take Action

**If edit request:**
1. Read the content (use `content_snippet` first, `read_doc` if you need more)
2. Make the edit using `update_doc` (or `update_row` for databases)
3. Reply to the comment confirming what you changed
4. `resolve_comment` — the request has been addressed

**If question:**
1. Read relevant context to formulate an answer
2. `reply_to_comment` with your answer
3. Do NOT resolve — let the human decide if their question is answered

**If review request:**
1. Read the full content with `read_doc`
2. Analyze the content based on the request
3. `reply_to_comment` with your review (findings, suggestions, approval)
4. Do NOT resolve — let the human decide if the review is complete

**If information:**
1. Acknowledge by replying briefly ("Understood" or "Noted, I'll keep this in mind")
2. If the information requires action from you, take it and report back
3. Do NOT resolve unless you're certain no further discussion is needed

**If acknowledgment:**
1. No action needed — the human is confirming your previous work
2. You may `resolve_comment` if the thread is complete

### Step 4: When Unsure
- **Ask, don't guess.** Reply with a clarifying question rather than making assumptions
- **Quote the ambiguous part** — "When you say 'update the structure', do you mean the heading hierarchy or the data schema?"
- **Provide options** — "I can either (a) rewrite this section or (b) add a note at the end. Which do you prefer?"

## Comment Etiquette

- **Be concise** — short replies > long explanations
- **Reference specific content** — "I updated the third paragraph" > "I made some changes"
- **Explain your reasoning** only when the change is non-obvious
- **Don't over-resolve** — only resolve comments you're confident are fully addressed
- **Thread continuity** — reply in the existing thread rather than creating new top-level comments about the same topic
