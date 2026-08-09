// js/components/shared/VideoCallRoom.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import api from "../../services/api.js";

export default class VideoCallRoom extends Component {
    /**
     * @param {string} bookingId
     * @param {object} user - current logged-in user (doctor or patient)
     * @param {() => void} onLeave - called after the call ends and cleanup completes
     */
    constructor(bookingId, user, consultationType, onLeave) {
        super();
        this.bookingId = bookingId;
        this.user = user ?? {};
        this.consultationType = consultationType;
        this.isVoiceOnly = consultationType === "voice_consultation";
        this.onLeave = onLeave;

        this.status = "connecting"; // "connecting" | "connected" | "reconnecting" | "error"
        this.errorMessage = "";

        this.cameraEnabled = true;
        this.micEnabled = true;

        this.room = null;
        this.tiles = {}; // participantIdentity -> tile <div>
    }

    async afterMount() {
        await this.connectToCall();
    }

    async connectToCall() {
        if (typeof LivekitClient === "undefined") {
            this.status = "error";
            this.errorMessage = "Video calling failed to load. Please refresh and try again.";
            this.update();
            return;
        }

        // First-ever connect happens right after mount(), before any tiles
        // exist, so a full render here is harmless. Retries after an error
        // also need the full error->grid layout swap, so this stays a full
        // update() rather than updateStatusLabel().
        this.status = "connecting";
        this.errorMessage = "";
        this.update();

        try {
            const res = await api.post(`/video/bookings/${this.bookingId}/token`);
            const session = res.data || res;

            this.room = new LivekitClient.Room({
                adaptiveStream: true,
                dynacast: true,
                rtcConfig: {
                    iceTransportPolicy: "relay",
                },
            });

            this.room.on(LivekitClient.RoomEvent.TrackSubscribed, (track, publication, participant) => {
                this.attachTrack(track, participant.identity, participant.name || "Participant");
            });

            this.room.on(LivekitClient.RoomEvent.TrackUnsubscribed, (track) => {
                track.detach().forEach(el => el.remove());
            });

            this.room.on(LivekitClient.RoomEvent.ParticipantDisconnected, (participant) => {
                this.removeTile(participant.identity);
            });

            this.room.on(LivekitClient.RoomEvent.ConnectionStateChanged, (state) => {
                console.log("LiveKit connection state changed:", state);

                if (state === LivekitClient.ConnectionState.Reconnecting) {
                    this.status = "reconnecting";
                    this.updateStatusLabel();
                } else if (state === LivekitClient.ConnectionState.Connected && this.status === "reconnecting") {
                    this.status = "connected";
                    this.updateStatusLabel();
                }
            });

            this.room.on(LivekitClient.RoomEvent.Disconnected, () => {
                this.status = "error";
                this.errorMessage = "Call ended or connection lost.";
                this.update();
            });

            await this.room.connect(session.url, session.token);

            try {
                if (!this.isVoiceOnly) {
                    await this.room.localParticipant.setCameraEnabled(true);
                }
                await this.room.localParticipant.setMicrophoneEnabled(true);
            } catch (publishError) {
                console.error("Failed to publish local media:", publishError);
            }

            // This is the ONLY point after the grid first exists where we
            // transition into "connected" — from here on, status changes
            // must go through updateStatusLabel(), never update(), or any
            // tile already attached (including a remote participant's,
            // which can arrive before this line runs if they joined first)
            // gets wiped out by the destructive re-render.
            this.status = "connected";
            this.updateStatusLabel();

            this.attachLocalVideo();
        } catch (error) {
            console.error("Failed to join call:", error);
            this.status = "error";
            this.errorMessage = this.getFriendlyErrorMessage(error);
            this.update();
        }
    }

    getFriendlyErrorMessage(error) {
        const raw = String(error?.message || "");
        if (raw.includes("Failed to fetch") || raw.includes("NETWORK_CHANGED") || raw.includes("ERR_NETWORK")) {
            return "Connection interrupted. Check your network and try again.";
        }
        return raw || "Failed to join the call.";
    }

