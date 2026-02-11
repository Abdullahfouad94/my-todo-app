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

function categoryBadge(cat) {
    const cls = { Agent: "badge-agent", Content: "badge-content", Product: "badge-product", Research: "badge-research" };
    return cat ? `<span class="badge ${cls[cat] || ''}">${escHtml(cat)}</span>` : "";
}

function timeAgo(iso) {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

// --- State ---
let allPrompts = [];
let deleteTargetId = null;

// --- Load ---
async function loadPrompts() {
    try {
        const res = await fetch("/api/prompts", { headers: authHeaders() });
        if (res.status === 401) { window.location.href = "/login.html"; return; }
        allPrompts = await res.json();
        renderPrompts();

        const payload = JSON.parse(atob(token.split(".")[1]));
        document.getElementById("user-display").textContent = payload.username || payload.email || "";
    } catch (e) {
        showToast("Failed to load prompts", "error");
    }
}

// --- Render ---
function renderPrompts() {
    const grid = document.getElementById("prompts-grid");
    const empty = document.getElementById("empty-state");
    const query = document.getElementById("search-input").value.trim().toLowerCase();
    const cat = document.getElementById("category-filter").value;

    let filtered = allPrompts;
    if (query) {
        filtered = filtered.filter(p =>
            p.title.toLowerCase().includes(query) ||
            (p.tags && p.tags.toLowerCase().includes(query)) ||
            (p.category && p.category.toLowerCase().includes(query))
        );
    }
    if (cat) {
        filtered = filtered.filter(p => p.category === cat);
    }

    if (filtered.length === 0) {
        grid.innerHTML = "";
        empty.classList.remove("hidden");
        return;
    }
    empty.classList.add("hidden");

    grid.innerHTML = filtered.map(p => {
        const sectionCount = p.sections ? Object.values(p.sections).filter(v => v && v.trim()).length : 0;
        const tagsHtml = p.tags ? p.tags.split(",").map(t => t.trim()).filter(Boolean)
            .map(t => `<span class="badge" style="background:var(--toolbar-bg);color:var(--text-secondary)">${escHtml(t)}</span>`).join(" ") : "";
        const excerpt = getExcerpt(p.sections);
        return `
            <div class="card" data-id="${p.id}">
                <div class="card-header">
                    <span class="card-title">${escHtml(p.title)}</span>
                    ${categoryBadge(p.category)}
                </div>
                ${excerpt ? `<p class="card-desc">${escHtml(excerpt)}</p>` : ""}
                ${tagsHtml ? `<div style="display:flex;gap:4px;flex-wrap:wrap">${tagsHtml}</div>` : ""}
                <div style="font-size:12px;color:var(--muted)">${sectionCount} section${sectionCount !== 1 ? "s" : ""} · Updated ${timeAgo(p.updatedAt)}</div>
                <div class="card-footer">
                    <div class="card-actions">
                        <button class="btn btn-secondary btn-sm" onclick="editPrompt('${p.id}')">Edit</button>
                        <button class="btn btn-secondary btn-sm" onclick="duplicatePrompt('${p.id}')">Duplicate</button>
                        <button class="btn btn-danger btn-sm" onclick="confirmDelete('${p.id}', '${escHtml(p.title).replace(/'/g, "\\'")}')">Delete</button>
                    </div>
                </div>
            </div>
        `;
    }).join("");
}

function getExcerpt(sections) {
    if (!sections) return "";
    const text = sections.role || sections.task || sections.context || "";
    if (!text) return "";
    return text.length > 100 ? text.slice(0, 100) + "…" : text;
}

function editPrompt(id) {
    window.location.href = `/editor.html?id=${encodeURIComponent(id)}`;
}

async function duplicatePrompt(id) {
    const prompt = allPrompts.find(p => p.id === id);
    if (!prompt) return;
    try {
        const res = await fetch("/api/prompts", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
                title: prompt.title + " (copy)",
                category: prompt.category,
                sections: prompt.sections,
                tags: prompt.tags,
                variableDefinitions: prompt.variableDefinitions,
            }),
        });
        if (!res.ok) throw new Error();
        const newPrompt = await res.json();
        allPrompts.unshift(newPrompt);
        renderPrompts();
        showToast("Prompt duplicated", "success");
    } catch (e) {
        showToast("Failed to duplicate", "error");
    }
}

function confirmDelete(id, title) {
    deleteTargetId = id;
    document.getElementById("delete-prompt-title").textContent = title;
    document.getElementById("delete-modal").classList.add("open");
}

document.getElementById("cancel-delete").addEventListener("click", () => {
    document.getElementById("delete-modal").classList.remove("open");
    deleteTargetId = null;
});

document.getElementById("confirm-delete").addEventListener("click", async () => {
    if (!deleteTargetId) return;
    document.getElementById("delete-modal").classList.remove("open");
    try {
        const res = await fetch(`/api/prompts/${deleteTargetId}`, {
            method: "DELETE",
            headers: authHeaders(),
        });
        if (!res.ok) throw new Error();
        allPrompts = allPrompts.filter(p => p.id !== deleteTargetId);
        deleteTargetId = null;
        renderPrompts();
        showToast("Prompt deleted");
    } catch (e) {
        showToast("Failed to delete", "error");
    }
});

// --- Search / filter ---
document.getElementById("search-input").addEventListener("input", renderPrompts);
document.getElementById("category-filter").addEventListener("change", renderPrompts);

loadPrompts();
