# DMM Games Fullscreen

安装 Tampermonkey 后，将 `dmm-games-fullscreen.user.js` 导入为用户脚本。

- 游戏元素前方预留 60 像素独立工具栏，鼠标悬停工具栏左侧时显示全屏按钮，移开后淡出；工具栏随游戏所在页面滚动。
- 点击进入游戏全屏，按 Esc 退出。键盘 Tab 聚焦时也显示按钮；触屏设备保持可见。
- 全屏请求失败时，在按钮下显示错误原因。
- 适配通用 DMM iframe、Mist Train Girls、Deep One、Sweet Home Maid，以及 Unity / Cocos 画布。
- 窗口模式保留游戏原有布局，不修改 Canvas 绘制分辨率或内部容器尺寸。Mist / Deep One 全屏保持 16:9，其他游戏使用进入全屏前的元素比例，居中留黑边；退出时恢复修改过的样式。

## 验证

运行 `node --check dmm-games-fullscreen.user.js` 和 `node --test tests/fullscreen.test.cjs`。

真实页面验收：检查悬停显示、移开隐藏、Tab 聚焦、点击全屏、Esc 恢复、仅改变窗口高度、延迟加载和游戏重新加载。跨域 iframe 能否全屏取决于宿主页面权限。全屏中通过 Esc 退出，按钮不覆盖游戏画面。

升级至 0.15 后请完整刷新游戏页面，清除旧版已经写入的画布尺寸。自动化测试使用模拟 DOM，不代表真实游戏引擎、跨域 iframe 或鼠标坐标已验证。
