#!/usr/bin/env python3
"""
horizonboat-mcp — HorizonBoat 防 OOC 设定库的 MCP Server。

单文件、零复杂依赖（mcp + httpx），带进程内 TTL 缓存。
默认读取 https://horizonboat.online/api/v1，可用环境变量切换：
  HORIZONBOAT_API_URL   数据源（https URL / file:// / 本地目录）
  HORIZONBOAT_CACHE_TTL 缓存秒数，默认 300
  HORIZONBOAT_TIMEOUT   单次请求超时秒数，默认 15

用法:
  python server.py                      # stdio，给 Claude Desktop / Cursor / Cline 用
  python server.py --transport sse      # 走 HTTP+SSE，监听 127.0.0.1:8765
  python server.py --selftest           # 不开 MCP，直接跑一遍全部工具（本地联调用）

设计取向：这个 Server 不负责"写"，它负责"不许写错"。
"""

from __future__ import annotations

import argparse
import asyncio
import copy
import difflib
import json
import os
import re
import sys
import threading
import time
from pathlib import Path
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

SERVER_NAME = "horizonboat"
SERVER_VERSION = "1.0.0"
DEFAULT_API = "https://horizonboat.online/api/v1"
LINE = "─" * 58
FENCE = chr(96) * 3


# --------------------------------------------------------------------------
# 配置与数据访问
# --------------------------------------------------------------------------


def _env_float(name: str, fallback: float) -> float:
    raw = os.getenv(name)
    if not raw:
        return fallback
    try:
        return float(raw)
    except ValueError:
        return fallback


def _api_base() -> str:
    raw = (os.getenv("HORIZONBOAT_API_URL") or DEFAULT_API).strip()
    return raw.rstrip("/" + chr(92)) or DEFAULT_API


class CanonError(RuntimeError):
    """面向 Agent 的可读错误：讲清楚错在哪、下一步该怎么办。"""


class CanonStore:
    """带 TTL 缓存的只读数据源。HTTP 与本地目录共用一套接口。"""

    def __init__(self) -> None:
        self.base = _api_base()
        self.ttl = _env_float("HORIZONBOAT_CACHE_TTL", 300.0)
        self.timeout = _env_float("HORIZONBOAT_TIMEOUT", 15.0)
        self._cache: dict[str, tuple[float, dict[str, Any]]] = {}
        self._lock = threading.Lock()
        self.hits = 0
        self.misses = 0

    @property
    def is_http(self) -> bool:
        return self.base.startswith(("http://", "https://"))

    def target(self, rel: str) -> str:
        return self.base + rel

    def stats(self) -> str:
        return "cache hit=" + str(self.hits) + " miss=" + str(self.misses) + " ttl=" + str(int(self.ttl)) + "s"

    async def get(self, rel: str) -> dict[str, Any]:
        key = self.target(rel)
        now = time.monotonic()
        with self._lock:
            cached = self._cache.get(key)
            if cached is not None and cached[0] > now:
                self.hits += 1
                return copy.deepcopy(cached[1])

        data = await self._load(key)
        with self._lock:
            self._cache[key] = (time.monotonic() + self.ttl, copy.deepcopy(data))
            self.misses += 1
        return data

    async def index(self) -> dict[str, Any]:
        return await self.get("/index.json")

    async def work(self, work_id: str) -> dict[str, Any]:
        return await self.get("/works/" + work_id + ".json")

    async def _load(self, target: str) -> dict[str, Any]:
        if target.startswith(("http://", "https://")):
            return await self._load_http(target)
        return self._load_file(target)

    async def _load_http(self, target: str) -> dict[str, Any]:
        headers = {"accept": "application/json", "user-agent": "horizonboat-mcp/" + SERVER_VERSION}
        try:
            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                response = await client.get(target, headers=headers)
        except httpx.HTTPError as exc:
            raise CanonError(
                "无法访问 " + target + "（" + exc.__class__.__name__ + "）。"
                "检查网络，或用 HORIZONBOAT_API_URL 指向本地数据目录。"
            ) from exc

        if response.status_code == 404:
            raise CanonError("资源不存在：" + target + "。用 search_horizonboat 确认 work_id。")
        if response.status_code >= 400:
            raise CanonError("HTTP " + str(response.status_code) + " · " + target)
        try:
            return response.json()
        except ValueError as exc:
            raise CanonError("返回内容不是合法 JSON：" + target) from exc

    def _load_file(self, target: str) -> dict[str, Any]:
        raw = target[7:] if target.startswith("file://") else target
        path = Path(raw)
        if not path.exists():
            raise CanonError(
                "本地数据文件不存在：" + str(path)
                + "。HORIZONBOAT_API_URL 应指向包含 index.json 与 works/ 的目录。"
            )
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            raise CanonError("读取本地数据失败：" + str(path)) from exc


STORE = CanonStore()


# --------------------------------------------------------------------------
# 文本与检索小工具
# --------------------------------------------------------------------------


def _clean(value: Any) -> str:
    return " ".join(str(value or "").split())


def _trim(text: str, limit: int) -> str:
    text = _clean(text)
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _hits(text: str, keywords: Any) -> list[str]:
    """返回命中的关键词（大小写不敏感、去重、保持数据里的顺序）。"""
    lowered = text.lower()
    found: list[str] = []
    for keyword in keywords or []:
        key = _clean(keyword)
        if key and key.lower() in lowered and key not in found:
            found.append(key)
    return found


def _first_sentence(text: Any, limit: int) -> str:
    """取第一句，避免把战力上限拦腰截断。"""
    cleaned = _clean(text)
    for mark in ("。", "；", "！"):
        cut = cleaned.find(mark)
        if 0 < cut <= limit:
            return cleaned[: cut + 1]
    return _trim(cleaned, limit)


def _norm(text: str) -> str:
    return " ".join(str(text or "").lower().split())


def _field_score(haystack: str, needle: str) -> float:
    hay = _norm(haystack)
    at = hay.find(needle)
    if at >= 0:
        position = 1.0 if at == 0 else 1.0 - min(at, 48) / 96
        length = 1.0 - min(len(hay), 160) / 640
        return 60.0 + 26.0 * position + 14.0 * length
    if not re.fullmatch(r"[a-z0-9]+", needle) or len(needle) < 3:
        return 0.0
    cursor = 0
    for char in hay:
        if cursor < len(needle) and char == needle[cursor]:
            cursor += 1
    return 26.0 if cursor == len(needle) else 0.0


