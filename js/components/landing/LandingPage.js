// js/components/landing/LandingPage.js

import { Component } from "../../core/component.js";
import { h, raw } from "../../utils/dom.js";

const PULSE_PATH =
  "M0,60 L110,60 L134,60 L150,20 L172,104 L192,60 L214,60 L228,40 L242,60 L400,60 L420,60 L444,60 L460,20 L482,104 L502,60 L524,60 L538,40 L552,60 L720,60";

// Small inline icon set, matching the stroke-based style already used
// elsewhere in the app (e.g. PatientDashboardPage's Icons helper).
const Icons = {
  calendar: () =>
    h(
      "svg",
      { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" },
      h("rect", { x: "3", y: "4", width: "18", height: "18", rx: "2", ry: "2" }),
      h("line", { x1: "16", y1: "2", x2: "16", y2: "6" }),
      h("line", { x1: "8", y1: "2", x2: "8", y2: "6" }),
      h("line", { x1: "3", y1: "10", x2: "21", y2: "10" })
    ),
  chat: () =>
    h(
      "svg",
      { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" },
      h("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" })
    ),
  shield: () =>
    h(
      "svg",
      { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" },
      h("path", { d: "M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" })
    ),
  notes: () =>
    h(
      "svg",
      { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" },
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
      this.renderBrandBar(),
      h(
        "main",
        { class: "landing__main" },
        this.renderPulse(),
        this.renderHeadline(),
        this.renderRoleActions(),
        this.renderFeatureStrip()
      ),
      this.renderLegal()
    );
  }

  renderBrandBar() {
    return h(
      "header",
      { class: "landing__brand" },
      h("span", { class: "landing__brand-mark", "aria-hidden": "true" }),
      h("span", { class: "landing__brand-name" }, "YerosCare")
    );
  }

  renderPulse() {
    return h(
      "div",
      { class: "landing__pulse", "aria-hidden": "true" },
      h(
        "svg",
        {
          class: "pulse-line",
          viewBox: "0 0 720 120",
          preserveAspectRatio: "none",
          role: "presentation",
        },
        raw(
          `<path d="${PULSE_PATH}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />`
        )
      )
    );
  }

  renderHeadline() {
    return h(
      "div",
      { class: "landing__headline" },
      h("h1", { class: "landing__title" }, "Care that comes to you"),
      h(
        "p",
        { class: "landing__lead" },
        "Book verified doctors, message them securely, and keep your visits and records in one place."
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
        h("span", { class: "role-btn__label" }, "I'm a patient"),
        h("span", { class: "role-btn__sub" }, "Find and book care")
      ),
      h(
        "a",
        { class: "role-btn role-btn--outline", href: "#/doctor/login" },
        h("span", { class: "role-btn__label" }, "I'm a doctor"),
        h("span", { class: "role-btn__sub" }, "Run your clinic")
      )
    );
  }

  renderFeatureStrip() {
    const features = [
      { icon: Icons.calendar, label: "Easy booking" },
      { icon: Icons.chat, label: "Secure messaging" },
      { icon: Icons.shield, label: "Verified doctors" },
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
        "By continuing, you agree to our Terms and Privacy Policy."
      )
    );
  }
}
