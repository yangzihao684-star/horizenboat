# 部署与本地联调

目标：`git clone` 之后十分钟内，本地能跑、线上能开、Agent 能连。

---

## 0. 环境

| 依赖 | 版本 | 用途 |
| --- | --- | --- |
| Node.js | ≥ 20 | 构建站点 |
| Python | ≥ 3.10 | 跑 MCP Server |
| （可选）uv | 最新 | 用 `uv sync` / `uvx` 管 MCP |

---

## 1. 本地联调

### 1.1 站点

```bash
cd web
npm install
npm run dev          # http://localhost:5173
```

Vite 会直接把 `web/public` 挂到站点根：`/api/v1/index.json` 就是磁盘上的那个文件。
**改 JSON 不需要重启**，刷新即可（前端对数据做了 no-cache 请求）。

页面上的「复制 System Prompt」「预览」都在本地完成，不会发出任何网络请求。

### 1.2 数据校验

改完数据一定要跑：

```bash
cd web
npm run check:api
```

它会检查：索引与数据包是否互相覆盖、id 是否重复、时间线 / 角色 / 钩子字段是否齐全、
`keywords` / `triggers` 是否为空、`stats` 与 `counts` 是否与实际一致。
CI 里也挂了这一步——数据漂移不应该靠肉眼发现。

### 1.3 MCP Server

```bash
pip install "mcp>=1.2" "httpx>=0.27"

# 直接读本地数据目录（不用起站点）
HORIZENBOAT_API_URL=D:/ideanovel/web/public/api/v1 python mcp-server/server.py --selftest

# 或者打本地 dev server
HORIZENBOAT_API_URL=http://localhost:5173/api/v1 python mcp-server/server.py --selftest

# 协议级冒烟测试（真起一个 MCP 会话）
python mcp-server/smoke_test.py
```

Windows PowerShell 里设环境变量：

```powershell
$env:HORIZENBOAT_API_URL = "D:\ideanovel\web\public\api\v1"
python mcp-server\server.py --selftest
```

### 1.4 联调检查表

- [ ] 首页能搜到「诡秘之主」「赛博修仙」，输入即筛
- [ ] `Ctrl/Cmd + K` 唤起命令面板，按 ↑↓ 能选、回车能跳
- [ ] 详情页切换时间线，认知边界与黑名单同步刷新，URL 带上 `?t=`
- [ ] 勾选 / 取消角色，右侧提示词字数实时变化
- [ ] 「预览」里「排版 / 源码」两种视图内容一致，复制到 AI 里能用
- [ ] 手机宽度下交付面板在正文之前，不出现横向滚动条
- [ ] `python mcp-server/server.py --selftest` 四项工具都有输出

---

## 2. 构建

```bash
cd web
npm run build        # 产物在 web/dist
npm run preview      # 本地预览生产构建
```

产物只有 `index.html` + `assets/` + `api/v1/`，没有任何服务端运行时。

两个刻意的选择：

- `vite.config.ts` 里 `base: "./"` —— 资源全用相对路径，因此部署在根域、子目录、甚至 `file://` 下都能开；
- 路由走 `hash`（`#/work/xxx`）——**不需要任何 rewrite 规则**，CDN 与静态托管零配置。

---

## 3. Cloudflare Pages

### 3.1 面板方式（推荐）

| 配置项 | 值 |
| --- | --- |
| Framework preset | None |
| Root directory | `web` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | 20 或 22 |

`web/public/_headers` 会被自动识别，给 `/api/v1/*` 加上 5 分钟缓存与 `Access-Control-Allow-Origin: *`
（方便任何 Agent / 第三方页面直接抓 JSON）。

### 3.2 命令行方式

```bash
npm --prefix web run build
npx wrangler pages deploy web/dist --project-name horizenboat
```

仓库根目录的 `wrangler.toml` 已经写好 `pages_build_output_dir`。

### 3.3 自定义域名

1. Cloudflare Pages → 项目 → Custom domains → 添加 `horizenboat.online` 与 `www.horizenboat.online`；
2. 在 Cloudflare DNS 里加 `CNAME horizenboat → <project>.pages.dev`（根域用 `@` + CNAME flattening）；
3. SSL 由 Cloudflare 自动签发。

这个域名同时也是 MCP Server 的默认数据源（`https://horizenboat.online/api/v1`），
所以**域名变更时记得同步改** `server.py` 里的 `DEFAULT_API` 与前端 `mcpConfig()` 的默认值。

---

## 4. GitHub Pages

仓库自带 `.github/workflows/deploy-pages.yml`：

1. Settings → Pages → Source 选 **GitHub Actions**；
2. push 到 `main` 自动构建（会先跑 `check:api`，数据不合法就不部署）；
3. 产物里的 `dist/404.html` 是 `index.html` 的副本，兜底任何直接访问的深链接。

因为用了相对 base + hash 路由，项目页（`/username/repo/`）与用户页都能直接工作，不用改配置。

---

## 5. MCP 分发

### 5.1 本地直接用

客户端里填绝对路径即可，见 [mcp-server/README.md](../mcp-server/README.md) 的「客户端配置」。

### 5.2 发布到 PyPI

```bash
cd mcp-server
uv build            # 生成 dist/horizenboat-mcp-1.0.0-py3-none-any.whl
uv publish          # 需要 PYPI_TOKEN
```

发布之后用户就能写 `{"command": "uvx", "args": ["horizenboat-mcp"]}`。

打包说明：`pyproject.toml` 用 hatchling 的 `only-include = ["server.py"]`，
把单文件放到 wheel 根，`horizenboat-mcp = "server:main"` 直接指向它——**没有包目录、没有 `__init__.py`**，
保持"单文件"这个卖点。

---

## 6. 常见问题

**Q：页面报「检索索引没能加载」**
多为 base 路径问题。先确认 `/api/v1/index.json` 能直接打开；若数据放在别的域名，
构建时用 `VITE_HB_API_BASE=https://example.com/api/v1 npm run build`，或在部署层加一条 `/api/*` 反代。
页面错误提示里会打印实际请求地址，照着查即可。

**Q：「复制」没反应**
`navigator.clipboard` 只在安全上下文（https 或 localhost）可用。代码里已经做了 `execCommand` 兜底，
但个别浏览器策略更严——这时会提示「复制失败，请手动选择文本」，预览里的源码视图可以手动全选。

**Q：给 MCP 传中文角色名可以吗**
可以，`resolve_characters` 支持 id / 中文名 / 英文名 / 别名 / 「·」前的短名。但传 id 最稳。

**Q：改完数据要重启 MCP 吗**
不用。缓存 TTL 默认 300 秒；想立刻生效就设 `HORIZENBOAT_CACHE_TTL=0`。

**Q：能不能加第三部作品**
加一个 `works/{id}.json`，再往 `index.json` 的 `works` 里加一条（`stats`、`counts`、`tags` 都要同步），
最后跑 `npm run check:api`。校验器会告诉你漏了哪一项。
