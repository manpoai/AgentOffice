# Output Standards

What you create in AgentOffice — docs, tables, slides, diagrams — is read by humans and by other agents. It needs to be understandable on its own, without you in the room to explain it. This file sets the quality baseline. Follow these and your work will look like a coworker's, not a dump from a tool.

The principle underneath everything here: **a human should be able to skim your output and understand both what it is and why it exists without asking you a single follow-up question.**

## Documents

### Structure

- **Always give a document a real title.** "Untitled Document", "New Doc", "Draft" are failures. If the human asked for a meeting summary, title it the meeting topic and date.
- **Use headings as structure, not decoration.** `#` for the document title (only once), `##` for sections, `###` for subsections. Don't jump from `#` to `###`.
- **Start with context in 1–3 sentences.** What is this doc, why does it exist, who is it for. Not "This document discusses..." — concrete.
- **End with next steps or decisions if the doc is actionable.** A planning doc without next steps is a thought dump.

### Text

- **Paragraphs, not wall of text.** Break on topic shifts. A 600-word paragraph is almost always worse than four 150-word paragraphs.
- **Bullet lists for parallel items.** Steps, options, criteria, examples. Not for every sentence — only when the items genuinely parallel each other.
- **Code blocks for code.** Inline `code` for identifiers, fenced blocks with language tags for snippets.
- **Don't pad.** Every sentence should carry weight. Cut "It is important to note that" and "As previously mentioned". The reader already knows what's previous.

### Notices and Callouts

Use `:::info`, `:::warning`, `:::tip`, `:::success` sparingly — reserved for things that genuinely need to stand out:

- **Warning** — something that will break if ignored
- **Info** — context that's easy to miss in flowing text
- **Tip** — optional improvement
- **Success** — a confirmed outcome

Decorative callouts devalue real ones.

### Updates and Revisions

- **When updating a doc, prefer surgical edits.** Replace the section that changed, leave the rest alone. Revision diffs should be readable.
- **Always provide a `revision_description`.** "Fixed typo in section 3" is better than blank. "Updated" is only slightly better than blank.
- **Don't rewrite history.** If the previous version said something wrong, fix it — don't try to pretend it never said it.

## Database Tables

### Schema Design

- **Column names are part of the schema.** They're visible to every human and agent that reads the table. Use descriptive names: `customer_email`, not `col1`. `launched_at`, not `date`.
- **Pick the most specific column type.**
  - Money → `Currency`, not `Number`
  - Dates → `Date` or `DateTime`, not `SingleLineText`
  - Yes/no → `Checkbox`, not a text column with "yes"/"no"
  - Known-list choices → `SingleSelect` or `MultiSelect`, not free text
  - Cross-table relationships → `Links`, not duplicated text
- **Required vs optional** — decide which columns must have values and note it somewhere visible (column description or a doc). Don't leave it ambiguous.
- **Do not leave system-generated table names visible to users.** If the table shows up as `table_a4f1b2`, rename it before handing it off. Internal IDs must not leak into the product surface.

### Row Data

- **Fill every required column on insert.** Don't rely on "I'll come back and fill this later." You usually won't, and the row is broken in the meantime.
- **Consistent formatting within a column.** Phone numbers all formatted the same way. Dates all in the same format. Names all with or without titles — pick one.
- **No placeholder garbage.** `"TODO"`, `"tbd"`, `"N/A (placeholder)"` in real data rows is a quality failure. Leave the cell empty or mark it with a real status.

### Views

- **If you create views, name them by purpose.** "Active orders", "Q3 pipeline". Not "View 1", "My view".
- **Kanban groupings** should use a column that has a finite, meaningful set of values — usually a SingleSelect like `status`.
- **Form views** should include a short description at the top explaining what the form is for.

## Presentations (Slides)

### Structure

- **Title slide** — presentation title, subtitle, date.
- **One idea per slide.** If you need to say two things, use two slides.
- **Section headers** separate major topics. Signal transitions.
- **Summary slide** at the end — takeaways or next steps.

### Visuals

- **Limit text per slide.** ≤ 6 lines, ≤ 6 words per line, roughly. If you need more text than that, you're writing a doc, not a slide.
- **Font hierarchy** — titles 36–48px, body 18–24px, labels ≥ 14px. Anything below 14px is unreadable in a presentation context.
- **Consistent colors** — pick 2–3 and stick to them. Don't introduce a new color on every slide.
- **White space is content.** Don't fill every pixel. A slide with breathing room reads better than a busy one.
- **Speaker notes** — always add them. Every slide should have at least a short note explaining the intent or talking points.

### What Not to Do

- **Walls of text.** If it's a paragraph, it's not a slide.
- **Screenshots of tables.** Use an embedded table element or a doc instead.
- **Decorative shapes with no meaning.** Every element on a slide should be there for a reason.

## Flowcharts (Diagrams)

### Layout

- **Pick one direction:** top-to-bottom or left-to-right, and keep it consistent.
- **Align nodes at the same level.** Nodes in the same "row" or "column" of the flow should share coordinates. Misaligned nodes read as sloppy.
- **Consistent spacing.** 80–120px between nodes is usually right.
- **Minimize edge crossings.** Rearrange nodes if crossings make the diagram hard to read.

### Shape Conventions

Follow standard flowchart conventions so the diagram is readable to anyone who knows flowcharts:

- **Stadium / rounded rectangle** — Start / End
- **Rectangle** — Process / Action
- **Diamond** — Decision (labeled Yes/No on outgoing edges)
- **Parallelogram** — Input / Output
- **Cylinder** — Database / Storage
- **Cloud** — External system / API

Don't use random shapes for aesthetic variety. The shape is information.

### Labels

- **Node labels** should be 2–5 words. "Validate input", not "This node validates the input provided by the user".
- **Edge labels** describe transitions: "Yes", "No", "On error", "If valid". Leave obvious edges unlabeled.
- **Don't label edges that don't need it.** A linear sequence doesn't need "then" written on every arrow.

### When a Flowchart Is Wrong for the Job

- A straight sequence of 5 steps is a numbered list, not a flowchart.
- A hierarchy (org chart, taxonomy) is a nested list in a doc, not a flowchart — unless it has non-tree edges.
- A state machine with many cycles is a flowchart, but consider whether it's clearer as a table of (state, event, next state).

## Cross-Cutting Rules

These apply to every output:

- **Name things meaningfully.** Internal IDs, UUIDs, system-generated slugs must not appear in anything a user sees. If you create something with a random name, rename it before reporting done.
- **Attribution matters.** Everything you create is attributed to you. Someone will see `created_by: your_name` on it. Make sure you'd be proud to have your name on it.
- **Deliverables are self-contained.** A doc that says "see the comment thread for details" has failed. A table row with a cryptic code in the title has failed. Put the context inside the artifact.
- **One thing per artifact.** A doc is about one topic. A table is about one kind of entity. A slide deck is about one presentation. Don't mix two unrelated things into one container to save a step.
- **Finish what you start.** A half-filled table, a doc with an empty "Notes" section, a slide deck with a "TODO: finish this" slide — these are visible quality failures. If you can't finish, say so; don't publish and hope no one notices.
