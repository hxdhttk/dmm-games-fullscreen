// ==UserScript==
// @name         DMM Games Fullscreen
// @namespace    http://tampermonkey.net/
// @version      0.4
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

  const gameFrame = document.querySelector("#game_frame");
  const gameIFrame = document.querySelector("#game-iframe");
  const gameCanvas = document.querySelector("#GameDiv");

  if (
    gameFrame &&
    document.location.href.toLocaleLowerCase().includes("mist")
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
    fullscreenButton.style = {
      ...fullscreenButton.style,
      fontSize: "12px",
      position: "fixed",
      top: "0px",
      left: "0px",
      zIndex: "1",
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

    const gameDiv = document.querySelector("#GameDiv");
    const gameContainer = document.querySelector("#Cocos2dGameContainer");
    const gameCanvas = document.querySelector("#GameCanvas");
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
