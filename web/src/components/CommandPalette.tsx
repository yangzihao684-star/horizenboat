import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { buildSearchDocs, searchDocs, type DocKind, type SearchDoc } from "../lib/search";
import { cx } from "../lib/format";
import type { WorkIndex } from "../types";
import { IconFile, IconSearch, IconSparkles, IconTag, IconUsers } from "./icons";
import { Kbd } from "./ui";

const KIND_LABEL: Record<DocKind, string> = {
  work: "作品",
  character: "角色",
  hook: "钩子",
  tag: "标签",
};

function KindIcon({ kind }: { kind: DocKind }) {
  if (kind === "character") return <IconUsers className="size-4" />;
  if (kind === "hook") return <IconSparkles className="size-4" />;
  if (kind === "tag") return <IconTag className="size-4" />;
  return <IconFile className="size-4" />;
}

export default function CommandPalette({
  open,
  onClose,
  index,
}: {
  open: boolean;
  onClose: () => void;
  index: WorkIndex | null;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const docs = useMemo(() => (index ? buildSearchDocs(index) : []), [index]);
  const results = useMemo(() => searchDocs(docs, query, 11), [docs, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  const openResult = (doc: SearchDoc) => {
    onClose();
    if (window.location.hash === doc.href) {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } else {
      window.location.hash = doc.href;
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => Math.min(current + 1, Math.max(results.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const doc = results[Math.min(active, results.length - 1)];
      if (doc) openResult(doc);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[10vh]">
      <button
        type="button"
        aria-label="关闭搜索"
        onClick={onClose}
        className="anim-fade absolute inset-0 cursor-default bg-black/60 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="全局搜索"
        onKeyDown={onKeyDown}
        className="anim-pop relative z-10 w-full max-w-[600px] overflow-hidden rounded-xl border border-line-strong bg-canvas shadow-[0_32px_90px_rgba(0,0,0,0.5)]"
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <IconSearch className="size-4 shrink-0 text-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索作品、角色、世界观标签、脑洞关键词…"
            aria-label="搜索"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-faint"
          />
          <Kbd>esc</Kbd>
        </div>

        <div className="max-h-[52vh] overflow-auto py-1.5" role="listbox" aria-label="搜索结果">
          {results.length === 0 ? (
            <p className="px-4 py-10 text-center text-[12.5px] text-faint">
              没有匹配「{query}」的条目
            </p>
          ) : null}

          {results.map((doc, order) => (
            <button
              key={doc.key}
              type="button"
              role="option"
              aria-selected={order === active}
              onMouseMove={() => setActive(order)}
              onClick={() => openResult(doc)}
              className={cx(
                "flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors",
                order === active ? "bg-surface-2" : "hover:bg-surface",
              )}
            >
              <span className={cx("shrink-0", order === active ? "text-accent" : "text-faint")}>
                <KindIcon kind={doc.kind} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-fg">{doc.title}</span>
                <span className="block truncate text-[11px] leading-5 text-faint">{doc.subtitle}</span>
              </span>
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
                {KIND_LABEL[doc.kind]}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-4 py-2 text-[10.5px] text-faint">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> 移动
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd> 打开
          </span>
          <span className="ml-auto font-mono tracking-[0.04em]">
            {docs.length} 条索引 · 本地模糊匹配
          </span>
        </div>
      </div>
    </div>
  );
}
