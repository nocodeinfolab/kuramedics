/**
 * Tiny hyperscript-style helper for building DOM nodes without HTML
 * strings (no innerHTML foot-gun, no build step, no JSX compiler needed).
 *
 *   h("div", { class: "card" },
 *     h("h3", {}, "Title"),
 *     h("p", {}, "Body text")
 *   );
 *
 * Attribute conventions:
 *   - `class` sets className
 *   - keys starting with "on" + a function attach an event listener
 *     (onClick -> click, onSubmit -> submit, ...)
 *   - `html` sets innerHTML directly (only use for trusted, static markup
 *     such as inline SVG paths defined in this codebase)
 *   - everything else is set via setAttribute
 * Children may be strings, numbers, nodes, arrays of those, or falsy
 * values (which are skipped, so conditional children like
 * `condition && h("span", {}, "x")` just work).
 *
 * SVG note: `<svg>` and all of its children (`path`, `circle`, `rect`,
 * `line`, `polyline`, `g`, ...) must be created in the SVG namespace via
 * `document.createElementNS`, or the browser will silently refuse to
 * paint them even though they show up fine in the DOM tree. `h()` tracks
 * whether it's currently building inside an `<svg>` subtree (including
 * across nested `h()` calls for children) and switches namespaces
 * automatically, so call sites don't need to think about it.
 */
const SVG_NS = "http://www.w3.org/2000/svg";

export function h(tag, attrs = {}, ...children) {
  const inSvg = tag === "svg" || SvgContext.active;
  const el = inSvg ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
  let deferredValue;

  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") {
      // className is not settable on SVG elements in all browsers;
      // setAttribute works for both namespaces.
      if (inSvg) el.setAttribute("class", value);
      else el.className = value;
    } else if (key === "html") {
      el.innerHTML = value;
    } else if (key === "dataset") {
      Object.assign(el.dataset, value);
    } else if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "value" && tag === "select") {
      // <select> has no value to set until its <option> children exist,
      // so defer this until after appendChildren runs below.
      deferredValue = value;
    } else if (!inSvg && (key === "value" || key === "checked")) {
      el[key] = value;
    } else if (typeof value === "boolean") {
      if (value) el.setAttribute(key, "");
    } else {
      el.setAttribute(key, value);
    }
  }

  // Mark that we're inside an SVG subtree for the duration of building
  // this element's children, then restore the previous state. This lets
  // nested h("path", ...) / h("circle", ...) calls made while rendering
  // an icon pick up the SVG namespace without every call site having to
  // say so explicitly.
  const wasActive = SvgContext.active;
  if (tag === "svg") SvgContext.active = true;
  appendChildren(el, children);
  SvgContext.active = wasActive;

  if (deferredValue !== undefined) {
    el.value = deferredValue;
  }

  return el;
}

// Simple mutable flag rather than threading a param through every h()
// call and through appendChildren. h() is not re-entrant across async
// boundaries, so this is safe: rendering is always synchronous.
const SvgContext = { active: false };

function appendChildren(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
}
/** Grows a textarea's height to fit its content, removing the need for a scrollbar. */
export function autoGrow(el) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

/** Convenience for building raw SVG/text fragments trusted by this codebase. */
export function raw(markup) {
  const template = document.createElement("template");
  template.innerHTML = markup.trim();
  return template.content;
}
