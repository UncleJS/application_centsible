import { permanentLegacyRedirect } from "../_lib/legacy-redirect";

export default async function ReportsLegacyPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  permanentLegacyRedirect(
    "/insights/reports",
    await searchParams,
    "/reports"
  );
}
