// ==UserScript==
// @name         DMM Games Fullscreen
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Enable full screen on DMM browser games.
// @author       Me
// @match        *://*.dmm.co.jp/*
// @match        *://*.dmm.com/*
// @match        *://*.mist-train-girls.com/*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const gameFrame = document.querySelector("#game_frame");
  const frame1 = document.querySelector("#frm1");

  const targetFrame = gameFrame ?? frame1;

  if (!targetFrame) {
    console.log("The target frame was not found!");
  } else {
    console.log("Add fullscreen trigger.");
    window.addEventListener("keydown", (ev) => {
      if (ev.key === "v") {
        void targetFrame.requestFullscreen();
      }
    });
  }

  const setCanvasSize = () => {
    const gameCanvas = document.querySelector("#unity-canvas");
    const gameDiv = document.querySelector("#GameDiv");

    const targetEl = gameCanvas ?? gameDiv;

    if (!targetEl) {
      console.log("The game element was not found!.");
      return;
    } else {
      if (targetEl.style.width === `${window.innerWidth}px`) {
        return;
      } else {
        console.log("Hide bottom content.");
        const pcBottom = document.querySelector("#pcbottom");
        if (pcBottom) {
          pcBottom.style.display = "none";
        }

        console.log("Set game element size.");
        const [width, height] = [window.innerWidth, window.innerHeight];
        if (targetEl) {
          targetEl.style.width = `${width}px`;
          targetEl.style.height = `${height}px`;
        }
      }
    }
  };

  window.setInterval(setCanvasSize, 500);
})();
