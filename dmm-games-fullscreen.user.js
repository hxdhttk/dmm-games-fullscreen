// ==UserScript==
// @name         DMM Games Fullscreen
// @namespace    http://tampermonkey.net/
// @version      0.3
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
  const gameCanvas = document.querySelector("#GameDiv");

  if (
    gameFrame &&
    document.location.href.toLocaleLowerCase().includes("mist")
  ) {
    return;
  }

  const targetFrame = gameFrame ?? gameCanvas;
  if (targetFrame) {
    console.log("Add fullscreen trigger.");
    window.addEventListener(
      "keydown",
      (ev) => {
        if (ev.key === "v") {
          console.log("Requesting fullscreen:", targetFrame);
          void targetFrame.requestFullscreen();
        }
      },
      true
    );
  }

  const setCanvasSize = () => {
    const unityCanvas = document.querySelector("#unity-canvas");

    const setMethod = unityCanvas !== null ? 1 : 0;
    const targetElement = setMethod === 1 ? unityCanvas : null;

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
        }
      }
    }
  };

  window.setInterval(setCanvasSize, 500);
})();
