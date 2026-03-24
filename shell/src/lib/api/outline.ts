/**
 * Outline API client — calls through /api/outline/* proxy
 * Note: Outline uses POST for most read operations
 */

const BASE = '/api/outline';

async function olFetch<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error(`Outline API ${path}: ${res.status}`);
  return res.json();
}

// ── Types ──

export interface OLDocument {
  id: string;
  title: string;
  text: string;
  emoji?: string;  // deprecated — Outline now uses 'icon'
  icon?: string;    // unicode emoji only (Outline rejects URLs)
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
  deletedAt: string | null;
  collectionId: string;
  parentDocumentId: string | null;
  createdBy: { id: string; name: string };
  updatedBy: { id: string; name: string };
  revision: number;
  fullWidth?: boolean;
  insightsEnabled?: boolean;
}

export interface OLCollection {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  documents: OLDocumentNode[];
}

export interface OLDocumentNode {
  id: string;
  title: string;
  url: string;
  children: OLDocumentNode[];
}

// ── API calls ──

export async function listDocuments(collectionId?: string): Promise<OLDocument[]> {
  const allDocs: OLDocument[] = [];
  let offset = 0;
  const limit = 100; // Outline max per request
  while (true) {
    const body: Record<string, unknown> = { limit, offset };
    if (collectionId) body.collectionId = collectionId;
    const data = await olFetch<{ data: OLDocument[]; pagination: { total: number } }>('documents.list', body);
    allDocs.push(...data.data);
    if (data.data.length < limit) break; // no more pages
    offset += limit;
  }
  return allDocs;
}

export async function getDocument(id: string): Promise<OLDocument> {
  const data = await olFetch<{ data: OLDocument }>('documents.info', { id });
  return data.data;
}

export async function listCollections(): Promise<OLCollection[]> {
  const data = await olFetch<{ data: OLCollection[] }>('collections.list', {});
  return data.data;
}

export async function searchDocuments(query: string): Promise<{ document: OLDocument; context: string }[]> {
  const data = await olFetch<{ data: { document: OLDocument; context: string }[] }>('documents.search', { query });
  return data.data;
}

export async function createDocument(title: string, text: string, collectionId: string, parentDocumentId?: string): Promise<OLDocument> {
  const body: Record<string, unknown> = { title, text, collectionId, publish: true };
  if (parentDocumentId) body.parentDocumentId = parentDocumentId;
  const data = await olFetch<{ data: OLDocument }>('documents.create', body);
  return data.data;
}

export async function moveDocument(id: string, parentDocumentId: string | null, collectionId?: string): Promise<void> {
  const body: Record<string, unknown> = { id };
  if (parentDocumentId) body.parentDocumentId = parentDocumentId;
  if (collectionId) body.collectionId = collectionId;
  await olFetch('documents.move', body);
}

export async function updateDocument(id: string, title?: string, text?: string, emoji?: string | null, opts?: { fullWidth?: boolean; insightsEnabled?: boolean }): Promise<OLDocument> {
  const body: Record<string, unknown> = { id };
  if (title !== undefined) body.title = title;
  if (text !== undefined) body.text = text;
  // Outline uses 'icon' field (unicode emoji only, rejects URLs)
  if (emoji !== undefined) body.icon = emoji || null;
  if (opts?.fullWidth !== undefined) body.fullWidth = opts.fullWidth;
  if (opts?.insightsEnabled !== undefined) body.insightsEnabled = opts.insightsEnabled;
  const data = await olFetch<{ data: OLDocument }>('documents.update', body);
  return data.data;
}

export async function deleteDocument(id: string): Promise<void> {
  await olFetch('documents.delete', { id });
}

export async function duplicateDocument(id: string): Promise<OLDocument> {
  const original = await getDocument(id);
  const newTitle = `${original.title} (copy)`;
  return createDocument(newTitle, original.text, original.collectionId, original.parentDocumentId || undefined);
}

// ── Revisions ──

export interface OLRevision {
  id: string;
  documentId: string;
  title: string;
  data: Record<string, unknown>; // ProseMirror JSON
  createdAt: string;
  createdBy: { id: string; name: string };
}

export async function listRevisions(documentId: string): Promise<OLRevision[]> {
  const data = await olFetch<{ data: OLRevision[] }>('revisions.list', { documentId });
  return data.data;
}

