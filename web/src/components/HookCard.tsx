import type { Hook } from "../types";
import { CopyButton } from "./ui";

const MARKS = ["①", "②", "③", "④", "⑤"];

export default function HookCard({ hook }: { hook: Hook }) {
  const plain = [hook.premise, ...hook.ripple_questions.map((q, i) => MARKS[i] + q)].join("\n");

  return (
    <article
      id={"hook-" + hook.hook_id}
      className="scroll-mt-24 rounded-xl border border-line bg-surface p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-mono text-[10.5px] tracking-[0.06em] text-faint">{hook.hook_id}</span>
          <h3 className="text-[14px] font-semibold leading-6 text-fg">{hook.title}</h3>
        </div>
        <CopyButton text={plain} variant="ghost" size="sm" toastText="发散钩子已复制">
          <span className="sr-only">复制钩子</span>
        </CopyButton>
      </div>

      <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2.5 text-[13px] leading-6 text-fg">
        <span className="mr-1.5 font-mono text-[10.5px] text-accent">PREMISE</span>
        {hook.premise}
      </p>

      <div className="mt-4">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint">推演阶梯</div>
        <ol className="mt-2 space-y-2">
          {hook.ripple_questions.map((question, i) => (
            <li key={question} className="flex gap-2.5">
              <span className="mt-px shrink-0 font-mono text-[11.5px] leading-6 text-accent" aria-hidden="true">
                {MARKS[i] ?? i + 1}
              </span>
              <span className="text-[13px] leading-6 text-muted">{question}</span>
            </li>
          ))}
        </ol>
      </div>
    </article>
  );
}
