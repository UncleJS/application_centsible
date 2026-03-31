import { permanentLegacyRedirect } from "../_lib/legacy-redirect";

export default async function ForecastLegacyPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  permanentLegacyRedirect(
    "/insights/forecast",
    await searchParams,
    "/forecast"
  );
}
