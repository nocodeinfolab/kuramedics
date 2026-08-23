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
                    ? h("p", { style: "color: #ef4444; font-size: 0.85rem; margin: 0 0 12px;" }, this.errorMessage)
                    : null,
                h(
                    "form",
                    { onsubmit: (e) => this.handleSubmit(e), style: "display: flex; flex-direction: column; gap: 12px;" },
                    h("input", {
                        type: "email",
                        placeholder: "Email",
                        required: true,
                        value: this.email,
                        oninput: (e) => { this.email = e.target.value; },
                        style: "padding: 0.7rem 0.85rem; border: 1px solid var(--color-line); border-radius: 8px; font-size: 0.9rem;",
                    }),
                    h("input", {
                        type: "password",
                        placeholder: "Password",
                        required: true,
                        value: this.password,
                        oninput: (e) => { this.password = e.target.value; },
                        style: "padding: 0.7rem 0.85rem; border: 1px solid var(--color-line); border-radius: 8px; font-size: 0.9rem;",
                    }),
                    h(
                        "button",
                        {
                            type: "submit",
                            class: "btn btn-primary",
                            disabled: this.loading,
                            style: "padding: 0.7rem; border-radius: 8px; margin-top: 4px;",
                        },
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
