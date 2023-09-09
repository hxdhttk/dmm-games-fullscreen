// ==UserScript==
// @name         DMM Games Fullscreen
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Enable fullscreen on DMM browser games.
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

  if (targetFrame) {
    console.log("Add fullscreen trigger.");
    window.addEventListener("keydown", (ev) => {
      if (ev.key === "v") {
        void targetFrame.requestFullscreen();
      }
    });
  }

  const setCanvasSize = () => {
    const unityCanvas = document.querySelector("#unity-canvas");
    const [gameDiv, gameContainer, gameCanvas] = [
      document.querySelector("#GameDiv"),
      document.querySelector("#Cocos2dGameContainer"),
      document.querySelector("#GameCanvas"),
    ];

    const setMethod = unityCanvas !== null ? 1 : gameDiv !== null ? 2 : 0;
    const targetElement =
      setMethod === 1 ? unityCanvas : setMethod === 2 ? gameCanvas : null;

    if (setMethod == 0) {
      return;
    } else {
      if (targetElement.style.width === `${window.innerWidth}px`) {
        return;
      } else {
        const pcBottom = document.querySelector("#pcbottom");
        if (pcBottom) {
          console.log("Hide bottom content.");
          pcBottom.style.display = "none";
        }

        console.log("Set game element size.");
        const [width, height] = [window.innerWidth, window.innerHeight];
        if (setMethod === 1) {
          unityCanvas.style.width = `${width}px`;
          unityCanvas.style.height = `${height}px`;
        } else if (setMethod === 2) {
          [gameDiv, gameContainer, gameCanvas].forEach((e) => {
            e.style.width = `${width}px`;
            e.style.height = `${height}px`;
          });
        }
      }
    }
  };

  window.setInterval(setCanvasSize, 500);
})();
