/**
 * Minimal hash-based router.
 *
 * We use `#/path` routing instead of the History API because it works from
 * a plain static file server with zero server-side config — important
 * while this is a no-build, static SPA. Swapping to History API routing
 * later (once there's a real server / CDN rewrite rule) only touches this
 * file.
 */
const routes = new Map();
let notFoundFactory = null;
let currentPage = null;
const APP_SELECTOR = "#app";

/**
 * Register a route.
 * @param {string} path - e.g. "/", "/login/patient", "/doctor/dashboard"
 * @param {() => import("./component.js").Component} factory - returns a
 *   fresh component instance for this route.
 */
export function registerRoute(path, factory) {
  routes.set(normalize(path), factory);
}

/** Register the fallback shown for unknown routes. */
export function registerNotFound(factory) {
  notFoundFactory = factory;
}

/** Programmatic navigation, e.g. from a button click handler. */
export function navigate(path) {
  const target = normalize(path);
  if (window.location.hash.replace(/^#/, "") === target) {
    resolve();
    return;
  }
  window.location.hash = target;
}

function normalize(path) {
  if (!path || path === "") return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function currentPath() {
  return normalize(window.location.hash.replace(/^#/, ""));
}

function resolve() {
  const path = currentPath();

  // Exact static match first (unchanged behaviour for every existing route).
  let factory = routes.get(path);
  let params = {};

  // Fall back to dynamic-segment matching (e.g. "/verify/prescription/:id")
  // only if no exact match was found.
  if (!factory) {
    for (const [pattern, registeredFactory] of routes.entries()) {
      const match = matchDynamicRoute(pattern, path);
      if (match) {
        factory = registeredFactory;
        params = match;
        break;
      }
    }
  }

  factory = factory || notFoundFactory || routes.get("/");
  if (!factory) return;

  currentPage?.unmount();
  currentPage = factory(params);
  currentPage.mount(APP_SELECTOR);
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

/**
 * Matches a path against a route pattern containing ":param" segments.
 * Returns an object of extracted params on match, or null otherwise.
 * Only supports single-level ":name" segments — no wildcards, no regex.
 */
function matchDynamicRoute(pattern, path) {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = path.split("/").filter(Boolean);

  if (patternParts.length !== pathParts.length) return null;

  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    if (patternPart.startsWith(":")) {
      params[patternPart.slice(1)] = decodeURIComponent(pathPart);
    } else if (patternPart !== pathPart) {
      return null;
    }
  }
  return params;
}

/** Boot the router: resolves the current URL and listens for changes. */
export function startRouter() {
  window.addEventListener("hashchange", resolve);
  resolve();
}
