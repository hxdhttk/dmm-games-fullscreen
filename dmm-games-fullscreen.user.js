// ==UserScript==
// @name         DMM Games Fullscreen
// @namespace    http://tampermonkey.net/
// @version      0.16
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

  function delegateFullscreen() {
    for (const child of [byId("game_frame"), byId("game-iframe"), byId("cocos_frame")]) {
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
    // Standalone game pages can fullscreen their actual canvas, not GameDiv
    // (which can include engine offsets and other page content).
    return byId("GameCanvas") || byId("unity-canvas") || (isMist ? byId("GameDiv") : null);
  }

  function mountControl() {
    host = document.createElement("div");
    host.id = CONTROL_ID;
    host.style.cssText = "position:absolute!important;width:15px!important;height:15px!important;margin:0!important;padding:0!important;z-index:2147483647!important;";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { color-scheme:dark; }
        button { box-sizing:border-box; display:grid; place-items:center;
          width:15px; height:15px; margin:0; padding:0; border:0; border-radius:3px;
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
    document.body.appendChild(host);
  }

  function placeControl() {
    const rect = target.getBoundingClientRect();
    // Prefer the right margin; otherwise the gap above/below the game. No strip
    // in normal flow and no invisible hit area over the game's controls.
    let left = rect.right + 3;
    let top = rect.top;
    if (left + 15 > document.documentElement.clientWidth) {
      left = Math.max(0, rect.right - 15);
      top = rect.top >= 18 ? rect.top - 18 : rect.bottom + 3;
    }
    host.style.setProperty("left", `${left + window.scrollX}px`, "important");
    host.style.setProperty("top", `${top + window.scrollY}px`, "important");
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
  }

  function restoreFullscreen() {
    if (!session) return;
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
      host.style.setProperty("display", target && !document.fullscreenElement ? "block" : "none", "important");
      if (target && !document.fullscreenElement) placeControl();
    }
    if (embedded) window.parent.postMessage({ type: CLAIM, owns: Boolean(target || childOwners.size) }, "*");
    fitFullscreen();
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
  schedule();
})();
