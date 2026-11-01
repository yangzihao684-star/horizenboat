# HorizenBoat · 未知之船

> 把设定锁死，把脑洞放开。

一个轻量的**内容二创设定平台**，加一个控制力很强的 MCP Server。

- **站**：检索作品的「防 OOC 系统提示词」「角色钢印卡」「世界观发散钩子」，按时间线切换认知边界，一键合成可直接粘贴给任意 AI 的结构化提示词。
- **数据**：没有数据库、没有后端。`public/api/v1/` 下的静态 JSON 就是 API。
- **Agent**：`mcp-server/server.py` 单文件 MCP Server，负责锁时间线、审吃书、逼发散。

---

## 1. 目录树

```
horizenboat/
├── web/                             # 静态站点：Vite 7 + React 19 + Tailwind v4
│   ├── public/
│   │   ├── api/v1/                  # ★ 唯一数据源（站点与 Agent 共用）
│   │   │   ├── index.json           #   轻量检索索引
│   │   │   ├── schema.json          #   JSON Schema（机器可读的契约）
│   │   │   └── works/
│   │   │       ├── lord-of-the-mysteries.json    # 知名作品二创防吃书示例
│   │   │       └── carbon-tribulation.json       # 原创架空世界观示例
│   │   ├── _headers                 # Cloudflare Pages 缓存头
│   │   └── robots.txt
│   ├── src/
│   │   ├── App.tsx                  # 路由 + 主题 + Cmd/Ctrl+K
│   │   ├── data.ts                  # 静态 JSON 取数（内存缓存 + 请求去重）
│   │   ├── lib/
│   │   │   ├── search.ts            # 模糊检索与打分
│   │   │   └── prompt.ts            # System Prompt / MCP 配置合成器
│   │   ├── components/              # 首屏、详情、命令面板、钢印卡、提示词预览…
│   │   └── styles.css               # 设计令牌（深浅两套）
│   ├── scripts/validate-api.mjs     # 数据结构校验器（CI 里跑）
│   └── vite.config.ts
├── mcp-server/                      # ★ 单文件 MCP Server
│   ├── server.py                    #   全部逻辑（约 1100 行，零复杂依赖）
│   ├── smoke_test.py                #   真的起一个 MCP 会话的协议冒烟测试
│   ├── pyproject.toml
│   └── requirements.txt
├── docs/DEPLOY.md                   # 部署与本地联调
├── .github/workflows/deploy-pages.yml
├── wrangler.toml                    # Cloudflare Pages
└── package.json                     # 根脚本（dev/build/check:api/mcp）
```

---

## 2. 五分钟跑起来

```bash
# 站点
cd web
npm install
npm run dev            # http://localhost:5173

# 数据校验（改过 JSON 一定要跑）
npm run check:api

# MCP Server（另开一个终端）
pip install "mcp>=1.2" "httpx>=0.27"
python mcp-server/server.py --selftest
python mcp-server/smoke_test.py
```

MCP 想读本地数据，不用起站点：

```bash
HORIZENBOAT_API_URL=D:/ideanovel/web/public/api/v1 python mcp-server/server.py --selftest
```

---

## 3. 三个核心概念

### 3.1 时间线闸门（而不是"角色设定"）

设定文档最常见的失败是：写了一堆"某某性格如何"，却不写**他在这一刻知道什么**。
HorizenBoat 把每个时期拍成一张闸门：

- `status_quo` 世界此刻的局势
- `power_ceiling` 这个时期的战力天花板
- `knowledge_boundaries` 角色此刻的认知边界
- `forbidden_events` **还没发生的事**（含触发关键词）

切换时间线，整页的边界、黑名单、可用角色台词一并刷新。这也是 MCP 里 `lock_canon_context` 的输入。

### 3.2 角色钢印卡

六件套：核心驱动力、性格内核、语言习惯（`speech_pattern`）、称呼矩阵（`addressing_matrix`）、台词锚点（`dialogue_samples`）、绝对禁止（`ooc_taboos`）。

台词分两类：

- `canon` —— 正典原句（原著或设定集原文）
- `style` —— 语域锚点（按角色语域仿写，用来对齐语气，不冒充原文）

这个区分是故意的：防 OOC 需要的是**语域**，不是背诵。

### 3.3 数据里的关键词就是审查引擎的扳机

每个 `world_laws[]`、`forbidden_events[]`、`ooc_taboos[]` 都带 `keywords` / `triggers`。
它们同时被两处使用：

1. MCP 的 `audit_plot_ooc` 拿它们做交叉比对，命中即报，并附上"改法"；
2. `npm run check:api` 强制它们非空、格式合法——防止某天有人加了一条铁律却忘了加触发词，导致审查静默失效。

---

## 4. 数据结构

### 4.1 `index.json`（检索索引）

| 字段 | 说明 |
| --- | --- |
| `works[].id` | work_id，同时是 `works/{id}.json` 的文件名 |
| `works[].title` / `title_en` | 中文名 / 原名 |
| `works[].type` | `fanfic`（二创防吃书）或 `original`（原创架空） |
| `works[].tags` | 世界观标签，用于筛选 |
| `works[].summary` | 一到两句话摘要（检索命中用） |
| `works[].characters_list` | `{ id, name, name_en, aliases, role, pathway }` |
| `works[].timelines_list` | `{ id, label, range }` |
| `works[].hooks_list` | `{ hook_id, title }` |
| `works[].search_terms` | 扩展检索词（别名、黑话、专有名词） |
| `works[].stats` | 角色数 / 时间线数 / 钩子数 / 铁律数，供前端展示与校验 |
| `counts` / `tags` | 全站统计与标签频次 |

