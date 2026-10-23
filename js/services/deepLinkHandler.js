import api from "./api.js";

const DEEPLINK_PREFIX = "yeroscare://payment-callback";
const PENDING_KEY = "pending_payment_reference";

const extractReference = (url) => {
    if (!url || !url.startsWith(DEEPLINK_PREFIX)) return null;
    const queryIndex = url.indexOf("?");
    if (queryIndex === -1) return null;
    const params = new URLSearchParams(url.slice(queryIndex + 1));
    return params.get("reference") || params.get("trxref") || null;
};

const stash = (reference) => {
    try {
        localStorage.setItem(PENDING_KEY, reference);
    } catch {
        // Storage disabled — nothing we can do, caller will handle
    }
};

const popStashed = () => {
    try {
        const v = localStorage.getItem(PENDING_KEY);
        if (v) localStorage.removeItem(PENDING_KEY);
        return v;
    } catch {
        return null;
    }
};

export const hasPendingPaymentReference = () => {
    try {
        return Boolean(localStorage.getItem(PENDING_KEY));
    } catch {
        return false;
    }
};

const tryVerify = async (reference) => {
    try {
        await api.get(`/payments/verify/${encodeURIComponent(reference)}`);
        return true;
    } catch {
        // Not logged in yet, or network error, or verify failed server-side.
        // Caller decides whether to retry.
        return false;
    }
};

const processIncomingUrl = async (url) => {
    const reference = extractReference(url);
    if (!reference) return;

    // Always stash first so the reference survives even if verify fails
    // (e.g. user is logged out after a cold restart).
    stash(reference);

    const ok = await tryVerify(reference);
    if (ok) popStashed();
};

export const initDeepLinkHandler = async () => {
    const App = window.Capacitor?.Plugins?.App;
    if (!App) return; // Web browser — nothing to do

    // Warm start: app already running, deeplink arrives via intent
    App.addListener("appUrlOpen", (event) => {
        if (event?.url) processIncomingUrl(event.url).catch(() => {});
    });

    try {
        const launch = await App.getLaunchUrl();
        if (launch?.url) await processIncomingUrl(launch.url);
    } catch {
        // getLaunchUrl can throw on older Capacitor versions — ignore
    }

    // Late retry: if the app is being bootstrapped with an existing session,
    // auth may not have rehydrated when getLaunchUrl processed above. Retry
    // once after the router has had a moment to restore auth state.
    setTimeout(() => {
        reconcilePendingPayment().catch(() => {});
    }, 1500);
};

export const reconcilePendingPayment = async () => {
    const pending = popStashed();
    if (!pending) return false;

    const ok = await tryVerify(pending);
    if (!ok) stash(pending); // put it back for the next opportunity
    return ok;
};