    getStatusLabelText() {
        if (this.status === "connecting") return "Connecting...";
        if (this.status === "reconnecting") return "Reconnecting...";
        if (this.status === "error") return "Call unavailable";
        return "In call";
    }

    updateStatusLabel() {
        const label = this.el?.querySelector("#video-call-status-label");
        if (label) label.textContent = this.getStatusLabelText();
    }

    // ---------- Video tile management (direct DOM, not h()-tree) ----------

    getOrCreateTile(identity, label) {
        if (this.tiles[identity]) return this.tiles[identity];

        const isLocal = identity === "local";
        const container = isLocal
            ? this.el?.querySelector("#video-call-local-tile")
            : this.el?.querySelector("#video-call-remote-layer");

        if (!container) return null;

        if (!isLocal) {
            // First real remote participant arriving — clear the waiting label.
            const waitingLabel = this.el?.querySelector("#video-call-waiting-label");
            waitingLabel?.remove();
        }

        const tile = document.createElement("div");
        tile.style.cssText = isLocal
            ? "position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;"
            : "position: relative; flex: 1; min-width: 0; display: flex; align-items: center; justify-content: center;";

        if (this.isVoiceOnly) {
            const avatar = document.createElement("div");
            avatar.textContent = (label || "?").charAt(0).toUpperCase();
            const size = isLocal ? 36 : 72;
            avatar.style.cssText = `width: ${size}px; height: ${size}px; border-radius: 50%; background: var(--color-primary, #0284c7); color: #fff; display: flex; align-items: center; justify-content: center; font-size: ${size / 2.2}px; font-weight: 600;`;
            tile.appendChild(avatar);
        }

        if (!isLocal) {
            const labelEl = document.createElement("span");
            labelEl.textContent = label;
            labelEl.style.cssText = "position: absolute; bottom: 10px; left: 12px; color: #fff; font-size: 0.8rem; background: rgba(0,0,0,0.5); padding: 3px 9px; border-radius: 5px; z-index: 2;";
            tile.appendChild(labelEl);
        }

        container.appendChild(tile);
        this.tiles[identity] = tile;
        return tile;
    }

    attachTrack(track, identity, label) {
        
        if (this.isVoiceOnly && track.kind === "video") return;

        const tile = this.getOrCreateTile(identity, label);
        if (!tile) return;

        const el = track.attach();

        if (track.kind === "audio") {
            
            el.style.display = "none";
        } else {
            el.style.cssText = "width: 100%; height: 100%; object-fit: cover;";
        }

        tile.appendChild(el);
    }

    attachLocalVideo() {
        const localParticipant = this.room.localParticipant;
        localParticipant.videoTrackPublications.forEach(publication => {
            if (publication.track) {
                this.attachTrack(publication.track, "local", "You");
            }
        });
    }

    removeTile(identity) {
        const tile = this.tiles[identity];
        if (tile) {
            tile.remove();
            delete this.tiles[identity];
        }

        const remoteLayer = this.el?.querySelector("#video-call-remote-layer");
        if (identity !== "local" && remoteLayer && !remoteLayer.querySelector("[data-remote-tile]")) {
            // No remote tiles left — could re-show waiting label here if desired.
        }
    }

    // ---------- Controls ----------

    async toggleCamera() {
        this.cameraEnabled = !this.cameraEnabled;
        await this.room?.localParticipant?.setCameraEnabled(this.cameraEnabled);
        this.updateControlsOnly();
    }

    async toggleMic() {
        this.micEnabled = !this.micEnabled;
        await this.room?.localParticipant?.setMicrophoneEnabled(this.micEnabled);
        this.updateControlsOnly();
    }

