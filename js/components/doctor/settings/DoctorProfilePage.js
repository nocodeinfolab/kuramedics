import { Component } from "../../../core/component.js";
import { h } from "../../../utils/dom.js";
import doctorProfileService from "../../../services/doctorProfileService.js";
import apiService from "../../../services/api.js";

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
        this.avatarError = null;
        this.avatarPreviewUrl = null; // local object URL for instant preview

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
            { class: "dashboard-header page-hero" },
    
            h(
                "button",
                {
                    type: "button",
                    class: "page-hero__back",
                    onclick: () => this.onBack()
                },
                this.renderChevronIcon(),
                h("span", {}, "Settings")
            ),
    
            h(
                "div",
                { class: "page-hero__title-row" },
                h("h1", { class: "page-hero__title" }, "Doctor Profile"),
                h(
                    "span",
                    {
                        class:
                            "page-hero__status page-hero__status--" +
                            (this.profile.verification_status || "unsubmitted")
                    },
                    this.formatVerificationStatus(this.profile.verification_status)
                )
            ),
    
            h(
                "p",
                { class: "page-hero__subtitle" },
                "The professional profile patients see when they book you."
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
        const avatar =
            this.avatarPreviewUrl || this.resolveAvatarUrl(this.profile.avatar_url);
        const initial = this.profile.full_name
            ? this.profile.full_name.charAt(0).toUpperCase()
            : "D";
    
        const fileInput = h("input", {
            type: "file",
            accept: "image/png,image/jpeg,image/webp",
            style: "display:none",
            onchange: e => this.handleAvatarChange(e)
        });
    
        return h(
            "div",
            { class: "dashboard-card settings-avatar-card" },
    
            // --- Avatar + camera badge ---
            h(
                "div",
                { class: "settings-avatar-preview" },
                avatar
                    ? h("img", {
                          class: "settings-profile-avatar",
                          src: avatar,
                          alt: "Doctor avatar"
                      })
                    : h(
                          "div",
                          {
                              class:
                                  "settings-profile-avatar settings-profile-avatar--placeholder"
                          },
                          initial
                      ),
                h(
                    "button",
                    {
                        type: "button",
                        class: "settings-avatar-badge",
                        disabled: this.uploadingAvatar,
                        title: "Change photo",
                        "aria-label": "Change photo",
                        onclick: () => fileInput.click()
                    },
                    this.uploadingAvatar
                        ? h("span", { class: "btn-spinner btn-spinner--sm" })
                        : this.renderCameraIcon()
                )
            ),
    
            // --- Text block + actions ---
            h(
                "div",
                { class: "settings-avatar-info" },
                h(
                    "p",
                    { class: "settings-avatar-name" },
                    this.profile.full_name || "Profile photo"
                ),
                h(
                    "p",
                    { class: "settings-avatar-hint" },
                    "JPG, PNG or WebP · max 2 MB"
                ),
                h(
                    "div",
                    { class: "settings-avatar-actions" },
                    fileInput,
                    h(
                        "button",
                        {
                            type: "button",
                            class: "btn-link",
                            disabled: this.uploadingAvatar,
                            onclick: () => fileInput.click()
                        },
                        this.uploadingAvatar ? "Uploading…" : "Change photo"
                    ),
                    avatar && !this.uploadingAvatar
                        ? h(
                              "button",
                              {
                                  type: "button",
                                  class: "btn-link btn-link--danger",
                                  onclick: () => this.handleRemoveAvatar()
                              },
                              "Remove"
                          )
                        : null
                ),
                this.avatarError
                    ? h("p", { class: "form-error" }, this.avatarError)
                    : null
            )
        );
    }
    renderChevronIcon() {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "14");
        svg.setAttribute("height", "14");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2.5");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
    
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", "M15 18l-6-6 6-6");
        svg.appendChild(path);
        return svg;
    }
    renderCameraIcon() {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "14");
        svg.setAttribute("height", "14");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2.2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
    
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute(
            "d",
            "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
        );
        const circle = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "circle"
        );
        circle.setAttribute("cx", "12");
        circle.setAttribute("cy", "13");
        circle.setAttribute("r", "4");
    
        svg.appendChild(path);
        svg.appendChild(circle);
        return svg;
    }

    async handleAvatarChange(e) {
        const file = e.target.files?.[0];
        e.target.value = ""; // ← critical: allows re-selecting the same file
        if (!file) return;
    
        this.avatarError = null;
    
        const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
        const MAX_BYTES = 2 * 1024 * 1024;
    
        if (!ALLOWED.includes(file.type)) {
            this.avatarError = "Please choose a JPG, PNG, or WebP image.";
            this.update();
            return;
        }
        if (file.size > MAX_BYTES) {
            this.avatarError = "Image must be under 2 MB.";
            this.update();
            return;
        }
    
        // Instant local preview
        this.avatarPreviewUrl = URL.createObjectURL(file);
        this.uploadingAvatar = true;
        this.update();
    
        try {
            const result = await doctorProfileService.uploadAvatar(file);
            const newUrl = result?.data?.avatar_url;
            if (newUrl) {
                // Cache-bust so the browser doesn't show the old image
                this.profile.avatar_url = newUrl.includes("?")
                    ? `${newUrl}&t=${Date.now()}`
                    : `${newUrl}?t=${Date.now()}`;
            }
        } catch (error) {
            console.error("Avatar upload failed:", error);
            this.avatarError = error.message || "Avatar upload failed.";
        } finally {
            if (this.avatarPreviewUrl) {
                URL.revokeObjectURL(this.avatarPreviewUrl);
                this.avatarPreviewUrl = null;
            }
            this.uploadingAvatar = false;
            this.update();
        }
    }
    async handleRemoveAvatar() {
        if (!confirm("Remove your profile photo?")) return;
    
        this.avatarError = null;
        this.uploadingAvatar = true;
        this.update();
    
        try {
            await doctorProfileService.removeAvatar?.();
            this.profile.avatar_url = null;
        } catch (error) {
            console.error("Avatar removal failed:", error);
            this.avatarError = error.message || "Could not remove photo.";
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
            this.renderInput("Full Name", "full_name", "text", true, { attrs: { autocomplete: "name" } }),
            this.renderInput("Specialization", "specialization", "text", true, { hint: "e.g. Cardiologist, Paediatrician" }),
            this.renderTextarea("Bio", "bio")
        );
    }

    renderProfessionalInfoCard() {
        return h(
            "div",
            { class: "dashboard-card" },
            h("h2", { style: "margin: 0 0 var(--space-4);" }, "Professional Information"),
            this.renderInput("Years of Experience", "years_of_experience", "number", false, { attrs: { min: "0", max: "70", inputmode: "numeric" } }),
            this.renderInput("MDCN Registration Number", "mdcn_registration_number", "text", false, { hint: "Enter it exactly as it appears on your licence." })
        );
    }

    renderContactCard() {
        return h(
            "div",
            { class: "dashboard-card" },
            h("h2", { style: "margin: 0 0 var(--space-4);" }, "Contact"),
            this.renderInput("Phone Number", "phone_number", "tel", false, { attrs: { autocomplete: "tel", inputmode: "tel" } })
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
        { class: "profile-actions" },
        this.saveError
          ? h("p", { class: "form-banner form-banner--error", role: "alert" }, this.saveError)
          : null,
        this.saveSuccess
          ? h("p", { class: "form-banner form-banner--success", role: "status" }, "Profile saved.")
          : null,
        h(
          "button",
          { type: "submit", class: "btn btn-primary", disabled: this.saving },
          this.saving ? h("span", { class: "btn-spinner" }) : null,
          this.saving ? "Saving…" : "Save Profile"
        )
      );
    }
    async handleSave() {
        this.saving = true;
        clearTimeout(this._successTimeout);
        this._successTimeout = setTimeout(() => {
          this.saveSuccess = false;
          this.el?.querySelector(".form-banner--success")?.remove();
        }, 3000);
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

    renderInput(label, field, type = "text", required = false, opts = {}) {
      const id = `profile-${field}`;
      return h(
        "div",
        { class: "form-group" },
        h("label", { class: "form-label", for: id }, label),
        h("input", {
          id,
          class: "form-input",
          type,
          required,
          value: this.profile[field] ?? "",
          oninput: e => { this.profile[field] = e.target.value; },
          ...(opts.attrs || {})
        }),
        opts.hint ? h("p", { class: "form-hint" }, opts.hint) : null
      );
    }
    
    renderTextarea(label, field, max = 500) {
      const id = `profile-${field}`;
      const count = h("span", { class: "form-counter" }, `${(this.profile[field] || "").length}/${max}`);
      return h(
        "div",
        { class: "form-group" },
        h("label", { class: "form-label", for: id }, label),
        h(
          "textarea",
          {
            id,
            class: "form-textarea",
            rows: 5,
            maxlength: String(max),
            placeholder: "Tell patients about your background and approach.",
            oninput: e => {
              this.profile[field] = e.target.value;
              count.textContent = `${e.target.value.length}/${max}`;
            }
          },
          this.profile[field] || ""
        ),
        count
      );
    }
    resolveAvatarUrl(url) {
        return apiService.resolveUrl(url);
    }
    getCompleteness() {
      const p = this.profile;
      const checks = [
        ["Profile photo", !!p.avatar_url],
        ["Full name", !!p.full_name?.trim()],
        ["Specialization", !!p.specialization?.trim()],
        ["Bio", (p.bio || "").trim().length >= 40],
        ["Years of experience", p.years_of_experience !== "" && p.years_of_experience != null],
        ["Phone number", !!p.phone_number?.trim()],
        ["MDCN number", !!p.mdcn_registration_number?.trim()],
        ["Accepted terms", !!p.doctor_terms_accepted_at]
      ];
      const done = checks.filter(([, ok]) => ok).length;
      return {
        pct: Math.round((done / checks.length) * 100),
        missing: checks.filter(([, ok]) => !ok).map(([label]) => label)
      };
    }
    
    renderCompletenessCard() {
      const { pct, missing } = this.getCompleteness();
      if (pct === 100) return null;
    
      return h(
        "div",
        { class: "dashboard-card profile-progress" },
        h(
          "div",
          { class: "profile-progress__head" },
          h("h3", {}, "Complete your profile"),
          h("span", { class: "profile-progress__pct" }, `${pct}%`)
        ),
        h(
          "div",
          { class: "profile-progress__track", role: "progressbar", "aria-valuenow": pct, "aria-valuemin": 0, "aria-valuemax": 100 },
          h("div", { class: "profile-progress__bar", style: `width:${pct}%` })
        ),
        h("p", { class: "dashboard-muted" }, `Still needed: ${missing.join(", ")}`)
      );
    }
    renderLoading() {
      return h(
        "div",
        { "aria-busy": "true", "aria-label": "Loading profile" },
        ...[0, 1, 2].map(() =>
          h(
            "div",
            { class: "dashboard-card" },
            h("div", { class: "skeleton skeleton--title" }),
            h("div", { class: "skeleton skeleton--line" }),
            h("div", { class: "skeleton skeleton--line skeleton--short" })
          )
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
