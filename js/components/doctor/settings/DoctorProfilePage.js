// js/components/doctor/settings/DoctorProfilePage.js

import { Component } from "../../../core/component.js";
import { h } from "../../../utils/dom.js";
import doctorProfileService from "../../../services/doctorProfileService.js";

export default class DoctorProfilePage extends Component {

    constructor(doctor = {}, onBack = () => {}) {

        super();

        this.onBack = onBack;

        this.loading = true;
        this.saving = false;
        this.uploadingAvatar = false;
        this.saveError = null;
        this.saveSuccess = false;

        this.profile = {
            full_name: "",
            specialization: "",
            bio: "",
            years_of_experience: "",
            phone_number: "",
            mdcn_registration_number: "",
            consultation_fee: "",
            follow_up_fee: "",
            currency: "NGN",
            avatar_url: null,
            verification_status: "unsubmitted",
            doctor_terms_accepted_at: null,

            // Seed from whatever the dashboard already loaded, so the
            // page doesn't flash empty before loadProfile() resolves.
            ...doctor
        };

    }

    render() {

        return h(
            "div",
            {
                class: "dashboard-page"
            },

            this.renderHero(),

            this.loading
                ? this.renderLoading()
                : this.renderForm()

        );

    }

    afterMount() {

        this.loadProfile();

    }

    async loadProfile() {

        try {

            const result = await doctorProfileService.getProfile();

            this.profile = {
                ...this.profile,
                ...result.data
            };

        }

        catch (error) {

            console.error(error);

            alert("Unable to load profile.");

        }

        finally {

            this.loading = false;
            this.update();

        }

    }

    renderLoading() {

        return h(
            "div",
            {
                class: "dashboard-card"
            },
            h("p", {}, "Loading profile...")
        );

    }

    renderHero() {

        return h(
            "section",
            {
                class: "dashboard-header"
            },

            h(
                "button",
                {
                    class: "btn btn-outline",
                    onclick: () => this.onBack()
                },
                "← Back to Settings"
            ),

            h("p", { class: "dashboard-greeting" }, "Doctor Profile"),
            h("h1", { class: "dashboard-title" }, "Complete Your Profile"),
            h(
                "p",
                { class: "dashboard-subtitle" },
                "Patients see the information you provide here."
            ),

            h(
                "div",
                { class: "dashboard-hero-meta" },
                h(
                    "span",
                    { class: "dashboard-badge" },
                    this.formatVerificationStatus(this.profile.verification_status)
                )
            )

        );

    }

    renderForm() {

        return h(
            "div",

            this.renderAvatarCard(),
            this.renderPersonalInfoCard(),
            this.renderProfessionalInfoCard(),
            this.renderContactCard(),
            this.renderPricingCard(),
            this.renderTermsCard(),
            this.renderActions()

        );

    }

    renderAvatarCard() {

        const avatar = this.profile.avatar_url;

        const fileInput = h(
            "input",
            {
                type: "file",
                accept: "image/*",
                style: "display:none",
                onchange: e => this.handleAvatarChange(e)
            }
        );

        return h(
            "div",
            { class: "dashboard-card" },

            avatar
                ? h(
                    "img",
                    {
                        class: "settings-profile-avatar",
                        src: avatar,
                        alt: "Doctor Avatar"
                    }
                )
                : h(
                    "div",
                    { class: "settings-profile-avatar settings-profile-avatar--placeholder" },
                    this.profile.full_name ? this.profile.full_name.charAt(0) : "D"
                ),

            fileInput,

            h(
                "button",
                {
                    class: "btn btn-outline",
                    disabled: this.uploadingAvatar,
                    onclick: () => fileInput.click()
                },
                this.uploadingAvatar ? "Uploading..." : "Change Photo"
            )

        );

    }

    async handleAvatarChange(e) {

        const file = e.target.files?.[0];
        if (!file) return;

        this.uploadingAvatar = true;
        this.update();

        try {

            const result = await doctorProfileService.uploadAvatar(file);

            this.profile.avatar_url =
                result.data?.avatar_url ?? this.profile.avatar_url;

        }

        catch (error) {

            console.error(error);
            alert(error.message || "Avatar upload failed.");

        }

        finally {

            this.uploadingAvatar = false;
            this.update();

        }

    }