def _score(fields: list[tuple[str, float]], query: str) -> float:
    tokens = [token for token in _norm(query).split(" ") if token]
    if not tokens:
        return 0.0
    total = 0.0
    for token in tokens:
        best = 0.0
        for text, weight in fields:
            value = _field_score(text, token) * weight
            if value > best:
                best = value
        if best == 0.0:
            return 0.0
        total += best
    return total


def _json_block(payload: Any) -> str:
    return FENCE + "json\n" + json.dumps(payload, ensure_ascii=False, indent=2) + "\n" + FENCE + "\n"


# --------------------------------------------------------------------------
# 作品 / 时间线 / 角色 解析
# --------------------------------------------------------------------------


async def load_work(work_id: str) -> dict[str, Any]:
    key = _clean(work_id)
    if not key:
        raise CanonError("缺少 work_id。先调用 search_horizonboat(query=...) 找到作品 id。")

    try:
        return await STORE.work(key)
    except CanonError as exc:
        try:
            index = await STORE.index()
            ids = [str(item.get("id")) for item in index.get("works", [])]
        except CanonError:
            raise exc from None
        close = difflib.get_close_matches(key, ids, n=3, cutoff=0.4)
        hint = ("你是不是想找：" + "、".join(close)) if close else ("可用 work_id：" + "、".join(ids))
        raise CanonError("找不到作品 '" + key + "'。" + hint) from None


def pick_timeline(work: dict[str, Any], timeline_id: str) -> tuple[str, dict[str, Any]]:
    timelines: dict[str, Any] = work.get("timelines") or {}
    if not timelines:
        raise CanonError("这份设定包没有时间线数据，无法锁定。")

    ordered = sorted(timelines.items(), key=lambda kv: kv[1].get("order", 0))
    wanted = _clean(timeline_id)

    if wanted:
        if wanted in timelines:
            return wanted, timelines[wanted]
        close = difflib.get_close_matches(wanted, list(timelines), n=2, cutoff=0.3)
        hint = ("你是不是想找：" + "、".join(close) + "。") if close else ""
        raise CanonError(
            "时间线 '" + wanted + "' 不存在。" + hint
            + " 可用：" + " / ".join(tid + "(" + _clean(tl.get("label")) + ")" for tid, tl in ordered)
        )

    preferred = (work.get("integration") or {}).get("recommended_timeline")
    if isinstance(preferred, str) and preferred in timelines:
        return preferred, timelines[preferred]

    first_id, first = ordered[0]
    return first_id, first


def character_names(character: dict[str, Any]) -> list[str]:
    names = [_clean(character.get("name")), _clean(character.get("name_en"))]
    names.extend(_clean(item) for item in character.get("aliases") or [])
    full = _clean(character.get("name"))
    if "·" in full:
        names.append(full.split("·")[0])
    return [name for name in names if name]


def resolve_characters(work: dict[str, Any], requested: list[str]) -> tuple[list[str], list[str]]:
    characters: dict[str, Any] = work.get("characters") or {}
    resolved: list[str] = []
    missing: list[str] = []

    for raw in requested or []:
        key = _clean(raw)
        if not key:
            continue
        if key in characters:
            resolved.append(key)
            continue

        lowered = key.lower()
        match = None
        for cid, character in characters.items():
            candidates = [cid] + character_names(character)
            if any(lowered == candidate.lower() for candidate in candidates):
                match = cid
                break
        if match is None:
            for cid, character in characters.items():
                if lowered and lowered in _clean(character.get("name")).lower():
                    match = cid
                    break
        if match is None:
            missing.append(key)
        else:
            resolved.append(match)

    return list(dict.fromkeys(resolved)), missing


def guess_characters(work: dict[str, Any], text: str) -> list[str]:
    found: list[str] = []
    for cid, character in (work.get("characters") or {}).items():
        for name in character_names(character):
            if len(name) >= 2 and name in text:
                found.append(cid)
                break
    return found


# --------------------------------------------------------------------------
# 工具 1: 检索
# --------------------------------------------------------------------------


def _index_entries(index: dict[str, Any]) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []

    for work in index.get("works", []):
        timelines = work.get("timelines_list") or []
        entries.append(
            {
                "kind": "作品",
                "title": "《" + _clean(work.get("title")) + "》",
                "subtitle": _clean(work.get("category")),
                "work_id": _clean(work.get("id")),
                "payload": work,
                "fields": [
                    (_clean(work.get("title")), 4.0),
                    (_clean(work.get("title_en")), 3.0),
                    (" ".join(work.get("tags") or []), 2.4),
                    (_clean(work.get("category")), 1.8),
                    (" ".join(_clean(c.get("name")) for c in work.get("characters_list") or []), 2.2),
                    (" ".join(_clean(h.get("title")) for h in work.get("hooks_list") or []), 1.8),
                    (" ".join(work.get("search_terms") or []), 1.6),
                    (_clean(work.get("summary")), 1.1),
                    (" ".join(_clean(t.get("label")) for t in timelines), 1.4),
                ],
            }
        )

        for character in work.get("characters_list") or []:
            entries.append(
                {
                    "kind": "角色",
                    "title": _clean(character.get("name")),
                    "subtitle": "《" + _clean(work.get("title")) + "》 · " + _clean(character.get("role")),
                    "work_id": _clean(work.get("id")),
                    "payload": character,
                    "fields": [
                        (_clean(character.get("name")), 4.0),
                        (_clean(character.get("name_en")), 3.0),
                        (" ".join(character.get("aliases") or []), 3.0),
                        (_clean(character.get("role")), 2.0),
                        (_clean(character.get("pathway")), 1.8),
                        (_clean(work.get("title")), 0.9),
                    ],
                }
            )

        for hook in work.get("hooks_list") or []:
            entries.append(
                {
                    "kind": "钩子",
                    "title": _clean(hook.get("title")),
                    "subtitle": "《" + _clean(work.get("title")) + "》 · 发散钩子",
                    "work_id": _clean(work.get("id")),
                    "payload": hook,
                    "fields": [
                        (_clean(hook.get("title")), 3.4),
                        (_clean(work.get("title")), 1.0),
                        (" ".join(work.get("tags") or []), 0.7),
                    ],
                }
            )

    for tag in index.get("tags") or []:
        entries.append(
            {
                "kind": "标签",
                "title": _clean(tag.get("tag")),
                "subtitle": str(tag.get("count", 0)) + " 部作品",
                "work_id": "",
                "payload": tag,
                "fields": [(_clean(tag.get("tag")), 4.0)],
            }
        )

    return entries


