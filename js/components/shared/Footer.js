import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";

export class Footer extends Component {
  render() {
    const year = new Date().getFullYear();

    return h(
      "footer",
      { class: "footer" },
      h(
        "div",
        { class: "container footer__grid" },
        h(
          "div",
          { class: "footer__brand" },
          h(
            "a",
            { class: "nav__brand", href: "#/" },
            h("span", { class: "nav__brand-mark", "aria-hidden": "true" }),
            h("span", {}, "KuraMedics")
          ),
          h(
            "p",
            { class: "footer__tagline" },
            "Verified private care, coordinated online."
          )
        ),
        h(
          "div",
          { class: "footer__col" },
          h("p", { class: "footer__heading" }, "Patients"),
          h(
            "ul",
            {},
            h("li", {}, h("a", { href: "#get-started" }, "Start AI triage")),
            h("li", {}, h("a", { href: "#get-started" }, "Find a doctor")),
            h("li", {}, h("a", { href: "#get-started" }, "Log in"))
          )
        ),
        h(
          "div",
          { class: "footer__col" },
          h("p", { class: "footer__heading" }, "Doctors"),
          h(
            "ul",
            {},
            h("li", {}, h("a", { href: "#get-started" }, "Get verified")),
            h("li", {}, h("a", { href: "#get-started" }, "Set up your clinic")),
            h("li", {}, h("a", { href: "#get-started" }, "Doctor log in"))
          )
        ),
        h(
          "div",
          { class: "footer__col" },
          h("p", { class: "footer__heading" }, "Company"),
          h(
            "ul",
            {},
            h("li", {}, h("a", { href: "#how-it-works" }, "How it works")),
            h("li", {}, h("a", { href: "#" }, "Privacy")),
            h("li", {}, h("a", { href: "#" }, "Terms"))
          )
        )
      ),
      h(
        "div",
        { class: "container footer__bottom" },
        h("p", {}, `© ${year} KuraMedics. All rights reserved.`),
        h(
          "p",
          { class: "footer__note" },
          "Not for medical emergencies. If this is an emergency, contact local emergency services."
        )
      )
    );
  }
}
