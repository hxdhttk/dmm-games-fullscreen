// ==UserScript==
// @name         DMM Games Fullscreen
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Enable full screen on DMM browser games.
// @author       Me
// @match        *://*.dmm.co.jp/*
// @match        *://*.dmm.com/*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const iFrames = document.querySelectorAll("iframe");
  let gameFrame = undefined;
  for (const iFrame of iFrames) {
    if (iFrame.id === "game_frame") {
      gameFrame = iFrame;
    }
  }

  if (!gameFrame) {
    console.log("The game frame was not found!");
  } else {
    console.log("Add fullscreen trigger.");
    window.addEventListener("keydown", (ev) => {
      if (ev.key === "v") {
        void gameFrame.requestFullscreen();
      }
    });
  }

  const setCanvasSize = () => {
    const canvases = document.querySelectorAll("canvas");
    let unityCanvas = undefined;
    for (const canvas of canvases) {
      if (canvas.id === "unity-canvas") {
        unityCanvas = canvas;
      }
    }

    if (!unityCanvas) {
      console.log("The Unity canvas was not found!.");
      return;
    } else {
      if (unityCanvas.style.width === `${window.innerWidth}px`) {
        return;
      } else {
        console.log("Hide bottom content.");
        const pcBottom = document.querySelector("#pcbottom");
        if (pcBottom) {
          pcBottom.style.display = "none";
        }

        console.log("Set canvas size.");
        const [width, height] = [window.innerWidth, window.innerHeight];
        if (unityCanvas) {
          unityCanvas.style.width = `${width}px`;
          unityCanvas.style.height = `${height}px`;
        }
      }
    }
  };

  window.setInterval(setCanvasSize, 500);
})();
