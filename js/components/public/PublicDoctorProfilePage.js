// js/components/public/PublicDoctorProfilePage.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import api from "../../services/api.js";

const PENDING_DOCTOR_KEY = "pendingBookingDoctorId";
const PENDING_SERVICE_KEY = "pendingBookingServiceId";
const PENDING_INTENT_KEY = "pendingBookingIntent";
const PENDING_DOCTOR_NAME_KEY = "pendingBookingDoctorName";

const CLOCK_ICON = ["M12 8v4l3 2", "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20"];
const LOCATION_ICON = ["M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z", "M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"];
const ARROW_ICON = ["M5 12h14", "M12 5l7 7-7 7"];

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

    // ---------- Formatting ----------

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
        const indices = dayKeys.map(k => FULL.indexOf(k)).filter(i => i >= 0).sort((a, b) => a - b);
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

    getDisplayName() {
        const raw = (this.doctor?.full_name || "").trim();
        if (!raw) return "Doctor";
        return /^dr\.?\s/i.test(raw) ? raw : `Dr. ${raw}`;
    }

    // ---------- Booking handoff ----------

    handleBookClick(serviceId = null) {
        const doctorId = this.doctorId;

        localStorage.setItem(PENDING_DOCTOR_KEY, doctorId);
        localStorage.setItem(PENDING_INTENT_KEY, "book");
        localStorage.setItem(PENDING_DOCTOR_NAME_KEY, this.getDisplayName());
        if (serviceId) {
            localStorage.setItem(PENDING_SERVICE_KEY, serviceId);
        } else {
            localStorage.removeItem(PENDING_SERVICE_KEY);
        }

        // If we're somehow inside the app's WebView, skip the deep link
        // attempt — just route internally.
        if (window.Capacitor?.isNativePlatform?.()) {
            const isLoggedIn = !!localStorage.getItem("accessToken");
            window.location.hash = isLoggedIn ? "/patient/dashboard" : "/patient/login";
            return;
        }

        // Browser: try to hand off to the app; if the app doesn't open
        // within 1.5s, fall back to the browser flow.
        const deepLink = serviceId
            ? `yeroscare://doctor/${encodeURIComponent(doctorId)}/book?service=${encodeURIComponent(serviceId)}`
            : `yeroscare://doctor/${encodeURIComponent(doctorId)}/book`;

        let fallbackTimer = null;

        const cancelFallback = () => {
            if (document.visibilityState === "hidden") {
                if (fallbackTimer) {
                    clearTimeout(fallbackTimer);
                    fallbackTimer = null;
                }
                document.removeEventListener("visibilitychange", cancelFallback);
            }
        };
        document.addEventListener("visibilitychange", cancelFallback);

        fallbackTimer = setTimeout(() => {
            fallbackTimer = null;
            document.removeEventListener("visibilitychange", cancelFallback);

            // Still here after 1.5s — the app either isn't installed or
            // the browser blocked the deep link attempt. Fall back to
            // the browser flow.
            const isLoggedIn = !!localStorage.getItem("accessToken");
            window.location.hash = isLoggedIn ? "/patient/dashboard" : "/patient/login";
        }, 1500);

        try {
            window.location.href = deepLink;
        } catch {
            // Some browsers throw on custom scheme navigation — the
            // fallback timer will still fire and route to the web flow.
        }
    }

    // ---------- Render ----------

    render() {
        return h(
            "div",
            { class: "public-doctor-page" },
            this.renderHeader(),
            h(
                "main",
                { class: "public-doctor-main" },
                this.loading
                    ? this.renderLoading()
                    : this.error
                    ? this.renderError()
                    : this.renderDoctor()
            ),
            this.renderFooter()
        );
    }

    renderHeader() {
        return h(
            "header",
            { class: "public-doctor-header" },
            h(
                "div",
                { class: "public-doctor-header__brand" },
                h("img", {
                    class: "public-doctor-header__logo",
                    src: "/assets/yeroscarelogo.png",
                    alt: "YerosCare",
                })
            )
        );
    }

    renderFooter() {
        return h("footer", { class: "public-doctor-footer" }, h("p", null, "Trusted care. Digitally delivered."));
    }

    renderLoading() {
        return h(
            "div",
            { class: "patient-doctor-profile" },
            h(
                "div",
                { class: "dp-stack" },
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
                    h("div", { class: "dp-skel dp-skel--line" })
                )
            )
        );
    }

    renderError() {
        return h(
            "div",
            { class: "patient-doctor-profile" },
            h(
                "div",
                { class: "dp-stack" },
                h(
                    "div",
                    { class: "dp-alert", role: "alert" },
                    h(
                        "div",
                        { class: "dp-alert-icon" },
                        svgIcon(
                            [
                                "M12 9v4",
                                "M12 17h.01",
                                "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z",
                            ],
                            18
                        )
                    ),
                    h("p", { class: "dp-alert-text" }, this.error)
                )
            )
        );
    }

    renderDoctor() {
        const doctor = this.doctor;
        const services = Array.isArray(doctor.services) ? doctor.services : [];
        const singleService = services.length === 1 ? services[0] : null;

        return h(
            "div",
            { class: "patient-doctor-profile" },
            h(
                "div",
                { class: "dp-stack" },

                this.renderHeroCard(),

                doctor.bio
                    ? h(
                          "div",
                          { class: "dp-card" },
                          h("p", { class: "dp-eyebrow" }, "About"),
                          h("p", { class: "dp-bio" }, doctor.bio)
                      )
                    : null,

                services.length > 0
                    ? h(
                          "div",
                          { class: "dp-card" },
                          h("p", { class: "dp-eyebrow" }, "Consultation options"),
                          h(
                              "div",
                              { class: "public-services" },
                              ...services.map(s => this.renderService(s, services.length > 1))
                          )
                      )
                    : h(
                          "div",
                          { class: "dp-card" },
                          h(
                              "p",
                              { class: "dp-bio", style: "text-align: center;" },
                              "This doctor isn't currently accepting online bookings."
                          )
                      ),

                singleService
                    ? h(
                          "button",
                          {
                              class: "dp-continue",
                              type: "button",
                              onclick: () => this.handleBookClick(singleService.id),
                          },
                          h("span", null, `Book ${this.getDisplayName()}`),
                          svgIcon(ARROW_ICON, 18)
                      )
                    : null
            )
        );
    }

    renderHeroCard() {
        const doctor = this.doctor;
        const displayName = this.getDisplayName();
        const initial = (doctor.full_name || "?").charAt(0).toUpperCase();

        return h(
            "div",
            { class: "dp-card dp-hero-card" },
            doctor.avatar_url
                ? h("img", {
                      class: "dp-avatar",
                      src: api.resolveUrl(doctor.avatar_url),
                      alt: doctor.full_name || displayName,
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
                h("h2", { class: "dp-name" }, displayName),
                h("span", { class: "dp-chip" }, doctor.specialization || "General Practice"),
                doctor.years_of_experience
                    ? h("p", { class: "dp-meta" }, `${doctor.years_of_experience} years of experience`)
                    : null,
                doctor.clinic_name ? h("p", { class: "dp-meta" }, doctor.clinic_name) : null
            )
        );
    }

    renderService(service, showBookButton) {
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
            { class: "public-service" },
            h(
                "div",
                { class: "public-service__head" },
                h("span", { class: "public-service__name" }, service.display_name),
                price != null
                    ? h(
                          "span",
                          { class: "public-service__price" },
                          `₦${Number(price).toLocaleString()}`
                      )
                    : null
            ),

            service.duration_minutes || showFollowUp
                ? h(
                      "p",
                      { class: "public-service__meta" },
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

            service.description ? h("p", { class: "public-service__desc" }, service.description) : null,

            scheduleLines.length > 0
                ? h(
                      "div",
                      { class: "public-service__schedule" },
                      ...scheduleLines.map(({ days, time }) =>
                          h(
                              "p",
                              { class: "public-service__schedule-line" },
                              svgIcon(CLOCK_ICON, 12),
                              h("span", null, `${days} · ${time}`)
                          )
                      )
                  )
                : null,

            isHomeVisit && note
                ? h(
                      "p",
                      { class: "public-service__locations" },
                      svgIcon(LOCATION_ICON, 12),
                      h("span", null, `Locations covered: ${note}`)
                  )
                : null,

            showBookButton
                ? h(
                      "button",
                      {
                          type: "button",
                          class: "public-service__book",
                          onclick: () => this.handleBookClick(service.id),
                      },
                      h("span", null, "Book"),
                      svgIcon(ARROW_ICON, 14)
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
