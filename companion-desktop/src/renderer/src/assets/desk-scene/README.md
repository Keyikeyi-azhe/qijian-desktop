# 书桌运行素材

来源：项目 `artifacts/desk-scene/seedream-v3/delivery/`，由另一会话按用户书桌构想生成的 Seedream 日夜原画。

`day.webp` / `night.webp` 是完整壁纸的本地压缩版本。`hotspots.json` 包含两套八物件的 SVG 轮廓、显示名称、标签坐标与层级。所有坐标基于 2560×1440。

通过 `scripts/prepare-desk-scene.py` 从原始交付重新生成。运行时无需 Python、网络或任何图片 API。原始分层图片未叠加进背景，防止重绘差异造成重影。
