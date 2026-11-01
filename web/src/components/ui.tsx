import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { copyText } from "../lib/clipboard";
import { cx } from "../lib/format";
import { IconCheck, IconCopy } from "./icons";

/* ---------------------------------------------------------------- toast -- */

interface ToastItem {
  id: number;
  text: string;
}

const ToastContext = createContext<(text: string) => void>(() => undefined);

export function useToast(): (text: string) => void {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current.slice(-2), { id, text }]);
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, 2000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        className="pointer-events-none fixed bottom-5 right-4 z-[90] flex flex-col items-end gap-2"
        aria-live="polite"
        aria-atomic="false"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="anim-pop rounded-lg border border-line-strong bg-surface px-3.5 py-2 text-[12.5px] text-fg shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
          >
            {item.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* --------------------------------------------------------------- button -- */

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md";

const varians: Record<ButtonVariant, string> = {
  primary: "bg-fg text-canvas hover:bg-fg/90",
  secondary: "border border-line bg-surface text-fg hover:border-line-strong hover:bg-surface-2",
  ghost: "text-muted hover:bg-surface-2 hover:text-fg",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-7.5 gap-1.5 rounded-md px-2 text-[12px]",
  md: "h-9 gap-2 rounded-lg px-3.5 text-[13px]",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant = "secondary", size = "md", className, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        "inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45",
        varians[variant],
        sizes[size],
        className,
      )}
    />
  );
}

interface CopyButtonProps {
  text: string;
  children?: ReactNode;
  toastText?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  label?: string;
}

export function CopyButton({
  text,
  children,
  toastText,
  variant = "secondary",
  size = "md",
  className,
  label,
}: CopyButtonProps) {
  const toast = useToast();
  const [done, setDone] = useState(false);

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      aria-label={label}
      onClick={async () => {
        const ok = await copyText(text);
        if (!ok) {
          toast("复制失败，请手动选择文本");
          return;
        }
        setDone(true);
        toast(toastText ?? "已复制到剪贴板");
        window.setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <IconCheck className="size-3.5 text-ok" /> : <IconCopy className="size-3.5" />}
      {children}
    </Button>
  );
}

/* ----------------------------------------------------------------- chip -- */

export function Chip({
  active,
  children,
  onClick,
  title,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] transition-colors duration-150",
        active
          ? "border-line-strong bg-surface-2 text-fg"
          : "border-line bg-transparent text-muted hover:border-line-strong hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "danger" | "ok";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "border-line bg-surface-2 text-muted",
    accent: "border-accent/35 bg-accent-soft text-accent",
    danger: "border-danger/30 bg-danger-soft text-danger",
    ok: "border-ok/30 bg-ok/10 text-ok",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-5",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-surface-2 px-1 font-mono text-[10.5px] text-muted">
      {children}
    </kbd>
  );
}

/* -------------------------------------------------------------- section -- */

export function SectionHeader({
  index,
  label,
  title,
  desc,
  id,
  action,
}: {
  index: string;
  label: string;
  title: string;
  desc?: string;
  id?: string;
  action?: ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-24">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[11px] tabular-nums text-accent">{index}</span>
        <span className="mono-label">{label}</span>
        <span className="h-px flex-1 bg-line" />
        {action}
      </div>
      <h2 className="mt-3.5 text-[17px] font-semibold tracking-[-0.01em] text-fg">{title}</h2>
      {desc ? <p className="mt-1.5 max-w-[64ch] text-[13px] leading-6 text-muted">{desc}</p> : null}
    </div>
  );
}

export function CodeBlock({
  code,
  label,
  className,
}: {
  code: string;
  label: string;
  className?: string;
}) {
  return (
    <div className={"overflow-hidden rounded-lg border border-line bg-surface-2 " + (className ?? "")}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-1.5">
        <span className="mono-label truncate">{label}</span>
        <CopyButton text={code} variant="ghost" size="sm" toastText="已复制到剪贴板">
          <span className="sr-only">复制</span>
        </CopyButton>
      </div>
      <pre className="overflow-x-auto px-3.5 py-3 font-mono text-[12px] leading-[1.75] text-fg">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  children,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  labelledBy: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[8vh]">
      <button
        type="button"
        aria-label="关闭"
        className="anim-fade absolute inset-0 cursor-default bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="anim-pop relative z-10 w-full max-w-2xl overflow-hidden rounded-xl border border-line-strong bg-canvas shadow-[0_32px_80px_rgba(0,0,0,0.45)]"
      >
        {children}
      </div>
    </div>
  );
}
