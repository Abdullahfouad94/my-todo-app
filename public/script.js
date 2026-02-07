// --- Auth Gate ---
const token = localStorage.getItem("token");
if (!token) {
    window.location.href = "/login.html";
}

// --- Auth Fetch Helper ---
async function authFetch(url, options = {}) {
    const currentToken = localStorage.getItem("token");
    if (!currentToken) {
        window.location.href = "/login.html";
        return;
    }
    const headers = {
        ...options.headers,
        Authorization: `Bearer ${currentToken}`,
    };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "/login.html";
        return;
    }
    return res;
}

// --- DOM Elements ---
const form = document.getElementById("todo-form");
const input = document.getElementById("todo-input");
const todoList = document.getElementById("todo-list");
const emptyMessage = document.getElementById("empty-message");
const inputPriority = document.getElementById("input-priority");
const inputCategory = document.getElementById("input-category");
const inputDueDate = document.getElementById("input-due-date");
const filterSearch = document.getElementById("filter-search");
const filterPriority = document.getElementById("filter-priority");
const filterCategory = document.getElementById("filter-category");
const filterStatus = document.getElementById("filter-status");
const countTotal = document.getElementById("count-total");
const countDone = document.getElementById("count-done");
const countRemaining = document.getElementById("count-remaining");
const statToday = document.getElementById("stat-today");
const statWeek = document.getElementById("stat-week");
const darkModeToggle = document.getElementById("dark-mode-toggle");
const clearCompletedBtn = document.getElementById("clear-completed-btn");
const logoutBtn = document.getElementById("logout-btn");
const userDisplay = document.getElementById("user-display");

let tasks = [];
let draggedId = null;

// --- Dark Mode ---
function initDarkMode() {
    if (localStorage.getItem("darkMode") === "true") {
        document.body.classList.add("dark");
    }
}

darkModeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    localStorage.setItem("darkMode", document.body.classList.contains("dark"));
});

// --- Logout ---
logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "/login.html";
});

// --- Load current user ---
async function loadUser() {
    const res = await authFetch("/api/auth/me");
    if (res) {
        const user = await res.json();
        userDisplay.textContent = user.username;
    }
}

// --- Helpers ---
function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

function isOverdue(dueDate) {
    if (!dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(dueDate + "T00:00:00") < today;
}

function formatDate(isoString) {
    if (!isoString) return "";
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatTimestamp(isoString) {
    if (!isoString) return "";
    const d = new Date(isoString);
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// --- Update counters ---
function updateCounters() {
    const total = tasks.length;
    const done = tasks.filter(t => t.completed).length;
    countTotal.textContent = total;
    countDone.textContent = done;
    countRemaining.textContent = total - done;
}

// --- Update stats ---
async function updateStats() {
    const res = await authFetch("/api/tasks/stats");
    if (res) {
        const stats = await res.json();
        statToday.textContent = stats.completedToday;
        statWeek.textContent = stats.completedThisWeek;
    }
}

// --- Populate category filter dropdown ---
function updateCategoryFilter() {
    const categories = [...new Set(tasks.map(t => t.category).filter(Boolean))];
    const currentVal = filterCategory.value;
    filterCategory.innerHTML = '<option value="">All Categories</option>';
    categories.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        filterCategory.appendChild(opt);
    });
    filterCategory.value = currentVal;
}

// --- Filter tasks ---
function getFilteredTasks() {
    const search = filterSearch.value.toLowerCase().trim();
    const priority = filterPriority.value;
    const category = filterCategory.value;
    const status = filterStatus.value;

    return tasks.filter(task => {
        if (search && !task.text.toLowerCase().includes(search) && !task.notes.toLowerCase().includes(search)) return false;
        if (priority && task.priority !== priority) return false;
        if (category && task.category !== category) return false;
        if (status === "active" && task.completed) return false;
        if (status === "completed" && !task.completed) return false;
        return true;
    });
}

// --- Render ---
function renderTasks() {
    todoList.innerHTML = "";
    const filtered = getFilteredTasks();

    filtered.forEach((task) => {
        const li = document.createElement("li");
        li.dataset.id = task.id;
        if (task.completed) li.classList.add("completed");
        li.classList.add(`priority-${task.priority || "medium"}`);

        // Drag attributes
        li.draggable = true;

        // Main row
        const mainDiv = document.createElement("div");
        mainDiv.className = "task-main";

        // Drag handle
        const handle = document.createElement("span");
        handle.className = "drag-handle";
        handle.textContent = "\u2630";

        // Complete button
        const completeBtn = document.createElement("button");
        completeBtn.className = "complete-btn";
        completeBtn.title = "Toggle complete";
        completeBtn.innerHTML = task.completed ? "&#9745;" : "&#9744;";

        // Task text
        const taskText = document.createElement("span");
        taskText.className = "task-text";
        taskText.textContent = task.text;

        // Double-click to edit
        taskText.addEventListener("dblclick", () => startEditText(li, task));

        // Category badge
        let categoryBadge = null;
        if (task.category) {
            categoryBadge = document.createElement("span");
            categoryBadge.className = "category-badge";
            categoryBadge.textContent = task.category;
        }

        // Due date
        let dueDateSpan = null;
        if (task.dueDate) {
            dueDateSpan = document.createElement("span");
            dueDateSpan.className = "due-date";
            if (isOverdue(task.dueDate) && !task.completed) {
                dueDateSpan.classList.add("overdue");
            }
            dueDateSpan.textContent = formatDate(task.dueDate);
        }

        // Notes toggle
        const notesBtn = document.createElement("button");
        notesBtn.className = "notes-toggle";
        notesBtn.textContent = "Notes";

        // Delete button
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "delete-btn";
        deleteBtn.title = "Delete task";
        deleteBtn.innerHTML = "&#128465;";

        mainDiv.appendChild(handle);
        mainDiv.appendChild(completeBtn);
        mainDiv.appendChild(taskText);
        if (categoryBadge) mainDiv.appendChild(categoryBadge);
        if (dueDateSpan) mainDiv.appendChild(dueDateSpan);
        mainDiv.appendChild(notesBtn);
        mainDiv.appendChild(deleteBtn);

        // Details section (notes + timestamp)
        const details = document.createElement("div");
        details.className = "task-details";

        const textarea = document.createElement("textarea");
        textarea.className = "notes-textarea";
        textarea.placeholder = "Add notes...";
        textarea.value = task.notes || "";

        const timestamp = document.createElement("div");
        timestamp.className = "task-timestamp";
        let tsText = "Created: " + formatTimestamp(task.createdAt);
        if (task.completedAt) tsText += " | Completed: " + formatTimestamp(task.completedAt);
        timestamp.textContent = tsText;

        details.appendChild(textarea);
        details.appendChild(timestamp);

        li.appendChild(mainDiv);
        li.appendChild(details);

        // --- Events ---
        completeBtn.addEventListener("click", async () => {
            await authFetch(`/api/tasks/${task.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ completed: !task.completed }),
            });
            await loadTasks();
        });

        deleteBtn.addEventListener("click", async () => {
            await authFetch(`/api/tasks/${task.id}`, { method: "DELETE" });
            await loadTasks();
        });

        notesBtn.addEventListener("click", () => {
            details.classList.toggle("open");
        });

        // Save notes on blur
        textarea.addEventListener("blur", async () => {
            if (textarea.value !== (task.notes || "")) {
                await authFetch(`/api/tasks/${task.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ notes: textarea.value }),
                });
                await loadTasks();
            }
        });

        // --- Drag & Drop ---
        li.addEventListener("dragstart", (e) => {
            draggedId = task.id;
            e.dataTransfer.effectAllowed = "move";
            li.style.opacity = "0.5";
        });

        li.addEventListener("dragend", () => {
            li.style.opacity = "1";
            draggedId = null;
            document.querySelectorAll("#todo-list li").forEach(el => el.classList.remove("drag-over"));
        });

        li.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            li.classList.add("drag-over");
        });

        li.addEventListener("dragleave", () => {
            li.classList.remove("drag-over");
        });

        li.addEventListener("drop", async (e) => {
            e.preventDefault();
            li.classList.remove("drag-over");
            if (draggedId === null || draggedId === task.id) return;

            const orderedIds = tasks.map(t => t.id);
            const fromIdx = orderedIds.indexOf(draggedId);
            const toIdx = orderedIds.indexOf(task.id);
            orderedIds.splice(fromIdx, 1);
            orderedIds.splice(toIdx, 0, draggedId);

            await authFetch("/api/tasks/reorder", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderedIds }),
            });
            await loadTasks();
        });

        todoList.appendChild(li);
    });

    if (filtered.length === 0) {
        emptyMessage.classList.remove("hidden");
    } else {
        emptyMessage.classList.add("hidden");
    }

    updateCounters();
    updateCategoryFilter();
}

