// js/components/patient/BookingForm.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import api from "../../services/api.js";

const icon = (paths, size = 18) => h("svg", { viewBox: "0 0 24 24", fill: "none", width: String(size), height: String(size), "aria-hidden": "true" }, ...paths.map(d => h("path", { d, stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round" })));

export default class BookingForm extends Component {
    /**
     * @param {object} patient
     * @param {object} doctor - selected doctor, at minimum { doctor_id, full_name }
     * @param {object|null} triageResult - result from TriageForm, or null if skipped
     * @param {(booking: object) => void} onBookingComplete
     * @param {() => void} onBack
     */
    constructor(patient, doctor, triageResult, preselectedServiceId, onBookingComplete, onBack) {
        super();
        this.patient = patient ?? {};
        this.doctor = doctor ?? {};
        this.triageResult = triageResult ?? null;
        this.preselectedServiceId = preselectedServiceId || null;
        this.onBookingComplete = onBookingComplete;
        this.onBack = onBack;

        this.loading = true;
        this.loadError = "";

        this.doctorProfile = null;
        this.services = [];

        this.selectedServiceId = "";
        this.feeType = "first_time";
        this.bookingDate = "";
        this.useCustomDate = false;
        this.showAllTimes = false;    
        this.consentGiven = false;
        this.emergencyAcknowledged = false;

        this.submitting = false;
        this.submitError = "";
    }

    async afterMount() {
        await this.loadDoctorProfile();
    
        if (this.selectedServiceId && !this.bookingDate) {
            const service = this.getSelectedService();
            if (service) {
                const first = this.findFirstAvailableSlot(service);
                if (first) {
                    this.bookingDate = `${first.dateStr}T${first.timeStr}`;
                    this.update();
                }
            }
        }
    }

    // ---------- Data loading ----------

    async loadDoctorProfile() {
        this.loading = true;
        this.loadError = "";
        this.update();

        try {
            const res = await api.get(`/directory/${this.doctor.doctor_id}`);
            const profile = res.data || res;
            this.doctorProfile = profile;
            this.services = profile.services || [];

            if (this.preselectedServiceId && this.services.some(s => s.id === this.preselectedServiceId)) {
                this.selectedServiceId = this.preselectedServiceId;
            } else if (this.services.length === 1) {
                this.selectedServiceId = this.services[0].id;
            }
        } catch (error) {
            console.error("Failed to load doctor profile:", error);
            this.loadError = error.message || "Failed to load this doctor's details.";
        } finally {
            this.loading = false;
            this.update();
        }
    }

    // ---------- Derived ----------

    getSelectedService() {
        return this.services.find(s => s.id === this.selectedServiceId) || null;
    }

    getSelectedPrice() {
        const service = this.getSelectedService();
        if (!service) return null;
        return this.feeType === "follow_up"
            ? service.follow_up_price_amount
            : service.first_time_price_amount;
    }
    // ---------- Schedule helpers ----------

    formatTimeLabel(time24) {
        if (!time24 || typeof time24 !== "string") return "";
        const [hh, mm] = time24.split(":");
        const hour = Number(hh);
        if (!Number.isInteger(hour)) return time24;
        const ampm = hour >= 12 ? "PM" : "AM";
        const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        return mm === "00" ? `${h12} ${ampm}` : `${h12}:${mm} ${ampm}`;
    }
    
    getScheduleLines(schedule) {
        if (!schedule || typeof schedule !== "object") return [];
        const ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
        const SHORT = {
            monday: "Mon", tuesday: "Tue", wednesday: "Wed",
            thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun",
        };
    
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
            const indices = keys.map(k => ORDER.indexOf(k)).filter(i => i >= 0).sort((a, b) => a - b);
    
            const parts = [];
            let runStart = indices[0];
            let runEnd = indices[0];
            const flush = () => {
                const count = runEnd - runStart + 1;
                const a = SHORT[ORDER[runStart]];
                const b = SHORT[ORDER[runEnd]];
                if (count === 1) parts.push(a);
                else if (count === 2) parts.push(`${a}, ${b}`);
                else parts.push(`${a}–${b}`);
            };
            for (let i = 1; i < indices.length; i++) {
                if (indices[i] === runEnd + 1) runEnd = indices[i];
                else { flush(); runStart = indices[i]; runEnd = indices[i]; }
            }
            flush();
    
            lines.push({
                days: parts.join(", "),
                time: `${this.formatTimeLabel(start)} – ${this.formatTimeLabel(end)}`,
            });
        }
        return lines;
    }
    
    toLocalDateStr(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    }
    
    getNextNDays(n = 14) {
        const days = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        for (let i = 0; i < n; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() + i);
            days.push(d);
        }
        return days;
    }
    
    getDayAvailability(date, service) {
        const schedule = service?.availability_schedule;
        if (!schedule || typeof schedule !== "object" || Object.keys(schedule).length === 0) {
            return { hasSchedule: false, enabled: true, start: null, end: null };
        }
        const dayKey = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][date.getDay()];
        const slot = schedule[dayKey];
        return {
            hasSchedule: true,
            enabled: !!slot?.enabled,
            start: slot?.start || null,
            end: slot?.end || null,
        };
    }
    
    getTimeSlots(date, service) {
        const avail = this.getDayAvailability(date, service);
        if (!avail.hasSchedule || !avail.enabled || !avail.start || !avail.end) return [];
    
        const [sH, sM] = avail.start.split(":").map(Number);
        const [eH, eM] = avail.end.split(":").map(Number);
        const startMin = sH * 60 + sM;
        const endMin = eH * 60 + eM;
    
        // 30-minute increments; service must fit within the doctor's window.
        const slots = [];
        for (let m = startMin; m + 30 <= endMin; m += 30) {
            const h = Math.floor(m / 60);
            const mm = m % 60;
            slots.push(`${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
        }
    
        // For today, drop times in the past.
        const todayStr = this.toLocalDateStr(new Date());
        if (this.toLocalDateStr(date) === todayStr) {
            const now = new Date();
            const nowMin = now.getHours() * 60 + now.getMinutes();
            return slots.filter(t => {
                const [h, m] = t.split(":").map(Number);
                return h * 60 + m > nowMin;
            });
        }
    
        return slots;
    }
    
    getSelectedDayStr() {
        if (!this.bookingDate) return null;
        const idx = this.bookingDate.indexOf("T");
        return idx >= 0 ? this.bookingDate.slice(0, idx) : this.bookingDate;
    }
    
    getSelectedTimeStr() {
        if (!this.bookingDate) return null;
        const idx = this.bookingDate.indexOf("T");
        return idx >= 0 ? this.bookingDate.slice(idx + 1, idx + 6) : null;
    }
    
    setSelectedDay(dateStr) {
        const service = this.getSelectedService();
        const date = new Date(`${dateStr}T00:00:00`);
        const slots = this.getTimeSlots(date, service);
        if (slots.length === 0) return;
    
        const currentTime = this.getSelectedTimeStr();
        const newTime = slots.includes(currentTime) ? currentTime : slots[0];
    
        this.bookingDate = `${dateStr}T${newTime}`;
        this.showAllTimes = false;   
        this.update();
    }
    
    setSelectedTime(timeStr) {
        const dayStr = this.getSelectedDayStr();
        if (!dayStr) return;
        this.bookingDate = `${dayStr}T${timeStr}`;
        this.update();
    }
    
    findFirstAvailableSlot(service) {
        for (const day of this.getNextNDays(14)) {
            const slots = this.getTimeSlots(day, service);
            if (slots.length > 0) {
                return { dateStr: this.toLocalDateStr(day), timeStr: slots[0] };
            }
        }
        return null;
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
    
    getScheduleLines(schedule) {
        if (!schedule || typeof schedule !== "object") return [];
        const DAY_ORDER = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
        const SHORT = {
            monday: "Mon", tuesday: "Tue", wednesday: "Wed",
            thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun",
        };
    
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
            const indices = dayKeys
                .map(k => DAY_ORDER.indexOf(k))
                .filter(i => i >= 0)
                .sort((a, b) => a - b);
    
            const parts = [];
            let runStart = indices[0];
            let runEnd = indices[0];
            const flush = () => {
                const count = runEnd - runStart + 1;
                const a = SHORT[DAY_ORDER[runStart]];
                const b = SHORT[DAY_ORDER[runEnd]];
                if (count === 1) parts.push(a);
                else if (count === 2) parts.push(`${a}, ${b}`);
                else parts.push(`${a}–${b}`);
            };
            for (let i = 1; i < indices.length; i++) {
                if (indices[i] === runEnd + 1) runEnd = indices[i];
                else { flush(); runStart = indices[i]; runEnd = indices[i]; }
            }
            flush();
    
            lines.push({
                days: parts.join(", "),
                time: `${this.formatTimeLabel(start)} – ${this.formatTimeLabel(end)}`,
            });
        }
        return lines;
    }
    
    isDateInSchedule(dateStr, service) {
        if (!dateStr || !service?.availability_schedule) return { ok: true };
        const schedule = service.availability_schedule;
        if (typeof schedule !== "object" || Object.keys(schedule).length === 0) {
            return { ok: true };
        }
    
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return { ok: true };
    
        const dayKey = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][date.getDay()];
        const slot = schedule[dayKey];
    
        if (!slot || !slot.enabled) {
            return {
                ok: false,
                reason: `The doctor isn't available on ${dayKey.charAt(0).toUpperCase() + dayKey.slice(1)}s.`,
            };
        }
    
        const hh = String(date.getHours()).padStart(2, "0");
        const mm = String(date.getMinutes()).padStart(2, "0");
        const time = `${hh}:${mm}`;
    
        if (time < slot.start || time >= slot.end) {
            return {
                ok: false,
                reason: `On this day the doctor is only available ${this.formatTimeLabel(slot.start)} – ${this.formatTimeLabel(slot.end)}.`,
            };
        }
    
        return { ok: true };
    }

    buildReasonText() {
        if (!this.triageResult) return "";

        const parts = [];
        if (this.triageResult.symptoms?.length) {
            parts.push(`Symptoms: ${this.triageResult.symptoms.join(", ")}`);
        }
        if (this.triageResult.duration) {
            parts.push(`Duration: ${this.triageResult.duration}`);
        }
        if (this.triageResult.patient_summary) {
            parts.push(`Notes: ${this.triageResult.patient_summary}`);
        }
        if (this.triageResult.urgency_level) {
            parts.push(`Urgency: ${this.triageResult.urgency_level}`);
        }
        return parts.join(" | ");
    }

    isFormValid() {
        const service = this.getSelectedService();
        const scheduleOk = this.isDateInSchedule(this.bookingDate, service).ok;
    
        return (
            this.selectedServiceId &&
            this.bookingDate &&
            scheduleOk &&
            this.consentGiven &&
            this.emergencyAcknowledged
        );
    }

    // ---------- Actions ----------

    setField(field, value) {
        this[field] = value;
        this.update();
    }

    async submitBooking() {
        if (!this.isFormValid() || this.submitting) return;

        this.submitting = true;
        this.submitError = "";
        this.update();

        try {
            const res = await api.post("/bookings", {
                doctor_id: this.doctor.doctor_id,
                booking_date: new Date(this.bookingDate).toISOString(),
                reason: this.buildReasonText(),
                consultation_service_id: this.selectedServiceId,
                consultation_fee_type: this.feeType,
                patient_consent_given: true,
                emergency_acknowledged: true,
            });
            const booking = res.data || res;

            if (typeof this.onBookingComplete === "function") {
                this.onBookingComplete(booking);
            }
        } catch (error) {
            console.error("Failed to create booking:", error);
            this.submitError = error.message || "Failed to submit your booking request.";
        } finally {
            this.submitting = false;
            this.update();
        }
    }

    // ---------- Render ----------

    render() {
        return h(
            "div",
            { class: "booking-form" },
            this.renderHeader(),
            this.loading
                ? this.renderLoading()
                : this.loadError
                ? this.renderLoadError()
                : this.renderForm()
        );
    }

    renderHeader() {
        const name = this.doctorProfile?.full_name || this.doctor.full_name || "Doctor";
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
                    h("p", { class: "dashboard-greeting" }, "Book appointment"),
                    h("h1", { class: "dashboard-title" }, name)
                )
            )
        );
    }
    renderLoading() {
        return h(
            "div",
            { class: "bf-card" },
            h("div", { class: "bf-skel bf-skel--line" }),
            h("div", { class: "bf-skel bf-skel--field" }),
            h("div", { class: "bf-skel bf-skel--field" }),
            h("div", { class: "bf-skel bf-skel--field" }),
            h("div", { class: "bf-skel bf-skel--btn" })
        );
    }

    renderLoadError() {
        return h(
            "div",
            { class: "bf-alert bf-alert--danger", role: "alert" },
            h(
                "div",
                { class: "bf-alert-icon" },
                icon(["M12 9v4", "M12 17h.01", "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"], 18)
            ),
            h("p", { class: "bf-alert-text" }, this.loadError)
        );
    }
    renderForm() {
        const price = this.getSelectedPrice();
        return h(
            "div",
            { class: "bf-stack" },

            this.submitError
                ? h(
                      "div",
                      { class: "bf-alert bf-alert--danger", role: "alert" },
                      h(
                          "div",
                          { class: "bf-alert-icon" },
                          icon(["M12 9v4", "M12 17h.01", "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"], 18)
                      ),
                      h("p", { class: "bf-alert-text" }, this.submitError)
                  )
                : null,

            h(
                "div",
                { class: "bf-card" },

                // Consultation type
                h(
                    "div",
                    { class: "bf-field" },
                    h("label", { class: "bf-label", for: "bf-service" }, "Consultation type"),
                    this.services.length === 0
                        ? h("p", { class: "bf-empty-inline" }, "This doctor has no consultation services available right now.")
                        : h(
                              "div",
                              { class: "bf-select-wrap" },
                              h(
                                  "select",
                                  {
                                      id: "bf-service",
                                      class: "bf-select",
                                      value: this.selectedServiceId,
                                      onchange: e => {
                                            this.selectedServiceId = e.target.value;
                                            this.useCustomDate = false;
                                            this.bookingDate = "";
                                        
                                            // Re-pick the first available slot for the newly selected service.
                                            const service = this.getSelectedService();
                                            if (service) {
                                                const first = this.findFirstAvailableSlot(service);
                                                if (first) this.bookingDate = `${first.dateStr}T${first.timeStr}`;
                                            }
                                            this.update();
                                        },
                                  },
                                  h("option", { value: "" }, "Select a service..."),
                                  this.services.map(service =>
                                      h("option", { value: service.id }, service.display_name)
                                  )
                              ),
                              h("span", { class: "bf-select-chevron" }, icon(["M6 9l6 6 6-6"], 16))
                          )
                ),

                // Visit type
                h(
                    "div",
                    { class: "bf-field" },
                    h("label", { class: "bf-label", for: "bf-fee" }, "Visit type"),
                    h(
                        "div",
                        { class: "bf-select-wrap" },
                        h(
                            "select",
                            {
                                id: "bf-fee",
                                class: "bf-select",
                                value: this.feeType,
                                onchange: e => this.setField("feeType", e.target.value),
                            },
                            h("option", { value: "first_time" }, "First-time consultation"),
                            h("option", { value: "follow_up" }, "Follow-up consultation")
                        ),
                        h("span", { class: "bf-select-chevron" }, icon(["M6 9l6 6 6-6"], 16))
                    )
                ),

                // Fee display
                price != null
                    ? h(
                          "div",
                          { class: "bf-fee-card" },
                          h(
                              "div",
                              { class: "bf-fee-icon" },
                              icon(
                                  [
                                      "M7 5v14",
                                      "M17 5v14",
                                      "M7 5l10 14",
                                      "M4 10h16",
                                      "M4 14h16",
                                  ],
                                  18
                              )
                          ),
                          h(
                              "div",
                              { class: "bf-fee-body" },
                              h("span", { class: "bf-fee-label" }, "Consultation fee"),
                              h("span", { class: "bf-fee-value" }, `₦${Number(price).toLocaleString()}`)
                          )
                      )
                    : null,

                this.renderDateTimePicker(),
                // Triage summary
                this.triageResult
                    ? h(
                          "div",
                          { class: "bf-field" },
                          h("label", { class: "bf-label" }, "What you told us"),
                          h(
                              "div",
                              { class: "bf-note" },
                              h(
                                  "div",
                                  { class: "bf-note-icon" },
                                  icon(["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M16 13H8", "M16 17H8", "M10 9H8"], 16)
                              ),
                              h("p", { class: "bf-note-text" }, this.buildReasonText() || "No additional details provided.")
                          )
                      )
                    : null,

                // Consent
                h(
                    "label",
                    { class: "bf-consent" },
                    h("input", {
                        type: "checkbox",
                        class: "bf-checkbox",
                        checked: this.consentGiven,
                        onchange: e => this.setField("consentGiven", e.target.checked),
                    }),
                    h("span", { class: "bf-consent-box" }, icon(["M20 6L9 17l-5-5"], 14)),
                    h(
                        "span",
                        { class: "bf-consent-text" },
                        "I consent to this online consultation and understand my information will be shared with the doctor I've selected."
                    )
                ),

                h(
                    "label",
                    { class: "bf-consent" },
                    h("input", {
                        type: "checkbox",
                        class: "bf-checkbox",
                        checked: this.emergencyAcknowledged,
                        onchange: e => this.setField("emergencyAcknowledged", e.target.checked),
                    }),
                    h("span", { class: "bf-consent-box" }, icon(["M20 6L9 17l-5-5"], 14)),
                    h(
                        "span",
                        { class: "bf-consent-text" },
                        "I understand this platform is not for medical emergencies, and I will seek emergency care directly if needed."
                    )
                )
            ),

            // Submit
            h(
                "button",
                {
                    class: "bf-submit",
                    type: "button",
                    disabled: !this.isFormValid() || this.submitting,
                    onclick: () => this.submitBooking(),
                },
                this.submitting
                    ? h("span", { class: "bf-spinner" })
                    : icon(["M5 12h14", "M12 5l7 7-7 7"], 18),
                h("span", null, this.submitting ? "Sending request…" : "Request appointment")
            )
        );
    }
    renderDateTimePicker() {
        const service = this.getSelectedService();
        const scheduleLines = this.getScheduleLines(service?.availability_schedule);
        const hasSchedule = scheduleLines.length > 0;
    
        // No schedule → fall back to native datetime input (existing behavior)
        if (!hasSchedule) return this.renderNativeDateInput();
    
        // Patient explicitly asked to suggest a custom time
        if (this.useCustomDate) {
            return h(
                "div",
                { class: "bf-field" },
                h("label", { class: "bf-label", for: "bf-date" }, "Preferred date and time"),
                h(
                    "div",
                    { class: "bf-input-wrap" },
                    h(
                        "span",
                        { class: "bf-input-icon" },
                        icon(["M8 2v4", "M16 2v4", "M3 10h18", "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2"], 16)
                    ),
                    h("input", {
                        id: "bf-date",
                        type: "datetime-local",
                        class: "bf-input bf-input--with-icon",
                        value: this.bookingDate,
                        oninput: e => this.setField("bookingDate", e.target.value),
                    })
                ),
                h(
                    "p",
                    { class: "bf-hint" },
                    "This is outside the doctor's usual hours. They may suggest a different time."
                ),
                h(
                    "button",
                    {
                        type: "button",
                        class: "bf-custom-toggle",
                        onclick: () => {
                            this.useCustomDate = false;
                            this.bookingDate = "";
                            const first = this.findFirstAvailableSlot(service);
                            if (first) this.bookingDate = `${first.dateStr}T${first.timeStr}`;
                            this.update();
                        },
                    },
                    "← Back to available times"
                )
            );
        }
    
        // Standard slot picker
        const days = this.getNextNDays(14);
        const selectedDay = this.getSelectedDayStr();
        const selectedTime = this.getSelectedTimeStr();
        const todayStr = this.toLocalDateStr(new Date());
    
        const dayRows = days.map(d => {
            const dateStr = this.toLocalDateStr(d);
            const avail = this.getDayAvailability(d, service);
            const slots = this.getTimeSlots(d, service);
            const isAvailable = avail.enabled && slots.length > 0;
            return { date: d, dateStr, isAvailable };
        });
    
        const selectedDate = selectedDay ? new Date(`${selectedDay}T00:00:00`) : null;
        const timeSlots = selectedDate ? this.getTimeSlots(selectedDate, service) : [];
    
        const SHORT_WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    
        return h(
            "div",
            { class: "bf-field" },
            h("label", { class: "bf-label" }, "Preferred date and time"),
    
            // Compact availability reference
            h(
                "div",
                { class: "bf-hours-compact" },
                ...scheduleLines.map(({ days: dayLabel, time }) =>
                    h(
                        "p",
                        { class: "bf-hours-line" },
                        icon(["M12 8v4l3 2", "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20"], 12),
                        h("span", null, `${dayLabel} · ${time}`)
                    )
                )
            ),
            h("p", { class: "bf-pick-hint" }, "Select from available date and time slots below"),
    
            // Day strip
            h(
                "div",
                { class: "bf-day-strip", role: "radiogroup", "aria-label": "Choose a day" },
                ...dayRows.map(row =>
                    h(
                        "button",
                        {
                            type: "button",
                            class: `bf-day-chip${!row.isAvailable ? " bf-day-chip--disabled" : ""}${selectedDay === row.dateStr ? " bf-day-chip--selected" : ""}`,
                            disabled: !row.isAvailable,
                            role: "radio",
                            "aria-checked": selectedDay === row.dateStr ? "true" : "false",
                            onclick: () => this.setSelectedDay(row.dateStr),
                        },
                        h("span", { class: "bf-day-chip__weekday" }, SHORT_WEEKDAY[row.date.getDay()]),
                        h("span", { class: "bf-day-chip__num" }, String(row.date.getDate()))
                    )
                )
            ),
    
            // Time grid (capped at 8 unless expanded)
            (() => {
                if (timeSlots.length === 0) {
                    return h(
                        "p",
                        { class: "bf-time-empty" },
                        selectedDay ? "No more times left for this day." : "Pick a day to see available times."
                    );
                }
            
                const CAP = 8;
                const visibleSlots = this.showAllTimes ? timeSlots : timeSlots.slice(0, CAP);
                const hiddenCount = timeSlots.length - visibleSlots.length;
            
                return h(
                    "div",
                    { class: "bf-time-grid-wrap" },
                    h(
                        "div",
                        { class: "bf-time-grid", role: "radiogroup", "aria-label": "Choose a time" },
                        ...visibleSlots.map(t =>
                            h(
                                "button",
                                {
                                    type: "button",
                                    class: `bf-time-slot${selectedTime === t ? " bf-time-slot--selected" : ""}`,
                                    role: "radio",
                                    "aria-checked": selectedTime === t ? "true" : "false",
                                    onclick: () => this.setSelectedTime(t),
                                },
                                this.formatTimeLabel(t)
                            )
                        )
                    ),
                    hiddenCount > 0
                        ? h(
                              "button",
                              {
                                  type: "button",
                                  class: "bf-time-expand",
                                  onclick: () => {
                                      this.showAllTimes = true;
                                      this.update();
                                  },
                              },
                              h("span", null, `Show ${hiddenCount} more time${hiddenCount === 1 ? "" : "s"}`),
                              icon(["M6 9l6 6 6-6"], 14)
                          )
                        : null
                );
            })(),
    
            h(
                "p",
                { class: "bf-hint" },
                "This is your requested time. The doctor may confirm it or suggest another time."
            )
    
            
        );
    }
    
    renderNativeDateInput() {
        const now = new Date();
        const pad = n => String(n).padStart(2, "0");
        const minLocal = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    
        return h(
            "div",
            { class: "bf-field" },
            h("label", { class: "bf-label", for: "bf-date" }, "Preferred date and time"),
            h(
                "div",
                { class: "bf-input-wrap" },
                h(
                    "span",
                    { class: "bf-input-icon" },
                    icon(["M8 2v4", "M16 2v4", "M3 10h18", "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2"], 16)
                ),
                h("input", {
                    id: "bf-date",
                    type: "datetime-local",
                    class: "bf-input bf-input--with-icon",
                    min: minLocal,
                    value: this.bookingDate,
                    oninput: e => this.setField("bookingDate", e.target.value),
                })
            ),
            h(
                "p",
                { class: "bf-hint" },
                "This is your requested time. The doctor may confirm it or suggest another time."
            )
        );
    }

    update() {
        if (!this.el) return;
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
    }
}
