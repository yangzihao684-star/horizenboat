# Changelog

## 1.1.0 — 2026-11-02

### 新增
- 第三部数据包 `echo-loop`（《回声循环》，无限流 / 规则怪谈），补齐 6 条铁律、3 条时间线、4 张角色钢印、3 个发散钩子
- `examples/`：由真实工具运行生成的 `lock_canon_context` / `audit_plot_ooc` / `spark_world_divergence` 输出，以及新增作品用的 `work.template.json`
- `CONTRIBUTING.md`：数据规范、`keywords` 写法、时间线切法、评审标准
- `SECURITY.md`、`CHANGELOG.md`
- Issue 模板（新增作品 / bug）与 PR 模板
- `.github/workflows/ci.yml`：数据校验 + 类型检查 + 构建 + Python 3.10/3.12 双版本 selftest + wheel 构建

### 修复
- 站点：资源路径改为绝对（`base: "/"`），修复 `/work/xxx` 这类路径下白屏
- 站点：HTML 加 `Cache-Control: max-age=0, must-revalidate`，避免部署后旧 HTML 引用已删除资源导致白屏

## 1.0.1 — 2026-11-01

### 变更
- 品牌更名：HorizonBoat → **HorizenBoat**（未知之船），覆盖站点、包名、文档与配置
- Python 包 `horizonboat_mcp` → `horizenboat_mcp`，PyPI 名 `horizenboat-mcp`
- MCP 默认数据源切换为 `https://horizenboat.online/api/v1`

### 基础设施
- 部署到 Cloudflare Pages，绑定 `horizenboat.online` + `www`
- GitHub Pages 工作流改为手动触发（生产站点在 Cloudflare）

### 修复
- MCP Server：部分机器 `NO_PROXY` 含 `[::1]` 时 `httpx` 抛 `InvalidURL`，改为无代理重试
- 部署脚本：UTF-8 BOM 缺失导致 PowerShell 5.1 词法解析失败；单元素数组 unroll 导致请求头取成首字符
- DNS 脚本：只删除 web 记录（A / AAAA / CNAME），保留 MX 与 SPF

## 1.0.0 — 2026-11-01

- 初始版本：静态站点（Vite + React 19 + Tailwind v4）、静态 JSON API、`horizenboat-mcp` 单文件 MCP Server
- 两部数据包：`lord-of-the-mysteries`（二创防吃书）、`carbon-tribulation`（原创赛博修仙）
