// js/components/landing/LandingPage.js

import { Component } from "../../core/component.js";
import { h, raw } from "../../utils/dom.js";

// Petal/leaf logo mark — two overlapping teardrops with a dot, matching
// the wordmark's serif character without being a literal medical icon.
const LOGO_MARK_PATH =
  "M32 4C32 4 12 14 12 34C12 45 21 53 32 56C32 56 32 34 32 4Z M32 4C32 4 52 14 52 34C52 45 43 53 32 56C32 56 32 34 32 4Z";

const Icons = {
  patient: () =>
    h(
      "svg",
      { width: "22", height: "22", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.75", "stroke-linecap": "round", "stroke-linejoin": "round" },
      h("circle", { cx: "12", cy: "8", r: "4" }),
      h("path", { d: "M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" })
    ),
  doctor: () =>
    h(
      "svg",
      { width: "22", height: "22", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.75", "stroke-linecap": "round", "stroke-linejoin": "round" },
      h("path", { d: "M8 3v5a4 4 0 0 0 8 0V3" }),
      h("path", { d: "M8 5H6a1 1 0 0 0-1 1v2a5 5 0 0 0 5 5" }),
      h("path", { d: "M16 5h2a1 1 0 0 1 1 1v2a5 5 0 0 1-5 5" }),
      h("circle", { cx: "18", cy: "16", r: "3" }),
      h("path", { d: "M12 13v3" })
    ),
  arrow: () =>
    h(
      "svg",
      { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2.25", "stroke-linecap": "round", "stroke-linejoin": "round" },
      h("line", { x1: "5", y1: "12", x2: "19", y2: "12" }),
      h("polyline", { points: "12 5 19 12 12 19" })
    ),
  shield: () =>
    h(
      "svg",
      { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.75", "stroke-linecap": "round", "stroke-linejoin": "round" },
      h("path", { d: "M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" }),
      h("polyline", { points: "9 12 11 14 15 10" })
    ),
  lock: () =>
    h(
      "svg",
      { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.75", "stroke-linecap": "round", "stroke-linejoin": "round" },
      h("rect", { x: "5", y: "11", width: "14", height: "9", rx: "2" }),
      h("path", { d: "M8 11V7a4 4 0 0 1 8 0v4" })
    ),
  notes: () =>
    h(
      "svg",
      { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.75", "stroke-linecap": "round", "stroke-linejoin": "round" },
      h("path", { d: "M14 3v4a1 1 0 0 0 1 1h4" }),
      h("path", { d: "M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" }),
      h("line", { x1: "9", y1: "13", x2: "15", y2: "13" }),
      h("line", { x1: "9", y1: "17", x2: "13", y2: "17" })
    ),
};

/**
 * App entry screen (pre-login). This is what a person sees the moment they
 * open the app for the first time — not a marketing site. One screen, one
 * decision: patient or doctor. Everything on it earns its place by helping
 * that one decision or building just enough trust to make it.
 */
export class LandingPage extends Component {
  render() {
    return h(
      "div",
      { class: "landing" },
      h("div", { class: "landing__glow landing__glow--top", "aria-hidden": "true" }),
      h("div", { class: "landing__glow landing__glow--bottom", "aria-hidden": "true" }),
      this.renderStatusRow(),
      h(
        "main",
        { class: "landing__main" },
        this.renderBrand(),
        this.renderHeadline(),
        this.renderRoleActions(),
        this.renderTrustDivider(),
        this.renderFeatureStrip()
      ),
      this.renderLegal()
    );
  }

  renderStatusRow() {
    // Language / region selector, top right. Purely cosmetic here — wire
    // up to a real locale switcher when one exists.
    return h(
      "div",
      { class: "landing__status-row" },
      h(
        "button",
        { class: "locale-pill", type: "button", "aria-label": "Change language" },
        h("span", { class: "locale-pill__flag", "aria-hidden": "true" }),
        h("span", { class: "locale-pill__label" }, "EN"),
        h(
          "svg",
          { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" },
          h("polyline", { points: "6 9 12 15 18 9" })
        )
      )
    );
  }

  renderBrand() {
    return h(
      "div",
      { class: "landing__brand" },
      h(
        "svg",
        { class: "landing__brand-mark", width: "56", height: "56", viewBox: "0 0 64 64", "aria-hidden": "true" },
        raw(`<path d="${LOGO_MARK_PATH}" fill="currentColor" />`),
        h("circle", { cx: "32", cy: "8", r: "5", class: "landing__brand-mark-dot" })
      ),
      h("h1", { class: "landing__brand-name" }, "YerosCare"),
      h("p", { class: "landing__brand-tagline" }, "Care moves closer")
    );
  }

  renderHeadline() {
    return h(
      "div",
      { class: "landing__headline" },
      h(
        "h2",
        { class: "landing__title" },
        h("span", {}, "Care, organised"),
        h("span", { class: "landing__title-accent" }, "around you.")
      ),
      h(
        "p",
        { class: "landing__lead" },
        "Book and manage your care, or build your digital medical practice."
      )
    );
  }

  renderRoleActions() {
    return h(
      "div",
      { class: "landing__actions" },
      h(
        "a",
        { class: "role-btn role-btn--primary", href: "#/patient/login" },
        h("span", { class: "role-btn__icon" }, Icons.patient()),
        h(
          "span",
          { class: "role-btn__copy" },
          h("span", { class: "role-btn__label" }, "I'm a patient"),
          h("span", { class: "role-btn__sub" }, "Find, book and manage my care")
        ),
        h("span", { class: "role-btn__arrow" }, Icons.arrow())
      ),
      h(
        "a",
        { class: "role-btn role-btn--outline", href: "#/doctor/login" },
        h("span", { class: "role-btn__icon" }, Icons.doctor()),
        h(
          "span",
          { class: "role-btn__copy" },
          h("span", { class: "role-btn__label" }, "I'm a doctor"),
          h("span", { class: "role-btn__sub" }, "Manage my digital practice")
        ),
        h("span", { class: "role-btn__arrow" }, Icons.arrow())
      )
    );
  }

  renderTrustDivider() {
    return h(
      "div",
      { class: "landing__trust", "aria-hidden": "true" },
      h("span", { class: "landing__trust-rule" }),
      h("span", { class: "landing__trust-label" }, "Trusted. Secure. Private."),
      h("span", { class: "landing__trust-rule" })
    );
  }

  renderFeatureStrip() {
    const features = [
      { icon: Icons.shield, label: "Verified doctors" },
      { icon: Icons.lock, label: "Secure messaging" },
      { icon: Icons.notes, label: "Private records" },
    ];

    return h(
      "ul",
      { class: "landing__features" },
      features.map((feature) =>
        h(
          "li",
          { class: "feature-chip" },
          h("span", { class: "feature-chip__icon" }, feature.icon()),
          h("span", { class: "feature-chip__label" }, feature.label)
        )
      )
    );
  }

  renderLegal() {
    return h(
      "footer",
      { class: "landing__legal" },
      h(
        "p",
        {},
        "By continuing, you agree to our ",
        h("a", { href: "#/terms" }, "Terms"),
        " and ",
        h("a", { href: "#/privacy" }, "Privacy Policy"),
        "."
      )
    );
  }
}
