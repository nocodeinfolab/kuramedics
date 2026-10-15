// js/components/patient/PatientProfilePage.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import api from "../../services/api.js";
import pushNotifications from "../../services/pushNotifications.js";

const icon = (paths, size = 18) => h("svg", { viewBox: "0 0 24 24", fill: "none", width: String(size), height: String(size), "aria-hidden": "true" }, ...paths.map(d => h("path", { d, stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round" })));

const GENDER_OPTIONS = [
    { value: "female", label: "Female" },
    { value: "male", label: "Male" },
    { value: "other", label: "Other" },
    { value: "prefer_not_to_say", label: "Prefer not to say" },
];
const BLOOD_GROUP_OPTIONS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Not sure"];

export default class PatientProfilePage extends Component {
    /**
     * @param {object} patient
     * @param {(updatedPatient: object) => void} onProfileUpdated - called
     *   after a successful save, so the dashboard shell (Home tab's nudge
     *   card, greeting name, etc.) can reflect the change without a reload.
     */
    constructor(patient, onProfileUpdated) {
        super();
        this.patient = patient ?? {};
        this.onProfileUpdated = onProfileUpdated;

        this.draft = {
            date_of_birth: this.patient.date_of_birth || "",
            gender: this.patient.gender || "",
            blood_group: this.patient.blood_group || "",
            allergies: this.patient.allergies || "",
            chronic_conditions: this.patient.chronic_conditions || "",
            phone_number: this.patient.phone_number || "",
            whatsapp_number: this.patient.whatsapp_number || "",
            address: this.patient.address || "",
            emergency_contact_name: this.patient.emergency_contact_name || "",
            emergency_contact_phone: this.patient.emergency_contact_phone || "",
        };

        this.saving = false;
        this.saveError = "";
        this.saveSuccess = false;
        this.loggingOut = false;
    }

    // ---------- Actions ----------

    setField(field, value) {
        this.draft = { ...this.draft, [field]: value };
        this.saveSuccess = false;
    }

    async saveProfile() {
        if (this.saving) return;

        if (!this.draft.date_of_birth || !this.draft.gender) {
            this.saveError = "Date of birth and gender are required.";
            this.update();
            return;
        }

        this.saving = true;
        this.saveError = "";
        this.saveSuccess = false;
        this.update();

        try {
            const res = await api.put("/patient-profile/me", this.draft);
            const updatedProfile = res.data || res;

            this.patient = updatedProfile;
            this.saveSuccess = true;

            if (typeof this.onProfileUpdated === "function") {
                this.onProfileUpdated(updatedProfile);
            }
        } catch (error) {
            console.error("Failed to save profile:", error);
            this.saveError = error.message || "Failed to save your details. Please try again.";
        } finally {
            this.saving = false;
            this.update();
        }
    }

    async logout() {
        if (this.loggingOut) return;
    
        this.loggingOut = true;
        this.update();
    
        try {
            await api.post("/auth/logout", {});
        } catch (error) {
            console.error("Logout request failed:", error);
        } finally {
            try {
                await pushNotifications.unregister();
            } catch (error) {
                console.error("Push unregister failed:", error);
            }
            api.clearSession();
        }
    }

    // ---------- Render ----------

    render() {
        const initial = (this.patient.full_name || "P").charAt(0).toUpperCase();

        return h(
            "div",
            { class: "patient-profile" },
            h(
                "section",
                { class: "dashboard-header patient-home" },
                h(
                    "div",
                    { class: "ph-hero" },
                    h("div", { class: "ph-hero__avatar" }, initial),
                    h(
                        "div",
                        { class: "ph-hero__text" },
                        h("p", { class: "dashboard-greeting" }, "Profile"),
                        h(
                            "h1",
                            { class: "dashboard-title" },
                            this.patient.full_name || "Your profile"
                        ),
                        h(
                            "p",
                            { class: "dashboard-subtitle" },
                            this.patient.email || ""
                        )
                    )
                )
            ),
            h(
                "div",
                { class: "pp-body" },
                this.renderAlerts(),
                this.renderMedicalCard(),
                this.renderContactCard(),
                this.renderEmergencyCard(),
                this.renderSaveBar(),
                this.renderAccountCard()
            )
        );
    }

    renderAlerts() {
        if (this.saveError) {
            return h(
                "div",
                { class: "pp-alert pp-alert--danger", role: "alert" },
                h(
                    "div",
                    { class: "pp-alert-icon" },
                    icon(["M12 9v4", "M12 17h.01", "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"], 18)
                ),
                h("p", { class: "pp-alert-text" }, this.saveError)
            );
        }
        if (this.saveSuccess) {
            return h(
                "div",
                { class: "pp-alert pp-alert--success", role: "status" },
                h(
                    "div",
                    { class: "pp-alert-icon" },
                    icon(["M20 6L9 17l-5-5"], 18)
                ),
                h("p", { class: "pp-alert-text" }, "Your profile has been updated.")
            );
        }
        return null;
    }

    renderField({ label, control }) {
        return h(
            "div",
            { class: "pp-field" },
            h("label", { class: "pp-label" }, label),
            control
        );
    }

    renderMedicalCard() {
        return h(
            "section",
            { class: "pp-card" },
            h("p", { class: "pp-section-eyebrow" }, "Medical information"),

            this.renderField({
                label: "Date of birth",
                control: h("input", {
                    type: "date",
                    class: "pp-input",
                    value: this.draft.date_of_birth,
                    oninput: e => this.setField("date_of_birth", e.target.value),
                }),
            }),

            this.renderField({
                label: "Gender",
                control: h(
                    "div",
                    { class: "pp-select-wrap" },
                    h(
                        "select",
                        {
                            class: "pp-select",
                            value: this.draft.gender,
                            onchange: e => this.setField("gender", e.target.value),
                        },
                        h("option", { value: "" }, "Select…"),
                        GENDER_OPTIONS.map(option =>
                            h("option", { value: option.value }, option.label)
                        )
                    ),
                    h("span", { class: "pp-select-chevron" }, icon(["M6 9l6 6 6-6"], 16))
                ),
            }),

            this.renderField({
                label: "Blood group",
                control: h(
                    "div",
                    { class: "pp-select-wrap" },
                    h(
                        "select",
                        {
                            class: "pp-select",
                            value: this.draft.blood_group,
                            onchange: e => this.setField("blood_group", e.target.value),
                        },
                        h("option", { value: "" }, "Not sure / skip"),
                        BLOOD_GROUP_OPTIONS.map(option =>
                            h("option", { value: option }, option)
                        )
                    ),
                    h("span", { class: "pp-select-chevron" }, icon(["M6 9l6 6 6-6"], 16))
                ),
            }),

            this.renderField({
                label: "Known allergies",
                control: h("input", {
                    type: "text",
                    class: "pp-input",
                    placeholder: "e.g. penicillin, peanuts — or leave blank if none",
                    value: this.draft.allergies,
                    oninput: e => this.setField("allergies", e.target.value),
                }),
            }),

            this.renderField({
                label: "Ongoing health conditions",
                control: h("input", {
                    type: "text",
                    class: "pp-input",
                    placeholder: "e.g. diabetes, hypertension — or leave blank if none",
                    value: this.draft.chronic_conditions,
                    oninput: e => this.setField("chronic_conditions", e.target.value),
                }),
            })
        );
    }

    renderContactCard() {
        return h(
            "section",
            { class: "pp-card" },
            h("p", { class: "pp-section-eyebrow" }, "Contact information"),

            this.renderField({
                label: "Phone number",
                control: h("input", {
                    type: "tel",
                    class: "pp-input",
                    inputmode: "tel",
                    placeholder: "e.g. 08012345678",
                    value: this.draft.phone_number,
                    oninput: e => this.setField("phone_number", e.target.value),
                }),
            }),

            this.renderField({
                label: "WhatsApp number",
                control: h("input", {
                    type: "tel",
                    class: "pp-input",
                    inputmode: "tel",
                    placeholder: "If different from phone number",
                    value: this.draft.whatsapp_number,
                    oninput: e => this.setField("whatsapp_number", e.target.value),
                }),
            }),

            this.renderField({
                label: "Address",
                control: h("textarea", {
                    rows: 2,
                    class: "pp-textarea",
                    value: this.draft.address,
                    oninput: e => this.setField("address", e.target.value),
                }),
            })
        );
    }

    renderEmergencyCard() {
        return h(
            "section",
            { class: "pp-card" },
            h("p", { class: "pp-section-eyebrow" }, "Emergency contact"),

            this.renderField({
                label: "Contact name",
                control: h("input", {
                    type: "text",
                    class: "pp-input",
                    value: this.draft.emergency_contact_name,
                    oninput: e => this.setField("emergency_contact_name", e.target.value),
                }),
            }),

            this.renderField({
                label: "Contact phone",
                control: h("input", {
                    type: "tel",
                    class: "pp-input",
                    inputmode: "tel",
                    value: this.draft.emergency_contact_phone,
                    oninput: e => this.setField("emergency_contact_phone", e.target.value),
                }),
            })
        );
    }

    renderSaveBar() {
        return h(
            "button",
            {
                class: "pp-submit",
                type: "button",
                disabled: this.saving,
                onclick: () => this.saveProfile(),
            },
            this.saving ? h("span", { class: "pp-spinner" }) : null,
            h("span", null, this.saving ? "Saving…" : "Save changes")
        );
    }

    renderAccountCard() {
        return h(
            "section",
            { class: "pp-account-card" },
            h(
                "div",
                { class: "pp-account-head" },
                h("p", { class: "pp-section-eyebrow" }, "Account"),
                h(
                    "p",
                    { class: "pp-account-text" },
                    "Signing out will end your session on this device."
                )
            ),
            h(
                "button",
                {
                    type: "button",
                    class: "pp-logout-btn",
                    disabled: this.loggingOut,
                    "aria-busy": String(this.loggingOut),
                    onclick: () => this.logout(),
                },
                this.loggingOut
                    ? h("span", { class: "pp-spinner pp-spinner--danger" })
                    : icon(["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17l5-5-5-5", "M21 12H9"], 16),
                h("span", null, this.loggingOut ? "Logging out…" : "Log out")
            )
        );
    }

    update() {
        if (!this.el) return;
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
    }
}
