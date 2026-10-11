// js/components/doctor/messaging/MessagingPage.js

import { Component } from "../../../core/component.js";
import { h } from "../../../utils/dom.js";
import api from "../../../services/api.js";
import { captureFocus, restoreFocus } from "../../../utils/focus.js";

const POLL_INTERVAL_MS = 60000; // safety-net fallback; live delivery is via socket

const STATUS_LABELS = {
    open: "Open",
    closed: "Closed",
    archived: "Archived",
};
const CONVERSATIONS_PAGE_LIMIT = 20;
const MESSAGES_PAGE_LIMIT = 30;
const icon = (paths, size = 18) =>
    h(
        "svg",
        { viewBox: "0 0 24 24", fill: "none", width: String(size), height: String(size), "aria-hidden": "true" },
        ...paths.map(d =>
            h("path", {
                d,
                stroke: "currentColor",
                "stroke-width": "1.8",
                "stroke-linecap": "round",
                "stroke-linejoin": "round"
            })
        )
    );

const MI = {
    search: ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "M21 21l-4.3-4.3"],
    chat: ["M5 5.5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8.5l-4.2 3.6v-3.6H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z"],
    back: ["M15 18l-6-6 6-6"],
    send: ["M22 2L11 13", "M22 2l-7 20-4-9-9-4 20-7z"],
    alert: ["M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z", "M12 9v4", "M12 17h.01"],
    lock: ["M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z", "M8 11V8a4 4 0 0 1 8 0v3"]
};

const STATUS_TONES = { open: "success", closed: "neutral", archived: "neutral" };

