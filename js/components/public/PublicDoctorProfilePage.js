// js/components/public/PublicDoctorProfilePage.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";

const API_BASE_URL = "https://doctors-consultation-backend.onrender.com/api/v1";
const PENDING_BOOKING_KEY = "pendingBookingDoctorId";

export default class PublicDoctorProfilePage extends Component {
    constructor(doctorId) {
        super();
        this.doctorId = doctorId;

        this.loading = true;
        this.error = "";
        this.doctor = null;
    }

    async afterMount() {
        await this.loadDoctor();
    }

    async loadDoctor() {
        this.loading = true;
        this.error = "";
        this.update();

        try {
            const res = await fetch(`${API_BASE_URL}/directory/${this.doctorId}`, {
                credentials: "include",
            });
            const json = await res.json();

            if (!res.ok) {
                throw new Error(json.message || "Doctor not found.");
            }

            this.doctor = json.data || json;
        } catch (error) {
            console.error("Failed to load doctor:", error);
            this.error = error.message || "This doctor's profile could not be loaded.";
        } finally {
            this.loading = false;
            this.update();
        }
    }

    // ---------- Actions ----------

    handleBookClick() {
        const isLoggedIn = !!localStorage.getItem("accessToken");

        if (!isLoggedIn) {
            localStorage.setItem(PENDING_BOOKING_KEY, this.doctorId);
            window.location.hash = "/patient/login";
            return;
        }

        localStorage.setItem(PENDING_BOOKING_KEY, this.doctorId);
        window.location.hash = "/patient/dashboard";
    }

    // ---------- Render ----------

    render() {
        return h(
            "div",
            { class: "landing" },
            this.renderBrandHeader(),
            h(
                "main",
                { class: "landing__main" },
                this.loading
                    ? h("p", { class: "landing__lead", style: "text-align: center;" }, "Loading doctor profile...")
                    : this.error
                    ? this.renderError()
                    : this.renderDoctor()
            ),
            this.renderLegalFooter()
        );
    }

    renderBrandHeader() {
        return h(
            "header",
            { class: "landing__brand" },
            h("div", { class: "landing__brand-mark" }),
            h("span", { class: "landing__brand-name" }, "YerosCare")
        );
    }

    renderLegalFooter() {
        return h(
            "footer",
            { class: "landing__legal" },
            h("p", {}, "Trusted care. Digitally delivered")
        );
    }

    renderError() {
        return h(
            "div",
            { class: "feature-chip", style: "border-color: #fecaca; background: #fef2f2;" },
            h("span", { class: "feature-chip__label", style: "color: #ef4444;" }, this.error)
        );
    }

    renderDoctor() {
        const doctor = this.doctor;

        return h(
            "div",
            { style: "display: flex; flex-direction: column; gap: var(--space-6);" },
            
            /* Profile Header Section */
            h(
                "div",
                { class: "landing__headline" },
                doctor.avatar_url
                    ? h("img", {
                          src: doctor.avatar_url,
                          alt: doctor.full_name,
                          style: "width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin: 0 auto;",
                      })
                    : h(
                          "div",
                          {
                              style: "width: 80px; height: 80px; border-radius: 50%; background: var(--color-primary-soft); color: var(--color-primary); display: flex; align-items: center; justify-content: center; font-size: 1.75rem; font-weight: 700; margin: 0 auto;",
                          },
                          (doctor.full_name || "?").charAt(0).toUpperCase()
                      ),
                h("h1", { class: "landing__title" }, `Dr. ${doctor.full_name}`),
                h("p", { class: "landing__lead" }, doctor.specialization || "General Practice")
            ),

            /* Overview Metadata (Experience & Clinic) */
            doctor.years_of_experience || doctor.clinic_name
                ? h(
                      "ul",
                      { class: "landing__features" },
                      doctor.years_of_experience
                          ? h(
                                "li",
                                { class: "feature-chip" },
                                h("span", { class: "feature-chip__label" }, `${doctor.years_of_experience} Yrs Experience`)
                            )
                          : null,
                      doctor.clinic_name
                          ? h(
                                "li",
                                { class: "feature-chip" },
                                h("span", { class: "feature-chip__label" }, doctor.clinic_name)
                            )
                          : null
                  )
                : null,

            /* Bio Section */
            doctor.bio
                ? h(
                      "div",
                      { class: "role-btn role-btn--outline", style: "cursor: default;" },
                      h("span", { class: "role-btn__label", style: "font-size: 0.82rem; color: var(--color-ink-faint); text-transform: uppercase;" }, "About"),
                      h("p", { class: "landing__lead", style: "margin-top: 4px; font-size: 0.9rem;" }, doctor.bio)
                  )
                : null,

            /* Services Section */
            doctor.services?.length
                ? h(
                      "div",
                      { style: "display: flex; flex-direction: column; gap: var(--space-2);" },
                      h("span", { class: "role-btn__label", style: "font-size: 0.82rem; color: var(--color-ink-faint); text-transform: uppercase;" }, "Consultation Options"),
                      doctor.services.map(service =>
                          h(
                              "div",
                              { class: "feature-chip", style: "justify-content: space-between;" },
                              h("span", { class: "feature-chip__label" }, service.display_name),
                              service.first_time_price_amount
                                  ? h("span", { class: "feature-chip__label", style: "color: var(--color-primary);" }, `₦${Number(service.first_time_price_amount).toLocaleString()}`)
                                  : null
                          )
                      )
                  )
                : null,

            /* Booking Action Button */
            h(
                "div",
                { class: "landing__actions" },
                h(
                    "button",
                    {
                        class: "role-btn role-btn--primary",
                        style: "width: 100%; border: none; cursor: pointer;",
                        onclick: () => this.handleBookClick(),
                    },
                    h("span", { class: "role-btn__label" }, `Book Dr. ${doctor.full_name}`),
                    h("span", { class: "role-btn__sub" }, "Click to proceed with appointment booking")
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
