import { useState, type ReactNode } from "react";
import { countChars } from "../lib/format";
import { IconClose } from "./icons";
import { Button, CopyButton, Modal } from "./ui";

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={index} className="font-semibold text-fg">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

function renderMarkdown(source: string): ReactNode[] {
  const blocks: ReactNode[] = [];

  source.split("\n").forEach((line, index) => {
    const key = "line-" + index;

    if (!line.trim()) {
      blocks.push(<div key={key} className="h-2.5" />);
      return;
    }
    if (line.startsWith("---") || line.startsWith("───")) {
      blocks.push(<hr key={key} className="my-3.5 border-line" />);
      return;
    }
    if (line.startsWith("# ")) {
      blocks.push(
        <h2 key={key} className="text-[14.5px] font-semibold tracking-[-0.01em] text-fg">
          {line.slice(2)}
        </h2>,
      );
      return;
    }
    if (line.startsWith("## ")) {
      blocks.push(
        <h3 key={key} className="mt-4 text-[12.5px] font-semibold tracking-[0.02em] text-fg">
          {line.slice(3)}
        </h3>,
      );
      return;
    }
    if (line.startsWith("### ")) {
      blocks.push(
        <h4 key={key} className="mt-3 text-[12.5px] font-semibold text-fg">
          {line.slice(4)}
        </h4>,
      );
      return;
    }
    if (line.startsWith("> ")) {
      blocks.push(
        <p key={key} className="border-l-2 border-line-strong pl-3 text-[11.5px] leading-6 text-faint">
          <Inline text={line.slice(2)} />
        </p>,
      );
      return;
    }

    const bullet = /^(\s*)-\s+(.*)$/.exec(line);
    if (bullet) {
      const indented = bullet[1].length >= 2;
      const body = bullet[2].startsWith("[ ] ") ? "☐ " + bullet[2].slice(4) : bullet[2];
      blocks.push(
        <div key={key} className={"flex gap-2" + (indented ? " pl-4" : "")}>
          <span className="mt-[9px] size-1 shrink-0 rounded-full bg-line-strong" aria-hidden="true" />
          <span className="min-w-0 text-[12.5px] leading-[1.9] text-muted">
            <Inline text={body} />
          </span>
        </div>,
      );
      return;
    }

    const numbered = /^(\d+)\.\s+(.*)$/.exec(line);
    if (numbered) {
      blocks.push(
        <div key={key} className="flex gap-2">
          <span className="shrink-0 font-mono text-[10.5px] leading-[2.1] text-accent">{numbered[1]}.</span>
          <span className="min-w-0 text-[12.5px] leading-[1.9] text-muted">
            <Inline text={numbered[2]} />
          </span>
        </div>,
      );
      return;
    }

    blocks.push(
      <p key={key} className="text-[12.5px] leading-[1.9] text-muted">
        <Inline text={line} />
      </p>,
    );
  });

  return blocks;
}

export default function PromptModal({
  open,
  onClose,
  prompt,
  caption,
}: {
  open: boolean;
  onClose: () => void;
  prompt: string;
  caption: string;
}) {
  const [mode, setMode] = useState<"rendered" | "source">("rendered");

  const tab = (value: "rendered" | "source", label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => setMode(value)}
      aria-pressed={mode === value}
      className={
        "h-6 rounded px-2 text-[11px] transition-colors " +
        (mode === value ? "bg-surface-2 text-fg" : "text-faint hover:text-fg")
      }
    >
      {label}
    </button>
  );

  return (
    <Modal open={open} onClose={onClose} labelledBy="prompt-title">
      <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 id="prompt-title" className="text-[13px] font-semibold text-fg">
              System Prompt 预览
            </h3>
            <div className="flex items-center gap-0.5 rounded-md border border-line p-0.5">
              {tab("rendered", "排版")}
              {tab("source", "源码")}
            </div>
          </div>
          <p className="mt-1 truncate font-mono text-[10.5px] text-faint">
            {caption} · {countChars(prompt)} 字
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <CopyButton text={prompt} variant="primary" size="sm" toastText="纯净 System Prompt 已复制">
            复制
          </CopyButton>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="关闭预览">
            <IconClose className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="max-h-[62vh] overflow-auto px-4 py-4">
        {mode === "rendered" ? (
          <div className="space-y-0.5">{renderMarkdown(prompt)}</div>
        ) : (
          <pre className="whitespace-pre-wrap break-words font-mono text-[11.5px] leading-[1.85] text-fg">
            {prompt}
          </pre>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2">
        <span className="text-[11px] text-faint">
          复制的一律是原始 Markdown，仅供 AI 阅读；排版视图不改动任何字符。
        </span>
        <span className="hidden shrink-0 font-mono text-[10.5px] text-faint sm:inline">esc 关闭</span>
      </div>
    </Modal>
  );
}