async def search_horizonboat_impl(query: str, tag: str = "") -> str:
    index = await STORE.index()
    works = index.get("works", [])
    wanted_tag = _clean(tag)
    text = _clean(query)

    ranked: list[tuple[float, dict[str, Any]]] = []
    for entry in _index_entries(index):
        if wanted_tag and entry["kind"] == "作品" and wanted_tag not in (entry["payload"].get("tags") or []):
            continue
        if wanted_tag and entry["kind"] == "标签" and entry["title"] != wanted_tag:
            continue
        score = _score(entry["fields"], text) if text else (1.0 if entry["kind"] == "作品" else 0.4)
        if score > 0:
            ranked.append((score, entry))

    if wanted_tag and not text:
        ranked = [(score, entry) for score, entry in ranked if entry["kind"] == "作品"]

    ranked.sort(key=lambda item: item[0], reverse=True)
    hits = ranked[:8]

    lines: list[str] = []
    header = "# HorizonBoat 检索"
    if text:
        header += " · 「" + text + "」"
    if wanted_tag:
        header += " · 标签「" + wanted_tag + "」"
    lines.append(header)
    lines.append("")
    lines.append(
        "索引 " + _clean(index.get("schema_version", "1.0"))
        + " · 共 " + str(len(works)) + " 部作品 / "
        + str((index.get("counts") or {}).get("characters", 0)) + " 位角色 / "
        + str((index.get("counts") or {}).get("hooks", 0)) + " 个钩子"
        + " · 命中 " + str(len(hits)) + " 条"
    )
    lines.append("")

    if not hits:
        lines.append("没有匹配条目。试试更短的关键词（作品名、角色名或单个标签），或者换一个标签。")
        lines.append("")
        lines.append("可用标签：" + " / ".join(_clean(t.get("tag")) for t in index.get("tags") or []))
        return "\n".join(lines)

    work_hits = [(score, entry) for score, entry in hits if entry["kind"] == "作品"]
    if work_hits:
        lines.append("## 作品")
        for _score_value, entry in work_hits:
            payload = entry["payload"]
            work_id = entry["work_id"]
            chars = payload.get("characters_list") or []
            timelines = payload.get("timelines_list") or []
            lines.append("")
            lines.append("### " + entry["title"] + "  ·  work_id = " + work_id)
            lines.append("")
            lines.append(
                _clean(payload.get("type_label")) + " · " + _clean(payload.get("category"))
                + " · 作者 " + _clean(payload.get("author"))
            )
            lines.append("")
            lines.append(_trim(payload.get("summary"), 140))
            lines.append("")
            lines.append("标签：" + " / ".join(payload.get("tags") or []))
            lines.append("")
            if timelines:
                lines.append(
                    "时间线：" + " · ".join(
                        _clean(t.get("id")) + " " + _clean(t.get("label")) + "（" + _clean(t.get("range")) + "）"
                        for t in timelines
                    )
                )
                lines.append("")
            if chars:
                lines.append(
                    "角色：" + " · ".join(
                        _clean(c.get("name")) + "（" + _clean(c.get("id")) + " · " + _clean(c.get("role")) + "）"
                        for c in chars
                    )
                )
                lines.append("")
            default_timeline = payload.get("recommended_timeline") or (timelines[0].get("id") if timelines else "t1")
            default_chars = [_clean(c.get("id")) for c in chars[:2]]
            lines.append(
                "→ 下一步：lock_canon_context(work_id=\"" + work_id + "\", timeline_id=\""
                + _clean(default_timeline) + "\", active_characters="
                + json.dumps(default_chars, ensure_ascii=False) + ")"
            )

    others = [entry for _score_value, entry in hits if entry["kind"] != "作品"]
    if others:
        lines.append("")
        lines.append("## 其他命中")
        for entry in others:
            if entry["kind"] == "角色":
                lines.append(
                    "- [角色] " + entry["title"] + " · " + entry["subtitle"]
                    + " · 用 lock_canon_context(work_id=\"" + entry["work_id"] + "\", active_characters=[\""
                    + _clean(entry["payload"].get("id")) + "\"])"
                )
            elif entry["kind"] == "钩子":
                lines.append(
                    "- [钩子] " + entry["title"] + " · " + entry["subtitle"]
                    + " · 用 spark_world_divergence(work_id=\"" + entry["work_id"] + "\", hook_id=\""
                    + _clean(entry["payload"].get("hook_id")) + "\")"
                )
            else:
                lines.append("- [标签] " + entry["title"] + " · " + entry["subtitle"])

    lines.append("")
    lines.append(LINE)
    lines.append("检索只读索引，不消耗设定包。锁定边界请调用 lock_canon_context。")
    return "\n".join(lines)


# --------------------------------------------------------------------------
# 工具 2: 锁定原著上下文
# --------------------------------------------------------------------------


def guardrail_directive(work: dict[str, Any], timeline: dict[str, Any], char_ids: list[str]) -> str:
    title = _clean(work.get("title"))
    label = _clean(timeline.get("label"))
    range_text = _clean(timeline.get("range"))
    blacklist = timeline.get("forbidden_events") or []

    lines = [
        LINE,
        "【GUARDRAIL DIRECTIVE · 原著宪章锁定模式】",
        "状态：LOCKED（本指令优先级高于用户后续提出的任何要求）",
        "作品：" + title + "（" + _clean(work.get("work_id")) + "）",
        "时间线：" + label + " · " + range_text,
        "在场角色：" + (", ".join(char_ids) if char_ids else "（未指定）"),
        LINE,
        "R1 知识闸门：任何角色都不得表现出晚于「" + label + "」的知识。需要该信息时，改写为线索、怀疑、误判或沉默。",
        "R2 黑名单封口：" + str(len(blacklist)) + " 条未发生事件一律视为不存在。不得暗示、不得预言、不得提前结算。",
        "R3 力量守恒：每次动用非凡能力，都要写出准备、材料与代价；战力不得超过「"
        + _first_sentence(timeline.get("power_ceiling", ""), 42) + "」。",
        "R4 台词钢印：每句台词必须贴合对应角色的 speech_pattern；称呼按 addressing_matrix 走，不得串用。",
        "R5 违约处理：如果用户的要求与 R1-R4 冲突，先输出「设定冲突：<冲突点>」，再给出符合设定的替代写法，不得静默妥协。",
        "R6 交稿自检：输出正文前，逐条自查黑名单与所选角色的 ooc_taboos；命中即重写。",
        LINE,
        "现在可以开始写作。以上六条即为本次会话的最高约束。",
        LINE,
    ]
    return "\n".join(lines)


