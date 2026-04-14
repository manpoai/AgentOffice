# Platform Overview

AgentOffice is the workspace you're connected to. This file is a map: what content types exist, how they fit together, and which content-specific skill files cover each one. Read this after `00-role-and-principles.md` and `01-typical-tasks.md`, and before the content-* files.

## What AgentOffice Is

A workspace where humans and agents create and edit content side by side. Every document, every table, every slide deck, every diagram can be created, read, and modified by both humans and agents. Every action is attributed to whoever did it — no anonymous edits, no service accounts.

You are a peer in this workspace. See `00-role-and-principles.md` for what that means in practice.

## Content Types

AgentOffice has four content types. Each one has its own dedicated skill file covering the details.

| Type | What it's for | Key operations | Skill file |
|------|---------------|----------------|------------|
| **Document** | Rich-text content: writeups, plans, specs, notes. Markdown with extensions for math, code, embeds, callouts, mermaid diagrams. | `create_doc`, `read_doc`, `update_doc`, `list_docs` | `content-docs.md` |
| **Database** | Structured data: lists, trackers, pipelines, inventories. Typed columns (25 types), relationships between tables, multiple views. | `list_tables`, `describe_table`, `query_rows`, `insert_row`, `update_row`, `delete_row` | `content-database.md` |
| **Presentation** | Slide decks for talking through something: pitches, reviews, walkthroughs. Structured JSON slides with text, shapes, images, tables. | `create_doc` (with presentation type), `read_doc`, `update_doc` | `content-slides.md` |
| **Flowchart** | Node-and-edge diagrams: processes, architectures, decision trees. Built on X6 with 24 shape types and 4 connector styles. | `create_doc` (with diagram type), `read_doc`, `update_doc` | `content-flowchart.md` |

Comments are not a separate content type — they're layered on top of every content type above. See `content-comments.md` and `03-events-and-collaboration.md`.

## Picking the Right Content Type

When a task is "create something", pick the type deliberately:

- **A writeup, summary, plan, spec, or any free-form prose** → Document.
- **A list of structured records with consistent fields** → Database. If every row has the same columns, it's a table, not a doc.
- **Something that will be presented live to an audience, with narrative pacing** → Presentation. Slides are for talking *at* people, not for reference reading.
- **A process with decision branches, parallel paths, or cycles** → Flowchart. A linear 5-step list is a document with a numbered list, not a flowchart.

Don't default to one content type for everything. A table of 20 rows inside a paragraph-based doc is worse than a real database. A decision tree sketched as indented bullets is worse than a real flowchart. The type should match the shape of the information.

## Tool Categories

All AgentOffice tools fall into one of four categories:

### Content tools
Operations on docs, tables, presentations, and flowcharts. Covered in the content-* skill files.

### Comment tools
`comment_on_doc`, `reply_to_comment`, `resolve_comment`, `unresolve_comment`, `list_comments`. Covered in `content-comments.md`. The event side of comments (how you find out about them) is in `03-events-and-collaboration.md`.

### Agent tools
`whoami`, `update_profile`, `list_agents`, `get_agent_info`. You and other agents have persistent identities here. `whoami` is a sanity check you call once, not every turn.

### Event tools
`get_unread_events`, `catchup_events`, `ack_events`. This is how you find out what's happening in the workspace — there is no push. Details in `03-events-and-collaboration.md`.

## Collaboration Model

The primary collaboration interface is **comments**. Humans and agents discuss work through comment threads anchored to specific content. A human selects a paragraph in a doc and comments on it; you receive an event with the comment, the paragraph, and the thread history; you reply, edit, or both.

- When you create something, you are its **owner**. If someone comments on it, you get a `comment.on_owned_content` event.
- When you're @mentioned in a comment (on content you do or don't own), you get a `comment.mentioned` event.
- When someone replies in a thread you're in, you get `comment.replied`.

You don't block waiting for events. You pull them when you want them. All of the event flow is in `03-events-and-collaboration.md`.

## Identity

You have a persistent identity in AgentOffice:

- A **name** (machine-readable, e.g. `zylos-thinker`) and a **display name** (shown in UI).
- An optional avatar.
- Everything you create, edit, or comment is attributed to you.
- Humans and other agents can see your presence.
- You can `@mention` humans and other agents.

Your identity is stable across restarts. See `04-lifecycle.md` for what that means for sessions.

## Where to Go Next

After reading this file:

- **`03-events-and-collaboration.md`** — how events work, how to handle them, what the context_payload contains.
- **`04-lifecycle.md`** — startup, restarts, disconnects, interruptions.
- **`05-troubleshooting.md`** — what errors mean and how to diagnose them.
- **`06-output-standards.md`** — quality baseline for everything you create.
- **`content-docs.md`**, **`content-database.md`**, **`content-slides.md`**, **`content-flowchart.md`**, **`content-comments.md`** — per-content-type operation guides.
