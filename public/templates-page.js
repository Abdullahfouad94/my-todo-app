
// --- Dark mode ---
if (localStorage.getItem("darkMode") === "true") document.body.classList.add("dark");

// --- Nav setup ---
document.getElementById("dark-mode-toggle").addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark");
    localStorage.setItem("darkMode", isDark);
});


// --- Toast ---
function showToast(msg, type = "") {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.className = "toast show" + (type ? " " + type : "");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.className = "toast"; }, 3000);
}

// --- Category badge helper ---
function categoryBadge(cat) {
    const cls = { Agent: "badge-agent", Content: "badge-content", Product: "badge-product", Research: "badge-research" };
    return `<span class="badge ${cls[cat] || ''}">${cat || "General"}</span>`;
}

// --- State ---
let allTemplates = [];
let activeCategory = "";

// --- Fetch templates ---
async function loadTemplates() {
    try {
        const res = await fetch("/api/templates", { headers: { "Content-Type": "application/json" } });
        allTemplates = await res.json();
        renderTemplates();

        // Set username
    } catch (e) {
        showToast("Failed to load templates", "error");
    }
}

// --- Render ---
function renderTemplates() {
    const grid = document.getElementById("templates-grid");
    const empty = document.getElementById("empty-state");

    const filtered = activeCategory
        ? allTemplates.filter(t => t.category === activeCategory)
        : allTemplates;

    if (filtered.length === 0) {
        grid.innerHTML = "";
        empty.classList.remove("hidden");
        return;
    }
    empty.classList.add("hidden");

    grid.innerHTML = filtered.map(t => `
        <div class="card">
            <div class="card-header">
                <span class="card-title">${escHtml(t.title)}</span>
                ${categoryBadge(t.category)}
            </div>
            <p class="card-desc">${escHtml(t.description)}</p>
            ${t.variableDefinitions.length ? `
                <div style="font-size:12px;color:var(--text-secondary)">
                    Variables: ${t.variableDefinitions.map(v => `<code>{{${escHtml(v.name)}}}</code>`).join(", ")}
                </div>` : ""}
            <div class="card-footer">
                <span style="font-size:12px;color:var(--muted)">${t.sections ? Object.values(t.sections).filter(Boolean).length : 0} sections</span>
                <button class="btn btn-primary btn-sm" onclick="useTemplate('${t.id}')">Use Template</button>
            </div>
        </div>
    `).join("");
}

function useTemplate(id) {
    window.location.href = `/editor.html?template=${encodeURIComponent(id)}`;
}

function escHtml(str) {
    return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// --- Category tabs ---
document.getElementById("category-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".category-tab");
    if (!btn) return;
    document.querySelectorAll(".category-tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeCategory = btn.dataset.category;
    renderTemplates();
});

loadTemplates();