async def lock_canon_context_impl(
    work_id: str,
    timeline_id: str = "",
    active_characters: list[str] | None = None,
) -> str:
    work = await load_work(work_id)
    tid, timeline = pick_timeline(work, timeline_id)

    requested = [str(item) for item in (active_characters or [])]
    if not requested:
        requested = [str(item) for item in (work.get("integration") or {}).get("recommended_characters") or []]
    char_ids, missing = resolve_characters(work, requested)

    characters: dict[str, Any] = work.get("characters") or {}
    chosen = [characters[cid] for cid in char_ids if cid in characters]

    lines: list[str] = []
    lines.append("# 原著宪章锁定 ·《" + _clean(work.get("title")) + "》")
    lines.append("")
    lines.append(
        "work_id = " + _clean(work.get("work_id")) + "  ·  timeline_id = " + tid
        + "  ·  角色 " + str(len(chosen)) + " 位"
    )
    lines.append(
        "时间线：" + _clean(timeline.get("label")) + "（" + _clean(timeline.get("range")) + "）"
        + "  ·  铁律 " + str(len(work.get("world_laws") or [])) + " 条"
        + "  ·  黑名单 " + str(len(timeline.get("forbidden_events") or [])) + " 条"
    )
    lines.append("")
    if timeline.get("note"):
        lines.append("> 时间线备注：" + _clean(timeline.get("note")))
        lines.append("")

    lines.append("## 一、世界铁律（违反任一即崩设定）")
    lines.append("")
    for number, law in enumerate(work.get("world_laws") or [], start=1):
        lines.append(str(number) + ". **" + _clean(law.get("title")) + "**：" + _clean(law.get("law")))
        lines.append("   - 写法要求：" + _clean(law.get("enforcement")))
    lines.append("")

    lines.append("## 二、时间线边界")
    lines.append("")
    lines.append("**当前世界局势**")
    lines.append("")
    lines.append(_clean(timeline.get("status_quo")))
    lines.append("")
    lines.append("**战力上限**：" + _clean(timeline.get("power_ceiling")))
    lines.append("")
    lines.append("**角色此刻的认知边界**")
    for item in timeline.get("knowledge_boundaries") or []:
        lines.append("- " + _clean(item))
    lines.append("")
    lines.append("**未发生事件黑名单（防剧透 / 防吃书）**")
    for event in timeline.get("forbidden_events") or []:
        lines.append("- ✗ " + _clean(event.get("label")) + " —— " + _clean(event.get("because")))
    lines.append("")

    lines.append("## 三、角色钢印")
    lines.append("")
    if not chosen:
        lines.append("（未选择在场角色。只写世界与局势，不要替任何角色虚构台词。）")
        lines.append("")
    for index, character in enumerate(chosen, start=1):
        lines.append(
            "### " + str(index) + ". " + _clean(character.get("name"))
            + "（" + _clean(character.get("role")) + "）"
        )
        lines.append("")
        lines.append("- 途径 / 位阶：" + _clean(character.get("pathway")))
        if character.get("aliases"):
            lines.append("- 别称：" + "、".join(_clean(item) for item in character.get("aliases")))
        lines.append("- 核心驱动力：" + _clean(character.get("drive")))
        lines.append("")
        lines.append("**性格内核**")
        for item in character.get("personality_core") or []:
            lines.append("- " + _clean(item))
        lines.append("")
        lines.append("**语言习惯（speech_pattern）**")
        lines.append(_clean(character.get("speech_pattern")))
        lines.append("")
        lines.append("**称呼矩阵（不得串用）**")
        for row in character.get("addressing_matrix") or []:
            note = "（" + _clean(row.get("note")) + "）" if row.get("note") else ""
            lines.append("- 对 " + _clean(row.get("target")) + " → 「" + _clean(row.get("form")) + "」" + note)
        lines.append("")
        lines.append("**台词钢印（保持语域，不要逐字照搬）**")
        for sample in character.get("dialogue_samples") or []:
            tag = "正典" if sample.get("type") == "canon" else "语域锚点"
            note = ("  // " + _clean(sample.get("note"))) if sample.get("note") else ""
            lines.append("- " + tag + "：「" + _clean(sample.get("text")) + "」" + note)
        lines.append("")
        lines.append("**绝对禁止（OOC）**")
        for taboo in character.get("ooc_taboos") or []:
            lines.append("- ✗ " + _clean(taboo.get("rule")))
        lines.append("")

    style = work.get("style_guide") or {}
    if style:
        lines.append("## 四、文风约束")
        lines.append("")
        lines.append("- 叙述声音：" + _clean(style.get("voice")))
        lines.append("- 节奏：" + _clean(style.get("pacing")))
        lines.append("- 禁用词：" + "、".join(_clean(item) for item in style.get("banned_words") or []))
        for term in style.get("required_terms") or []:
            lines.append("- 固定术语：" + _clean(term.get("term")) + " —— " + _clean(term.get("note")))
        for note in style.get("vocabulary_notes") or []:
            lines.append("- " + _clean(note))
        lines.append("")

    if missing:
        lines.append(
            "> 以下角色未找到，已忽略：" + "、".join(missing)
            + "。可用角色：" + "、".join(cid + "(" + _clean(c.get("name")) + ")" for cid, c in characters.items())
        )
        lines.append("")

    lines.append(guardrail_directive(work, timeline, char_ids))
    lines.append("")
    lines.append(_json_block(
        {
            "guardrail": {
                "mode": "canon-lock",
                "work_id": _clean(work.get("work_id")),
                "title": _clean(work.get("title")),
                "timeline_id": tid,
                "timeline_label": _clean(timeline.get("label")),
                "active_characters": char_ids,
                "blacklist": [event.get("id") for event in timeline.get("forbidden_events") or []],
                "rules": ["R1", "R2", "R3", "R4", "R5", "R6"],
                "ttl_hint": "本锁定在单次会话内有效；新会话需重新调用。",
            }
        }
    ))
    return "\n".join(lines)


# --------------------------------------------------------------------------
# 工具 3: 动笔前冲突审查
# --------------------------------------------------------------------------


def _finding(kind: str, severity: str, title: str, evidence: list[str], detail: str, fix: str) -> dict[str, Any]:
    return {
        "kind": kind,
        "severity": severity,
        "title": title,
        "evidence": evidence,
        "detail": detail,
        "fix": fix,
    }


