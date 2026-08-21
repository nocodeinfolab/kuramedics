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
            "main",
            { class: "patient-dashboard__content" },
            this.renderHeader(),
            this.loading
                ? h("p", { class: "dashboard-loading" }, "Loading doctor profile...")
                : this.error
                ? this.renderError()
                : this.renderDoctor()
        );
    }

    renderHeader() {
        return h(
            "header",
            { class: "dashboard-header" },
            h("p", { class: "dashboard-greeting" }, "YerosCare"),
            h("h1", { class: "dashboard-title" }, "Doctor Profile"),
            h("p", { class: "dashboard-subtitle" }, "Verified private care, one AI-guided step away")
        );
    }

    renderError() {
        return h(
            "div",
            { class: "dashboard-card text-center py-4" },
            h("p", { class: "dashboard-muted", style: "color: #ef4444 !important;" }, this.error)
        );
    }

    renderDoctor() {
        const doctor = this.doctor;

        return h(
            "div",
            { class: "dashboard-page--enter", style: "display: flex; flex-direction: column; gap: var(--space-4);" },
            h(
                "div",
                { class: "dashboard-card", style: "display: flex; gap: var(--space-4); align-items: center;" },
                doctor.avatar_url
                    ? h("img", {
                          src: doctor.avatar_url,
                          alt: doctor.full_name,
                          style: "width: 72px; height: 72px; border-radius: 50%; object-fit: cover;",
                      })
                    : h(
                          "div",
                          {
                              style: "width: 72px; height: 72px; border-radius: 50%; background: var(--color-primary-soft, #f1f5f9); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 600; color: var(--color-primary);",
                          },
                          (doctor.full_name || "?").charAt(0).toUpperCase()
                      ),
                h(
                    "div",
                    {},
                    h("h2", { class: "dashboard-title", style: "color: var(--color-ink, inherit); margin-bottom: var(--space-1);" }, `Dr. ${doctor.full_name}`),
                    h(
                        "span",
                        {
                            style: "display: inline-block; background: var(--color-primary); color: var(--color-white); font-size: 0.72rem; padding: 3px 10px; border-radius: var(--radius-sm); font-weight: 600;",
                        },
                        doctor.specialization || "General Practice"
                    )
                )
            ),

            doctor.years_of_experience || doctor.clinic_name
                ? h(
                      "div",
                      { class: "dashboard-card" },
                      doctor.years_of_experience
                          ? h("p", { class: "dashboard-muted", style: "margin: 0 0 var(--space-1);" }, `${doctor.years_of_experience} years of experience`)
                          : null,
                      doctor.clinic_name
                          ? h("p", { class: "dashboard-muted", style: "margin: 0;" }, doctor.clinic_name)
                          : null
                  )
                : null,

            doctor.bio
                ? h(
                      "div",
                      { class: "dashboard-card" },
                      h("p", { class: "dashboard-greeting", style: "color: var(--color-ink-faint);" }, "About"),
                      h("p", { style: "margin: 0; line-height: 1.55;" }, doctor.bio)
                  )
                : null,

            doctor.services?.length
                ? h(
                      "div",
                      { class: "dashboard-card" },
                      h("p", { class: "dashboard-greeting", style: "color: var(--color-ink-faint);" }, "Consultation options"),
                      h(
                          "div",
                          { style: "display: flex; flex-direction: column; gap: var(--space-2);" },
                          doctor.services.map(service =>
                              h(
                                  "div",
                                  { style: "padding: var(--space-3); background: var(--color-bg-soft, #f8fafc); border-radius: var(--radius-md);" },
                                  h("p", { style: "margin: 0; font-weight: 600; font-size: 0.9rem;" }, service.display_name),
                                  service.first_time_price_amount
                                      ? h("p", { class: "dashboard-muted", style: "margin: 4px 0 0;" }, `₦${Number(service.first_time_price_amount).toLocaleString()}`)
                                      : null
                              )
                          )
                      )
                  )
                : null,

            h(
                "button",
                {
                    class: "btn btn-primary",
                    style: "width: 100%;",
                    onclick: () => this.handleBookClick(),
                },
                `Book Dr. ${doctor.full_name}`
            )
        );
    }

    update() {
        if (!this.el) return;
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
    }
}
