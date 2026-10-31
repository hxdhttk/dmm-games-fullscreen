# DMM Games Fullscreen

安装 Tampermonkey 后，将 `dmm-games-fullscreen.user.js` 导入为用户脚本。

- 鼠标移到页面左上角约 148 × 60 像素区域，显示全屏按钮；移开后淡出。
- 点击进入游戏全屏，按 Esc 退出。键盘 Tab 聚焦时也显示按钮；触屏设备保持可见。
- 全屏请求失败时，在按钮下显示错误原因。
- 适配通用 DMM iframe、Mist Train Girls、Deep One、Sweet Home Maid，以及 Unity / Cocos 画布。
- 使用节点观察和窗口事件更新尺寸，不再持续轮询。保留原有铺满窗口行为；等比缩放需要按游戏引擎单独验证，尚未启用。

## 验证

运行 `node --check dmm-games-fullscreen.user.js` 和 `node --test tests/fullscreen.test.cjs`。

真实页面验收：检查悬停显示、移开隐藏、Tab 聚焦、点击全屏、Esc 恢复、仅改变窗口高度、延迟加载和游戏重新加载。跨域 iframe 能否全屏取决于宿主页面权限。全屏中通过 Esc 退出，按钮不覆盖游戏画面。
