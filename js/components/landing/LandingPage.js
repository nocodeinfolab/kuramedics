// js/components/landing/LandingPage.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";

// Icons sourced from Lucide (ISC license) — ships as raw path data, no
// icon font, no CDN, same 24x24/stroke-2 convention we were already using.
const Icons = {
  patient: () =>
    h(
      "svg",
      { width: "22", height: "22", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" },
      h("path", { d: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" }),
      h("circle", { cx: "12", cy: "7", r: "4" })
    ),
  doctor: () =>
    h(
      "svg",
      { width: "22", height: "22", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" },
      h("path", { d: "M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1" }),
      h("path", { d: "M11 2v2" }),
      h("path", { d: "M5 2v2" }),
      h("path", { d: "M8 15a6 6 0 0 0 12 0v-3" }),
      h("circle", { cx: "20", cy: "10", r: "2" })
    ),
  arrow: () =>
    h(
      "svg",
      { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" },
      h("path", { d: "M5 12h14" }),
      h("path", { d: "m12 5 7 7-7 7" })
    ),
  shield: () =>
    h(
      "svg",
      { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" },
      h("path", { d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" }),
      h("path", { d: "m9 12 2 2 4-4" })
    ),
  lock: () =>
    h(
      "svg",
      { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" },
      h("rect", { width: "18", height: "11", x: "3", y: "11", rx: "2", ry: "2" }),
      h("path", { d: "M7 11V7a5 5 0 0 1 10 0v4" })
    ),
  notes: () =>
    h(
      "svg",
      { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" },
      h("path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" }),
      h("path", { d: "M14 2v4a2 2 0 0 0 2 2h4" }),
      h("path", { d: "M10 9H8" }),
      h("path", { d: "M16 13H8" }),
      h("path", { d: "M16 17H8" })
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
        "h1",
        { class: "landing__brand-name" },
        h("img", {
          class: "landing__brand-mark",
          src: "/assets/yeroscarelogo.png",
          alt: "YerosCare",
        })
      ),
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
