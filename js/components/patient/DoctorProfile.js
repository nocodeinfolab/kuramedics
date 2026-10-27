// js/components/patient/DoctorProfile.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import api from "../../services/api.js";

const icon = (paths, size = 18) => h("svg", { viewBox: "0 0 24 24", fill: "none", width: String(size), height: String(size), "aria-hidden": "true" }, ...paths.map(d => h("path", { d, stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round" })));
const CLOCK_ICON = [
    "M12 8v4l3 2",
    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20",
];
const LOCATION_ICON = [
    "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z",
    "M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
];

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
        const DAY_ORDER = [
            "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
        ];
    
        // Group days that share the same time block
        const groups = new Map();
        for (const key of DAY_ORDER) {
            const entry = schedule[key];
            if (!entry || !entry.enabled) continue;
            const timeKey = `${entry.start}|${entry.end}`;
            if (!groups.has(timeKey)) groups.set(timeKey, []);
            groups.get(timeKey).push(key);
        }
    
        const lines = [];
        for (const [timeKey, dayKeys] of groups) {
            const [start, end] = timeKey.split("|");
            lines.push({
                days: this.compressDayRange(dayKeys),
                time: `${this.formatTimeLabel(start)} – ${this.formatTimeLabel(end)}`,
            });
        }
        return lines;
    }

    // ---------- Render ----------

    render() {
        return h(
            "div",
            { class: "patient-doctor-profile" },
            this.renderHeader(),
            h(
                "div",
                { class: "dp-stack" },
                this.loading
                    ? this.renderLoading()
                    : this.loadError
                    ? this.renderLoadError()
                    : this.renderProfile()
            )
        );
    }

    renderLoading() {
        return h(
            "div",
            { "aria-busy": "true", "aria-label": "Loading doctor profile" },
            h(
                "div",
                { class: "dp-card dp-hero-card" },
                h("div", { class: "dp-skel dp-skel--avatar" }),
                h(
                    "div",
                    { class: "dp-hero-body" },
                    h("div", { class: "dp-skel dp-skel--line dp-skel--short" }),
                    h("div", { class: "dp-skel dp-skel--line dp-skel--tiny" }),
                    h("div", { class: "dp-skel dp-skel--line" })
                )
            ),
            h(
                "div",
                { class: "dp-card" },
                h("div", { class: "dp-skel dp-skel--line dp-skel--short" }),
                h("div", { class: "dp-skel dp-skel--line" }),
                h("div", { class: "dp-skel dp-skel--line" })
            )
        );
    }

    renderLoadError() {
        return h(
            "div",
            { class: "dp-alert", role: "alert" },
            h(
                "div",
                { class: "dp-alert-icon" },
                icon(["M12 9v4", "M12 17h.01", "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"], 18)
            ),
            h("p", { class: "dp-alert-text" }, this.loadError)
        );
    }

    renderHeader() {
        const name = this.profile?.full_name || this.doctor.full_name || "Doctor";
        return h(
            "section",
            { class: "dashboard-header patient-home" },
            h(
                "div",
                { class: "ph-hero" },
                h(
                    "button",
                    {
                        class: "ph-hero__back",
                        type: "button",
                        "aria-label": "Back",
                        onclick: () => this.onBack?.(),
                    },
                    icon(["M15 18l-6-6 6-6"], 18)
                ),
                h(
                    "div",
                    { class: "ph-hero__text" },
                    h("p", { class: "dashboard-greeting" }, "Doctor profile"),
                    h("h1", { class: "dashboard-title" }, name)
                )
            )
        );
    }

    renderProfile() {
        const profile = this.profile;
        const initial = (profile.full_name || "?").charAt(0).toUpperCase();
        const services = Array.isArray(profile.services) ? profile.services : [];
        const hasServices = services.length > 0;

        return h(
            "div",
            { class: "dp-stack" },

            // Hero card — avatar + identity
            h(
                "div",
                { class: "dp-card dp-hero-card" },
                profile.avatar_url
                    ? h("img", {
                          class: "dp-avatar",
                          src: api.resolveUrl(profile.avatar_url),
                          alt: profile.full_name || "Doctor",
                          onerror: (e) => {
                              
                              e.target.replaceWith(
                                  h("div", { class: "dp-avatar dp-avatar--initial" }, initial)
                              );
                          },
                      })
                    : h("div", { class: "dp-avatar dp-avatar--initial" }, initial),
                h(
                    "div",
                    { class: "dp-hero-body" },
                    h("h2", { class: "dp-name" }, profile.full_name || "Unnamed Doctor"),
                    h(
                        "span",
                        { class: "dp-chip" },
                        profile.specialization || "General Practice"
                    ),
                    profile.years_of_experience
                        ? h(
                              "p",
                              { class: "dp-meta" },
                              `${profile.years_of_experience} years of experience`
                          )
                        : null,
                    profile.clinic_name
                        ? h("p", { class: "dp-meta" }, profile.clinic_name)
                        : null
                )
            ),

            // About
            profile.bio
                ? h(
                      "div",
                      { class: "dp-card" },
                      h("p", { class: "dp-eyebrow" }, "About"),
                      h("p", { class: "dp-bio" }, profile.bio)
                  )
                : null,

            // Services
            h(
                "div",
                { class: "dp-card" },
                h("p", { class: "dp-eyebrow" }, "Consultation options"),
                hasServices
                    ? h(
                          "div",
                          { class: "dp-service-list", role: "radiogroup" },
                          services.map(service => this.renderServiceOption(service))
                      )
                    : h(
                          "p",
                          { class: "dp-empty-inline" },
                          "This doctor has no consultation services available right now."
                      )
            ),

            // Continue
            h(
                "button",
                {
                    class: "dp-continue",
                    type: "button",
                    disabled: !hasServices,
                    onclick: () => this.proceedToBooking(),
                },
                h("span", null, "Continue to booking"),
                icon(["M5 12h14", "M12 5l7 7-7 7"], 18)
            )
        );
    }

    renderServiceOption(service) {
        const isSelected = this.selectedServiceId === service.id;
        const price = this.formatPrice(service.first_time_price_amount);
        const duration = this.formatDuration(service.duration_minutes);
        const isHomeVisit = service.service_type === "home_visit";
    
        const scheduleLines = this.getScheduleLines(service.availability_schedule);
        const note = (service.availability_note || "").trim();
    
        return h(
            "button",
            {
                class: `dp-service${isSelected ? " dp-service--selected" : ""}`,
                type: "button",
                role: "radio",
                "aria-checked": isSelected ? "true" : "false",
                onclick: () => this.selectService(service.id),
            },
            h(
                "div",
                { class: "dp-service-row" },
                h(
                    "span",
                    { class: "dp-radio", "aria-hidden": "true" },
                    h("span", { class: "dp-radio-dot" })
                ),
                h(
                    "div",
                    { class: "dp-service-body" },
                    h(
                        "div",
                        { class: "dp-service-head" },
                        h("span", { class: "dp-service-name" }, service.display_name),
                        price ? h("span", { class: "dp-service-price" }, price) : null
                    ),
                    duration
                        ? h("span", { class: "dp-service-duration" }, duration)
                        : null
                )
            ),
    
            // Weekly availability, one line per distinct time block.
            scheduleLines.length > 0
                ? h(
                      "div",
                      { class: "dp-service-schedule" },
                      ...scheduleLines.map(({ days, time }) =>
                          h(
                              "p",
                              { class: "dp-service-schedule-line" },
                              icon(CLOCK_ICON, 14),
                              h("span", null, `${days} · ${time}`)
                          )
                      )
                  )
                : null,
    
            service.description
                ? h("p", { class: "dp-service-desc" }, service.description)
                : null,
    
            // Note for regular services, "Locations covered" for home visits.
            note
                ? h(
                      "p",
                      { class: `dp-service-note${isHomeVisit ? " dp-service-note--locations" : ""}` },
                      icon(isHomeVisit ? LOCATION_ICON : CLOCK_ICON, 14),
                      h(
                          "span",
                          null,
                          isHomeVisit ? `Locations covered: ${note}` : note
                      )
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
