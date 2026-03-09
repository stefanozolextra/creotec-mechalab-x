import type { ReactNode } from "react";

type AdminTableScrollProps = {
  children: ReactNode;
  className?: string;
};

export default function AdminTableScroll({ children, className = "" }: AdminTableScrollProps) {
  return (
    <div className={`-mx-3 px-3 sm:mx-0 sm:px-0 ${className}`}>
      <div className="overflow-x-auto overflow-y-hidden">
        {children}
      </div>
    </div>
  );
}
