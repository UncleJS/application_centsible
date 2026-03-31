import { permanentLegacyRedirect } from "../../_lib/legacy-redirect";

export default async function ExpenseCategoriesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  permanentLegacyRedirect("/categories?tab=expense", await searchParams, "/categories/expense");
}
