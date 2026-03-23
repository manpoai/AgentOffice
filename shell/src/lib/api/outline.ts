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
  emoji?: string;
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
  const body: Record<string, unknown> = {};
  if (collectionId) body.collectionId = collectionId;
  const data = await olFetch<{ data: OLDocument[] }>('documents.list', body);
  return data.data;
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

export async function updateDocument(id: string, title?: string, text?: string, emoji?: string | null): Promise<OLDocument> {
  const body: Record<string, unknown> = { id };
  if (title !== undefined) body.title = title;
  if (text !== undefined) body.text = text;
  // Outline expects emoji as string or null to remove
  if (emoji !== undefined) body.emoji = emoji || null;
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
