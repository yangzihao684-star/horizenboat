"""horizonboat-mcp 的包入口。

实现全部在 mcp-server/server.py 单文件里；这里只是给打包系统一个
不会污染顶层命名空间的入口（wheel 里的 horizonboat_mcp/server.py 由 hatch 映射进来）。
"""

from .server import main, mcp

__all__ = ["main", "mcp"]
