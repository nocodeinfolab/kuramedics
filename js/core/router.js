const routes = [];
let notFoundFactory = null;
let currentPage = null;
const APP_SELECTOR = "#app";

/** Converts path pattern like "/verify/prescription/:id" to Regex */
function pathToRegex(path) {
  return new RegExp(
    "^" + path.replace(/:[^\s/]+/g, "([^/]+)") + "$"
  );
}

/** Extracts param names like [ "id" ] from "/verify/prescription/:id" */
function getParamNames(path) {
  const matches = path.match(/:[^\s/]+/g);
  return matches ? matches.map((param) => param.substring(1)) : [];
}

export function registerRoute(path, factory) {
  const normalized = normalize(path);
  routes.push({
    path: normalized,
    regex: pathToRegex(normalized),
    paramNames: getParamNames(normalized),
    factory,
  });
}

export function registerNotFound(factory) {
  notFoundFactory = factory;
}

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
  let matchedFactory = null;
  let params = {};

  // Find matching route
  for (const route of routes) {
    const match = path.match(route.regex);
    if (match) {
      matchedFactory = route.factory;
      // Extract key-value param pairs (e.g., { id: '123' })
      route.paramNames.forEach((name, index) => {
        params[name] = match[index + 1];
      });
      break;
    }
  }

  const factory = matchedFactory || notFoundFactory;
  if (!factory) return;

  currentPage?.unmount();
  // Pass extracted params to factory function
  currentPage = factory(params);
  currentPage.mount(APP_SELECTOR);
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

export function startRouter() {
  window.addEventListener("hashchange", resolve);
  resolve();
}
