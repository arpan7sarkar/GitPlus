import { cn } from "@/lib/utils";

interface BrowserChromeFrameProps {
  children: React.ReactNode;
  url?: string;
  className?: string;
  title?: string;
}

export function BrowserChromeFrame({ children, url = "app.codebasegpt.com", className, title }: BrowserChromeFrameProps) {
  return (
    <div className={cn("rounded-xl border border-[#E5E5E3] bg-white overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.08)]", className)}>
      {/* Chrome bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E5E5E3] bg-[#F5F5F4]">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 px-4 py-1 rounded-md bg-white border border-[#E5E5E3] text-[11px] text-[#5B5F66] font-mono min-w-0 max-w-xs w-full">
            <svg className="w-3 h-3 text-[#5B5F66] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="truncate">{url}</span>
          </div>
        </div>
        {title && <span className="text-[10px] text-[#5B5F66] hidden sm:block">{title}</span>}
      </div>
      {/* Content */}
      <div>{children}</div>
    </div>
  );
}