const getInitials = name => {
    const parts = (name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "P";
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

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
    
        clearTimeout(this._searchDebounceTimer);
        this._searchDebounceTimer = setTimeout(() => {
            this.loadConversations({ reset: true });
        }, 350);
    }
    renderSearchBox() {
        return h(
            "div",
            { class: "mp-search" },
            icon(MI.search, 18),
            h("input", {
                type: "text",
                class: "mp-search__input",
                "data-focus-key": "search",
                placeholder: "Search by patient name...",
                "aria-label": "Search conversations",
                value: this.searchTerm,
                oninput: e => this.setSearchTerm(e.target.value),
            })
        );
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
    formatDayLabel(dateString) {
        if (!dateString) return "";
        const date = new Date(dateString);
        const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const diff = Math.round((startOfDay(date) - startOfDay(new Date())) / 86400000);
        if (diff === 0) return "Today";
        if (diff === -1) return "Yesterday";
        return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    }
    
    formatListTime(dateString) {
        if (!dateString) return "";
        return this.formatDayLabel(dateString) === "Today"
            ? this.formatTime(dateString)
            : new Date(dateString).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }

    // ---------- Render ----------

    render() {
        return h(
            "div",
            { class: `dashboard-page queue-page doctor-messages ${this.view === "thread" ? "in-thread-view" : ""}` },
            this.view === "list" ? this.renderListHeader() : this.renderThreadHeader(),
            this.view === "list" ? this.renderListAlerts() : null,
            this.loading && this.view === "list"
                ? h("div", { class: "services-list" }, this.renderSearchBox(), this.renderListSkeleton())
                : this.view === "list"
                ? this.renderConversationList()
                : this.renderThread()
        );
    }
    
    renderListSkeleton() {
        return h(
            "div",
            { "aria-busy": "true", "aria-label": "Loading messages" },
            ...[0, 1, 2, 3].map(() =>
                h(
                    "div",
                    { class: "dashboard-card mp-conv" },
                    h("div", { class: "skeleton skeleton--circle" }),
                    h(
                        "div",
                        { class: "mp-conv__body" },
                        h("div", { class: "skeleton skeleton--line-sm" }),
                        h("div", { class: "skeleton skeleton--line-sm skeleton--short" })
                    )
                )
            )
        );
    }

    // ---------- List view ----------

    renderListHeader() {
        const unread = this.conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
    
        return h(
            "section",
            { class: "dashboard-header" },
            h("p", { class: "dashboard-greeting" }, "Doctor Messages"),
            h("h1", { class: "dashboard-title" }, "Messages"),
            h("p", { class: "dashboard-subtitle" }, "Secure conversations with your patients."),
            this.loading
                ? null
                : h(
                      "div",
                      { class: "dashboard-hero-meta" },
                      h("span", { class: "hero-chip" },
                          h("span", { class: "hero-chip__dot" }),
                          `${this.convTotalCount} conversation${this.convTotalCount === 1 ? "" : "s"}`),
                      unread > 0
                          ? h("span", { class: "hero-chip hero-chip--warning" },
                                h("span", { class: "hero-chip__dot" }), `${unread} unread`)
                          : null
                  )
        );
    }

    renderListAlerts() {
        if (!this.errorMessage) return null;
        return h(
            "div",
            { class: "mp-alert", role: "alert" },
            icon(MI.alert, 18),
            h("span", {}, this.errorMessage)
        );
    }

    renderConversationList() {
        return h(
            "div",
            { class: "services-list" },
            this.renderSearchBox(),
            this.conversations.length === 0
                ? h(
                      "div",
                      { class: "dashboard-card mp-empty" },
                      h("span", { class: "mp-empty__icon" }, icon(MI.chat, 22)),
                      h("p", { class: "mp-empty__title" }, this.searchTerm ? "No matches" : "No conversations yet"),
                      h(
                          "p",
                          { class: "mp-empty__text" },
                          this.searchTerm
                              ? `No conversations match "${this.searchTerm}".`
                              : "Conversations start once a patient's appointment is confirmed and paid."
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
            { class: "mp-more-wrap" },
            h(
                "button",
                {
                    type: "button",
                    class: "btn btn-outline mp-more",
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
        const tone = STATUS_TONES[conversation.status] || "neutral";
        const name = conversation.patient_name || "Unknown Patient";
    
        const previewText = conversation.last_message_deleted_at
            ? "This message was deleted"
            : conversation.last_message_type && conversation.last_message_type !== "text"
            ? `Sent a ${conversation.last_message_type}`
            : conversation.last_message_body || "No messages yet";
    
        return h(
            "div",
            {
                class: `dashboard-card service-item-card mp-conv${unread > 0 ? " mp-conv--unread" : ""}`,
                role: "button",
                tabindex: "0",
                onclick: () => this.openConversation(conversation),
                onkeydown: e => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        this.openConversation(conversation);
                    }
                },
            },
            h("div", { class: "mp-avatar" }, getInitials(name)),
            h(
                "div",
                { class: "mp-conv__body" },
                h("h3", { class: "mp-conv__name" }, name),
                h("p", { class: "mp-conv__preview" }, previewText)
            ),
            h(
                "div",
                { class: "mp-conv__meta" },
                h("span", { class: "mp-conv__time" },
                    this.formatListTime(conversation.last_message_created_at || conversation.created_at)),
                unread > 0
                    ? h("span", { class: "mp-unread" }, unread > 9 ? "9+" : String(unread))
                    : h("span", { class: `status-chip status-chip--${tone}` }, statusLabel)
            )
        );
    }

    // ---------- Thread view ----------

    renderThreadHeader() {
        const conversation = this.activeConversation || {};
        const statusLabel = STATUS_LABELS[conversation.status] || conversation.status;
        const tone = STATUS_TONES[conversation.status] || "neutral";
        const name = conversation.patient_name || "Conversation";
    
        return h(
            "section",
            { class: "dashboard-header chat-thread-header mp-thread-head" },
            h(
                "button",
                {
                    type: "button",
                    class: "mp-back",
                    "aria-label": "Back to messages",
                    onclick: () => this.closeThread(),
                },
                icon(MI.back, 20)
            ),
            h("div", { class: "mp-avatar mp-avatar--light" }, getInitials(name)),
            h(
                "div",
                { class: "mp-thread-head__text" },
                h("h1", { class: "dashboard-title" }, name),
                h(
                    "span",
                    { class: `hero-chip hero-chip--${tone === "success" ? "success" : "neutral"}` },
                    h("span", { class: "hero-chip__dot" }),
                    statusLabel
                )
            )
        );
    }

    renderThread() {
        return h(
            "div",
            { class: "dashboard-card chat-thread-card mp-thread" },
            this.renderThreadStatusBar(),
            this.messagesError
                ? h(
                      "div",
                      { class: "mp-thread__error", role: "alert" },
                      icon(MI.alert, 16),
                      h("span", {}, this.messagesError)
                  )
                : null,
            h(
                "div",
                { id: "chat-thread-body", class: "mp-thread__body" },
                this.messagesHasMore
                    ? h(
                          "div",
                          { class: "mp-more-wrap" },
                          h(
                              "button",
                              {
                                  type: "button",
                                  class: "btn btn-outline mp-more",
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
                    ? h(
                          "div",
                          { "aria-busy": "true", class: "mp-thread__loading" },
                          h("div", { class: "skeleton skeleton--line" }),
                          h("div", { class: "skeleton skeleton--line skeleton--short" })
                      )
                    : this.messages.length === 0
                    ? h(
                          "div",
                          { class: "mp-thread__empty" },
                          h("span", { class: "mp-empty__icon" }, icon(MI.chat, 22)),
                          h("p", { class: "mp-empty__title" }, "No messages yet"),
                          h("p", { class: "mp-empty__text" }, "Say hello to start the conversation.")
                      )
                    : this.renderMessageList()
            ),
            this.renderComposer()
        );
    }
    
    renderMessageList() {
        const out = [];
        let lastDay = null;
    
        this.messages.forEach(message => {
            const day = new Date(message.created_at).toDateString();
            if (day !== lastDay) {
                out.push(h("div", { class: "mp-day" }, h("span", {}, this.formatDayLabel(message.created_at))));
                lastDay = day;
            }
            out.push(this.renderMessageBubble(message));
        });
    
        return out;
    }
    
    renderThreadStatusBar() {
        const conversation = this.activeConversation || {};
        if (conversation.status === "open") return null;
    
        return h(
            "div",
            { class: "mp-status-bar" },
            h("span", { class: "mp-status-bar__icon" }, icon(MI.lock, 16)),
            h(
                "p",
                { class: "mp-status-bar__text" },
                conversation.status === "closed"
                    ? "This conversation is closed."
                    : "This conversation is archived."
            ),
            h(
                "button",
                {
                    type: "button",
                    class: "btn btn-outline mp-reopen",
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
            { class: `mp-msg ${isMine ? "mp-msg--mine" : "mp-msg--theirs"}` },
            h(
                "div",
                { class: `mp-bubble${isDeleted ? " mp-bubble--deleted" : ""}` },
                isDeleted ? "This message was deleted" : (message.body || "")
            ),
            h(
                "span",
                { class: "mp-time" },
                `${this.formatTime(message.created_at)}${message.is_edited ? " · edited" : ""}`
            )
        );
    }
    
    renderComposer() {
        const conversation = this.activeConversation || {};
        const isClosed = conversation.status === "closed";
    
        return h(
            "div",
            { class: "chat-composer mp-composer" },
            h("textarea", {
                rows: 1,
                class: "mp-composer__input",
                "aria-label": "Message",
                placeholder: isClosed ? "Reopen the conversation to send a message" : "Type a message...",
                value: this.messageDraft,
                disabled: isClosed || this.sending,
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
                    type: "button",
                    class: "mp-send",
                    "aria-label": "Send message",
                    disabled: isClosed || this.sending,
                    onclick: () => this.sendMessage(),
                },
                this.sending ? h("span", { class: "btn-spinner" }) : icon(MI.send, 18)
            )
        );
    }

    update() {
        if (!this.el) return;
        const focus = captureFocus(this.el);
    
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
        restoreFocus(this.el, focus); 
    }
}   
