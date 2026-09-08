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
 * paint them even though they show up fine in the DOM tree.
 *
 * IMPORTANT: we can't detect this by tracking "are we currently inside an
 * <svg> call" as a stateful flag, because JS evaluates a function's
 * arguments before invoking the function itself. In
 * `h("svg", {}, h("circle", {}))`, the inner `h("circle", ...)` call has
 * already finished running by the time the outer `h("svg", ...)` call
 * even starts its body, so any flag set inside the "svg" branch is set
 * too late to affect its own children. Instead, `h()` checks each tag
 * name against a fixed set of known SVG element names, so every call is
 * self-sufficient regardless of evaluation order.
 */
const SVG_NS = "http://www.w3.org/2000/svg";

const SVG_TAGS = new Set([
  "svg", "g", "path", "circle", "ellipse", "rect", "line", "polyline",
  "polygon", "text", "tspan", "defs", "use", "symbol", "clipPath",
  "linearGradient", "radialGradient", "stop", "mask", "pattern",
  "marker", "filter", "foreignObject",
]);

export function h(tag, attrs = {}, ...children) {
  const inSvg = SVG_TAGS.has(tag);
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

  appendChildren(el, children);

  if (deferredValue !== undefined) {
    el.value = deferredValue;
  }

  return el;
}

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
