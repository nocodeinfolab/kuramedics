import { Component } from "../../../core/component.js";
import { h } from "../../../utils/dom.js";
import doctorConsultationService from "../../../services/doctorConsultationService.js";

const icon = (paths, size = 18) => h("svg", { viewBox: "0 0 24 24", fill: "none", width: String(size), height: String(size), "aria-hidden": "true" }, ...paths.map(d => h("path", { d, stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round" })));

const SERVICE_TYPE_OPTIONS = [
    { value: "video_consultation", label: "Video Consultation" },
    { value: "voice_consultation", label: "Voice Consultation" },
    { value: "chat_consultation", label: "Chat Consultation" },
    { value: "home_visit", label: "Home Visit Consultation" },
    { value: "walk_in_clinic", label: "Walk-in Clinic Consultation" }
];

const WEEKDAYS = [
    { key: "monday",    label: "Monday" },
    { key: "tuesday",   label: "Tuesday" },
    { key: "wednesday", label: "Wednesday" },
    { key: "thursday",  label: "Thursday" },
    { key: "friday",    label: "Friday" },
    { key: "saturday",  label: "Saturday" },
    { key: "sunday",    label: "Sunday" },
];

export default class DoctorConsultationServicesPage extends Component {
    constructor(doctor = {}, onBack = () => {}) {
        super();
        this.doctor = doctor;
        this.onBack = onBack;

        this.loading = true;
        this.saving = false;
        this.services = [];
        this.error = null;
        this.successMsg = null;

        this.isModalOpen = false;
        this.editingServiceId = null;
        this.formData = this.getInitialFormData();
    }

    getEmptySchedule() {
        const schedule = {};
        for (const { key } of WEEKDAYS) {
            schedule[key] = { enabled: false, start: "09:00", end: "17:00" };
        }
        return schedule;
    }
    
    getScheduleFromService(service) {
        // Defensive: backend may return null, {}, or a partial object.
        const base = this.getEmptySchedule();
        const incoming = service?.availability_schedule || {};
        for (const { key } of WEEKDAYS) {
            const entry = incoming[key];
            if (entry && entry.enabled) {
                base[key] = {
                    enabled: true,
                    start: entry.start || "09:00",
                    end: entry.end || "17:00",
                };
            }
        }
        return base;
    }
    
    setScheduleDay(dayKey, patch) {
        this.formData.availability_schedule = {
            ...this.formData.availability_schedule,
            [dayKey]: { ...this.formData.availability_schedule[dayKey], ...patch },
        };
    }
    
    formatTimeLabel(value) {
        if (!value || typeof value !== "string") return "";
        const [hh, mm] = value.split(":");
        const hour = Number(hh);
        if (Number.isNaN(hour)) return "";
        const ampm = hour >= 12 ? "PM" : "AM";
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        return `${displayHour}${mm === "00" ? "" : `:${mm}`} ${ampm}`;
    }
    
    formatScheduleForDisplay(schedule) {
        if (!schedule || typeof schedule !== "object") return "";
        const parts = [];
        for (const { key, label } of WEEKDAYS) {
            const entry = schedule[key];
            if (!entry?.enabled) continue;
            parts.push(`${label.slice(0, 3)} ${this.formatTimeLabel(entry.start)}–${this.formatTimeLabel(entry.end)}`);
        }
        return parts.join(" · ");
    }

    getInitialFormData() {
        return {
            service_type: "video_consultation",
            display_name: "Video Consultation",
            description: "",
            price_naira: 5000,
            first_time_price_amount: 5000,
            follow_up_price_amount: 3000,
            duration_minutes: 30,
            is_enabled: true,
            requires_payment: true,
            availability_note: "",
            availability_schedule: this.getEmptySchedule(),
        };
    }

    afterMount() {
        this.fetchServices();
    }

    async fetchServices() {
        this.loading = true;
        this.error = null;
        this.update();             
    
        try {
            const res = await doctorConsultationService.getServices();
            this.services = Array.isArray(res) ? res : [];
        } catch (err) {
            console.error("Failed to load consultation services:", err);
            this.error = err.message || "Failed to load services.";
        } finally {
            this.loading = false;
            this.update();          
        }
    }

    handleOpenModal(service = null) {
        if (service) {
            this.editingServiceId = service.id || service.service_id;
            this.formData = {
                service_type: service.service_type || "video_consultation",
                display_name: service.display_name || "",
                description: service.description || "",
                price_naira: service.price_naira || 5000,
                first_time_price_amount: service.first_time_price_amount || 5000,
                follow_up_price_amount: service.follow_up_price_amount || 0,
                duration_minutes: service.duration_minutes || 30,
                is_enabled: service.is_enabled ?? true,
                requires_payment: service.requires_payment ?? true,
                availability_note: service.availability_note || "",
                availability_schedule: this.getScheduleFromService(service),
            };
        } else {
            this.editingServiceId = null;
            this.formData = this.getInitialFormData();
        }
        this.isModalOpen = true;
        this.saving = false;
        this.error = null;
        this.successMsg = null;
        this.update();                 
    }
    
    handleCloseModal() {
        this.isModalOpen = false;
        this.editingServiceId = null;
        this.saving = false;
        this.formData = this.getInitialFormData();
        this.update();
    }
    
    async handleSubmit(e) {
        e.preventDefault();
        this.saving = true;
        this.error = null;
        this.successMsg = null;
        this.update();
    
        try {
            const firstTimePrice = Number(this.formData.first_time_price_amount || this.formData.price_naira);
            const payload = {
                ...this.formData,
                price_naira: firstTimePrice,
                first_time_price_amount: firstTimePrice,
                follow_up_price_amount: Number(this.formData.follow_up_price_amount),
                duration_minutes: Number(this.formData.duration_minutes)
            };
    
            if (this.editingServiceId) {
                await doctorConsultationService.updateService(this.editingServiceId, payload);
                this.successMsg = "Service updated successfully.";
            } else {
                await doctorConsultationService.createService(payload);
                this.successMsg = "Service created successfully.";
            }
    
            this.handleCloseModal();
            await this.fetchServices();
        } catch (err) {
            console.error("Failed to save consultation service:", err);
            this.error = err.message || "Failed to save service.";
        } finally {
            this.saving = false; 
            this.update();
        }
    }

    async handleToggleStatus(service) {
        const serviceId = service.id || service.service_id;
        const newStatus = !service.is_enabled;
        const actionText = newStatus ? "enable" : "disable";

        if (!confirm(`Are you sure you want to ${actionText} this consultation service?`)) return;

        try {
            if (newStatus) {
                // Re-enable service via update endpoint
                await doctorConsultationService.updateService(serviceId, { ...service, is_enabled: true });
                this.successMsg = "Service enabled successfully.";
            } else {
                // Disable service
                await doctorConsultationService.deleteService(serviceId);
                this.successMsg = "Service disabled successfully.";
            }
            await this.fetchServices();
        } catch (err) {
            console.error(`Failed to ${actionText} service:`, err);
            this.error = err.message || `Failed to ${actionText} service.`;
            this.update(); 
        }
    }

    render() {
        return h(
            "div",
            { class: "consultation-services-page" },
            this.renderHeader(),
            h(
                "div",
                { class: "cs-body" },
                this.renderAlerts(),
                this.loading ? this.renderSkeleton() : this.renderServiceList()
            ),
            this.isModalOpen ? this.renderModal() : null
        );
    }

    renderSkeleton() {
        return h(
            "div",
            { class: "cs-skel-stack", "aria-busy": "true", "aria-label": "Loading services" },
            ...[0, 1].map(() =>
                h(
                    "div",
                    { class: "cs-card cs-card--skeleton" },
                    h(
                        "div",
                        { class: "cs-card__head" },
                        h(
                            "div",
                            { class: "cs-skel-body" },
                            h("div", { class: "cs-skel cs-skel--line cs-skel--short" }),
                            h("div", { class: "cs-skel cs-skel--line cs-skel--tiny" })
                        ),
                        h("div", { class: "cs-skel cs-skel--chip" })
                    ),
                    h("div", { class: "cs-skel cs-skel--block" })
                )
            )
        );
    }

    renderHeader() {
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
                icon(["M15 18l-6-6 6-6"], 14),
                h("span", {}, "Settings")
            ),
            h("h1", { class: "page-hero__title" }, "Consultation Services"),
            h(
                "p",
                { class: "page-hero__subtitle" },
                "Set up rates, durations, and availability notes for your services."
            )
        );
    }
    renderAlerts() {
        const alerts = [];
        if (this.error) {
            alerts.push(
                h(
                    "div",
                    { class: "q-alert q-alert--error", role: "alert" },
                    icon(["M12 9v4", "M12 17h.01", "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"], 18),
                    h("span", {}, this.error)
                )
            );
        }
        if (this.successMsg) {
            alerts.push(
                h(
                    "div",
                    { class: "q-alert q-alert--success", role: "status" },
                    icon(["M20 6L9 17l-5-5"], 18),
                    h("span", {}, this.successMsg)
                )
            );
        }
        return alerts;
    }

    renderServiceList() {
        if (!this.services || this.services.length === 0) {
            return h(
                "div",
                { class: "cs-empty" },
                h(
                    "div",
                    { class: "cs-empty__icon" },
                    icon(
                        [
                            "M20 7h-4.18A3 3 0 0 0 13 4h-2a3 3 0 0 0-2.82 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z",
                            "M9 4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1H9z",
                            "M12 11v6",
                            "M9 14h6"
                        ],
                        22
                    )
                ),
                h("p", { class: "cs-empty__title" }, "No services yet"),
                h(
                    "p",
                    { class: "cs-empty__text" },
                    "Add your consultation types, rates, and availability so patients can book with you."
                ),
                h(
                    "button",
                    {
                        class: "cs-primary-btn",
                        type: "button",
                        onclick: () => this.handleOpenModal()
                    },
                    icon(["M12 5v14", "M5 12h14"], 16),
                    h("span", {}, "Create your first service")
                )
            );
        }

        return h(
            "div",
            { class: "cs-list" },
            this.services.map(service => this.renderServiceCard(service))
        );
    }
    renderServiceCard(service) {
        const isActive = service.is_enabled;

        return h(
            "article",
            { class: "cs-card" },

            h(
                "div",
                { class: "cs-card__head" },
                h(
                    "div",
                    { class: "cs-card__title-wrap" },
                    h("h3", { class: "cs-card__name" }, service.display_name || "Untitled service"),
                    h(
                        "span",
                        { class: `status-chip status-chip--${isActive ? "success" : "danger"}` },
                        isActive ? "Active" : "Disabled"
                    )
                ),
                h(
                    "button",
                    {
                        type: "button",
                        class: `cs-toggle ${isActive ? "cs-toggle--on" : "cs-toggle--off"}`,
                        "aria-label": isActive ? "Disable service" : "Enable service",
                        title: isActive ? "Disable service" : "Enable service",
                        onclick: () => this.handleToggleStatus(service)
                    },
                    icon(
                        isActive
                            ? ["M20 6L9 17l-5-5"]
                            : ["M18.36 6.64a9 9 0 1 1-12.73 0", "M12 2v10"],
                        18
                    )
                )
            ),

            h(
                "p",
                { class: "cs-card__desc" },
                service.description || "No description provided."
            ),

            h(
                "dl",
                { class: "cs-card__details" },
                h(
                    "div",
                    { class: "cs-detail" },
                    h("dt", { class: "cs-detail__label" }, "Duration"),
                    h(
                        "dd",
                        { class: "cs-detail__value" },
                        service.duration_minutes ? `${service.duration_minutes} min` : "N/A"
                    )
                ),
                h(
                    "div",
                    { class: "cs-detail" },
                    h("dt", { class: "cs-detail__label" }, "First-time"),
                    h(
                        "dd",
                        { class: "cs-detail__value" },
                        `₦${Number(service.first_time_price_amount || 0).toLocaleString()}`
                    )
                ),
                h(
                    "div",
                    { class: "cs-detail" },
                    h("dt", { class: "cs-detail__label" }, "Follow-up"),
                    h(
                        "dd",
                        { class: "cs-detail__value" },
                        service.follow_up_price_amount !== null
                            ? `₦${Number(service.follow_up_price_amount).toLocaleString()}`
                            : "N/A"
                    )
                )
            ),

            (() => {
                const scheduleStr = this.formatScheduleForDisplay(service.availability_schedule);
                const noteStr = (service.availability_note || "").trim();
                if (!scheduleStr && !noteStr) return null;
                return h(
                    "div",
                    { class: "cs-card__availability" },
                    scheduleStr
                        ? h(
                              "p",
                              { class: "cs-card__note" },
                              icon(["M12 8v4l3 2", "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20"], 14),
                              h("span", {}, scheduleStr)
                          )
                        : null,
                    noteStr
                        ? h(
                              "p",
                              { class: "cs-card__note cs-card__note--muted" },
                              h("span", {}, `Note: ${noteStr}`)
                          )
                        : null
                );
            })(),

            h(
                "div",
                { class: "cs-card__actions" },
                h(
                    "button",
                    {
                        type: "button",
                        class: "cs-edit-btn",
                        onclick: () => this.handleOpenModal(service)
                    },
                    icon(
                        [
                            "M12 20h9",
                            "M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
                        ],
                        15
                    ),
                    h("span", {}, "Edit")
                )
            )
        );
    }
    renderScheduleEditor() {
        return h(
            "div",
            { class: "cs-schedule" },
            h("p", { class: "cs-schedule__label" }, "Weekly availability"),
            h(
                "p",
                { class: "cs-schedule__hint" },
                "Pick the days and hours patients can book this service."
            ),
            ...WEEKDAYS.map(({ key, label }) => {
                const entry = this.formData.availability_schedule?.[key] || { enabled: false, start: "09:00", end: "17:00" };
                return h(
                    "div",
                    { class: `cs-schedule__row${entry.enabled ? " cs-schedule__row--on" : ""}` },
                    h(
                        "label",
                        { class: "cs-schedule__day", for: `sched-${key}` },
                        h("input", {
                            type: "checkbox",
                            id: `sched-${key}`,
                            checked: entry.enabled,
                            onchange: (e) => {
                                this.setScheduleDay(key, { enabled: e.target.checked });
                                this.update();
                            },
                        }),
                        h("span", { class: "cs-schedule__day-name" }, label)
                    ),
                    entry.enabled
                        ? h(
                              "div",
                              { class: "cs-schedule__time" },
                              h("input", {
                                  type: "time",
                                  class: "cs-schedule__input",
                                  value: entry.start,
                                  "aria-label": `${label} start time`,
                                  oninput: (e) => this.setScheduleDay(key, { start: e.target.value }),
                              }),
                              h("span", { class: "cs-schedule__dash" }, "–"),
                              h("input", {
                                  type: "time",
                                  class: "cs-schedule__input",
                                  value: entry.end,
                                  "aria-label": `${label} end time`,
                                  oninput: (e) => this.setScheduleDay(key, { end: e.target.value }),
                              })
                          )
                        : h("span", { class: "cs-schedule__off" }, "Not available")
                );
            })
        );
    }
    renderModal() {
        return h(
            "div",
            { class: "cs-sheet-overlay", role: "presentation" },
            h(
                "div",
                {
                    class: "cs-sheet",
                    role: "dialog",
                    "aria-modal": "true",
                    "aria-label": this.editingServiceId ? "Edit consultation service" : "Add consultation service"
                },

                h("div", { class: "cs-sheet__handle", "aria-hidden": "true" }),

                h(
                    "div",
                    { class: "cs-sheet__head" },
                    h(
                        "h2",
                        { class: "cs-sheet__title" },
                        this.editingServiceId ? "Edit service" : "Add service"
                    ),
                    h(
                        "button",
                        {
                            type: "button",
                            class: "cs-sheet__close",
                            "aria-label": "Close",
                            onclick: () => this.handleCloseModal()
                        },
                        icon(["M18 6L6 18", "M6 6l12 12"], 18)
                    )
                ),

                h(
                    "form",
                    { class: "cs-sheet__form", onsubmit: e => this.handleSubmit(e) },

                    h(
                        "div",
                        { class: "cs-sheet__body" },

                        h(
                            "div",
                            { class: "input-group" },
                            h(
                                "div",
                                { class: "form-group" },
                                h("label", { class: "form-label" }, "Service type"),
                                h(
                                    "select",
                                    {
                                        class: "form-input",
                                        disabled: !!this.editingServiceId,
                                        onchange: e => {
                                            const selected = SERVICE_TYPE_OPTIONS.find(opt => opt.value === e.target.value);
                                            this.formData.service_type = e.target.value;
                                            if (selected && !this.formData.display_name) {
                                                this.formData.display_name = selected.label;
                                            }
                                        }
                                    },
                                    SERVICE_TYPE_OPTIONS.map(opt =>
                                        h(
                                            "option",
                                            {
                                                value: opt.value,
                                                selected: this.formData.service_type === opt.value
                                            },
                                            opt.label
                                        )
                                    )
                                )
                            ),
                            h(
                                "div",
                                { class: "form-group" },
                                h("label", { class: "form-label" }, "Display name"),
                                h("input", {
                                    type: "text",
                                    class: "form-input",
                                    required: true,
                                    value: this.formData.display_name,
                                    oninput: e => (this.formData.display_name = e.target.value)
                                })
                            )
                        ),

                        h(
                            "div",
                            { class: "input-group" },
                            h(
                                "div",
                                { class: "form-group" },
                                h("label", { class: "form-label" }, "First-time price (₦)"),
                                h("input", {
                                    type: "number",
                                    class: "form-input",
                                    inputmode: "decimal",
                                    required: this.formData.is_enabled,
                                    min: this.formData.is_enabled ? 1 : 0,
                                    value: this.formData.first_time_price_amount,
                                    oninput: e => {
                                        this.formData.first_time_price_amount = e.target.value;
                                        this.formData.price_naira = e.target.value;
                                    }
                                })
                            ),
                            h(
                                "div",
                                { class: "form-group" },
                                h("label", { class: "form-label" }, "Follow-up price (₦)"),
                                h("input", {
                                    type: "number",
                                    class: "form-input",
                                    inputmode: "decimal",
                                    min: 0,
                                    value: this.formData.follow_up_price_amount,
                                    oninput: e => (this.formData.follow_up_price_amount = e.target.value)
                                })
                            )
                        ),

                        h(
                            "div",
                            { class: "form-group" },
                            h("label", { class: "form-label" }, "Duration (minutes)"),
                            h("input", {
                                type: "number",
                                class: "form-input",
                                inputmode: "numeric",
                                min: 5,
                                value: this.formData.duration_minutes,
                                oninput: e => (this.formData.duration_minutes = e.target.value)
                            })
                        ),

                        h(
                            "div",
                            { class: "form-group" },
                            h("label", { class: "form-label" }, "Description"),
                            h("textarea", {
                                class: "form-textarea",
                                rows: 3,
                                value: this.formData.description,
                                oninput: e => (this.formData.description = e.target.value)
                            })
                        ),

                        this.renderScheduleEditor(),

                        h(
                            "div",
                            { class: "form-group" },
                            h("label", { class: "form-label" }, "Exceptions note (optional)"),
                            h("input", {
                                type: "text",
                                class: "form-input",
                                placeholder: "e.g. Closed on public holidays",
                                value: this.formData.availability_note,
                                oninput: e => (this.formData.availability_note = e.target.value)
                            }),
                            h(
                                "p",
                                { class: "form-hint" },
                                "Use this for one-off exceptions. Regular hours are set above."
                            )
                        ),

                        h(
                            "div",
                            { class: "cs-checks" },
                            h(
                                "label",
                                { class: "cs-check", for: "chk_service_enabled" },
                                h("input", {
                                    type: "checkbox",
                                    id: "chk_service_enabled",
                                    checked: this.formData.is_enabled,
                                    onchange: e => (this.formData.is_enabled = e.target.checked)
                                }),
                                h("span", { class: "cs-check__box" }, icon(["M20 6L9 17l-5-5"], 14)),
                                h("span", { class: "cs-check__text" }, "Service enabled")
                            ),
                            h(
                                "label",
                                { class: "cs-check", for: "chk_requires_payment" },
                                h("input", {
                                    type: "checkbox",
                                    id: "chk_requires_payment",
                                    checked: this.formData.requires_payment,
                                    onchange: e => (this.formData.requires_payment = e.target.checked)
                                }),
                                h("span", { class: "cs-check__box" }, icon(["M20 6L9 17l-5-5"], 14)),
                                h("span", { class: "cs-check__text" }, "Requires payment")
                            )
                        )
                    ),

                    h(
                        "div",
                        { class: "cs-sheet__actions" },
                        h(
                            "button",
                            {
                                type: "button",
                                class: "cs-cancel-btn",
                                onclick: () => this.handleCloseModal()
                            },
                            "Cancel"
                        ),
                        h(
                            "button",
                            {
                                type: "submit",
                                class: "cs-primary-btn",
                                disabled: this.saving
                            },
                            this.saving ? h("span", { class: "btn-spinner" }) : null,
                            h("span", {}, this.saving ? "Saving…" : "Save service")
                        )
                    )
                )
            )
        );
    }
}
