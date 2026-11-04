# VPet 上游素材与来源

- 项目：https://github.com/LorisYounger/VPet
- 固定来源提交：`b021af2043c10c73f2fa65bfbaa8523959dff683`
- 取得日期：2026-11-03。
- `upstream/`：稀疏检出的原始源码与动画。保留上游文件，不在此目录修改适配代码。
- `asset-provenance.json`：本次使用的 978 帧原文件路径、SHA-256、时长及来源提交。

角色萝莉斯现接入 36 个菜单动作，使用 99 段原始图层／动作序列，并合成吃面包、喝水、礼物三段完整动画，共 102 段图集。`clip-sources.json` 按分类记录所选动作源目录；`asset-provenance.json` 记录原始帧和合成所用道具、轨迹配置的校验值。没有导入商店、余额查询、付费服务或聊天接口。

Electron 适配代码在 `companion-desktop/src/renderer/src/components/pet/`；转换后的图集位于 `companion-desktop/src/renderer/src/assets/vpet/`。原始 PNG 缩放至 320×320，合成为 WebP 图集；保留文件名给定的每帧时长。执行 `companion-desktop/scripts/prepare-vpet-assets.py` 可重新生成素材及来源清单。

## 许可文件

上游代码许可证在 `upstream/LICENSE`（Apache-2.0）。动画另有授权声明，不能只按代码许可证处理。

完整动画声明保存在应用的 `src/renderer/public/licenses/vpet/ANIMATION-LICENSE.txt`，代码许可证保存在同目录 `LICENSE.txt`，随打包应用分发。点击应用标题栏「栖间」可直接查看声明和项目链接。

当前按用户所述的非商用比赛演示用途接入，并保留动画来源告知。上游规定分发动画不可收费；商业使用另有首次弹窗、快捷来源页面、联系作者等要求，详见随附原文。此适配未取得额外的商业授权。
