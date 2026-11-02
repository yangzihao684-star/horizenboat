# 贡献指南

这个项目的核心资产是**数据**，不是代码。所以贡献方式有三种，按价值排序：

1. **新增一部作品** —— 最有价值
2. **修正一部作品里的设定错误**（吃书、错字、字段缺失、台词写歪）
3. **改站点 / MCP Server** —— 代码改动请先开 issue 说清楚动机

---

## 一、数据放在哪

```
web/public/api/v1/
├── index.json                 # 检索索引：所有作品都要在这里登记
├── schema.json                # JSON Schema 契约
└── works/{work_id}.json       # 单部作品的完整数据包
```

**唯一的硬规则**：数据在 `web/public/api/v1/` 下，站点和 MCP Server 都会读它。没有数据库、没有构建期转换。

---

## 二、新增一部作品

```bash
git clone https://github.com/yangzihao684-star/horizenboat
cd horizenboat

# 1. 复制骨架
cp examples/work.template.json web/public/api/v1/works/your-work-id.json

# 2. 把骨架填满（下面有字段速查）
#    注意 work_id 只能用 [a-z0-9-]

# 3. 在 index.json 的 works 数组里登记，
#    同时更新 counts、tags、以及作品自己的 stats

# 4. 校验
cd web && npm install && npm run check:api

# 5. 起站点看效果
npm run dev
```

校验器会逐项检查：索引和数据包是否互相覆盖、id 是否重复、每条 `keywords` 是否非空、`stats` 与实际数量是否一致。**它报什么就改什么，别绕过。**

---

## 三、字段速查

| 字段 | 你必须回答的问题 |
| --- | --- |
| `world_laws[].law` | 哪条规则一旦破了，故事就不再属于这个世界？ |
| `world_laws[].enforcement` | 写作者要怎么写才算守住了它？（给可执行的动作，不是形容词） |
| `timelines[].knowledge_boundaries` | 角色此刻**不知道**什么？ |
| `timelines[].forbidden_events[].because` | 为什么提前写会塌？ |
| `characters[].drive` | 他要什么，为此愿意付出什么代价？ |
| `characters[].speech_pattern` | 句长、用词、情绪外露程度——具体到能判断"这句像不像他" |
| `characters[].ooc_taboos[].rule` | 写出这一条，读者会立刻觉得"这不是他" |

### `keywords` 是整个系统的扳机

它同时被两处使用：MCP 的 `audit_plot_ooc` 拿它做交叉比对；`npm run check:api` 强制它非空。

写得好：

```json
{ "rule": "角色不会当众情绪崩溃", "triggers": ["大喊道", "吼出", "仰天长啸"] }
```

写了等于没写：

```json
{ "rule": "角色不会 OOC", "triggers": ["OOC"] }
```

判断标准很朴素：**这些词会真的出现在"写歪了"的句子里吗？** 会，就写进去。

### 台词分两类

```json
{ "text": "所有人都会死，包括我。", "type": "canon", "note": "第一卷题记" }
{ "text": "……我不太喜欢这个价格。但我们还是可以谈谈。", "type": "style" }
```

- `canon`：正典原句，有出处才用
- `style`：按角色语域仿写，用来对齐语气，**不冒充原文**

拿不准就写 `style`。宁可标注保守，也不要让人以为你在引用。

### 时间线怎么切

不要按卷切，按**角色知道什么**切。一个好的时期划分要能回答：

- 这个时期他的战力上限是什么？
- 他现在还不知道哪件大事？
- 哪些情节现在写就是吃书？

2-3 个时期通常够用。多于 4 个说明你在写剧情梗概，不是在切边界。

---

## 四、我们会看什么

- **边界是否具体**：能被写歪的才算边界，"性格复杂"不算
- **台词是否可锚定**：读完能不能判断一句新台词像不像这个角色
- **黑名单是否有理由**：每条 `because` 都要说清"提前写会毁掉什么"
- **是否诚实**：拿不准的标注为 `style`，别硬充正典

---

## 五、版权与边界

- **二创**：注明原作者与作品名，`rights_note` 里写清楚；**不粘贴原文正文**，只做设定摘要与索引
- **原创**：默认 CC BY-NC-SA 4.0，愿意放开请在 `rights_note` 里写明
- 不接受：完整搬运正文、把别人的原创设定改个名当自己的、涉及现实人物的攻击性内容

---

## 六、绝对不要提交

- `.secrets/` 目录、任何 token、任何 `.env`
- `node_modules/`、`web/dist/`、`__pycache__/`（已在 `.gitignore` 里）
- 本地 `cordis.patch.yml` 之类的 DSH 配置

代码风格：TypeScript 开 `strict`，Python 只用标准库 + `mcp` + `httpx`。MCP Server 保持**单文件**（`server.py`），这是有意为之。
