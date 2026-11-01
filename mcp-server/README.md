# horizenboat-mcp

HorizenBoat 的 MCP Server。**单文件、零复杂依赖、带进程内 TTL 缓存。**

它不负责写，它负责**不许写错**：

- 把作品的「世界铁律 / 时间线认知边界 / 未发生事件黑名单 / 角色台词钢印」一次拉全，并在末尾注入强制状态机指令；
- 在你动笔之前，拿你写的大纲去撞设定，返回带证据的冲突清单和改法；
- 把脑洞塞进「规则碰撞 → 势力反弹 → 生态异变」的三阶框架里。

---

## 1. 四个工具

| 工具 | 作用 | 关键行为 |
| --- | --- | --- |
| `search_horizenboat(query, tag="")` | 检索作品 / 角色 / 标签 / 钩子 | 只读索引，不消耗数据包；命中角色时直接给出下一步调用 |
| `lock_canon_context(work_id, timeline_id, active_characters)` | **核心防乱改** | 返回铁律 + 时间线边界 + 角色钢印 + 文风，末尾附 `GUARDRAIL DIRECTIVE`（R1–R6） |
| `audit_plot_ooc(work_id, timeline_id, proposed_plot)` | **动笔前审查** | 关键词级交叉比对，输出 `BLOCK / REVISE / PASS` 与逐条改法 |
| `spark_world_divergence(work_id, hook_id="", custom_what_if="")` | **高阶发散** | 注入三阶蝴蝶效应框架 + 五字段交付协议 |

另外还有：

- 资源：`horizenboat://index`、`horizenboat://works/{work_id}`
- 提示词：`hb-fanfic`（先锁后写）、`hb-brainstorm`（交互式发散）

### 审查到底怎么判

`audit_plot_ooc` 不是让模型自由发挥，而是四类可复现的检查：

1. **黑名单**：时间线里每条 `forbidden_events[].keywords` 是否出现在大纲里 → 命中即 `block`；
2. **铁律**：每条 `world_laws[].keywords`（力量凭空、代价缺失、位格越界…）；
3. **角色 OOC**：先识别大纲里出现了谁（支持中文名 / 英文名 / 别名 / 短名），再逐条比对 `ooc_taboos[].triggers`；
4. **战力上限与无铺垫转折**：`power_ceiling_triggers` 与「凭空 / 忽然 / 突然」这类词。

所以数据包里的 `keywords` / `triggers` 数组不是注释，**它们是审查引擎的触发词**。写数据的人越认真，审查越准。`npm run check:api` 会强制这些数组非空。

---

## 2. 装与跑

### 2.1 直接跑单文件（最省事）

```bash
pip install "mcp>=1.2" "httpx>=0.27"
python mcp-server/server.py --selftest        # 不开 MCP，先看它能不能拉到数据
python mcp-server/server.py                   # stdio，接客户端
```

### 2.2 用 uv 装成命令

```bash
cd mcp-server
uv sync
uv run horizenboat-mcp --selftest
```

### 2.3 协议冒烟测试

`smoke_test.py` 会真的起一个 MCP 会话（stdio），列出工具、提示词、资源，并调用一次 `lock_canon_context`：

```bash
python mcp-server/smoke_test.py
# [ok] tools = search_horizenboat, lock_canon_context, audit_plot_ooc, spark_world_divergence
# [ok] prompts = hb-fanfic, hb-brainstorm
# [ok] lock_canon_context -> chars = 4681 | guardrail = True
```

---

## 3. 客户端配置

### Claude Desktop / Cursor / Cline

```json
{
  "mcpServers": {
    "horizenboat": {
      "command": "python",
      "args": ["D:/path/to/horizenboat/mcp-server/server.py"],
      "env": { "HORIZENBOAT_API_URL": "https://horizenboat.online/api/v1" }
    }
  }
}
```

发布到 PyPI 之后可以换成更短的写法：

```json
{ "command": "uvx", "args": ["horizenboat-mcp"] }
```

### 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `HORIZENBOAT_API_URL` | https://horizenboat.online/api/v1 | 可填 `file://` 或本地目录（如 `D:/repo/web/public/api/v1`） |
| `HORIZENBOAT_CACHE_TTL` | 300 | 缓存秒数；0 表示每次都取 |
| `HORIZENBOAT_TIMEOUT` | 15 | 单次 HTTP 超时 |
| `HORIZENBOAT_TRANSPORT` | stdio | `stdio` / `sse` / `streamable-http` |

本地联调时不启站点也能跑：直接把 API URL 指到数据目录即可。

```bash
HORIZENBOAT_API_URL=D:/ideanovel/web/public/api/v1 python server.py --selftest
```

---

## 4. 设计取舍

- **只读 + 缓存**：设定包是静态 JSON，没有写接口。缓存用进程内字典 + `deepcopy` 隔离调用方，避免某个 Agent 把数据改脏。
- **错误也是给 Agent 看的**：找不到 `work_id` 时返回"你是不是想找：…"（`difflib` 近似匹配），而不是抛栈；工具永远不会返回空字符串让模型瞎猜。
- **结尾必须有 JSON**：每个工具输出的最后一段都是结构化 `json` 块（`guardrail` / `audit` / `divergence`），方便宿主 Agent 用程序读，而不是再解析一遍中文。
- **指令说人话但不容商量**：Guardrail 用 R1–R6 编号，方便引用，也方便后续对话里直接点名说"你违反了 R2"。

## 5. 已知边界

- 审查是**关键词级**的启发式，不是语义理解。它擅长抓"明写"的吃书（人名 + 事件 + 能力），不擅长抓"绕开关键词"的隐性越界。所以它的定位是**动笔前的第一道闸门**，不是终审。
- `active_characters` 传中文名也能识别，但建议传 id，最稳。
- 单文件意味着不提供鉴权；要挂公开 HTTP 端点，请自己加反向代理与限流。
