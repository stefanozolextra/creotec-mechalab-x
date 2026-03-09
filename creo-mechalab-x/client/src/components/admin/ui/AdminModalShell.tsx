import { X } from "lucide-react";
import { useEffect, useId } from "react";
import type { ReactNode } from "react";

type AdminModalShellProps = {
  open: boolean;
  title: string;
  description?: string;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClass?: string;
  closeDisabled?: boolean;
  bodyClassName?: string;
  contentClassName?: string;
  closeOnBackdrop?: boolean;
};

export default function AdminModalShell({
  open,
  title,
  description,
  icon,
  onClose,
  children,
  footer,
  maxWidthClass = "max-w-2xl",
  closeDisabled = false,
  bodyClassName = "",
  contentClassName = "",
  closeOnBackdrop = true,
}: AdminModalShellProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open || closeDisabled) return;

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscapeKey);
    return () => {
      window.removeEventListener("keydown", handleEscapeKey);
    };
  }, [open, closeDisabled, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close modal backdrop"
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={closeOnBackdrop && !closeDisabled ? onClose : undefined}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative z-[51] w-full ${maxWidthClass} rounded-3xl bg-white dark:bg-[#1E293B] shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden ${contentClassName}`}
      >
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/20 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {icon ? (
                <div className="p-2 bg-blue-50 dark:bg-[#3B82F6]/20 text-[#3B82F6] rounded-xl shrink-0">
                  {icon}
                </div>
              ) : null}
              <div className="min-w-0">
                <h2 id={titleId} className="text-lg sm:text-xl font-extrabold text-[#0B1B3D] dark:text-slate-100 truncate">
                  {title}
                </h2>
                {description ? (
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    {description}
                  </p>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-[#0B1B3D] dark:hover:text-slate-200 transition-colors bg-white dark:bg-[#0F172A] p-2 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm disabled:opacity-50"
              aria-label="Close modal"
              disabled={closeDisabled}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className={`flex-1 min-h-0 overflow-y-auto ${bodyClassName}`}>
          {children}
        </div>

        {footer ? (
          <div className="px-5 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/20 shrink-0">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
