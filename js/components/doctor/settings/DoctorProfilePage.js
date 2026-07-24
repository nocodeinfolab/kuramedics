import { Component } from "../../../core/component.js";
import { h } from "../../../utils/dom.js";
import doctorProfileService from "../../../services/doctorProfileService.js";

export default class DoctorProfilePage extends Component {
    constructor(doctor = {}, onBack = () => {}) {
        super();
        this.onBack = onBack;

        this.loading = true;
        this.profileLoaded = false;   // guards against re-fetching on every afterMount()
        this.loadingProfile = false;  // guards against overlapping fetches
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

            // Seed from whatever the dashboard already loaded
            ...doctor
        };
    }

    render() {
        return h(
            "div",
            { class: "dashboard-page profile-settings-page" },
            this.renderHero(),
            this.loading ? this.renderLoading() : this.renderForm()
        );
    }

    afterMount() {
        if (!this.profileLoaded && !this.loadingProfile) {
            this.loadProfile();
        }
    }

    async loadProfile() {
        this.loadingProfile = true;

        try {
            const result = await doctorProfileService.getProfile();
            this.profile = {
                ...this.profile,
                ...(result.data || {})
            };
        } catch (error) {
            console.error("Error loading doctor profile:", error);
            this.saveError = "Unable to load profile information.";
        } finally {
            this.loading = false;
            this.profileLoaded = true;
            this.loadingProfile = false;
            this.update();
        }
    }

    renderLoading() {
        return h(
            "div",
            { class: "dashboard-card text-center py-4" },
            h("p", { class: "dashboard-muted" }, "Loading doctor profile...")
        );
    }

    renderHero() {
        return h(
            "section",
            { class: "dashboard-header" },
            h(
                "button",
                {
                    class: "btn btn-outline",
                    style: "margin-bottom: var(--space-3); color: var(--color-white); border-color: rgba(255,255,255,0.4);",
                    onclick: () => this.onBack()
                },
                "← Back to Settings"
            ),
            h("h1", { class: "dashboard-title" }, "Doctor Profile"),
            h(
                "p",
                { class: "dashboard-subtitle" },
                "Patients see the professional information you provide here."
            ),
            h(
                "div",
                { class: "dashboard-hero-meta" },
                h(
                    "span",
                    {
                        class: "dashboard-badge",
                        style: this.profile.verification_status === "verified" ? "background: #10b981;" : ""
                    },
                    this.formatVerificationStatus(this.profile.verification_status)
                )
            )
        );
    }

    renderForm() {
        return h(
            "form",
            {
                onsubmit: e => {
                    e.preventDefault();
                    this.handleSave();
                }
            },
            this.renderAvatarCard(),
            this.renderPersonalInfoCard(),
            this.renderProfessionalInfoCard(),
            this.renderContactCard(),
            this.renderTermsCard(),
            this.renderActions()
        );
    }

    renderAvatarCard() {
        const avatar = this.profile.avatar_url;

        const fileInput = h("input", {
            type: "file",
            accept: "image/*",
            style: "display:none",
            onchange: e => this.handleAvatarChange(e)
        });

        return h(
            "div",
            { class: "dashboard-card", style: "display: flex; align-items: center; gap: var(--space-4);" },
            avatar
                ? h("img", {
                      class: "settings-profile-avatar",
                      src: avatar,
                      alt: "Doctor Avatar",
                      style: "width: 80px; height: 80px; border-radius: 50%; object-fit: cover;"
                  })
                : h(
                      "div",
                      {
                          class: "settings-profile-avatar settings-profile-avatar--placeholder",
                          style: "width: 80px; height: 80px; border-radius: 50%; background: var(--color-primary); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; font-weight: bold;"
                      },
                      this.profile.full_name ? this.profile.full_name.charAt(0) : "D"
                  ),
            h(
                "div",
                {},
                fileInput,
                h(
                    "button",
                    {
                        type: "button",
                        class: "btn btn-outline",
                        disabled: this.uploadingAvatar,
                        onclick: () => fileInput.click()
                    },
                    this.uploadingAvatar ? h("span", { class: "btn-spinner" }) : null,
                    this.uploadingAvatar ? "Uploading..." : "Change Photo"
                )
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
            this.profile.avatar_url = result.data?.avatar_url ?? this.profile.avatar_url;
        } catch (error) {
            console.error("Avatar upload failed:", error);
            alert(error.message || "Avatar upload failed.");
        } finally {
            this.uploadingAvatar = false;
            this.update();
        }
    }

    renderPersonalInfoCard() {
        return h(
            "div",
            { class: "dashboard-card" },
            h("h2", { style: "margin: 0 0 var(--space-4);" }, "Personal Information"),
            this.renderInput("Full Name", "full_name"),
            this.renderInput("Specialization", "specialization", "text", true),
            this.renderTextarea("Bio", "bio")
        );
    }

    renderProfessionalInfoCard() {
        return h(
            "div",
            { class: "dashboard-card" },
            h("h2", { style: "margin: 0 0 var(--space-4);" }, "Professional Information"),
            this.renderInput("Years of Experience", "years_of_experience", "number"),
            this.renderInput("MDCN Registration Number", "mdcn_registration_number")
        );
    }

    renderContactCard() {
        return h(
            "div",
            { class: "dashboard-card" },
            h("h2", { style: "margin: 0 0 var(--space-4);" }, "Contact"),
            this.renderInput("Phone Number", "phone_number")
        );
    }

    renderTermsCard() {
        const alreadyAccepted = Boolean(this.profile.doctor_terms_accepted_at);

        return h(
            "div",
            { class: "dashboard-card" },
            h(
                "div",
                { class: "form-checkbox" },
                h("input", {
                    type: "checkbox",
                    id: "doctor-terms",
                    checked: alreadyAccepted || this.profile._termsAccepted === true,
                    disabled: alreadyAccepted,
                    onchange: e => {
                        this.profile._termsAccepted = e.target.checked;
                    }
                }),
                h(
                    "label",
                    { htmlFor: "doctor-terms" },
                    alreadyAccepted
                        ? "You have accepted the Doctor Terms & Conditions."
                        : "I accept the Doctor Terms & Conditions."
                )
            )
        );
    }

    renderActions() {
        return h(
            "div",
            { class: "dashboard-card", style: "display: flex; flex-direction: column; align-items: flex-end; gap: var(--space-2);" },
            this.saveError
                ? h("p", { style: "color: #ef4444; margin: 0 0 var(--space-2);" }, this.saveError)
                : null,
            this.saveSuccess
                ? h("p", { style: "color: #10b981; margin: 0 0 var(--space-2);" }, "Profile saved successfully.")
                : null,
            h(
                "button",
                {
                    type: "submit",
                    class: "btn btn-primary",
                    disabled: this.saving
                },
                this.saving ? h("span", { class: "btn-spinner" }) : null,
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
            doctor_terms_accepted: alreadyAccepted || this.profile._termsAccepted === true
        };

        try {
            const result = await doctorProfileService.saveProfile(payload);
            this.profile = {
                ...this.profile,
                ...(result.data || {})
            };
            this.saveSuccess = true;
        } catch (error) {
            console.error("Save profile failed:", error);
            this.saveError = error.message || "Unable to save profile.";
        } finally {
            this.saving = false;
            this.update();
        }
    }

    renderInput(label, field, type = "text", required = false) {
        return h(
            "div",
            { class: "form-group" },
            h("label", { class: "form-label" }, label),
            h("input", {
                class: "form-input",
                type,
                required,
                value: this.profile[field] ?? "",
                oninput: e => {
                    this.profile[field] = e.target.value;
                }
            })
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
            case "verified":
                return "Verified";
            case "pending_review":
                return "Pending Review";
            case "suspended":
                return "Suspended";
            default:
                return "Unsubmitted";
        }
    }
}
