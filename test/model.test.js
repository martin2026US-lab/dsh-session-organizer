import test from "node:test";
import assert from "node:assert/strict";
import { normalizePinState, pinSession, reorderPinned, unpinSession } from "../lib/model.js";
import { discoverDeletedSessionIds, runWithSessionQuiesced } from "../lib/index.js";

test("normalization removes duplicates and unsafe keys", () => {
  const groups = JSON.parse('{"__proto__":["bad"],"alpha":["s1","s1","s2"],"beta":["s2","s3"]}');
  const state = normalizePinState({ groups });
  assert.deepEqual({ ...state.groups }, { alpha: ["s1", "s2"], beta: ["s3"] });
});

test("pin moves a session to the front of exactly one workspace", () => {
  const state = pinSession({ groups: { a: ["s1", "s2"], b: ["s3"] } }, "s2", "b");
  assert.deepEqual({ ...state.groups }, { a: ["s1"], b: ["s2", "s3"] });
});

test("unpin removes a session and empty group", () => {
  const state = unpinSession({ groups: { a: ["s1"], b: ["s2"] } }, "s1");
  assert.deepEqual({ ...state.groups }, { b: ["s2"] });
});

test("reorder requires an exact permutation", () => {
  const state = reorderPinned({ groups: { a: ["s1", "s2", "s3"] } }, "a", ["s3", "s1", "s2"]);
  assert.deepEqual(state.groups.a, ["s3", "s1", "s2"]);
  assert.throws(() => reorderPinned(state, "a", ["s1", "s2"]), /exactly once/);
});

test("delete runs immediately for a cold session", async () => {
  const calls = [];
  const result = await runWithSessionQuiesced({ sessions: { get() {} } }, "s1", ({ wasLive }) => {
    calls.push(wasLive);
    return "deleted";
  });
  assert.equal(result, "deleted");
  assert.deepEqual(calls, [false]);
});

test("delete cancels, flushes, and closes the exact live writer", async () => {
  const calls = [];
  const live = {};
  const writer = { async close() { calls.push("close"); } };
  const agent = {
    session: live,
    cancel(cause) { calls.push(`cancel:${cause.kind}`); },
    async whenIdle() { calls.push("idle"); },
    async runMaintenance(operation) { calls.push("maintenance"); return operation(); }
  };
  const result = await runWithSessionQuiesced({
    sessions: {
      get() { return live; },
      async flush(session) { assert.equal(session, live); calls.push("flush"); }
    },
    agents: { get() { return agent; } },
    persistence: { tracker: { writers: new Map([["s1", writer]]) } }
  }, "s1", ({ wasLive }) => {
    calls.push(`delete:${wasLive}`);
    return "deleted";
  });
  assert.equal(result, "deleted");
  assert.deepEqual(calls, [
    "cancel:disposed",
    "idle",
    "maintenance",
    "flush",
    "close",
    "delete:true",
    "cancel:disposed"
  ]);
});

test("a failed live deletion restores the exact persistence writer", async () => {
  const calls = [];
  const live = {};
  const writer = { async close() { calls.push("close"); } };
  const persistence = {
    tracker: { writers: new Map([["s1", writer]]) },
    async open(id, access) {
      calls.push(`open:${id}:${access}`);
      return {};
    }
  };
  const agent = {
    session: live,
    cancel() { calls.push("cancel"); },
    async whenIdle() {},
    async runMaintenance(operation) { return operation(); }
  };
  await assert.rejects(runWithSessionQuiesced({
    sessions: { get: () => live, async flush() { calls.push("flush"); } },
    agents: { get: () => agent },
    persistence
  }, "s1", async () => {
    calls.push("delete");
    throw new Error("delete failed");
  }), /delete failed/);
  assert.deepEqual(calls, ["cancel", "flush", "close", "delete", "open:s1:write"]);
});

test("delete refuses a live session owned by another lifecycle", async () => {
  const live = {};
  await assert.rejects(
    runWithSessionQuiesced({
      sessions: { get() { return live; } },
      agents: { get() { return { session: {} }; } }
    }, "s1", async () => {}),
    /cannot be stopped safely/
  );
});

test("deleted-session recovery finds only live unowned sessions missing persistence", async () => {
  const sessions = [
    { id: "deleted", header: { cwd: "C:\\work" } },
    { id: "ungrouped", header: { cwd: "C:\\other" } },
    { id: "owned", header: { cwd: "C:\\owned" } }
  ];
  const discovered = await discoverDeletedSessionIds({
    registry: { list: () => [{ sessionIds: ["owned"] }] },
    sessions: { list: () => sessions },
    persistence: { stat: async (id) => id === "deleted" ? undefined : { header: { id } } }
  });
  assert.deepEqual(discovered, ["deleted"]);
});
