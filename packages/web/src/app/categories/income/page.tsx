import { permanentLegacyRedirect } from "../../_lib/legacy-redirect";

export default async function IncomeCategoriesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  permanentLegacyRedirect("/categories?tab=income", await searchParams, "/categories/income");
}
