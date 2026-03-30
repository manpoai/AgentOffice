/**
 * Baserow API adapter layer
 * Replaces NocoDB calls with Baserow REST API calls
 * Keeps the same gateway-facing interface
 */

const BR_URL = process.env.BASEROW_URL || 'http://localhost:8280';
const BR_EMAIL = process.env.BASEROW_EMAIL;
const BR_PASSWORD = process.env.BASEROW_PASSWORD;
const BR_DATABASE_ID = process.env.BASEROW_DATABASE_ID;
const BR_TOKEN = process.env.BASEROW_TOKEN; // Database token for row operations

// ─── Auth ─────────────────────────────────────────
let brJwt = null;
let brJwtExpiry = 0;
let brRefreshToken = null;

async function getBrJwt() {
  if (brJwt && Date.now() < brJwtExpiry - 60000) return brJwt;
  if (!BR_EMAIL || !BR_PASSWORD) return null;

  // Try refresh first
  if (brRefreshToken) {
    try {
      const res = await fetch(`${BR_URL}/api/user/token-refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: brRefreshToken }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.access_token) {
          brJwt = data.access_token;
          brRefreshToken = data.refresh_token || brRefreshToken;
          brJwtExpiry = Date.now() + 9 * 60 * 1000; // 9 min (Baserow access tokens are short-lived)
          return brJwt;
        }
      }
    } catch {}
  }

  // Full login
  const res = await fetch(`${BR_URL}/api/user/token-auth/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: BR_EMAIL, password: BR_PASSWORD }),
  });
  const data = await res.json();
  if (data.access_token || data.token) {
    brJwt = data.access_token || data.token;
    brRefreshToken = data.refresh_token || null;
    // Baserow access tokens expire in 10 min by default
    brJwtExpiry = Date.now() + 9 * 60 * 1000;
    console.log('[baserow] JWT refreshed');
  }
  return brJwt;
}

