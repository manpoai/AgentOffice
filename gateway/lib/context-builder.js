/**
 * Build context_payload for comment events.
 * Provides structured context about the commented content for human and agent consumers.
 */

export function buildContextPayload(db, { targetType, targetId, anchorType, anchorId, anchorMeta, text, actorName, parentId }) {
  const target = buildTarget(db, targetType, targetId);
  const anchor = buildAnchor(db, targetType, targetId, anchorType, anchorId, anchorMeta);
  const summary = buildSummary(targetType, anchorType, text, actorName);
  const minimalContext = buildMinimalContext(db, targetType, targetId, anchorType, anchorId, parentId);
  const writeBackTarget = buildWriteBackTarget(targetId, anchorType, anchorId);
  const recentEdits = buildRecentEdits(db, targetId);

  return {
    version: 2,
    target,
    anchor,
    summary,
    minimal_required_context: minimalContext,
    write_back_target: writeBackTarget,
    recent_edits: recentEdits,
  };
}

function buildTarget(db, targetType, targetId) {
  let title = null;
  try {
    const item = db.prepare('SELECT title FROM content_items WHERE id = ?').get(targetId);
    title = item?.title || null;
  } catch { /* ignore */ }

  return {
    type: targetType,
    id: targetId,
    title,
  };
}

function buildAnchor(db, targetType, targetId, anchorType, anchorId, anchorMeta) {
  if (!anchorType || !anchorId) return null;

  switch (anchorType) {
    case 'row':
      return buildRowAnchor(db, targetId, anchorId);

    case 'text-range':
      return {
        type: 'text-range',
        id: anchorId,
        label: '文本选区',
        preview: anchorMeta?.quote ? String(anchorMeta.quote).substring(0, 100) : null,
        meta: {
          quote: anchorMeta?.quote || null,
          heading_path: anchorMeta?.heading_path || null,
        },
      };

    case 'image':
      return {
        type: 'image',
        id: anchorId,
        label: '图片',
        preview: anchorMeta?.alt_text || '图片',
        meta: {
          alt_text: anchorMeta?.alt_text || null,
          image_url: anchorMeta?.image_url || null,
        },
      };

    case 'table':
      return {
        type: 'table',
        id: anchorId,
        label: '表格',
        preview: anchorMeta?.preview || '内嵌表格',
        meta: {},
      };

    case 'diagram_embed':
      return {
        type: 'diagram_embed',
        id: anchorId,
        label: '流程图',
        preview: anchorMeta?.preview || '嵌入流程图',
        meta: {},
      };

    case 'mermaid':
      return {
        type: 'mermaid',
        id: anchorId,
        label: 'Mermaid 图',
        preview: anchorMeta?.code ? String(anchorMeta.code).substring(0, 80) : 'Mermaid 图',
        meta: {
          code: anchorMeta?.code || null,
        },
      };

    case 'slide':
      return {
        type: 'slide',
        id: anchorId,
        label: `第 ${Number(anchorId) + 1} 页`,
        preview: anchorMeta?.slide_title || `Slide ${Number(anchorId) + 1}`,
        meta: {
          slide_index: Number(anchorId),
          slide_title: anchorMeta?.slide_title || null,
        },
      };

    case 'element':
      return {
        type: 'element',
        id: anchorId,
        label: anchorMeta?.element_type || '元素',
        preview: anchorMeta?.preview || anchorMeta?.element_type || '元素',
        meta: {
          slide_index: anchorMeta?.slide_index != null ? anchorMeta.slide_index : null,
          element_type: anchorMeta?.element_type || null,
        },
      };

    case 'node':
      return {
        type: 'node',
        id: anchorId,
        label: '节点',
        preview: anchorMeta?.node_label || '流程图节点',
        meta: {
          node_label: anchorMeta?.node_label || null,
        },
      };

    case 'edge':
      return {
        type: 'edge',
        id: anchorId,
        label: '连线',
        preview: anchorMeta?.edge_label || '流程图连线',
        meta: {
          source_node_id: anchorMeta?.source_node_id || null,
          target_node_id: anchorMeta?.target_node_id || null,
          edge_label: anchorMeta?.edge_label || null,
        },
      };

    default:
      return { type: anchorType, id: anchorId, label: anchorType, preview: null, meta: {} };
  }
}

function buildRowAnchor(db, targetId, rowId) {
  return {
    type: 'row',
    id: rowId,
    label: `Row #${rowId}`,
    preview: `Row #${rowId}`,
    meta: {
      row_id: rowId,
      primary_text: null,
      fields: {},
    },
  };
}

function buildSummary(targetType, anchorType, text, actorName) {
  const typeLabel = { doc: '文档', table: '数据表', presentation: '演示文稿', diagram: '流程图' };
  let textSummary;
  if (!anchorType) {
    textSummary = `针对整个${typeLabel[targetType] || '内容'}的评论`;
  } else if (anchorType === 'row') {
    textSummary = '针对数据表行记录的评论';
  } else {
    textSummary = `针对${anchorType}的评论`;
  }

  return {
    comment_text: (text || '').substring(0, 200),
    comment_author: actorName,
    text_summary: textSummary,
  };
}

function buildMinimalContext(db, targetType, targetId, anchorType, anchorId, parentId) {
  const ctx = {};

  // Thread context: sibling comments in same thread
  if (parentId) {
    try {
      const siblings = db.prepare(
        'SELECT text, actor_id, created_at FROM comments WHERE parent_id = ? ORDER BY created_at ASC LIMIT 10'
      ).all(parentId);
      if (siblings.length > 0) {
        ctx.thread_comments = siblings.map(c => ({ actor: c.actor_id, text: c.text, at: c.created_at }));
      }
    } catch { /* ignore */ }
  }

  // Content snippet
  try {
    if (targetType === 'doc') {
      const item = db.prepare('SELECT text FROM content_items WHERE id = ?').get(targetId);
      if (item?.text) {
        if (anchorType === 'text-range' && anchorId) {
          // Try to extract surrounding context from the text
          const text = item.text;
          const idx = anchorId ? Math.max(0, text.indexOf(anchorId)) : 0;
          const start = Math.max(0, idx - 500);
          const end = Math.min(text.length, idx + 500);
          ctx.content_snippet = text.slice(start, end);
        } else {
          ctx.content_snippet = item.text.slice(0, 1000);
        }
      }
    } else if (targetType === 'table') {
      // For table+row anchor, get the row data
      if (anchorType === 'row' && anchorId) {
        const row = db.prepare('SELECT data FROM table_rows WHERE id = ? OR row_id = ?').get(anchorId, anchorId);
        if (row?.data) ctx.row_data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      }
    }
  } catch { /* ignore */ }

  return Object.keys(ctx).length > 0 ? ctx : null;
}

function buildWriteBackTarget(targetId, anchorType, anchorId) {
  return {
    target_id: targetId,
    anchor_type: anchorType || null,
    anchor_id: anchorId || null,
  };
}

function buildRecentEdits(db, targetId) {
  try {
    const revisions = db.prepare(
      'SELECT actor_id, created_at, description FROM content_revisions WHERE content_id = ? ORDER BY created_at DESC LIMIT 3'
    ).all(targetId);
    if (revisions.length === 0) return null;
    return revisions.map(r => ({ actor: r.actor_id, timestamp: r.created_at, description: r.description || null }));
  } catch {
    return null;
  }
}