export async function restoreRevision(documentId: string, revisionId: string): Promise<OLDocument> {
  const data = await olFetch<{ data: OLDocument }>('documents.restore', { id: documentId, revisionId });
  return data.data;
}

// ── Comments ──

export interface OLComment {
  id: string;
  data: any; // ProseMirror JSON
  documentId: string;
  parentCommentId: string | null;
  createdById: string;
  resolvedById: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string };
  resolvedBy?: { id: string; name: string } | null;
}

export async function listComments(documentId: string): Promise<OLComment[]> {
  const data = await olFetch<{ data: OLComment[] }>('comments.list', { documentId });
  return data.data;
}

export async function updateComment(id: string, data: any): Promise<OLComment> {
  const res = await olFetch<{ data: OLComment }>('comments.update', { id, data });
  return res.data;
}

/** Convert plain text to ProseMirror JSON suitable for Outline comments */
export function textToProseMirror(text: string): any {
  const lines = text.split('\n');
  const content = lines.map(line => {
    if (!line) return { type: 'paragraph' };
    // Check for image markdown: ![alt](url)
    const parts: any[] = [];
    const imgRe = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let lastIdx = 0;
    let match;
    while ((match = imgRe.exec(line)) !== null) {
      if (match.index > lastIdx) {
        parts.push({ type: 'text', text: line.slice(lastIdx, match.index) });
      }
      parts.push({ type: 'image', attrs: { src: match[2], alt: match[1] } });
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < line.length) {
      parts.push({ type: 'text', text: line.slice(lastIdx) });
    }
    if (parts.length === 0) return { type: 'paragraph' };
    return { type: 'paragraph', content: parts };
  });
  return { type: 'doc', content };
}

/** Extract plain text from ProseMirror JSON */
export function proseMirrorToText(pmData: any): string {
  if (!pmData) return '';
  const extract = (node: any): string => {
    if (node.text) return node.text;
    if (node.type === 'image') return `![${node.attrs?.alt || ''}](${node.attrs?.src || ''})`;
    if (node.content) return node.content.map(extract).join('');
    return '';
  };
  if (pmData.content) {
    return pmData.content.map((block: any) => extract(block)).join('\n');
  }
  return extract(pmData);
}

export async function deleteComment(id: string): Promise<void> {
  await olFetch('comments.delete', { id });
}

export async function resolveComment(id: string): Promise<OLComment> {
  const res = await olFetch<{ data: OLComment }>('comments.resolve', { id });
  return res.data;
}

export async function unresolveComment(id: string): Promise<OLComment> {
  const res = await olFetch<{ data: OLComment }>('comments.unresolve', { id });
  return res.data;
}

/** Upload an attachment (image) to Outline using the two-step presigned upload flow.
 *  Step 1: POST /api/attachments.create (JSON) → get presigned S3 POST fields + attachment URL
 *  Step 2: POST to uploadUrl with presigned form fields + file
 *  Returns the attachment URL for use in documents. */
export async function uploadAttachment(file: File, documentId?: string): Promise<{ data: { url: string; name: string; size: number } }> {
  // Step 1: Create attachment record and get presigned upload details
  const createBody: Record<string, unknown> = {
    name: file.name || 'image.png',
    size: file.size,
    contentType: file.type || 'image/png',
    preset: 'documentAttachment',
  };
  if (documentId) createBody.documentId = documentId;

  const createRes = await fetch(`${BASE}/attachments.create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(createBody),
  });
  if (!createRes.ok) {
    const errText = await createRes.text().catch(() => '');
    throw new Error(`Outline attachment create: ${createRes.status} ${errText}`);
  }
  const createData = await createRes.json();
  const { uploadUrl, form: formFields, attachment } = createData.data;

  // Step 2: Upload file to S3 via presigned POST
  const uploadForm = new FormData();
  for (const [key, value] of Object.entries(formFields)) {
    uploadForm.append(key, value as string);
  }
  uploadForm.append('file', file);

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    body: uploadForm,
  });
  if (!uploadRes.ok && uploadRes.status !== 204) {
    const errText = await uploadRes.text().catch(() => '');
    throw new Error(`S3 upload failed: ${uploadRes.status} ${errText}`);
  }

  // Return the attachment URL (rewrite to go through our proxy)
  const url = attachment.url.startsWith('/api/')
    ? `${BASE}/${attachment.url.slice(5)}`  // /api/X → /api/outline/X
    : attachment.url;

  return { data: { url, name: attachment.name, size: attachment.size } };
}
