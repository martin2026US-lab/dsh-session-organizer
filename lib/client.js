window.__ModuleLoader__.load({
  id: "dsh-session-organizer",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    const React = require("react");
    const ReactDOM = require("react-dom");
    const { useEffect, useMemo, useRef, useState, useSyncExternalStore } = React;
    const h = React.createElement;

    const NS = "sessionOrganizer";
    const API = "/session-organizer/api";
    const UNGROUPED = "__ungrouped__";
    const PACKAGE = "dsh-session-organizer";

    const zh = {
      "pins.heading": "置顶",
      "pins.empty": "暂无置顶对话",
      "pins.ungrouped": "未分组",
      "pins.pin": "置顶对话",
      "pins.unpin": "取消置顶",
      "pins.open": "打开 {title}",
      "pins.drag": "拖动调整 {title} 的顺序",
      "delete.button": "删除",
      "delete.aria": "永久删除 {title}",
      "delete.title": "永久删除会话？",
      "delete.warning": "此操作会永久删除该会话的全部历史记录，无法撤销。",
      "delete.target": "即将删除：{title}",
      "delete.cancel": "取消",
      "delete.confirm": "永久删除",
      "delete.deleting": "正在删除…",
      "delete.busy": "会话仍被其他窗口或任务占用，请关闭相关视图或等待任务停止后重试。",
      "delete.navigationFailed": "无法先切换到新对话，已取消删除。请关闭当前会话后重试。",
      "delete.failure": "删除失败：{message}"
    };
    const en = {
      "pins.heading": "Pinned",
      "pins.empty": "No pinned sessions",
      "pins.ungrouped": "Ungrouped",
      "pins.pin": "Pin session",
      "pins.unpin": "Unpin session",
      "pins.open": "Open {title}",
      "pins.drag": "Drag to reorder {title}",
      "delete.button": "Delete",
      "delete.aria": "Permanently delete {title}",
      "delete.title": "Permanently delete session?",
      "delete.warning": "This permanently removes the complete session history and cannot be undone.",
      "delete.target": "Session: {title}",
      "delete.cancel": "Cancel",
      "delete.confirm": "Delete permanently",
      "delete.deleting": "Deleting…",
      "delete.busy": "The session is still held by another view or task. Close it or wait for the task to stop, then retry.",
      "delete.navigationFailed": "Could not switch to a new session, so deletion was cancelled. Close the current session and retry.",
      "delete.failure": "Delete failed: {message}"
    };

    const CSS = `
      .dso-unifiedScroller{overflow-y:auto!important;overscroll-behavior:contain}
      .dso-unifiedScroller>[role="tree"]{flex:none!important;height:auto!important;min-height:0!important;overflow:visible!important}
      [data-dso-pinned-mount]{flex:none;min-width:0}
      .dso-pins{margin:0 8px 8px;padding:0 0 8px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.2));overflow:visible;color:var(--dsw-alias-label-primary,#222)}
      .dso-pinsHeader{display:flex;align-items:center;gap:6px;padding:6px 8px 5px;color:var(--dsw-alias-label-tertiary,#8a8a8a);font-size:12px;font-weight:600;letter-spacing:.02em}
      .dso-pinsHeader svg{flex:none}.dso-pinEmpty{padding:5px 8px 7px;color:var(--dsw-alias-label-tertiary,#999);font-size:12px}
      .dso-pinGroup{display:flex;flex-direction:column;gap:2px;margin-top:4px}.dso-pinGroupLabel{display:flex;align-items:center;gap:6px;padding:3px 8px 2px;color:var(--dsw-alias-label-primary,#333);font-size:13px;font-weight:650;line-height:18px;white-space:nowrap;overflow:hidden}.dso-pinGroupLabel svg{flex:none;color:var(--dsw-alias-label-secondary,#74777d)}.dso-pinGroupLabel span{min-width:0;overflow:hidden;text-overflow:ellipsis}
      .dso-pinRow{display:grid;grid-template-columns:minmax(0,1fr) 24px;gap:4px;margin:0 2px;padding:5px 5px 6px 8px;border:1px solid transparent;border-radius:8px;background:transparent;cursor:grab;user-select:none;touch-action:none}
      .dso-pinRow:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.10))}.dso-pinRow[data-drag-over=true]{border-color:var(--dsw-alias-accent-primary,#356ae6);background:var(--dsw-alias-accent-primary-bg,rgba(53,106,230,.08))}.dso-pinRow[data-dragging=true]{opacity:.45;cursor:grabbing}
      .dso-pinMain{min-width:0}.dso-pinTitle{display:block;font-size:13px;font-weight:500;line-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dso-unpin{align-self:center;width:24px;height:24px;padding:0;border:0;border-radius:6px;background:transparent;color:#d79b16;cursor:pointer;font-size:16px;line-height:24px}.dso-unpin:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.14))}
      .dso-dangerButton{color:var(--dsw-alias-state-error-primary,#d92d20)!important;border-color:var(--dsw-alias-state-error-primary,#d92d20)!important}.dso-dangerButton:hover{background:rgba(217,45,32,.08)!important}
      .dso-dialogLayer{position:fixed;inset:0;z-index:11000;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.34)}
      .dso-dialog{width:min(430px,calc(100vw - 32px));overflow:hidden;border:1px solid rgba(217,45,32,.42);border-radius:14px;background:var(--dsw-alias-surface-l1,#fff);color:var(--dsw-alias-label-primary,#202020);box-shadow:0 24px 72px rgba(0,0,0,.28)}
      .dso-dialogHeader{display:flex;align-items:center;gap:10px;padding:18px 20px 12px;color:var(--dsw-alias-state-error-primary,#d92d20)}.dso-dialogHeader h2{margin:0;font-size:17px;line-height:24px}.dso-dialogBody{display:flex;flex-direction:column;gap:10px;padding:0 20px 18px}.dso-dialogWarning{padding:11px 12px;border-radius:9px;background:rgba(217,45,32,.09);color:var(--dsw-alias-state-error-primary,#b42318);font-size:13px;line-height:19px}.dso-dialogTarget{font-size:13px;color:var(--dsw-alias-label-secondary,#666);overflow-wrap:anywhere}.dso-dialogError{font-size:12px;color:var(--dsw-alias-state-error-primary,#d92d20)}
      .dso-dialogFooter{display:flex;justify-content:flex-end;gap:8px;padding:12px 20px 18px}.dso-dialogButton{min-height:34px;padding:5px 14px;border:1px solid var(--dsw-alias-border-l2,#ddd);border-radius:8px;background:var(--dsw-alias-surface-l1,#fff);color:inherit;cursor:pointer}.dso-dialogButton:disabled{opacity:.55;cursor:not-allowed}.dso-dialogConfirm{border-color:#d92d20;background:#d92d20;color:#fff}.dso-dialogConfirm:hover:not(:disabled){background:#b42318}
    `;

    function interpolate(template, values) {
      return Object.entries(values ?? {}).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);
    }

    async function request(route, body) {
      const response = await fetch(`${API}${route}`, body === undefined ? {
        method: "GET",
        credentials: "same-origin"
      } : {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok !== true) {
        const error = new Error(payload?.error || `request failed (${response.status})`);
        error.code = payload?.code;
        throw error;
      }
      return payload;
    }

    function createPinStore() {
      let snapshot = { loaded: false, loading: false, state: { version: 1, groups: {} }, deletedSessionIds: [], error: null };
      const listeners = new Set();
      const publish = (patch) => {
        snapshot = { ...snapshot, ...patch };
        for (const listener of listeners) listener();
      };
      const update = async (route, body) => {
        const payload = await request(route, body);
        publish({ loaded: true, loading: false, state: payload.state, error: null });
        return payload.state;
      };
      return {
        getSnapshot: () => snapshot,
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
        async load(force = false) {
          if (!force && (snapshot.loaded || snapshot.loading)) return snapshot.state;
          publish({ loading: true, error: null });
          try {
            const payload = await request("/state");
            publish({
              loaded: true,
              loading: false,
              state: payload.state,
              deletedSessionIds: Array.isArray(payload.deletedSessionIds) ? payload.deletedSessionIds : [],
              error: null
            });
            return payload.state;
          } catch (error) {
            publish({ loaded: false, loading: false, error: error instanceof Error ? error.message : String(error) });
            throw error;
          }
        },
        pin(sessionId, workspaceId) { return update("/pin", { sessionId, workspaceId }); },
        unpin(sessionId) { return update("/unpin", { sessionId }); },
        reorder(workspaceId, orderedIds) { return update("/reorder", { workspaceId, orderedIds }); },
        markDeleted(sessionId) {
          if (snapshot.deletedSessionIds.includes(sessionId)) return;
          publish({ deletedSessionIds: [...snapshot.deletedSessionIds, sessionId] });
        }
      };
    }

    const pinStore = createPinStore();
    const usePins = () => useSyncExternalStore(pinStore.subscribe, pinStore.getSnapshot, pinStore.getSnapshot);

    function StarIcon({ filled = false }) {
      return h("svg", { width: 14, height: 14, viewBox: "0 0 16 16", fill: filled ? "currentColor" : "none", "aria-hidden": "true" },
        h("path", { d: "M8 1.45l1.93 3.91 4.32.63-3.13 3.05.74 4.3L8 11.31l-3.86 2.03.74-4.3L1.75 5.99l4.32-.63L8 1.45z", stroke: "currentColor", strokeWidth: 1.25, strokeLinejoin: "round" })
      );
    }

    function TrashIcon() {
      return h("svg", { width: 20, height: 20, viewBox: "0 0 20 20", fill: "none", "aria-hidden": "true" },
        h("path", { d: "M3.5 5.5h13M8 2.75h4M5.5 5.5l.65 10.25h7.7L14.5 5.5M8 8.25v4.75M12 8.25v4.75", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" })
      );
    }

    function FolderIcon() {
      return h("svg", { width: 15, height: 15, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true" },
        h("path", { d: "M1.75 4.25c0-.83.67-1.5 1.5-1.5h2.32c.43 0 .84.19 1.12.51l.66.74h5.4c.83 0 1.5.67 1.5 1.5v5.75c0 1.1-.9 2-2 2h-9c-.83 0-1.5-.67-1.5-1.5v-7.5Z", stroke: "currentColor", strokeWidth: 1.35, strokeLinecap: "round", strokeLinejoin: "round" })
      );
    }

    function workspaceIdOf(workspace) {
      return workspace?.workspaceId ?? workspace?.id;
    }

    function titleOf(summary) {
      return summary?.displayTitle || summary?.title || summary?.id || "";
    }

    function buildPinnedGroups(pinState, sessions, workspaceSnapshot, t) {
      const items = Array.isArray(workspaceSnapshot?.items) ? workspaceSnapshot.items : [];
      const byId = sessions?.byId ?? {};
      const archived = new Set(workspaceSnapshot?.archivedSessionIds ?? []);
      const rank = new Map(items.map((workspace, index) => [workspaceIdOf(workspace), index]));
      const groups = Object.entries(pinState?.groups ?? {}).map(([workspaceId, ids]) => {
        const workspace = items.find((item) => workspaceIdOf(item) === workspaceId);
        const label = workspace?.title || (workspaceId === UNGROUPED ? t("pins.ungrouped") : workspaceId);
        const rows = ids.flatMap((id) => {
          const summary = byId[id];
          return summary && !archived.has(id) ? [{ id, title: titleOf(summary) }] : [];
        });
        return { workspaceId, label, rows, order: rank.get(workspaceId) ?? Number.MAX_SAFE_INTEGER };
      }).filter((group) => group.rows.length > 0);
      return groups.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
    }

    function PinnedBoard({ sessions, workspaces, t, onOpen }) {
      const pins = usePins();
      const groups = useMemo(() => buildPinnedGroups(pins.state, sessions, workspaces, t), [pins.state, sessions, workspaces, t]);
      const [dragging, setDragging] = useState(null);
      const [over, setOver] = useState(null);
      const suppressClick = useRef(false);
      const dragMoved = useRef(false);
      const reorder = async (workspaceId, sourceId, targetId) => {
        if (sourceId === targetId) return;
        const order = [...(pins.state.groups?.[workspaceId] ?? [])];
        const from = order.indexOf(sourceId);
        const to = order.indexOf(targetId);
        if (from < 0 || to < 0) return;
        order.splice(to, 0, order.splice(from, 1)[0]);
        await pinStore.reorder(workspaceId, order);
      };
      useEffect(() => {
        if (dragging?.mode !== "pointer") return undefined;
        const findTarget = (event) => {
          if (event.pointerId !== dragging.pointerId) return undefined;
          const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.(".dso-pinRow");
          if (!target || target.dataset.workspaceId !== dragging.workspaceId) return undefined;
          return target.dataset.sessionId;
        };
        const onMove = (event) => {
          if (event.pointerId !== dragging.pointerId) return;
          const moved = Math.hypot(event.clientX - dragging.x, event.clientY - dragging.y) >= 4;
          if (moved) dragMoved.current = true;
          const targetId = moved ? findTarget(event) : undefined;
          setOver(targetId ? { id: targetId, workspaceId: dragging.workspaceId } : null);
        };
        const finish = (event, cancelled = false) => {
          if (event.pointerId !== dragging.pointerId) return;
          const targetId = cancelled ? undefined : findTarget(event);
          const shouldReorder = Boolean(targetId && targetId !== dragging.id);
          suppressClick.current = dragMoved.current;
          setDragging(null);
          setOver(null);
          if (shouldReorder) {
            void reorder(dragging.workspaceId, dragging.id, targetId)
              .catch((reason) => console.warn("session reorder rejected:", reason));
          }
        };
        const cancel = (event) => finish(event, true);
        document.addEventListener("pointermove", onMove, true);
        document.addEventListener("pointerup", finish, true);
        document.addEventListener("pointercancel", cancel, true);
        return () => {
          document.removeEventListener("pointermove", onMove, true);
          document.removeEventListener("pointerup", finish, true);
          document.removeEventListener("pointercancel", cancel, true);
        };
      }, [dragging, pins.state]);
      const row = (group, item) => h("div", {
        key: item.id,
        className: "dso-pinRow",
        "data-session-id": item.id,
        "data-workspace-id": group.workspaceId,
        "data-dragging": dragging?.id === item.id ? "true" : "false",
        "data-drag-over": over?.id === item.id ? "true" : "false",
        role: "button",
        tabIndex: 0,
        "aria-label": interpolate(t("pins.drag"), { title: item.title }),
        onClick: (event) => {
          if (suppressClick.current) {
            suppressClick.current = false;
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onOpen(item.id);
        },
        onKeyDown: (event) => {
          if (event.target !== event.currentTarget || !["Enter", " "].includes(event.key)) return;
          event.preventDefault();
          onOpen(item.id);
        },
        onPointerDown: (event) => {
          if (event.button !== 0 || event.target.closest?.(".dso-unpin")) return;
          suppressClick.current = false;
          dragMoved.current = false;
          event.currentTarget.setPointerCapture?.(event.pointerId);
          setDragging({ id: item.id, workspaceId: group.workspaceId, mode: "pointer", pointerId: event.pointerId, x: event.clientX, y: event.clientY });
        }
      },
        h("div", { className: "dso-pinMain" },
          h("span", { className: "dso-pinTitle", title: item.title }, item.title)
        ),
        h("button", {
          type: "button",
          className: "dso-unpin",
          title: t("pins.unpin"),
          "aria-label": `${t("pins.unpin")}：${item.title}`,
          onClick: (event) => {
            event.stopPropagation();
            void pinStore.unpin(item.id).catch((reason) => console.warn("session unpin rejected:", reason));
          }
        }, "★")
      );
      return h("section", { className: "dso-pins", "aria-label": t("pins.heading") },
        h("div", { className: "dso-pinsHeader" }, h(StarIcon, { filled: true }), h("span", null, t("pins.heading"))),
        groups.length === 0
          ? h("div", { className: "dso-pinEmpty" }, t("pins.empty"))
          : groups.map((group) => h("div", { key: group.workspaceId, className: "dso-pinGroup" },
              h("div", { className: "dso-pinGroupLabel", title: group.label }, h(FolderIcon), h("span", null, group.label)),
              group.rows.map((item) => row(group, item))
            ))
      );
    }

    function DeleteDialog({ target, t, onClose, onBeforeDelete, onDeleted }) {
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState(null);
      useEffect(() => {
        const onKey = (event) => {
          if (event.key === "Escape" && !busy) onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
      }, [busy, onClose]);
      const remove = async () => {
        setBusy(true);
        setError(null);
        try {
          await onBeforeDelete(target);
          await request("/delete", { sessionId: target.id });
          await onDeleted(target.id);
          onClose();
        } catch (reason) {
          setError(reason?.code === "SESSION_BUSY" ? t("delete.busy") : (reason instanceof Error ? reason.message : String(reason)));
          setBusy(false);
        }
      };
      return h("div", { className: "dso-dialogLayer", onMouseDown: (event) => { if (event.target === event.currentTarget && !busy) onClose(); } },
        h("div", { className: "dso-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "dso-delete-title" },
          h("div", { className: "dso-dialogHeader" }, h(TrashIcon), h("h2", { id: "dso-delete-title" }, t("delete.title"))),
          h("div", { className: "dso-dialogBody" },
            h("div", { className: "dso-dialogWarning" }, t("delete.warning")),
            h("div", { className: "dso-dialogTarget" }, interpolate(t("delete.target"), { title: target.title })),
            error ? h("div", { className: "dso-dialogError" }, interpolate(t("delete.failure"), { message: error })) : null
          ),
          h("div", { className: "dso-dialogFooter" },
            h("button", { type: "button", className: "dso-dialogButton", disabled: busy, onClick: onClose }, t("delete.cancel")),
            h("button", { type: "button", className: "dso-dialogButton dso-dialogConfirm", disabled: busy, onClick: remove }, busy ? t("delete.deleting") : t("delete.confirm"))
          )
        )
      );
    }

    function directTextChild(row) {
      for (const child of row?.children ?? []) {
        const text = child.textContent?.trim();
        if (text && !child.querySelector("button")) return text;
      }
      return "";
    }

    function rowContext(row, sessions, workspaces) {
      const title = directTextChild(row);
      const items = Array.isArray(workspaces?.items) ? workspaces.items : [];
      const byId = sessions?.byId ?? {};
      const group = row?.parentElement?.parentElement;
      const projectRow = group?.querySelector?.('[role="treeitem"][aria-expanded]');
      const workspaceTitle = directTextChild(projectRow);
      const workspaceMatches = workspaceTitle ? items.filter((item) => item.title === workspaceTitle) : [];
      const workspace = workspaceMatches.length === 1 ? workspaceMatches[0] : undefined;
      const candidateIds = workspace
        ? workspace.sessionIds ?? []
        : sessions?.ids ?? Object.keys(byId);
      const candidates = candidateIds.filter((id) => titleOf(byId[id]) === title);
      if (candidates.length !== 1) return undefined;
      return { sessionId: candidates[0], workspaceId: workspaceIdOf(workspace) || UNGROUPED, title };
    }

    function closestOpenSessionRow(menu, sessions, workspaces) {
      const menuRect = menu.getBoundingClientRect();
      const buttons = [...document.querySelectorAll('button[aria-label*="的操作"],button[aria-label*="actions"],button[aria-label*="Actions"]')]
        .filter((button) => button.closest('[role="treeitem"]'));
      let best;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const button of buttons) {
        const rect = button.getBoundingClientRect();
        const distance = Math.abs(rect.right - menuRect.left) + Math.abs(rect.top - menuRect.top);
        if (distance < bestDistance) { best = button; bestDistance = distance; }
      }
      return best ? rowContext(best.closest('[role="treeitem"]'), sessions, workspaces) : undefined;
    }

    function fitMenuWithinViewport(menu) {
      requestAnimationFrame(() => {
        if (!menu.isConnected) return;
        const margin = 8;
        menu.style.maxHeight = `calc(100vh - ${margin * 2}px)`;
        menu.style.overflowY = "auto";
        const rect = menu.getBoundingClientRect();
        let top = Number.parseFloat(menu.style.top);
        if (!Number.isFinite(top)) top = rect.top;
        if (rect.bottom > window.innerHeight - margin) top -= rect.bottom - (window.innerHeight - margin);
        if (top < margin) top = margin;
        menu.style.top = `${Math.round(top)}px`;
      });
    }

    function appendPinMenuItems({ sessions, workspaces, pinState, t }) {
      for (const menu of document.querySelectorAll('[role="menu"]')) {
        if (menu.querySelector("[data-dso-pin-menu]")) {
          fitMenuWithinViewport(menu);
          continue;
        }
        const items = [...menu.querySelectorAll('[role="menuitem"]')];
        if (!items.some((item) => ["归档会话", "Archive session"].includes(item.textContent?.trim()))) continue;
        const context = closestOpenSessionRow(menu, sessions, workspaces);
        if (!context) continue;
        const pinned = Object.values(pinState?.groups ?? {}).some((ids) => ids.includes(context.sessionId));
        const template = items.find((item) => ["归档会话", "Archive session"].includes(item.textContent?.trim()));
        const button = template.cloneNode(false);
        button.dataset.dsoPinMenu = "true";
        button.type = "button";
        button.setAttribute("role", "menuitem");
        button.innerHTML = `<span aria-hidden="true" style="display:inline-flex;width:16px;justify-content:center;color:#d79b16">★</span><span>${pinned ? t("pins.unpin") : t("pins.pin")}</span>`;
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const operation = pinned
            ? pinStore.unpin(context.sessionId)
            : pinStore.pin(context.sessionId, context.workspaceId);
          void operation.catch((reason) => console.warn("session pin rejected:", reason));
          const anchor = [...document.querySelectorAll('button[aria-label*="的操作"],button[aria-label*="actions"],button[aria-label*="Actions"]')]
            .find((candidate) => candidate.closest('[role="treeitem"]') && rowContext(candidate.closest('[role="treeitem"]'), sessions, workspaces)?.sessionId === context.sessionId);
          anchor?.click();
        });
        const wrap = template.parentElement?.cloneNode(false) ?? document.createElement("div");
        wrap.dataset.dsoPinMenu = "true";
        wrap.appendChild(button);
        template.parentElement?.parentElement?.appendChild(wrap);
        fitMenuWithinViewport(menu);
      }
    }

    function archivedTarget(row, sessions, workspaces) {
      const identity = row.querySelector("span");
      const title = identity?.firstElementChild?.textContent?.trim() || "";
      if (!title) return undefined;
      const archived = new Set(workspaces?.archivedSessionIds ?? []);
      const candidates = [...archived].filter((id) => titleOf(sessions?.byId?.[id]) === title);
      const meta = identity?.children?.[1]?.textContent?.trim() || "";
      const items = Array.isArray(workspaces?.items) ? workspaces.items : [];
      const matchingWorkspaces = items.filter((workspace) => {
        const workspaceTitle = String(workspace?.title ?? "").trim();
        return workspaceTitle && (meta === workspaceTitle || meta.startsWith(`${workspaceTitle} ·`));
      });
      if (candidates.length === 1) {
        const owner = matchingWorkspaces.find((workspace) => workspace.sessionIds?.includes(candidates[0]));
        return { id: candidates[0], title, workspaceId: workspaceIdOf(owner) };
      }
      const ownedCandidates = candidates.filter((id) => matchingWorkspaces.some((workspace) => workspace.sessionIds?.includes(id)));
      if (ownedCandidates.length !== 1) return undefined;
      const owner = matchingWorkspaces.find((workspace) => workspace.sessionIds?.includes(ownedCandidates[0]));
      return { id: ownedCandidates[0], title, workspaceId: workspaceIdOf(owner) };
    }

    function appendArchivedDeleteButtons({ sessions, workspaces, t, onDelete }) {
      const input = document.querySelector('input[placeholder="搜索已归档会话"],input[placeholder="Search archived sessions"]');
      const list = input?.parentElement?.parentElement?.querySelector("ul");
      if (!list) return;
      for (const row of list.querySelectorAll(":scope > li")) {
        if (row.querySelector("[data-dso-delete]")) continue;
        const target = archivedTarget(row, sessions, workspaces);
        const restore = [...row.querySelectorAll("button")].find((button) => ["取消归档", "Unarchive"].includes(button.textContent?.trim()));
        if (!target || !restore) continue;
        const button = restore.cloneNode(false);
        button.dataset.dsoDelete = "true";
        button.classList.add("dso-dangerButton");
        button.textContent = t("delete.button");
        button.setAttribute("aria-label", interpolate(t("delete.aria"), { title: target.title }));
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          onDelete(target);
        });
        restore.insertAdjacentElement("afterend", button);
      }
    }

    function findPinnedMount() {
      const tree = document.querySelector('[role="tree"][aria-label="会话"],[role="tree"][aria-label="Sessions"]');
      const scroller = tree?.parentElement;
      if (!tree || !scroller) return undefined;
      scroller.classList.add("dso-unifiedScroller");
      let mount = scroller.querySelector(":scope > [data-dso-pinned-mount]");
      if (!mount) {
        mount = document.createElement("div");
        mount.dataset.dsoPinnedMount = "true";
        scroller.insertBefore(mount, tree);
      }
      return mount;
    }

    function Controller(props) {
      const sessions = props.useSessions((value) => value);
      const workspaces = props.useWorkspaces((value) => value);
      const pins = usePins();
      const [mount, setMount] = useState(undefined);
      const [deleteTarget, setDeleteTarget] = useState(null);
      const latest = useRef({ sessions, workspaces, pins: pins.state, t: props.t, onDelete: setDeleteTarget });
      latest.current = { sessions, workspaces, pins: pins.state, t: props.t, onDelete: setDeleteTarget };

      useEffect(() => { void pinStore.load().catch(() => {}); }, []);
      useEffect(() => {
        let frame = 0;
        const refresh = () => {
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(() => {
            const state = latest.current;
            const nextMount = findPinnedMount();
            setMount((current) => current === nextMount ? current : nextMount);
            appendPinMenuItems({ sessions: state.sessions, workspaces: state.workspaces, pinState: state.pins, t: state.t });
            appendArchivedDeleteButtons({ sessions: state.sessions, workspaces: state.workspaces, t: state.t, onDelete: state.onDelete });
          });
        };
        const observer = new MutationObserver(refresh);
        observer.observe(document.body, { childList: true, subtree: true });
        refresh();
        return () => {
          cancelAnimationFrame(frame);
          observer.disconnect();
          document.querySelectorAll("[data-dso-pinned-mount]").forEach((node) => node.remove());
          document.querySelectorAll(".dso-unifiedScroller").forEach((node) => node.classList.remove("dso-unifiedScroller"));
          document.querySelectorAll("[data-dso-pin-menu],[data-dso-delete]").forEach((node) => node.remove());
        };
      }, []);

      useEffect(() => {
        const state = latest.current;
        appendPinMenuItems({ sessions: state.sessions, workspaces: state.workspaces, pinState: state.pins, t: state.t });
        appendArchivedDeleteButtons({ sessions: state.sessions, workspaces: state.workspaces, t: state.t, onDelete: state.onDelete });
      }, [sessions, workspaces, pins.state]);

      const onDeleted = async (deletedId) => {
        if (typeof deletedId === "string") pinStore.markDeleted(deletedId);
        await Promise.allSettled([
          typeof props.refreshSessions === "function" ? props.refreshSessions() : Promise.resolve(),
          typeof props.refreshWorkspaces === "function" ? props.refreshWorkspaces() : Promise.resolve(),
          pinStore.load(true)
        ]);
      };
      const onBeforeDelete = async (target) => {
        const summary = latest.current.sessions?.byId?.[target.id];
        if ((summary?.retainedBy?.mainView ?? 0) > 0 && typeof props.startSession === "function") {
          props.startSession(target.workspaceId);
          const deadline = Date.now() + 5000;
          while (Date.now() < deadline) {
            const retained = typeof props.retentionOf === "function"
              ? props.retentionOf(target.id)
              : latest.current.sessions?.byId?.[target.id]?.retainedBy;
            if ((retained?.mainView ?? 0) === 0) break;
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          const retained = typeof props.retentionOf === "function"
            ? props.retentionOf(target.id)
            : latest.current.sessions?.byId?.[target.id]?.retainedBy;
          if ((retained?.mainView ?? 0) > 0) throw new Error(props.t("delete.navigationFailed"));
        }
      };
      const portals = [];
      if (mount) portals.push(ReactDOM.createPortal(h(PinnedBoard, {
        sessions,
        workspaces,
        t: props.t,
        onOpen: props.onOpen
      }), mount, "dso-pins"));
      if (deleteTarget) portals.push(ReactDOM.createPortal(h(DeleteDialog, {
        target: deleteTarget,
        t: props.t,
        onClose: () => setDeleteTarget(null),
        onBeforeDelete,
        onDeleted
      }), document.body, "dso-delete"));
      return portals;
    }

    function installStyle() {
      const tag = document.createElement("style");
      tag.dataset.plugin = PACKAGE;
      tag.dataset.pluginCss = `${PACKAGE}/style`;
      tag.textContent = CSS;
      document.head.appendChild(tag);
      return () => tag.remove();
    }

    function installDeletedSessionFilter(ctx) {
      let publishing = false;
      const navigationStarted = new Set();
      let unsupportedWarned = false;
      const applyFilter = () => {
        if (publishing) return;
        const deletedIds = new Set(pinStore.getSnapshot().deletedSessionIds ?? []);
        if (deletedIds.size === 0) return;

        for (const sessionId of deletedIds) {
          const retained = ctx.sessions.retainInfo(sessionId).getSnapshot().retainedBy;
          if ((retained.mainView ?? 0) > 0 && !navigationStarted.has(sessionId)) {
            navigationStarted.add(sessionId);
            ctx.uiWorkspace.startSession();
          }
        }

        const current = ctx.sessions.list.getSnapshot();
        const hasDeleted = current.ids.some((id) => deletedIds.has(id))
          || Object.keys(current.byId).some((id) => deletedIds.has(id));
        if (!hasDeleted) return;
        publishing = true;
        try {
          if (typeof ctx.sessions.handleSessionRemoved === "function") {
            for (const sessionId of deletedIds) {
              if (current.ids.includes(sessionId) || current.byId[sessionId] !== undefined) {
                ctx.sessions.handleSessionRemoved(sessionId);
              }
            }
          } else if (typeof ctx.sessions.list.set === "function") {
            const byId = { ...current.byId };
            for (const sessionId of deletedIds) delete byId[sessionId];
            ctx.sessions.list.set({
              ...current,
              ids: current.ids.filter((id) => !deletedIds.has(id)),
              byId
            });
          } else if (!unsupportedWarned) {
            unsupportedWarned = true;
            console.warn("session-organizer: this Harness client cannot filter deleted live sessions");
          }
        } finally {
          publishing = false;
        }
      };
      const stopPins = pinStore.subscribe(applyFilter);
      const stopSessions = ctx.sessions.list.subscribe(applyFilter);
      void pinStore.load().catch((reason) => console.warn("session-organizer state load failed:", reason));
      applyFilter();
      return () => {
        stopPins();
        stopSessions();
      };
    }

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "session-organizer: dictionaries");
      ctx.effect(installStyle, "session-organizer: stylesheet");
      ctx.effect(() => installDeletedSessionFilter(ctx), "session-organizer: deleted Session filter");
      ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
        name: "sidebar.footer.action",
        id: "session-organizer-controller",
        order: 999,
        locale: NS,
        inject: () => ({
          onOpen: (sessionId) => ctx.uiWorkspace.openSession(sessionId),
          startSession: (workspaceId) => ctx.uiWorkspace.startSession(workspaceId),
          retentionOf: (sessionId) => ctx.sessions.retainInfo(sessionId).getSnapshot().retainedBy,
          refreshSessions: () => ctx.sessions.refresh(),
          refreshWorkspaces: () => typeof ctx.workspaces?.refresh === "function" ? ctx.workspaces.refresh() : Promise.resolve()
        })
      }, Controller));
    }

    exports.apply = apply;
    exports.inject = ["slots", "sessions", "workspaces", "locale", "uiWorkspace"];
    return module.exports;
  }
});
