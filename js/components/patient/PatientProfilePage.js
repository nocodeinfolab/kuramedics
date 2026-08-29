// js/components/patient/PatientProfilePage.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import api from "../../services/api.js";
import pushNotifications from "../../services/pushNotifications.js";

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
        try {
            await api.post("/auth/logout", {});
        } catch (error) {
            console.error("Logout request failed:", error);
        } finally {
            await pushNotifications.unregister(); 
            api.clearSession();
        }
    }

    // ---------- Render ----------

    render() {
        const fieldLabelStyle = "display: block; margin-bottom: 5px; font-size: 0.82rem; font-weight: 600;";
        const fieldInputStyle = "padding: 0.6rem 0.7rem; border: 1px solid var(--color-line); border-radius: 6px; width: 100%; font-size: 0.9rem; box-sizing: border-box; font-family: inherit;";

        return h(
            "div",
            { class: "dashboard-page" },
            h(
                "section",
                { class: "dashboard-header" },
                h("p", { class: "dashboard-greeting" }, "Profile"),
                h("h1", { class: "dashboard-title" }, this.patient.full_name || "Your Profile"),
                h("p", { class: "dashboard-subtitle" }, this.patient.email || "")
            ),

            h(
                "div",
                { class: "services-list" },

                this.saveError
                    ? h(
                          "div",
                          { class: "dashboard-card", style: "border-left: 4px solid #ef4444;" },
                          h("p", { style: "color: #ef4444; margin: 0;" }, this.saveError)
                      )
                    : null,

                this.saveSuccess
                    ? h(
                          "div",
                          { class: "dashboard-card", style: "border-left: 4px solid #10b981;" },
                          h("p", { style: "color: #10b981; margin: 0;" }, "Your profile has been updated.")
                      )
                    : null,

                // ---------- Medical info ----------
                h(
                    "div",
                    { class: "dashboard-card", style: "padding: 1.1rem; display: flex; flex-direction: column; gap: 14px;" },
                    h("p", { class: "dashboard-muted", style: "margin: 0; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.03em;" }, "Medical Information"),

                    h(
                        "div",
                        {},
                        h("label", { style: fieldLabelStyle }, "Date of birth"),
                        h("input", {
                            type: "date",
                            value: this.draft.date_of_birth,
                            style: fieldInputStyle,
                            oninput: e => this.setField("date_of_birth", e.target.value),
                        })
                    ),

                    h(
                        "div",
                        {},
                        h("label", { style: fieldLabelStyle }, "Gender"),
                        h(
                            "select",
                            {
                                value: this.draft.gender,
                                style: fieldInputStyle,
                                onchange: e => this.setField("gender", e.target.value),
                            },
                            h("option", { value: "" }, "Select..."),
                            GENDER_OPTIONS.map(option =>
                                h("option", { value: option.value }, option.label)
                            )
                        )
                    ),

                    h(
                        "div",
                        {},
                        h("label", { style: fieldLabelStyle }, "Blood group"),
                        h(
                            "select",
                            {
                                value: this.draft.blood_group,
                                style: fieldInputStyle,
                                onchange: e => this.setField("blood_group", e.target.value),
                            },
                            h("option", { value: "" }, "Not sure / skip"),
                            BLOOD_GROUP_OPTIONS.map(option =>
                                h("option", { value: option }, option)
                            )
                        )
                    ),

                    h(
                        "div",
                        {},
                        h("label", { style: fieldLabelStyle }, "Known allergies"),
                        h("input", {
                            type: "text",
                            placeholder: "e.g. penicillin, peanuts — or leave blank if none",
                            value: this.draft.allergies,
                            style: fieldInputStyle,
                            oninput: e => this.setField("allergies", e.target.value),
                        })
                    ),

                    h(
                        "div",
                        {},
                        h("label", { style: fieldLabelStyle }, "Ongoing health conditions"),
                        h("input", {
                            type: "text",
                            placeholder: "e.g. diabetes, hypertension — or leave blank if none",
                            value: this.draft.chronic_conditions,
                            style: fieldInputStyle,
                            oninput: e => this.setField("chronic_conditions", e.target.value),
                        })
                    )
                ),

                // ---------- Contact info ----------
                h(
                    "div",
                    { class: "dashboard-card", style: "padding: 1.1rem; display: flex; flex-direction: column; gap: 14px;" },
                    h("p", { class: "dashboard-muted", style: "margin: 0; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.03em;" }, "Contact Information"),

                    h(
                        "div",
                        {},
                        h("label", { style: fieldLabelStyle }, "Phone number"),
                        h("input", {
                            type: "tel",
                            placeholder: "e.g. 08012345678",
                            value: this.draft.phone_number,
                            style: fieldInputStyle,
                            oninput: e => this.setField("phone_number", e.target.value),
                        })
                    ),

                    h(
                        "div",
                        {},
                        h("label", { style: fieldLabelStyle }, "WhatsApp number"),
                        h("input", {
                            type: "tel",
                            placeholder: "If different from phone number",
                            value: this.draft.whatsapp_number,
                            style: fieldInputStyle,
                            oninput: e => this.setField("whatsapp_number", e.target.value),
                        })
                    ),

                    h(
                        "div",
                        {},
                        h("label", { style: fieldLabelStyle }, "Address"),
                        h("textarea", {
                            rows: 2,
                            value: this.draft.address,
                            style: `${fieldInputStyle} resize: vertical;`,
                            oninput: e => this.setField("address", e.target.value),
                        })
                    )
                ),

                // ---------- Emergency contact ----------
                h(
                    "div",
                    { class: "dashboard-card", style: "padding: 1.1rem; display: flex; flex-direction: column; gap: 14px;" },
                    h("p", { class: "dashboard-muted", style: "margin: 0; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.03em;" }, "Emergency Contact"),

                    h(
                        "div",
                        {},
                        h("label", { style: fieldLabelStyle }, "Contact name"),
                        h("input", {
                            type: "text",
                            value: this.draft.emergency_contact_name,
                            style: fieldInputStyle,
                            oninput: e => this.setField("emergency_contact_name", e.target.value),
                        })
                    ),

                    h(
                        "div",
                        {},
                        h("label", { style: fieldLabelStyle }, "Contact phone"),
                        h("input", {
                            type: "tel",
                            value: this.draft.emergency_contact_phone,
                            style: fieldInputStyle,
                            oninput: e => this.setField("emergency_contact_phone", e.target.value),
                        })
                    )
                ),

                h(
                    "button",
                    {
                        class: "btn btn-primary",
                        style: "padding: 0.65rem 1rem; font-size: 0.9rem; border-radius: 8px;",
                        disabled: this.saving,
                        onclick: () => this.saveProfile(),
                    },
                    this.saving ? "Saving..." : "Save changes"
                ),

                // ---------- Account ----------
                h(
                    "div",
                    { class: "dashboard-card", style: "padding: 1.1rem;" },
                    h("p", { class: "dashboard-muted", style: "margin: 0 0 10px; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.03em;" }, "Account"),
                    h(
                        "button",
                        {
                            class: "btn btn-outline",
                            style: "padding: 0.55rem 1rem; font-size: 0.85rem; border-radius: 8px; color: #ef4444; border-color: #ef4444;",
                            onclick: () => this.logout(),
                        },
                        "Log out"
                    )
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
