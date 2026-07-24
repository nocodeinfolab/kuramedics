import { Component } from "../../../core/component.js";
import { h } from "../../../utils/dom.js";

export default class ConsultationQueue extends Component {
    render() {
        return h(
            "div",
            { class: "page-placeholder" },

            h("h2", {}, "Consultation Queue"),

            h(
                "p",
                {},
                "This page is under construction."
            )
        );
    }
}
