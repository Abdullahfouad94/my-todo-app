// --- Auth guard ---
const token = localStorage.getItem("token");
if (!token) { window.location.href = "/login.html"; }

// --- Dark mode ---
if (localStorage.getItem("darkMode") === "true") document.body.classList.add("dark");

// --- Nav setup ---
document.getElementById("dark-mode-toggle").addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark");
    localStorage.setItem("darkMode", isDark);
});
document.getElementById("logout-btn").addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "/login.html";
});

function authHeaders() {
    return { "Content-Type": "application/json", Authorization: "Bearer " + token };
}

function showToast(msg, type = "") {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.className = "toast show" + (type ? " " + type : "");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.className = "toast"; }, 3000);
}

function escHtml(str) {
    return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// --- Parse URL params ---
const params = new URLSearchParams(window.location.search);
const editId = params.get("id");
const templateId = params.get("template");

let variables = []; // { name, description, defaultValue }
let variableFillValues = {}; // { name: filledValue }
let isSaving = false;

// --- Set username ---
try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    document.getElementById("user-display").textContent = payload.username || payload.email || "";
} catch (e) {}

// --- Load initial data ---
async function init() {
    if (editId) {
        document.getElementById("editor-page-title").textContent = "Edit Prompt";
        try {
            const res = await fetch(`/api/prompts/${editId}`, { headers: authHeaders() });
            if (res.status === 401) { window.location.href = "/login.html"; return; }
            if (!res.ok) { showToast("Prompt not found", "error"); return; }
            const prompt = await res.json();
            populateForm(prompt);
        } catch (e) {
            showToast("Failed to load prompt", "error");
        }
    } else if (templateId) {
        document.getElementById("editor-page-title").textContent = "New Prompt from Template";
        try {
            const res = await fetch(`/api/templates/${templateId}`, { headers: authHeaders() });
            if (!res.ok) { showToast("Template not found", "error"); return; }
            const tpl = await res.json();
            populateForm({ ...tpl, title: tpl.title + " (copy)" });
        } catch (e) {
            showToast("Failed to load template", "error");
        }
    }
    updatePreview();
}

function populateForm(data) {
    if (data.title) document.getElementById("title").value = data.title;
    if (data.category) document.getElementById("category").value = data.category;
    if (data.tags) document.getElementById("tags").value = data.tags;
    const s = data.sections || {};
    if (s.role) document.getElementById("sec-role").value = s.role;
    if (s.context) document.getElementById("sec-context").value = s.context;
    if (s.task) document.getElementById("sec-task").value = s.task;
    if (s.constraints) document.getElementById("sec-constraints").value = s.constraints;
    if (s.outputFormat) document.getElementById("sec-output").value = s.outputFormat;
    variables = (data.variableDefinitions || []).map(v => ({ ...v }));
    variableFillValues = {};
    variables.forEach(v => { variableFillValues[v.name] = v.defaultValue || ""; });
    renderVariableList();
    updatePreview();
}

// --- Variable management ---
document.getElementById("add-var-btn").addEventListener("click", () => {
    variables.push({ name: "", description: "", defaultValue: "" });
    renderVariableList();
    updatePreview();
});

function renderVariableList() {
    const list = document.getElementById("variable-list");
    if (variables.length === 0) {
        list.innerHTML = `<p style="font-size:13px;color:var(--muted)">No variables defined. Click "+ Add Variable" to define one.</p>`;
        return;
    }
    list.innerHTML = variables.map((v, i) => `
        <div class="variable-item" data-index="${i}">
            <input type="text" class="var-name" placeholder="name" value="${escHtml(v.name)}"
                oninput="updateVar(${i},'name',this.value)" style="font-family:monospace">
            <input type="text" class="var-desc" placeholder="description (optional)" value="${escHtml(v.description)}"
                oninput="updateVar(${i},'description',this.value)">
            <button class="remove-var-btn" onclick="removeVar(${i})" title="Remove">&#x2715;</button>
        </div>
    `).join("");
}

function updateVar(index, field, value) {
    if (!variables[index]) return;
    const oldName = variables[index].name;
    variables[index][field] = value;
    if (field === "name") {
        // Migrate fill values
        const fillVal = variableFillValues[oldName] || "";
        delete variableFillValues[oldName];
        variableFillValues[value] = fillVal;
    }
    updatePreview();
}

function removeVar(index) {
    const name = variables[index] && variables[index].name;
    variables.splice(index, 1);
    if (name) delete variableFillValues[name];
    renderVariableList();
    updatePreview();
}

// --- Collect sections from form ---
function getSections() {
    return {
        role: document.getElementById("sec-role").value.trim(),
        context: document.getElementById("sec-context").value.trim(),
        task: document.getElementById("sec-task").value.trim(),
        constraints: document.getElementById("sec-constraints").value.trim(),
        outputFormat: document.getElementById("sec-output").value.trim(),
    };
}

// --- Assemble prompt text ---
function assemblePrompt(sections, fillValues) {
    const parts = [];
    const labels = {
        role: "ROLE",
        context: "CONTEXT",
        task: "TASK",
        constraints: "CONSTRAINTS",
        outputFormat: "OUTPUT FORMAT",
    };
    for (const [key, label] of Object.entries(labels)) {
        const text = sections[key];
        if (text) {
            parts.push(`[${label}]\n${text}`);
        }
    }
    let assembled = parts.join("\n\n");

    // Substitute variables
    for (const [name, value] of Object.entries(fillValues)) {
        if (!name) continue;
        const filled = value || `[FILL: ${name}]`;
        assembled = assembled.split(`{{${name}}}`).join(filled);
    }
    return assembled;
}

