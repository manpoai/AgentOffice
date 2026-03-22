/**
 * Stub for @shared/utils/rfc6902
 * Used by: lib/prosemirror-recreate-transform/recreateTransform.ts
 */

export type Operation = {
  op: string;
  path: string;
  value?: unknown;
  from?: string;
};

export type ReplaceOperation = Operation & {
  op: "replace";
  value: unknown;
};

/**
 * Apply a JSON Patch (RFC 6902) to an object. Returns the patched object.
 */
export function applyPatch<T>(doc: T, patch: Operation[]): T {
  // Minimal implementation — deep clone and apply ops
  const result = JSON.parse(JSON.stringify(doc));
  for (const op of patch) {
    const pathParts = op.path.split("/").filter(Boolean);
    if (op.op === "replace" || op.op === "add") {
      let target = result;
      for (let i = 0; i < pathParts.length - 1; i++) {
        target = target[pathParts[i]];
      }
      target[pathParts[pathParts.length - 1]] = op.value;
    } else if (op.op === "remove") {
      let target = result;
      for (let i = 0; i < pathParts.length - 1; i++) {
        target = target[pathParts[i]];
      }
      const key = pathParts[pathParts.length - 1];
      if (Array.isArray(target)) {
        target.splice(Number(key), 1);
      } else {
        delete target[key];
      }
    }
  }
  return result;
}

/**
 * Create a JSON Patch (RFC 6902) representing the diff between two objects.
 */
export function createPatch(a: unknown, b: unknown): Operation[] {
  // Minimal diff — for recreateTransform this is sufficient
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  return [{ op: "replace", path: "", value: b }];
}
