import { Navigate, useLocation } from "react-router";

interface LegacyRedirectProps {
  /** Destination path. May include a query string (e.g. "/categories?tab=expense"). */
  to: string;
  /** Original legacy route path, without the leading slash, used as `utm_content`. */
  content: string;
}

/**
 * Permanent-style client redirect from a retired route to its new home.
 * Preserves any incoming query parameters and tags the navigation with UTM
 * parameters identifying the redirect source, mirroring the behavior of the
 * previous server-side `permanentLegacyRedirect` helper.
 */
export function LegacyRedirect({ to, content }: LegacyRedirectProps) {
  const location = useLocation();

  const [pathname, initialQuery = ""] = to.split("?", 2);
  const params = new URLSearchParams(initialQuery);

  const incoming = new URLSearchParams(location.search);
  incoming.forEach((value, key) => {
    params.append(key, value);
  });

  if (!params.has("utm_source")) params.set("utm_source", "legacy-route");
  if (!params.has("utm_medium")) params.set("utm_medium", "redirect");
  if (!params.has("utm_campaign"))
    params.set("utm_campaign", "navigation-regrouping");
  if (!params.has("utm_content")) params.set("utm_content", content);

  const query = params.toString();
  return <Navigate to={query ? `${pathname}?${query}` : pathname} replace />;
}
