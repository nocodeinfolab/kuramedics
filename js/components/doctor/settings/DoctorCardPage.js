// js/components/doctor/settings/DoctorCardPage.js

import { Component } from "../../../core/component.js";
import { h } from "../../../utils/dom.js";
import api from "../../../services/api.js";

const API_BASE_URL = "https://doctors-consultation-backend.onrender.com/api/v1";
const PUBLIC_APP_URL = "https://app.yeroscare.com";


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
        this.sharing = false;
        this.copyError = "";

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
        
        const base = this.isNativeApp()
            ? PUBLIC_APP_URL
            : window.location.origin;
        return `${base.replace(/\/$/, "")}/s/doctor/${this.doctorId}`;
    }

    get cardFileName() {
        return `dr-${(this.doctor.full_name || "yeroscare").toLowerCase().replace(/\s+/g, "-")}-card.png`;
    }

    // ---------- Platform helpers ----------

    // True only inside a Capacitor iOS/Android shell, false in a normal browser.
    isNativeApp() {
        return Boolean(window.Capacitor?.isNativePlatform?.());
    }

    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    async fetchCardBlob() {
        const response = await fetch(this.cardImageUrl);
        if (!response.ok) throw new Error("Failed to fetch card image.");
        return response.blob();
    }

    async fetchCardImageFile() {
        try {
            const blob = await this.fetchCardBlob();
            return new File([blob], this.cardFileName, { type: blob.type || "image/png" });
        } catch (error) {
            console.error("Failed to fetch card image for sharing:", error);
            return null;
        }
    }

    // Writes the PNG to the app's cache directory and returns a file:// URI
    // the Capacitor Share plugin can attach to the OS share sheet.
    async writeCardToCache(blob) {
        const { Filesystem, Directory } = await import("@capacitor/filesystem");
        const base64 = await this.blobToBase64(blob);
        const result = await Filesystem.writeFile({
            path: this.cardFileName,
            data: base64,
            directory: Directory.Cache,
        });
        return result.uri;
    }

    // Both the Web Share API and Capacitor's Share plugin reject with
    // AbortError when the user dismisses the sheet — not a real error.
    isCancellation(error) {
        return (
            error?.name === "AbortError" ||
            /cancel/i.test(error?.message || "")
        );
    }

    // ---------- Actions ----------

    async shareCard() {
        if (this.sharing) return;

        const shareTitle = `Dr. ${this.doctor.full_name || ""}`.trim();
        const shareText = `Book a consultation with me on YerosCare.\n${this.shareUrl}`;

        // Desktop browser without Web Share → just copy the link.
        if (!this.isNativeApp() && !navigator.share) {
            await this.copyLink();
            return;
        }

        this.sharing = true;
        this.update();

        try {
            // ---- Native shell (Capacitor iOS / Android) ----
            if (this.isNativeApp()) {
                const { Share } = await import("@capacitor/share");

                try {
                    const blob = await this.fetchCardBlob();
                    const fileUri = await this.writeCardToCache(blob);
                    await Share.share({
                        title: shareTitle,
                        text: shareText,
                        files: [fileUri],
                        dialogTitle: "Share your card",
                    });
                    return;
                } catch (imageError) {
                    if (this.isCancellation(imageError)) throw imageError;
                    console.warn("Native image share failed, falling back to text only:", imageError);
                }

                await Share.share({
                    title: shareTitle,
                    text: shareText,
                    url: this.shareUrl,
                    dialogTitle: "Share your card",
                });
                return;
            }

            // ---- Web Share API (mobile browsers) ----
            const file = await this.fetchCardImageFile();
            if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ title: shareTitle, text: shareText, files: [file] });
            } else {
                await navigator.share({ title: shareTitle, text: shareText, url: this.shareUrl });
            }
        } catch (error) {
            if (!this.isCancellation(error)) {
                console.error("Share failed:", error);
            }
        } finally {
            this.sharing = false;
            this.update();
        }
    }

    async copyLink() {
        this.copying = true;
        this.copySuccess = false;
        this.copyError = "";
        this.update();
    
        try {
            if (this.isNativeApp()) {
                const { Clipboard } = await import("@capacitor/clipboard");
                await Clipboard.write({ string: this.shareUrl });
            } else if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(this.shareUrl);
            } else {
                this.copyViaLegacyFallback();
            }
            this.copySuccess = true;
        } catch (error) {
            console.error("Failed to copy link:", error);
            this.copyError =
                "Couldn't copy the link automatically. Copy it manually: " + this.shareUrl;
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
    
    copyViaLegacyFallback() {
        const ta = document.createElement("textarea");
        ta.value = this.shareUrl;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        ta.setAttribute("readonly", "");
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        if (!ok) throw new Error("Copy command rejected");
    }

    async downloadCard() {
        this.downloading = true;
        this.downloadError = "";
        this.update();

        try {
            // ---- Native shell ----
            // A WebView can't trigger a browser download. Write the PNG to
            // the cache dir and hand it to the OS share sheet — iOS offers
            // "Save to Files", Android offers "Save to Downloads"/Gallery.
            if (this.isNativeApp()) {
                const { Share } = await import("@capacitor/share");
                const blob = await this.fetchCardBlob();
                const fileUri = await this.writeCardToCache(blob);
                await Share.share({
                    files: [fileUri],
                    dialogTitle: "Save your card",
                });
                return;
            }

            // ---- Browser ----
            try {
                const blob = await this.fetchCardBlob();
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = this.cardFileName;
                document.body.appendChild(link);
                link.click();
                link.remove();
                URL.revokeObjectURL(url);
            } catch (fetchError) {
                
                console.warn("Blob fetch failed, falling back to new-tab open:", fetchError);
                window.open(this.cardImageUrl, "_blank", "noopener,noreferrer");
            }
        } catch (error) {
            if (!this.isCancellation(error)) {
                console.error("Failed to download card:", error);
                this.downloadError = error.message || "Failed to download card.";
            }
        } finally {
            this.downloading = false;
            this.update();
        }
    }

    // ---------- Render ----------

    render() {
        return h(
            "div",
            { class: "dashboard-page doctor-card-page" },
            this.renderHeader(),
            !this.doctorId
                ? h(
                      "div",
                      { class: "dashboard-card doctor-card-page__error-card" },
                      h(
                          "p",
                          { class: "doctor-card-page__error-text" },
                          "Your doctor profile isn't fully loaded yet. Please try again from Settings."
                      )
                  )
                : h(
                      "div",
                      { class: "doctor-card-page__wrapper" },
    
                      this.downloadError
                          ? h(
                                "div",
                                { class: "dashboard-card doctor-card-page__error-card" },
                                h(
                                    "p",
                                    { class: "doctor-card-page__error-text" },
                                    this.downloadError
                                )
                            )
                          : null,
                        this.copyError
                            ? h(
                                  "div",
                                  { class: "dashboard-card doctor-card-page__error-card" },
                                  h("p", { class: "doctor-card-page__error-text" }, this.copyError)
                              )
                            : null,
    
                      h(
                          "div",
                          { class: "doctor-card-page__body" },
                          this.renderPreviewCard(),
                          this.renderActionsCard(),
                          this.renderInfoCard()
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
                    onclick: () => this.onBack?.(),
                },
                this.renderChevronIcon(),
                h("span", {}, "Settings")
            ),
            h("h1", { class: "page-hero__title" }, "My Doctor Card"),
            h(
                "p",
                { class: "page-hero__subtitle" },
                "Download and share your booking card with patients on WhatsApp and beyond."
            )
        );
    }
    renderChevronIcon() {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "14");
        svg.setAttribute("height", "14");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2.5");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", "M15 18l-6-6 6-6");
        svg.appendChild(path);
        return svg;
    }

    renderActionsCard() {
        return h(
            "div",
            { class: "dashboard-card doctor-card-page__actions-card" },
            h(
                "button",
                {
                    class: "btn btn-primary",
                    disabled: this.sharing,
                    onclick: () => this.shareCard(),
                },
                this.sharing ? "Preparing..." : "Share Card"
            ),
            h(
                "button",
                {
                    class: "btn btn-outline",
                    disabled: this.downloading,
                    onclick: () => this.downloadCard(),
                },
                this.downloading ? "Downloading..." : "Download as Image"
            ),
            h(
                "button",
                {
                    class: "btn btn-outline",
                    disabled: this.copying,
                    onclick: () => this.copyLink(),
                },
                this.copySuccess ? "Link copied ✓" : this.copying ? "Copying..." : "Copy Link"
            )
        );
    }
    
    renderInfoCard() {
        return h(
            "div",
            { class: "dashboard-card doctor-card-page__info-card" },
            h(
                "p",
                { class: "doctor-card-page__info-text" },
                "Your card updates automatically whenever you change your profile photo, specialization, or bio — no need to re-share a new one unless you want to."
            )
        );
    }

    renderPreviewCard() {
        return h(
            "div",
            { class: "dashboard-card doctor-card-page__preview-card" },
            h(
                "p",
                { class: "doctor-card-page__hint" },
                "Share this card with patients on WhatsApp or anywhere else. Tapping it takes them straight to your booking page — even if they don't have the YerosCare app yet."
            ),
            h(
                "div",
                { class: "doctor-card-page__preview" },
                !this.imageLoaded && !this.imageError
                    ? h(
                          "p",
                          { class: "dashboard-muted doctor-card-page__preview-loading" },
                          "Loading your card..."
                      )
                    : null,
                this.imageError
                    ? h(
                          "p",
                          { class: "doctor-card-page__preview-error" },
                          "Couldn't load your card preview. Make sure your profile is verified and complete, then try again."
                      )
                    : h("img", {
                          src: this.cardImageUrl,
                          alt: "Your doctor card",
                          class: "doctor-card-page__preview-img",
                          style: `display: ${this.imageLoaded ? "block" : "none"};`,
                          onload: () => {
                              this.imageLoaded = true;
                              this.update();
                          },
                          onerror: () => {
                              this.imageError = true;
                              this.update();
                          },
                      })
            )
        );
    }

    update() {
        if (!this.el) return;
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
    }
}