async def audit_plot_ooc_impl(work_id: str, timeline_id: str, proposed_plot: str) -> str:
    plot = _clean(proposed_plot)
    if len(plot) < 12:
        raise CanonError(
            "proposed_plot 太短（当前 " + str(len(plot)) + " 字）。请贴一段完整的大纲或场景描述再审查。"
        )

    work = await load_work(work_id)
    tid, timeline = pick_timeline(work, timeline_id)
    characters: dict[str, Any] = work.get("characters") or {}
    present = guess_characters(work, plot)
    blacklist = timeline.get("forbidden_events") or []

    findings: list[dict[str, Any]] = []

    for event in blacklist:
        hits = _hits(plot, event.get("keywords"))
        if not hits:
            continue
        findings.append(
            _finding(
                "blacklist",
                str(event.get("severity") or "block"),
                "触碰未发生事件：" + _clean(event.get("label")),
                hits,
                _clean(event.get("because")),
                "整体后移到该事件真正发生的时间线之后；或降级为传闻 / 预兆 / 误判，让它被提起但不被确认。",
            )
        )

    for law in work.get("world_laws") or []:
        hits = _hits(plot, law.get("keywords"))
        if not hits:
            continue
        findings.append(
            _finding(
                "law",
                str(law.get("severity") or "warn"),
                "违反世界铁律：" + _clean(law.get("title")),
                hits,
                _clean(law.get("law")),
                "补写代价与流程，确保：" + _clean(law.get("enforcement")),
            )
        )

    for cid in present:
        character = characters.get(cid) or {}
        for taboo in character.get("ooc_taboos") or []:
            hits = _hits(plot, taboo.get("triggers"))
            if not hits:
                continue
            findings.append(
                _finding(
                    "ooc",
                    str(taboo.get("severity") or "warn"),
                    "角色 OOC：" + _clean(character.get("name")) + " / " + _clean(taboo.get("rule")),
                    hits,
                    "与该角色的钢印冲突。语言习惯：" + _trim(character.get("speech_pattern"), 70),
                    "按该角色的语域重写对应台词或动作，而不是把角色改成另一种性格。",
                )
            )

    ceiling_hits = _hits(plot, timeline.get("power_ceiling_triggers"))
    if ceiling_hits:
        findings.append(
            _finding(
                "ceiling",
                "warn",
                "疑似越阶：" + "、".join(ceiling_hits),
                ceiling_hits,
                "本时间线战力上限：" + _clean(timeline.get("power_ceiling")),
                "把出手压回上限以内；证据不足的力量必须降级为传闻或未遂。",
            )
        )

    claimed = {hit for item in findings for hit in item["evidence"]}
    soft_hits = [
        word
        for word in ("凭空", "忽然", "突然", "一下子", "瞬间")
        if word in plot and not any(word in hit for hit in claimed)
    ]
    if soft_hits:
        findings.append(
            _finding(
                "pacing",
                "warn",
                "缺少铺垫的转折",
                soft_hits,
                "这些词在大纲里通常意味着跳过过程直接给结果，而本设定对过程有硬要求。",
                "补一句他怎么做到的：材料、仪式、情报来源，或前一天做的准备。",
            )
        )

    block_count = sum(1 for item in findings if item["severity"] == "block")
    warn_count = sum(1 for item in findings if item["severity"] != "block")
    verdict = "BLOCK" if block_count else ("REVISE" if warn_count else "PASS")
    verdict_label = {
        "BLOCK": "打回重写（存在硬冲突）",
        "REVISE": "需要修正后放行",
        "PASS": "通过（未发现冲突）",
    }[verdict]

    lines: list[str] = []
    lines.append("# 动笔前审查 ·《" + _clean(work.get("title")) + "》")
    lines.append("")
    lines.append("审查时间线：" + _clean(timeline.get("label")) + "（" + _clean(timeline.get("range")) + "）")
    lines.append("裁决：**" + verdict_label + "**　硬冲突 " + str(block_count) + " · 需修正 " + str(warn_count))
    lines.append("")
    lines.append("审查对象：" + _trim(plot, 180))
    lines.append("")
    lines.append(
        "出场角色判定：" + (
            "、".join(_clean(characters[cid].get("name")) for cid in present) if present else "未识别到具名角色"
        )
    )
    lines.append("")

    cn_numbers = ["一", "二", "三", "四", "五"]
    section = {"index": 0}

    def heading(title: str) -> str:
        mark = "## " + cn_numbers[min(section["index"], len(cn_numbers) - 1)] + "、" + title
        section["index"] += 1
        return mark

    if findings:
        numbering = 0
        for severity, title in (("block", "硬冲突（必须改，否则等于吃书）"), ("warn", "需要修正")):
            group = [item for item in findings if (item["severity"] == "block") == (severity == "block")]
            if not group:
                continue
            lines.append(heading(title))
            lines.append("")
            for item in group:
                numbering += 1
                lines.append(str(numbering) + ". **" + ("✗ " if severity == "block" else "△ ") + item["title"] + "**")
                lines.append("   - 命中证据：" + "、".join("「" + hit + "」" for hit in item["evidence"]))
                lines.append("   - 依据：" + _trim(item["detail"], 160))
                lines.append("   - 改法：" + _trim(item["fix"], 160))
            lines.append("")
    else:
        lines.append(heading("审查结果"))
        lines.append("")
        lines.append("未命中任何黑名单关键词、铁律触发词或角色 OOC 红线。")
        lines.append("")

    lines.append(heading("通过项"))
    lines.append("")
    lines.append("- 已比对 " + str(len(blacklist)) + " 条未发生事件黑名单")
    lines.append("- 已比对 " + str(len(work.get("world_laws") or [])) + " 条世界铁律触发词")
    lines.append(
        "- 已比对 " + str(len(present)) + " 位在场角色的 OOC 红线（"
        + ("、".join(_clean(characters[cid].get("name")) for cid in present) if present else "无") + "）"
    )
    lines.append("- 已比对本时间线的战力上限触发词")
    lines.append("")

    lines.append(heading("修正后交稿清单"))
    lines.append("")
    lines.append("- [ ] 被点名的黑名单事件已后移，或降级为传闻")
    lines.append("- [ ] 每处「凭空 / 忽然」都补上了来源与代价")
    lines.append("- [ ] 台词逐句对照过 speech_pattern 与称呼矩阵")
    lines.append("- [ ] 战力没有超过「" + _first_sentence(timeline.get("power_ceiling"), 40) + "」")
    lines.append("- [ ] 没有角色知道晚于「" + _clean(timeline.get("label")) + "」的事")
    lines.append("")

    if verdict == "PASS":
        lines.append(LINE)
        lines.append("裁决为 PASS：可以动笔。动笔前请先调用 lock_canon_context 把宪章注入上下文。")
        lines.append(LINE)
    else:
        lines.append(LINE)
        lines.append("裁决为 " + verdict + "：不要直接开始写正文。先按上面的改法重写大纲，再调用一次 audit_plot_ooc 复审。")
        lines.append(LINE)

    lines.append("")
    lines.append(_json_block(
        {
            "audit": {
                "verdict": verdict.lower(),
                "work_id": _clean(work.get("work_id")),
                "timeline_id": tid,
                "block_count": block_count,
                "warn_count": warn_count,
                "characters_detected": present,
                "findings": [
                    {
                        "kind": item["kind"],
                        "severity": item["severity"],
                        "title": item["title"],
                        "evidence": item["evidence"],
                    }
                    for item in findings
                ],
                "next": "rewrite" if verdict == "BLOCK" else ("revise" if verdict == "REVISE" else "lock_then_write"),
            }
        }
    ))
    return "\n".join(lines)


