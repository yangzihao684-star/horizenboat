# examples

这个目录里的内容大多是**真实运行产物**，不是手写的样例——用仓库自带的数据跑 MCP Server 得到的输出。

| 文件 | 怎么来的 |
| --- | --- |
| `lock-canon-context.echo-loop.md` | `lock_canon_context("echo-loop", "t1", ["shen-wu", "xiaoman"])` |
| `audit-plot-ooc.echo-loop.md` | `audit_plot_ooc` 审查一段故意违规的大纲 |
| `spark-divergence.echo-loop.md` | `spark_world_divergence("echo-loop", "el-h2")` |
| `work.template.json` | 新增作品时复制这个骨架 |

自己复现：

```bash
HORIZENBOAT_API_URL=web/public/api/v1 python mcp-server/server.py --selftest
```

先看 `audit-plot-ooc.echo-loop.md` 最直观：一段"看着挺爽"的大纲，被拆成 2 处硬冲突 + 1 处越阶，每条都带命中证据和改法。
