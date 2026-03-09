import { MoreHorizontal } from "lucide-react";
import { useRef } from "react";
import type { MouseEvent } from "react";

export type RowActionItem = {
  label: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  tone?: "default" | "danger";
};

type RowActionsMenuProps = {
  actions: RowActionItem[];
  label?: string;
};

export default function RowActionsMenu({ actions, label = "Actions" }: RowActionsMenuProps) {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);

  const handleActionClick = (action: RowActionItem) => (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (action.disabled) return;
    action.onClick();
    detailsRef.current?.removeAttribute("open");
  };

  return (
    <details ref={detailsRef} className="relative sm:hidden" onClick={(event) => event.stopPropagation()}>
      <summary className="list-none cursor-pointer select-none rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 [&::-webkit-details-marker]:hidden">
        <MoreHorizontal size={14} />
        {label}
      </summary>
      <div className="absolute right-0 mt-2 w-44 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] shadow-lg overflow-hidden z-20">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={handleActionClick(action)}
            disabled={action.disabled}
            className={`w-full px-3 py-2 text-left text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              action.tone === "danger"
                ? "text-red-600 dark:text-red-400 hover:bg-red-50/70 dark:hover:bg-red-500/10"
                : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            {action.label}
          </button>
        ))}
      </div>
    </details>
  );
}
