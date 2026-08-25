import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import apiService from "../../services/api.js";

export default class AdminAppUpdates extends Component {
    constructor() {
        super();
        this.loading = true;
        this.error = null;
        this.bundles = [];

        this.publishing = false;
        this.publishError = null;
        this.publishSuccess = null;

        this.selectedFile = null;
        this.versionInput = "";
        this.mandatoryInput = false;
    }

    afterMount() {
        this.loadBundles();
    }

    async loadBundles() {
        this.loading = true;
        this.error = null;
        this.update();

        try {
            const result = await apiService.get("/admin/updates");
            this.bundles = result.data || [];
        } catch (err) {
            this.error = err.message || "Failed to load published bundles.";
        } finally {
            this.loading = false;
            this.update();
        }
    }

    onFileChange(e) {
        this.selectedFile = e.target.files[0] || null;
    }

    onVersionChange(e) {
        this.versionInput = e.target.value;
    }

    onMandatoryChange(e) {
        this.mandatoryInput = e.target.checked;
    }

    async publish() {
        this.publishError = null;
        this.publishSuccess = null;

        if (!this.selectedFile) {
            this.publishError = "Select a .zip bundle first.";
            this.update();
            return;
        }
        if (!/^\d+\.\d+\.\d+$/.test(this.versionInput)) {
            this.publishError = "Version must be semantic, e.g. 1.4.2";
            this.update();
            return;
        }

        this.publishing = true;
        this.update();

        try {
            const formData = new FormData();
            formData.append("bundle", this.selectedFile);
            formData.append("version", this.versionInput);
            formData.append("mandatory", String(this.mandatoryInput));

            // apiService.post() would JSON.stringify this and force
            // Content-Type: application/json, breaking a file upload.
            // request() leaves headers alone (besides auth/CSRF), so
            // fetch sets the multipart boundary itself.
            const response = await apiService.request("/admin/updates", {
                method: "POST",
                body: formData,
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || "Failed to publish bundle.");
            }

            this.publishSuccess = `Version ${result.data.version} published.`;
            this.selectedFile = null;
            this.versionInput = "";
            this.mandatoryInput = false;
            await this.loadBundles();
        } catch (err) {
            this.publishError = err.message || "Failed to publish bundle.";
        } finally {
            this.publishing = false;
            this.update();
        }
    }

    async deleteBundle(version) {
        if (!window.confirm(`Remove version ${version}? This cannot be undone.`)) return;

        try {
            await apiService.delete(`/admin/updates/${version}`);
            await this.loadBundles();
        } catch (err) {
            this.error = err.message || "Failed to remove bundle.";
            this.update();
        }
    }

    render() {
        return h(
            "div",
            { class: "admin-app-updates" },
            h("h2", { class: "admin-header__title" }, "App Updates (OTA)"),
            h(
                "p",
                { class: "admin-muted" },
                "Publish JS/CSS/HTML bundles that installed apps pick up automatically. Native code or plugin changes still require a store release and can't ship this way."
            ),
            this.renderPublishForm(),
            this.renderBundleList()
        );
    }

    renderPublishForm() {
        return h(
            "div",
            { class: "admin-card", style: "margin: var(--space-4) 0; padding: var(--space-4);" },
            h("h3", {}, "Publish a new bundle"),
            this.publishError ? h("p", { style: "color: #c0392b;" }, this.publishError) : null,
            this.publishSuccess ? h("p", { style: "color: #1e8449;" }, this.publishSuccess) : null,
            h(
                "div",
                { style: "display: flex; flex-direction: column; gap: var(--space-3); max-width: 420px;" },
                h(
                    "label",
                    {},
                    "Bundle (.zip of your built www/ folder)",
                    h("input", { type: "file", accept: ".zip", onchange: (e) => this.onFileChange(e) })
                ),
                h(
                    "label",
                    {},
                    "Version (e.g. 1.4.2)",
                    h("input", {
                        type: "text",
                        value: this.versionInput,
                        placeholder: "1.4.2",
                        oninput: (e) => this.onVersionChange(e),
                    })
                ),
                h(
                    "label",
                    { style: "display: flex; align-items: center; gap: var(--space-2);" },
                    h("input", { type: "checkbox", checked: this.mandatoryInput, onchange: (e) => this.onMandatoryChange(e) }),
                    "Mandatory (applies immediately on next check, interrupts active sessions)"
                ),
                h(
                    "button",
                    { class: "btn btn-primary", disabled: this.publishing, onclick: () => this.publish() },
                    this.publishing ? "Publishing..." : "Publish"
                )
            )
        );
    }

    renderBundleList() {
        if (this.loading) {
            return h("p", { class: "admin-muted" }, "Loading published bundles...");
        }
        if (this.error) {
            return h("p", { style: "color: #c0392b;" }, this.error);
        }
        if (this.bundles.length === 0) {
            return h("p", { class: "admin-muted" }, "No bundles published yet.");
        }

        return h(
            "table",
            { class: "admin-table" },
            h(
                "thead",
                {},
                h(
                    "tr",
                    {},
                    h("th", {}, "Version"),
                    h("th", {}, "Mandatory"),
                    h("th", {}, "Published"),
                    h("th", {}, "Checksum"),
                    h("th", {}, "")
                )
            ),
            h(
                "tbody",
                {},
                this.bundles.map((bundle) =>
                    h(
                        "tr",
                        {},
                        h("td", {}, bundle.version),
                        h("td", {}, bundle.mandatory ? "Yes" : "No"),
                        h("td", {}, new Date(bundle.created_at).toLocaleString()),
                        h("td", { style: "font-family: monospace; font-size: 12px;" }, bundle.checksum.slice(0, 12) + "…"),
                        h(
                            "td",
                            {},
                            h("button", { class: "btn btn-danger btn-sm", onclick: () => this.deleteBundle(bundle.version) }, "Remove")
                        )
                    )
                )
            )
        );
    }
}