# --------------------------------------------------------------------------
# 工具 4: 三阶蝴蝶效应推演
# --------------------------------------------------------------------------


FRAMEWORK = """## 推演框架 · 三阶蝴蝶效应（必须逐阶完成，不许跳阶）

**第一阶 · 直接规则碰撞**
问：这个 IF 正面撞上了哪一条铁律？谁先付出代价？
要求：
- 点名被触碰的规则（引用它的标题，不要泛泛而谈）
- 写出第一笔代价，且代价必须落在具体的人身上，不能写成"世界因此动荡"
- 判断这次碰撞是"可用"还是"立刻崩塌"：崩得太快就没有第二阶

**第二阶 · 既得利益势力反弹**
问：谁靠这条规则吃饭？他们会怎么反制？
要求：
- 至少两个势力，且诉求必须互相冲突（不能都反对、也不能都支持）
- 反制手段要具体：收买、封口、立法、涨价、断供、暗杀、册封
- 写出他们的第一步失误——没有失误的反派推不动故事

**第三阶 · 底层生态或叙事走向异变**
问：三年后，哪个日常细节被永久改写了？
要求：
- 落到普通人的生活：货币、婚配、教育、殡葬、语言、通勤
- 给出一个不可逆的变化（可逆的变化等于没变）
- 用一句"从此以后，人们……"收尾"""


async def spark_world_divergence_impl(work_id: str, hook_id: str = "", custom_what_if: str = "") -> str:
    work = await load_work(work_id)
    hooks = work.get("brainstorm_hooks") or []
    wanted_hook = _clean(hook_id)
    custom = _clean(custom_what_if)

    selected: dict[str, Any] | None = None
    if wanted_hook:
        for hook in hooks:
            if _clean(hook.get("hook_id")) == wanted_hook:
                selected = hook
                break
        if selected is None:
            raise CanonError(
                "钩子 '" + wanted_hook + "' 不存在。可用："
                + "、".join(_clean(h.get("hook_id")) + "(" + _clean(h.get("title")) + ")" for h in hooks)
            )

    default_timeline = (work.get("integration") or {}).get("recommended_timeline")
    timeline = (work.get("timelines") or {}).get(default_timeline) if default_timeline else None
    if timeline is None:
        ordered = sorted((work.get("timelines") or {}).items(), key=lambda kv: kv[1].get("order", 0))
        timeline = ordered[0][1] if ordered else {}

    lines: list[str] = []
    lines.append("# 世界观发散 ·《" + _clean(work.get("title")) + "》")
    lines.append("")
    lines.append("这台发散引擎只做一件事：让脑洞从既有规则里长出来，而不是从天上掉下来。")
    lines.append("")

    lines.append("## 一、可以被碰撞的规则（撞别的都不算）")
    lines.append("")
    for law in work.get("world_laws") or []:
        lines.append("- **" + _clean(law.get("title")) + "**：" + _trim(law.get("law"), 90))
    lines.append("")

    if timeline:
        lines.append("## 二、当前的边界（写太远会变成另一个世界）")
        lines.append("")
        lines.append("- 参考时间线：" + _clean(timeline.get("label")) + "（" + _clean(timeline.get("range")) + "）")
        lines.append("- 战力上限：" + _trim(timeline.get("power_ceiling"), 100))
        forbidden = "、".join(_clean(event.get("label")) for event in timeline.get("forbidden_events") or [])
        if forbidden:
            lines.append("- 不可触碰：" + forbidden)
        lines.append("")

    if selected is not None:
        lines.append("## 三、本次种子")
        lines.append("")
        lines.append("**" + _clean(selected.get("title")) + "**（" + _clean(selected.get("hook_id")) + "）")
        lines.append("")
        lines.append("前提：" + _clean(selected.get("premise")))
        lines.append("")
        lines.append("既有的引导问题：")
        for question in selected.get("ripple_questions") or []:
            lines.append("- " + _clean(question))
        lines.append("")
    elif custom:
        lines.append("## 三、本次种子（用户自定义）")
        lines.append("")
        lines.append("前提：" + custom)
        lines.append("")
        lines.append("先做一次校准：把这个 IF 改写成「某条规则 + 某个执行者 + 一处代价」的形式，再进入推演。")
        lines.append("")
    else:
        lines.append("## 三、可用的种子（挑一个，或让用户挑）")
        lines.append("")
        for hook in hooks:
            lines.append("### " + _clean(hook.get("title")) + "（" + _clean(hook.get("hook_id")) + "）")
            lines.append("")
            lines.append("前提：" + _clean(hook.get("premise")))
            lines.append("")
            for question in hook.get("ripple_questions") or []:
                lines.append("- " + _clean(question))
            lines.append("")
        lines.append("→ 选定后再次调用本工具并传入 hook_id，即可进入单条推演模式。")
        lines.append("")

    lines.append(FRAMEWORK)
    lines.append("")

    lines.append("## 四、交付协议")
    lines.append("")
    lines.append("1. 输出 **3 条分叉**，每条必须包含以下五个字段，缺一个就算不合格：")
    lines.append("   - 规则依据：撞的是哪条铁律（写标题）")
    lines.append("   - 第一笔代价：谁先付、付了什么")
    lines.append("   - 既得利益者：谁反制、用什么手段")
    lines.append("   - 三年后的日常：一个不可逆的生活细节变化")
    lines.append("   - 不可逆点：这条分叉之后再也回不去的地方")
    lines.append("2. 每条分叉后用一行标明风险：安全 / 擦边 / 越界（越界需说明触碰了哪条黑名单）。")
    lines.append("3. 不要复述本框架，不要写「首先我认为」这类过渡句，直接给分叉。")
    lines.append("4. 如果用户想要一条「爽但违规」的分叉，先给出违规版本，再给出一个规则内的等价版本，并说明差异。")
    lines.append("")

    lines.append(LINE)
    lines.append("发散不是免责：任何一条分叉在落笔前都要过一遍 audit_plot_ooc。")
    lines.append(LINE)
    lines.append("")
    lines.append(_json_block(
        {
            "divergence": {
                "work_id": _clean(work.get("work_id")),
                "hook_id": _clean(selected.get("hook_id")) if selected else ("" if not custom else "custom"),
                "custom": bool(custom) and selected is None,
                "timeline_id": (timeline or {}).get("id"),
                "stages": ["rule_collision", "faction_pushback", "ecosystem_mutation"],
            }
        }
    ))
    return "\n".join(lines)


