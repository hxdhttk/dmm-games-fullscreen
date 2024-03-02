// ==UserScript==
// @name         DMM Games Fullscreen
// @namespace    http://tampermonkey.net/
// @version      0.13
// @description  Enable fullscreen on DMM browser games.
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

  const isMist = () =>
    document.location.href.toLocaleLowerCase().includes("mist");
  const isDeepOne = () =>
    document.location.href.toLocaleLowerCase().includes("deepone");
  const isSHM = () =>
    document.location.href.toLocaleLowerCase().includes("maid");

  const addFullscreenButton = (gameElement, buttonBg) => {
    console.log("Add fullscreen button.");
    const fullscreenButton = document.createElement("button");
    const buttonText = document.createTextNode("Fullscreen");
    fullscreenButton.appendChild(buttonText);
    fullscreenButton.onclick = () => {
      console.log("Requesting fullscreen:", gameElement);
      void gameElement.requestFullscreen();
    };
    fullscreenButton.style.fontSize = "12px";
    fullscreenButton.style.position = "fixed";
    fullscreenButton.style.top = "0px";
    fullscreenButton.style.left = "0px";
    fullscreenButton.style.zIndex = "1";

    buttonBg.parentNode.insertBefore(fullscreenButton, buttonBg);
  };

  const gameFrame = document.getElementById("game_frame");
  const gameCanvas = document.getElementById("GameDiv");

  if (gameFrame && (isMist() || isDeepOne())) {
    return;
  }

  const setGameIFrameFullscreen = () => {
    const gameIFrame = document.getElementById("game-iframe");
    const gameMainDiv = document.getElementById("game-main");
    if (gameIFrame && gameMainDiv) {
      gameIFrame.style.width = screen.width + "px";
      gameIFrame.style.height = screen.height + "px";

      console.log("Add fullscreen button.");
      const fullscreenButton = document.createElement("button");
      const buttonText = document.createTextNode("Fullscreen");
      fullscreenButton.appendChild(buttonText);
      fullscreenButton.onclick = () => {
        console.log("Requesting fullscreen:", gameIFrame);
        void gameIFrame.requestFullscreen();
      };
      fullscreenButton.style.fontSize = "12px";
      fullscreenButton.style.position = "fixed";
      fullscreenButton.style.top = "0px";
      fullscreenButton.style.left = "0px";
      fullscreenButton.style.zIndex = "1";

      document.body.insertBefore(fullscreenButton, gameMainDiv);
    } else {
      window.setTimeout(setGameIFrameFullscreen, 500);
    }
  };

  if (isDeepOne()) {
    if (document.location.href.toLocaleLowerCase().includes("dmm.com")) {
      window.setTimeout(setGameIFrameFullscreen, 500);
    }
  }

  const setCocosFrameFullscreen = () => {
    const cocosFrame = document.getElementById("cocos_frame");
    if (cocosFrame) {
      addFullscreenButton(cocosFrame, cocosFrame);
    } else {
      window.setTimeout(setCocosFrameFullscreen, 500);
    }
  };

  if (isSHM()) {
    window.setTimeout(setCocosFrameFullscreen(), 500);
  }

  if (gameFrame && !isSHM()) {
    const gameAreaDiv = document.getElementById("area-game");
    if (gameAreaDiv) {
      addFullscreenButton(gameFrame, gameAreaDiv);
    }
  } else if (gameCanvas && isMist()) {
    addFullscreenButton(gameCanvas, gameCanvas);
  }

  const setCanvasSize = (isSecondCall) => {
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

    if (isMist()) {
      return;
    }

    const gameDiv = document.getElementById("GameDiv");
    const gameContainer = document.getElementById("Cocos2dGameContainer");
    const gameCanvas = document.getElementById("GameCanvas");
    if (gameContainer) {
      const windowWidth = `${window.innerWidth}px`;
      const windowHeight = `${window.innerHeight}px`;

      if (
        gameDiv.style.width === windowWidth &&
        gameDiv.style.height === windowHeight
      ) {
        if (!isSecondCall) {
          window.setTimeout(() => setCanvasSize(true), 15);
        }

        return;
      } else {
        console.log("Set game element size.");
        [gameDiv, gameContainer, gameCanvas].forEach((e) => {
          e.style.width = windowWidth;
          e.style.height = windowHeight;
        });

        if (!isSecondCall) {
          window.setTimeout(() => setCanvasSize(true), 15);
        }
      }
    }
  };

  window.setInterval(setCanvasSize, 150);
})();
