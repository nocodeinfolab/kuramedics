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

const CHIEF_COMPLAINT_STEP = {
    key: "chief_complaint",
    question: "What's going on? Describe how you're feeling in your own words.",
    placeholder: "e.g. I've had a fever and sore throat...",
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

        // steps[0] is always the fixed chief-complaint question. Anything
        // after that is populated dynamically once matchSymptom() returns.
        this.steps = [CHIEF_COMPLAINT_STEP];
        this.stepIndex = 0;
        this.answers = {}; // key -> answer text, keyed by each step's `key`
        this.currentInput = "";

        this.matching = false; // fetching follow-up questions after step 1
        this.submitting = false; // final AI call after all steps answered
        this.error = "";
        this.result = null;

        // Set once matchSymptom() responds after the chief complaint.
        this.matchedRedFlag = false;
        this.matchedRedFlagMessage = "";
        this.matchedSpecialization = null;
    }

    // ---------- Actions ----------

    setCurrentInput(value) {
        this.currentInput = value;
    }

    async advanceStep() {
        const trimmed = this.currentInput.trim();
        if (!trimmed) return;

        const step = this.steps[this.stepIndex];
        this.answers[step.key] = trimmed;
        this.currentInput = "";

        const isChiefComplaintStep = this.stepIndex === 0;

        if (isChiefComplaintStep) {
            await this.fetchFollowUpQuestions(trimmed);
            return;
        }

        if (this.stepIndex < this.steps.length - 1) {
            this.stepIndex += 1;
            this.update();
        } else {
            this.submitTriage();
        }
    }

    async fetchFollowUpQuestions(chiefComplaintText) {
        this.matching = true;
        this.error = "";
        this.update();

        try {
            const res = await api.post("/ai/match-symptom", { input: chiefComplaintText });
            const match = res.data || res;

            this.matchedRedFlag = !!match.red_flag;
            this.matchedRedFlagMessage = match.red_flag_message || "";
            this.matchedSpecialization = match.suggested_specialization || null;

            if (this.matchedRedFlag) {
                // Emergency-pattern match — skip clerking entirely and go
                // straight to the final AI call so the red-flag result
                // (and its message) surfaces as quickly as possible.
                this.matching = false;
                this.submitTriage();
                return;
            }

            const followUps = Array.isArray(match.follow_up_questions) ? match.follow_up_questions : [];
            this.steps = [CHIEF_COMPLAINT_STEP, ...followUps];
            this.stepIndex = 1;
            this.matching = false;
            this.update();
        } catch (error) {
            console.error("Symptom match request failed:", error);
            // Non-fatal — fall back to submitting directly with just the
            // chief complaint rather than blocking the patient entirely.
            this.matching = false;
            this.submitTriage();
        }
    }

    goBackOneStep() {
        if (this.stepIndex === 0) return;
        this.stepIndex -= 1;
        this.currentInput = this.answers[this.steps[this.stepIndex].key] || "";
        this.update();
    }

    buildCombinedInput() {
        const parts = [];

        parts.push(this.answers.chief_complaint || "");

        this.steps.slice(1).forEach(step => {
            const answer = this.answers[step.key];
            if (answer && !/^(nothing else|none|no)$/i.test(answer.trim())) {
                parts.push(`${step.question} — ${answer}`);
            }
        });

        return parts.filter(Boolean).join(". ");
    }

    async submitTriage() {
        if (this.submitting) return;

        this.submitting = true;
        this.error = "";
        this.update();

        try {
            const res = await api.post("/ai/reason-for-visit", { input: this.buildCombinedInput() });
            this.result = res.data || res;

            // The knowledge-base red flag is the safety floor — if it fired,
            // make sure the result reflects that even if the AI call's own
            // read of urgency somehow differs.
            if (this.matchedRedFlag && !this.result.red_flag) {
                this.result.red_flag = true;
                this.result.red_flag_message = this.result.red_flag_message || this.matchedRedFlagMessage;
            }
        } catch (error) {
            console.error("Triage request failed:", error);
            this.error = error.message || "Something went wrong. Please try again.";
        } finally {
            this.submitting = false;
            this.update();
        }
    }

    startOver() {
        this.steps = [CHIEF_COMPLAINT_STEP];
        this.stepIndex = 0;
        this.answers = {};
        this.currentInput = "";
        this.matchedRedFlag = false;
        this.matchedRedFlagMessage = "";
        this.matchedSpecialization = null;
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
                    "A few quick questions to help us suggest the right type of doctor — this is a starting point, not a diagnosis."
                )
            ),
            this.result ? this.renderResult() : this.renderConversation()
        );
    }

    // ---------- Conversation view ----------

    renderConversation() {
        if (this.matching || this.submitting) {
            return h(
                "div",
                { class: "dashboard-card text-center py-4" },
                h("p", { class: "dashboard-muted" }, this.matching ? "One moment..." : "Analyzing what you've told us...")
            );
        }

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
                this.renderStepProgress(),
                h(
                    "div",
                    { style: "display: flex; flex-direction: column; gap: 10px;" },
                    this.steps.slice(0, this.stepIndex).map(step => this.renderAnsweredExchange(step)),
                    this.renderCurrentQuestion()
                )
            ),
            this.stepIndex === 0
                ? h(
                      "button",
                      {
                          class: "btn btn-outline",
                          style: "padding: 0.55rem 1rem; font-size: 0.85rem; border-radius: 8px;",
                          onclick: () => this.skipToAllDoctors(),
                      },
                      "Skip — browse all doctors instead"
                  )
                : null
        );
    }

    renderStepProgress() {
        // steps.length is only accurate once follow-ups have been fetched
        // (stepIndex >= 1); before that, just show that we're on step 1.
        const total = this.steps.length > 1 ? this.steps.length : null;

        return h(
            "p",
            { class: "dashboard-muted", style: "margin: 0; font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.03em;" },
            total ? `Step ${this.stepIndex + 1} of ${total}` : "Step 1"
        );
    }

    renderAnsweredExchange(step) {
        return h(
            "div",
            { style: "display: flex; flex-direction: column; gap: 6px;" },
            h(
                "div",
                {
                    style: "align-self: flex-start; max-width: 85%; padding: 0.6rem 0.85rem; border-radius: 12px; border-bottom-left-radius: 3px; background: var(--color-bg-muted, #f1f5f9); font-size: 0.86rem; line-height: 1.45;",
                },
                step.question
            ),
            h(
                "div",
                {
                    style: "align-self: flex-end; max-width: 85%; padding: 0.6rem 0.85rem; border-radius: 12px; border-bottom-right-radius: 3px; background: var(--color-primary, #0284c7); color: #fff; font-size: 0.86rem; line-height: 1.45;",
                },
                this.answers[step.key]
            )
        );
    }

    renderCurrentQuestion() {
        const step = this.steps[this.stepIndex];
        const isLastStep = this.stepIndex === this.steps.length - 1 && this.stepIndex > 0;
        const fieldInputStyle = "padding: 0.65rem 0.8rem; border: 1px solid var(--color-line); border-radius: 8px; width: 100%; font-size: 0.9rem; box-sizing: border-box; font-family: inherit; resize: vertical;";

        return h(
            "div",
            { style: "display: flex; flex-direction: column; gap: 8px;" },
            h(
                "div",
                {
                    style: "align-self: flex-start; max-width: 85%; padding: 0.6rem 0.85rem; border-radius: 12px; border-bottom-left-radius: 3px; background: var(--color-bg-muted, #f1f5f9); font-size: 0.86rem; line-height: 1.45;",
                },
                step.question
            ),
            h("textarea", {
                rows: 3,
                placeholder: step.placeholder,
                value: this.currentInput,
                style: fieldInputStyle,
                oninput: e => {
                    this.setCurrentInput(e.target.value);
                    const nextBtn = this.el?.querySelector("[data-triage-next]");
                    if (nextBtn) nextBtn.disabled = !e.target.value.trim();
                },
            }),
            h(
                "div",
                { style: "display: flex; gap: 8px;" },
                this.stepIndex > 0
                    ? h(
                          "button",
                          {
                              class: "btn btn-outline",
                              style: "padding: 0.55rem 1rem; font-size: 0.85rem; border-radius: 8px;",
                              onclick: () => this.goBackOneStep(),
                          },
                          "Back"
                      )
                    : null,
                h(
                    "button",
                    {
                        "data-triage-next": "true",
                        class: "btn btn-primary",
                        style: "padding: 0.55rem 1rem; font-size: 0.85rem; border-radius: 8px; flex: 1;",
                        disabled: !this.currentInput.trim(),
                        onclick: () => this.advanceStep(),
                    },
                    this.stepIndex === 0 ? "Next" : isLastStep ? "Continue" : "Next"
                )
            )
        );
    }

    // ---------- Result view (unchanged) ----------

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
