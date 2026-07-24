import { Component } from "../../../core/component.js";
import { h } from "../../../utils/dom.js";

export default class PatientRecords extends Component {
    render() {
        return h(
            "div",
            { class: "dashboard-page" },

            h("h1", { class: "dashboard-page__title" }, "Patient Records"),

            h(
                "div",
                { class: "dashboard-card" },

                h("h2", {}, "No patient records"),

                h(
                    "p",
                    { class: "dashboard-muted" },
                    "Patients you consult through KuraMedics will automatically appear here together with their consultation history and clinical records."
                )
            )
        );
    }
}
