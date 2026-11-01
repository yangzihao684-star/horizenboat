#!/usr/bin/env python3
"""
horizonboat-mcp 协议冒烟测试。

真的起一个 MCP 会话（stdio），列出工具 / 提示词 / 资源，并调用一次核心工具。
用来在本地确认「装好了、能连、能调」，不需要任何客户端。

用法:
  python smoke_test.py
  HORIZONBOAT_API_URL=D:/ideanovel/web/public/api/v1 python smoke_test.py
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

SERVER = Path(__file__).with_name("server.py")


async def main() -> int:
    params = StdioServerParameters(
        command=sys.executable,
        args=[str(SERVER)],
        env={**os.environ, "PYTHONIOENCODING": "utf-8"},
    )

    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            print("[ok] initialize")

            tools = await session.list_tools()
            print("[ok] tools =", ", ".join(tool.name for tool in tools.tools))

            prompts = await session.list_prompts()
            print("[ok] prompts =", ", ".join(prompt.name for prompt in prompts.prompts))

            resources = await session.list_resources()
            print("[ok] resources =", ", ".join(str(resource.uri) for resource in resources.resources))

            result = await session.call_tool(
                "search_horizonboat",
                arguments={"query": "克莱恩"},
            )
            text = "\n".join(block.text for block in result.content if hasattr(block, "text"))
            print("[ok] search_horizonboat ->", text.splitlines()[0] if text else "(empty)")

            result = await session.call_tool(
                "lock_canon_context",
                arguments={
                    "work_id": "lord-of-the-mysteries",
                    "timeline_id": "t1",
                    "active_characters": ["克莱恩", "leonard"],
                },
            )
            text = "\n".join(block.text for block in result.content if hasattr(block, "text"))
            locked = "GUARDRAIL DIRECTIVE" in text
            print("[ok] lock_canon_context -> chars =", len(text), "| guardrail =", locked)
            print("-" * 60)
            for line in text.splitlines():
                if line.startswith("时间线：") or line.startswith("work_id =") or line.startswith("在场角色："):
                    print("   ", line)
            print("-" * 60)

            if not locked:
                print("[fail] guardrail directive missing")
                return 1

    print("[done] protocol smoke test passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
