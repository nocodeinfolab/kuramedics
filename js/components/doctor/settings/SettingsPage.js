import { Component } from "../../../core/component.js";
import { h } from "../../../utils/dom.js";

export default class SettingsPage extends Component {
    render() {
        return h(
            "div",
            { class: "dashboard-page" },

            h("h1", { class: "dashboard-page__title" }, "Settings"),

            h(
                "div",
                { class: "dashboard-card" },

                h("h2", {}, "Account Settings"),

                h(
                    "p",
                    { class: "dashboard-muted" },
                    "Manage your profile, consultation fees, availability, subscription, booking link, notifications and security settings."
                )
            )
        );
    }
}
