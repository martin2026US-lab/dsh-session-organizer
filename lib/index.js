import { mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative } from "node:path";
import { randomBytes } from "node:crypto";
import { normalizePinState, pinSession, reorderPinned, unpinSession } from "./model.js";

export const name = "dsh-session-organizer";
export const inject = [
  "webServer",
  "workspaceRegistry",
  "agents",
  "sessions",
  "sessionPersistence",
  "dshHomePath"
];

const API_PREFIX = "/session-organizer/api";
const SESSION_LOG_NAME = /^session(?:\.v\d+)?\.jsonl(?:\.zstd)?$/;

function service(ctx, key) {
  try {
    return typeof ctx.get === "function" ? ctx.get(key) : ctx[key];
  } catch {
    return ctx[key];
  }
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > 16 * 1024) throw new Error("request body exceeds 16 KiB");
    chunks.push(bytes);
  }
  if (size === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function requiredString(body, key) {
  const value = typeof body?.[key] === "string" ? body[key].trim() : "";
  if (!value || value.length > 512 || value.includes("\0")) throw new Error(`${key} is required`);
  return value;
}

function createPinFileStore(ctx) {
  const dshHomePath = service(ctx, "dshHomePath");
  if (typeof dshHomePath !== "function") throw new Error("dshHomePath service unavailable");
  const root = dshHomePath("plugins", "dsh-session-organizer");
  const file = join(root, "pins.json");
  let current;
  let chain = Promise.resolve();

  const load = async () => {
    if (current) return current;
    try {
      current = normalizePinState(JSON.parse(await readFile(file, "utf8")));
    } catch (error) {
      if (error?.code !== "ENOENT") ctx.logger.warn(`session-organizer: ignored invalid pin state: ${errorMessage(error)}`);
      current = normalizePinState(undefined);
    }
    return current;
  };

  const save = async (next) => {
    await mkdir(root, { recursive: true });
    const nonce = `${process.pid}-${randomBytes(6).toString("hex")}`;
    const temp = join(root, `.pins-${nonce}.tmp`);
    const backup = join(root, `.pins-${nonce}.bak`);
    await writeFile(temp, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    try {
      await rename(temp, file);
    } catch (error) {
      if (!["EEXIST", "EPERM"].includes(error?.code)) throw error;
      let movedPrevious = false;
      try {
        await rename(file, backup);
        movedPrevious = true;
      } catch (moveError) {
        if (moveError?.code !== "ENOENT") throw moveError;
      }
      try {
        await rename(temp, file);
      } catch (replaceError) {
        if (movedPrevious) {
          try {
            await rename(backup, file);
          } catch (rollbackError) {
            throw new AggregateError([replaceError, rollbackError], "pin state update failed and rollback was incomplete");
          }
        }
        throw replaceError;
      }
      if (movedPrevious) {
        try { await rm(backup, { force: true }); } catch (cleanupError) {
          ctx.logger.warn(`session-organizer: could not remove stale pin-state backup: ${errorMessage(cleanupError)}`);
        }
      }
    } finally {
      try { await rm(temp, { force: true }); } catch { /* best effort temporary-file cleanup */ }
    }
    current = next;
    return current;
  };

  const mutate = (operation) => {
    const pending = chain.then(async () => save(operation(await load())));
    chain = pending.catch(() => {});
    return pending;
  };

  return { load, mutate };
}

function archivedIds(registry) {
  try {
    const state = typeof registry.requireState === "function" ? registry.requireState() : registry.state;
    return Array.isArray(state?.archivedSessionIds) ? state.archivedSessionIds : [];
  } catch {
    return [];
  }
}

function liveSession(sessions, sessionId) {
  try {
    return sessions?.get?.(sessionId);
  } catch {
    return undefined;
  }
}

function sessionBusy(message) {
  const error = new Error(message);
  error.code = "SESSION_BUSY";
  return error;
}

async function settleWithin(promise, timeoutMs) {
  let timer;
  try {
    await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(sessionBusy("the session did not become idle before deletion")), timeoutMs);
      })
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function closeActivePersistenceWriter(persistence, sessionId) {
  // Harness' default JSONL backend deliberately keeps its writer private to the
  // Agent lifecycle.  There is not yet a public single-session close method, so
  // feature-detect the backend tracker and close only the exact target writer.
  // Other backends fall through: the subsequent atomic rename remains the
  // safety boundary and fails without changing registry state if a lock exists.
  const writers = persistence?.tracker?.writers;
  if (!(writers instanceof Map)) return false;
  const writer = writers.get(sessionId);
  if (writer === undefined || writer === null) return false;
  if (typeof writer.close !== "function") throw sessionBusy("the active persistence backend cannot safely release this session");
  await writer.close();
  return true;
}

async function restorePersistenceWriter(persistence, sessionId, originalError) {
  if (typeof persistence?.open !== "function") {
    throw new AggregateError(
      [originalError, new Error("the persistence backend cannot reopen the live session writer")],
      "deletion failed and the live persistence writer could not be restored"
    );
  }
  try {
    // JsonlBackendTracker retains the returned handle and routes later Session
    // events to it.  The normal session/disposed hook will close it eventually.
    await persistence.open(sessionId, "write");
  } catch (reopenError) {
    throw new AggregateError(
      [originalError, reopenError],
      "deletion failed and the live persistence writer could not be restored"
    );
  }
}

export async function runWithSessionQuiesced(services, sessionId, operation, options = {}) {
  const live = liveSession(services.sessions, sessionId);
  if (live === undefined) return operation({ wasLive: false });

  const agent = services.agents?.get?.(sessionId);
  if (agent === undefined || agent.session !== live || typeof agent.runMaintenance !== "function") {
    throw sessionBusy("the session is owned by a lifecycle that cannot be stopped safely");
  }

  const timeoutMs = options.timeoutMs ?? 15000;
  const startedAt = Date.now();
  for (;;) {
    agent.cancel({ kind: "disposed" });
    const remaining = Math.max(1, timeoutMs - (Date.now() - startedAt));
    await settleWithin(agent.whenIdle(), remaining);
    try {
      return await agent.runMaintenance(async () => {
        await services.sessions.flush(live);
        let writerClosed = false;
        try {
          writerClosed = await closeActivePersistenceWriter(services.persistence, sessionId);
        } catch (error) {
          await restorePersistenceWriter(services.persistence, sessionId, error);
          throw error;
        }
        let result;
        try {
          result = await operation({ wasLive: true });
        } catch (error) {
          if (writerClosed) await restorePersistenceWriter(services.persistence, sessionId, error);
          throw error;
        }
        // Clear input that could have arrived while deletion held maintenance.
        agent.cancel({ kind: "disposed" });
        return result;
      });
    } catch (error) {
      const raced = error instanceof Error && /already has active work/i.test(error.message);
      if (!raced || Date.now() - startedAt >= timeoutMs) throw error;
    }
  }
}

export async function discoverDeletedSessionIds(services, deletedSessionIds = new Set()) {
  const owned = new Set();
  for (const workspace of services.registry?.list?.() ?? []) {
    for (const sessionId of workspace.sessionIds ?? []) owned.add(sessionId);
  }
  for (const session of services.sessions?.list?.() ?? []) {
    if (owned.has(session.id) || session.header?.cwd === undefined || deletedSessionIds.has(session.id)) continue;
    let snapshot;
    try {
      snapshot = await services.persistence?.stat?.(session.id);
    } catch {
      continue;
    }
    // A normal newly-created or cold ungrouped session remains observable via
    // stat().  Missing persistence plus missing workspace membership identifies
    // an in-memory Agent left behind after this plugin completed a live delete.
    if (snapshot === undefined) deletedSessionIds.add(session.id);
  }
  return [...deletedSessionIds];
}

async function resolveSessionDirectory(ctx, sessionId) {
  const persistence = service(ctx, "sessionPersistence");
  const dshHomePath = service(ctx, "dshHomePath");
  if (!persistence || typeof persistence.stat !== "function") throw new Error("session persistence unavailable");
  const snapshot = await persistence.stat(sessionId);
  if (!snapshot || String(snapshot.header?.id ?? "") !== sessionId) throw new Error("session log does not exist");

  let logPath;
  if (typeof persistence.resolveCurrentLog === "function") {
    logPath = await persistence.resolveCurrentLog(sessionId);
  } else if (typeof persistence.locate === "function") {
    const location = persistence.locate(snapshot.header);
    logPath = location?.path;
  }
  if (typeof logPath !== "string" || !SESSION_LOG_NAME.test(logPath.split(/[\\/]/).pop() ?? "")) {
    throw new Error("the persistence backend did not expose a safe session artifact path");
  }

  const sessionsRoot = await realpath(dshHomePath("sessions"));
  const sessionDir = await realpath(dirname(logPath));
  const rel = relative(sessionsRoot, sessionDir);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new Error("refusing to delete outside the Harness sessions directory");
  return sessionDir;
}

async function deleteArchivedSession(ctx, pinStore, deletedSessionIds, sessionId) {
  const registry = service(ctx, "workspaceRegistry");
  const sessions = service(ctx, "sessions");
  const agents = service(ctx, "agents");
  const persistence = service(ctx, "sessionPersistence");
  if (!archivedIds(registry).includes(sessionId)) throw new Error("only archived sessions can be permanently deleted");
  const directory = await resolveSessionDirectory(ctx, sessionId);
  const owners = registry.list().filter((workspace) => workspace.sessionIds.includes(sessionId));
  const performDelete = async ({ wasLive }) => {
    const quarantine = `${directory}.delete-${randomBytes(6).toString("hex")}`;
    const detached = [];
    let unarchived = false;
    try {
      await rename(directory, quarantine);
    } catch (error) {
      if (wasLive && ["EPERM", "EBUSY", "EACCES"].includes(error?.code)) {
        throw sessionBusy("the live session storage could not be released safely");
      }
      throw error;
    }
    try {
      for (const workspace of owners) {
        await workspace.detachSession(sessionId);
        detached.push(workspace);
      }
      await registry.unarchiveSession(sessionId);
      unarchived = true;
      await rm(quarantine, { recursive: true, force: true });
    } catch (error) {
      const rollbackErrors = [];
      // Restore the durable artifact first: archiveSession checks that the
      // session still exists, and workspace attachment validates its cwd.
      try { await rename(quarantine, directory); } catch (rollback) { rollbackErrors.push(rollback); }
      if (unarchived) {
        try { await registry.archiveSession(sessionId); } catch (rollback) { rollbackErrors.push(rollback); }
      }
      for (const workspace of detached) {
        try { await workspace.attachSession(sessionId); } catch (rollback) { rollbackErrors.push(rollback); }
      }
      if (rollbackErrors.length > 0) throw new AggregateError([error, ...rollbackErrors], "deletion failed and rollback was incomplete");
      throw error;
    }
    return { sessionId, wasLive };
  };

  const result = await runWithSessionQuiesced({ sessions, agents, persistence }, sessionId, performDelete);
  deletedSessionIds.add(sessionId);

  try { await pinStore.mutate((state) => unpinSession(state, sessionId)); } catch (error) {
    ctx.logger.warn(`session-organizer: deleted session but could not remove its pin: ${errorMessage(error)}`);
  }
  try { ctx.emit("api-session/removed", sessionId); } catch { /* best effort client catalog invalidation */ }
  return result;
}

export function apply(ctx) {
  const pinStore = createPinFileStore(ctx);
  const deletedSessionIds = new Set();
  const webServer = service(ctx, "webServer");
  ctx.effect(() => webServer.register({
    kind: "prefix",
    path: API_PREFIX,
    handler: async (req, res) => {
      try {
        const url = new URL(req.url ?? "/", "http://localhost");
        const route = url.pathname.startsWith(API_PREFIX)
          ? url.pathname.slice(API_PREFIX.length) || "/"
          : "/";
        if (req.method === "GET" && route === "/state") {
          const discovered = await discoverDeletedSessionIds({
            registry: service(ctx, "workspaceRegistry"),
            sessions: service(ctx, "sessions"),
            persistence: service(ctx, "sessionPersistence")
          }, deletedSessionIds);
          return send(res, 200, { ok: true, state: await pinStore.load(), deletedSessionIds: discovered });
        }
        if (req.method !== "POST") return send(res, 405, { ok: false, error: "method not allowed" });
        const body = await readJsonBody(req);
        if (route === "/pin") {
          const sessionId = requiredString(body, "sessionId");
          const workspaceId = requiredString(body, "workspaceId");
          return send(res, 200, { ok: true, state: await pinStore.mutate((state) => pinSession(state, sessionId, workspaceId)) });
        }
        if (route === "/unpin") {
          const sessionId = requiredString(body, "sessionId");
          return send(res, 200, { ok: true, state: await pinStore.mutate((state) => unpinSession(state, sessionId)) });
        }
        if (route === "/reorder") {
          const workspaceId = requiredString(body, "workspaceId");
          if (!Array.isArray(body.orderedIds)) throw new Error("orderedIds is required");
          return send(res, 200, { ok: true, state: await pinStore.mutate((state) => reorderPinned(state, workspaceId, body.orderedIds)) });
        }
        if (route === "/delete") {
          const sessionId = requiredString(body, "sessionId");
          return send(res, 200, { ok: true, result: await deleteArchivedSession(ctx, pinStore, deletedSessionIds, sessionId) });
        }
        return send(res, 404, { ok: false, error: "route not found" });
      } catch (error) {
        ctx.logger.warn(`session-organizer request failed: ${errorMessage(error)}`);
        return send(res, 400, { ok: false, code: error?.code, error: errorMessage(error) });
      }
    }
  }), "session-organizer: web api");
}
