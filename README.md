# Fabric Color Database · 官方展示页

本仓库是桌面科研软件 **[Fabric Color Database（电子面料色彩数据库）](https://github.com/gzx5418/fabric-color-database)** 的静态展示站点源码，部署于 [fabriccolor.is-an.ai](https://fabriccolor.is-an.ai)。

## 页面特性

- **交互式桌面工作台预览**：还原软件核心布局与底部磨砂玻璃全局吸色板，支持实时切换织物组织与染整色样。
- **在线色彩科学实验室**：
  - **织物纹理换色**：程序化渲染平纹、斜纹（正/反）、缎纹（正/反）五类实验织物微观经纬纹理。
  - **CIE 光源与色貌模拟**：内置 CIE 15:2004 六大标准照明体（D50 / D55 / D65 / D75 / A / C）相对光谱功率分布（SPD）曲线与色貌对比。
  - **CIEDE2000 (ΔE00) 检定**：实时计算 ISO/CIE 11664-6 感知色差与 ΔL* / ΔC* / ΔH* 分量。
- **八大模块全景与三层架构说明**：完整展示 Tauri 2 + Rust + Python Worker + SQLite 桌面端能力。

## 目录结构

- `index.html` — 展示页入口
- `styles.css` — 样式与响应式设计令牌
- `app.js` — 色彩数学引擎与交互逻辑（零外部依赖）
- `assets/brand-mark.png` — 品牌徽标
- `CNAME` — 自定义域名配置