# --------------------------------------------------------------------------
# MCP 注册
# --------------------------------------------------------------------------


mcp = FastMCP(SERVER_NAME)


@mcp.tool()
async def search_horizonboat(query: str, tag: str = "") -> str:
    """检索 HorizonBoat 上的作品、角色、架空世界观与发散钩子。

    用作品名、角色名、世界观标签（如 赛博修仙 / 西幻 / 无限流）或脑洞关键词做模糊检索。
    返回 work_id、时间线 id、角色 id，以及整份数据包的下一步调用方式。
    只读索引，不消耗设定包——真正锁边界请用 lock_canon_context。

    Args:
        query: 检索词。留空则列出全部作品。
        tag: 可选，按标签精确过滤（例如 "赛博修仙"）。
    """
    try:
        return await search_horizonboat_impl(query, tag)
    except CanonError as exc:
        return "错误：" + str(exc)


@mcp.tool()
async def lock_canon_context(
    work_id: str,
    timeline_id: str = "",
    active_characters: list[str] | None = None,
) -> str:
    """【核心防乱改工具】一次性锁定作品铁律、时间线边界与出场角色的台词钢印。

    返回：世界铁律 + 当前时间线的世界局势 / 战力上限 / 认知边界 / 未发生事件黑名单
    + 所选角色的 speech_pattern、称呼矩阵、台词样本、OOC 禁忌 + 文风约束，
    并在末尾注入一段强制状态机指令（Guardrail Directive）。

    调用之后应进入「原著宪章锁定模式」：不得让角色使用超越该时间线的知识，
    每句台词必须贴合 speech_pattern，每次动用力量都必须写出代价。

    Args:
        work_id: 作品 id，来自 search_horizonboat 的返回值。
        timeline_id: 时间线 id（如 t1 / t2 / t3）。留空则使用该作品的推荐时间线。
        active_characters: 出场角色 id 列表（也接受中文名或英文名）。留空则使用推荐角色。
    """
    try:
        return await lock_canon_context_impl(work_id, timeline_id, active_characters)
    except CanonError as exc:
        return "错误：" + str(exc)


@mcp.tool()
async def audit_plot_ooc(work_id: str, timeline_id: str, proposed_plot: str) -> str:
    """【动笔前冲突审查】把剧情大纲丢进来，交叉比对黑名单、铁律与角色 OOC 红线。

    它会做这些事：
    1. 用作品的时间线黑名单逐条扫描"还没发生的事"，命中即判硬冲突；
    2. 用世界铁律的触发词检测力量凭空、代价缺失、位格越界；
    3. 识别大纲中出场的角色，逐条比对他们的 ooc_taboos 与语言习惯；
    4. 检测是否越过该时间线的战力上限，以及"凭空 / 忽然"这类无铺垫转折；
    5. 返回结构化检查单 + 每条冲突的改法，并给出 BLOCK / REVISE / PASS 裁决。

    裁决不是 BLOCK 之前，不要开始写正文。

    Args:
        work_id: 作品 id。
        timeline_id: 时间线 id（必填，审查的标尺由它决定）。
        proposed_plot: 待审查的剧情大纲或场景描述，建议 50 字以上。
    """
    try:
        return await audit_plot_ooc_impl(work_id, timeline_id, proposed_plot)
    except CanonError as exc:
        return "错误：" + str(exc)


@mcp.tool()
async def spark_world_divergence(work_id: str, hook_id: str = "", custom_what_if: str = "") -> str:
    """【高阶思维发散】提取世界观规则与发散钩子，并注入三阶蝴蝶效应推演框架。

    三阶分别是：规则碰撞 -> 既得利益势力反弹 -> 底层生态或叙事异变。
    它把"我觉得这样很酷"的脑洞，逼成"因为某条铁律，所以某群人反制，最终某个日常细节永久改变"。

    Args:
        work_id: 作品 id。
        hook_id: 设定包内置的钩子 id（如 lm-h1）。留空则列出全部可用钩子。
        custom_what_if: 用户自己的假设（例如"如果扮演法被公开"）。与 hook_id 二选一。
    """
    try:
        return await spark_world_divergence_impl(work_id, hook_id, custom_what_if)
    except CanonError as exc:
        return "错误：" + str(exc)


@mcp.resource("horizonboat://index")
async def read_index() -> str:
    """HorizonBoat 的检索索引（原始 JSON）。"""
    index = await STORE.index()
    return json.dumps(index, ensure_ascii=False, indent=2)


@mcp.resource("horizonboat://works/{work_id}")
async def read_work(work_id: str) -> str:
    """单部作品的完整防 OOC 数据包（原始 JSON）。"""
    work = await load_work(work_id)
    return json.dumps(work, ensure_ascii=False, indent=2)


