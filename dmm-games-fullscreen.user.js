// ==UserScript==
// @name         DMM Games Fullscreen
// @namespace    http://tampermonkey.net/
// @version      0.20
// @description  Hover to enter fullscreen on DMM browser games.
// @author       Me
// @match        *://*.dmm.co.jp/*
// @match        *://*.dmm.com/*
// @match        *://*.mist-train-girls.com/*
// @match        *://*.deepone-online.com/*
// @match        *://*.sweet-home-maid.com/*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const CONTROL_ID = "dmm-fullscreen-control";
  if (document.getElementById(CONTROL_ID)) return;
  const url = new URL(location.href);
  const onDomain = (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`);
  const isDmm = onDomain("dmm.com") || onDomain("dmm.co.jp");
  const gamePath = `${url.pathname}${url.search}`.toLowerCase();
  const isMist = onDomain("mist-train-girls.com") || (isDmm && /mist/.test(gamePath));
  const isDeepOne = onDomain("deepone-online.com") || (isDmm && /deepone/.test(gamePath));
  const byId = (id) => document.getElementById(id);
  const embedded = window !== window.top;
  let target = null;
  let host = null;
  let button = null;
  let status = null;
  let frame = 0;
  let session = null;
  let busy = false;
  const childOwners = new Set();
  const CLAIM = "dmm-fullscreen-owner-v1";
  const LAYOUT = "dmm-fullscreen-layout-v1";
  const READY = "dmm-fullscreen-ready-v1";
  let remoteActive = false;
  let contentSession = null;

  function delegateFullscreen() {
    for (const child of [byId("game_frame"), byId("game-iframe"), byId("cocos_frame"), byId("frm1")]) {
      if (!child || child.tagName !== "IFRAME") continue;
      let changed = false;
      if (!child.allowFullscreen) { child.allowFullscreen = true; changed = true; }
      const allow = child.getAttribute("allow") || "";
      if (!/(?:^|;)\s*fullscreen(?:\s|;|$)/i.test(allow)) {
        child.setAttribute("allow", `${allow}${allow ? "; " : ""}fullscreen *`);
        changed = true;
      }
      if (changed) child.contentWindow?.postMessage({ type: `${CLAIM}-probe` }, "*");
    }
  }

  function findTarget() {
    if (document.fullscreenEnabled === false) return null;
    // The intermediate Deep One page owns game-iframe. The renderer must not
    // offer another entry, and game_frame may also contain the bottom banner.
    if (byId("game-iframe")) return byId("game-iframe");
    const outer = byId("game_frame");
    if (outer) {
      if (isDeepOne || /deepone/i.test(outer.getAttribute("src") || "")) return null;
      return outer;
    }
    if (byId("cocos_frame")) return byId("cocos_frame");
    if (embedded) return null;
    if (isMist && byId("frm1")) return byId("frm1");
    // Standalone game pages can fullscreen their actual canvas, not GameDiv
    // (which can include engine offsets and other page content).
    return byId("GameCanvas") || byId("unity-canvas") || (isMist ? byId("GameDiv") : null);
  }

  function mountControl() {
    host = document.createElement("div");
    host.id = CONTROL_ID;
    host.style.cssText = "all:initial!important;position:fixed!important;inset:auto!important;width:19px!important;height:19px!important;margin:0!important;padding:0!important;border:0!important;overflow:visible!important;box-sizing:border-box!important;z-index:2147483647!important;";
    // A manual popover escapes ancestor clipping and ordinary stacking contexts.
    // It remains non-modal and does not steal focus or block the game.
    host.setAttribute("popover", "manual");
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { color-scheme:dark; }
        :host::before { content:""; position:absolute; width:3px; height:3px;
          right:1px; top:1px; border-radius:50%; background:#93c5fd;
          box-shadow:0 0 0 1px #17243baa; pointer-events:none; }
        :host(:hover)::before, :host(:focus-within)::before { opacity:0; }
        button { box-sizing:border-box; display:grid; place-items:center;
          width:15px; height:15px; margin:2px; padding:0; border:0; border-radius:3px;
          color:#dbeafe; background:#17243bd9; cursor:pointer; opacity:0;
          box-shadow:0 1px 4px #0005; transition:opacity .15s,background .15s; }
        :host(:hover) button, button:focus-visible { opacity:1; }
        button:hover { background:#3b5b89; color:white; }
        button:focus-visible { outline:1px solid #93c5fd; outline-offset:2px; }
        button:disabled { cursor:wait; }
        svg { width:13px; height:13px; }
        .status { display:none; position:absolute; top:18px; right:0; width:220px;
          padding:8px; border-radius:6px; color:#fecaca; background:#172033;
          font:12px/1.5 system-ui,sans-serif; }
        :host(:hover) .status:not(:empty), :host(:focus-within) .status:not(:empty) { display:block; }
        @media (hover:none) { button { opacity:1; } }
        @media (prefers-reduced-motion:reduce) { button { transition:none; } }
      </style>
      <button type="button" title="进入全屏（Esc 退出）" aria-label="进入游戏全屏">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg>
      </button>
      <div class="status" role="status" aria-live="polite"></div>`;
    button = shadow.querySelector("button");
    status = shadow.querySelector(".status");
    button.addEventListener("click", async () => {
      if (busy || !target?.isConnected) return;
      busy = true;
      button.disabled = true;
      status.textContent = "";
      try {
        // Fullscreen the existing parent: do not reparent an iframe (that reloads
        // its document). Its child viewport can now truly remain 16:9.
        prepareFullscreen(target);
        await session.stage.requestFullscreen();
      } catch (error) {
        restoreFullscreen();
        status.textContent = `无法进入全屏：${error.message || "请重试"}`;
      } finally {
        busy = false;
        button.disabled = false;
        if (!button.matches(":focus-visible")) button.blur();
        schedule();
      }
    });
    document.documentElement.appendChild(host);
    try { host.showPopover?.(); } catch { /* Fixed-position fallback on older browsers. */ }
  }

  function placeControl() {
    const rect = target.getBoundingClientRect();
    const size = 19;
    const gap = 4;
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = window.innerHeight;
    // Coordinates are local to this document's viewport. An embedded document
    // cannot draw outside its iframe, even with a huge z-index or a popover.
    const candidates = [
      [rect.right + gap, rect.top],
      [Math.max(gap, Math.min(rect.right - size, viewportWidth - size - gap)), rect.top - size - gap],
      [rect.left - size - gap, rect.top],
      [rect.right - size, rect.bottom + gap],
    ];
    const fits = ([x, y]) => x >= gap && y >= gap && x + size <= viewportWidth - gap && y + size <= viewportHeight - gap;
    const [left, top] = candidates.find(fits) || [
      Math.max(gap, viewportWidth - size - gap),
      Math.max(gap, Math.min(rect.top, viewportHeight - size - gap)),
    ];
    host.style.setProperty("left", `${left}px`, "important");
    host.style.setProperty("top", `${top}px`, "important");
  }

  function saveStyles(element, properties) {
    return properties.map((name) => [element, name, element.style.getPropertyValue(name), element.style.getPropertyPriority(name)]);
  }

  function prepareFullscreen(element) {
    const stage = element.parentElement;
    if (!stage || typeof stage.requestFullscreen !== "function") throw new Error("页面不支持全屏");
    const rect = element.getBoundingClientRect();
    const ratio = isMist || isDeepOne || element.id === "game-iframe" ? 16 / 9 : (rect.width / rect.height || 16 / 9);
    const stageProperties = ["position", "width", "height", "margin", "padding", "border", "background", "overflow", "display", "transform", "min-width", "min-height", "max-width", "max-height"];
    const targetProperties = ["position", "inset", "left", "top", "right", "bottom", "width", "height", "margin", "padding", "border", "transform", "box-sizing", "max-width", "max-height", "min-width", "min-height", "object-fit"];
    session = { stage, element, ratio, active: false, saved: [...saveStyles(stage, stageProperties), ...saveStyles(element, targetProperties)], hidden: [] };
  }

  function fitFullscreen() {
    if (!session?.active) return;
    const { stage, element, ratio } = session;
    const set = (node, name, value) => node.style.setProperty(name, value, "important");
    for (const [name, value] of Object.entries({ position:"fixed", width:"100vw", height:"100vh", margin:"0", padding:"0", border:"0", background:"#000", overflow:"hidden", display:"block", transform:"none", "min-width":"0", "min-height":"0", "max-width":"none", "max-height":"none" })) set(stage, name, value);
    const width = Math.min(window.innerWidth, window.innerHeight * ratio);
    const height = width / ratio;
    for (const [name, value] of Object.entries({ position:"absolute", inset:"auto", left:`${(window.innerWidth - width) / 2}px`, top:`${(window.innerHeight - height) / 2}px`, right:"auto", bottom:"auto", width:`${width}px`, height:`${height}px`, margin:"0", padding:"0", border:"0", transform:"none", "box-sizing":"border-box", "max-width":"none", "max-height":"none", "min-width":"0", "min-height":"0", "object-fit":"contain" })) set(element, name, value);
    // Hide banners/siblings only while this parent is fullscreen, restoring exact
    // inline values and priorities afterwards. The iframe itself never moves.
    for (const sibling of stage.children) {
      if (sibling === element || !sibling.style || session.hidden.includes(sibling)) continue;
      session.saved.push(...saveStyles(sibling, ["display"]));
      session.hidden.push(sibling);
      set(sibling, "display", "none");
    }
    sendLayout(element, true);
  }

  function sendLayout(element, active) {
    if (element?.tagName === "IFRAME") element.contentWindow?.postMessage({ type: LAYOUT, active }, "*");
  }

  function contentTarget() {
    // Mist has an intermediate document containing iframe#frm1. Relay through
    // it without creating another fullscreen button in that document.
    return byId("GameDiv") || byId("GameCanvas") || byId("unity-canvas") || byId("frm1") || byId("game-iframe") || byId("cocos_frame") || byId("game_frame");
  }

  function installMistInputMapping(state, canvas) {
    if (!isMist || !canvas || state.inputCleanup) return;
    const cc = window.cc;
    const view = cc?.view;
    const manager = cc?.internal?.inputManager;
    if (cc?.game?.canvas !== canvas || typeof view?.convertToLocationInView !== "function" ||
        typeof view?._convertMouseToLocationInView !== "function" ||
        typeof manager?._updateCanvasBoundingRect !== "function") return;

    // Mist's Cocos 2.3.2 multiplies CSS mouse/touch distances by its cached DPR.
    // A CSS-resized canvas can have a different backing-pixels/CSS-pixels ratio.
    // Normalize at the view boundary so its existing viewport/design transforms
    // still run, and all listeners receive the same corrected coordinates.
    const normalize = (x, y, position, adjusted) => {
      manager._updateCanvasBoundingRect();
      const rect = canvas.getBoundingClientRect();
      const dpr = typeof view.getDevicePixelRatio === "function" ? view.getDevicePixelRatio() : view._devicePixelRatio;
      if (!remoteActive || view._isRotated || !(rect.width > 0 && rect.height > 0 && dpr > 0 && canvas.width > 0 && canvas.height > 0)) return [x, y];
      const left = adjusted && position.adjustedLeft ? position.adjustedLeft : position.left;
      const top = adjusted && position.adjustedTop ? position.adjustedTop : position.top;
      const bottom = top + position.height;
      return [
        left + (x - left) * canvas.width / rect.width / dpr,
        bottom - (bottom - y) * canvas.height / rect.height / dpr,
      ];
    };
    const patches = [];
    const patch = (name, factory) => {
      const descriptor = Object.getOwnPropertyDescriptor(view, name);
      const original = view[name];
      const wrapper = factory(original);
      view[name] = wrapper;
      patches.push(() => {
        if (view[name] !== wrapper) return;
        if (descriptor) Object.defineProperty(view, name, descriptor);
        else delete view[name];
      });
    };
    patch("convertToLocationInView", (original) => function (x, y, position, ...rest) {
      const point = normalize(x, y, position, true);
      return original.call(this, point[0], point[1], position, ...rest);
    });
    patch("_convertMouseToLocationInView", (original) => function (point, position, ...rest) {
      const normalized = normalize(point.x, point.y, position, false);
      point.x = normalized[0];
      point.y = normalized[1];
      return original.call(this, point, position, ...rest);
    });
    const refresh = () => manager._updateCanvasBoundingRect();
    const events = ["mousedown", "mousemove", "mouseup", "wheel", "touchstart", "touchmove", "touchend", "touchcancel"];
    events.forEach((name) => window.addEventListener(name, refresh, { capture: true, passive: true }));
    state.inputCleanup = () => {
      patches.reverse().forEach((restore) => restore());
      events.forEach((name) => window.removeEventListener(name, refresh, true));
    };
    refresh();
  }

  function restoreContent() {
    if (!contentSession) return;
    sendLayout(contentSession.element, false);
    contentSession.inputCleanup?.();
    const { engine, engineSize, saved } = contentSession;
    if (engine && engineSize) {
      try { engine.setFrameSize(engineSize.width, engineSize.height); } catch (error) { console.warn("Restore game view:", error); }
    }
    for (const [element, name, value, priority] of saved) {
      if (value) element.style.setProperty(name, value, priority);
      else element.style.removeProperty(name);
    }
    contentSession = null;
    window.cc?.internal?.inputManager?._updateCanvasBoundingRect?.();
  }

  function fitContent() {
    if (!remoteActive) return;
    const element = contentTarget();
    if (!element) return; // The engine may not have loaded yet.
    if (contentSession?.element !== element) restoreContent();
    if (!contentSession) contentSession = { element, saved: [], tracked: new Map(), engine: null, engineSize: null, dimensions: "" };
    const state = contentSession;
    const set = (node, properties) => {
      if (!node?.style) return;
      let tracked = state.tracked.get(node);
      if (!tracked) { tracked = new Set(); state.tracked.set(node, tracked); }
      for (const [name, value] of Object.entries(properties)) {
        if (!tracked.has(name)) { state.saved.push(...saveStyles(node, [name])); tracked.add(name); }
        if (node.style.getPropertyValue(name) !== value || node.style.getPropertyPriority(name) !== "important") node.style.setProperty(name, value, "important");
      }
    };
    const width = Math.min(window.innerWidth, window.innerHeight * 16 / 9);
    const height = width * 9 / 16;
    // Normalize the complete ancestor chain; resizing only the outer iframe leaves
    // fixed-width game containers, margins and banners inside it unchanged.
    for (let branch = element; branch.parentElement; branch = branch.parentElement) {
      const parent = branch.parentElement;
      for (const sibling of parent.children) {
        if (sibling !== branch && sibling.id !== CONTROL_ID) set(sibling, { display: "none" });
      }
      set(parent, { position:"static", transform:"none", margin:"0", padding:"0", border:"0", width:"100%", height:"100%", "min-width":"0", "min-height":"0", "max-width":"none", "max-height":"none", overflow:"hidden", background:"#000" });
    }
    const frameProperties = { margin:"0", padding:"0", border:"0", "box-sizing":"border-box", "min-width":"0", "min-height":"0", "max-width":"none", "max-height":"none", transform:"none" };
    set(element, { ...frameProperties, display:"block", position:"fixed", inset:"auto", left:`${(window.innerWidth - width) / 2}px`, top:`${(window.innerHeight - height) / 2}px`, width:`${width}px`, height:`${height}px`, overflow:"hidden" });
    // Track before invoking the engine, since it also writes these CSS properties.
    const canvas = byId("GameCanvas") || byId("unity-canvas");
    if (canvas && element.contains(canvas) && canvas !== element) {
      for (let node = canvas; node && node !== element; node = node.parentElement) {
        set(node, { ...frameProperties, position:"absolute", inset:"0", left:"0", top:"0", width:"100%", height:"100%", display:"block" });
      }
    }
    const view = window.cc?.view;
    if (!state.engine && typeof view?.setFrameSize === "function" && typeof view?.getFrameSize === "function") {
      const original = view.getFrameSize();
      state.engineSize = { width: original.width, height: original.height };
      state.engine = view;
    }
    const dimensions = `${width}x${height}`;
    if (state.engine && state.dimensions !== dimensions) {
      // Let Cocos update its own resolution policy and input scale together.
      // Do not write canvas.width/height independently of the engine.
      try { state.engine.setFrameSize(width, height); state.dimensions = dimensions; }
      catch (error) { console.warn("Resize game view:", error); }
    }
    if (canvas === element) set(canvas, { "object-fit":"contain" });
    installMistInputMapping(state, canvas);
    sendLayout(element, true);
  }

  function restoreFullscreen() {
    if (!session) return;
    sendLayout(session.element, false);
    if (session.active) {
      for (const [element, name, value, priority] of session.saved) {
        if (value) element.style.setProperty(name, value, priority);
        else element.style.removeProperty(name);
      }
    }
    session = null;
  }

  function update() {
    frame = 0;
    if (!document.body) return;
    for (const child of childOwners) if (!child.isConnected) childOwners.delete(child);
    delegateFullscreen();
    target = childOwners.size ? null : findTarget();
    if (target && !host) mountControl();
    if (host) {
      host.style.setProperty("display", target && !remoteActive && !document.fullscreenElement ? "block" : "none", "important");
      if (target && !document.fullscreenElement) placeControl();
    }
    if (embedded) window.parent.postMessage({ type: CLAIM, owns: Boolean(target || childOwners.size) }, "*");
    fitFullscreen();
    fitContent();
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  document.addEventListener("fullscreenchange", () => {
    if (session && document.fullscreenElement === session.stage) {
      session.active = true;
      fitFullscreen();
    } else if (session?.active) restoreFullscreen();
    schedule();
  });
  window.addEventListener("message", (event) => {
    if (embedded && event.source === window.parent && event.data?.type === LAYOUT && typeof event.data.active === "boolean") {
      if (remoteActive !== event.data.active) {
        remoteActive = event.data.active;
        if (!remoteActive) restoreContent();
        schedule();
      }
      return;
    }
    if (event.data?.type === READY) {
      const element = session?.active ? session.element : (remoteActive ? contentTarget() : null);
      if (element?.tagName === "IFRAME" && element.contentWindow === event.source) sendLayout(element, true);
      return;
    }
    if (embedded && event.source === window.parent && event.data?.type === `${CLAIM}-probe`) { schedule(); return; }
    if (event.data?.type !== CLAIM || typeof event.data.owns !== "boolean") return;
    const child = [...document.querySelectorAll("iframe")].find((node) => node.contentWindow === event.source);
    if (!child) return;
    const had = childOwners.has(child);
    if (event.data.owns) childOwners.add(child);
    else childOwners.delete(child);
    if (had !== childOwners.has(child)) schedule();
  });
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("resize", schedule);
  window.addEventListener("scroll", schedule, { passive: true, capture: true });
  window.addEventListener("pagehide", () => {
    observer.disconnect();
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  });
  window.addEventListener("pageshow", () => {
    observer.observe(document.documentElement, { childList: true, subtree: true });
    schedule();
  });
  if (embedded) window.parent.postMessage({ type: READY }, "*");
  schedule();
})();
