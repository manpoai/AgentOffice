# Pinned Shortcut + Comment Notification Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Pinned from a content-object-move model to a per-user shortcut relation, and improve comment notifications to include file name + file type icon.

**Architecture:** Two independent tracks: (A) Backend content_pins table + new pin API + frontend shortcut view + topbar wiring; (B) Backend notifications.meta column + comment title with file name + frontend icon by target_type.

**Tech Stack:** Node.js/SQLite (gateway), React/Next.js/TypeScript (shell), better-sqlite3, TanStack Query

---

## Track A: Pinned Shortcut Model

### Task A1: Backend — add content_pins table and migration

**Files:**
- Modify: `gateway/gateway.js` (db init, schema migration)

- [ ] **Step 1: Locate schema init in gateway.js**

```bash
grep -n "CREATE TABLE\|content_items\|pinned\|schema" /Users/mac/Documents/asuite/gateway/gateway.js | head -40
```

- [ ] **Step 2: Add content_pins table creation after existing table inits**

Find where other tables are created (look for `CREATE TABLE IF NOT EXISTS`) and add:

```js
db.prepare(`
  CREATE TABLE IF NOT EXISTS content_pins (
    id TEXT PRIMARY KEY,
    actor_id TEXT NOT NULL,
    content_id TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    UNIQUE(actor_id, content_id)
  )
