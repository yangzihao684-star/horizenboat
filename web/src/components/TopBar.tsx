import type { Theme } from "../hooks/useTheme";
import { apiBase } from "../data";
import { IconBrand, IconMoon, IconSearch, IconSun } from "./icons";
import { Kbd } from "./ui";

export default function TopBar({
  theme,
  onToggleTheme,
  onOpenPalette,
  onJumpToIntegration,
}: {
  theme: Theme;
  onToggleTheme: () => void;
  onOpenPalette: () => void;
  onJumpToIntegration: () => void;
}) {
  const navClass =
    "rounded-md px-2.5 py-1.5 text-[12.5px] text-muted transition-colors hover:bg-surface-2 hover:text-fg";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/80 backdrop-blur-md">
      <div className="shell flex h-14 items-center gap-3 px-4 sm:px-6">
        <a href="#/" className="flex shrink-0 items-center gap-2.5" aria-label="HorizonBoat 首页">
          <IconBrand className="size-[18px] text-accent" />
          <span className="text-[13.5px] font-semibold tracking-[-0.01em] text-fg">HorizonBoat</span>
          <span className="hidden text-[11px] text-faint sm:inline">地平线之舟</span>
        </a>

        <nav className="ml-5 hidden items-center gap-0.5 md:flex" aria-label="主导航">
          <a href="#/" className={navClass}>
            作品库
          </a>
          <button type="button" onClick={onJumpToIntegration} className={navClass}>
            接入 MCP
          </button>
          <a
            href={apiBase() + "/index.json"}
            target="_blank"
            rel="noreferrer"
            className={navClass}
          >
            API 索引
          </a>
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenPalette}
            className="hidden h-8 items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-[12px] text-muted transition-colors hover:border-line-strong hover:text-fg sm:flex"
          >
            <IconSearch className="size-3.5" />
            <span>搜索</span>
            <Kbd>⌘K</Kbd>
          </button>
          <button
            type="button"
            onClick={onOpenPalette}
            aria-label="打开搜索"
            className="flex size-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-fg sm:hidden"
          >
            <IconSearch className="size-4" />
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
            className="flex size-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            {theme === "dark" ? <IconSun className="size-4" /> : <IconMoon className="size-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
