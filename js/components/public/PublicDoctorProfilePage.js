// js/components/public/PublicDoctorProfilePage.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import api from "../../services/api.js";

const PENDING_BOOKING_KEY = "pendingBookingDoctorId";

const CLOCK_ICON = [
    "M12 8v4l3 2",
    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20",
];
const LOCATION_ICON = [
    "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z",
    "M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
];

const svgIcon = (paths, size = 14) =>
    h(
        "svg",
        {
            viewBox: "0 0 24 24",
            fill: "none",
            width: String(size),
            height: String(size),
            "aria-hidden": "true",
            style: "flex-shrink: 0;",
        },
        ...paths.map(d =>
            h("path", {
                d,
                stroke: "currentColor",
                "stroke-width": "1.8",
                "stroke-linecap": "round",
                "stroke-linejoin": "round",
            })
        )
    );

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
            // Use api.get() rather than raw fetch so requests share the same
            // timeout, error handling, and auth-header wiring as the rest
            // of the app. The /directory endpoint itself is public — the
            // token (if any) is simply ignored by the backend.
            const res = await api.get(`/directory/${this.doctorId}`);
            this.doctor = res.data || res;
        } catch (error) {
            console.error("Failed to load doctor:", error);
            this.error = error.message || "This doctor's profile could not be loaded.";
        } finally {
            this.loading = false;
            this.update();
        }
    }

    // ---------- Schedule formatting ----------

    formatTimeLabel(time24) {
        if (!time24 || typeof time24 !== "string") return "";
        const [hh, mm] = time24.split(":");
        const hour = Number(hh);
        if (!Number.isInteger(hour)) return time24;
        const ampm = hour >= 12 ? "PM" : "AM";
        const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        return mm === "00" ? `${h12} ${ampm}` : `${h12}:${mm} ${ampm}`;
    }

    compressDayRange(dayKeys) {
        const SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const FULL = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
        const indices = dayKeys
            .map(k => FULL.indexOf(k))
            .filter(i => i >= 0)
            .sort((a, b) => a - b);
        if (indices.length === 0) return "";

        const parts = [];
        let runStart = indices[0];
        let runEnd = indices[0];
        const flush = () => {
            const count = runEnd - runStart + 1;
            if (count === 1) parts.push(SHORT[runStart]);
            else if (count === 2) parts.push(`${SHORT[runStart]}, ${SHORT[runEnd]}`);
            else parts.push(`${SHORT[runStart]}–${SHORT[runEnd]}`);
        };
        for (let i = 1; i < indices.length; i++) {
            if (indices[i] === runEnd + 1) runEnd = indices[i];
            else { flush(); runStart = indices[i]; runEnd = indices[i]; }
        }
        flush();
        return parts.join(", ");
    }

    getScheduleLines(schedule) {
        if (!schedule || typeof schedule !== "object") return [];
        const ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

        const groups = new Map();
        for (const key of ORDER) {
            const entry = schedule[key];
            if (!entry || !entry.enabled) continue;
            const timeKey = `${entry.start}|${entry.end}`;
            if (!groups.has(timeKey)) groups.set(timeKey, []);
            groups.get(timeKey).push(key);
        }

        const lines = [];
        for (const [timeKey, keys] of groups) {
            const [start, end] = timeKey.split("|");
            lines.push({
                days: this.compressDayRange(keys),
                time: `${this.formatTimeLabel(start)} – ${this.formatTimeLabel(end)}`,
            });
        }
        return lines;
    }

    // ---------- Name handling ----------

    getDisplayName() {
        const raw = (this.doctor?.full_name || "").trim();
        if (!raw) return "Doctor";
        return /^dr\.?\s/i.test(raw) ? raw : `Dr. ${raw}`;
    }

    // ---------- Actions ----------

    handleBookClick() {
        const isLoggedIn = !!localStorage.getItem("accessToken");

        localStorage.setItem(PENDING_BOOKING_KEY, this.doctorId);

        if (!isLoggedIn) {
            window.location.hash = "/patient/login";
        } else {
            window.location.hash = "/patient/dashboard";
        }
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
        const displayName = this.getDisplayName();
        const initial = (doctor.full_name || "?").charAt(0).toUpperCase();
        const services = Array.isArray(doctor.services) ? doctor.services : [];

        return h(
            "div",
            { style: "display: flex; flex-direction: column; gap: var(--space-6);" },

            // ---------- Profile header ----------
            h(
                "div",
                { class: "landing__headline" },
                doctor.avatar_url
                    ? h("img", {
                          src: api.resolveUrl(doctor.avatar_url),
                          alt: doctor.full_name || displayName,
                          style: "width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin: 0 auto;",
                          onerror: (e) => {
                              e.target.replaceWith(
                                  h(
                                      "div",
                                      {
                                          style: "width: 80px; height: 80px; border-radius: 50%; background: var(--color-primary-soft); color: var(--color-primary); display: flex; align-items: center; justify-content: center; font-size: 1.75rem; font-weight: 700; margin: 0 auto;",
                                      },
                                      initial
                                  )
                              );
                          },
                      })
                    : h(
                          "div",
                          {
                              style: "width: 80px; height: 80px; border-radius: 50%; background: var(--color-primary-soft); color: var(--color-primary); display: flex; align-items: center; justify-content: center; font-size: 1.75rem; font-weight: 700; margin: 0 auto;",
                          },
                          initial
                      ),
                h("h1", { class: "landing__title" }, displayName),
                h("p", { class: "landing__lead" }, doctor.specialization || "General Practice")
            ),

            // ---------- Metadata chips ----------
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

            // ---------- Bio ----------
            doctor.bio
                ? h(
                      "div",
                      { class: "role-btn role-btn--outline", style: "cursor: default;" },
                      h(
                          "span",
                          { class: "role-btn__label", style: "font-size: 0.82rem; color: var(--color-ink-faint); text-transform: uppercase;" },
                          "About"
                      ),
                      h("p", { class: "landing__lead", style: "margin-top: 4px; font-size: 0.9rem;" }, doctor.bio)
                  )
                : null,

            // ---------- Consultation options ----------
            services.length > 0
                ? h(
                      "div",
                      { style: "display: flex; flex-direction: column; gap: var(--space-3);" },
                      h(
                          "span",
                          { class: "role-btn__label", style: "font-size: 0.82rem; color: var(--color-ink-faint); text-transform: uppercase;" },
                          "Consultation Options"
                      ),
                      ...services.map(service => this.renderService(service))
                  )
                : null,

            // ---------- Book button ----------
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
                    h("span", { class: "role-btn__label" }, `Book ${displayName}`),
                    h("span", { class: "role-btn__sub" }, "Continue to appointment booking")
                )
            )
        );
    }

    renderService(service) {
        const scheduleLines = this.getScheduleLines(service.availability_schedule);
        const isHomeVisit = service.service_type === "home_visit";
        const note = (service.availability_note || "").trim();

        const price = service.first_time_price_amount;
        const followUpPrice = service.follow_up_price_amount;
        const showFollowUp =
            followUpPrice != null &&
            Number(followUpPrice) > 0 &&
            Number(followUpPrice) !== Number(price);

        return h(
            "div",
            {
                class: "feature-chip",
                style: "flex-direction: column; align-items: stretch; gap: 6px; padding: 12px 14px;",
            },
            // Row: name + primary price
            h(
                "div",
                { style: "display: flex; justify-content: space-between; align-items: center; gap: 8px;" },
                h("span", { class: "feature-chip__label" }, service.display_name),
                price != null
                    ? h(
                          "span",
                          { class: "feature-chip__label", style: "color: var(--color-primary); white-space: nowrap;" },
                          `₦${Number(price).toLocaleString()}`
                      )
                    : null
            ),

            // Sub-line: duration · follow-up price
            service.duration_minutes || showFollowUp
                ? h(
                      "p",
                      { style: "font-size: 0.78rem; color: var(--color-ink-faint); margin: 0; line-height: 1.4;" },
                      [
                          service.duration_minutes ? `${service.duration_minutes} min` : null,
                          showFollowUp
                              ? `Follow-up: ₦${Number(followUpPrice).toLocaleString()}`
                              : null,
                      ]
                          .filter(Boolean)
                          .join(" · ")
                  )
                : null,

            // Description
            service.description
                ? h(
                      "p",
                      { style: "font-size: 0.82rem; color: var(--color-ink); margin: 2px 0 0; line-height: 1.45;" },
                      service.description
                  )
                : null,

            // Weekly schedule lines
            scheduleLines.length > 0
                ? h(
                      "div",
                      { style: "display: flex; flex-direction: column; gap: 2px; margin-top: 4px;" },
                      ...scheduleLines.map(({ days, time }) =>
                          h(
                              "p",
                              {
                                  style: "display: flex; align-items: center; gap: 6px; margin: 0; font-size: 0.78rem; color: var(--color-ink); line-height: 1.4;",
                              },
                              svgIcon(CLOCK_ICON, 12),
                              h("span", null, `${days} · ${time}`)
                          )
                      )
                  )
                : null,

            // Home visit locations
            isHomeVisit && note
                ? h(
                      "p",
                      {
                          style: "display: flex; align-items: flex-start; gap: 6px; margin: 4px 0 0; font-size: 0.78rem; font-weight: 600; color: var(--color-primary); line-height: 1.4;",
                      },
                      svgIcon(LOCATION_ICON, 12),
                      h("span", null, `Locations covered: ${note}`)
                  )
                : null
        );
    }

    update() {
        if (!this.el) return;
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
    }
}
