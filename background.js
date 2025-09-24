let cachedTarget = null;
let cachedEnabled = [];
let currentListener = null;

function normalizeTargetUrl(input) {
    if (!input || typeof input !== "string") return null;
    const v = input.trim();
    if (v === "*/*" || v === "*://*/*") return "*://*/*";
    if (/^https?:\/\//i.test(v)) return v;
    if (v.startsWith("*://")) return v;
    if (v.startsWith("*")) return v.indexOf("://") === -1 ? `*://${v.replace(/^\*+/, "")}` : v;
    if (v.indexOf("://") === -1) {
        if (/^[^\/]+\.[^\/]+/.test(v)) {
            if (!v.startsWith("*.") && v.split("/")[0].indexOf(".") !== -1) {
                return "*://*." + v;
            }
            return "*://" + v;
        }
    }
    return v;
}

function signatureOfEnabled(rules) {
    const list = (rules || []).filter(r => r && r.enabled).map(r => `${r.paramName}=${r.paramValue}`).sort();
    return list.join("|");
}

function buildNewUrlIfNeeded(originalUrl, enabledRules) {
    try {
        if (!/^https?:\/\//i.test(originalUrl)) return {shouldRedirect: false};
        const url = new URL(originalUrl);
        let changed = false;
        const seen = new Set();
        for (const r of enabledRules) {
            if (!r || !r.paramName) continue;
            const key = String(r.paramName);
            seen.add(key);
            const current = url.searchParams.get(key);
            const desired = String(r.paramValue);
            if (current !== desired) {
                url.searchParams.set(key, desired);
                changed = true;
            }
        }
        if (!changed) return {shouldRedirect: false};
        const newUrl = url.toString();
        if (newUrl === originalUrl) return {shouldRedirect: false};
        return {shouldRedirect: true, newUrl};
    } catch (e) {
        return {shouldRedirect: false};
    }
}

function clearListener() {
    try {
        if (currentListener && browser.webRequest.onBeforeRequest.hasListener(currentListener)) {
            browser.webRequest.onBeforeRequest.removeListener(currentListener);
        }
    } catch (e) {
    } finally {
        currentListener = null;
    }
}

async function syncFromStorage() {
    try {
        const stored = await browser.storage.local.get(["targetUrl", "rules"]);
        const rawTarget = stored.targetUrl || "";
        const normalized = normalizeTargetUrl(rawTarget);
        const rules = Array.isArray(stored.rules) ? stored.rules.slice() : [];
        const enabledSig = signatureOfEnabled(rules);
        if (normalized === cachedTarget && enabledSig === cachedEnabled.join(",")) return;
        cachedTarget = normalized;
        cachedEnabled = (rules || []).filter(r => r && r.enabled).map(r => ({
            paramName: r.paramName,
            paramValue: r.paramValue
        }));
        clearListener();
        if (!normalized) return;
        currentListener = function (details) {
            const result = buildNewUrlIfNeeded(details.url, cachedEnabled);
            if (result.shouldRedirect) return {redirectUrl: result.newUrl};
            return {};
        };
        const filter = {urls: [normalized], types: ["main_frame", "sub_frame", "xmlhttprequest", "fetch"]};
        browser.webRequest.onBeforeRequest.addListener(currentListener, filter, ["blocking"]);
    } catch (e) {
    }
}

browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.targetUrl || changes.rules)) {
        syncFromStorage();
    }
});

syncFromStorage();

window.syncFromStorage = syncFromStorage;
