import type { Timeline } from "../types";
import { IconAlert } from "./icons";

export default function TimelinePanel({ timeline }: { timeline: Timeline }) {
  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-line bg-surface">
      {timeline.note ? (
        <div className="border-b border-line bg-accent-soft px-4 py-2.5 text-[12px] leading-6 text-accent">
          {timeline.note}
        </div>
      ) : null}

      <div className="p-4 sm:p-5">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint">世界局势</div>
        <p className="mt-2 text-[14px] leading-7 text-fg">{timeline.status_quo}</p>
      </div>

      <div className="grid gap-6 border-t border-line p-4 sm:grid-cols-2 sm:p-5">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint">战力上限</div>
          <p className="mt-2 text-[13px] leading-6 text-muted">{timeline.power_ceiling}</p>
        </div>
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint">认知边界</div>
          <ul className="mt-2 space-y-1.5">
            {timeline.knowledge_boundaries.map((item) => (
              <li key={item} className="flex gap-2.5 text-[13px] leading-6 text-muted">
                <span className="mt-[11px] size-1 shrink-0 rounded-full bg-faint" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-line p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint">
            未发生事件黑名单
          </span>
          <span className="text-[11px] text-faint">防剧透 · 防吃书 · 由上到下优先级递减</span>
        </div>
        <ul className="mt-3 space-y-2">
          {timeline.forbidden_events.map((event) => (
            <li
              key={event.id}
              className="rounded-lg border border-danger/25 bg-danger-soft px-3 py-2.5"
            >
              <div className="flex items-start gap-2.5">
                <IconAlert className="mt-0.5 size-3.5 shrink-0 text-danger" />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium leading-6 text-fg">{event.label}</p>
                  <p className="mt-0.5 text-[12px] leading-5 text-muted">{event.because}</p>
                </div>
                {event.severity === "warn" ? (
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-faint">软</span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
