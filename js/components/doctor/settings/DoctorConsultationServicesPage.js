import { Component } from "../../../core/component.js";
import { h } from "../../../utils/dom.js";
import doctorConsultationService from "../../../services/doctorConsultationService.js";

const SERVICE_TYPE_OPTIONS = [
    { value: "video_consultation", label: "Video Consultation" },
    { value: "chat_consultation", label: "Chat Consultation" },
    { value: "home_visit", label: "Home Visit Consultation" },
    { value: "walk_in_clinic", label: "Walk-in Clinic Consultation" }
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
            availability_note: ""
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
                availability_note: service.availability_note || ""
            };
        } else {
            this.editingServiceId = null;
            this.formData = this.getInitialFormData();
        }
        this.isModalOpen = true;
        this.saving = false; // Reset saving state on open
        this.error = null;
        this.successMsg = null;
        this.update();                 
    }
    
    handleCloseModal() {
        this.isModalOpen = false;
        this.editingServiceId = null;
        this.saving = false; // Reset saving state on close
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

    async handleDelete(serviceId) {
        if (!confirm("Are you sure you want to disable this consultation service?")) return;

        try {
            await doctorConsultationService.deleteService(serviceId);
            this.successMsg = "Service disabled successfully.";
            await this.fetchServices();
        } catch (err) {
            console.error("Failed to delete service:", err);
            this.error = err.message || "Failed to delete service.";
            this.update(); 
        }
    }

    render() {
        return h(
            "div",
            { class: "dashboard-page consultation-services-page" },
            this.renderHeader(),
            this.renderAlerts(),
            this.loading
                ? h("div", { class: "dashboard-card text-center py-4" }, 
                    h("p", { class: "dashboard-muted" }, "Loading consultation services...")
                  )
                : this.renderServiceList(),
            this.isModalOpen ? this.renderModal() : null
        );
    }

    renderHeader() {
        return h(
            "section",
            { class: "dashboard-header" },
            h(
                "button",
                {
                    class: "btn btn-outline",
                    style: "margin-bottom: var(--space-3); color: var(--color-white); border-color: rgba(255,255,255,0.4);",
                    onclick: () => this.onBack()
                },
                "← Back to Settings"
            ),
            h("h1", { class: "dashboard-title" }, "Consultation Services"),
            h(
                "p",
                { class: "dashboard-subtitle" },
                "Set up rates, durations, and availability notes for your services."
            ),
            h(
                "div",
                { class: "dashboard-hero-meta" },
                h(
                    "button",
                    {
                        class: "btn btn-primary",
                        style: "background: var(--color-white); color: var(--color-primary);",
                        onclick: () => this.handleOpenModal()
                    },
                    "+ Add New Service"
                )
            )
        );
    }

    renderAlerts() {
        const alerts = [];
        if (this.error) {
            alerts.push(
                h("div", { class: "dashboard-card", style: "border-left: 4px solid #ef4444;" }, 
                    h("p", { style: "color: #ef4444; margin: 0;" }, this.error)
                )
            );
        }
        if (this.successMsg) {
            alerts.push(
                h("div", { class: "dashboard-card", style: "border-left: 4px solid #10b981;" }, 
                    h("p", { style: "color: #10b981; margin: 0;" }, this.successMsg)
                )
            );
        }
        return alerts;
    }

    renderServiceList() {
        if (!this.services || this.services.length === 0) {
            return h(
                "div",
                { class: "dashboard-card", style: "text-align: center;" },
                h("p", { class: "dashboard-muted" }, "No consultation services configured yet."),
                h(
                    "button",
                    {
                        class: "btn btn-outline",
                        style: "margin-top: var(--space-3);",
                        onclick: () => this.handleOpenModal()
                    },
                    "Create your first service"
                )
            );
        }

        return h(
            "div",
            { class: "services-list" },
            this.services.map(service => this.renderServiceCard(service))
        );
    }

    renderServiceCard(service) {
        const serviceId = service.id || service.service_id;

        return h(
            "div",
            { class: "dashboard-card service-item-card" },
            h(
                "div",
                { style: "display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3);" },
                h(
                    "div",
                    {},
                    h("h3", { style: "margin: 0 0 var(--space-2);" }, service.display_name),
                    h(
                        "span",
                        { 
                            class: "dashboard-badge",
                            style: service.is_enabled ? "background: #10b981;" : "background: var(--color-ink-faint);"
                        },
                        service.is_enabled ? "Active" : "Disabled"
                    )
                ),
                h(
                    "div",
                    { style: "display: flex; gap: var(--space-2);" },
                    h(
                        "button",
                        {
                            class: "btn btn-outline",
                            style: "padding: 0.4rem 0.8rem; font-size: var(--step-small);",
                            onclick: () => this.handleOpenModal(service)
                        },
                        "Edit"
                    ),
                    h(
                        "button",
                        {
                            class: "btn btn-outline",
                            style: "padding: 0.4rem 0.8rem; font-size: var(--step-small); color: #ef4444; border-color: rgba(239, 68, 68, 0.3);",
                            onclick: () => this.handleDelete(serviceId)
                        },
                        "Disable"
                    )
                )
            ),
            h("p", { class: "dashboard-muted", style: "margin-top: var(--space-3);" }, service.description || "No description provided."),
            h(
                "div",
                { 
                    class: "input-group", 
                    style: "margin-top: var(--space-4); padding-top: var(--space-3); border-top: 1px solid var(--color-line);" 
                },
                h("div", {}, h("strong", {}, "Duration: "), service.duration_minutes ? `${service.duration_minutes} mins` : "N/A"),
                h("div", {}, h("strong", {}, "First-Time Rate: "), `₦${(service.first_time_price_amount || 0).toLocaleString()}`),
                h("div", {}, h("strong", {}, "Follow-Up Rate: "), service.follow_up_price_amount !== null ? `₦${Number(service.follow_up_price_amount).toLocaleString()}` : "N/A")
            ),
            service.availability_note
                ? h("p", { class: "dashboard-muted", style: "margin-top: var(--space-2); font-size: var(--step-small);" }, h("em", {}, `Note: ${service.availability_note}`))
                : null
        );
    }

    renderModal() {
        return h(
            "div",
            { 
                style: "position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 100; padding: var(--space-4);" 
            },
            h(
                "div",
                { class: "settings-card", style: "max-width: 600px; width: 100%; max-height: 90vh; overflow-y: auto;" },
                h(
                    "div",
                    { style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);" },
                    h("h2", { style: "margin: 0;" }, this.editingServiceId ? "Edit Consultation Service" : "Add Consultation Service"),
                    h(
                        "button", 
                        { 
                            class: "btn btn-outline", 
                            style: "padding: 0.2rem 0.6rem; font-size: 1.2rem; border: none;",
                            onclick: () => this.handleCloseModal() 
                        }, 
                        "×"
                    )
                ),
                h(
                    "form",
                    { onsubmit: e => this.handleSubmit(e) },

                    h(
                        "div",
                        { class: "input-group" },
                        h(
                            "div",
                            { class: "form-group" },
                            h("label", { class: "form-label" }, "Service Type"),
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
                            h("label", { class: "form-label" }, "Display Name"),
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
                            h("label", { class: "form-label" }, "First-Time Price (₦)"),
                            h("input", {
                                type: "number",
                                class: "form-input",
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
                            h("label", { class: "form-label" }, "Follow-Up Price (₦)"),
                            h("input", {
                                type: "number",
                                class: "form-input",
                                min: 0,
                                value: this.formData.follow_up_price_amount,
                                oninput: e => (this.formData.follow_up_price_amount = e.target.value)
                            })
                        )
                    ),

                    h(
                        "div",
                        { class: "form-group" },
                        h("label", { class: "form-label" }, "Duration (Mins)"),
                        h("input", {
                            type: "number",
                            class: "form-input",
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

                    h(
                        "div",
                        { class: "form-group" },
                        h("label", { class: "form-label" }, "Availability Note"),
                        h("input", {
                            type: "text",
                            class: "form-input",
                            placeholder: "e.g., Weekdays between 9 AM - 4 PM",
                            value: this.formData.availability_note,
                            oninput: e => (this.formData.availability_note = e.target.value)
                        })
                    ),

                    h(
                        "div",
                        { class: "input-group", style: "margin-bottom: var(--space-5);" },
                        h(
                            "div",
                            { class: "form-checkbox" },
                            h("input", {
                                type: "checkbox",
                                id: "chk_service_enabled",
                                checked: this.formData.is_enabled,
                                onchange: e => (this.formData.is_enabled = e.target.checked)
                            }),
                            h("label", { htmlFor: "chk_service_enabled" }, "Service Enabled")
                        ),
                        h(
                            "div",
                            { class: "form-checkbox" },
                            h("input", {
                                type: "checkbox",
                                id: "chk_requires_payment",
                                checked: this.formData.requires_payment,
                                onchange: e => (this.formData.requires_payment = e.target.checked)
                            }),
                            h("label", { htmlFor: "chk_requires_payment" }, "Requires Payment")
                        )
                    ),

                    h(
                        "div",
                        { style: "display: flex; justify-content: flex-end; gap: var(--space-3);" },
                        h(
                            "button",
                            {
                                type: "button",
                                class: "btn btn-outline",
                                onclick: () => this.handleCloseModal()
                            },
                            "Cancel"
                        ),
                        h(
                            "button",
                            {
                                type: "submit",
                                class: "btn btn-primary",
                                disabled: this.saving
                            },
                            this.saving ? h("span", { class: "btn-spinner" }) : null,
                            this.saving ? "Saving..." : "Save Service"
                        )
                    )
                )
            )
        );
    }
}
