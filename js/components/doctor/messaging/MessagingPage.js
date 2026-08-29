// js/components/doctor/messaging/MessagingPage.js

import { Component } from "../../../core/component.js";
import { h } from "../../../utils/dom.js";
import api from "../../../services/api.js";

const POLL_INTERVAL_MS = 60000; // safety-net fallback; live delivery is via socket

const STATUS_LABELS = {
    open: "Open",
    closed: "Closed",
    archived: "Archived",
};
const CONVERSATIONS_PAGE_LIMIT = 20;
const MESSAGES_PAGE_LIMIT = 30;

export default class MessagingPage extends Component {
    constructor(doctor, socket, onMessagesRead) {
        super();
        this.doctor = doctor ?? {};
        this.socket = socket ?? null;
        this.onMessagesRead = onMessagesRead ?? (() => {});

        this.loading = true;
        this.errorMessage = "";

        this.conversations = [];
        this.convPage = 0;
        this.convHasMore = true;
        this.convTotalCount = 0;
        this.convLoadingMore = false;
        this._searchDebounceTimer = null;
        
        // messages: { rows, page, hasMore, totalCount, loadingOlder }
        this.messagesPage = 0;
        this.messagesHasMore = false;
        this.messagesLoadingOlder = false;
        
        this.searchTerm = "";

        this.view = "list"; // "list" | "thread"
        this.activeConversationId = null;
        this.activeConversation = null;

        this.messages = [];
        this.messagesLoading = false;
        this.messagesError = "";

        this.messageDraft = "";
        this.sending = false;

        this.statusActionLoading = false;

        this.pollTimer = null;
    }

    async afterMount() {
        await this.loadConversations({});
    }

    beforeUnmount() {
        this.stopPolling();
        if (this.activeConversationId) {
            this.socket?.emit("conversation:leave", { conversationId: this.activeConversationId });
        }
    }

    // ---------- Data loading ----------

    async loadConversations({ reset = false, silent = false } = {}) {
        if (reset) {
            if (!silent) { this.loading = true; this.errorMessage = ""; }
            this.convPage = 0;
            this.conversations = [];
            this.convHasMore = true;
        } else {
            this.convLoadingMore = true;
        }
        this.update();
    
        try {
            const nextPage = this.convPage + 1;
            const params = new URLSearchParams({ page: nextPage, limit: CONVERSATIONS_PAGE_LIMIT });
            if (this.searchTerm.trim()) params.set("search", this.searchTerm.trim());
    
            const res = await api.get(`/chat/conversations?${params.toString()}`);
            const payload = res.data || res;
            const rows = payload.items || [];
            const total = payload.pagination?.totalItems ?? rows.length;
    
            this.conversations = reset ? rows : [...this.conversations, ...rows];
            this.convTotalCount = total;
            this.convPage = nextPage;
            this.convHasMore = this.conversations.length < total;
            this._lastFetchedAt = Date.now();
        } catch (error) {
            console.error("Failed to load conversations:", error);
            if (!silent) this.errorMessage = error.message || "Failed to load messages.";
        } finally {
            if (!silent) this.loading = false;
            this.convLoadingMore = false;
            this.update();
        }
    }

    async loadMessages(conversationId, { silent = false, loadOlder = false } = {}) {
        if (loadOlder) {
            this.messagesLoadingOlder = true;
        } else if (!silent) {
            this.messagesLoading = true;
            this.messagesError = "";
        }
        this.update();
    
        try {
            const nextPage = loadOlder ? this.messagesPage + 1 : 1;
            const res = await api.get(
                `/chat/conversations/${conversationId}/messages?page=${nextPage}&limit=${MESSAGES_PAGE_LIMIT}`
            );
            const payload = res.data || res;
            const rows = payload.items || [];
            const total = payload.pagination?.totalItems ?? rows.length;
    
            // rows arrive oldest-first within their page (service reverses each
            // page already); loading "older" means prepending an earlier page
            // above what's currently shown.
            this.messages = loadOlder ? [...rows, ...this.messages] : rows;
            this.messagesPage = nextPage;
            this.messagesHasMore = this.messages.length < total;
        } catch (error) {
            console.error("Failed to load messages:", error);
            if (!silent) this.messagesError = error.message || "Failed to load conversation.";
        } finally {
            this.messagesLoading = false;
            this.messagesLoadingOlder = false;
            this.update();
        }
    }

    // ---------- Message list helpers ----------

    addMessageIfNew(message) {
        const alreadyExists = this.messages.some(m => m.id === message.id);
        if (!alreadyExists) {
            this.messages = [...this.messages, message];
        }
        return !alreadyExists;
    }

    // ---------- Live updates (called externally by DoctorDashboardPage) ----------

