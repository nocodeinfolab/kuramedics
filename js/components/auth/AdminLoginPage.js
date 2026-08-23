import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import api from "../../services/api.js";

export class AdminLoginPage extends Component {
    constructor() {
        super();
        this.email = "";
        this.password = "";
        this.loading = false;
        this.errorMessage = "";
    }

    async handleSubmit(e) {
        e.preventDefault();
        this.loading = true;
        this.errorMessage = "";
        this.update();

        try {
            const res = await api.post("/auth/login", {
                email: this.email,
                password: this.password,
            });
            const data = res.data || res;

            if (data.user?.role !== "admin") {
                throw new Error("This account does not have admin access.");
            }

            localStorage.setItem("accessToken", data.accessToken);
            localStorage.setItem("user", JSON.stringify(data.user));
            window.location.hash = "/admin/dashboard";
        } catch (error) {
            console.error("Admin login failed:", error);
            this.errorMessage = error.message || "Login failed. Please check your credentials.";
            this.loading = false;
            this.update();
        }
    }

    render() {
        return h(
            "main",
            { class: "auth-page" },
            h(
                "div",
                { class: "auth-card" },
                h(
                    "div",
                    { class: "auth-header" },
                    h("span", { class: "auth-badge" }, "Admin"),
                    h("h1", { class: "auth-title" }, "Admin Sign In"),
                    h("p", { class: "auth-subtitle" }, "Restricted access. Authorized personnel only.")
                ),
                this.errorMessage
                    ? h("div", { class: "admin-alert admin-alert--error" }, this.errorMessage)
                    : null,
                h(
                    "form",
                    { onsubmit: (e) => this.handleSubmit(e), style: "display: flex; flex-direction: column; gap: var(--space-4);" },
                    h(
                        "div",
                        { class: "admin-form-group" },
                        h("label", { class: "admin-form-label" }, "Email"),
                        h("input", {
                            type: "email",
                            class: "admin-form-input",
                            required: true,
                            value: this.email,
                            oninput: (e) => { this.email = e.target.value; },
                        })
                    ),
                    h(
                        "div",
                        { class: "admin-form-group" },
                        h("label", { class: "admin-form-label" }, "Password"),
                        h("input", {
                            type: "password",
                            class: "admin-form-input",
                            required: true,
                            value: this.password,
                            oninput: (e) => { this.password = e.target.value; },
                        })
                    ),
                    h(
                        "button",
                        { type: "submit", class: "btn btn-primary btn-block", disabled: this.loading },
                        this.loading ? "Signing in..." : "Sign In"
                    )
                )
            )
        );
    }

    update() {
        if (!this.el) return;
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
    }
}
