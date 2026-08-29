// js/components/patient/messaging/PatientMessaging.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import api from "../../services/api.js";

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
    
        this.pollTimer = null;
        this._loadRequestId = 0;
    }
    
    beforeUnmount() {
        this.stopPolling();
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

    // ---------- Actions ----------

    setMessageDraft(value) {
        this.messageDraft = value;
    }

    async sendMessage() {
        const body = this.messageDraft.trim();
        if (!body || this.sending || !this.activeConversationId) return;
    
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
            { class: "dashboard-page" },
            this.view === "list" ? this.renderListHeader() : this.renderThreadHeader(),
            this.view === "list" ? this.renderListAlerts() : null,
            this.loading && this.view === "list"
                ? h(
                      "div",
                      { class: "dashboard-page queue-page patient-messaging-page" },
                      h("p", { class: "dashboard-muted" }, "Loading messages...")
                  )
                : this.view === "list"
                ? this.renderConversationList()
                : this.renderThread()
        );
    }

    // ---------- List view ----------

    renderListHeader() {
        return h(
            "section",
            { class: "dashboard-header" },
            h(
                "div",
                { class: "dashboard-header__content" },
                h("p", { class: "dashboard-greeting" }, "My Messages"),
                h("h1", { class: "dashboard-title" }, "Messages"),
                h(
                    "p",
                    { class: "dashboard-subtitle" },
                    "Secure conversations with your doctors."
                )
            )
        );
    }

    renderListAlerts() {
        if (!this.errorMessage) return null;
        return h(
            "div",
            { class: "dashboard-card", style: "border-left: 4px solid #ef4444; margin-bottom: var(--space-3);" },
            h("p", { style: "color: #ef4444; margin: 0;" }, this.errorMessage)
        );
    }

    renderConversationList() {
        return h(
            "div",
            { class: "services-list" },
            h(
                "div",
                {
                    class: "dashboard-card",
                    style: "padding: 0.85rem 1rem; margin-bottom: var(--space-3);",
                },
                h("input", {
                    type: "text",
                    placeholder: "Search by doctor name...",
                    value: this.searchTerm,
                    style: "width: 100%; padding: 0.55rem 0.7rem; border: 1px solid var(--color-line); border-radius: 6px; font-size: 0.88rem; box-sizing: border-box;",
                    oninput: e => this.setSearchTerm(e.target.value),
                })
            ),
            this.conversations.length === 0
                ? h(
                      "div",
                      { class: "dashboard-card text-center py-4" },
                      h(
                          "p",
                          { class: "dashboard-muted" },
                          this.searchTerm
                              ? `No conversations match "${this.searchTerm}".`
                              : "No conversations yet. Message a doctor from your appointments."
                      )
                  )
                : h(
                      "div",
                      { class: "services-list" },
                      this.conversations.map(conversation => this.renderConversationCard(conversation)),
                      this.renderLoadMore()
                  )
        );
    }
    
    renderLoadMore() {
        if (!this.hasMore || this.loading) return null;
    
        return h(
            "div",
            { class: "text-center", style: "margin-top: var(--space-2);" },
            h(
                "button",
                {
                    class: "btn btn-outline",
                    style: "padding: 0.35rem 0.8rem; font-size: 0.75rem; border-radius: 5px;",
                    disabled: this.loadingMore,
                    onclick: () => this.loadMoreConversations(),
                },
                this.loadingMore ? "Loading..." : "Load More"
            )
        );
    }
    renderConversationCard(conversation) {
        const unread = conversation.unread_count || 0;
        const statusLabel = STATUS_LABELS[conversation.status] || conversation.status;

        const badgeColor =
            conversation.status === "open"
                ? "#10b981"
                : conversation.status === "archived"
                ? "var(--color-ink-faint)"
                : "#64748b";

        const previewText = conversation.last_message_deleted_at
            ? "This message was deleted"
            : conversation.last_message_type && conversation.last_message_type !== "text"
            ? `Sent a ${conversation.last_message_type}`
            : conversation.last_message_body || "No messages yet";

        return h(
            "div",
            {
                class: "dashboard-card service-item-card",
                style: "padding: 0.9rem 1.1rem; margin-bottom: var(--space-3); cursor: pointer;",
                onclick: () => this.openConversation(conversation),
            },
            h(
                "div",
                { style: "display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3);" },
                h(
                    "div",
                    { style: "min-width: 0; flex: 1;" },
                    h(
                        "h3",
                        { style: "margin: 0 0 4px; font-size: 1.0rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" },
                        conversation.doctor_name || "Unknown Doctor"
                    ),
                    h(
                        "p",
                        {
                            class: unread > 0 ? "" : "dashboard-muted",
                            style: `margin: 0; font-size: 0.82rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; ${unread > 0 ? "font-weight: 600;" : ""}`,
                        },
                        previewText
                    )
                ),
                h(
                    "div",
                    { style: "display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0;" },
                    h(
                        "span",
                        { class: "dashboard-muted", style: "font-size: 0.72rem; white-space: nowrap;" },
                        this.formatDateTime(conversation.last_message_created_at || conversation.created_at)
                    ),
                    unread > 0
                        ? h(
                              "span",
                              {
                                  class: "dashboard-badge",
                                  style: "background: #0284c7; font-size: 0.68rem; padding: 2px 7px; border-radius: 10px;",
                              },
                              String(unread)
                          )
                        : h(
                              "span",
                              {
                                  class: "dashboard-badge",
                                  style: `background: ${badgeColor}; font-size: 0.68rem; padding: 2px 7px; border-radius: 5px;`,
                              },
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
            { class: "dashboard-header", style: "display: flex; align-items: flex-start; gap: 10px;" },
            h(
                "button",
                {
                    class: "btn btn-outline",
                    style: "padding: 0.4rem 0.6rem; font-size: 0.8rem; border-radius: 6px; flex-shrink: 0; color: white;",
                    onclick: () => this.closeThread(),
                },
                "← Back"
            ),
            h(
                "div",
                { style: "min-width: 0; flex: 1;" },
                h(
                    "h1",
                    { class: "dashboard-title", style: "font-size: 1.15rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" },
                    conversation.doctor_name || "Conversation"
                ),
                h(
                    "p",
                    { class: "dashboard-subtitle", style: "font-size: 0.8rem;" },
                    `Status: ${statusLabel}`
                )
            )
        );
    }

    renderThread() {
        return h(
            "div",
            { class: "dashboard-card", style: "padding: 0; display: flex; flex-direction: column; height: calc(100dvh - 320px); min-height: 250px; overflow: hidden;" },
            this.renderThreadStatusBar(),
            this.messagesError
                ? h(
                      "div",
                      { style: "padding: 0.6rem 1rem; border-bottom: 1px solid var(--color-line);" },
                      h("p", { style: "color: #ef4444; margin: 0; font-size: 0.82rem;" }, this.messagesError)
                  )
                : null,
            h(
                "div",
                {
                    id: "patient-chat-thread-body",
                    style: "flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 10px;",
                },
                this.messagesLoading
                    ? h("p", { class: "dashboard-muted text-center" }, "Loading conversation...")
                    : this.messages.length === 0
                    ? h("p", { class: "dashboard-muted text-center" }, "No messages yet. Say hello.")
                    : [
                          this.renderLoadOlderButton(),
                          ...this.messages.map(message => this.renderMessageBubble(message)),
                      ]
            ),
            this.renderComposer()
        );
    }
    
    renderLoadOlderButton() {
        if (!this.hasMoreMessages) return null;
    
        return h(
            "div",
            { class: "text-center", style: "margin-bottom: 8px;" },
            h(
                "button",
                {
                    class: "btn btn-outline",
                    style: "padding: 0.3rem 0.7rem; font-size: 0.74rem; border-radius: 5px;",
                    disabled: this.messagesLoadingOlder,
                    onclick: () => this.loadOlderMessagesPreservingScroll(),
                },
                this.messagesLoadingOlder ? "Loading..." : "Load older messages"
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
            {
                style: "padding: 0.6rem 1rem; border-bottom: 1px solid var(--color-line); background: rgba(2,132,199,0.04);",
            },
            h(
                "p",
                { class: "dashboard-muted", style: "margin: 0; font-size: 0.8rem;" },
                conversation.status === "closed"
                    ? "Your doctor has closed this conversation. Contact them from a new appointment if you need to reopen it."
                    : "This conversation is archived."
            )
        );
    }

    renderMessageBubble(message) {
        const isMine = message.sender_role === "patient";
        const isDeleted = !!message.deleted_at;

        return h(
            "div",
            { style: `display: flex; flex-direction: column; align-items: ${isMine ? "flex-end" : "flex-start"};` },
            h(
                "div",
                {
                    style: `max-width: 78%; padding: 0.55rem 0.8rem; border-radius: 12px; font-size: 0.88rem; line-height: 1.45; ${
                        isMine
                            ? "background: var(--color-primary, #0284c7); color: #fff; border-bottom-right-radius: 3px;"
                            : "background: var(--color-bg-muted, #f1f5f9); color: inherit; border-bottom-left-radius: 3px;"
                    } ${isDeleted ? "font-style: italic; opacity: 0.7;" : ""}`,
                },
                isDeleted ? "This message was deleted" : (message.body || "")
            ),
            h(
                "span",
                { class: "dashboard-muted", style: "font-size: 0.68rem; margin-top: 3px;" },
                `${this.formatTime(message.created_at)}${message.is_edited ? " · edited" : ""}`
            )
        );
    }

    renderComposer() {
        const conversation = this.activeConversation || {};
        const isClosed = conversation.status !== "open";

        return h(
            "div",
            { style: "border-top: 1px solid var(--color-line); padding: 0.75rem; display: flex; gap: 8px; align-items: flex-end;" },
            h("textarea", {
                rows: 1,
                placeholder: isClosed ? "This conversation is no longer open" : "Type a message...",
                value: this.messageDraft,
                disabled: isClosed || this.sending,
                style: "flex: 1; padding: 0.55rem 0.7rem; border: 1px solid var(--color-line); border-radius: 8px; font-size: 0.88rem; font-family: inherit; resize: none; box-sizing: border-box; max-height: 100px;",
                oninput: e => this.setMessageDraft(e.target.value),
                onkeydown: e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        this.sendMessage();
                    }
                },
            }),
            h(
                "button",
                {
                    class: "btn btn-primary",
                    style: "padding: 0.55rem 1rem; font-size: 0.85rem; border-radius: 8px; flex-shrink: 0;",
                    disabled: this.sending,
                    onclick: () => this.sendMessage(),
                },
                this.sending ? "Sending..." : "Send"
            )
        );
    }

    update() {
        if (!this.el) return;
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
    
        if (this.view === "thread" && !this.messagesLoadingOlder) {
            const threadBody = this.el.querySelector("#patient-chat-thread-body");
            if (threadBody) threadBody.scrollTop = threadBody.scrollHeight;
        }
    }
}