    renderPersonalInfoCard() {

        return h(
            "div",
            { class: "dashboard-card" },

            h("h2", {}, "Personal Information"),

            this.renderInput("Full Name", "full_name"),
            this.renderInput("Specialization", "specialization", "text", true),
            this.renderTextarea("Bio", "bio")

        );

    }

    renderProfessionalInfoCard() {

        return h(
            "div",
            { class: "dashboard-card" },

            h("h2", {}, "Professional Information"),

            this.renderInput("Years of Experience", "years_of_experience", "number"),
            this.renderInput("MDCN Registration Number", "mdcn_registration_number")

        );

    }

    renderContactCard() {

        return h(
            "div",
            { class: "dashboard-card" },

            h("h2", {}, "Contact"),

            this.renderInput("Phone Number", "phone_number")

        );

    }

    renderPricingCard() {

        return h(
            "div",
            { class: "dashboard-card" },

            h("h2", {}, "Pricing"),

            this.renderInput("Consultation Fee", "consultation_fee", "number"),
            this.renderInput("Follow-up Fee", "follow_up_fee", "number")

        );

    }

    renderTermsCard() {

        const alreadyAccepted = Boolean(this.profile.doctor_terms_accepted_at);

        return h(
            "div",
            { class: "dashboard-card form-checkbox" },

            h(
                "input",
                {
                    type: "checkbox",
                    id: "doctor-terms",
                    checked: alreadyAccepted || this.profile._termsAccepted === true,
                    disabled: alreadyAccepted,
                    onchange: e => {
                        this.profile._termsAccepted = e.target.checked;
                    }
                }
            ),

            h(
                "label",
                { for: "doctor-terms" },
                alreadyAccepted
                    ? "You have accepted the Doctor Terms."
                    : "I accept the Doctor Terms & Conditions."
            )

        );

    }

    renderActions() {

        return h(
            "div",
            { class: "profile-actions" },

            this.saveError
                ? h("p", { class: "dashboard-muted" }, this.saveError)
                : null,

            this.saveSuccess
                ? h("p", { class: "dashboard-muted" }, "Profile saved.")
                : null,

            h(
                "button",
                {
                    class: "btn btn-primary",
                    disabled: this.saving,
                    onclick: () => this.handleSave()
                },

                this.saving
                    ? h("span", { class: "btn-spinner" })
                    : null,

                this.saving ? "Saving..." : "Save Profile"

            )

        );

    }

    async handleSave() {

        this.saving = true;
        this.saveError = null;
        this.saveSuccess = false;
        this.update();

        const alreadyAccepted = Boolean(this.profile.doctor_terms_accepted_at);

        const payload = {
            full_name: this.profile.full_name,
            specialization: this.profile.specialization,
            bio: this.profile.bio,
            years_of_experience: this.profile.years_of_experience,
            phone_number: this.profile.phone_number,
            mdcn_registration_number: this.profile.mdcn_registration_number,
            consultation_fee: this.profile.consultation_fee,
            follow_up_fee: this.profile.follow_up_fee,
            currency: this.profile.currency,
            doctor_terms_accepted:
                alreadyAccepted || this.profile._termsAccepted === true
        };

        try {

            const result = await doctorProfileService.saveProfile(payload);

            this.profile = {
                ...this.profile,
                ...result.data
            };

            this.saveSuccess = true;

        }

        catch (error) {

            console.error(error);
            this.saveError = error.message || "Unable to save profile.";

        }

        finally {

            this.saving = false;
            this.update();

        }

    }

    renderInput(label, field, type = "text", required = false) {

        return h(
            "div",
            { class: "form-group" },

            h("label", { class: "form-label" }, label),

            h(
                "input",
                {
                    class: "form-input",
                    type,
                    required,
                    value: this.profile[field] ?? "",
                    oninput: e => {
                        this.profile[field] = e.target.value;
                    }
                }
            )

        );

    }

    renderTextarea(label, field) {

        return h(
            "div",
            { class: "form-group" },

            h("label", { class: "form-label" }, label),

            h(
                "textarea",
                {
                    class: "form-textarea",
                    rows: 5,
                    oninput: e => {
                        this.profile[field] = e.target.value;
                    }
                },
                this.profile[field] || ""
            )

        );

    }

    formatVerificationStatus(status) {

        switch (status) {
            case "verified": return "Verified";
            case "pending_review": return "Pending Review";
            case "suspended": return "Suspended";
            default: return "Unsubmitted";
        }

    }

}