    receiveIncomingMessage(message) {
        if (!message || !message.conversation_id) return;
    
        const isActiveThread = this.view === "thread" && this.activeConversationId === message.conversation_id;
        const conversationExists = this.conversations.some(c => c.id === message.conversation_id);
    
        if (isActiveThread) {
            this.addMessageIfNew(message);
            api.patch(`/chat/conversations/${message.conversation_id}/read`, {}).catch(() => {});
            this.onMessagesRead(1);
        }
    
        if (!conversationExists) {
            // Fetch just this one conversation instead of reloading the whole
            // paginated list — keeps whatever the doctor is currently scrolled
            // to / searching for untouched.
            this.fetchAndPrependConversation(message.conversation_id);
            return;
        }
    
        this.conversations = this.conversations.map(c => {
            if (c.id !== message.conversation_id) return c;
            return {
                ...c,
                last_message_body: message.body,
                last_message_type: message.message_type,
                last_message_created_at: message.created_at,
                last_message_deleted_at: null,
                unread_count: isActiveThread || message.sender_role === "doctor"
                    ? c.unread_count || 0
                    : (c.unread_count || 0) + 1,
            };
        });
    
        this.update();
    }
    
    async fetchAndPrependConversation(conversationId) {
        try {
            const res = await api.get(`/chat/conversations/${conversationId}`);
            const conversation = res.data || res;
            // Guard against a race where it arrived while we were fetching.
            if (this.conversations.some(c => c.id === conversationId)) return;
            this.conversations = [conversation, ...this.conversations];
            this.convTotalCount += 1;
            this.update();
        } catch (error) {
            console.error("Failed to fetch new conversation:", error);
        }
    }
    
    isStale(ttlMs = 30_000) {
        return !this._lastFetchedAt || Date.now() - this._lastFetchedAt > ttlMs;
    }

    async loadData({ silent = false } = {}) {
        await this.loadConversations({ silent });
    }

    // ---------- Thread navigation ----------

    async openConversation(conversation) {
        this.view = "thread";
        this.activeConversationId = conversation.id;
        this.activeConversation = conversation;
        this.messages = [];
        this.messagesPage = 0;
        this.messagesHasMore = false;
        this.messageDraft = "";
        this.update();
    
        this.socket?.emit("conversation:join", { conversationId: conversation.id });
    
        await this.loadMessages(conversation.id); // page 1, newest N messages

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

        this.loadConversations();
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
        // No update() here on purpose — the send button no longer depends on
        // draft content (see renderComposer), so we avoid re-rendering (and
        // dropping textarea focus/cursor) on every keystroke.
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

    async setConversationStatus(status) {
        if (!this.activeConversationId || this.statusActionLoading) return;

        this.statusActionLoading = true;
        this.update();

        try {
            const res = await api.patch(`/chat/conversations/${this.activeConversationId}/status`, { status });
            const updated = res.data || res;
            this.activeConversation = { ...this.activeConversation, ...updated };
            this.conversations = this.conversations.map(c =>
                c.id === this.activeConversationId ? { ...c, ...updated } : c
            );
        } catch (error) {
            console.error("Failed to update conversation status:", error);
            this.messagesError = error.message || "Failed to update conversation status.";
        } finally {
            this.statusActionLoading = false;
            this.update();
        }
    }

    setSearchTerm(term) {
        this.searchTerm = term;
        this.update();
    
        clearTimeout(this._searchDebounceTimer);
        this._searchDebounceTimer = setTimeout(() => {
            this.loadConversations({ reset: true });
        }, 350);
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
            { class: `dashboard-page queue-page ${this.view === "thread" ? "in-thread-view" : ""}` },
            this.view === "list" ? this.renderListHeader() : this.renderThreadHeader(),
            this.view === "list" ? this.renderListAlerts() : null,
            this.loading && this.view === "list"
                ? h(
                      "div",
                      { class: "dashboard-card text-center py-4" },
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
            h("p", { class: "dashboard-greeting" }, "Doctor Messages"),
            h("h1", { class: "dashboard-title" }, "Messages"),
            h(
                "p",
                { class: "dashboard-subtitle" },
                "Secure conversations with your patients."
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
                    placeholder: "Search by patient name...",
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
                              : "No conversations yet."
                      )
                  )
                : h(
                      "div",
                      { class: "services-list" },
                      this.conversations.map(conversation => this.renderConversationCard(conversation))
                  ),
            this.renderConversationsLoadMore()
        );
    }
    
