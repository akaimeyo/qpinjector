function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function normalizeTargetUrl(input) {
    if (!input || typeof input !== "string") return null;
    let v = input.trim();
    if (v === "*/*" || v === "*://*/*") return "*://*/*";
    if (/^https?:\/\//i.test(v)) return v;
    if (/^\*\:\/\//.test(v)) return v;
    if (v.startsWith("*")) return v.indexOf("://") === -1 ? `*://${v.replace(/^\*+/, "")}` : v;
    if (v.indexOf("://") === -1) {
        if (/^[^\/]+\.[^\/]+/.test(v)) {
            if (!v.startsWith("*.") && v.split("/")[0].indexOf(".") !== -1) {
                v = "*://*." + v;
                return v;
            }
            return "*://" + v;
        }
    }
    return v;
}

async function loadState() {
    const stored = await browser.storage.local.get(["targetUrl", "rules"]);
    return {
        targetUrl: stored.targetUrl || "",
        rules: Array.isArray(stored.rules) ? stored.rules : []
    };
}

function renderNormalized(pattern) {
    const el = document.getElementById("normalized");
    if (!pattern) el.textContent = "Normalized: —";
    else el.textContent = `Normalized: ${pattern}`;
}

function makeRuleElement(rule) {
    const li = document.createElement("li");
    li.className = "rule";
    li.dataset.id = rule.id;

    const left = document.createElement("div");
    left.className = "rule-left";

    const toggleLabel = document.createElement("label");
    toggleLabel.className = "switch";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!rule.enabled;
    checkbox.addEventListener("change", async () => {
        await toggleRuleEnabled(rule.id, checkbox.checked);
    });
    const slider = document.createElement("span");
    slider.className = "slider";
    toggleLabel.appendChild(checkbox);
    toggleLabel.appendChild(slider);

    const text = document.createElement("div");
    text.className = "rule-text";
    text.textContent = `${rule.paramName} = ${rule.paramValue}`;

    left.appendChild(toggleLabel);
    left.appendChild(text);

    const actions = document.createElement("div");
    actions.className = "rule-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "edit";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openEditForm(rule));

    const delBtn = document.createElement("button");
    delBtn.className = "delete";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => removeRule(rule.id));

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    li.appendChild(left);
    li.appendChild(actions);

    return li;
}

async function refreshUI() {
    const s = await loadState();
    document.getElementById("targetInput").value = s.targetUrl || "";
    renderNormalized(s.targetUrl ? normalizeTargetUrl(s.targetUrl) : null);

    const list = document.getElementById("rulesList");
    list.innerHTML = "";
    s.rules.forEach(r => {
        list.appendChild(makeRuleElement(r));
    });
}

async function saveTarget() {
    const raw = document.getElementById("targetInput").value.trim();
    const norm = normalizeTargetUrl(raw);
    if (!norm) {
        return;
    }
    await browser.storage.local.set({targetUrl: norm});
    await notifyBackground();
    renderNormalized(norm);
}

async function notifyBackground() {
    const bg = await browser.runtime.getBackgroundPage();
    if (bg && typeof bg.syncFromStorage === "function") bg.syncFromStorage();
}

async function addOrUpdateRule(existingId) {
    const name = document.getElementById("paramName").value.trim();
    const value = document.getElementById("paramValue").value.trim();
    const enabled = document.getElementById("paramEnabled").checked;
    const status = document.getElementById("formStatus");
    status.textContent = "";
    if (!name) {
        status.textContent = "Name required";
        return;
    }
    const stored = await browser.storage.local.get("rules");
    const rules = Array.isArray(stored.rules) ? stored.rules.slice() : [];
    if (existingId) {
        const idx = rules.findIndex(r => r.id === existingId);
        if (idx !== -1) rules[idx] = {id: existingId, paramName: name, paramValue: value, enabled};
    } else {
        rules.push({id: uid(), paramName: name, paramValue: value, enabled});
    }
    await browser.storage.local.set({rules});
    await notifyBackground();
    closeForm();
    await refreshUI();
}

function openAddForm() {
    document.getElementById("addForm").classList.add("show");
    document.getElementById("formTitle").textContent = "Add parameter";
    document.getElementById("paramName").value = "";
    document.getElementById("paramValue").value = "";
    document.getElementById("paramEnabled").checked = true;
    document.getElementById("saveParam").dataset.edit = "";
    document.getElementById("formStatus").textContent = "";
}

function openEditForm(rule) {
    document.getElementById("addForm").classList.add("show");
    document.getElementById("formTitle").textContent = "Edit parameter";
    document.getElementById("paramName").value = rule.paramName;
    document.getElementById("paramValue").value = rule.paramValue;
    document.getElementById("paramEnabled").checked = !!rule.enabled;
    document.getElementById("saveParam").dataset.edit = rule.id;
    document.getElementById("formStatus").textContent = "";
}

function closeForm() {
    document.getElementById("addForm").classList.remove("show");
}

async function removeRule(id) {
    const stored = await browser.storage.local.get("rules");
    const rules = Array.isArray(stored.rules) ? stored.rules.filter(r => r.id !== id) : [];
    await browser.storage.local.set({rules});
    await notifyBackground();
    await refreshUI();
}

async function toggleRuleEnabled(id, enabled) {
    const stored = await browser.storage.local.get("rules");
    const rules = Array.isArray(stored.rules) ? stored.rules.slice() : [];
    const idx = rules.findIndex(r => r.id === id);
    if (idx !== -1) {
        rules[idx].enabled = !!enabled;
        await browser.storage.local.set({rules});
        await notifyBackground();
        await refreshUI();
    }
}

document.getElementById("saveTarget").addEventListener("click", saveTarget);
document.getElementById("addBtn").addEventListener("click", openAddForm);
document.getElementById("cancelEdit").addEventListener("click", () => {
    closeForm();
});
document.getElementById("saveParam").addEventListener("click", async (e) => {
    const editId = e.target.dataset.edit;
    await addOrUpdateRule(editId || null);
});
window.addEventListener("DOMContentLoaded", async () => {
    await refreshUI();
    browser.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && (changes.rules || changes.targetUrl)) refreshUI();
    });
});
