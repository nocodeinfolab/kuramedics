// js/components/patient/TriageForm.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import api from "../../services/api.js";

const icon = (paths, size = 18) => h("svg", { viewBox: "0 0 24 24", fill: "none", width: String(size), height: String(size), "aria-hidden": "true" }, ...paths.map(d => h("path", { d, stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round" })));


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

const TYPING_DELAY_MS = 650;

export default class TriageForm extends Component {
    constructor(patient, onContinue) {
        super();
        this.patient = patient ?? {};
        this.onContinue = onContinue;

        this.steps = [CHIEF_COMPLAINT_STEP];
        this.stepIndex = 0;
        this.answers = {};
        this.currentInput = "";

        this.showingTyping = false; // typing-indicator bubble visible
        this.matching = false;
        this.submitting = false;
        this.error = "";
        this.result = null;

        this.matchedRedFlag = false;
        this.matchedRedFlagMessage = "";
        this.matchedSpecialization = null;
    }

    afterMount() {
        this.scrollToBottom();
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

        // Lock the answered question in immediately, then show a typing
        // beat before the next thing appears — this is what makes the
        // exchange feel conversational instead of instant/mechanical.
        this.showingTyping = true;
        this.update();

        if (isChiefComplaintStep) {
            await this.fetchFollowUpQuestions(trimmed);
            return;
        }

        await this.wait(TYPING_DELAY_MS);

        if (this.stepIndex < this.steps.length - 1) {
            this.stepIndex += 1;
            this.showingTyping = false;
            this.update();
            this.scrollToBottom();
        } else {
            this.showingTyping = false;
            this.submitTriage();
        }
    }

    async fetchFollowUpQuestions(chiefComplaintText) {
        this.matching = true;
        this.error = "";

        const [res] = await Promise.allSettled([
            api.post("/ai/match-symptom", { input: chiefComplaintText }),
            this.wait(TYPING_DELAY_MS),
        ]);

        this.matching = false;

        if (res.status !== "fulfilled") {
            console.error("Symptom match request failed:", res.reason);
            this.showingTyping = false;
            this.submitTriage();
            return;
        }

        const match = res.value.data || res.value;

        this.matchedRedFlag = !!match.red_flag;
        this.matchedRedFlagMessage = match.red_flag_message || "";
        this.matchedSpecialization = match.suggested_specialization || null;

        if (this.matchedRedFlag) {
            this.showingTyping = false;
            this.submitTriage();
            return;
        }

        const followUps = Array.isArray(match.follow_up_questions) ? match.follow_up_questions : [];
        this.steps = [CHIEF_COMPLAINT_STEP, ...followUps];
        this.stepIndex = 1;
        this.showingTyping = false;
        this.update();
        this.scrollToBottom();
    }

    goBackOneStep() {
        if (this.stepIndex === 0) return;
        this.stepIndex -= 1;
        this.currentInput = this.answers[this.steps[this.stepIndex].key] || "";
        this.update();
    }

    buildPatientAnswersText() {
        const parts = [];
        parts.push(this.answers.chief_complaint || "");

        this.steps.slice(1).forEach(step => {
            const answer = this.answers[step.key];
            if (answer && !/^(nothing else|none|no)$/i.test(answer.trim())) {
                parts.push(answer);
            }
        });

        return parts.filter(Boolean).join(". ");
    }

    /** Full Q&A transcript, including question wording — sent to the AI
     *  only, for richer context, never used for keyword/red-flag scanning. */
    buildTranscriptText() {
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
            const res = await api.post("/ai/reason-for-visit", {
                input: this.buildPatientAnswersText(),
                context: this.buildTranscriptText(),
            });
            this.result = res.data || res;

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
        this.showingTyping = false;
        this.matchedRedFlag = false;
        this.matchedRedFlagMessage = "";
        this.matchedSpecialization = null;
        this.result = null;
        this.error = "";
        this.update();
    }

    continueToDoctors() {
        if (typeof this.onContinue === "function") this.onContinue(this.result);
    }

    skipToAllDoctors() {
        if (typeof this.onContinue === "function") this.onContinue(null);
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    scrollToBottom() {
        requestAnimationFrame(() => {
            const scroller = this.el?.querySelector("#triage-transcript");
            if (scroller) scroller.scrollTop = scroller.scrollHeight;
        });
    }

    // ---------- Render ----------

    render() {
        return h(
            "div",
            { class: "triage-form" },
            this.renderHeader(),
            this.result ? this.renderResult() : this.renderConversation()
        );
    }

    renderHeader() {
        const name = this.doctorProfile?.full_name || this.doctor.full_name || "Doctor";
        return h(
            "section",
            { class: "dashboard-header patient-home" },
            h(
                "div",
                { class: "ph-hero" },
                h(
                    "button",
                    {
                        class: "ph-hero__back",
                        type: "button",
                        "aria-label": "Back",
                        onclick: () => this.onBack?.(),
                    },
                    icon(["M15 18l-6-6 6-6"], 18)
                ),
                h(
                    "div",
                    { class: "ph-hero__text" },
                    h("p", { class: "dashboard-greeting" }, "Book appointment"),
                    h("h1", { class: "dashboard-title" }, name)
                )
            )
        );
    }
    renderConversation() {
        if (this.submitting) return this.renderAnalyzing();

        return h(
            "div",
            { class: "tf-stack" },
            this.error ? this.renderError(this.error) : null,
            h(
                "div",
                { class: "tf-chat-card" },
                this.renderStepProgress(),
                h(
                    "div",
                    { id: "triage-transcript", class: "tf-transcript" },
                    this.steps.slice(0, this.stepIndex).map(step => this.renderExchangeBubble(step)),
                    this.showingTyping ? this.renderTypingIndicator() : null,
                    !this.showingTyping && !this.matching ? this.renderCurrentQuestionBubble() : null
                ),
                !this.showingTyping && !this.matching ? this.renderInputRow() : null
            ),
            this.stepIndex === 0 && !this.showingTyping
                ? h(
                      "button",
                      {
                          class: "tf-skip-btn",
                          type: "button",
                          onclick: () => this.skipToAllDoctors(),
                      },
                      icon(["M9 18l6-6-6-6"], 16),
                      h("span", null, "Skip — browse all doctors instead")
                  )
                : null
        );
    }

    renderAnalyzing() {
        return h(
            "div",
            { class: "tf-chat-card tf-analyzing" },
            h(
                "div",
                { class: "tf-analyzing-icon" },
                icon(["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"], 22)
            ),
            h("p", { class: "tf-analyzing-title" }, "Analyzing what you've told us"),
            h("p", { class: "tf-analyzing-text" }, "This will only take a moment."),
            h("div", { class: "tf-analyzing-bar" }, h("span"))
        );
    }

    renderError(message) {
        return h(
            "div",
            { class: "tf-alert tf-alert--danger", role: "alert" },
            h(
                "div",
                { class: "tf-alert-icon" },
                icon(["M12 9v4", "M12 17h.01", "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"], 18)
            ),
            h("p", { class: "tf-alert-text" }, message)
        );
    }

    renderStepProgress() {
        const total = this.steps.length > 1 ? this.steps.length : null;
        const label = total ? `Step ${Math.min(this.stepIndex + 1, total)} of ${total}` : "Step 1";
        return h("span", { class: "tf-step-pill" }, label);
    }

    renderExchangeBubble(step) {
        return h(
            "div",
            { class: "tf-exchange" },
            this.renderAiBubble(step.question),
            h(
                "div",
                { class: "tf-bubble-row tf-bubble-row--user tf-bubble-in" },
                h("div", { class: "tf-bubble tf-bubble--user" }, this.answers[step.key])
            )
        );
    }

    renderAiBubble(text) {
        return h(
            "div",
            { class: "tf-bubble-row tf-bubble-row--ai tf-bubble-in" },
            h(
                "div",
                { class: "tf-avatar tf-avatar--ai" },
                icon(["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"], 14)
            ),
            h("div", { class: "tf-bubble tf-bubble--ai" }, text)
        );
    }

    renderCurrentQuestionBubble() {
        return this.renderAiBubble(this.steps[this.stepIndex].question);
    }

    renderTypingIndicator() {
        return h(
            "div",
            { class: "tf-bubble-row tf-bubble-row--ai tf-bubble-in" },
            h(
                "div",
                { class: "tf-avatar tf-avatar--ai" },
                icon(["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"], 14)
            ),
            h(
                "div",
                { class: "tf-bubble tf-bubble--ai tf-bubble--typing" },
                h("span", { class: "tf-typing-dot" }),
                h("span", { class: "tf-typing-dot" }),
                h("span", { class: "tf-typing-dot" })
            )
        );
    }

    renderInputRow() {
        const step = this.steps[this.stepIndex];
        const isLastStep = this.stepIndex === this.steps.length - 1 && this.stepIndex > 0;

        return h(
            "div",
            { class: "tf-input-row" },
            h("textarea", {
                rows: 3,
                class: "tf-textarea",
                placeholder: step.placeholder,
                value: this.currentInput,
                oninput: e => {
                    this.setCurrentInput(e.target.value);
                    const nextBtn = this.el?.querySelector("[data-triage-next]");
                    if (nextBtn) nextBtn.disabled = !e.target.value.trim();
                },
            }),
            h(
                "div",
                { class: "tf-input-actions" },
                this.stepIndex > 0
                    ? h(
                          "button",
                          {
                              class: "tf-back-btn",
                              type: "button",
                              onclick: () => this.goBackOneStep(),
                          },
                          icon(["M15 18l-6-6 6-6"], 16),
                          h("span", null, "Back")
                      )
                    : null,
                h(
                    "button",
                    {
                        "data-triage-next": "true",
                        class: "tf-next-btn",
                        type: "button",
                        disabled: !this.currentInput.trim(),
                        onclick: () => this.advanceStep(),
                    },
                    h("span", null, isLastStep ? "Continue" : "Next"),
                    icon(["M5 12h14", "M12 5l7 7-7 7"], 16)
                )
            )
        );
    }

    // ---------- Result view (unchanged) ----------

    renderResult() {
        const result = this.result;
        const urgencyTone =
            result.urgency_level === "high" ? "danger"
            : result.urgency_level === "medium" ? "warning"
            : "success";
        const urgencyLabel = URGENCY_LABELS[result.urgency_level] || result.urgency_level;

        return h(
            "div",
            { class: "tf-stack" },
            result.red_flag ? this.renderRedFlag() : null,
            h(
                "div",
                { class: "tf-result-card" },
                h(
                    "div",
                    { class: "tf-result-header" },
                    h(
                        "div",
                        { class: "tf-result-spec" },
                        h("p", { class: "tf-result-label" }, "Suggested specialization"),
                        h("p", { class: "tf-result-value" }, result.suggested_specialization || "General Practice")
                    ),
                    h("span", { class: `tf-chip tf-chip--${urgencyTone}` }, urgencyLabel)
                ),
                result.symptoms?.length
                    ? h(
                          "div",
                          { class: "tf-result-block" },
                          h("p", { class: "tf-result-label" }, "Symptoms noted"),
                          h(
                              "div",
                              { class: "tf-tags" },
                              result.symptoms.map(symptom => h("span", { class: "tf-tag" }, symptom))
                          )
                      )
                    : null,
                h(
                    "div",
                    { class: "tf-result-block" },
                    h("p", { class: "tf-result-label" }, "Duration"),
                    h("p", { class: "tf-result-value-sm" }, result.duration || "Not clearly stated")
                ),
                h(
                    "div",
                    { class: "tf-result-block" },
                    h("p", { class: "tf-result-label" }, "Summary for your doctor"),
                    h("p", { class: "tf-result-value-sm" }, result.patient_summary || "")
                ),
                h(
                    "p",
                    { class: "tf-disclaimer" },
                    "This is an AI-assisted summary to help guide you to the right doctor. It is not a diagnosis."
                )
            ),
            h(
                "div",
                { class: "tf-actions" },
                h(
                    "button",
                    {
                        class: "tf-primary-btn",
                        type: "button",
                        onclick: () => this.continueToDoctors(),
                    },
                    icon(["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16", "M21 21l-4.35-4.35"], 16),
                    h("span", null, `Find ${result.suggested_specialization || "a"} doctors`)
                ),
                h(
                    "button",
                    {
                        class: "tf-secondary-btn",
                        type: "button",
                        onclick: () => this.startOver(),
                    },
                    icon(["M3 12a9 9 0 1 0 3-6.7L3 8", "M3 3v5h5"], 16),
                    h("span", null, "Start over")
                )
            )
        );
    }

    renderRedFlag() {
        return h(
            "div",
            { class: "tf-alert tf-alert--danger", role: "alert" },
            h(
                "div",
                { class: "tf-alert-icon" },
                icon(["M12 9v4", "M12 17h.01", "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"], 18)
            ),
            h(
                "div",
                { class: "tf-alert-body" },
                h("p", { class: "tf-alert-title" }, "Please read this first"),
                h(
                    "p",
                    { class: "tf-alert-text" },
                    this.result.red_flag_message || "This may be a medical emergency. Please seek urgent or emergency care."
                )
            )
        );
    }

    update() {
        if (!this.el) return;
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
        this.scrollToBottom();
    }
}
