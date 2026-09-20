import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children, className, footer }: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal panel */}
      <div className={cn(
        "relative w-full max-w-lg max-h-[88vh] flex flex-col rounded-2xl bg-[#0C101D] border border-[#18233C] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-10",
        className
      )}>
        {/* Header - Fixed & Non-shrinking */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#18233C] bg-[#111728] shrink-0">
          <h3 className="text-sm sm:text-base font-bold text-white tracking-tight line-clamp-1 pr-3">{title}</h3>
          <button 
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors shrink-0 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 custom-scrollbar min-h-0 text-slate-200">
          {children}
        </div>

        {/* Optional Footer */}
        {footer && (
          <div className="px-5 py-3.5 border-t border-[#18233C] bg-[#111728] shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

