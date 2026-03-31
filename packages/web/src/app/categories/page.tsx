"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { TrendingDown, TrendingUp } from "lucide-react";

import { CategoriesPage } from "@/components/categories/categories-page";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function CategoriesHubPage() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");

  const defaultTab = useMemo(
    () => (requestedTab === "income" ? "income" : "expense"),
    [requestedTab]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Money In / Out"
        title="Categories"
        description="Manage your expense and income categories from one place with a consistent tabbed workflow."
      />

      <Tabs defaultValue={defaultTab} className="gap-6">
        <TabsList className="w-full justify-start rounded-2xl bg-zinc-900 p-1 sm:w-fit">
          <TabsTrigger value="expense" className="gap-2 rounded-xl px-4">
            <TrendingDown className="size-4 text-red-400" />
            Expense
          </TabsTrigger>
          <TabsTrigger value="income" className="gap-2 rounded-xl px-4">
            <TrendingUp className="size-4 text-emerald-400" />
            Income
          </TabsTrigger>
        </TabsList>

        <TabsContent value="expense" className="mt-0">
          <CategoriesPage type="expense" showHeader={false} />
        </TabsContent>

        <TabsContent value="income" className="mt-0">
          <CategoriesPage type="income" showHeader={false} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