    async leaveCall() {
        try {
            this.room?.disconnect();
        } catch (error) {
            console.error("Error leaving call:", error);
        }

        this.unmount();

        if (typeof this.onLeave === "function") {
            this.onLeave();
        }
    }

    // ---------- Partial re-renders that never touch the video grid ----------

    updateControlsOnly() {
        const controls = this.el?.querySelector("#video-call-controls");
        if (!controls) return;
        controls.replaceChildren(...this.renderControls().flat());
    }

    // ---------- Render ----------

    render() {
        return h(
            "div",
            {
                class: "video-call-overlay",
                style: "position: fixed; inset: 0; z-index: 2000; background: #111; display: flex; flex-direction: column;",
            },
            h(
                "div",
                { style: "padding: 0.85rem 1rem; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;" },
                h("p", { id: "video-call-status-label", style: "margin: 0; color: #fff; font-size: 0.88rem; font-weight: 600;" },
                    this.getStatusLabelText()
                ),
                h(
                    "button",
                    {
                        style: "padding: 0.4rem 0.85rem; font-size: 0.8rem; border-radius: 6px; border: none; background: #ef4444; color: #fff; font-weight: 600; cursor: pointer;",
                        onclick: () => this.leaveCall(),
                    },
                    "Leave"
                )
            ),
            this.status === "error"
                ? h(
                      "div",
                      { style: "flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 1.5rem;" },
                      h("p", { style: "color: #fff; text-align: center; font-size: 0.9rem;" }, this.errorMessage),
                      h(
                          "button",
                          {
                              style: "padding: 0.55rem 1.1rem; font-size: 0.85rem; border-radius: 8px; border: none; background: #0284c7; color: #fff; font-weight: 600; cursor: pointer;",
                              onclick: () => this.connectToCall(),
                          },
                          "Try Again"
                      )
                  )
                : h(
                      "div",
                      {
                          id: "video-call-stage",
                          style: "flex: 1; position: relative; overflow: hidden; background: #1e1e1e;",
                      },
                      h(
                          "div",
                          {
                              id: "video-call-remote-layer",
                              style: "position: absolute; inset: 0; display: flex; align-items: stretch; justify-content: center;",
                          },
                          h(
                              "p",
                              {
                                  id: "video-call-waiting-label",
                                  class: "dashboard-muted",
                                  style: "position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-size: 0.88rem; margin: 0;",
                              },
                              "Waiting for the other participant to join..."
                          )
                      ),
                      h("div", {
                          id: "video-call-local-tile",
                          style: "position: absolute; bottom: 16px; right: 16px; width: 96px; height: 132px; border-radius: 10px; overflow: hidden; border: 2px solid rgba(255,255,255,0.35); z-index: 10; background: #000; display: flex; align-items: center; justify-content: center;",
                      })
                  ),
            this.status !== "error"
                ? h(
                      "div",
                      { id: "video-call-controls", style: "padding: 1rem; display: flex; justify-content: center; gap: 12px; flex-shrink: 0;" },
                      this.renderControls()
                  )
                : null
        );
    }

    renderControls() {
        const buttons = [
            h(
                "button",
                {
                    style: `padding: 0.6rem 1rem; font-size: 0.85rem; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; background: ${this.micEnabled ? "#374151" : "#ef4444"}; color: #fff;`,
                    onclick: () => this.toggleMic(),
                },
                this.micEnabled ? "Mute" : "Unmute"
            ),
        ];

        if (!this.isVoiceOnly) {
            buttons.push(
                h(
                    "button",
                    {
                        style: `padding: 0.6rem 1rem; font-size: 0.85rem; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; background: ${this.cameraEnabled ? "#374151" : "#ef4444"}; color: #fff;`,
                        onclick: () => this.toggleCamera(),
                    },
                    this.cameraEnabled ? "Camera Off" : "Camera On"
                )
            );
        }

        return buttons;
    }
    update() {
        if (!this.el) return;
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
    }
}
