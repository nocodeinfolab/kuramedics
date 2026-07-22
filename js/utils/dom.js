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
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;

    if (key === "class") {
      el.className = value;
    } else if (key === "html") {
      el.innerHTML = value;
    } else if (key === "dataset") {
      Object.assign(el.dataset, value);
    } else if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (typeof value === "boolean") {
      if (value) el.setAttribute(key, "");
    } else {
      el.setAttribute(key, value);
    }
  }

  appendChildren(el, children);
  return el;
}

function appendChildren(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
}

/** Convenience for building raw SVG/text fragments trusted by this codebase. */
export function raw(markup) {
  const template = document.createElement("template");
  template.innerHTML = markup.trim();
  return template.content;
}
