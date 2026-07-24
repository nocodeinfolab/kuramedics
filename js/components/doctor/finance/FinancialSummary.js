import { Component } from "../../../core/component.js";
import { h } from "../../../utils/dom.js";

export default class FinancialSummary extends Component {
    render() {
        return h(
            "div",
            { class: "dashboard-page" },

            h("h1", { class: "dashboard-page__title" }, "Financial Summary"),

            h(
                "div",
                { class: "dashboard-card" },

                h("h2", {}, "No financial activity"),

                h(
                    "p",
                    { class: "dashboard-muted" },
                    "Your consultation earnings, payouts, platform commission and transaction history will appear here."
                )
            )
        );
    }
}
