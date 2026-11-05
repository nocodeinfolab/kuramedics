import api from "./api.js";

const DEEPLINK_PREFIX = "yeroscare://payment-callback";
const PENDING_KEY = "pending_payment_reference";

const DOCTOR_BOOKING_RE = /^yeroscare:\/\/doctor\/([^/?#]+)\/book(?:\?(.*))?$/;

function parseQueryString(qs) {
    if (!qs) return {};
    const out = {};
    qs.split("&").forEach(pair => {
        if (!pair) return;
        const eq = pair.indexOf("=");
        const k = eq >= 0 ? pair.slice(0, eq) : pair;
        const v = eq >= 0 ? pair.slice(eq + 1) : "";
        if (!k) return;
        try {
            out[decodeURIComponent(k)] = decodeURIComponent(v);
        } catch {
            out[k] = v;
        }
    });
    return out;
}

function processDoctorBookingDeepLink(url) {
    const match = DOCTOR_BOOKING_RE.exec(url);
    if (!match) return false;

    const [, doctorId, queryString] = match;
    if (!doctorId) return false;

    const params = parseQueryString(queryString);
    const serviceId = params.service || null;

    try {
        localStorage.setItem("pendingBookingDoctorId", decodeURIComponent(doctorId));
        localStorage.setItem("pendingBookingIntent", "book");
        if (serviceId) {
            localStorage.setItem("pendingBookingServiceId", serviceId);
        } else {
            localStorage.removeItem("pendingBookingServiceId");
        }
    } catch {
        // Storage unavailable — bail silently; deep link can't be honored
        return false;
    }

    const isLoggedIn = !!localStorage.getItem("accessToken");
    window.location.hash = isLoggedIn ? "/patient/dashboard" : "/patient/login";
    return true;
}

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
        
        return false;
    }
};

const processIncomingUrl = async (url) => {
    const reference = extractReference(url);
    if (!reference) return;
    stash(reference);

    const ok = await tryVerify(reference);
    if (ok) popStashed();
};

export const initDeepLinkHandler = async () => {
    const App = window.Capacitor?.Plugins?.App;
    if (!App) return; // Web browser — nothing to do

    // Warm start: app already running, deeplink arrives via intent
    App.addListener("appUrlOpen", (event) => {
        if (!event?.url) return;
    
        if (processDoctorBookingDeepLink(event.url)) return;
    
        processIncomingUrl(event.url).catch(() => {});
    });

    try {
        const launch = await App.getLaunchUrl();
        if (launch?.url) {
            if (!processDoctorBookingDeepLink(launch.url)) {
                await processIncomingUrl(launch.url);
            }
        }
    } catch {
        // getLaunchUrl can throw on older Capacitor versions — ignore
    }
    setTimeout(() => {
        reconcilePendingPayment().catch(() => {});
    }, 1500);
};

export const reconcilePendingPayment = async () => {
    const pending = popStashed();
    if (!pending) return false;

    const ok = await tryVerify(pending);
    if (!ok) stash(pending);
    return ok;
};
