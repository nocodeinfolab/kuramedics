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
            // Stash the doctor ID so login/signup can resume straight into
            // this doctor's booking flow instead of the generic dashboard.
            localStorage.setItem(PENDING_BOOKING_KEY, this.doctorId);
            window.location.hash = "/patient/login";
            return;
        }

        // Already logged in — same stash-and-redirect mechanism, since
        // PatientDashboardPage already knows how to consume it on mount.
        localStorage.setItem(PENDING_BOOKING_KEY, this.doctorId);
        window.location.hash = "/patient/dashboard";
    }

    // ---------- Render ----------

    render() {
        return h(
            "main",
            { style: "max-width: 520px; margin: 0 auto; padding: 24px 16px; font-family: Inter, sans-serif;" },
            h("p", { style: "color: #0284c7; font-weight: 700; font-size: 1.1rem; margin: 0 0 4px;" }, "YerosCare"),
            h("p", { style: "color: #64748b; font-size: 0.82rem; margin: 0 0 24px;" }, "Verified private care, one AI-guided step away"),
            this.loading
                ? h("p", {}, "Loading doctor profile...")
                : this.error
                ? this.renderError()
                : this.renderDoctor()
        );
    }

    renderError() {
        return h(
            "div",
            { style: "padding: 16px; border-radius: 8px; background: #fef2f2; border: 1px solid #fecaca;" },
            h("p", { style: "color: #ef4444; margin: 0; font-weight: 600;" }, this.error)
        );
    }

    renderDoctor() {
        const doctor = this.doctor;

        return h(
            "div",
            { style: "display: flex; flex-direction: column; gap: 18px;" },
            h(
                "div",
                { style: "display: flex; gap: 14px; align-items: center;" },
                doctor.avatar_url
                    ? h("img", {
                          src: doctor.avatar_url,
                          alt: doctor.full_name,
                          style: "width: 72px; height: 72px; border-radius: 50%; object-fit: cover;",
                      })
                    : h(
                          "div",
                          {
                              style: "width: 72px; height: 72px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 600; color: #0284c7;",
                          },
                          (doctor.full_name || "?").charAt(0).toUpperCase()
                      ),
                h(
                    "div",
                    {},
                    h("h1", { style: "margin: 0 0 4px; font-size: 1.25rem;" }, `Dr. ${doctor.full_name}`),
                    h(
                        "span",
                        {
                            style: "display: inline-block; background: #0284c7; color: #fff; font-size: 0.72rem; padding: 3px 10px; border-radius: 5px;",
                        },
                        doctor.specialization || "General Practice"
                    )
                )
            ),

            doctor.years_of_experience
                ? h("p", { style: "margin: 0; color: #64748b; font-size: 0.88rem;" }, `${doctor.years_of_experience} years of experience`)
                : null,

            doctor.clinic_name
                ? h("p", { style: "margin: 0; color: #64748b; font-size: 0.88rem;" }, doctor.clinic_name)
                : null,

            doctor.bio
                ? h(
                      "div",
                      {},
                      h("p", { style: "font-size: 0.75rem; color: #64748b; text-transform: uppercase; margin: 0 0 6px;" }, "About"),
                      h("p", { style: "margin: 0; font-size: 0.9rem; line-height: 1.55;" }, doctor.bio)
                  )
                : null,

            doctor.services?.length
                ? h(
                      "div",
                      {},
                      h("p", { style: "font-size: 0.75rem; color: #64748b; text-transform: uppercase; margin: 0 0 8px;" }, "Consultation options"),
                      h(
                          "div",
                          { style: "display: flex; flex-direction: column; gap: 8px;" },
                          doctor.services.map(service =>
                              h(
                                  "div",
                                  { style: "padding: 10px 12px; background: #f8fafc; border-radius: 8px;" },
                                  h("p", { style: "margin: 0; font-weight: 600; font-size: 0.9rem;" }, service.display_name),
                                  service.first_time_price_amount
                                      ? h("p", { style: "margin: 4px 0 0; font-size: 0.85rem; color: #64748b;" }, `₦${Number(service.first_time_price_amount).toLocaleString()}`)
                                      : null
                              )
                          )
                      )
                  )
                : null,

            h(
                "button",
                {
                    style: "padding: 0.75rem 1rem; font-size: 0.95rem; font-weight: 600; border-radius: 8px; border: none; background: #0284c7; color: #fff; cursor: pointer;",
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
