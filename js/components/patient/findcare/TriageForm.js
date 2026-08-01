// js/components/patient/TriageForm.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import api from "../../services/api.js";

const URGENCY_LABELS = {
    low: "Low urgency",
    medium: "Medium urgency",
    high: "High urgency",
};

const URGENCY_COLORS = {
    low: "#10b981",
    medium: "#f59e0b",
    high: "#ef4444",
};

export default class TriageForm extends Component {
    /**
     * @param {object} patient
     * @param {(result: object|null) => void} onContinue - called with the
     *   triage result when the patient proceeds to browse doctors, or with
     *   null if they choose to skip triage and browse everyone.
     */
    constructor(patient, onContinue) {
        super();
        this.patient = patient ?? {};
        this.onContinue = onContinue;

        this.inputText = "";
        this.submitting = false;
        this.error = "";
        this.result = null;
    }

    // ---------- Actions ----------

    setInputText(value) {
        this.inputText = value;
    }

    async submitTriage() {
        const trimmed = this.inputText.trim();
        if (!trimmed || this.submitting) return;

        this.submitting = true;
        this.error = "";
        this.update();

        try {
            const res = await api.post("/ai/reason-for-visit", { input: trimmed });
            this.result = res.data || res;
        } catch (error) {
            console.error("Triage request failed:", error);
            this.error = error.message || "Something went wrong. Please try again.";
        } finally {
            this.submitting = false;
            this.update();
        }
    }

    startOver() {
        this.result = null;
        this.error = "";
        this.update();
    }

    continueToDoctors() {
        if (typeof this.onContinue === "function") {
            this.onContinue(this.result);
        }
    }

    skipToAllDoctors() {
        if (typeof this.onContinue === "function") {
            this.onContinue(null);
        }
    }

    // ---------- Render ----------

    render() {
        return h(
            "div",
            { class: "dashboard-page" },
            h(
                "section",
                { class: "dashboard-header" },
                h("p", { class: "dashboard-greeting" }, "Find Care"),
                h("h1", { class: "dashboard-title" }, "Tell us what's going on"),
                h(
                    "p",
                    { class: "dashboard-subtitle" },
                    "Describe your symptoms in your own words. This helps us suggest the right type of doctor — it's a starting point, not a diagnosis."
                )
            ),
            this.result ? this.renderResult() : this.renderInputForm()
        );
    }

    renderInputForm() {
        const fieldInputStyle = "padding: 0.7rem 0.8rem; border: 1px solid var(--color-line); border-radius: 8px; width: 100%; font-size: 0.92rem; box-sizing: border-box; font-family: inherit; resize: vertical;";

        return h(
            "div",
            { class: "services-list" },
            this.error
                ? h(
                      "div",
                      { class: "dashboard-card", style: "border-left: 4px solid #ef4444; margin-bottom: var(--space-3);" },
                      h("p", { style: "color: #ef4444; margin: 0;" }, this.error)
                  )
                : null,
            h(
                "div",
                { class: "dashboard-card", style: "padding: 1.1rem; display: flex; flex-direction: column; gap: 12px;" },
                h("textarea", {
                    rows: 5,
                    placeholder: "e.g. I've had a fever and sore throat for 3 days, and it's getting worse...",
                    value: this.inputText,
                    style: fieldInputStyle,
                    disabled: this.submitting,
                    oninput: e => this.setInputText(e.target.value),
                }),
                h(
                    "button",
                    {
                        class: "btn btn-primary",
                        style: "padding: 0.65rem 1rem; font-size: 0.9rem; border-radius: 8px;",
                        disabled: this.submitting || !this.inputText.trim(),
                        onclick: () => this.submitTriage(),
                    },
                    this.submitting ? "Analyzing..." : "Continue"
                ),
                h(
                    "button",
                    {
                        class: "btn btn-outline",
                        style: "padding: 0.55rem 1rem; font-size: 0.85rem; border-radius: 8px;",
                        disabled: this.submitting,
                        onclick: () => this.skipToAllDoctors(),
                    },
                    "Skip — browse all doctors instead"
                )
            )
        );
    }

