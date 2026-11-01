# DMM Games Fullscreen

安装 Tampermonkey 后，将 `dmm-games-fullscreen.user.js` 导入为用户脚本。升级至 0.17 后请完整刷新游戏页面，并确认只启用一份脚本。

- 全屏图标保持 15 × 15px，悬停区域为 19 × 19px。默认显示一个 3px 定位点，悬停后显示图标。优先放在游戏外的空隙；没有可用空隙时放在当前 iframe 视口右上边缘，确保可触达。按钮固定定位，不占文档布局。支持时使用浏览器顶层 popover，避免被普通页面浮层覆盖或裁切。
- 鼠标悬停定位点附近时显示图标，离开后仅显示定位点；键盘 Tab 聚焦时显示，触屏设备保持可见。点击全屏，Esc 退出。
- Mist 使用外层游戏 iframe，在现有父容器中全屏，并给 iframe 分配居中的 16:9 视口。在 16:10 屏幕上上下留黑边。
- Deep One 使用含 `game-iframe` 的中间页面作为控制入口。外层 `game_frame` 页面及内层渲染页不重复生成按钮；有子页面接管时隐藏祖先页面入口。
- 全屏时临时隐藏游戏元素的同级 banner 等内容，退出恢复原有样式。iframe 不移动、不重新加载；不修改 Canvas 绘制分辨率。游戏 iframe 内的内容仍由游戏页面管理。
- 为已识别的游戏 iframe 补充全屏委派属性；服务器的权限策略仍可能限制全屏。权限被禁用的页面不生成无效入口，请求失败时显示错误信息。

## 验证

运行：

```sh
node --check dmm-games-fullscreen.user.js
node --test tests/fullscreen.test.cjs
```

在安装了 Microsoft Edge 的 Windows 上，可以额外运行：

```sh
node tests/browser-smoke.cjs
```

浏览器检查使用本地测试页面、临时浏览器配置及本机调试端口，验证真实全屏、iframe 内部视口为 16:9、同级 banner 隐藏以及退出后布局恢复。

真实游戏页面仍需验收：Mist 在 16:10 屏幕上的显示、Deep One 唯一入口及鼠标坐标、按钮随页面滚动的位置，以及浏览器全屏权限。本地测试不能替代登录后的真实游戏引擎验证。
