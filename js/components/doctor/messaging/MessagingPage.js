import { Component } from "../../../core/component.js";
import { h } from "../../../utils/dom.js";

export default class MessagingPage extends Component {
    render() {
        return h(
            "div",
            { class: "dashboard-page" },

            h("h1", { class: "dashboard-page__title" }, "Secure Messaging"),

            h(
                "div",
                { class: "dashboard-card" },

                h("h2", {}, "No conversations"),

                h(
                    "p",
                    { class: "dashboard-muted" },
                    "Patients you've consulted will be able to securely message you here."
                )
            )
        );
    }
}
