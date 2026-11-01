import { useEffect, useState } from "react";
import { loadWork } from "../data";
import { go, type Route } from "../hooks/useHashRoute";
import { countChars, cx, pad2, sortedTimelines } from "../lib/format";
import { auditCall, buildSystemPrompt, buildToolCall, mcpConfig } from "../lib/prompt";
import type { Character, Work } from "../types";
import CharacterCard from "./CharacterCard";
import HookCard from "./HookCard";
import PromptModal from "./PromptModal";
import TimelinePanel from "./TimelinePanel";
import { IconAlert, IconArrowLeft } from "./icons";
import { Badge, Button, CodeBlock, CopyButton, SectionHeader } from "./ui";

type WorkRoute = Extract<Route, { name: "work" }>;

const DIFFICULTY: Record<string, string> = { low: "轻度", medium: "中等", high: "重度" };

function shortName(name: string): string {
  const [first] = name.split("·");
  return first || name;
}

export default function WorkDetail({ route, onBack }: { route: WorkRoute; onBack: () => void }) {
  const [work, setWork] = useState<Work | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timelineId, setTimelineId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setWork(null);
    setError(null);

    loadWork(route.id)
      .then((data) => {
        if (!alive) return;
        setWork(data);

        const ordered = sortedTimelines(Object.values(data.timelines)).map((t) => t.id);
        const preferred = data.integration?.recommended_timeline;
        const fromRoute = route.timeline && data.timelines[route.timeline] ? route.timeline : undefined;
        const next = fromRoute ?? (preferred && data.timelines[preferred] ? preferred : ordered[0]) ?? "";
        setTimelineId(next);

        const picked = (route.chars ?? []).filter((id) => Boolean(data.characters[id]));
        const recommended = (data.integration?.recommended_characters ?? []).filter((id) =>
          Boolean(data.characters[id]),
        );
        setSelected(picked.length ? picked : recommended.length ? recommended : Object.keys(data.characters).slice(0, 2));
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      alive = false;
    };
  }, [route.id, route.timeline, route.chars]);

  useEffect(() => {
    if (!work || !route.hook) return;
    const target = document.getElementById("hook-" + route.hook);
    if (!target) return;
    const timer = window.setTimeout(() => {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 160);
    return () => window.clearTimeout(timer);
  }, [work, route.hook]);

  const timelines = work ? sortedTimelines(Object.values(work.timelines)) : [];
  const timeline = work ? work.timelines[timelineId] ?? timelines[0] : undefined;
  const characters: Character[] = work
    ? selected
        .map((id) => work.characters[id])
        .filter((item): item is Character => Boolean(item))
    : [];

  const prompt = work && timeline ? buildSystemPrompt(work, timeline, characters) : "";
  const toolCall = work && timeline ? buildToolCall(work, timeline, characters) : "";

  const changeTimeline = (id: string) => {
    if (!work) return;
    setTimelineId(id);
    go({ name: "work", id: work.work_id, timeline: id, chars: selected, hook: route.hook }, true);
  };

  const toggleCharacter = (id: string) => {
    if (!work) return;
    const next = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
    setSelected(next);
    go({ name: "work", id: work.work_id, timeline: timelineId, chars: next, hook: route.hook }, true);
  };

  if (error) {
    return (
      <div className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-lg rounded-xl border border-line bg-surface p-6">
          <div className="flex items-start gap-3">
            <IconAlert className="mt-0.5 size-4 shrink-0 text-danger" />
            <div>
              <p className="text-[13.5px] font-medium text-fg">设定包没能加载</p>
              <p className="mt-1.5 text-[12.5px] leading-6 text-muted">{error}</p>
            </div>
          </div>
          <div className="mt-5 flex gap-2">
            <Button variant="secondary" size="sm" onClick={onBack}>
              返回作品库
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!work || !timeline) {
    return (
      <div className="px-4 py-10 sm:px-6">
        <div className="h-4 w-24 animate-pulse rounded bg-surface-2" />
        <div className="mt-6 h-9 w-64 animate-pulse rounded bg-surface-2" />
        <div className="mt-4 h-4 w-full max-w-xl animate-pulse rounded bg-surface-2" />
        <div className="mt-10 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="h-72 animate-pulse rounded-xl border border-line bg-surface" />
          <div className="h-72 animate-pulse rounded-xl border border-line bg-surface" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-7 sm:px-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[12px] text-muted transition-colors hover:text-fg"
      >
        <IconArrowLeft className="size-3.5" />
        全部作品
      </button>

      <header className="mt-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={work.type === "original" ? "ok" : "accent"}>{work.type_label}</Badge>
          <span className="text-[11.5px] text-faint">{work.category}</span>
          {work.spoiler_warning ? (
            <>
              <span className="text-[11.5px] text-faint" aria-hidden="true">
                ·
              </span>
              <span className="text-[11.5px] text-faint">含剧透边界</span>
            </>
          ) : null}
        </div>

        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-baseline gap-x-3 text-[clamp(26px,4vw,34px)] font-semibold leading-[1.2] tracking-[-0.025em] text-fg">
              <span className="shrink-0">{work.title}</span>
              <span className="font-mono text-[12px] font-normal tracking-normal text-faint">
                {work.title_en}
              </span>
            </h1>
            <p className="mt-2.5 max-w-[68ch] text-pretty text-[14px] leading-7 text-muted">
              {work.tagline}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 self-start rounded-lg border border-line bg-surface px-2.5 py-1.5 lg:self-end">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">work_id</span>
            <code className="font-mono text-[11.5px] text-fg">{work.work_id}</code>
            <CopyButton
              text={work.work_id}
              variant="ghost"
              size="sm"
              label="复制 work_id"
              toastText="work_id 已复制"
            />
          </div>
        </div>
      </header>

      <div className="mt-6 border-y border-line py-4">
        <p className="max-w-[86ch] text-[13.5px] leading-7 text-muted">{work.summary}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11.5px] text-faint">
          <span>
            作者 <span className="text-muted">{work.author}</span>
          </span>
          <span>
            难度 <span className="text-muted">{DIFFICULTY[work.difficulty] ?? work.difficulty}</span>
          </span>
          <span>
            更新 <span className="font-mono text-muted">{work.updated_at}</span>
          </span>
          <span className="tabular-nums">{work.world_laws.length} 条铁律</span>
          <span className="tabular-nums">{Object.keys(work.characters).length} 张钢印</span>
          <span className="tabular-nums">{work.brainstorm_hooks.length} 个钩子</span>
        </div>
      </div>

      {/* ------------------------------------------------------- timeline bar */}
      <div className="mt-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint">
            TIMELINE · 时间线切换
          </span>
          <span className="text-[11px] text-faint">
            切换时期会同步刷新认知边界、战力上限与防剧透黑名单
          </span>
        </div>

        <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="时间线">
          {timelines.map((item) => {
            const active = item.id === timeline.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => changeTimeline(item.id)}
                className={cx(
                  "min-w-[168px] shrink-0 rounded-lg border px-3.5 py-2.5 text-left transition-colors duration-150",
                  active
                    ? "border-line-strong bg-surface-2"
                    : "border-line bg-transparent hover:border-line-strong hover:bg-surface",
                )}
              >
                <span
                  className={cx(
                    "flex items-center gap-2 text-[13px] font-medium",
                    active ? "text-fg" : "text-muted",
                  )}
                >
                  <span
                    className={cx(
                      "size-1.5 rounded-full",
                      active ? "bg-accent" : "border border-line-strong",
                    )}
                    aria-hidden="true"
                  />
                  {item.label}
                </span>
                <span className="mt-1 block font-mono text-[10px] tracking-[0.02em] text-faint">
                  {item.range}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8 grid gap-8 pb-16 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        {/* ------------------------------------------------------------- main */}
        <div className="order-2 min-w-0 space-y-12 lg:order-1">
          <section>
            <SectionHeader
              index="01"
              id="sec-timeline"
              label="CANON WINDOW"
              title={timeline.label + " · 锁定状态"}
              desc="这一节是整份设定的时间闸门：角色能知道什么、能打到什么程度、哪些事还没发生。"
            />
            <TimelinePanel timeline={timeline} />
          </section>

          <section>
            <SectionHeader
              index="02"
              id="sec-laws"
              label="WORLD LAWS"
              title="世界观底层法则"
              desc="违背其中任何一条，故事就不再属于这个世界。它们优先于任何情节需要。"
            />
            <div className="mt-5 space-y-3">
              {work.world_laws.map((law, index) => (
                <article key={law.id} className="rounded-xl border border-line bg-surface p-4 sm:p-5">
                  <div className="flex items-start gap-4">
                    <span className="mt-0.5 font-mono text-[11px] tabular-nums text-accent">
                      {pad2(index + 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[14px] font-semibold text-fg">{law.title}</h3>
                        <Badge tone={law.severity === "block" ? "danger" : "neutral"}>
                          {law.severity === "block" ? "硬约束" : "软约束"}
                        </Badge>
                      </div>
                      <p className="mt-2 text-[13.5px] leading-7 text-fg">{law.law}</p>
                      <p className="mt-2.5 border-l-2 border-line-strong pl-3 text-[12.5px] leading-6 text-muted">
                        <span className="mr-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
                          执行
                        </span>
                        {law.enforcement}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section>
            <SectionHeader
              index="03"
              id="sec-characters"
              label="CHARACTER SEALS"
              title="角色钢印卡"
              desc="核心驱动、称呼矩阵、台词锚点与绝对禁止项。点「纳入提示词」决定哪些角色进入最终交付的 System Prompt。"
            />
            <div className="mt-5 space-y-4">
              {Object.values(work.characters).map((character) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  selected={selected.includes(character.id)}
                  onToggle={() => toggleCharacter(character.id)}
                />
              ))}
            </div>
          </section>

          <section>
            <SectionHeader
              index="04"
              id="sec-hooks"
              label="DIVERGENCE"
              title="思维发散舱"
              desc="留白接口、IF 线假设与蝴蝶效应。每个钩子都从一条既有规则出发，而不是凭空开脑洞。"
            />
            <div className="mt-5 space-y-3">
              {work.brainstorm_hooks.map((hook) => (
                <HookCard key={hook.hook_id} hook={hook} />
              ))}
            </div>
          </section>

          <section>
            <SectionHeader
              index="05"
              id="sec-integration"
              label="INTEGRATION"
              title="接入这个设定包"
              desc="复制下面的调用，或把整个包挂进支持 MCP 的客户端。Agent 会在动笔前自己把边界拉一遍。"
            />
            <div className="mt-5 space-y-3">
              <CodeBlock label="调用 · 锁定设定（推荐先跑这个）" code={toolCall} />
              <CodeBlock
                label="调用 · 动笔前审查大纲"
                code={auditCall(work, timeline, work.integration?.sample_audit_plot ?? "")}
              />
              <CodeBlock label="mcp.json · 客户端配置" code={mcpConfig()} />
            </div>
            <p className="mt-4 text-[11.5px] leading-6 text-faint">{work.rights_note}</p>
          </section>
        </div>

        {/* ------------------------------------------------------------ aside */}
        <aside className="order-1 lg:order-2 lg:sticky lg:top-20">
          <div className="rounded-xl border border-line-strong bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint">
                DELIVER
              </span>
              <span className="flex items-center gap-1.5 text-[10.5px] text-faint">
                <span className="size-1.5 rounded-full bg-ok" aria-hidden="true" />
                实时合成
              </span>
            </div>

            <dl className="mt-3 space-y-1.5 text-[11.5px]">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-faint">时间线</dt>
                <dd className="text-right text-fg">{timeline.label}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-faint">出场角色</dt>
                <dd className="tabular-nums text-fg">
                  {characters.length} / {Object.keys(work.characters).length}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-faint">提示词长度</dt>
                <dd className="tabular-nums text-fg">{countChars(prompt)} 字</dd>
              </div>
            </dl>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {Object.values(work.characters).map((character) => {
                const on = selected.includes(character.id);
                return (
                  <button
                    key={character.id}
                    type="button"
                    onClick={() => toggleCharacter(character.id)}
                    aria-pressed={on}
                    title={character.name}
                    className={cx(
                      "h-7 rounded-full border px-2.5 text-[11.5px] transition-colors",
                      on
                        ? "border-accent/45 bg-accent-soft text-accent"
                        : "border-line text-muted hover:border-line-strong hover:text-fg",
                    )}
                  >
                    {shortName(character.name)}
                  </button>
                );
              })}
            </div>

            <CopyButton
              variant="primary"
              className="mt-4 w-full"
              text={prompt}
              toastText="纯净 System Prompt 已复制"
            >
              复制 System Prompt
            </CopyButton>
            <Button variant="secondary" className="mt-2 w-full" onClick={() => setPreviewOpen(true)}>
              预览完整提示词
            </Button>

            <div className="mt-4 border-t border-line pt-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint">MCP</span>
                <span className="font-mono text-[10px] text-faint">horizenboat-mcp</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-5 text-faint">
                不必手抄提示词：把这条调用丢给 Agent，它会自己拉取边界。
              </p>
              <CopyButton
                className="mt-2 w-full"
                size="sm"
                text={toolCall}
                toastText="lock_canon_context 调用已复制"
              >
                复制调用指令
              </CopyButton>
            </div>
          </div>

          <p className="mt-3 px-1 text-[10.5px] leading-5 text-faint">
            System Prompt 只包含世界铁律、时间线边界与所选角色钢印；不含网址、导航或任何界面文案。
          </p>
        </aside>
      </div>

      <PromptModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        prompt={prompt}
        caption={"work_id=" + work.work_id + " · timeline=" + timeline.id + " · chars=" + (selected.join(",") || "none")}
      />
    </div>
  );
}
