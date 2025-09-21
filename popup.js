async function refreshActiveRule() {
    const { rule, enabled } = await browser.storage.local.get(["rule", "enabled"]);
    const display = document.getElementById("activeRule");
    const urlInput = document.getElementById("urlPattern");
    const nameInput = document.getElementById("paramName");
    const valueInput = document.getElementById("paramValue");
    const enabledCheckbox = document.getElementById("enabled");

    if (rule) {
        display.textContent = `URL pattern: ${rule.urlPattern}\nParam: ${rule.paramName}=${rule.paramValue}\nEnabled: ${enabled !== false}`;
        urlInput.value = rule.urlPattern || "";
        nameInput.value = rule.paramName || "";
        valueInput.value = rule.paramValue || "";
    } else {
        display.textContent = "None";
        urlInput.value = "";
        nameInput.value = "";
        valueInput.value = "";
    }
    enabledCheckbox.checked = enabled !== false;
}

function normalizePattern(pattern) {
    if (!pattern.includes("://")) {
        return `*://*.${pattern.replace(/^\*+\.*|^\*+/, "")}`;
    }
    return pattern;
}

document.getElementById("save").addEventListener("click", async () => {
    const urlPatternRaw = document.getElementById("urlPattern").value.trim();
    const paramName = document.getElementById("paramName").value.trim();
    const paramValue = document.getElementById("paramValue").value.trim();
    const enabled = document.getElementById("enabled").checked;
    const status = document.getElementById("status");

    if (!urlPatternRaw || !paramName || !paramValue) {
        status.textContent = "Please fill in all fields.";
        return;
    }

    const urlPattern = normalizePattern(urlPatternRaw);

    try {
        await browser.storage.local.set({
            rule: { urlPattern, paramName, paramValue },
            enabled
        });

        const bg = await browser.runtime.getBackgroundPage();
        if (bg && typeof bg.updateListener === "function") {
            bg.updateListener();
        }
        status.textContent = "Rule saved!";
        await refreshActiveRule();
    } catch (e) {
        status.textContent = "Error: " + e.message;
    }
});

document.getElementById("clear").addEventListener("click", async () => {
    const status = document.getElementById("status");
    try {
        await browser.storage.local.remove(["rule", "enabled"]);
        const bg = await browser.runtime.getBackgroundPage();
        if (bg && typeof bg.clearListener === "function") {
            bg.clearListener();
        }
        status.textContent = "Rule cleared. Extension is disabled.";
        await refreshActiveRule();
    } catch (e) {
        status.textContent = "Error: " + e.message;
    }
});

document.getElementById("enabled").addEventListener("change", async (e) => {
    try {
        await browser.storage.local.set({ enabled: e.target.checked });
        const bg = await browser.runtime.getBackgroundPage();
        if (bg && typeof bg.updateListener === "function") {
            bg.updateListener();
        }
        await refreshActiveRule();
    } catch (e) {
        console.error("Failed to toggle:", e);
    }
});

refreshActiveRule();
