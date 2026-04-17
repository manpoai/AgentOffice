# Content: File Tree & Organization

Reference for organizing content items into a hierarchical file tree. Assumes you've read `00-role-and-principles.md` and `02-platform-overview.md`.

## What It Is

All content items (docs, tables, presentations, diagrams) live in a flat-or-nested file tree. Each item has an optional `parent_id` pointing to another content item, and a `sort_order` controlling position among siblings. Items without a parent are at the root level.

This is the same sidebar tree that humans see in the AOSE UI — when you create or move items, the tree updates in real time for all users.

## Tools

### Browsing the tree

- **`list_content_items`** — returns all items in the workspace (flat list). Each item includes `parent_id` and `sort_order` so you can reconstruct the tree.
- **`list_children(parent_id?, type?)`** — returns direct children of a specific item, sorted by `sort_order`. Omit `parent_id` to get root-level items. Optionally filter by type.

### Creating items in the tree

All create tools accept an optional `parent_id` parameter:

- `create_doc(title, content_markdown, parent_id?)`
- `create_table(title, columns, parent_id?)`
- `create_presentation(title, parent_id?)`
- `create_diagram(title, parent_id?)`

Omit `parent_id` to create at root level. Pass a content item ID to nest the new item under that parent.

### Moving items

- **`move_content_item(content_id, parent_id?, sort_order?)`** — move an existing item to a new parent (or to root if `parent_id` is null). Optionally set `sort_order` to control position among siblings.

## Typical Patterns

### Pattern 1: Create a project folder structure

The human asks you to organize their workspace. First list what exists, then move items under a parent doc that acts as a folder.

```
1. list_content_items() → see all items
2. create_doc("Project Alpha", "# Project Alpha\n\nProject folder.") → get folder_id
3. move_content_item(existing_doc_id, parent_id=folder_id, sort_order=0)
4. move_content_item(existing_table_id, parent_id=folder_id, sort_order=1)
```

### Pattern 2: Create a nested document

The human asks you to create a sub-page under an existing doc.

```
1. list_children(parent_id="doc_abc123") → see current children
2. create_doc("Meeting Notes", content, parent_id="doc_abc123")
```

### Pattern 3: Reorganize the tree

The human asks to move items around.

```
1. list_content_items() → find item IDs
2. move_content_item(item_id, parent_id=new_parent_id)
3. move_content_item(item_id, parent_id=null)  → move to root
```

## Rules

- Any content item can be a parent — docs, tables, diagrams, and presentations can all have children.
- Moving an item preserves all its content and children. The subtree moves together.
- `sort_order` is a number — lower values appear first. You don't need to set it unless ordering matters.
- Don't create deeply nested structures unless the human asks for it. Flat or one-level-deep is usually enough.