// ─── Generic API call ─────────────────────────────
async function br(method, path, body, { useToken = false, rawResponse = false } = {}) {
  let authHeader;
  if (useToken && BR_TOKEN) {
    authHeader = `Token ${BR_TOKEN}`;
  } else {
    const jwt = await getBrJwt();
    if (!jwt) return { status: 503, data: { error: 'BASEROW_NOT_CONFIGURED' } };
    authHeader = `JWT ${jwt}`;
  }

  const url = `${BR_URL}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
    signal: controller.signal,
  };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);

  try {
    const res = await fetch(url, opts);
    clearTimeout(timer);
    if (rawResponse) return res;
    const text = await res.text();
    try { return { status: res.status, data: JSON.parse(text) }; }
    catch { return { status: res.status, data: text }; }
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') return { status: 504, data: { error: 'BASEROW_TIMEOUT' } };
    return { status: 502, data: { error: err.message } };
  }
}

// ─── Field type mapping ───────────────────────────
// NocoDB uidt → Baserow field type
const UIDT_TO_BR = {
  'SingleLineText': 'text',
  'LongText': 'long_text',
  'Number': 'number',
  'Decimal': 'number',
  'Checkbox': 'boolean',
  'Date': 'date',
  'DateTime': 'date',
  'Email': 'email',
  'URL': 'url',
  'SingleSelect': 'single_select',
  'MultiSelect': 'multiple_select',
  'ID': 'autonumber',
  'AutoNumber': 'autonumber',
  'CreateTime': 'created_on',
  'LastModifiedTime': 'last_modified',
  'CreatedBy': 'text',       // Baserow doesn't have CreatedBy — use text
  'LastModifiedBy': 'text',  // Baserow doesn't have LastModifiedBy — use text
  'Formula': 'formula',
  'LinkToAnotherRecord': 'link_row',
  'Links': 'link_row',
  'Lookup': 'lookup',
  'Rollup': 'rollup',
  'Attachment': 'file',
  'Rating': 'rating',
  'PhoneNumber': 'phone_number',
  'Percent': 'number',
  'Duration': 'duration',
  'Currency': 'number',
};

// Baserow field type → NocoDB-style uidt (for response mapping)
const BR_TO_UIDT = {
  'text': 'SingleLineText',
  'long_text': 'LongText',
  'number': 'Number',
  'boolean': 'Checkbox',
  'date': 'Date',
  'email': 'Email',
  'url': 'URL',
  'single_select': 'SingleSelect',
  'multiple_select': 'MultiSelect',
  'autonumber': 'AutoNumber',
  'created_on': 'CreateTime',
  'last_modified': 'LastModifiedTime',
  'formula': 'Formula',
  'link_row': 'Links',
  'lookup': 'Lookup',
  'rollup': 'Rollup',
  'file': 'Attachment',
  'rating': 'Rating',
  'phone_number': 'PhoneNumber',
  'duration': 'Duration',
  'last_modified_by': 'LastModifiedBy',
  'created_by': 'CreatedBy',
  'uuid': 'SingleLineText',
  'auto_number': 'AutoNumber',
  'count': 'Number',
  'multiple_collaborators': 'User',
  'password': 'SingleLineText',
};

// ─── NocoDB where → Baserow filter params ─────────
// NocoDB where format: (field,op,value)~and(field2,op,value2)
// Baserow filter format: filter__field_{id}__{type}=value (query params)
// Since Baserow filters need field IDs, we'll use search_mode for simple cases
// and convert to Baserow view filters for complex cases
function parseNcWhere(where) {
  if (!where) return [];
  const filters = [];
  // Split on ~and or ~or
  const parts = where.split(/~(and|or)/);
  for (const part of parts) {
    if (part === 'and' || part === 'or') continue;
    const match = part.match(/^\((.+?),(eq|neq|like|nlike|gt|gte|lt|lte|is|isnot|null|notnull|in|notin),(.*)?\)$/);
    if (match) {
      filters.push({ field: match[1], op: match[2], value: match[3] || '' });
    }
  }
  return filters;
}

// Map NocoDB comparison operators to Baserow filter types
const NC_OP_TO_BR = {
  'eq': 'equal',
  'neq': 'not_equal',
  'like': 'contains',
  'nlike': 'contains_not',
  'gt': 'higher_than',
  'gte': 'higher_than_or_equal',
  'lt': 'lower_than',
  'lte': 'lower_than_or_equal',
  'is': 'equal',
  'isnot': 'not_equal',
  'null': 'empty',
  'notnull': 'not_empty',
  'in': 'contains',
};

// Baserow view type mapping
const BR_VIEW_TYPE_MAP = {
  'grid': 'grid',
  'gallery': 'gallery',
  'form': 'form',
  'kanban': 'kanban',
  'calendar': 'calendar',
};

// Baserow view type number → name (for response)
const BR_VIEW_TYPE_NUM = {
  'grid': 3,
  'gallery': 2,
  'form': 1,
  'kanban': 4,
  'calendar': 5,
};

// ─── Table metadata cache (field name→id mapping) ─
const tableFieldCache = new Map(); // tableId → { fields: [...], ts: number }
const CACHE_TTL = 60_000; // 1 minute

async function getTableFields(tableId) {
  const cached = tableFieldCache.get(String(tableId));
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.fields;
  const result = await br('GET', `/api/database/fields/table/${tableId}/`);
  if (result.status >= 400) return [];
  const fields = result.data || [];
  tableFieldCache.set(String(tableId), { fields, ts: Date.now() });
  return fields;
}

function invalidateFieldCache(tableId) {
  tableFieldCache.delete(String(tableId));
}

// Build field name→id map
async function getFieldMap(tableId) {
  const fields = await getTableFields(tableId);
  const map = {};
  for (const f of fields) {
    map[f.name] = f;
  }
  return map;
}

// ─── Row response normalization ───────────────────
// Baserow returns field names as keys (with user_field_names=true)
// NocoDB returns field names directly too, but the structure differs for:
// - Select fields: Baserow returns {id, value, color}, NocoDB returns the string value
// - Link fields: Baserow returns [{id, value}], NocoDB returns nested objects
// - File fields: different attachment format

function normalizeRowForGateway(row, fields) {
  const normalized = {};
  // Preserve the id as "Id" for NocoDB compat
  normalized.Id = row.id;
  // Preserve order if present
  if (row.order !== undefined) normalized.order = row.order;

  for (const field of fields) {
    const val = row[field.name];
    if (val === undefined) continue;

    if (field.type === 'single_select') {
      // Baserow: {id: 1, value: "Option", color: "blue"} or null
      normalized[field.name] = val ? val.value : null;
    } else if (field.type === 'multiple_select') {
      // Baserow: [{id: 1, value: "Option1"}, ...]
      normalized[field.name] = Array.isArray(val) ? val.map(v => v.value).join(',') : val;
    } else if (field.type === 'link_row') {
      // Baserow: [{id: 1, value: "display_value"}, ...]
      // NocoDB returns nested row objects, but gateway normalizes differently
      normalized[field.name] = val;
    } else if (field.type === 'file') {
      // Baserow: [{url, thumbnails, name, size, ...}]
      // NocoDB: [{path, title, mimetype, size}]
      if (Array.isArray(val)) {
        normalized[field.name] = val.map(f => ({
          path: f.url,
          title: f.name || f.original_name,
          mimetype: f.mime_type,
          size: f.size,
          url: f.url,
          thumbnails: f.thumbnails,
        }));
      } else {
        normalized[field.name] = val;
      }
    } else if (field.type === 'boolean') {
      normalized[field.name] = val;
    } else if (field.type === 'created_on' || field.type === 'last_modified') {
      normalized[field.name] = val;
    } else {
      normalized[field.name] = val;
    }
  }
  return normalized;
}

// ─── Row data normalization for Baserow input ─────
// Convert NocoDB-style row data to Baserow format
function normalizeRowForBaserow(rowData, fields) {
  const normalized = {};
  for (const [key, val] of Object.entries(rowData)) {
    // Skip system fields
    if (key === 'Id' || key === 'id' || key === 'order') continue;

    const field = fields.find(f => f.name === key);
    if (!field) {
      // Unknown field — pass through (Baserow will ignore unknown fields)
      normalized[key] = val;
      continue;
    }

    if (field.type === 'single_select') {
      // NocoDB accepts string, Baserow accepts string value or option ID
      // With user_field_names=true, Baserow accepts the option value string
      normalized[key] = val;
    } else if (field.type === 'multiple_select') {
      // NocoDB accepts comma-separated string, Baserow accepts array of values
      if (typeof val === 'string') {
        normalized[key] = val.split(',').map(v => v.trim()).filter(Boolean);
      } else {
        normalized[key] = val;
      }
    } else if (field.type === 'link_row') {
      // Baserow accepts array of row IDs
      if (Array.isArray(val)) {
        normalized[key] = val.map(v => typeof v === 'object' ? (v.Id || v.id) : v).filter(Boolean);
      } else {
        normalized[key] = val;
      }
    } else if (field.type === 'boolean') {
      normalized[key] = val === true || val === 'true' || val === 1 || val === '1';
    } else if (field.type === 'number') {
      // Ensure numeric value
      if (val !== null && val !== '' && val !== undefined) {
        const num = Number(val);
        normalized[key] = isNaN(num) ? val : num;
      } else {
        normalized[key] = null;
      }
    } else {
      normalized[key] = val;
    }
  }
  return normalized;
}

// ─── Build Baserow filter query params ────────────
// Baserow uses field-type-aware filter names for some types
function getBaserowFilterType(fieldType, ncOp) {
  const baseOp = NC_OP_TO_BR[ncOp] || 'equal';
  // Single/multiple select fields use prefixed filter types
  if (fieldType === 'single_select') {
    const selectOpMap = {
      'equal': 'single_select_equal',
      'not_equal': 'single_select_not_equal',
      'empty': 'single_select_is_none_of',
      'not_empty': 'single_select_is_any_of',
    };
    return selectOpMap[baseOp] || `single_select_${baseOp}`;
  }
  if (fieldType === 'multiple_select') {
    const selectOpMap = {
      'equal': 'multiple_select_has',
      'not_equal': 'multiple_select_has_not',
      'contains': 'multiple_select_has',
      'contains_not': 'multiple_select_has_not',
    };
    return selectOpMap[baseOp] || `multiple_select_${baseOp}`;
  }
  if (fieldType === 'boolean') {
    return 'boolean';
  }
  if (fieldType === 'link_row') {
    return `link_row_${baseOp === 'equal' ? 'has' : baseOp}`;
  }
  if (fieldType === 'date' || fieldType === 'last_modified' || fieldType === 'created_on') {
    return `date_${baseOp}`;
  }
  return baseOp;
}

function buildBaserowFilterParams(whereFilters, fieldMap) {
  const params = new URLSearchParams();
  for (const filter of whereFilters) {
    const field = fieldMap[filter.field];
    if (!field) continue;
    const brFilterType = getBaserowFilterType(field.type, filter.op);
    if (filter.op === 'null' || filter.op === 'notnull') {
      params.append(`filter__field_${field.id}__${brFilterType}`, '');
    } else {
      let filterValue = filter.value;
      // For single_select/multiple_select, resolve text value to option ID
      if ((field.type === 'single_select' || field.type === 'multiple_select') && field.select_options) {
        const opt = field.select_options.find(o => o.value === filterValue);
        if (opt) filterValue = String(opt.id);
      }
      params.append(`filter__field_${field.id}__${brFilterType}`, filterValue);
    }
  }
  return params;
}

// ─── Build Baserow order_by from NocoDB sort ──────
function buildBaserowOrderBy(sort, fieldMap) {
  if (!sort) return '';
  // NocoDB sort format: -fieldname (desc) or fieldname (asc), comma-separated
  return sort.split(',').map(s => {
    const desc = s.startsWith('-');
    const name = desc ? s.slice(1) : s;
    const field = fieldMap[name];
    if (!field) return desc ? `-${name}` : name;
    return desc ? `-field_${field.id}` : `field_${field.id}`;
  }).join(',');
}

// ─── Build Baserow field creation body ────────────
function buildFieldCreateBody(title, uidt, options = {}) {
  const brType = UIDT_TO_BR[uidt] || 'text';
  const body = { name: title, type: brType };

  // Select options
  if (brType === 'single_select' || brType === 'multiple_select') {
    if (options.options && options.options.length > 0) {
      body.select_options = options.options.map(o => ({
        value: typeof o === 'string' ? o : o.title,
        color: o.color || 'light-blue',
      }));
    }
  }

  // Number with decimal places
  if (brType === 'number') {
    if (options.meta?.decimals) {
      body.number_decimal_places = options.meta.decimals;
    }
    if (uidt === 'Decimal') {
      body.number_decimal_places = body.number_decimal_places || 2;
    }
  }

  // Link row
  if (brType === 'link_row' && options.childId) {
    body.link_row_table_id = parseInt(options.childId, 10);
    if (options.relationType === 'mm') {
      body.has_related_field = true;
    }
  }

  // Lookup
  if (brType === 'lookup' && options.fk_relation_column_id && options.fk_lookup_column_id) {
    body.through_field_id = parseInt(options.fk_relation_column_id, 10);
    body.target_field_id = parseInt(options.fk_lookup_column_id, 10);
  }

  // Formula
  if (brType === 'formula' && options.formula_raw) {
    body.formula = options.formula_raw;
  }

  // Rating
  if (uidt === 'Rating') {
    body.max_value = options.meta?.max || 5;
    body.style = options.meta?.style || 'star';
  }

  // Date
  if (brType === 'date') {
    body.date_format = 'ISO';
    if (uidt === 'DateTime') {
      body.date_include_time = true;
    }
  }

  return body;
}

// ─── Exports ──────────────────────────────────────
export {
  BR_URL, BR_EMAIL, BR_PASSWORD, BR_DATABASE_ID, BR_TOKEN,
  getBrJwt, br,
  UIDT_TO_BR, BR_TO_UIDT,
  parseNcWhere, NC_OP_TO_BR, buildBaserowFilterParams, buildBaserowOrderBy,
  BR_VIEW_TYPE_MAP, BR_VIEW_TYPE_NUM,
  getTableFields, invalidateFieldCache, getFieldMap,
  normalizeRowForGateway, normalizeRowForBaserow,
  buildFieldCreateBody,
};
