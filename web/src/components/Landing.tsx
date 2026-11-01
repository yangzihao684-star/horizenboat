import { useEffect, useMemo, useRef, useState } from "react";
import { apiBase } from "../data";
import { filterWorks } from "../lib/search";
import { mcpConfig } from "../lib/prompt";
import type { WorkIndex } from "../types";
import WorkCard from "./WorkCard";
import { IconAlert, IconClose, IconSearch, IconTag } from "./icons";
import { Button, Chip, CodeBlock, CopyButton, Kbd, SectionHeader } from "./ui";

const SUGGESTIONS = ["诡秘之主", "赛博修仙", "扮演法", "天劫", "原创架空"];

const TYPES: { id: "all" | "fanfic" | "original"; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "fanfic", label: "二创防吃书" },
  { id: "original", label: "原创架空" },
];

export default function Landing({
  index,
  error,
  tag,
  onOpenPalette,
}: {
  index: WorkIndex | null;
  error: string | null;
  tag?: string;
  onOpenPalette: () => void;
}) {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(tag ?? null);
  const [type, setType] = useState<"all" | "fanfic" | "original">("all");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setActiveTag(tag ?? null);
  }, [tag]);

  const stats = useMemo(() => {
    const works = index?.works ?? [];
    return {
      works: works.length,
      characters: works.reduce((n, w) => n + w.stats.characters, 0),
      timelines: works.reduce((n, w) => n + w.stats.timelines, 0),
      hooks: works.reduce((n, w) => n + w.stats.hooks, 0),
      laws: works.reduce((n, w) => n + w.stats.laws, 0),
    };
  }, [index]);

  const results = useMemo(
    () => (index ? filterWorks(index.works, { query, tag: activeTag, type }) : []),
    [index, query, activeTag, type],
  );

  const resetFilters = () => {
    setQuery("");
    setActiveTag(null);
    setType("all");
    inputRef.current?.focus();
  };

  const filtering = Boolean(query.trim() || activeTag || type !== "all");

  return (
    <div className="px-4 sm:px-6">
      {/* ------------------------------------------------------------- hero */}
      <section className="pt-14 pb-10 sm:pt-24 sm:pb-14">
        <div className="mx-auto max-w-[760px] text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1">
            <span className="size-1.5 rounded-full bg-accent" />
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted">
              HorizenBoat · 防 OOC 设定库
            </span>
          </div>

          <h1 className="mt-6 text-balance text-[clamp(30px,5.4vw,46px)] font-semibold leading-[1.16] tracking-[-0.025em] text-fg">
            把设定锁死，
            <br />
            把脑洞放开。
          </h1>

          <p className="mx-auto mt-5 max-w-[560px] text-pretty text-[14px] leading-7 text-muted">
            检索作品的防 OOC 系统提示词、角色钢印卡与世界观发散钩子。静态 JSON 直接充当 API：人复制即用，Agent 直连即锁。
          </p>

          <div className="relative mx-auto mt-8 max-w-[620px] text-left">
            <div className="flex h-14 items-center gap-3 rounded-xl border border-line bg-surface px-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] transition-colors focus-within:border-line-strong">
              <IconSearch className="size-4 shrink-0 text-faint" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setQuery("");
                }}
                placeholder="搜索作品、角色、世界观标签或脑洞关键词…"
                aria-label="搜索作品、角色、标签或关键词"
                className="min-w-0 flex-1 bg-transparent text-[14.5px] text-fg outline-none placeholder:text-faint"
                spellCheck={false}
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  aria-label="清空搜索"
                  className="flex size-6 items-center justify-center rounded text-faint transition-colors hover:bg-surface-2 hover:text-fg"
                >
                  <IconClose className="size-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenPalette}
                  className="hidden sm:flex"
                  aria-label="打开命令面板"
                >
                  <Kbd>⌘K</Kbd>
                </button>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
              <span className="mr-0.5 text-[11.5px] text-faint">试试</span>
              {SUGGESTIONS.map((word) => (
                <button
                  key={word}
                  type="button"
                  onClick={() => setQuery(word)}
                  className="rounded-full border border-line px-2 py-0.5 font-mono text-[11px] text-muted transition-colors hover:border-line-strong hover:text-fg"
                >
                  {word}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-7 font-mono text-[10.5px] tabular-nums tracking-[0.06em] text-faint">
            {stats.works} 部作品 · {stats.characters} 张角色钢印 · {stats.timelines} 条时间线 ·{" "}
            {stats.hooks} 个发散钩子 · {stats.laws} 条世界铁律
          </p>
        </div>
      </section>

      {/* ----------------------------------------------------------- library */}
      <section id="library" className="scroll-mt-20 border-t border-line pt-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5" role="group" aria-label="类型筛选">
            {TYPES.map((item) => (
              <Chip key={item.id} active={type === item.id} onClick={() => setType(item.id)}>
                {item.label}
              </Chip>
            ))}
          </div>
          <p className="text-[11.5px] text-faint tabular-nums" aria-live="polite">
            {index ? results.length + " / " + index.works.length + " 部作品" : "加载中…"}
          </p>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 inline-flex items-center gap-1.5 text-[11px] text-faint">
            <IconTag className="size-3.5" />
            标签
          </span>
          <Chip active={!activeTag} onClick={() => setActiveTag(null)}>
            全部
          </Chip>
          {(index?.tags ?? []).map((item) => (
            <Chip
              key={item.tag}
              active={activeTag === item.tag}
              onClick={() => setActiveTag(activeTag === item.tag ? null : item.tag)}
              title={item.count + " 部作品"}
            >
              {item.tag}
            </Chip>
          ))}
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {error ? (
            <div className="card col-span-full flex items-start gap-3 p-5 sm:col-span-2">
              <IconAlert className="mt-0.5 size-4 shrink-0 text-danger" />
              <div>
                <p className="text-[13px] font-medium text-fg">检索索引没能加载</p>
                <p className="mt-1 text-[12.5px] leading-6 text-muted">{error}</p>
                <p className="mt-2 text-[12px] text-faint">
                  本地开发时请从 <code className="font-mono">web/public/api/v1</code> 提供静态文件；也可用{" "}
                  <code className="font-mono">VITE_HB_API_BASE</code> 指向远端目录。
                </p>
              </div>
            </div>
          ) : null}

          {!error && !index
            ? [0, 1].map((i) => (
                <div
                  key={i}
                  className="h-[210px] animate-pulse rounded-xl border border-line bg-surface"
                />
              ))
            : null}

          {index && results.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-line-strong px-6 py-14 text-center">
              <p className="text-[13.5px] text-fg">
                没有匹配「{query.trim() || activeTag || "当前筛选项"}」的作品
              </p>
              <p className="mt-1.5 text-[12.5px] text-faint">
                试试点最小众的标签，或者直接打开命令面板按角色名检索。
              </p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={resetFilters}>
                清除筛选
              </Button>
            </div>
          ) : null}

          {results.map((work) => (
            <WorkCard key={work.id} work={work} />
          ))}
        </div>

        {filtering ? (
          <p className="mt-4 text-[11.5px] text-faint">
            正在检索「{query || "—"}」
            {activeTag ? " · 标签 " + activeTag : ""}　
            <button type="button" onClick={resetFilters} className="underline decoration-line-strong underline-offset-4 hover:text-fg">
              重置
            </button>
          </p>
        ) : null}
      </section>

      {/* ------------------------------------------------------- integration */}
      <section id="integration" className="mt-16 scroll-mt-20 border-t border-line pt-10 pb-16">
        <SectionHeader
          index="00"
          label="AGENT INTEGRATION"
          title="把设定库接进你的 Agent"
          desc="horizenboat-mcp 是单文件 MCP Server：拉取铁律、锁定时间线、审查大纲、三阶推演。它不做创作，它负责不让创作跑偏。"
        />

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:items-start">
          <div>
            <ul className="space-y-3.5">
              {[
                {
                  name: "lock_canon_context",
                  text: "一次拉取世界铁律、指定时间线的认知边界与黑名单、出场角色的台词钢印，并在末尾注入 Guardrail Directive。",
                },
                {
                  name: "audit_plot_ooc",
                  text: "动笔前把大纲丢进去：横向比对铁律、黑名单与 OOC 禁忌，返回带证据的冲突检查单与可直接采纳的修正建议。",
                },
                {
                  name: "spark_world_divergence",
                  text: "把脑洞塞进「规则碰撞 → 势力反弹 → 生态异变」的三阶蝴蝶效应框架，逼出有设定支撑的分叉。",
                },
              ].map((tool) => (
                <li key={tool.name} className="flex gap-3">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-accent" />
                  <div>
                    <code className="font-mono text-[12.5px] text-fg">{tool.name}</code>
                    <p className="mt-0.5 text-[12.5px] leading-6 text-muted">{tool.text}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <CopyButton
                variant="primary"
                text={mcpConfig()}
                toastText="mcp.json 已复制，粘到客户端的 config 里即可"
              >
                复制 MCP 配置
              </CopyButton>
              <a
                href={apiBase() + "/index.json"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3.5 text-[13px] text-fg transition-colors hover:border-line-strong hover:bg-surface-2"
              >
                查看静态 API
              </a>
            </div>

            <div className="mt-5 rounded-lg border border-line bg-surface px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="mono-label shrink-0">API BASE</span>
                <code className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-muted">
                  {apiBase()}
                </code>
                <CopyButton text={apiBase()} variant="ghost" size="sm" label="复制 API 地址" />
              </div>
            </div>
          </div>

          <CodeBlock label="mcp.json · claude / cursor / any mcp client" code={mcpConfig()} />
        </div>
      </section>
    </div>
  );
}
