# 栖间窗口内小游戏（2026-11-04）

## 体验

双击项目根目录 `启动栖间.cmd`，点击书桌手柄，选择回旋镖冒险、元素沙盘、六角消除或水果篮子。游戏始终显示在同一个 Electron 窗口内。顶部可暂停、重开、返回选择和回到书桌。退出销毁游戏 iframe。

## 文件和构建

- `companion-desktop/src/renderer/src/components/games`：选择界面、游戏容器及目录。
- `companion-desktop/src/main/game-protocol.ts`：`qijian-game://游戏名/` 本机资源协议，不启动 HTTP 服务。
- `companion-desktop/src/renderer/public/games`：四个独立运行目录，随构建复制进应用，含许可证、源码快照和 SHA-256 清单。
- `companion-desktop/scripts/game-adapters`：隔离通信桥和水果适配源码。
- `companion-desktop/scripts/prepare-desk-games.cjs`：从本地固定版本源码重建运行资源。已生成的 public 文件可直接构建，不依赖在线下载。
- `third_party/games`：上游下载及版本记录。

在 companion-desktop 目录执行 `npm run build:win` 生成 `dist/win-unpacked/Qijian.exe`。修改游戏适配脚本后先执行 `node scripts/prepare-desk-games.cjs`，再构建。便签、Excalidraw、ts-fsrs、日历、宠物等使用工作区当前实现，未回退依赖或共享文件。

## 来源与修改

| 游戏 | 上游与版本 | 本地修改 |
| --- | --- | --- |
| Bounce Back | KilledByAPixel/BounceBack，395fd046338e6c5d5840d10e7fbd74132f90b8f6，GPL-2.0-or-later | 加载握手、宿主暂停、音频暂停、隔离运行 |
| Hextris | Hextris/hextris，3f4847dc8fd7dab3d1c87e6324b9159d92fbd396，GPL-3.0-or-later | 移除统计和广告加载、外部分享入口，调整 iframe 焦点与暂停，保留作者署名 |
| Sandspiel | MaxBittker/sandspiel，9936e06b07a583aedfba9589c0cead2917f405fb，MIT | 本地 WASM，禁用 Firebase 云操作、Sentry、服务工作线程和外部入口，材料按钮中文化 |
| Fruit Basket | jjkay03/Fruit-Basket，b8ff578fc29b38dd66603d62e2ffaa77367867ac | 使用原水果贴图，参考队列/合成/计分规则，以 Matter.js 0.20.0（MIT）重写物理和界面 |

Sandspiel 的实际 JS/WASM 来自作者 sandspiel.club 已部署构建，不能声称与保存的源码提交完全对应。实际文件及 SHA-256 记录在运行目录 manifest.json。Bounce Back 与 Hextris 的修改后 JS 本身即运行源码，另附完整上游 source.zip 和适配脚本。

E 是明确标注的网页适配版本，不是原 Unity 构建；网页技术运行在软件内嵌视图，不打开浏览器。本机找到的编辑器为 `D:\UUUUUUUUUnity\2022.3.62t9\Editor\Tuanjie.exe`，未发现 WebGL 模块，源项目为 Unity 6，因此未使用该编辑器导出。原 E 项目未核实到完整素材授权，本包仅供本地体验，公开分发前需获得许可或更换素材。

封面来自各自源项目截图/封面，转换为 720×300 WebP 后存入各游戏目录。水果贴图透明边距在加载时裁切，使显示大小匹配碰撞圆。

## 隔离与验证

每款游戏独立 origin 和存储，没有宿主 preload API。iframe 不允许弹窗或顶层跳转，桥接屏蔽链接，协议只接受四个白名单目录并阻止路径越界。CSP 阻止外网脚本、网络请求和子框架；Sandspiel 的 regl 需要动态编译，因此仅该游戏允许 unsafe-eval。

`node scripts/verify-desk-games.cjs [打包后的 exe 路径]` 在真实 Electron 窗口中测试加载、游戏操作、暂停/恢复、退出释放、单窗口、无外网请求及 DeskTools 入口。截图和报告输出至 `artifacts/previews/desk-games`。`scripts/verify-desk-tools.cjs` 可独立回归便签、画板及复习存储流程。
