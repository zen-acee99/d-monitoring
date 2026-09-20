import React from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function Shell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-[#07090E] text-slate-200 font-sans selection:bg-brand-500/30 print:h-auto print:overflow-visible print:bg-white print:block">
      <div className="print:hidden h-full flex shrink-0">
        <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      </div>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#07090E] print:h-auto print:overflow-visible print:bg-white print:block">
        <div className="print:hidden">
          <Header onMenuClick={() => setIsSidebarOpen(true)} />
        </div>
        <main className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar print:p-0 print:m-0 print:overflow-visible print:bg-white print:block">
          {children}
        </main>
      </div>
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden print:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}
