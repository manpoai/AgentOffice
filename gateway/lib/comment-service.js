import { emitCommentEvent } from './comment-events.js';
import { buildContextPayload } from './context-builder.js';

export function formatUnifiedCommentRow(r) {
  let anchorMeta = null;
  try { anchorMeta = r.anchor_meta ? JSON.parse(r.anchor_meta) : null; } catch { /* ignore */ }
  let contextPayload = null;
  try { contextPayload = r.context_payload ? JSON.parse(r.context_payload) : null; } catch { /* ignore */ }
  return {
    id: r.id,
    text: r.text,
    actor: r.latest_name || r.actor,
    actor_id: r.actor_id,
    actor_avatar_url: r.actor_avatar_url || null,
    actor_platform: r.actor_platform || null,
    parent_id: r.parent_id || null,
    resolved_by: r.resolved_by ? { id: r.resolved_by, name: r.resolved_by } : null,
    resolved_at: r.resolved_at || null,
    created_at: r.created_at,
    updated_at: r.updated_at,
    anchor_type: r.anchor_type || null,
    anchor_id: r.anchor_id || null,
    anchor_meta: anchorMeta,
    context_payload: contextPayload,
    data_json: r.data_json || null,
    target_type: r.target_type,
    target_id: r.target_id,
  };
}

export function listUnifiedComments(db, targetId, { anchorType, anchorId } = {}) {
  let query = 'SELECT c.*, a.display_name AS latest_name, a.avatar_url AS actor_avatar_url, a.platform AS actor_platform FROM comments c LEFT JOIN actors a ON a.id = c.actor_id WHERE c.target_id = ?';
  const params = [targetId];
  if (anchorType) { query += ' AND c.anchor_type = ?'; params.push(anchorType); }
  if (anchorId) { query += ' AND c.anchor_id = ?'; params.push(anchorId); }
  query += ' ORDER BY c.created_at ASC';
  const rows = db.prepare(query).all(...params);
  return rows.map(formatUnifiedCommentRow);
}

export function getUnifiedCommentById(db, commentId) {
  const row = db.prepare('SELECT c.*, a.display_name AS latest_name, a.avatar_url AS actor_avatar_url, a.platform AS actor_platform FROM comments c LEFT JOIN actors a ON a.id = c.actor_id WHERE c.id = ?').get(commentId);
  return row ? formatUnifiedCommentRow(row) : null;
}

export function createUnifiedComment(db, deps, opts) {
  const {
    genId, pushEvent, pushHumanEvent, humanClients, deliverWebhook,
  } = deps;
  const {
    targetType, targetId, text, parentId = null, anchorType = null, anchorId = null, anchorMeta = null,
    actorId, actorName, idPrefix = 'ccmt', dataJson = null,
  } = opts;

  const id = genId(idPrefix);
  const now = new Date().toISOString();
  const anchorMetaStr = anchorMeta ? JSON.stringify(anchorMeta) : null;
  const rowIdVal = anchorType === 'row' && anchorId ? anchorId : null;
  const dataJsonStr = dataJson ? JSON.stringify(dataJson) : null;
  const contentOwner = db.prepare('SELECT owner_actor_id FROM content_items WHERE id = ?').get(targetId);
  const contentTitle = db.prepare('SELECT title FROM content_items WHERE id = ?').get(targetId)?.title || '';
  const contextPayload = buildContextPayload(db, {
    targetType, targetId, anchorType, anchorId, anchorMeta, text, actorName,
  });
  db.prepare(`INSERT INTO comments (id, target_type, target_id, text, actor, actor_id, parent_id, anchor_type, anchor_id, anchor_meta, row_id, data_json, context_payload, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, targetType, targetId, text, actorName, actorId, parentId,
    anchorType, anchorId, anchorMetaStr, rowIdVal, dataJsonStr, JSON.stringify(contextPayload), now, now,
  );

  emitCommentEvent(db, {
    eventType: parentId ? 'comment.reply' : 'comment.created',
    commentId: id,
    targetType,
    targetId,
    anchorType,
    anchorId,
    text,
    parentId,
    actorId,
    actorName,
    ownerActorId: contentOwner?.owner_actor_id || null,
    targetTitle: contentTitle,
    contextPayload,
    genId,
    pushEvent,
    pushHumanEvent,
    deliverWebhook,
  });
  if (humanClients) for (const [aId] of humanClients) pushHumanEvent(aId, { event: 'comment.changed', data: { target_id: targetId } });
  return getUnifiedCommentById(db, id);
}

export function updateUnifiedCommentText(db, deps, commentId, text) {
  const { humanClients, pushHumanEvent } = deps;
  const now = new Date().toISOString();
  const toUpdate = db.prepare('SELECT target_id FROM comments WHERE id = ?').get(commentId);
  const result = db.prepare('UPDATE comments SET text = ?, updated_at = ? WHERE id = ?').run(text, now, commentId);
  if (result.changes === 0) return null;
  if (toUpdate && humanClients) for (const [aId] of humanClients) pushHumanEvent(aId, { event: 'comment.changed', data: { target_id: toUpdate.target_id } });
  return getUnifiedCommentById(db, commentId);
}

export function deleteUnifiedComment(db, deps, commentId) {
  const { humanClients, pushHumanEvent } = deps;
  const toDelete = db.prepare('SELECT target_id FROM comments WHERE id = ?').get(commentId);
  const result = db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
  if (result.changes === 0) return false;
  if (toDelete && humanClients) for (const [aId] of humanClients) pushHumanEvent(aId, { event: 'comment.changed', data: { target_id: toDelete.target_id } });
  return true;
}

export function setUnifiedCommentResolved(db, deps, commentId, resolved, actorId, actorName) {
  const { genId, pushEvent, pushHumanEvent, humanClients, deliverWebhook } = deps;
  const now = new Date().toISOString();
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);
  const result = resolved
    ? db.prepare('UPDATE comments SET resolved_by = ?, resolved_at = ?, updated_at = ? WHERE id = ?').run(actorName, now, now, commentId)
    : db.prepare('UPDATE comments SET resolved_by = NULL, resolved_at = NULL, updated_at = ? WHERE id = ?').run(now, commentId);
  if (result.changes === 0) return null;
  if (comment) {
    const owner = db.prepare('SELECT owner_actor_id FROM content_items WHERE id = ?').get(comment.target_id);
    emitCommentEvent(db, {
      eventType: resolved ? 'comment.resolved' : 'comment.unresolved',
      commentId,
      targetType: comment.target_type,
      targetId: comment.target_id,
      anchorType: comment.anchor_type || null,
      anchorId: comment.anchor_id || null,
      text: comment.text || '',
      parentId: comment.parent_id || null,
      actorId,
      actorName,
      ownerActorId: owner?.owner_actor_id || null,
      genId,
      pushEvent,
      pushHumanEvent,
      deliverWebhook,
    });
    if (humanClients) for (const [aId] of humanClients) pushHumanEvent(aId, { event: 'comment.changed', data: { target_id: comment.target_id } });
  }
  return getUnifiedCommentById(db, commentId);
}
