import type { IndexWork } from "../types";
import { IconArrowUpRight } from "./icons";
import { Badge } from "./ui";

const difficultyLabel: Record<string, string> = {
  low: "轻度",
  medium: "中等",
  high: "重度",
};

export default function WorkCard({ work }: { work: IndexWork }) {
  return (
    <a
      href={"#/work/" + work.id}
      className="group relative flex flex-col rounded-xl border border-line bg-surface p-5 transition-colors duration-150 hover:border-line-strong hover:bg-surface-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={work.type === "original" ? "ok" : "accent"}>{work.type_label}</Badge>
          <span className="text-[11.5px] text-faint">{work.category}</span>
        </div>
        <IconArrowUpRight className="mt-0.5 size-4 shrink-0 text-faint transition-colors group-hover:text-fg" />
      </div>

      <h3 className="mt-3.5 flex flex-wrap items-baseline gap-x-2 text-[16.5px] font-semibold tracking-[-0.01em] text-fg">
        {work.title}
        <span className="font-mono text-[11px] font-normal text-faint">{work.title_en}</span>
      </h3>

      <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-muted">{work.summary}</p>

      <div className="mt-3.5 flex flex-wrap gap-1.5">
        {work.tags.slice(0, 4).map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-line px-2 py-0.5 text-[11px] text-faint"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3.5 text-[11.5px] text-faint">
        <span className="tabular-nums">{work.stats.characters} 张角色钢印</span>
        <span aria-hidden="true">·</span>
        <span className="tabular-nums">{work.stats.timelines} 条时间线</span>
        <span aria-hidden="true">·</span>
        <span className="tabular-nums">{work.stats.hooks} 个钩子</span>
        <span className="ml-auto font-mono">{difficultyLabel[work.difficulty] ?? work.difficulty}</span>
      </div>
    </a>
  );
}