机器可读的契约见 `public/api/v1/schema.json`（JSON Schema 2020-12），
`npm run check:api` 是它的轻量实现，额外负责索引与数据包的交叉一致性。

### 4.2 `works/{work_id}.json`（完整数据包）

```json
{
  "schema_version": "1.0",
  "work_id": "lord-of-the-mysteries",
  "title": "诡秘之主",
  "type": "fanfic",
  "tags": ["西幻", "克苏鲁", "蒸汽朋克"],
  "summary": "……",
  "world_laws": [
    {
      "id": "law-indestructible",
      "title": "非凡特性不灭律",
      "law": "非凡特性不会毁灭，也不会被凭空创造。",
      "enforcement": "任何「消灭」都要留下转移痕迹。",
      "keywords": ["彻底消散", "凭空获得"],
      "severity": "block"
    }
  ],
  "style_guide": { "voice": "…", "banned_words": ["…"], "required_terms": [] },
  "timelines": {
    "t2": {
      "id": "t2", "label": "贝克兰德篇", "range": "1350 年春 — 1351 年夏", "order": 2,
      "status_quo": "…",
      "power_ceiling": "…",
      "power_ceiling_triggers": ["序列 3", "天使"],
      "knowledge_boundaries": ["…"],
      "forbidden_events": [
        { "id": "t2-fe1", "label": "真神直接降临人间",
          "because": "…", "keywords": ["神降"], "severity": "block" }
      ]
    }
  },
  "characters": {
    "klein": {
      "id": "klein", "name": "克莱恩·莫雷蒂", "aliases": ["愚者"],
      "role": "主角", "pathway": "愚者途径 · 序列 9 占卜家起",
      "drive": "…",
      "personality_core": ["…"],
      "speech_pattern": "…",
      "addressing_matrix": [{ "target": "奥黛丽·霍尔", "form": "正义小姐", "note": "…" }],
      "dialogue_samples": [{ "text": "…", "type": "canon", "note": "…" }],
      "ooc_taboos": [{ "rule": "…", "triggers": ["破防", "yyds"], "severity": "block" }]
    }
  },
  "brainstorm_hooks": [
    { "hook_id": "lm-h1", "title": "…", "premise": "…",
      "ripple_questions": ["…", "…", "…"] }
  ],
  "integration": { "recommended_timeline": "t2", "recommended_characters": ["klein"], "sample_audit_plot": "…" }
}
```

`severity` 只有两档：`block`（硬冲突，必须改）与 `warn`（需要修正）。审查工具按这两档决定裁决。

---

## 5. 内置的两个样例

| work_id | 类型 | 为什么选它 |
| --- | --- | --- |
| `lord-of-the-mysteries` | 二创防吃书 | 序列体系 + 扮演法 + 三定律：天生适合演示"提前知道就吃书"。三条时间线覆盖开局 / 中盘 / 结局后 |
| `carbon-tribulation` | 原创架空 | 赛博修仙：灵气＝算力，天劫＝共识校验。全部原创，供他人自由发散 |

两个包都带 4 张角色钢印、3 条时间线、3 个发散钩子、6 条世界铁律，共 8 位角色、12 条铁律。

---

## 6. 一键交付

详情页右侧的交付面板由「当前时间线 + 勾选角色」实时合成：

- **复制 System Prompt**：`角色宪章` 结构（0 三条原则 / 1 世界铁律 / 2 时间线锁定 / 3 角色钢印 / 4 文风约束 / 5 交付协议 / 6 自检表），只含设定，不含任何网页元信息。
- **预览**：支持「排版」与「源码」两种视图；复制的一律是原始 Markdown。
- **复制调用指令**：`lock_canon_context(work_id=…, timeline_id=…, active_characters=[…])`。
- **复制 MCP 配置**：可直接粘到 Claude Desktop / Cursor / Cline。

---

## 7. MCP 一屏

| 工具 | 一句话 |
| --- | --- |
| `search_horizenboat` | 找作品、角色、标签、钩子 |
| `lock_canon_context` | 锁铁律 + 时间线 + 角色钢印，末尾附 `GUARDRAIL DIRECTIVE`（R1–R6） |
| `audit_plot_ooc` | 动笔前撞设定，返回 `BLOCK / REVISE / PASS` 与逐条改法 |
| `spark_world_divergence` | 三阶蝴蝶效应：规则碰撞 → 势力反弹 → 生态异变 |

细节（环境变量、客户端配置、设计取舍）见 [mcp-server/README.md](mcp-server/README.md)。

---

## 8. 部署

站点是纯静态产物（`web/dist`），可以直接丢到任何 CDN：

- Cloudflare Pages：`npm run build` + 输出目录 `web/dist`
- GitHub Pages：仓库已带 `.github/workflows/deploy-pages.yml`

完整步骤（含自定义域名 horizenboat.online、缓存头、MCP 安装）见 [docs/DEPLOY.md](docs/DEPLOY.md)。

---

## 9. 版权

- 站点代码：MIT
- 设定摘要与原创世界观：CC BY-NC-SA 4.0
- 《诡秘之主》相关角色与设定版权归原作者**爱潜水的乌贼**及出版方所有，本站仅作同人写作的连续性校验，不包含原文正文。