`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_content_pins_actor ON content_pins(actor_id)`).run();
```

- [ ] **Step 3: Migrate existing pinned data**

After the CREATE TABLE, add migration that runs once:

```js
// Migrate old content_items.pinned=1 rows to content_pins
const alreadyMigrated = db.prepare("SELECT COUNT(*) as n FROM content_pins").get();
if (alreadyMigrated.n === 0) {
  const pinnedItems = db.prepare("SELECT id FROM content_items WHERE pinned = 1 AND deleted_at IS NULL").all();
  // Use a system actor id for migrated pins (owner_actor_id if available, else skip)
  for (const item of pinnedItems) {
    const owner = db.prepare("SELECT owner_actor_id FROM content_items WHERE id = ?").get(item.id);
    if (owner?.owner_actor_id) {
      try {
        db.prepare("INSERT OR IGNORE INTO content_pins (id, actor_id, content_id, created_at) VALUES (?, ?, ?, ?)")
          .run(`pin_migrated_${item.id.replace(':', '_')}`, owner.owner_actor_id, item.id, Date.now());
      } catch { /* ignore dup */ }
    }
  }
}
```

- [ ] **Step 4: Restart gateway and verify table exists**

```bash
cd /Users/mac/Documents/asuite && pm2 restart gateway
sleep 2
sqlite3 /Users/mac/Documents/asuite/gateway/gateway.db ".schema content_pins"
```

Expected: Shows `CREATE TABLE content_pins (...)` output.

- [ ] **Step 5: Commit**

```bash
cd /Users/mac/Documents/asuite && git add gateway/gateway.js && git commit -m "feat(pinned): add content_pins relation table with migration from content_items.pinned"
```

---

### Task A2: Backend — pin/unpin/list API endpoints

**Files:**
- Modify: `gateway/routes/content.js`

- [ ] **Step 1: Read the PATCH endpoint area to understand pattern**

```bash
sed -n '600,640p' /Users/mac/Documents/asuite/gateway/routes/content.js
```

- [ ] **Step 2: Add GET /api/content-pins endpoint**

Find `app.patch('/api/content-items/:id'` and add BEFORE it:

```js
// ── Pin relation endpoints ──────────────────────────────
app.get('/api/content-pins', authenticateAny, (req, res) => {
  const actorId = req.actor?.id || req.agent?.id;
  if (!actorId) return res.status(401).json({ error: 'UNAUTHENTICATED' });
  const rows = db.prepare('SELECT content_id FROM content_pins WHERE actor_id = ?').all(actorId);
  res.json({ pinned_ids: rows.map(r => r.content_id) });
});

app.post('/api/content-pins/:contentId', authenticateAny, (req, res) => {
  const actorId = req.actor?.id || req.agent?.id;
  if (!actorId) return res.status(401).json({ error: 'UNAUTHENTICATED' });
  const contentId = decodeURIComponent(req.params.contentId);
  const exists = db.prepare('SELECT id FROM content_items WHERE id = ?').get(contentId);
  if (!exists) return res.status(404).json({ error: 'NOT_FOUND' });
  const pinId = genId('pin');
  try {
    db.prepare('INSERT OR IGNORE INTO content_pins (id, actor_id, content_id, created_at) VALUES (?, ?, ?, ?)')
      .run(pinId, actorId, contentId, Date.now());
  } catch { /* ignore dup */ }
  res.json({ ok: true });
});

app.delete('/api/content-pins/:contentId', authenticateAny, (req, res) => {
  const actorId = req.actor?.id || req.agent?.id;
  if (!actorId) return res.status(401).json({ error: 'UNAUTHENTICATED' });
  const contentId = decodeURIComponent(req.params.contentId);
  db.prepare('DELETE FROM content_pins WHERE actor_id = ? AND content_id = ?').run(actorId, contentId);
  res.json({ ok: true });
});
```

- [ ] **Step 3: Update GET /api/content-items to compute derived pinned field from content_pins**

Find the SELECT query inside `app.get('/api/content-items'` and replace it:

Current query:
```js
const rows = db.prepare(`
  SELECT ci.*,
    COALESCE(cc.unresolved_count, 0) AS unresolved_comment_count
  FROM content_items ci
  LEFT JOIN (
    SELECT target_id, COUNT(*) AS unresolved_count
    FROM comments
    WHERE resolved_at IS NULL AND parent_id IS NULL
    GROUP BY target_id
  ) cc ON cc.target_id = ci.id
  WHERE ci.deleted_at IS NULL
  ORDER BY ci.pinned DESC, ci.sort_order ASC, ci.created_at ASC
`).all();
```

Replace with:
```js
const actorId = req.actor?.id || req.agent?.id || null;
const rows = db.prepare(`
  SELECT ci.*,
    COALESCE(cc.unresolved_count, 0) AS unresolved_comment_count,
    CASE WHEN cp.content_id IS NOT NULL THEN 1 ELSE 0 END AS pinned_relation
  FROM content_items ci
  LEFT JOIN (
    SELECT target_id, COUNT(*) AS unresolved_count
    FROM comments
    WHERE resolved_at IS NULL AND parent_id IS NULL
    GROUP BY target_id
  ) cc ON cc.target_id = ci.id
  LEFT JOIN content_pins cp ON cp.content_id = ci.id AND cp.actor_id = ?
  WHERE ci.deleted_at IS NULL
  ORDER BY ci.sort_order ASC, ci.created_at ASC
`).all(actorId);
// Map pinned_relation → pinned for backward compat
const mappedRows = rows.map(r => ({ ...r, pinned: r.pinned_relation === 1 }));
res.json({ items: mappedRows });
```

- [ ] **Step 4: Restart gateway and test pin endpoints manually**

```bash
cd /Users/mac/Documents/asuite && pm2 restart gateway && sleep 2
TOKEN=$(node -e "const db=require('better-sqlite3')('./gateway/gateway.db'); const r=db.prepare('SELECT token FROM actors WHERE type=\'human\' LIMIT 1').get(); console.log(r?.token||'')")
# Get actor id manually:
sqlite3 /Users/mac/Documents/asuite/gateway/gateway.db "SELECT id, username, type FROM actors WHERE type='human' LIMIT 3"
```

Then test:
```bash
# Use the actual token from auth login; verify 200 OK
curl -s -X GET http://localhost:4000/api/content-pins \
  -H "Authorization: Bearer $AGENT_TOKEN"
```

Expected: `{"pinned_ids":[]}`

- [ ] **Step 5: Commit**

```bash
cd /Users/mac/Documents/asuite && git add gateway/routes/content.js && git commit -m "feat(pinned): add GET/POST/DELETE /api/content-pins endpoints; derive pinned field from relation"
```

---

### Task A3: Frontend — add pin API calls to gateway.ts

**Files:**
- Modify: `shell/src/lib/api/gateway.ts`

- [ ] **Step 1: Read current updateContentItem and surrounding pin code**

```bash
sed -n '265,285p' /Users/mac/Documents/asuite/shell/src/lib/api/gateway.ts
```

- [ ] **Step 2: Add pin API functions after updateContentItem**

Find `export async function updateContentItem` and after its closing brace add:

```ts
export async function listContentPins(): Promise<string[]> {
  const data = await gwFetch<{ pinned_ids: string[] }>('/content-pins');
  return data.pinned_ids;
}

export async function pinContentItem(contentId: string): Promise<void> {
  await gwFetch(`/content-pins/${encodeURIComponent(contentId)}`, { method: 'POST' });
}

export async function unpinContentItem(contentId: string): Promise<void> {
  await gwFetch(`/content-pins/${encodeURIComponent(contentId)}`, { method: 'DELETE' });
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Documents/asuite/shell && git add src/lib/api/gateway.ts && git commit -m "feat(pinned): add listContentPins/pinContentItem/unpinContentItem API functions"
```

---

### Task A4: Frontend — update use-content-tree.ts to use content_pins relation

**Files:**
- Modify: `shell/src/lib/hooks/use-content-tree.ts`

- [ ] **Step 1: Read the pinnedIds/unpinnedIds useMemo logic**

```bash
sed -n '380,445p' /Users/mac/Documents/asuite/shell/src/lib/hooks/use-content-tree.ts
```

- [ ] **Step 2: Verify that content-items now returns pinned as derived field**

The backend already maps `pinned_relation → pinned`, so `item.pinned` in `ContentNode` is already correct from the API. The `use-content-tree.ts` reads `item.pinned` at line ~363 and builds `pinnedIds`. This is now per-actor and correct.

No changes needed in use-content-tree.ts for the split logic — the pinned field is now derived from content_pins.

Verify the mapping line in use-content-tree.ts still works:
```bash
grep -n "pinned" /Users/mac/Documents/asuite/shell/src/lib/hooks/use-content-tree.ts | head -10
```

Expected: line ~363 shows `pinned: !!item.pinned` — this reads the derived field, already correct.

- [ ] **Step 3: Update togglePin in use-content-tree.ts to call new API**

Find line ~631:
```ts
await gw.updateContentItem(nodeId, { pinned: !node.pinned });
```

Replace with:
```ts
if (node.pinned) {
  await gw.unpinContentItem(nodeId);
} else {
  await gw.pinContentItem(nodeId);
}
```

- [ ] **Step 4: Invalidate content-items query after pin toggle**

Find where the query is invalidated after togglePin (look in the function that calls `updateContentItem` for pinned). After the new pin/unpin call, ensure `queryClient.invalidateQueries({ queryKey: ['content-items'] })` is called. Check the current code does this already:

```bash
grep -n -A5 "togglePin\|pinned.*node.pinned\|updateContentItem.*pinned" /Users/mac/Documents/asuite/shell/src/lib/hooks/use-content-tree.ts | head -20
```

- [ ] **Step 5: Commit**

```bash
cd /Users/mac/Documents/asuite/shell && git add src/lib/hooks/use-content-tree.ts && git commit -m "feat(pinned): use content_pins API for toggle instead of content_items.pinned field"
```

---

### Task A5: Frontend — wire real pinned/togglePin into ContentDocView, ContentDiagramView, TableEditor, PresentationEditor

**Files:**
- Modify: `shell/src/app/(workspace)/content/page.tsx`
- Modify: `shell/src/components/content-views/ContentDocView.tsx`
- Modify: `shell/src/components/content-views/ContentDiagramView.tsx`
- Modify: `shell/src/components/table-editor/TableEditor.tsx`
- Modify: `shell/src/components/presentation-editor/PresentationEditor.tsx`

The pattern is: page.tsx already has `handleTogglePin` and passes it to tree nodes. The content view components (ContentDocView etc.) don't receive it. We need to add `onTogglePin` prop to each and pass the real state.

- [ ] **Step 1: Add onTogglePin prop to ContentDocView**

In `ContentDocView.tsx`, find the props interface (line ~72):
```ts
export function ContentDocView({ doc, customIcon, breadcrumb, onBack, onSaved, onDeleted, onNavigate, docListVisible, onToggleDocList, focusCommentId: initialFocusCommentId, showComments, onShowComments, onCloseComments, onToggleComments }: {
```

Add `onTogglePin?: () => void; isPinned?: boolean;` to both destructuring and the type block.

- [ ] **Step 2: Replace stub pin values in ContentDocView**

Find all occurrences of `pinned: false, ... togglePin: () => {},` in ContentDocView.tsx (there are 2 at lines ~544 and ~574). Replace with:

```ts
pinned: isPinned ?? false,
// ...
togglePin: () => onTogglePin?.(),
```

- [ ] **Step 3: Add onTogglePin prop to ContentDiagramView**

Same pattern as ContentDocView. Find the props interface in ContentDiagramView.tsx, add `onTogglePin?: () => void; isPinned?: boolean;`, then replace the 2 stubs (lines ~189, ~208).

- [ ] **Step 4: Add onTogglePin prop to TableEditor**

Find TableEditor props interface. Add `onTogglePin?: () => void; isPinned?: boolean;`, replace the 2 stubs (lines ~1962, ~1991).

- [ ] **Step 5: Add onTogglePin prop to PresentationEditor**

Find PresentationEditor props interface (around `presentationId: string;`). Add `onTogglePin?: () => void; isPinned?: boolean;`, replace the 3 stubs (lines ~1702, ~1826, ~1846).

- [ ] **Step 6: Pass real pin state from page.tsx to each content view**

In `page.tsx`, find where each view is rendered. For ContentDocView (~line 1347):

```tsx
<ContentDocView
  // existing props...
  isPinned={effectiveNodes.get(`doc:${selectedDoc.id}`)?.pinned ?? false}
  onTogglePin={() => handleTogglePin(`doc:${selectedDoc.id}`)}
/>
```

For TableEditor, find selectedTableId render and pass:
```tsx
isPinned={effectiveNodes.get(`table:${selectedTableId}`)?.pinned ?? false}
onTogglePin={() => handleTogglePin(`table:${selectedTableId}`)}
```

For PresentationEditor, find selectedPresentationId render and pass:
```tsx
isPinned={effectiveNodes.get(`presentation:${selectedPresentationId}`)?.pinned ?? false}
onTogglePin={() => handleTogglePin(`presentation:${selectedPresentationId}`)}
```

For ContentDiagramView, find selectedDiagramId render and pass:
```tsx
isPinned={effectiveNodes.get(`diagram:${selectedDiagramId}`)?.pinned ?? false}
onTogglePin={() => handleTogglePin(`diagram:${selectedDiagramId}`)}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd /Users/mac/Documents/asuite/shell && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors related to pinned/togglePin.

- [ ] **Step 8: Commit**

```bash
cd /Users/mac/Documents/asuite/shell && git add src/app/\(workspace\)/content/page.tsx src/components/content-views/ContentDocView.tsx src/components/content-views/ContentDiagramView.tsx src/components/table-editor/TableEditor.tsx src/components/presentation-editor/PresentationEditor.tsx && git commit -m "feat(pinned): wire real isPinned/onTogglePin into all content view topbars"
```

---

### Task A6: Frontend — sidebar Pinned section stays as shortcut view (verify behavior)

The sidebar currently shows pinned items as a separate section, and the same item also appears in Library. Since `pinned` is now a derived field (not structural), the item stays in its original tree position AND appears in pinnedIds. This is exactly the shortcut behavior — no structural change needed.

**Files:**
- Read: `shell/src/app/(workspace)/content/page.tsx` (sidebar section, lines 1083–1130)

- [ ] **Step 1: Verify the sidebar renders both sections independently**

```bash
sed -n '1083,1135p' /Users/mac/Documents/asuite/shell/src/app/\(workspace\)/content/page.tsx
```

Confirm: `pinnedIds` renders pinned section, `unpinnedIds` renders library section. With the new backend, both sections can contain the same item (pin doesn't remove it from library). This is already correct — no code change needed.

- [ ] **Step 2: Verify unpinnedIds no longer excludes pinned items from Library**

Currently `unpinnedIds` is computed as items where `!node.pinned`. This means pinned items disappear from Library. We need to fix this.

In `use-content-tree.ts`, find lines ~434–441:
```ts
const pinned: string[] = [];
const unpinned: string[] = [];
// ...
if (effectiveNodes.get(id)?.pinned) pinned.push(id);
else unpinned.push(id);
```

Change so ALL root items go to unpinned (Library), and separately compute pinnedIds:
```ts
const pinned: string[] = [];
const unpinned: string[] = [];
// ...
unpinned.push(id); // always add to library
if (effectiveNodes.get(id)?.pinned) pinned.push(id); // also add to pinned if pinned
```

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Documents/asuite/shell && git add src/lib/hooks/use-content-tree.ts && git commit -m "feat(pinned): sidebar library shows all items; pinned section is additive shortcut view"
```

---

## Track B: Comment Notification Enhancement

### Task B1: Backend — add meta column to notifications table

**Files:**
- Modify: `gateway/gateway.js`

- [ ] **Step 1: Add meta column migration**

In `gateway.js`, after existing schema setup, add:

```js
// Add meta column to notifications if not exists (migration)
try {
  db.prepare("ALTER TABLE notifications ADD COLUMN meta TEXT").run();
} catch { /* column already exists */ }
```

- [ ] **Step 2: Restart and verify**

```bash
cd /Users/mac/Documents/asuite && pm2 restart gateway && sleep 2
sqlite3 /Users/mac/Documents/asuite/gateway/gateway.db ".schema notifications"
```

Expected: Schema includes `meta TEXT`.

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Documents/asuite && git add gateway/gateway.js && git commit -m "feat(notifications): add meta TEXT column to notifications table"
```

---

### Task B2: Backend — pass target_title to emitCommentEvent and write enriched notification

**Files:**
- Modify: `gateway/lib/comment-service.js`
- Modify: `gateway/lib/comment-events.js`

- [ ] **Step 1: Read comment-service.js createUnifiedComment to see where to fetch title**

```bash
sed -n '50,90p' /Users/mac/Documents/asuite/gateway/lib/comment-service.js
```

- [ ] **Step 2: Fetch content title in createUnifiedComment**

In `createUnifiedComment`, after the line:
```js
const contentOwner = db.prepare('SELECT owner_actor_id FROM content_items WHERE id = ?').get(targetId);
```

Add:
```js
const contentTitle = db.prepare('SELECT title FROM content_items WHERE id = ?').get(targetId)?.title || '';
```

Then pass it to `emitCommentEvent`:
```js
emitCommentEvent(db, {
  // ... existing fields ...
  targetTitle: contentTitle,
  // ...
});
```

- [ ] **Step 3: Update emitCommentEvent signature in comment-events.js**

In the function signature, add `targetTitle` to the destructured params:
```js
export function emitCommentEvent(db, {
  // ... existing ...
  targetTitle,
  // ...
}) {
```

- [ ] **Step 4: Update owner notification title and add meta field**

Find line ~96–102 in comment-events.js:
```js
title: `${actorName} 评论了你的内容`,
```

Replace with:
```js
title: targetTitle
  ? `${actorName} 评论了《${targetTitle}》`
  : `${actorName} 评论了你的内容`,
```

Then update `createNotification` call to include meta. First update the `createNotification` function signature at the top of the file to accept `meta`:

```js
function createNotification(db, { genId, actorId, targetActorId, type, title, body, link, meta }) {
  const id = genId('notif');
  db.prepare(
    `INSERT INTO notifications (id, actor_id, target_actor_id, type, title, body, link, meta, read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, unixepoch() * 1000)`
  ).run(id, actorId || null, targetActorId, type, title, body || null, link || null, meta ? JSON.stringify(meta) : null);
}
```

Then in the owner notification createNotification call, add:
```js
meta: {
  target_type: targetType,
  target_id: targetId,
  target_title: targetTitle || null,
},
```

- [ ] **Step 5: Restart gateway and create a test comment to verify**

```bash
cd /Users/mac/Documents/asuite && pm2 restart gateway && sleep 2
sqlite3 /Users/mac/Documents/asuite/gateway/gateway.db "SELECT title, meta FROM notifications ORDER BY created_at DESC LIMIT 3"
```

After creating a comment through the UI, verify the notification row shows the file name in title and meta JSON.

- [ ] **Step 6: Commit**

```bash
cd /Users/mac/Documents/asuite && git add gateway/lib/comment-service.js gateway/lib/comment-events.js && git commit -m "feat(notifications): comment notification title shows file name; add meta with target_type/target_title"
```

---

### Task B3: Backend — update notifications list API to return meta

**Files:**
- Modify: `gateway/routes/content.js` (or wherever notifications list endpoint lives)

- [ ] **Step 1: Find the notifications list endpoint**

```bash
grep -n "notifications\|/api/notif" /Users/mac/Documents/asuite/gateway/routes/content.js | head -10
grep -rn "GET.*notif\|notifications.*SELECT" /Users/mac/Documents/asuite/gateway/routes/ | head -10
```

- [ ] **Step 2: Ensure meta is returned in the notification list response**

Find the SELECT query for notifications. If it does `SELECT *`, meta is already included. If it selects specific columns, add `meta`. Also ensure the response maps `meta` from JSON string to object:

```js
const rows = db.prepare('SELECT * FROM notifications WHERE target_actor_id = ? ORDER BY created_at DESC LIMIT 50').all(actorId);
res.json({
  notifications: rows.map(r => ({
    ...r,
    meta: r.meta ? JSON.parse(r.meta) : null,
  }))
});
```

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Documents/asuite && git add gateway/routes/content.js && git commit -m "feat(notifications): return parsed meta object in notifications list API"
```

---

### Task B4: Frontend — update Notification type and NotificationPanel icon logic

**Files:**
- Modify: `shell/src/components/shared/NotificationPanel.tsx`
- Modify: `shell/src/lib/api/gateway.ts` (Notification type)

- [ ] **Step 1: Read current NotificationPanel**

```bash
cat /Users/mac/Documents/asuite/shell/src/components/shared/NotificationPanel.tsx | head -60
```

- [ ] **Step 2: Update Notification type in gateway.ts**

Find the `Notification` type (search for `type.*Notification\|interface.*Notification`):
```bash
grep -n "Notification\|notification" /Users/mac/Documents/asuite/shell/src/lib/api/gateway.ts | head -20
```

Add meta field to the type:
```ts
export interface Notification {
  // ... existing fields ...
  meta?: {
    target_type?: 'doc' | 'table' | 'presentation' | 'diagram';
    target_id?: string;
    target_title?: string;
  } | null;
}
```

- [ ] **Step 3: Update icon map in NotificationPanel.tsx**

Find the icon map at the top (lines ~14–22). Import additional icons and add a helper function:

```ts
import { Bell, Check, MessageSquare, FileText, Table2, Bot, X, Presentation, GitBranch } from 'lucide-react';
```

Note: `Presentation` may not exist in lucide-react — check available icons:
```bash
grep -r "from 'lucide-react'" /Users/mac/Documents/asuite/shell/src/components/shared/NotificationPanel.tsx
```

Use available alternatives: `FileText` for doc, `Table2` for table, `Layout` or `MonitorPlay` for presentation, `GitBranch` or `Workflow` for diagram.

Replace the icon map with a helper function:

```ts
const CONTENT_TYPE_ICONS: Record<string, React.ReactNode> = {
  doc: <FileText className="h-4 w-4" />,
  table: <Table2 className="h-4 w-4" />,
  presentation: <Layout className="h-4 w-4" />,
  diagram: <GitBranch className="h-4 w-4" />,
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  doc_update: <FileText className="h-4 w-4" />,
  comment: <MessageSquare className="h-4 w-4" />,
  comment_reply: <MessageSquare className="h-4 w-4" />,
  comment_on_content: <MessageSquare className="h-4 w-4" />,
  mention: <MessageSquare className="h-4 w-4" />,
  comment_resolved: <MessageSquare className="h-4 w-4" />,
  comment_unresolved: <MessageSquare className="h-4 w-4" />,
};

function getNotificationIcon(notif: Notification): React.ReactNode {
  // For comment notifications, prefer content type icon
  if (['comment_on_content', 'comment', 'comment_reply', 'mention'].includes(notif.type)) {
    const targetType = notif.meta?.target_type;
    if (targetType && CONTENT_TYPE_ICONS[targetType]) {
      return CONTENT_TYPE_ICONS[targetType];
    }
  }
  return TYPE_ICONS[notif.type] ?? <Bell className="h-4 w-4" />;
}
```

- [ ] **Step 4: Use getNotificationIcon in render**

Find where `TYPE_ICONS[notif.type]` or the icon map is used in the JSX. Replace with:
```tsx
{getNotificationIcon(notif)}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/mac/Documents/asuite/shell && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/mac/Documents/asuite/shell && git add src/components/shared/NotificationPanel.tsx src/lib/api/gateway.ts && git commit -m "feat(notifications): comment notifications show file-type icon based on meta.target_type"
```

---

## Final Verification

- [ ] **Verify A: Pin a doc from tree menu → appears in Pinned section, stays in Library**
- [ ] **Verify B: Pin from ContentDocView topbar more menu → same result**  
- [ ] **Verify C: Unpin → removed from Pinned section, still in Library**
- [ ] **Verify D: Create a comment on a doc → notification title shows "XXX 评论了《文件名》"**
- [ ] **Verify E: Notification shows FileText icon for doc, Table2 for table**
- [ ] **Verify F: Clicking notification still navigates to correct content**
