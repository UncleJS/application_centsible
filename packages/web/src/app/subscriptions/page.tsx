import { permanentLegacyRedirect } from "../_lib/legacy-redirect";

export default async function SubscriptionsLegacyPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  permanentLegacyRedirect(
    "/recurring/subscriptions",
    await searchParams,
    "/subscriptions"
  );
}
