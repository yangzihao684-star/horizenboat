import { cx } from "../lib/format";
import { buildCharacterSheet } from "../lib/prompt";
import type { Character } from "../types";
import { Badge, CopyButton } from "./ui";

function Label({ children, danger }: { children: string; danger?: boolean }) {
  return (
    <div
      className={cx(
        "font-mono text-[10.5px] uppercase tracking-[0.1em]",
        danger ? "text-danger" : "text-faint",
      )}
    >
      {children}
    </div>
  );
}

export default function CharacterCard({
  character,
  selected,
  onToggle,
}: {
  character: Character;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-line bg-surface">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="shrink-0 text-[15.5px] font-semibold tracking-[-0.01em] text-fg">
              {character.name}
            </h3>
            {character.aliases.map((alias) => (
              <Badge key={alias}>{alias}</Badge>
            ))}
          </div>
          <p className="mt-1 text-[12px] leading-5 text-faint">
            {character.role}
            <span className="mx-1.5" aria-hidden="true">
              ·
            </span>
            {character.pathway}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <CopyButton
            text={buildCharacterSheet(character)}
            variant="ghost"
            size="sm"
            toastText="角色钢印已复制"
            label={"复制 " + character.name + " 的钢印卡"}
          >
            复制
          </CopyButton>
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={selected}
            className={cx(
              "h-7.5 rounded-md border px-2.5 text-[12px] font-medium transition-colors",
              selected
                ? "border-accent/40 bg-accent-soft text-accent"
                : "border-line text-muted hover:border-line-strong hover:text-fg",
            )}
          >
            {selected ? "已纳入提示词" : "纳入提示词"}
          </button>
        </div>
      </header>

      <div className="grid gap-x-6 gap-y-5 p-4 sm:p-5 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <Label>核心驱动力</Label>
            <p className="mt-1.5 text-[13px] leading-6 text-fg">{character.drive}</p>
          </div>

          <div>
            <Label>性格内核</Label>
            <ul className="mt-1.5 space-y-1.5">
              {character.personality_core.map((item) => (
                <li key={item} className="flex gap-2.5 text-[13px] leading-6 text-muted">
                  <span className="mt-[11px] size-1 shrink-0 rounded-full bg-accent/70" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <Label>语言习惯</Label>
            <p className="mt-1.5 text-[13px] leading-6 text-muted">{character.speech_pattern}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label>称呼矩阵</Label>
            <dl className="mt-1.5 divide-y divide-line rounded-lg border border-line">
              {character.addressing_matrix.map((row) => (
                <div key={row.target + row.form} className="flex items-baseline gap-3 px-2.5 py-1.5">
                  <dt className="w-[105px] shrink-0 text-[12px] text-faint">{row.target}</dt>
                  <dd className="min-w-0 flex-1 text-[12.5px] leading-5 text-fg">
                    {row.form}
                    {row.note ? (
                      <span className="ml-1.5 text-[11px] text-faint">（{row.note}）</span>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <Label>台词锚点</Label>
            <ul className="mt-1.5 space-y-2">
              {character.dialogue_samples.map((sample) => (
                <li key={sample.text} className="border-l-2 border-accent/40 pl-2.5">
                  <p className="text-[12.5px] leading-6 text-fg">「{sample.text}」</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-faint">
                    <span className="font-mono">
                      {sample.type === "canon" ? "正典" : "语域锚点"}
                    </span>
                    {sample.note ? <span>· {sample.note}</span> : null}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <Label danger>绝对禁止（OOC）</Label>
            <ul className="mt-1.5 space-y-1.5">
              {character.ooc_taboos.map((taboo) => (
                <li key={taboo.rule} className="flex gap-2 text-[12.5px] leading-6 text-muted">
                  <span className="mt-px shrink-0 font-mono text-[11px] text-danger" aria-hidden="true">
                    ✗
                  </span>
                  <span>{taboo.rule}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </article>
  );
}
