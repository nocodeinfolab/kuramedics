import { Component } from "../../core/component.js";
import { h, raw } from "../../utils/dom.js";
import { Navbar } from "../shared/Navbar.js";
import { Footer } from "../shared/Footer.js";

const PULSE_PATH =
  "M0,60 L110,60 L134,60 L150,20 L172,104 L192,60 L214,60 L228,40 L242,60 L400,60 L420,60 L444,60 L460,20 L482,104 L502,60 L524,60 L538,40 L552,60 L720,60";

/**
 * The public landing page. Its one job: get a patient into AI triage, or a
 * doctor into clinic setup, as fast as possible — everything else here
 * exists to build enough trust for that click.
 */
export class LandingPage extends Component {
  render() {
    const page = h(
      "div",
      { class: "page" },
      h("div", { id: "navbar-slot" }),
      h("main", {}, this.renderHero(), this.renderRoleSwitch(), this.renderTrustStrip(), this.renderHowItWorks(), this.renderDoctorSection(), this.renderFinalCta()),
      h("div", { id: "footer-slot" })
    );

    return page;
  }

  afterMount() {
    new Navbar().mount(this.el.querySelector("#navbar-slot"));
    new Footer().mount(this.el.querySelector("#footer-slot"));
  }

  renderHero() {
    return h(
      "section",
      { class: "hero" },
      h(
        "div",
        { class: "container hero__grid" },
        h(
          "div",
          { class: "hero__copy" },
          h("p", { class: "eyebrow" }, "Private clinics · verified doctors"),
          h(
            "h1",
            { class: "hero__title" },
            "Verified private care, one AI-guided step away."
          ),
          h(
            "p",
            { class: "hero__lead" },
            "KuraMedics matches patients with independently verified doctors nearby, and gives doctors everything they need to run a private clinic online — bookings, secure messaging, and payments, in one place."
          ),
          h(
            "div",
            { class: "hero__actions" },
            h(
              "a",
              { class: "btn btn-primary", href: "#get-started" },
              "Start AI triage"
            ),
            h(
              "a",
              { class: "btn btn-ghost", href: "#get-started" },
              "I'm a doctor"
            )
          )
        ),
        h(
          "div",
          { class: "hero__pulse", "aria-hidden": "true" },
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
          ),
          h(
            "div",
            { class: "hero__pulse-caption" },
            h("span", { class: "badge-dot", "aria-hidden": "true" }),
            h("span", {}, "Live triage · matches in minutes")
          )
        )
      )
    );
  }

  renderRoleSwitch() {
    return h(
      "section",
      { class: "roles", id: "get-started" },
      h(
        "div",
        { class: "container" },
        h("p", { class: "eyebrow roles__eyebrow" }, "Choose your path"),
        h(
          "div",
          { class: "roles__grid" },
          h(
            "article",
            { class: "role-card role-card--patient", id: "patients" },
            h("p", { class: "eyebrow" }, "For patients"),
            h("h2", { class: "role-card__title" }, "Find the right doctor, fast"),
            h(
              "p",
              { class: "role-card__body" },
              "Describe what's going on. Our AI triage narrows it down to specialty and urgency, then shows you verified doctors near you with fees up front."
            ),
            h(
              "ul",
              { class: "role-card__list" },
              h("li", {}, "AI-guided symptom triage"),
              h("li", {}, "Verified doctors near you"),
              h("li", {}, "Secure booking & payment")
            ),
            h(
              "a",
              { class: "btn btn-primary btn-block", href: "#get-started" },
              "Start AI triage"
            )
          ),
          h(
            "article",
            { class: "role-card role-card--doctor", id: "doctors" },
            h("p", { class: "eyebrow" }, "For doctors"),
            h(
              "h2",
              { class: "role-card__title" },
              "Run your private clinic online"
            ),
            h(
              "p",
              { class: "role-card__body" },
              "Get verified, set your own fees and hours, and manage bookings, records, and payments — without hospital overhead."
            ),
            h(
              "ul",
              { class: "role-card__list" },
              h("li", {}, "MDCN verification built in"),
              h("li", {}, "Your schedule, your fees"),
              h("li", {}, "Payments settled to you directly")
            ),
            h(
              "a",
              { class: "btn btn-primary btn-block", href: "#get-started" },
              "Set up your clinic"
            )
          )
        )
      )
    );
  }

  renderTrustStrip() {
    const items = [
      "MDCN-verified doctors",
      "Encrypted patient records",
      "Secure NGN payments",
    ];

    return h(
      "section",
      { class: "trust" },
      h(
        "div",
        { class: "container trust__row" },
        items.map((label) =>
          h(
            "div",
            { class: "trust__item" },
            h("span", { class: "badge-dot", "aria-hidden": "true" }),
            h("span", { class: "trust__label" }, label)
          )
        )
      )
    );
  }

  renderHowItWorks() {
    const steps = [
      {
        n: "01",
        title: "Describe your symptoms",
        body: "AI triage sorts urgency and points you to the right specialty in under a minute.",
      },
      {
        n: "02",
        title: "Get matched nearby",
        body: "See verified, independent doctors close to you, with consultation fees shown up front.",
      },
      {
        n: "03",
        title: "Book and consult securely",
        body: "Pay through the platform, message your doctor, and keep your records in one place.",
      },
    ];

    return h(
      "section",
      { class: "how", id: "how-it-works" },
      h(
        "div",
        { class: "container" },
        h(
          "div",
          { class: "how__head" },
          h("p", { class: "eyebrow" }, "For patients"),
          h("h2", { class: "how__title" }, "How KuraMedics works")
        ),
        h(
          "ol",
          { class: "how__steps" },
          steps.map((step) =>
            h(
              "li",
              { class: "how__step" },
              h("span", { class: "how__step-n" }, step.n),
              h("h3", { class: "how__step-title" }, step.title),
              h("p", { class: "how__step-body" }, step.body)
            )
          )
        )
      )
    );
  }

  renderDoctorSection() {
    const features = [
      {
        title: "Verification & trust",
        body: "MDCN registration is checked before your profile goes live, so patients know you're real.",
      },
      {
        title: "Your schedule, your fees",
        body: "Set consultation and follow-up pricing per service. Available or not — you decide.",
      },
      {
        title: "Secure messaging & records",
        body: "Message paid patients, share results, and keep the clinical record in one thread.",
      },
      {
        title: "Clear financial summary",
        body: "See earnings, commission, and payouts without digging through spreadsheets.",
      },
    ];

    return h(
      "section",
      { class: "doctor-panel" },
      h(
        "div",
        { class: "container doctor-panel__inner" },
        h(
          "div",
          { class: "doctor-panel__intro" },
          h("p", { class: "eyebrow eyebrow--inverted" }, "For doctors"),
          h(
            "h2",
            { class: "doctor-panel__title" },
            "A private clinic, without the overhead"
          ),
          h(
            "p",
            { class: "doctor-panel__lead" },
            "KuraMedics handles discovery, booking, and payments so you can focus on the consultation."
          ),
          h(
            "a",
            { class: "btn btn-primary", href: "#get-started" },
            "Set up your clinic"
          )
        ),
        h(
          "div",
          { class: "doctor-panel__grid" },
          features.map((feature) =>
            h(
              "div",
              { class: "doctor-feature" },
              h("h3", { class: "doctor-feature__title" }, feature.title),
              h("p", { class: "doctor-feature__body" }, feature.body)
            )
          )
        )
      )
    );
  }

  renderFinalCta() {
    return h(
      "section",
      { class: "final-cta" },
      h(
        "div",
        { class: "container final-cta__inner" },
        h("h2", { class: "final-cta__title" }, "Ready to begin?"),
        h(
          "p",
          { class: "final-cta__body" },
          "Whether you need care or you're building your clinic, it starts here."
        ),
        h(
          "div",
          { class: "final-cta__actions" },
          h(
            "a",
            { class: "btn btn-primary", href: "#get-started" },
            "Start AI triage"
          ),
          h(
            "a",
            { class: "btn btn-ghost btn-ghost--on-dark", href: "#get-started" },
            "I'm a doctor"
          )
        )
      )
    );
  }
}