    renderResult() {
        const result = this.result;
        const urgencyColor = URGENCY_COLORS[result.urgency_level] || URGENCY_COLORS.low;
        const urgencyLabel = URGENCY_LABELS[result.urgency_level] || result.urgency_level;

        return h(
            "div",
            { class: "services-list" },

            result.red_flag
                ? h(
                      "div",
                      {
                          class: "dashboard-card",
                          style: "border-left: 4px solid #ef4444; background: rgba(239,68,68,0.06); padding: 1rem 1.1rem;",
                      },
                      h(
                          "p",
                          { style: "margin: 0 0 4px; font-size: 0.8rem; font-weight: 700; color: #ef4444; text-transform: uppercase; letter-spacing: 0.03em;" },
                          "Please read this first"
                      ),
                      h(
                          "p",
                          { style: "margin: 0; font-size: 0.9rem; line-height: 1.5;" },
                          result.red_flag_message || "This may be a medical emergency. Please seek urgent or emergency care."
                      )
                  )
                : null,

            h(
                "div",
                { class: "dashboard-card", style: "padding: 1.1rem; display: flex; flex-direction: column; gap: 14px;" },

                h(
                    "div",
                    { style: "display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;" },
                    h(
                        "div",
                        {},
                        h("p", { class: "dashboard-muted", style: "margin: 0 0 4px; font-size: 0.78rem;" }, "Suggested specialization"),
                        h("p", { style: "margin: 0; font-size: 1.05rem; font-weight: 600;" }, result.suggested_specialization || "General Practice")
                    ),
                    h(
                        "span",
                        {
                            class: "dashboard-badge",
                            style: `background: ${urgencyColor}; font-size: 0.7rem; padding: 3px 9px; border-radius: 5px; white-space: nowrap; flex-shrink: 0;`,
                        },
                        urgencyLabel
                    )
                ),

                result.symptoms?.length
                    ? h(
                          "div",
                          {},
                          h("p", { class: "dashboard-muted", style: "margin: 0 0 6px; font-size: 0.78rem;" }, "Symptoms noted"),
                          h(
                              "div",
                              { style: "display: flex; flex-wrap: wrap; gap: 6px;" },
                              result.symptoms.map(symptom =>
                                  h(
                                      "span",
                                      {
                                          style: "font-size: 0.76rem; padding: 3px 9px; border-radius: 10px; background: var(--color-bg-muted, #f1f5f9); color: var(--color-ink-faint, #64748b);",
                                      },
                                      symptom
                                  )
                              )
                          )
                      )
                    : null,

                h(
                    "div",
                    {},
                    h("p", { class: "dashboard-muted", style: "margin: 0 0 4px; font-size: 0.78rem;" }, "Duration"),
                    h("p", { style: "margin: 0; font-size: 0.88rem;" }, result.duration || "Not clearly stated")
                ),

                h(
                    "div",
                    {},
                    h("p", { class: "dashboard-muted", style: "margin: 0 0 4px; font-size: 0.78rem;" }, "Summary for your doctor"),
                    h("p", { style: "margin: 0; font-size: 0.88rem; line-height: 1.5;" }, result.patient_summary || "")
                ),

                h(
                    "p",
                    { class: "dashboard-muted", style: "margin: 0; font-size: 0.72rem; font-style: italic;" },
                    "This is an AI-assisted summary to help guide you to the right doctor. It is not a diagnosis."
                )
            ),

            h(
                "div",
                { style: "display: flex; flex-direction: column; gap: 8px;" },
                h(
                    "button",
                    {
                        class: "btn btn-primary",
                        style: "padding: 0.65rem 1rem; font-size: 0.9rem; border-radius: 8px;",
                        onclick: () => this.continueToDoctors(),
                    },
                    `Find ${result.suggested_specialization || "a"} doctors`
                ),
                h(
                    "button",
                    {
                        class: "btn btn-outline",
                        style: "padding: 0.55rem 1rem; font-size: 0.85rem; border-radius: 8px;",
                        onclick: () => this.startOver(),
                    },
                    "Start over"
                )
            )
        );
    }

    update() {
        if (!this.el) return;
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
    }
}
