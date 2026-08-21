// js/components/doctor/settings/DoctorCardPage.js

import { Component } from "../../../core/component.js";
import { h } from "../../../utils/dom.js";
import api from "../../../services/api.js";

const API_BASE_URL = "https://doctors-consultation-backend.onrender.com/api/v1";

export default class DoctorCardPage extends Component {
    constructor(doctor, onBack) {
        super();
        this.doctor = doctor ?? {};
        this.onBack = onBack;

        this.imageLoaded = false;
        this.imageError = false;
        this.copying = false;
        this.copySuccess = false;
        this.downloading = false;
        this.downloadError = "";

        // Cache-busting param so a freshly regenerated card (e.g. after a
        // profile edit) doesn't show a stale browser-cached image.
        this.cacheBust = Date.now();
    }

    get doctorId() {
        return this.doctor.id || this.doctor.user_id;
    }

    get cardImageUrl() {
        return `${API_BASE_URL}/profilecard/${this.doctorId}/card-image?v=${this.cacheBust}`;
    }

    get shareUrl() {
        return `${API_BASE_URL}/profilecard/${this.doctorId}/share`;
    }

    // ---------- Actions ----------

    async shareCard() {
        const shareData = {
            title: `Dr. ${this.doctor.full_name || ""}`.trim(),
            text: `Book a consultation with me on YerosCare.`,
            url: this.shareUrl,
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (error) {
                // AbortError just means the user cancelled the share sheet — not a real error.
                if (error.name !== "AbortError") {
                    console.error("Share failed:", error);
                }
            }
            return;
        }

        // No native share support (e.g. some desktop browsers) — fall back to copy-link.
        this.copyLink();
    }

    async copyLink() {
        this.copying = true;
        this.copySuccess = false;
        this.update();

        try {
            await navigator.clipboard.writeText(this.shareUrl);
            this.copySuccess = true;
        } catch (error) {
            console.error("Failed to copy link:", error);
        } finally {
            this.copying = false;
            this.update();

            if (this.copySuccess) {
                setTimeout(() => {
                    this.copySuccess = false;
                    this.update();
                }, 2500);
            }
        }
    }

    async downloadCard() {
        this.downloading = true;
        this.downloadError = "";
        this.update();

        try {
            const response = await fetch(this.cardImageUrl);
            if (!response.ok) throw new Error("Failed to download card image.");

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.href = url;
            link.download = `dr-${(this.doctor.full_name || "YerosCare").toLowerCase().replace(/\s+/g, "-")}-card.png`;
            document.body.appendChild(link);
            link.click();
            link.remove();

            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Failed to download card:", error);
            this.downloadError = error.message || "Failed to download card.";
        } finally {
            this.downloading = false;
            this.update();
        }
    }

    // ---------- Render ----------

    render() {
        return h(
            "div",
            { class: "dashboard-page" },
            this.renderHeader(),
            !this.doctorId
                ? h(
                      "div",
                      { class: "dashboard-card", style: "border-left: 4px solid #ef4444;" },
                      h("p", { style: "color: #ef4444; margin: 0;" }, "Your doctor profile isn't fully loaded yet. Please try again from Settings.")
                  )
                : this.renderContent()
        );
    }

    renderHeader() {
        return h(
            "section",
            { class: "dashboard-header", style: "display: flex; align-items: flex-start; gap: 10px;" },
            h(
                "button",
                {
                    class: "btn btn-outline",
                    style: "padding: 0.4rem 0.6rem; font-size: 0.8rem; border-radius: 6px; flex-shrink: 0; color: white;",
                    onclick: () => this.onBack?.(),
                },
                "← Back"
            )
            h(
                "div",
                {},
                h("p", { class: "dashboard-greeting" }, "Settings"),
                h("h1", { class: "dashboard-title" }, "My Doctor Card")
            )
        );
    }

    renderContent() {
        return h(
            "div",
            { class: "services-list" },

            h(
                "div",
                { class: "dashboard-card", style: "padding: 1.1rem;" },
                h(
                    "p",
                    { class: "dashboard-muted", style: "margin: 0 0 12px; font-size: 0.86rem; line-height: 1.5;" },
                    "Share this card with patients on WhatsApp or anywhere else. Tapping it takes them straight to your booking page — even if they don't have the YerosCare app yet."
                ),
                this.renderCardPreview()
            ),

            this.downloadError
                ? h(
                      "div",
                      { class: "dashboard-card", style: "border-left: 4px solid #ef4444;" },
                      h("p", { style: "color: #ef4444; margin: 0;" }, this.downloadError)
                  )
                : null,

            h(
                "div",
                { class: "dashboard-card", style: "padding: 1.1rem; display: flex; flex-direction: column; gap: 10px;" },
                h(
                    "button",
                    {
                        class: "btn btn-primary",
                        style: "padding: 0.65rem 1rem; font-size: 0.9rem; border-radius: 8px;",
                        onclick: () => this.shareCard(),
                    },
                    "Share Card"
                ),
                h(
                    "button",
                    {
                        class: "btn btn-outline",
                        style: "padding: 0.6rem 1rem; font-size: 0.88rem; border-radius: 8px;",
                        disabled: this.downloading,
                        onclick: () => this.downloadCard(),
                    },
                    this.downloading ? "Downloading..." : "Download as Image"
                ),
                h(
                    "button",
                    {
                        class: "btn btn-outline",
                        style: "padding: 0.6rem 1rem; font-size: 0.88rem; border-radius: 8px;",
                        disabled: this.copying,
                        onclick: () => this.copyLink(),
                    },
                    this.copySuccess ? "Link copied ✓" : this.copying ? "Copying..." : "Copy Link"
                )
            ),

            h(
                "div",
                { class: "dashboard-card", style: "padding: 0.9rem 1rem;" },
                h(
                    "p",
                    { class: "dashboard-muted", style: "margin: 0; font-size: 0.76rem; line-height: 1.5;" },
                    "Your card updates automatically whenever you change your profile photo, specialization, or bio — no need to re-share a new one unless you want to."
                )
            )
        );
    }

    renderCardPreview() {
        return h(
            "div",
            {
                style: "position: relative; width: 100%; aspect-ratio: 1200 / 630; border-radius: 10px; overflow: hidden; background: var(--color-bg-muted, #f1f5f9); display: flex; align-items: center; justify-content: center;",
            },
            !this.imageLoaded && !this.imageError
                ? h("p", { class: "dashboard-muted", style: "font-size: 0.82rem;" }, "Loading your card...")
                : null,
            this.imageError
                ? h("p", { style: "color: #ef4444; font-size: 0.82rem; padding: 0 20px; text-align: center;" }, "Couldn't load your card preview. Make sure your profile is verified and complete, then try again.")
                : null,
            h("img", {
                src: this.cardImageUrl,
                alt: "Your doctor card",
                style: `width: 100%; height: 100%; object-fit: cover; display: ${this.imageLoaded ? "block" : "none"};`,
                onload: () => {
                    this.imageLoaded = true;
                    this.update();
                },
                onerror: () => {
                    this.imageError = true;
                    this.update();
                },
            })
        );
    }

    update() {
        if (!this.el) return;
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
    }
}
