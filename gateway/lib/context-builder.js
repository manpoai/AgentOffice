/**
 * Build context_payload for comment events.
 * Provides structured context about the commented content for human and agent consumers.
 */

export function buildContextPayload(db, { targetType, targetId, anchorType, anchorId, anchorMeta, text, actorName }) {
  const target = buildTarget(db, targetType, targetId);
  const anchor = buildAnchor(db, targetType, targetId, anchorType, anchorId, anchorMeta);
  const summary = buildSummary(targetType, anchorType, text, actorName);

  return {
    version: 1,
    target,
    anchor,
    summary,
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
