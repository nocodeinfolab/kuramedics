// js/components/doctor/settings/DoctorConsultationServicesPage.js

import { Component } from "../../../core/component.js";
import { h } from "../../../utils/dom.js";
import doctorConsultationService from "../../../services/doctorConsultationService.js"; // <--- 1. IMPORT SERVICE WRAPPER

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
        this.render();
    
        try {
            const res = await doctorConsultationService.getServices();
            
            this.services = Array.isArray(res) ? res : [];
        } catch (err) {
            console.error("Failed to load consultation services:", err);
            this.error = err.message || "Failed to load services.";
        } finally {
            this.loading = false;
            this.render();
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
        this.error = null;
        this.successMsg = null;
        this.render();
    }

    handleCloseModal() {
        this.isModalOpen = false;
        this.editingServiceId = null;
        this.formData = this.getInitialFormData();
        this.render();
    }

    async handleSubmit(e) {
        e.preventDefault();
        this.saving = true;
        this.error = null;
        this.successMsg = null;
        this.render();

        try {
            const firstTimePrice = Number(this.formData.first_time_price_amount || this.formData.price_naira);
            const payload = {
                ...this.formData,
                price_naira: firstTimePrice,
                first_time_price_amount: firstTimePrice,
                follow_up_price_amount: Number(this.formData.follow_up_price_amount),
                duration_minutes: Number(this.formData.duration_minutes)
            };

            // 3. USE SERVICE WRAPPER FOR CREATE & UPDATE
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
            this.saving = false;
            this.render();
        }
    }

    async handleDelete(serviceId) {
        if (!confirm("Are you sure you want to disable this consultation service?")) return;

        try {
            // 4. USE SERVICE WRAPPER FOR DELETE
            await doctorConsultationService.deleteService(serviceId);
            this.successMsg = "Service disabled successfully.";
            await this.fetchServices();
        } catch (err) {
            console.error("Failed to delete service:", err);
            this.error = err.message || "Failed to delete service.";
            this.render();
        }
    }

    render() {
        return h(
            "div",
            { class: "dashboard-page consultation-services-page" },
            this.renderHeader(),
            this.renderAlerts(),
            this.loading
                ? h("div", { class: "dashboard-loading" }, "Loading consultation services...")
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
                    class: "btn btn-secondary btn-sm mb-2",
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
                { class: "mt-3" },
                h(
                    "button",
                    {
                        class: "btn btn-primary",
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
            alerts.push(h("div", { class: "alert alert-danger mb-3" }, this.error));
        }
        if (this.successMsg) {
            alerts.push(h("div", { class: "alert alert-success mb-3" }, this.successMsg));
        }
        return alerts;
    }

    renderServiceList() {
        if (!this.services || this.services.length === 0) {
            return h(
                "div",
                { class: "dashboard-card text-center py-4" },
                h("p", { class: "dashboard-muted" }, "No consultation services configured yet."),
                h(
                    "button",
                    {
                        class: "btn btn-outline-primary btn-sm mt-2",
                        onclick: () => this.handleOpenModal()
                    },
                    "Create your first service"
                )
            );
        }

        return h(
            "div",
            { class: "services-grid grid gap-3" },
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
                { class: "d-flex justify-content-between align-items-start" },
                h(
                    "div",
                    {},
                    h("h3", { class: "service-card-title mb-1" }, service.display_name),
                    h(
                        "span",
                        { class: `dashboard-badge ${service.is_enabled ? "badge-success" : "badge-secondary"}` },
                        service.is_enabled ? "Active" : "Disabled"
                    )
                ),
                h(
                    "div",
                    { class: "service-actions" },
                    h(
                        "button",
                        {
                            class: "btn btn-sm btn-outline-secondary mr-1",
                            onclick: () => this.handleOpenModal(service)
                        },
                        "Edit"
                    ),
                    h(
                        "button",
                        {
                            class: "btn btn-sm btn-outline-danger",
                            onclick: () => this.handleDelete(serviceId)
                        },
                        "Disable"
                    )
                )
            ),
            h("p", { class: "dashboard-muted mt-2 mb-2" }, service.description || "No description provided."),
            h(
                "div",
                { class: "service-details-meta grid grid-2-col gap-2 mt-3 pt-2 border-top" },
                h("div", {}, h("strong", {}, "Duration: "), service.duration_minutes ? `${service.duration_minutes} mins` : "N/A"),
                h("div", {}, h("strong", {}, "First-Time Rate: "), `₦${(service.first_time_price_amount || 0).toLocaleString()}`),
                h("div", {}, h("strong", {}, "Follow-Up Rate: "), service.follow_up_price_amount !== null ? `₦${Number(service.follow_up_price_amount).toLocaleString()}` : "N/A")
            ),
            service.availability_note
                ? h("p", { class: "dashboard-muted text-sm mt-2" }, h("em", {}, `Note: ${service.availability_note}`))
                : null
        );
    }

    renderModal() {
        return h(
            "div",
            { class: "modal-backdrop" },
            h(
                "div",
                { class: "modal-content dashboard-card" },
                h(
                    "div",
                    { class: "modal-header d-flex justify-content-between align-items-center mb-3" },
                    h("h2", {}, this.editingServiceId ? "Edit Consultation Service" : "Add Consultation Service"),
                    h("button", { class: "btn-close", onclick: () => this.handleCloseModal() }, "×")
                ),
                h(
                    "form",
                    { onsubmit: e => this.handleSubmit(e) },

                    h(
                        "div",
                        { class: "grid grid-2-col gap-2 mb-3" },
                        h(
                            "div",
                            { class: "form-group" },
                            h("label", { class: "form-label" }, "Service Type"),
                            h(
                                "select",
                                {
                                    class: "form-control",
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
                                class: "form-control",
                                required: true,
                                value: this.formData.display_name,
                                oninput: e => (this.formData.display_name = e.target.value)
                            })
                        )
                    ),

                    h(
                        "div",
                        { class: "grid grid-3-col gap-2 mb-3" },
                        h(
                            "div",
                            { class: "form-group" },
                            h("label", { class: "form-label" }, "First-Time Price (₦)"),
                            h("input", {
                                type: "number",
                                class: "form-control",
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
                                class: "form-control",
                                min: 0,
                                value: this.formData.follow_up_price_amount,
                                oninput: e => (this.formData.follow_up_price_amount = e.target.value)
                            })
                        ),
                        h(
                            "div",
                            { class: "form-group" },
                            h("label", { class: "form-label" }, "Duration (Mins)"),
                            h("input", {
                                type: "number",
                                class: "form-control",
                                min: 5,
                                value: this.formData.duration_minutes,
                                oninput: e => (this.formData.duration_minutes = e.target.value)
                            })
                        )
                    ),

                    h(
                        "div",
                        { class: "form-group mb-3" },
                        h("label", { class: "form-label" }, "Description"),
                        h("textarea", {
                            class: "form-control",
                            rows: 2,
                            value: this.formData.description,
                            oninput: e => (this.formData.description = e.target.value)
                        })
                    ),

                    h(
                        "div",
                        { class: "form-group mb-3" },
                        h("label", { class: "form-label" }, "Availability Note"),
                        h("input", {
                            type: "text",
                            class: "form-control",
                            placeholder: "e.g., Weekdays between 9 AM - 4 PM",
                            value: this.formData.availability_note,
                            oninput: e => (this.formData.availability_note = e.target.value)
                        })
                    ),

                    h(
                        "div",
                        { class: "d-flex gap-4 mb-4" },
                        h(
                            "label",
                            { class: "checkbox-label d-flex align-items-center gap-2" },
                            h("input", {
                                type: "checkbox",
                                checked: this.formData.is_enabled,
                                onchange: e => (this.formData.is_enabled = e.target.checked)
                            }),
                            "Service Enabled"
                        ),
                        h(
                            "label",
                            { class: "checkbox-label d-flex align-items-center gap-2" },
                            h("input", {
                                type: "checkbox",
                                checked: this.formData.requires_payment,
                                onchange: e => (this.formData.requires_payment = e.target.checked)
                            }),
                            "Requires Payment"
                        )
                    ),

                    h(
                        "div",
                        { class: "d-flex justify-content-end gap-2" },
                        h(
                            "button",
                            {
                                type: "button",
                                class: "btn btn-secondary",
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
                            this.saving ? "Saving..." : "Save Service"
                        )
                    )
                )
            )
        );
    }
}
