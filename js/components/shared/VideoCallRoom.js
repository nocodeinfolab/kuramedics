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
    constructor(bookingId, user, onLeave) {
        super();
        this.bookingId = bookingId;
        this.user = user ?? {};
        this.onLeave = onLeave;

        this.status = "connecting"; // "connecting" | "connected" | "error"
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

        this.status = "connecting";
        this.errorMessage = "";
        this.update();

        try {
            const res = await api.post(`/video/bookings/${this.bookingId}/token`);
            const session = res.data || res;

            this.room = new LivekitClient.Room({
                adaptiveStream: true,
                dynacast: true,
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

            this.room.on(LivekitClient.RoomEvent.Disconnected, () => {
                this.status = "error";
                this.errorMessage = "Call ended or connection lost.";
                this.update();
            });

            await this.room.connect(session.url, session.token);
            await this.room.localParticipant.setCameraEnabled(true);
            await this.room.localParticipant.setMicrophoneEnabled(true);

            this.status = "connected";
            this.update();

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

    // ---------- Video tile management (direct DOM, not h()-tree) ----------

    getOrCreateTile(identity, label) {
        if (this.tiles[identity]) return this.tiles[identity];

        const grid = this.el?.querySelector("#video-call-grid");
        if (!grid) return null;

        const tile = document.createElement("div");
        tile.style.cssText = "position: relative; background: #1e1e1e; border-radius: 10px; overflow: hidden; min-height: 160px; display: flex; align-items: center; justify-content: center;";

        const labelEl = document.createElement("span");
        labelEl.textContent = label;
        labelEl.style.cssText = "position: absolute; bottom: 8px; left: 10px; color: #fff; font-size: 0.78rem; background: rgba(0,0,0,0.5); padding: 2px 8px; border-radius: 4px; z-index: 2;";

        tile.appendChild(labelEl);
        grid.appendChild(tile);
        this.tiles[identity] = tile;
        return tile;
    }

    attachTrack(track, identity, label) {
        const tile = this.getOrCreateTile(identity, label);
        if (!tile) return;

        const el = track.attach();
        el.style.cssText = "width: 100%; height: 100%; object-fit: cover;";
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
    }

    // ---------- Controls ----------

    async toggleCamera() {
        this.cameraEnabled = !this.cameraEnabled;
        await this.room?.localParticipant.setCameraEnabled(this.cameraEnabled);
        this.updateControlsOnly();
    }

    async toggleMic() {
        this.micEnabled = !this.micEnabled;
        await this.room?.localParticipant.setMicrophoneEnabled(this.micEnabled);
        this.updateControlsOnly();
    }

    async leaveCall() {
        try {
            this.room?.disconnect();
        } catch (error) {
            console.error("Error leaving call:", error);
        }

        this.el?.remove();

        if (typeof this.onLeave === "function") {
            this.onLeave();
        }
    }

    // ---------- Partial re-render for controls, so the video grid is never touched ----------

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
                h("p", { style: "margin: 0; color: #fff; font-size: 0.88rem; font-weight: 600;" },
                    this.status === "connecting" ? "Connecting..." : this.status === "error" ? "Call unavailable" : "In call"
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
                : h("div", {
                      id: "video-call-grid",
                      style: "flex: 1; padding: 10px; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; align-content: start; overflow-y: auto;",
                  }),
            this.status === "connected"
                ? h(
                      "div",
                      { id: "video-call-controls", style: "padding: 1rem; display: flex; justify-content: center; gap: 12px; flex-shrink: 0;" },
                      this.renderControls()
                  )
                : null
        );
    }

    renderControls() {
        return [
            h(
                "button",
                {
                    style: `padding: 0.6rem 1rem; font-size: 0.85rem; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; background: ${this.micEnabled ? "#374151" : "#ef4444"}; color: #fff;`,
                    onclick: () => this.toggleMic(),
                },
                this.micEnabled ? "Mute" : "Unmute"
            ),
            h(
                "button",
                {
                    style: `padding: 0.6rem 1rem; font-size: 0.85rem; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; background: ${this.cameraEnabled ? "#374151" : "#ef4444"}; color: #fff;`,
                    onclick: () => this.toggleCamera(),
                },
                this.cameraEnabled ? "Camera Off" : "Camera On"
            ),
        ];
    }

    update() {
        if (!this.el) return;
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
    }
}
