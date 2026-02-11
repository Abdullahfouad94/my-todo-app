const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { readPrompts, writePrompt, deletePrompt, getPrompt } = require("../utils/fileStore");

const router = express.Router();

// GET /api/prompts
router.get("/", (req, res) => {
    const all = readPrompts();
    res.json(all.filter(p => p.userId === "default"));
});

// GET /api/prompts/:id
router.get("/:id", (req, res) => {
    const prompt = getPrompt(req.params.id, "default");
    if (!prompt) return res.status(404).json({ error: "Prompt not found" });
    res.json(prompt);
});

// POST /api/prompts
router.post("/", (req, res) => {
    const { title, category, sections, tags, variableDefinitions } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: "Title is required" });
    const now = new Date().toISOString();
    const prompt = {
        id: uuidv4(),
        userId: "default",
        title: title.trim(),
        category: category || "",
        sections: sections || {},
        tags: tags || "",
        variableDefinitions: variableDefinitions || [],
        createdAt: now,
        updatedAt: now,
    };
    writePrompt(prompt);
    res.status(201).json(prompt);
});

// PUT /api/prompts/:id
router.put("/:id", (req, res) => {
    const prompt = getPrompt(req.params.id, "default");
    if (!prompt) return res.status(404).json({ error: "Prompt not found" });

    const { title, category, sections, tags, variableDefinitions } = req.body;
    if (title !== undefined) prompt.title = title.trim();
    if (category !== undefined) prompt.category = category;
    if (sections !== undefined) prompt.sections = sections;
    if (tags !== undefined) prompt.tags = tags;
    if (variableDefinitions !== undefined) prompt.variableDefinitions = variableDefinitions;
    prompt.updatedAt = new Date().toISOString();

    writePrompt(prompt);
    res.json(prompt);
});

// DELETE /api/prompts/:id
router.delete("/:id", (req, res) => {
    const prompt = getPrompt(req.params.id, "default");
    if (!prompt) return res.status(404).json({ error: "Prompt not found" });
    deletePrompt(req.params.id);
    res.status(204).send();
});

module.exports = router;
