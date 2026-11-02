# 安全策略

## 报告问题

**不要开公开 issue。** 用 GitHub 的 [Private vulnerability reporting](https://github.com/yangzihao684-star/horizenboat/security/advisories/new)，或在仓库 Security 标签页里创建 advisory。

请在报告里说明：受影响的组件（站点 / MCP Server / 部署脚本）、复现步骤、可能的影响面。

## 支持范围

这个项目没有数据库、没有账号体系、没有服务端运行时——站点是纯静态文件，MCP Server 只读远端 JSON。所以攻击面很小，主要集中在：

| 面 | 说明 |
| --- | --- |
| 静态数据 | `/api/v1/*.json` 是公开只读的，任何人都能抓 |
| MCP Server | 工具只做读取与关键词比对，不写任何东西 |
| 部署脚本 | `scripts/publish.ps1` / `attach-mcp-tokens.ps1` 会用到凭据 |

## 凭据处理

- 凭据只放在 `.secrets/` 下（已在 `.gitignore` 第 27 行），脚本从不打印完整 token
- DSH 的 MCP 配置（`~/.dsh/profiles/desktop/cordis.patch.yml`）里如果有明文 token，**不要分享这个文件**
- 建议给 GitHub 用 fine-grained PAT（Contents + Workflows），给 Cloudflare 用最小权限 API Token
- 一旦 token 出现在聊天记录、截图或公开日志里，立即吊销并重新签发

## 我们不接受的

- 用 MCP 工具或脚本做任何破坏性操作（删仓库、删 DNS 记录）的"演示"
- 提交包含真实凭据的 PR
