import { apiBase } from "../data";
import { IconBrand } from "./icons";

export default function Footer() {
  const api = apiBase();
  return (
    <footer className="border-t border-line">
      <div className="px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-[46ch]">
            <div className="flex items-center gap-2">
              <IconBrand className="size-4 text-accent" />
              <span className="text-[13px] font-semibold text-fg">HorizenBoat</span>
              <span className="text-[11px] text-faint">/ 未知之船</span>
            </div>
            <p className="mt-2.5 text-[12px] leading-6 text-faint">
              把设定变成可执行的文件。站点不接数据库、不装统计脚本、不请求任何第三方资源——打开即读，复制即用。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-12 gap-y-2.5 text-[12px]">
            <a className="text-muted transition-colors hover:text-fg" href={api + "/index.json"} target="_blank" rel="noreferrer">
              检索索引 index.json
            </a>
            <a className="text-muted transition-colors hover:text-fg" href={api + "/works/lord-of-the-mysteries.json"} target="_blank" rel="noreferrer">
              数据包示例
            </a>
            <a className="text-muted transition-colors hover:text-fg" href="https://modelcontextprotocol.io" target="_blank" rel="noreferrer">
              MCP 规范
            </a>
            <span className="font-mono text-faint">schema v1.0</span>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-5 text-[11px] text-faint">
          <span>© 2026 HorizenBoat</span>
          <span>设定摘要 CC BY-NC-SA 4.0</span>
          <span>原著与角色版权归原作者所有，本站仅作同人写作的连续性校验</span>
          <span className="ml-auto font-mono">schema 1.0 · static</span>
        </div>
      </div>
    </footer>
  );
}
