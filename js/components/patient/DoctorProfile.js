// js/components/patient/DoctorProfile.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import api from "../../services/api.js";

export default class DoctorProfile extends Component {
    /**
     * @param {object} patient
     * @param {object} doctor - { doctor_id, full_name, ... } from DoctorList
     * @param {(profile: object, serviceId: string|null) => void} onProceedToBooking
     * @param {() => void} onBack
     */
    constructor(patient, doctor, onProceedToBooking, onBack) {
        super();
        this.patient = patient ?? {};
        this.doctor = doctor ?? {};
        this.onProceedToBooking = onProceedToBooking;
        this.onBack = onBack;

        this.loading = true;
        this.loadError = "";
        this.profile = null;
        this.selectedServiceId = "";
    }

    async afterMount() {
        await this.loadProfile();
    }

    // ---------- Data loading ----------

    async loadProfile() {
        this.loading = true;
        this.loadError = "";
        this.update();

        try {
            const res = await api.get(`/directory/${this.doctor.doctor_id}`);
            this.profile = res.data || res;

            if (this.profile.services?.length === 1) {
                this.selectedServiceId = this.profile.services[0].id;
            }
        } catch (error) {
            console.error("Failed to load doctor profile:", error);
            this.loadError = error.message || "Failed to load this doctor's profile.";
        } finally {
            this.loading = false;
            this.update();
        }
    }

    // ---------- Actions ----------

    selectService(serviceId) {
        this.selectedServiceId = serviceId;
        this.update();
    }

    proceedToBooking() {
        if (typeof this.onProceedToBooking === "function") {
            this.onProceedToBooking(this.profile, this.selectedServiceId || null);
        }
    }

    // ---------- Formatting ----------

    formatPrice(amount) {
        if (amount == null) return null;
        return `₦${Number(amount).toLocaleString()}`;
    }

    formatDuration(minutes) {
        if (!minutes) return null;
        return `${minutes} min`;
    }

    // ---------- Render ----------

    render() {
        return h(
            "div",
            { class: "dashboard-page" },
            this.renderHeader(),
            this.loading
                ? h(
                      "div",
                      { class: "dashboard-card text-center py-4" },
                      h("p", { class: "dashboard-muted" }, "Loading doctor profile...")
                  )
                : this.loadError
                ? h(
                      "div",
                      { class: "dashboard-card", style: "border-left: 4px solid #ef4444;" },
                      h("p", { style: "color: #ef4444; margin: 0;" }, this.loadError)
                  )
                : this.renderProfile()
        );
    }

    renderHeader() {
        return h(
            "section",
            { class: "dashboard-header", style: "display: flex; align-items: flex-start; gap: 10px;" },
            h(
                "button",
                {
                    class: "btn btn-outline",
                    style: "padding: 0.4rem 0.6rem; font-size: 0.8rem; border-radius: 6px; flex-shrink: 0;",
                    onclick: () => this.onBack?.(),
                },
                "← Back"
            ),
            h(
                "div",
                {},
                h("p", { class: "dashboard-greeting" }, "Doctor Profile"),
                h("h1", { class: "dashboard-title", style: "font-size: 1.2rem;" }, this.profile?.full_name || this.doctor.full_name || "Doctor")
            )
        );
    }

