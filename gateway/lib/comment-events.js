/**
 * Shared comment event dispatcher.
 * Called by content.js, docs.js, and data.js after any comment mutation.
 */
import { insertNotification } from './notifications.js';

/**
 * Build a navigation link for a comment notification.
 */
export function buildCommentLink(targetId, anchorType, anchorId, commentId) {
  let link;
  if (targetId.startsWith('task:')) {
    const taskId = targetId.slice(5);
    link = `/tasks?id=${encodeURIComponent(taskId)}`;
  } else {
    link = `/content?id=${encodeURIComponent(targetId)}`;
  }
  if (anchorType && anchorId) {
    link += `${link.includes('?') ? '&' : '?'}anchor_type=${encodeURIComponent(anchorType)}&anchor_id=${encodeURIComponent(anchorId)}`;
  }
  if (commentId) {
    link += `${link.includes('?') ? '&' : '?'}comment_id=${encodeURIComponent(commentId)}`;
  }
  return link;
}

/**
 * Write a notification row for a human actor, using canonical i18n keys.
 * Wraps insertNotification with the comment-flow params contract.
 */
function createNotification(db, { genId, actorId, targetActorId, type, titleKey, titleParams, body, link, meta }) {
  insertNotification(db, { genId }, {
    actorId,
    targetActorId,
    type,
    titleKey,
    titleParams,
    bodyRaw: body || '',
    link,
    meta,
  });
}

/**
 * Emit a standard comment event and trigger notifications.
 *
 * @param {object} db - better-sqlite3 database instance
 * @param {object} opts
 *   eventType       - 'comment.created' | 'comment.reply' | 'comment.resolved' | 'comment.unresolved'
 *   commentId       - ID of the comment
 *   targetType      - 'doc' | 'table' | 'presentation' | 'diagram' | etc.
 *   targetId        - unified target_id (e.g. 'doc:xxx', 'table:xxx')
 *   anchorType      - optional anchor type ('row', 'text-range', etc.)
 *   anchorId        - optional anchor id
 *   text            - plain text content of the comment
 *   parentId        - parent comment id (for replies)
 *   actorId         - id of the actor who performed the action
 *   actorName       - display name of the actor
 *   genId           - id generator function
 *   pushEvent       - SSE push function
 *   deliverWebhook  - webhook delivery function
 */
