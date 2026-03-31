import { permanentRedirect } from "next/navigation";

type SearchParamValue = string | string[] | undefined;

function appendSearchParam(params: URLSearchParams, key: string, value: SearchParamValue) {
  if (typeof value === "undefined") return;
  if (Array.isArray(value)) {
    value.forEach((entry) => params.append(key, entry));
    return;
  }
  params.append(key, value);
}

export function permanentLegacyRedirect(
  destination: string,
  searchParams: Record<string, SearchParamValue> | undefined,
  legacyRoute: string
) {
  const [pathname, initialQuery = ""] = destination.split("?", 2);
  const nextSearchParams = new URLSearchParams(initialQuery);

  Object.entries(searchParams ?? {}).forEach(([key, value]) => {
    appendSearchParam(nextSearchParams, key, value);
  });

  if (!nextSearchParams.has("utm_source")) {
    nextSearchParams.set("utm_source", "legacy-route");
  }
  if (!nextSearchParams.has("utm_medium")) {
    nextSearchParams.set("utm_medium", "redirect");
  }
  if (!nextSearchParams.has("utm_campaign")) {
    nextSearchParams.set("utm_campaign", "navigation-regrouping");
  }
  if (!nextSearchParams.has("utm_content")) {
    nextSearchParams.set("utm_content", legacyRoute.replace(/^\//, ""));
  }

  const query = nextSearchParams.toString();
  permanentRedirect(query ? `${pathname}?${query}` : pathname);
}