    renderProfile() {
        const profile = this.profile;

        return h(
            "div",
            { class: "services-list" },

            h(
                "div",
                { class: "dashboard-card", style: "padding: 1.1rem; display: flex; gap: 14px; align-items: flex-start;" },
                profile.avatar_url
                    ? h("img", {
                          src: profile.avatar_url,
                          alt: profile.full_name || "Doctor",
                          style: "width: 64px; height: 64px; border-radius: 50%; object-fit: cover; flex-shrink: 0;",
                      })
                    : h(
                          "div",
                          {
                              style: "width: 64px; height: 64px; border-radius: 50%; background: var(--color-bg-muted, #f1f5f9); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 1.3rem; font-weight: 600; color: var(--color-primary, #0284c7);",
                          },
                          (profile.full_name || "?").charAt(0).toUpperCase()
                      ),
                h(
                    "div",
                    { style: "min-width: 0; flex: 1;" },
                    h("h2", { style: "margin: 0 0 6px; font-size: 1.1rem; font-weight: 600;" }, profile.full_name || "Unnamed Doctor"),
                    h(
                        "span",
                        {
                            class: "dashboard-badge",
                            style: "background: var(--color-primary, #0284c7); font-size: 0.7rem; padding: 3px 9px; border-radius: 5px; white-space: nowrap;",
                        },
                        profile.specialization || "General Practice"
                    ),
                    profile.years_of_experience
                        ? h(
                              "p",
                              { class: "dashboard-muted", style: "margin: 8px 0 0; font-size: 0.82rem;" },
                              `${profile.years_of_experience} years of experience`
                          )
                        : null,
                    profile.clinic_name
                        ? h(
                              "p",
                              { class: "dashboard-muted", style: "margin: 4px 0 0; font-size: 0.82rem;" },
                              profile.clinic_name
                          )
                        : null
                )
            ),

            profile.bio
                ? h(
                      "div",
                      { class: "dashboard-card", style: "padding: 1.1rem;" },
                      h("p", { class: "dashboard-muted", style: "margin: 0 0 6px; font-size: 0.78rem;" }, "About"),
                      h("p", { style: "margin: 0; font-size: 0.88rem; line-height: 1.55;" }, profile.bio)
                  )
                : null,

            h(
                "div",
                { class: "dashboard-card", style: "padding: 1.1rem; display: flex; flex-direction: column; gap: 10px;" },
                h("p", { class: "dashboard-muted", style: "margin: 0 0 4px; font-size: 0.78rem;" }, "Consultation options"),
                profile.services?.length
                    ? profile.services.map(service => this.renderServiceOption(service))
                    : h("p", { class: "dashboard-muted", style: "margin: 0; font-size: 0.85rem;" }, "This doctor has no consultation services available right now.")
            ),

            h(
                "button",
                {
                    class: "btn btn-primary",
                    style: "padding: 0.65rem 1rem; font-size: 0.9rem; border-radius: 8px;",
                    disabled: !profile.services?.length,
                    onclick: () => this.proceedToBooking(),
                },
                "Continue to booking"
            )
        );
    }

    renderServiceOption(service) {
        const isSelected = this.selectedServiceId === service.id;
        const price = this.formatPrice(service.first_time_price_amount);
        const duration = this.formatDuration(service.duration_minutes);

        return h(
            "div",
            {
                style: `padding: 0.85rem; border: 1px solid ${isSelected ? "var(--color-primary, #0284c7)" : "var(--color-line)"}; background: ${isSelected ? "rgba(2,132,199,0.05)" : "transparent"}; border-radius: 8px; cursor: pointer;`,
                onclick: () => this.selectService(service.id),
            },
            h(
                "div",
                { style: "display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;" },
                h(
                    "div",
                    {},
                    h("p", { style: "margin: 0 0 4px; font-size: 0.9rem; font-weight: 600;" }, service.display_name),
                    duration ? h("p", { class: "dashboard-muted", style: "margin: 0; font-size: 0.78rem;" }, duration) : null
                ),
                price ? h("p", { style: "margin: 0; font-size: 0.9rem; font-weight: 600; white-space: nowrap;" }, price) : null
            ),
            service.description
                ? h("p", { class: "dashboard-muted", style: "margin: 8px 0 0; font-size: 0.8rem; line-height: 1.45;" }, service.description)
                : null,
            service.availability_note
                ? h("p", { style: "margin: 6px 0 0; font-size: 0.76rem; color: var(--color-primary, #0284c7);" }, service.availability_note)
                : null
        );
    }

    update() {
        if (!this.el) return;
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
    }
}
