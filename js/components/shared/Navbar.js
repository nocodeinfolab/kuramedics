import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";

/**
 * Site navbar for the public (logged-out) side of the app. Mobile-first:
 * collapses into a hamburger-triggered panel below a breakpoint handled
 * entirely in CSS via the `.is-open` class this component toggles.
 */
export class Navbar extends Component {
  constructor(props = {}) {
    super(props);
    this.isOpen = false;
  }

  render() {
    return h(
      "header",
      { class: "nav" },
      h(
        "div",
        { class: "container nav__bar" },
        h(
          "a",
          { class: "nav__brand", href: "#/", onClick: () => this.close() },
          h("span", { class: "nav__brand-mark", "aria-hidden": "true" }),
          h("span", {}, "KuraMedics")
        ),
        h(
          "nav",
          { class: "nav__links", id: "primary-nav" },
          h("a", { class: "nav__link", href: "#patients" }, "For patients"),
          h("a", { class: "nav__link", href: "#doctors" }, "For doctors"),
          h("a", { class: "nav__link", href: "#how-it-works" }, "How it works"),
          h(
            "div",
            { class: "nav__actions" },
            h(
              "a",
              { class: "btn btn-ghost btn-sm", href: "#get-started" },
              "Log in"
            ),
            h(
              "a",
              { class: "btn btn-primary btn-sm", href: "#get-started" },
              "Get started"
            )
          )
        ),
        h(
          "button",
          {
            class: "nav__toggle",
            type: "button",
            "aria-expanded": "false",
            "aria-controls": "primary-nav",
            onClick: (event) => this.toggle(event.currentTarget),
          },
          h("span", { class: "sr-only" }, "Toggle menu"),
          h("span", { class: "nav__toggle-bar", "aria-hidden": "true" }),
          h("span", { class: "nav__toggle-bar", "aria-hidden": "true" }),
          h("span", { class: "nav__toggle-bar", "aria-hidden": "true" })
        )
      )
    );
  }

  toggle(button) {
    this.isOpen = !this.isOpen;
    this.el.classList.toggle("is-open", this.isOpen);
    button.setAttribute("aria-expanded", String(this.isOpen));
  }

  close() {
    this.isOpen = false;
    this.el?.classList.remove("is-open");
  }

  afterMount() {
    // Close the mobile panel whenever a nav link is followed.
    this.el.querySelectorAll(".nav__link, .nav__actions a").forEach((link) => {
      link.addEventListener("click", () => this.close());
    });
  }
}
