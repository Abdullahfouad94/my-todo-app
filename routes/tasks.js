const express = require("express");
const { readTasks, writeTasks } = require("../utils/fileStore");

const router = express.Router();

// GET /api/tasks
router.get("/", (req, res) => {
    const allTasks = readTasks();
    const userTasks = allTasks.filter(t => t.userId === "default");
    res.json(userTasks);
});

// GET /api/tasks/stats
router.get("/stats", (req, res) => {
    const allTasks = readTasks();
    const tasks = allTasks.filter(t => t.userId === "default");
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const remaining = total - completed;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const startOfWeekISO = startOfWeek.toISOString();

    const completedToday = tasks.filter(t => t.completedAt && t.completedAt >= startOfToday).length;
    const completedThisWeek = tasks.filter(t => t.completedAt && t.completedAt >= startOfWeekISO).length;

    res.json({ total, completed, remaining, completedToday, completedThisWeek });
});

// POST /api/tasks
router.post("/", (req, res) => {
    const { text, priority, category, dueDate, notes } = req.body;
    if (!text || !text.trim()) {
        return res.status(400).json({ error: "Task text is required" });
    }
    const allTasks = readTasks();
    const newTask = {
        id: Date.now(),
        text: text.trim(),
        completed: false,
        priority: priority || "medium",
        category: category || "",
        dueDate: dueDate || null,
        notes: notes || "",
        createdAt: new Date().toISOString(),
        completedAt: null,
        userId: "default",
    };
    allTasks.push(newTask);
    writeTasks(allTasks);
    res.status(201).json(newTask);
});

// PUT /api/tasks/reorder
router.put("/reorder", (req, res) => {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
        return res.status(400).json({ error: "orderedIds array is required" });
    }
    const allTasks = readTasks();
    const userTasks = allTasks.filter(t => t.userId === "default");
    const otherTasks = allTasks.filter(t => t.userId !== "default");

    const taskMap = {};
    userTasks.forEach(t => { taskMap[t.id] = t; });
    const reordered = orderedIds.map(id => taskMap[id]).filter(Boolean);
    // Append any user tasks not in orderedIds
    userTasks.forEach(t => {
        if (!orderedIds.includes(t.id)) reordered.push(t);
    });

    writeTasks([...reordered, ...otherTasks]);
    res.json(reordered);
});

// PUT /api/tasks/:id
router.put("/:id", (req, res) => {
    const id = Number(req.params.id);
    const allTasks = readTasks();
    const task = allTasks.find(t => t.id === id && t.userId === "default");
    if (!task) {
        return res.status(404).json({ error: "Task not found" });
    }

    const body = req.body;

    if (Object.keys(body).length === 0) {
        task.completed = !task.completed;
        task.completedAt = task.completed ? new Date().toISOString() : null;
    } else {
        if (body.text !== undefined) task.text = body.text.trim();
        if (body.priority !== undefined) task.priority = body.priority;
        if (body.category !== undefined) task.category = body.category;
        if (body.dueDate !== undefined) task.dueDate = body.dueDate;
        if (body.notes !== undefined) task.notes = body.notes;
        if (body.completed !== undefined) {
            task.completed = body.completed;
            task.completedAt = body.completed ? new Date().toISOString() : null;
        }
    }

    writeTasks(allTasks);
    res.json(task);
});

// DELETE /api/tasks/completed
router.delete("/completed", (req, res) => {
    let allTasks = readTasks();
    allTasks = allTasks.filter(t => !(t.userId === "default" && t.completed));
    writeTasks(allTasks);
    const remaining = allTasks.filter(t => t.userId === "default").length;
    res.json({ message: "Completed tasks cleared", remaining });
});

// DELETE /api/tasks/:id
router.delete("/:id", (req, res) => {
    const id = Number(req.params.id);
    let allTasks = readTasks();
    const index = allTasks.findIndex(t => t.id === id && t.userId === "default");
    if (index === -1) {
        return res.status(404).json({ error: "Task not found" });
    }
    allTasks.splice(index, 1);
    writeTasks(allTasks);
    res.status(204).send();
});

module.exports = router;
