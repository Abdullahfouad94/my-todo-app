require("dotenv").config();
const express = require("express");
const path = require("path");

const taskRoutes = require("./routes/tasks");
const promptRoutes = require("./routes/prompts");
const templateRoutes = require("./routes/templates");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Health check endpoint for Railway
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

// Redirect old auth pages to home
app.get(["/login.html", "/register.html", "/verify.html"], (req, res) => {
    res.redirect("/");
});

app.use("/api/tasks", taskRoutes);
app.use("/api/prompts", promptRoutes);
app.use("/api/templates", templateRoutes);

const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
});

// Graceful shutdown for container environments
process.on("SIGTERM", () => {
    console.log("SIGTERM received. Shutting down gracefully...");
    server.close(() => {
        process.exit(0);
    });
});
