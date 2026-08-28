import { Suspense } from "react";
import { FinanceNav } from "@/components/finance/finance-nav";

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="h-10 border-b" />}>
        <FinanceNav />
      </Suspense>
      {children}
    </div>
  );
}