    renderConversationsLoadMore() {
        if (!this.convHasMore) return null;
        return h(
            "div",
            { class: "text-center", style: "margin-top: var(--space-2);" },
            h(
                "button",
                {
                    class: "btn btn-outline",
                    style: "padding: 0.35rem 0.8rem; font-size: 0.75rem; border-radius: 5px;",
                    disabled: this.convLoadingMore,
                    onclick: () => this.loadConversations({ reset: false }),
                },
                this.convLoadingMore ? "Loading..." : "Load more conversations"
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
                        conversation.patient_name || "Unknown Patient"
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
            { class: "dashboard-header chat-thread-header", style: "display: flex; align-items: flex-start; gap: 10px;" },
            h(
                "button",
                {
                    class: "btn btn-outline",
                    style: "padding: 0.4rem 0.6rem; font-size: 0.8rem; border-radius: 6px; flex-shrink: 0;",
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
                    conversation.patient_name || "Conversation"
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
            { 
                class: "dashboard-card chat-thread-card", 
                style: "padding: 0; display: flex; flex-direction: column; height: calc(100dvh - 320px); min-height: 290px; overflow: hidden;" 
            },
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
                    id: "chat-thread-body",
                    style: "flex: 1; min-height: 0; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 10px; -webkit-overflow-scrolling: touch;",
                },
                this.messagesHasMore
                    ? h(
                          "div",
                          { class: "text-center" },
                          h(
                              "button",
                              {
                                  class: "btn btn-outline",
                                  style: "padding: 0.3rem 0.7rem; font-size: 0.75rem; border-radius: 5px;",
                                  disabled: this.messagesLoadingOlder,
                                  onclick: () => {
                                      this._justLoadedOlder = true;
                                      this.loadMessages(this.activeConversationId, { loadOlder: true });
                                  },
                              },
                              this.messagesLoadingOlder ? "Loading..." : "Load older messages"
                          )
                      )
                    : null,
                this.messagesLoading
                    ? h("p", { class: "dashboard-muted text-center" }, "Loading conversation...")
                    : this.messages.length === 0
                    ? h("p", { class: "dashboard-muted text-center" }, "No messages yet. Say hello.")
                    : this.messages.map(message => this.renderMessageBubble(message))
            ),
            this.renderComposer()
        );
    }

    renderThreadStatusBar() {
        const conversation = this.activeConversation || {};
        if (conversation.status === "open") return null;

        return h(
            "div",
            {
                style: "padding: 0.6rem 1rem; border-bottom: 1px solid var(--color-line); background: rgba(2,132,199,0.04); display: flex; justify-content: space-between; align-items: center; gap: 10px;",
            },
            h(
                "p",
                { class: "dashboard-muted", style: "margin: 0; font-size: 0.8rem;" },
                conversation.status === "closed"
                    ? "This conversation is closed."
                    : "This conversation is archived."
            ),
            h(
                "button",
                {
                    class: "btn btn-outline",
                    style: "padding: 0.35rem 0.7rem; font-size: 0.78rem; border-radius: 6px;",
                    disabled: this.statusActionLoading,
                    onclick: () => this.setConversationStatus("open"),
                },
                this.statusActionLoading ? "Reopening..." : "Reopen"
            )
        );
    }

    renderMessageBubble(message) {
        const isMine = message.sender_role === "doctor";
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
        const isClosed = conversation.status === "closed";

        return h(
            "div",
            { 
                class: "chat-composer",
                style: "border-top: 1px solid var(--color-line); padding: 0.75rem; display: flex; gap: 8px; align-items: flex-end; background: var(--color-bg-card, #ffffff); zone-index: 10;" 
            },
            h("textarea", {
                rows: 1,
                placeholder: isClosed ? "Reopen the conversation to send a message" : "Type a message...",
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
                    // Always active except while a send is in flight or the
                    // conversation is closed — empty-body and closed-thread
                    // sends are still guarded inside sendMessage() itself.
                    disabled: isClosed || this.sending,
                    onclick: () => this.sendMessage(),
                },
                this.sending ? "Sending..." : "Send"
            )
        );
    }

    update() {
        if (!this.el) return;
    
        const threadBody = this.el.querySelector("#chat-thread-body");
        const prevScrollHeight = threadBody?.scrollHeight ?? 0;
        const prevScrollTop = threadBody?.scrollTop ?? 0;
        const prevClientHeight = threadBody?.clientHeight ?? 0;
        // "Near bottom" = within ~80px of the bottom edge. Treat no prior
        // body (first open) as near-bottom so a fresh thread still opens
        // scrolled to the latest message.
        const wasNearBottom = threadBody
            ? (prevScrollHeight - prevScrollTop - prevClientHeight) < 80
            : true;
    
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
    
        if (this.view === "thread") {
            const newThreadBody = this.el.querySelector("#chat-thread-body");
            if (newThreadBody) {
                if (this._justLoadedOlder && threadBody) {
                    // Older messages were prepended — keep the same messages in
                    // view rather than jumping anywhere.
                    newThreadBody.scrollTop = newThreadBody.scrollHeight - prevScrollHeight + prevScrollTop;
                    this._justLoadedOlder = false;
                } else if (wasNearBottom) {
                    // User was following the conversation live — keep them at
                    // the bottom as new messages arrive.
                    newThreadBody.scrollTop = newThreadBody.scrollHeight;
                } else {
                    // User had scrolled up to read history — a new render (a
                    // live message, a poll, a status change) shouldn't yank
                    // them back down. Restore their exact position.
                    newThreadBody.scrollTop = prevScrollTop;
                }
            }
        }
    }
}
