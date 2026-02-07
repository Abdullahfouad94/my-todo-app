require("dotenv").config();
const express = require("express");
const path = require("path");

const authMiddleware = require("./middleware/auth");
const authRoutes = require("./routes/auth");
const taskRoutes = require("./routes/tasks");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Health check endpoint for Railway
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

// Auth routes (unprotected)
app.use("/api/auth", authRoutes);

// Task routes (protected)
app.use("/api/tasks", authMiddleware, taskRoutes);

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
