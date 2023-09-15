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

  if (gameFrame) {
    console.log("Add fullscreen trigger.");
    window.addEventListener("keydown", (ev) => {
      if (ev.key === "v") {
        console.log("Requesting fullscreen:", gameFrame);
        void gameFrame.requestFullscreen();
      }
    });
  } else if (gameCanvas) {
    const fullscreenButton = document.createElement("button");
    const buttonText = document.createTextNode("Click to trigger fullscreen");
    fullscreenButton.appendChild(buttonText);
    fullscreenButton.onclick = () => {
      gameCanvas.requestFullscreen();
    };
    document.body.insertBefore(fullscreenButton, gameCanvas);
  }

  const setCanvasSize = () => {
    const pcBottom = document.querySelector("#pcbottom");
    if (pcBottom) {
      console.log("Hide bottom content.");
      pcBottom.style.display = "none";
    }

    const unityCanvas = document.querySelector("#unity-canvas");
    if (unityCanvas) {
      if (unityCanvas.style.width === `${window.innerWidth}px`) {
        return;
      } else {
        console.log("Set game element size.");
        const [width, height] = [window.innerWidth, window.innerHeight];
        unityCanvas.style.width = `${width}px`;
        unityCanvas.style.height = `${height}px`;
      }
    }
  };

  window.setInterval(setCanvasSize, 500);
})();