// --- Inline Edit Text ---
function startEditText(li, task) {
    const mainDiv = li.querySelector(".task-main");
    const textSpan = mainDiv.querySelector(".task-text");
    if (mainDiv.querySelector(".task-edit-input")) return; // already editing

    const editInput = document.createElement("input");
    editInput.type = "text";
    editInput.className = "task-edit-input";
    editInput.value = task.text;

    textSpan.replaceWith(editInput);
    editInput.focus();
    editInput.select();

    async function saveEdit() {
        const newText = editInput.value.trim();
        if (newText && newText !== task.text) {
            await authFetch(`/api/tasks/${task.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: newText }),
            });
            await loadTasks();
        } else {
            const span = document.createElement("span");
            span.className = "task-text";
            span.textContent = task.text;
            span.addEventListener("dblclick", () => startEditText(li, task));
            editInput.replaceWith(span);
        }
    }

    editInput.addEventListener("blur", saveEdit);
    editInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") editInput.blur();
        if (e.key === "Escape") {
            editInput.value = task.text; // revert
            editInput.blur();
        }
    });
}

// --- Load Tasks ---
async function loadTasks() {
    const res = await authFetch("/api/tasks");
    if (res) {
        tasks = await res.json();
        renderTasks();
        updateStats();
    }
}

// --- Add Task ---
form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (text) {
        const body = {
            text,
            priority: inputPriority.value,
            category: inputCategory.value.trim(),
            dueDate: inputDueDate.value || null,
        };
        await authFetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        await loadTasks();
        input.value = "";
        inputPriority.value = "medium";
        inputCategory.value = "";
        inputDueDate.value = "";
        input.focus();
    }
});

// --- Clear Completed ---
clearCompletedBtn.addEventListener("click", async () => {
    const completedCount = tasks.filter(t => t.completed).length;
    if (completedCount === 0) return;
    await authFetch("/api/tasks/completed", { method: "DELETE" });
    await loadTasks();
});

// --- Filter events ---
filterSearch.addEventListener("input", renderTasks);
filterPriority.addEventListener("change", renderTasks);
filterCategory.addEventListener("change", renderTasks);
filterStatus.addEventListener("change", renderTasks);

// --- Init ---
initDarkMode();
loadUser();
loadTasks();
