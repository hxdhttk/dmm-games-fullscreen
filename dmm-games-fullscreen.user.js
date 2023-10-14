// ==UserScript==
// @name         DMM Games Fullscreen
// @namespace    http://tampermonkey.net/
// @version      0.5
// @description  Enable fullscreen on DMM browser games.
// @author       Me
// @match        *://*.dmm.co.jp/*
// @match        *://*.dmm.com/*
// @match        *://*.mist-train-girls.com/*
// @match        *://*.deepone-online.com/*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const gameFrame = document.getElementById("game_frame");
  const gameIFrame = document.getElementById("game-iframe");
  const gameCanvas = document.getElementById("GameDiv");

  if (
    gameFrame &&
    document.location.href.toLocaleLowerCase().includes("mist")
  ) {
    return;
  }

  if (
    gameFrame &&
    document.location.href.toLocaleLowerCase().includes("deepone")
  ) {
    return;
  }

  if (gameFrame || gameIFrame) {
    const targetFrame = gameFrame ?? gameIFrame;

    console.log("Add fullscreen trigger.");
    window.addEventListener("keydown", (ev) => {
      if (ev.key === "v") {
        console.log("Requesting fullscreen:", targetFrame);
        void targetFrame.requestFullscreen();
      }
    });
  } else if (gameCanvas) {
    console.log("Add fullscreen button.");
    const fullscreenButton = document.createElement("button");
    const buttonText = document.createTextNode("Fullscreen");
    fullscreenButton.appendChild(buttonText);
    fullscreenButton.onclick = () => {
      console.log("Requesting fullscreen:", gameCanvas);
      void gameCanvas.requestFullscreen();
    };
    fullscreenButton.style.fontSize = "12px";
    fullscreenButton.style.position = "fixed";
    fullscreenButton.style.top = "0px";
    fullscreenButton.style.left = "0px";
    fullscreenButton.style.zIndex = "1";

    document.body.insertBefore(fullscreenButton, gameCanvas);
  }

  const setCanvasSize = () => {
    const pcBottom = document.getElementById("pcbottom");
    if (pcBottom) {
      console.log("Hide bottom content.");
      pcBottom.style.display = "none";
    }

    const unityCanvas = document.getElementById("unity-canvas");
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

    if (document.location.href.toLocaleLowerCase().includes("mist")) {
      return;
    }

    const gameDiv = document.getElementById("GameDiv");
    const gameContainer = document.getElementById("Cocos2dGameContainer");
    const gameCanvas = document.getElementById("GameCanvas");
    if (gameContainer) {
      const windowWidth = `${window.innerWidth}px`;
      const windowHeight = `${window.innerHeight}px`;

      if (gameDiv.style.width === windowWidth) {
        return;
      } else {
        console.log("Set game element size.");
        [gameDiv, gameContainer, gameCanvas].forEach((e) => {
          e.style.width = windowWidth;
          e.style.height = windowHeight;
        });
      }
    }
  };

  window.setInterval(setCanvasSize, 500);
})();