// --- Quality hints ---
function computeHints(sections) {
    const hints = [];
    if (!sections.role) hints.push({ type: "warn", text: "Add a Role to define who or what this agent is." });
    if (!sections.task) hints.push({ type: "warn", text: "Add a Task section — this is the most important part." });
    if (!sections.context && !sections.constraints) hints.push({ type: "warn", text: "Consider adding Context or Constraints for better results." });
    if (!sections.outputFormat) hints.push({ type: "warn", text: "Add an Output Format to improve response consistency." });

    // Check for variables used but not defined
    const allText = Object.values(sections).join(" ");
    const usedVars = [...allText.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);
    const definedVarNames = variables.map(v => v.name).filter(Boolean);
    const undefined_ = usedVars.filter(v => !definedVarNames.includes(v));
    if (undefined_.length > 0) {
        hints.push({ type: "warn", text: `Variable${undefined_.length > 1 ? "s" : ""} used but not defined: ${[...new Set(undefined_)].map(v => `{{${v}}}`).join(", ")}` });
    }

    if (hints.length === 0) hints.push({ type: "ok", text: "Prompt looks good! All key sections are filled." });
    return hints;
}

// --- Update preview ---
function updatePreview() {
    const sections = getSections();

    // Render variable fill inputs
    const validVars = variables.filter(v => v.name.trim());
    const varFillSection = document.getElementById("var-fill-section");
    const varFillInputs = document.getElementById("var-fill-inputs");
    if (validVars.length > 0) {
        varFillSection.classList.remove("hidden");
        varFillInputs.innerHTML = validVars.map(v => `
            <div class="var-fill-item">
                <label>{{${escHtml(v.name)}}}</label>
                <input type="text" placeholder="${escHtml(v.description || v.name)}"
                    value="${escHtml(variableFillValues[v.name] || "")}"
                    oninput="fillVar('${escHtml(v.name)}', this.value)">
            </div>
        `).join("");
    } else {
        varFillSection.classList.add("hidden");
    }

    // Quality hints
    const hints = computeHints(sections);
    document.getElementById("hints-list").innerHTML = hints.map(h => `
        <div class="hint hint-${h.type}">${h.type === "warn" ? "⚠ " : "✓ "}${escHtml(h.text)}</div>
    `).join("");

    // Assemble and render prompt
    const assembled = assemblePrompt(sections, variableFillValues);
    const preview = document.getElementById("preview-output");
    if (!assembled.trim()) {
        preview.innerHTML = `<span class="preview-placeholder">Your prompt will appear here as you fill in the sections...</span>`;
        document.getElementById("token-count").textContent = "";
    } else {
        preview.textContent = assembled;
        const charCount = assembled.length;
        const estTokens = Math.ceil(charCount / 4);
        document.getElementById("token-count").textContent = `~${charCount} chars · ~${estTokens} tokens`;
    }
}

function fillVar(name, value) {
    variableFillValues[name] = value;
    updatePreview();
}

// --- Copy button ---
document.getElementById("copy-btn").addEventListener("click", () => {
    const sections = getSections();
    const assembled = assemblePrompt(sections, variableFillValues);
    if (!assembled.trim()) { showToast("Nothing to copy yet"); return; }
    navigator.clipboard.writeText(assembled).then(() => {
        showToast("Copied to clipboard!", "success");
    }).catch(() => {
        showToast("Copy failed — please select and copy manually");
    });
});

// --- Save ---
document.getElementById("save-btn").addEventListener("click", savePrompt);

async function savePrompt() {
    if (isSaving) return;
    const title = document.getElementById("title").value.trim();
    if (!title) {
        showToast("Please enter a title", "error");
        document.getElementById("title").focus();
        return;
    }

    const payload = {
        title,
        category: document.getElementById("category").value,
        tags: document.getElementById("tags").value.trim(),
        sections: getSections(),
        variableDefinitions: variables.filter(v => v.name.trim()).map(v => ({
            name: v.name.trim(),
            description: v.description || "",
            defaultValue: variableFillValues[v.name] || "",
        })),
    };

    isSaving = true;
    const btn = document.getElementById("save-btn");
    btn.disabled = true;
    btn.textContent = "Saving…";

    try {
        let res;
        if (editId) {
            res = await fetch(`/api/prompts/${editId}`, {
                method: "PUT",
                headers: authHeaders(),
                body: JSON.stringify(payload),
            });
        } else {
            res = await fetch("/api/prompts", {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify(payload),
            });
        }

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Save failed");
        }

        showToast(editId ? "Prompt updated!" : "Prompt saved!", "success");
        setTimeout(() => { window.location.href = "/prompts.html"; }, 800);
    } catch (e) {
        showToast(e.message || "Save failed", "error");
        btn.disabled = false;
        btn.textContent = "Save Prompt";
        isSaving = false;
    }
}

// --- Live update on any section change ---
["sec-role", "sec-context", "sec-task", "sec-constraints", "sec-output"].forEach(id => {
    document.getElementById(id).addEventListener("input", updatePreview);
});

init();
