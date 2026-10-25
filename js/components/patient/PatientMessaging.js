// js/components/patient/messaging/PatientMessaging.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import api from "../../services/api.js";
const icon = (paths, size = 18) => h("svg", { viewBox: "0 0 24 24", fill: "none", width: String(size), height: String(size), "aria-hidden": "true" }, ...paths.map(d => h("path", { d, stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round" })));


const POLL_INTERVAL_MS = 60000;

const STATUS_LABELS = {
    open: "Open",
    closed: "Closed",
    archived: "Archived",
};

export default class PatientMessaging extends Component {
    constructor(patient, socket, onMessagesRead) {
        super();
        this.patient = patient ?? {};
        this.socket = socket ?? null;
        this.onMessagesRead = onMessagesRead ?? (() => {}); 
    
        this.loading = true;
        this.loadingMore = false;
        this.errorMessage = "";
    
        this.conversations = [];
        this.page = 0;
        this.hasMore = true;
        this.totalCount = 0;
        this.searchTerm = "";
    
        this.view = "list";
        this.activeConversationId = null;
        this.activeConversation = null;
    
        this.messages = [];
        this.messagesLoading = false;
        this.messagesLoadingOlder = false;
        this.messagesError = "";
        this.messagesPage = 0;
        this.hasMoreMessages = true;
    
        this.messageDraft = "";
        this.sending = false;
        
        // File upload state
        this.pendingFile = null;
        this.pendingFilePreviewUrl = null;
        this.uploading = false;
        this.uploadProgress = 0;
        
        this.pollTimer = null;
        this._loadRequestId = 0;
    }
    
    beforeUnmount() {
        this.stopPolling();
        this.clearPendingFile();
    }

    // ---------- Data loading ----------

    async afterMount() {
        await this.loadConversations({ reset: true });
    }
    
    async loadConversations({ reset = false } = {}) {
        const requestId = ++this._loadRequestId;
    
        if (reset) {
            this.loading = true;
            this.page = 0;
            this.conversations = [];
            this.hasMore = true;
            this.errorMessage = "";
        } else {
            this.loadingMore = true;
        }
        this.update();
    
        try {
            const nextPage = this.page + 1;
            const params = new URLSearchParams({
                page: String(nextPage),
                limit: "10",
            });
            if (this.searchTerm.trim()) params.set("search", this.searchTerm.trim());
    
            const res = await api.get(`/chat/conversations?${params.toString()}`);
    
            if (requestId !== this._loadRequestId) return;
    
            const payload = res.data || res;
            const rows = payload.items || payload.rows || payload.data || [];
            const pagination = payload.pagination || {};
    
            this.conversations = reset ? rows : [...this.conversations, ...rows];
            this.totalCount = pagination.totalItems ?? rows.length;
            this.page = pagination.currentPage ?? nextPage;
            this.hasMore = pagination.hasNextPage ?? (this.conversations.length < this.totalCount);
        } catch (error) {
            if (requestId !== this._loadRequestId) return;
            console.error("Failed to load conversations:", error);
            this.errorMessage = error.message || "Failed to load messages.";
        } finally {
            if (requestId === this._loadRequestId) {
                this.loading = false;
                this.loadingMore = false;
                this.update();
            }
        }
    }
    
    loadMoreConversations() {
        this.loadConversations({ reset: false });
    }

    async loadMessages(conversationId, { silent = false, loadOlder = false } = {}) {
        if (loadOlder) {
            this.messagesLoadingOlder = true;
        } else if (!silent) {
            this.messagesLoading = true;
            this.messagesError = "";
            this.messagesPage = 0;
            this.hasMoreMessages = true;
        }
        this.update();
    
        try {
            const nextPage = loadOlder ? this.messagesPage + 1 : 1;
            const params = new URLSearchParams({
                page: String(nextPage),
                limit: "30",
            });
    
            const res = await api.get(`/chat/conversations/${conversationId}/messages?${params.toString()}`);
            const payload = res.data || res;
            const rows = payload.items || payload.rows || payload.data || [];
            const pagination = payload.pagination || {};
    
            if (loadOlder) {
                // Prepend older messages above the currently loaded ones
                this.messages = [...rows, ...this.messages];
            } else {
                this.messages = rows;
            }
    
            this.messagesPage = pagination.currentPage ?? nextPage;
            this.hasMoreMessages = pagination.hasNextPage ?? false;
        } catch (error) {
            console.error("Failed to load messages:", error);
            if (!silent) {
                this.messagesError = error.message || "Failed to load conversation.";
            }
        } finally {
            this.messagesLoading = false;
            this.messagesLoadingOlder = false;
            this.update();
        }
    }
    
    loadOlderMessages() {
        if (!this.activeConversationId || this.messagesLoadingOlder || !this.hasMoreMessages) return;
        this.loadMessages(this.activeConversationId, { loadOlder: true });
    }

    // ---------- Thread navigation ----------

    async openConversation(conversation) {
        this.view = "thread";
        this.activeConversationId = conversation.id;
        this.activeConversation = conversation;
        this.messages = [];
        this.messagesPage = 0;
        this.hasMoreMessages = true;
        this.messageDraft = "";
        this.update();
    
        this.socket?.emit("conversation:join", { conversationId: conversation.id });
    
        await this.loadMessages(conversation.id);
    
        try {
            const previousUnread = conversation.unread_count || 0;   
    
            await api.patch(`/chat/conversations/${conversation.id}/read`, {});
            this.conversations = this.conversations.map(c =>
                c.id === conversation.id ? { ...c, unread_count: 0 } : c
            );
    
            if (previousUnread > 0) {
                this.onMessagesRead(previousUnread);   
            }
        } catch (error) {
            console.error("Failed to mark conversation read:", error);
        }
    
        this.startPolling(conversation.id);
        this.update();
    }

    closeThread() {
        this.stopPolling();
        this.socket?.emit("conversation:leave", { conversationId: this.activeConversationId });
        this.view = "list";
        this.activeConversationId = null;
        this.activeConversation = null;
        this.messages = [];
        this.messageDraft = "";
        this.update();
    
        this.loadConversations({ reset: true });
    }

    startPolling(conversationId) {
        this.stopPolling();
        this.pollTimer = setInterval(() => {
            this.loadMessages(conversationId, { silent: true });
        }, POLL_INTERVAL_MS);
    }

    stopPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }


    setMessageDraft(value) {
        this.messageDraft = value;
    }

    pickFile() {
        if (this.uploading || this.sending || !this.activeConversationId) return;
    
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf";
        input.onchange = (e) => {
            const file = e.target.files?.[0];
            if (file) this.handleFileSelected(file);
        };
        input.click();
    }
    
    handleFileSelected(file) {
        const MAX_BYTES = 10 * 1024 * 1024;
        const ALLOWED_MIMES = [
            "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
            "application/pdf",
        ];
    
        if (file.size > MAX_BYTES) {
            this.messagesError = "File is too large. Maximum is 10 MB.";
            this.update();
            return;
        }
    
        // HEIC/HEIF from iPhones often report empty `type` from some pickers.
        // Fall back to extension check so photos still pass validation.
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        const extAllowed = ["jpg", "jpeg", "png", "webp", "heic", "heif", "pdf"].includes(ext);
        const mimeAllowed = ALLOWED_MIMES.includes(file.type);
    
        if (!mimeAllowed && !extAllowed) {
            this.messagesError = "Only images (JPG, PNG, WebP, HEIC) and PDFs are allowed.";
            this.update();
            return;
        }
    
        this.clearPendingFile();
        this.pendingFile = file;
    
        const isImage = file.type.startsWith("image/") ||
            ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(ext);
    
        if (isImage) {
            try {
                this.pendingFilePreviewUrl = URL.createObjectURL(file);
            } catch {
                this.pendingFilePreviewUrl = null;
            }
        }
    
        this.messagesError = "";
        this.update();
    }
    
    clearPendingFile() {
        if (this.pendingFilePreviewUrl) {
            URL.revokeObjectURL(this.pendingFilePreviewUrl);
            this.pendingFilePreviewUrl = null;
        }
        this.pendingFile = null;
        this.uploadProgress = 0;
    }
    
    formatFileSize(bytes) {
        const n = Number(bytes || 0);
        if (n < 1024) return `${n} B`;
        if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
        return `${(n / 1024 / 1024).toFixed(1)} MB`;
    }
    
    async uploadAndSendFile() {
        const file = this.pendingFile;
        if (!file || !this.activeConversationId) return;
    
        this.uploading = true;
        this.uploadProgress = 0;
        this.messagesError = "";
        this.update();
    
        try {
            const fd = new FormData();
            if (this.messageDraft.trim()) {
                fd.append("body", this.messageDraft.trim());
            }
            fd.append("file", file);
    
            const uploadedMessage = await api.uploadFile(
                `/chat/conversations/${this.activeConversationId}/attachments`,
                fd,
                {
                    onProgress: (pct) => {
                        this.uploadProgress = pct;
                        const bar = this.el?.querySelector("#upload-progress-bar");
                        if (bar) bar.style.width = `${pct}%`;
                        const label = this.el?.querySelector("#upload-progress-label");
                        if (label) label.textContent = `Uploading… ${pct}%`;
                    },
                }
            );
    
            this.addMessageIfNew(uploadedMessage);
            this.clearPendingFile();
            this.messageDraft = "";
        } catch (err) {
            console.error("Upload failed:", err);
            this.messagesError = err.message || "Failed to upload file.";
        } finally {
            this.uploading = false;
            this.update();
        }
    }
    async sendMessage() {
        if (this.sending || this.uploading || !this.activeConversationId) return;
    
        // If a file is staged, the send button uploads it (caption is optional).
        if (this.pendingFile) {
            await this.uploadAndSendFile();
            return;
        }
    
        const body = this.messageDraft.trim();
        if (!body) return;
    
        this.sending = true;
        this.messagesError = "";
        this.update();
    
        try {
            const res = await api.post(`/chat/conversations/${this.activeConversationId}/messages`, {
                body,
                message_type: "text",
            });
            const newMessage = res.data || res;
            this.addMessageIfNew(newMessage);
            this.messageDraft = "";
        } catch (error) {
            console.error("Failed to send message:", error);
            this.messagesError = error.message || "Failed to send message.";
        } finally {
            this.sending = false;
            this.update();
        }
    }
    setSearchTerm(term) {
        this.searchTerm = term;
        this.update(); 
    
        clearTimeout(this._searchDebounceTimer);
        this._searchDebounceTimer = setTimeout(() => {
            this.loadConversations({ reset: true });
        }, 400); 
    }
    // ---------- Live updates (called externally by PatientDashboardPage) ----------

    receiveIncomingMessage(message) {
        if (!message || !message.conversation_id) return;
    
        const isActiveThread = this.view === "thread" && this.activeConversationId === message.conversation_id;
        let appendedDirectly = false;
    
        if (isActiveThread) {
            const wasEmpty = this.messages.length === 0;
            const isNew = this.addMessageIfNew(message);
            api.patch(`/chat/conversations/${message.conversation_id}/read`, {}).catch(() => {});
            this.onMessagesRead(1);
    
            if (isNew && !wasEmpty) {
                this.appendMessageBubbleToThread(message);
                appendedDirectly = true;
            }
        }
    
        this.conversations = this.conversations.map(c => {
            if (c.id !== message.conversation_id) return c;
            return {
                ...c,
                last_message_body: message.body,
                last_message_type: message.message_type,
                last_message_created_at: message.created_at,
                last_message_deleted_at: null,
                unread_count: isActiveThread || message.sender_role === "patient"
                    ? c.unread_count || 0
                    : (c.unread_count || 0) + 1,
            };
        });
    
        if (this.view === "list" || (isActiveThread && !appendedDirectly)) {
            this.update();
        }
    }
    
    appendMessageBubbleToThread(message) {
        const threadBody = this.el?.querySelector("#patient-chat-thread-body");
        if (!threadBody) return;
    
        const bubbleNode = this.renderMessageBubble(message);
        threadBody.appendChild(bubbleNode);
        threadBody.scrollTop = threadBody.scrollHeight;
    }
    // ---------- Message list helpers ----------

    addMessageIfNew(message) {
        const alreadyExists = this.messages.some(m => m.id === message.id);
        if (!alreadyExists) {
            this.messages = [...this.messages, message];
        }
        return !alreadyExists;
    }

    // ---------- Formatting ----------

    formatDateTime(dateString) {
        if (!dateString) return "";
        return new Date(dateString).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    formatTime(dateString) {
        if (!dateString) return "";
        return new Date(dateString).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    // ---------- Render ----------

    render() {
        return h(
            "div",
            { class: "patient-messaging" },
            this.view === "list" ? this.renderListHeader() : this.renderThreadHeader(),
            h(
                "div",
                { class: "pm-body" },
                this.view === "list"
                    ? [
                          h(
                              "p",
                              { class: "pm-intro" },
                              "Secure conversations with your doctors."
                          ),
                          this.renderListAlerts(),
                          this.loading ? this.renderListSkeleton() : this.renderConversationList()
                      ]
                    : this.renderThread()
            )
        );
    }

    renderListSkeleton() {
        return h(
            "div",
            { class: "pm-skel-stack", "aria-busy": "true", "aria-label": "Loading messages" },
            ...[0, 1, 2].map(() =>
                h(
                    "div",
                    { class: "pm-conversation pm-conversation--skeleton" },
                    h("div", { class: "pm-skel pm-skel--avatar" }),
                    h(
                        "div",
                        { class: "pm-conv-body" },
                        h("div", { class: "pm-skel pm-skel--line pm-skel--short" }),
                        h("div", { class: "pm-skel pm-skel--line" })
                    )
                )
            )
        );
    }

    // ---------- List view ----------

    renderListHeader() {
        return h(
            "section",
            { class: "dashboard-header patient-home" },
            h(
                "div",
                { class: "ph-hero" },
                h(
                    "div",
                    { class: "ph-hero__text" },
                    h("p", { class: "dashboard-greeting" }, "My Messages"),
                    h("h1", { class: "dashboard-title" }, "Messages")
                )
            )
        );
    }

    renderListAlerts() {
        if (!this.errorMessage) return null;
        return h(
            "div",
            { class: "pm-alert", role: "alert" },
            h(
                "div",
                { class: "pm-alert-icon" },
                icon(["M12 9v4", "M12 17h.01", "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"], 18)
            ),
            h("p", { class: "pm-alert-text" }, this.errorMessage)
        );
    }

    renderConversationList() {
        return h(
            "div",
            { class: "pm-list-stack" },
            h(
                "div",
                { class: "pm-search-wrap" },
                h(
                    "span",
                    { class: "pm-search-icon" },
                    icon(["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16", "M21 21l-4.35-4.35"], 16)
                ),
                h("input", {
                    type: "text",
                    class: "pm-search-input",
                    "data-focus-key": "search",
                    "aria-label": "Search conversations",
                    placeholder: "Search by doctor name",
                    value: this.searchTerm,
                    oninput: e => this.setSearchTerm(e.target.value),
                })
            ),
            this.conversations.length === 0
                ? h(
                      "div",
                      { class: "pm-empty" },
                      h(
                          "div",
                          { class: "pm-empty-icon" },
                          icon(["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"], 22)
                      ),
                      h(
                          "p",
                          { class: "pm-empty-title" },
                          this.searchTerm
                              ? "No matches"
                              : "No conversations yet"
                      ),
                      h(
                          "p",
                          { class: "pm-empty-text" },
                          this.searchTerm
                              ? `No conversations match "${this.searchTerm}".`
                              : "Message a doctor from your appointments to start."
                      )
                  )
                : h(
                      "div",
                      { class: "pm-list" },
                      this.conversations.map(conversation => this.renderConversationCard(conversation)),
                      this.renderLoadMore()
                  )
        );
    }

    renderLoadMore() {
        if (!this.hasMore || this.loading) return null;

        return h(
            "div",
            { class: "pm-load-more-wrap" },
            h(
                "button",
                {
                    class: "pm-load-more",
                    type: "button",
                    disabled: this.loadingMore,
                    onclick: () => this.loadMoreConversations(),
                },
                this.loadingMore ? h("span", { class: "pm-spinner pm-spinner--dark" }) : null,
                h("span", null, this.loadingMore ? "Loading…" : "Load more")
            )
        );
    }
    renderConversationCard(conversation) {
        const unread = conversation.unread_count || 0;
        const statusLabel = STATUS_LABELS[conversation.status] || conversation.status;
        const initial = (conversation.doctor_name || "?").charAt(0).toUpperCase();
        const hasUnread = unread > 0;

        const previewText = conversation.last_message_deleted_at
            ? "This message was deleted"
            : conversation.last_message_type === "image"
            ? "📷 Photo"
            : conversation.last_message_type === "file"
            ? "📎 Attachment"
            : conversation.last_message_body || "No messages yet";

        const chipTone =
            conversation.status === "open" ? "success"
            : conversation.status === "archived" ? "muted"
            : "info";

        return h(
            "button",
            {
                class: `pm-conversation${hasUnread ? " pm-conversation--unread" : ""}`,
                type: "button",
                onclick: () => this.openConversation(conversation),
            },
            h("div", { class: "pm-conv-avatar" }, initial),
            h(
                "div",
                { class: "pm-conv-body" },
                h(
                    "div",
                    { class: "pm-conv-head" },
                    h(
                        "span",
                        { class: "pm-conv-name" },
                        conversation.doctor_name || "Unknown Doctor"
                    ),
                    h(
                        "span",
                        { class: "pm-conv-time" },
                        this.formatDateTime(
                            conversation.last_message_created_at || conversation.created_at
                        )
                    )
                ),
                h(
                    "div",
                    { class: "pm-conv-foot" },
                    h(
                        "span",
                        { class: `pm-conv-preview${hasUnread ? " pm-conv-preview--unread" : ""}` },
                        previewText
                    ),
                    hasUnread
                        ? h(
                              "span",
                              { class: "pm-conv-badge" },
                              unread > 9 ? "9+" : String(unread)
                          )
                        : h(
                              "span",
                              { class: `pm-conv-chip pm-conv-chip--${chipTone}` },
                              statusLabel
                          )
                )
            )
        );
    }

    // ---------- Thread view ----------

    renderThreadHeader() {
        const conversation = this.activeConversation || {};
        const statusLabel = STATUS_LABELS[conversation.status] || conversation.status;

        return h(
            "section",
            { class: "dashboard-header patient-home" },
            h(
                "div",
                { class: "ph-hero" },
                h(
                    "button",
                    {
                        class: "ph-hero__back",
                        type: "button",
                        "aria-label": "Back to messages",
                        onclick: () => this.closeThread(),
                    },
                    icon(["M15 18l-6-6 6-6"], 18)
                ),
                h(
                    "div",
                    { class: "ph-hero__text" },
                    h("p", { class: "dashboard-greeting" }, "Conversation"),
                    h(
                        "h1",
                        { class: "dashboard-title" },
                        conversation.doctor_name || "Conversation"
                    ),
                    h(
                        "p",
                        { class: "dashboard-subtitle" },
                        `Status: ${statusLabel}`
                    )
                )
            )
        );
    }

    renderThread() {
        return h(
            "div",
            { class: "pm-thread-card" },
            this.renderThreadStatusBar(),
            this.messagesError
                ? h(
                      "div",
                      { class: "pm-thread-error" },
                      h("p", null, this.messagesError)
                  )
                : null,
            h(
                "div",
                { id: "patient-chat-thread-body", class: "pm-thread-body" },
                this.messagesLoading
                    ? this.renderThreadLoading()
                    : this.messages.length === 0
                    ? this.renderThreadEmpty()
                    : [
                          this.renderLoadOlderButton(),
                          ...this.messages.map(message => this.renderMessageBubble(message)),
                      ]
            ),
            this.renderComposer()
        );
    }

    renderThreadLoading() {
        return h(
            "div",
            { class: "pm-thread-loading" },
            h("div", { class: "pm-skel pm-skel--line pm-skel--short" }),
            h("div", { class: "pm-skel pm-skel--line" }),
            h("div", { class: "pm-skel pm-skel--line pm-skel--short" })
        );
    }

    renderThreadEmpty() {
        return h(
            "div",
            { class: "pm-thread-empty" },
            h(
                "div",
                { class: "pm-thread-empty-icon" },
                icon(["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"], 20)
            ),
            h("p", { class: "pm-thread-empty-title" }, "No messages yet"),
            h("p", { class: "pm-thread-empty-text" }, "Say hello to start the conversation.")
        );
    }

    renderLoadOlderButton() {
        if (!this.hasMoreMessages) return null;

        return h(
            "div",
            { class: "pm-load-older-wrap" },
            h(
                "button",
                {
                    class: "pm-load-older",
                    type: "button",
                    disabled: this.messagesLoadingOlder,
                    onclick: () => {
                        this._justLoadedOlder = true;
                        this.loadOlderMessages();
                    },
                },
                this.messagesLoadingOlder ? h("span", { class: "pm-spinner pm-spinner--dark" }) : null,
                h("span", null, this.messagesLoadingOlder ? "Loading…" : "Load older messages")
            )
        );
    }
    
    async loadOlderMessagesPreservingScroll() {
        const threadBody = this.el?.querySelector("#patient-chat-thread-body");
        const previousScrollHeight = threadBody?.scrollHeight || 0;
    
        await this.loadOlderMessages();
    
        // After the new (taller) content renders, restore the user's visual position
        // by shifting scrollTop by exactly how much content was added above it.
        requestAnimationFrame(() => {
            const updatedThreadBody = this.el?.querySelector("#patient-chat-thread-body");
            if (updatedThreadBody) {
                const newScrollHeight = updatedThreadBody.scrollHeight;
                updatedThreadBody.scrollTop = newScrollHeight - previousScrollHeight;
            }
        });
    }
    renderThreadStatusBar() {
        const conversation = this.activeConversation || {};
        if (conversation.status === "open") return null;

        return h(
            "div",
            { class: "pm-status-bar" },
            h(
                "div",
                { class: "pm-status-icon" },
                icon(["M12 9v4", "M12 17h.01", "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"], 16)
            ),
            h(
                "p",
                { class: "pm-status-text" },
                conversation.status === "closed"
                    ? "Your doctor has closed this conversation. Contact them from a new appointment if you need to reopen it."
                    : "This conversation is archived."
            )
        );
    }

    renderMessageBubble(message) {
        const isMine = message.sender_role === "patient";
        const isDeleted = !!message.deleted_at;
    
        const bubbleClass = `pm-bubble${isMine ? " pm-bubble--mine" : " pm-bubble--theirs"}${isDeleted ? " pm-bubble--deleted" : ""}`;
        const rowClass = `pm-bubble-row${isMine ? " pm-bubble-row--mine" : " pm-bubble-row--theirs"}`;
    
        // Normalize two response shapes:
        // - Upload endpoint returns attachment_* fields at the top level
        // - listMessages returns attachments[0] with file_* fields
        const att = message.attachments?.[0];
        const attachmentUrl = message.attachment_url || att?.file_url;
        const attachmentName = message.attachment_name || att?.file_name;
        const attachmentSize = message.attachment_size ?? att?.file_size;
    
        let content;
    
        if (isDeleted) {
            content = h("div", { class: bubbleClass }, "This message was deleted");
        } else if (message.message_type === "image" && attachmentUrl) {
            content = h(
                "div",
                { class: `${bubbleClass} pm-bubble--media` },
                h(
                    "a",
                    {
                        href: attachmentUrl,
                        target: "_blank",
                        rel: "noopener noreferrer",
                        onclick: (e) => e.stopPropagation(),
                    },
                    h("img", {
                        class: "pm-bubble-image",
                        src: attachmentUrl,
                        alt: attachmentName || "Image attachment",
                        loading: "lazy",
                    })
                ),
                message.body ? h("p", { class: "pm-bubble-caption" }, message.body) : null
            );
        } else if (message.message_type === "file" && attachmentUrl) {
            content = h(
                "div",
                { class: `${bubbleClass} pm-bubble--file` },
                h(
                    "a",
                    {
                        class: "pm-bubble-file-link",
                        href: attachmentUrl,
                        target: "_blank",
                        rel: "noopener noreferrer",
                        download: attachmentName,
                        onclick: (e) => e.stopPropagation(),
                    },
                    h(
                        "span",
                        { class: "pm-bubble-file-icon" },
                        icon(
                            ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6"],
                            22
                        )
                    ),
                    h(
                        "span",
                        { class: "pm-bubble-file-info" },
                        h("span", { class: "pm-bubble-file-name" }, attachmentName || "File"),
                        h("span", { class: "pm-bubble-file-size" }, this.formatFileSize(attachmentSize))
                    )
                ),
                message.body ? h("p", { class: "pm-bubble-caption" }, message.body) : null
            );
        } else {
            content = h("div", { class: bubbleClass }, message.body || "");
        }
    
        return h(
            "div",
            { class: rowClass },
            content,
            h(
                "span",
                { class: "pm-bubble-time" },
                `${this.formatTime(message.created_at)}${message.is_edited ? " · edited" : ""}`
            )
        );
    }

    renderComposer() {
        const conversation = this.activeConversation || {};
        const isClosed = conversation.status !== "open";
        const isBusy = this.sending || this.uploading;
        const hasDraft = !!this.messageDraft.trim();
    
        return h(
            "div",
            { class: "pm-composer-wrap" },
            this.renderPendingFilePreview(),
            h(
                "div",
                { class: "pm-composer" },
                h(
                    "button",
                    {
                        class: "pm-attach-btn",
                        type: "button",
                        "aria-label": "Attach file",
                        disabled: isClosed || isBusy,
                        onclick: () => this.pickFile(),
                    },
                    icon(["M12 5v14", "M5 12h14"], 22)
                ),
                h("textarea", {
                    rows: 1,
                    class: "pm-composer-input",
                    placeholder: isClosed
                        ? "This conversation is no longer open"
                        : this.pendingFile
                            ? "Add a caption (optional)…"
                            : "Type a message…",
                    value: this.messageDraft,
                    disabled: isClosed || isBusy,
                    oninput: (e) => this.setMessageDraft(e.target.value),
                    onkeydown: (e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            this.sendMessage();
                        }
                    },
                }),
                h(
                    "button",
                    {
                        class: "pm-send-btn",
                        type: "button",
                        "aria-label": "Send",
                        disabled: isBusy || isClosed || (!this.pendingFile && !hasDraft),
                        onclick: () => this.sendMessage(),
                    },
                    isBusy
                        ? h("span", { class: "pm-spinner" })
                        : icon(["M22 2L11 13", "M22 2l-7 20-4-9-9-4 20-7z"], 18)
                )
            )
        );
    }
    
    renderPendingFilePreview() {
        if (!this.pendingFile) return null;
        const file = this.pendingFile;
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        const isImage = file.type.startsWith("image/") ||
            ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(ext);
        const isUploading = this.uploading;
    
        return h(
            "div",
            { class: "pm-pending-file" },
            isImage && this.pendingFilePreviewUrl
                ? h("img", { src: this.pendingFilePreviewUrl, class: "pm-pending-thumb", alt: "" })
                : h(
                      "span",
                      { class: "pm-pending-icon" },
                      icon(
                          ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6"],
                          22
                      )
                  ),
            h(
                "div",
                { class: "pm-pending-info" },
                h("span", { class: "pm-pending-name" }, file.name),
                h("span", { class: "pm-pending-size" }, this.formatFileSize(file.size)),
                isUploading
                    ? h(
                          "div",
                          { class: "pm-pending-progress" },
                          h(
                              "div",
                              { class: "pm-pending-progress-track" },
                              h("div", {
                                  class: "pm-pending-progress-bar",
                                  id: "upload-progress-bar",
                                  style: `width: ${this.uploadProgress}%`,
                              })
                          ),
                          h(
                              "span",
                              { class: "pm-pending-progress-label", id: "upload-progress-label" },
                              `Uploading… ${this.uploadProgress}%`
                          )
                      )
                    : null
            ),
            !isUploading
                ? h(
                      "button",
                      {
                          class: "pm-pending-remove",
                          type: "button",
                          "aria-label": "Remove file",
                          onclick: () => {
                              this.clearPendingFile();
                              this.update();
                          },
                      },
                      icon(["M18 6L6 18", "M6 6l12 12"], 16)
                  )
                : null
        );
    }

    update() {
        if (!this.el) return;
    
        const threadBody = this.el.querySelector("#patient-chat-thread-body");
        const prevScrollHeight = threadBody?.scrollHeight ?? 0;
        const prevScrollTop = threadBody?.scrollTop ?? 0;
        const prevClientHeight = threadBody?.clientHeight ?? 0;
        const wasNearBottom = threadBody
            ? (prevScrollHeight - prevScrollTop - prevClientHeight) < 80
            : true;
    
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
    
        if (this.view === "thread") {
            const newThreadBody = this.el.querySelector("#patient-chat-thread-body");
            if (newThreadBody) {
                if (this._justLoadedOlder && threadBody) {
                    newThreadBody.scrollTop = newThreadBody.scrollHeight - prevScrollHeight + prevScrollTop;
                    this._justLoadedOlder = false;
                } else if (wasNearBottom) {
                    newThreadBody.scrollTop = newThreadBody.scrollHeight;
                } else {
                    newThreadBody.scrollTop = prevScrollTop;
                }
            }
        }
    }
}
