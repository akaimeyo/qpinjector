let currentListener = null;

function injectParamFactory(paramName, paramValue) {
    return function(details) {
        try {
            const urlStr = details.url;
            if (!urlStr.startsWith("http://") && !urlStr.startsWith("https://")) {
                return {};
            }
            const url = new URL(urlStr);

            const existing = url.searchParams.get(paramName);
            if (existing === paramValue) {
                return {};
            }

            url.searchParams.set(paramName, paramValue);
            const newUrl = url.toString();

            if (newUrl === urlStr) {
                return {};
            }

            console.debug("Redirect:", urlStr, "->", newUrl);
            return { redirectUrl: newUrl };
        } catch (e) {
            console.error("Failed to modify URL:", details.url, e);
            return {};
        }
    };
}

async function updateListener() {
    try {
        const { rule, enabled } = await browser.storage.local.get(["rule", "enabled"]);
        if (!rule || enabled === false) {
            clearListener();
            return;
        }

        const { urlPattern, paramName, paramValue } = rule;
        if (!urlPattern || urlPattern.indexOf("://") === -1) {
            console.warn("Invalid urlPattern:", urlPattern);
            clearListener();
            return;
        }

        clearListener();
        currentListener = injectParamFactory(paramName, paramValue);

        const filter = {
            urls: [urlPattern],
            types: ["main_frame", "sub_frame", "xmlhttprequest", "fetch"]
        };

        browser.webRequest.onBeforeRequest.addListener(
            currentListener,
            filter,
            ["blocking"]
        );

        console.log("Listener active for:", urlPattern, "Enabled:", enabled !== false);
    } catch (e) {
        console.error("updateListener failed:", e);
    }
}

function clearListener() {
    try {
        if (currentListener && browser.webRequest.onBeforeRequest.hasListener(currentListener)) {
            browser.webRequest.onBeforeRequest.removeListener(currentListener);
            console.log("Listener removed");
        }
    } catch (e) {
        console.error("clearListener error:", e);
    } finally {
        currentListener = null;
    }
}

browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.rule || changes.enabled)) {
        updateListener();
    }
});

updateListener();

window.updateListener = updateListener;
window.clearListener = clearListener;