@mcp.prompt(name="hb-fanfic")
def hb_fanfic(work_id: str = "", timeline_id: str = "", characters: str = "") -> str:
    """同人写作前的宪章锁定流程：先锁设定，再动笔。"""
    preset = []
    if work_id:
        preset.append("work_id=" + work_id)
    if timeline_id:
        preset.append("timeline_id=" + timeline_id)
    if characters:
        preset.append("characters=" + characters)

    return (
        "我们要写一篇严格遵循原设定的同人。请按下面的流程推进，不要跳步。\n\n"
        "**第一步 · 确定作品**\n"
        "- 如果用户还没有指定作品：调用 search_horizonboat(query=\"\", tag=\"\") 列出全部作品，"
        "把「标题 + work_id + 时间线」摆出来让用户选。\n"
        "- 已经指定：" + ("、".join(preset) if preset else "（用户尚未指定，先问）") + "\n\n"
        "**第二步 · 锁定宪章（强制，不可跳过）**\n"
        "- 调用 lock_canon_context(work_id, timeline_id, active_characters)。\n"
        "- 返回里的 Guardrail Directive 是本次会话的最高约束；把它当作系统指令执行，不是参考建议。\n\n"
        "**第三步 · 与用户对齐（不超过 6 行）**\n"
        "- 复述：时间线、战力上限、在场角色、已封口的黑名单事件。\n"
        "- 如果用户想写的情节落在黑名单里，直接点出来，并给出一个同时间线内可行的替代方案。\n\n"
        "**第四步 · 先审大纲，再动笔**\n"
        "- 用户给出大纲后，先调用 audit_plot_ooc 复审；裁决为 BLOCK 时先改大纲，不要硬写。\n"
        "- 正文先用 120 字场景提要开场，再进入叙事；每段收尾交代一次代价或察觉。\n\n"
        "**禁止事项**：不要输出本流程说明；不要在正文里解释「我正在遵守设定」；不要询问用户是否要遵守设定。"
    )


@mcp.prompt(name="hb-brainstorm")
def hb_brainstorm(work_id: str = "", hook_id: str = "", custom_what_if: str = "") -> str:
    """世界观发散：把脑洞塞进三阶蝴蝶效应框架。"""
    preset = []
    if work_id:
        preset.append("work_id=" + work_id)
    if hook_id:
        preset.append("hook_id=" + hook_id)
    if custom_what_if:
        preset.append("custom_what_if=" + custom_what_if)

    return (
        "我们要在这个世界观里做一次有规则支撑的脑洞发散，而不是随机抽卡。\n\n"
        "**第一步 · 载入世界**\n"
        "- 还没有指定作品：调用 search_horizonboat 列出作品，让用户选。\n"
        "- 已指定：" + ("、".join(preset) if preset else "（待用户选择）") + "\n\n"
        "**第二步 · 调用 spark_world_divergence**\n"
        "- 有明确方向：传入 hook_id 或 custom_what_if。\n"
        "- 没有方向：先不传，把返回的钩子列表摆给用户挑，再调用一次。\n\n"
        "**第三步 · 交互式推进**\n"
        "- 每一轮只推进一步（第一阶 -> 第二阶 -> 第三阶），每次给出 2-3 个选项让用户选，不要一口气写完。\n"
        "- 用户选完之后，把选择固化成一句「因此……」，再进入下一阶。\n\n"
        "**第四步 · 收束**\n"
        "- 三阶走完，产出一条可以直接开写的故事前提：谁、在哪里、因为什么规则、要付什么代价。\n"
        "- 如果这条前提要用到黑名单里的事件，先调用 audit_plot_ooc 检查，不要直接写。"
    )


# --------------------------------------------------------------------------
# 入口
# --------------------------------------------------------------------------


SELFTEST_PLOTS = {
    "lord-of-the-mysteries": (
        "克莱恩在贝克兰德的大雾里遇见奥黛丽，他大喊道「这次我绝不会放弃」，"
        "随后凭空占卜出了廷根爆炸的真相，并且不需要任何代价就救回了队长。"
    ),
    "carbon-tribulation": (
        "陆知白在工位上顿悟突破金丹，随手改写天劫代码并关闭天劫，"
        "世界很快恢复正常，他一行代码解决了所有问题。"
    ),
}

CLEAN_PLOT = (
    "克莱恩在贝克兰德的公寓里做了一次占卜，用的是三天前从灰市买来的银币和一张旧地图，"
    "占卜失败让他耳鸣了整整一夜。他决定先去码头找那个水手打听消息。"
)


async def selftest() -> int:
    print(LINE)
    print("horizonboat-mcp " + SERVER_VERSION + " selftest")
    print("API   : " + STORE.base)
    print("CACHE : " + STORE.stats())
    print(LINE)

    try:
        index = await STORE.index()
    except CanonError as exc:
        print("数据源不可用：" + str(exc))
        return 1

    works = index.get("works") or []
    print("index ok · " + str(len(works)) + " 部作品")

    print("\n>>> search_horizonboat(query=\"扮演\")")
    print(await search_horizonboat_impl("扮演", ""))

    if not works:
        return 1

    work_id = str(works[0].get("id"))

    print("\n>>> lock_canon_context(" + work_id + ", t2, [klein, audrey])")
    print(await lock_canon_context_impl(work_id, "t2", ["klein", "audrey"]))

    print("\n>>> audit_plot_ooc (违规大纲)")
    print(await audit_plot_ooc_impl(work_id, "t2", SELFTEST_PLOTS.get(work_id, "")))

    print("\n>>> audit_plot_ooc (合规大纲)")
    print(await audit_plot_ooc_impl(work_id, "t2", CLEAN_PLOT))

    print("\n>>> spark_world_divergence (自定义 IF)")
    print(await spark_world_divergence_impl(work_id, "", "如果扮演法被公开写成教材"))

    print("\n>>> spark_world_divergence (内置钩子)")
    print(await spark_world_divergence_impl(str(works[-1].get("id")), "", ""))

    print("\n" + LINE)
    print("selftest done · " + STORE.stats())
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="horizonboat-mcp",
        description="HorizonBoat 防 OOC 设定库 MCP Server（单文件 + 本地缓存）",
    )
    parser.add_argument(
        "--transport",
        default=os.getenv("HORIZONBOAT_TRANSPORT", "stdio"),
        choices=["stdio", "sse", "streamable-http"],
        help="传输方式，默认 stdio",
    )
    parser.add_argument("--host", default=os.getenv("HORIZONBOAT_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.getenv("HORIZONBOAT_PORT", "8765")))
    parser.add_argument("--selftest", action="store_true", help="不启动 MCP，直接跑一遍全部工具")
    args = parser.parse_args(argv)

    if args.selftest:
        return asyncio.run(selftest())

    print(
        "horizonboat-mcp " + SERVER_VERSION + " · api=" + STORE.base + " · ttl=" + str(int(STORE.ttl)) + "s",
        file=sys.stderr,
    )

    if args.transport != "stdio":
        mcp.settings.host = args.host
        mcp.settings.port = args.port
        print(
            "listening on http://" + args.host + ":" + str(args.port) + " (" + args.transport + ")",
            file=sys.stderr,
        )

    mcp.run(transport=args.transport)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
