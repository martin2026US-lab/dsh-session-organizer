export const STATE_VERSION = 1;
export const UNGROUPED_WORKSPACE = "__ungrouped__";

const forbiddenKeys = new Set(["__proto__", "prototype", "constructor"]);

function cleanId(value, maxLength = 512) {
  if (typeof value !== "string") return undefined;
  const id = value.trim();
  if (!id || id.length > maxLength || id.includes("\0")) return undefined;
  return id;
}

export function normalizePinState(input) {
  const source = input && typeof input === "object" && input.groups && typeof input.groups === "object"
    ? input.groups
    : {};
  const groups = Object.create(null);
  const globallySeen = new Set();
  for (const [rawKey, rawIds] of Object.entries(source)) {
    const key = cleanId(rawKey, 256);
    if (!key || forbiddenKeys.has(key) || !Array.isArray(rawIds)) continue;
    const ids = [];
    for (const rawId of rawIds) {
      const id = cleanId(rawId);
      if (!id || globallySeen.has(id)) continue;
      globallySeen.add(id);
      ids.push(id);
    }
    if (ids.length > 0) groups[key] = ids;
  }
  return { version: STATE_VERSION, groups };
}

export function pinSession(input, sessionId, workspaceId = UNGROUPED_WORKSPACE) {
  const id = cleanId(sessionId);
  const group = cleanId(workspaceId, 256);
  if (!id) throw new Error("invalid session id");
  if (!group || forbiddenKeys.has(group)) throw new Error("invalid workspace id");
  const state = unpinSession(input, id);
  const existing = state.groups[group] ?? [];
  return normalizePinState({ ...state, groups: { ...state.groups, [group]: [id, ...existing] } });
}

export function unpinSession(input, sessionId) {
  const id = cleanId(sessionId);
  if (!id) throw new Error("invalid session id");
  const state = normalizePinState(input);
  const groups = Object.create(null);
  for (const [key, ids] of Object.entries(state.groups)) {
    const next = ids.filter((candidate) => candidate !== id);
    if (next.length > 0) groups[key] = next;
  }
  return { version: STATE_VERSION, groups };
}

export function reorderPinned(input, workspaceId, orderedIds) {
  const group = cleanId(workspaceId, 256);
  if (!group || forbiddenKeys.has(group) || !Array.isArray(orderedIds)) {
    throw new Error("invalid reorder request");
  }
  const state = normalizePinState(input);
  const current = state.groups[group] ?? [];
  const requested = orderedIds.map((value) => cleanId(value)).filter(Boolean);
  if (requested.length !== current.length || new Set(requested).size !== current.length) {
    throw new Error("reorder must contain every pinned session exactly once");
  }
  const currentSet = new Set(current);
  if (requested.some((id) => !currentSet.has(id))) {
    throw new Error("reorder contains an unknown pinned session");
  }
  return normalizePinState({ ...state, groups: { ...state.groups, [group]: requested } });
}
