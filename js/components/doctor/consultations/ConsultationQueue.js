import { Component } from "../../../core/component.js";
import { h } from "../../../utils/dom.js";

export default class ConsultationQueue extends Component {
    render() {
        return h(
            "div",
            { class: "dashboard-page" },

            h("h1", { class: "dashboard-page__title" }, "Consultation Queue"),

            h(
                "div",
                { class: "dashboard-card" },

                h("h2", {}, "No consultations yet"),

                h(
                    "p",
                    { class: "dashboard-muted" },
                    "Booked consultations will appear here. You'll be able to accept appointments, review patient information and start consultations."
                )
            )
        );
    }
}
