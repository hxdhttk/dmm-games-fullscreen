// ==UserScript==
// @name         DMM Games Fullscreen
// @namespace    http://tampermonkey.net/
// @version      0.14
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
  const isMaid = onDomain("sweet-home-maid.com") || (isDmm && /maid/.test(gamePath));
  const byId = (id) => document.getElementById(id);
  let target = null;
  let host = null;
  let button = null;
  let status = null;
  let frame = 0;
  let savedFullscreenStyle = null;
  let fullscreenTarget = null;
  let busy = false;

  // Keep the original outer/inner frame routing; discovery also handles late loads.
  function findTarget() {
    if (byId("game_frame") && (isMist || isDeepOne)) return null;
    if (isMaid) return byId("cocos_frame");
    if (isDeepOne && isDmm) return byId("game-iframe");
    if (isMist) return byId("GameDiv");
    return byId("game_frame") || byId("GameDiv") || byId("unity-canvas");
  }

  function mountControl() {
    host = document.createElement("div");
    host.id = CONTROL_ID;
    host.style.cssText = "position:fixed!important;top:0!important;left:0!important;width:148px!important;height:60px!important;z-index:2147483647!important;display:block!important;";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { color-scheme: dark; }
        .zone { box-sizing:border-box; width:148px; height:60px; padding:10px; }
        button { display:flex; align-items:center; justify-content:center; gap:9px;
          width:128px; height:40px; padding:0 12px; border:1px solid #ffffff30;
          border-radius:12px; background:linear-gradient(135deg,#26354fee,#111827ee);
          color:#f8fafc; font:600 13px/1 system-ui,sans-serif; letter-spacing:.2px;
          box-shadow:0 6px 24px #0005; backdrop-filter:blur(14px); cursor:pointer;
          opacity:0; transform:translateY(-5px); transition:opacity .16s,transform .16s,background .16s; }
        .zone:hover button, .zone:focus-within button { opacity:1; transform:translateY(0); }
        button:hover { background:linear-gradient(135deg,#395781,#1e3051); border-color:#93c5fd99; }
        button:focus-visible { outline:2px solid #93c5fd; outline-offset:3px; }
        button:active { transform:scale(.97); }
        button:disabled { cursor:wait; }
        svg { width:17px; height:17px; flex:none; }
        .status { display:none; width:240px; margin-top:8px; padding:10px 12px;
          border-radius:10px; background:#172033f5; color:#fecaca;
          font:12px/1.5 system-ui,sans-serif; box-shadow:0 4px 18px #0004; }
        .zone:hover .status:not(:empty), .zone:focus-within .status:not(:empty) { display:block; }
        @media (prefers-reduced-motion:reduce) { button { transition:none; } }
        @media (hover:none) { button { opacity:1; transform:none; } }
      </style>
      <div class="zone">
        <button type="button" title="进入全屏（Esc 退出）" aria-label="进入游戏全屏">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg>
          <span>全屏游戏</span>
        </button>
        <div class="status" role="status" aria-live="polite"></div>
      </div>`;
    button = shadow.querySelector("button");
    status = shadow.querySelector(".status");
    button.addEventListener("click", async () => {
      if (busy) return;
      const element = target;
      if (!element?.isConnected) { schedule(); return; }
      busy = true;
      button.disabled = true;
      status.textContent = "";
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else {
          if (typeof element.requestFullscreen !== "function" || document.fullscreenEnabled === false) {
            throw new Error("当前页面不允许全屏，请检查浏览器或嵌入页面权限。");
          }
          await element.requestFullscreen();
        }
      } catch (error) {
        status.textContent = `无法进入全屏：${error.message || "请重试"}`;
      } finally {
        busy = false;
        button.disabled = false;
        // A mouse click must not leave the hover-only control permanently visible.
        if (!button.matches(":focus-visible")) button.blur();
      }
    });
    document.body.appendChild(host);
  }

  function setSize(element, width, height) {
    if (!element) return;
    if (element.style.width !== `${width}px`) element.style.width = `${width}px`;
    if (element.style.height !== `${height}px`) element.style.height = `${height}px`;
  }

  function update() {
    frame = 0;
    if (!document.body) return;
    target = findTarget();
    if (target && !host) mountControl();
    if (host) host.style.setProperty("display", target && !document.fullscreenElement ? "block" : "none", "important");

    // Only adapt pages containing an actual game, not every matching DMM page.
    if (!target && !(isDeepOne && byId("GameCanvas"))) return;
    const bottom = byId("pcbottom");
    if (bottom && bottom.style.display !== "none") bottom.style.display = "none";
    const width = window.innerWidth;
    const height = window.innerHeight;
    setSize(byId("unity-canvas"), width, height);
    if (isMist) return;
    const div = byId("GameDiv");
    const container = byId("Cocos2dGameContainer");
    const canvas = byId("GameCanvas");
    if (div && container && canvas) {
      [div, container, canvas].forEach((element) => setSize(element, width, height));
      if (isDeepOne) {
        const pixelWidth = Math.max(1, Math.round(width * (window.devicePixelRatio || 1)));
        const pixelHeight = Math.max(1, Math.round(height * (window.devicePixelRatio || 1)));
        if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
        if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
      }
    }
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  function onFullscreenChange() {
    if (fullscreenTarget && document.fullscreenElement !== fullscreenTarget) {
      for (const [name, value, priority] of savedFullscreenStyle) {
        if (value) fullscreenTarget.style.setProperty(name, value, priority);
        else fullscreenTarget.style.removeProperty(name);
      }
      fullscreenTarget = null;
      savedFullscreenStyle = null;
    }
    if (target && document.fullscreenElement === target && !fullscreenTarget) {
      fullscreenTarget = target;
      savedFullscreenStyle = ["width", "height", "border"].map((name) => [name, target.style.getPropertyValue(name), target.style.getPropertyPriority(name)]);
      target.style.setProperty("width", "100vw", "important");
      target.style.setProperty("height", "100vh", "important");
      target.style.setProperty("border", "0", "important");
    }
    schedule();
  }

  // Observe node discovery/replacement only; our own style writes do not retrigger it.
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("resize", schedule);
  document.addEventListener("fullscreenchange", onFullscreenChange);
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