export function emitCommentEvent(db, {
  eventType,
  commentId,
  targetType,
  targetId,
  anchorType,
  anchorId,
  text,
  parentId,
  actorId,
  actorName,
  ownerActorId,
  additionalOwnerIds = [],
  targetTitle,
  contextPayload,
  genId,
  pushEvent,
  pushHumanEvent,
  deliverWebhook,
}) {
  const nowMs = Date.now();
  const link = buildCommentLink(targetId, anchorType, anchorId, commentId);

  const basePayload = {
    comment_id: commentId,
    target_type: targetType,
    target_id: targetId,
    anchor_type: anchorType || null,
    anchor_id: anchorId || null,
    parent_id: parentId || null,
    text: text || '',
    actor: actorName,
    actor_id: actorId,
    context: contextPayload || null,
  };

  // Track already-notified actors to avoid duplicate notifications
  const notifiedActors = new Set();

  // ── 0. Notify content owners on new comment/reply ──
  // ownerActorId = primary owner (assignee for tasks, content owner for docs)
  // additionalOwnerIds = secondary owners (e.g. task creator)
  const allOwnerIds = [ownerActorId, ...additionalOwnerIds].filter(Boolean);
  const uniqueOwnerIds = [...new Set(allOwnerIds)];

  if (eventType === 'comment.created' || eventType === 'comment.reply') {
    for (const ownerId of uniqueOwnerIds) {
      if (ownerId === actorId) continue;
      if (notifiedActors.has(ownerId)) continue;
      try {
        const ownerActor = db.prepare("SELECT * FROM actors WHERE id = ?").get(ownerId);
        if (ownerActor?.type === 'human') {
          notifiedActors.add(ownerId);
          createNotification(db, {
            genId,
            actorId,
            targetActorId: ownerId,
            type: 'comment_on_content',
            titleKey: targetTitle
              ? 'serverNotifications.comments.comment_on_content_titled'
              : 'serverNotifications.comments.comment_on_content',
            titleParams: { actor: actorName, title: targetTitle || '' },
            body: contextPayload?.summary?.comment_text || (text || '').substring(0, 200),
            link,
            meta: {
              target_type: targetType,
              target_id: targetId,
              target_title: targetTitle || null,
            },
          });
          if (pushHumanEvent) pushHumanEvent(ownerId, { event: 'notification.created', data: { type: 'comment_on_content', target_actor_id: ownerId } });
        } else if (ownerActor?.type === 'agent' && pushEvent) {
          notifiedActors.add(ownerId);
          const evt = {
            event: 'comment.on_owned_content',
            source: 'comments',
            event_id: genId('evt'),
            timestamp: nowMs,
            data: { ...basePayload },
          };
          try {
            db.prepare(
              `INSERT INTO events (id, agent_id, event_type, source, occurred_at, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).run(evt.event_id, ownerActor.id, evt.event, evt.source, evt.timestamp, JSON.stringify(evt), nowMs);
          } catch (e) {
            console.error(`[comment-events] Owner event INSERT error: ${e.message}`);
          }
          pushEvent(ownerActor.id, evt);
          if (ownerActor.webhook_url && deliverWebhook) deliverWebhook(ownerActor, evt).catch(() => {});
          console.log(`[comment-events] comment.on_owned_content → ${ownerActor.username} (${targetId})`);
        }
      } catch (e) {
        console.error(`[comment-events] Owner notification error: ${e.message}`);
      }
    }
  }

  // ── 1. For comment.created / comment.reply: notify the parent comment author (reply notification) ──
  if ((eventType === 'comment.created' || eventType === 'comment.reply') && parentId) {
    try {
      const parentComment = db.prepare('SELECT actor_id, actor FROM comments WHERE id = ?').get(parentId);
      if (parentComment && parentComment.actor_id && parentComment.actor_id !== actorId && !notifiedActors.has(parentComment.actor_id)) {
        notifiedActors.add(parentComment.actor_id);
        const parentActor = db.prepare("SELECT * FROM actors WHERE id = ?").get(parentComment.actor_id);
        if (parentActor?.type === 'human') {
          createNotification(db, {
            genId,
            actorId,
            targetActorId: parentComment.actor_id,
            type: 'comment_reply',
            titleKey: 'serverNotifications.comments.comment_reply',
            titleParams: { actor: actorName },
            body: (text || '').substring(0, 200),
            link,
          });
          if (pushHumanEvent) pushHumanEvent(parentActor.id, { event: 'notification.created', data: { type: 'comment_reply', target_actor_id: parentActor.id } });
        } else if (parentActor?.type === 'agent' && pushEvent) {
          const evt = {
            event: 'comment.replied',
            source: 'comments',
            event_id: genId('evt'),
            timestamp: nowMs,
            data: { ...basePayload },
          };
          try {
            db.prepare(
              `INSERT INTO events (id, agent_id, event_type, source, occurred_at, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).run(evt.event_id, parentActor.id, evt.event, evt.source, evt.timestamp, JSON.stringify(evt), nowMs);
          } catch (e) {
            console.error(`[comment-events] Reply event INSERT error: ${e.message}`);
          }
          pushEvent(parentActor.id, evt);
          if (parentActor.webhook_url && deliverWebhook) deliverWebhook(parentActor, evt).catch(() => {});
          console.log(`[comment-events] comment.replied → ${parentActor.username} (${targetId})`);
        }
      }
    } catch (e) {
      console.error(`[comment-events] Reply notification error: ${e.message}`);
    }
  }

  // ── 2. @mention detection — agents and humans ──
  try {
    const allActors = db.prepare("SELECT * FROM actors WHERE type IN ('agent', 'human')").all();
    for (const target of allActors) {
      if (target.id === actorId) continue;
      if (notifiedActors.has(target.id)) continue;

      const mentionName = new RegExp(`@${escapeRegex(target.username)}(?![\\w-])`, 'i');
      const mentionDisplay = target.display_name
        ? new RegExp(`@${escapeRegex(target.display_name)}(?![\\w-])`, 'i')
        : null;
      if (!mentionName.test(text) && !(mentionDisplay && mentionDisplay.test(text))) continue;

      notifiedActors.add(target.id);

      if (target.type === 'agent' && pushEvent) {
        const evt = {
          event: 'comment.mentioned',
          source: 'comments',
          event_id: genId('evt'),
          timestamp: nowMs,
          data: { ...basePayload },
        };
        try {
          db.prepare(
            `INSERT INTO events (id, agent_id, event_type, source, occurred_at, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).run(evt.event_id, target.id, evt.event, evt.source, evt.timestamp, JSON.stringify(evt), nowMs);
        } catch (e) {
          console.error(`[comment-events] Event INSERT error: ${e.message}`);
        }
        pushEvent(target.id, evt);
        if (target.webhook_url && deliverWebhook) deliverWebhook(target, evt).catch(() => {});
        console.log(`[comment-events] comment.mentioned → ${target.username} (${targetId})`);
      }

      if (target.type === 'human') {
        createNotification(db, {
          genId,
          actorId,
          targetActorId: target.id,
          type: 'mention',
          titleKey: 'serverNotifications.comments.mention',
          titleParams: { actor: actorName },
          body: (text || '').substring(0, 200),
          link,
        });
        if (pushHumanEvent) pushHumanEvent(target.id, { event: 'notification.created', data: { type: 'mention', target_actor_id: target.id } });
      }
    }
  } catch (e) {
    console.error(`[comment-events] Mention detection error: ${e.message}`);
  }

  // ── 3. Resolved/unresolved: notify original comment author ──
  if (eventType === 'comment.resolved' || eventType === 'comment.unresolved') {
    try {
      const comment = db.prepare('SELECT actor_id, actor FROM comments WHERE id = ?').get(commentId);
      if (comment && comment.actor_id && comment.actor_id !== actorId) {
        const origActor = db.prepare("SELECT * FROM actors WHERE id = ?").get(comment.actor_id);
        if (origActor?.type === 'human') {
          const notifType = eventType === 'comment.resolved' ? 'comment_resolved' : 'comment_unresolved';
          createNotification(db, {
            genId,
            actorId,
            targetActorId: comment.actor_id,
            type: notifType,
            titleKey: eventType === 'comment.resolved'
              ? 'serverNotifications.comments.comment_resolved'
              : 'serverNotifications.comments.comment_unresolved',
            titleParams: { actor: actorName },
            body: (text || '').substring(0, 200),
            link,
          });
          if (pushHumanEvent) pushHumanEvent(origActor.id, { event: 'notification.created', data: { type: notifType, target_actor_id: origActor.id } });
        } else if (origActor?.type === 'agent' && pushEvent) {
          const evtType = eventType === 'comment.resolved' ? 'comment.resolved' : 'comment.unresolved';
          const evt = {
            event: evtType,
            source: 'comments',
            event_id: genId('evt'),
            timestamp: nowMs,
            data: { ...basePayload },
          };
          try {
            db.prepare(
              `INSERT INTO events (id, agent_id, event_type, source, occurred_at, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).run(evt.event_id, origActor.id, evt.event, evt.source, evt.timestamp, JSON.stringify(evt), nowMs);
          } catch (e) {
            console.error(`[comment-events] Resolve event INSERT error: ${e.message}`);
          }
          pushEvent(origActor.id, evt);
          if (origActor.webhook_url && deliverWebhook) deliverWebhook(origActor, evt).catch(() => {});
          console.log(`[comment-events] ${evtType} → ${origActor.username} (${targetId})`);
        }
      }
    } catch (e) {
      console.error(`[comment-events] Resolve notification error: ${e.message}`);
    }
  }
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
