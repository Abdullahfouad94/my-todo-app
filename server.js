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

// Auth routes (unprotected)
app.use("/api/auth", authRoutes);

// Task routes (protected)
app.use("/api/tasks", authMiddleware, taskRoutes);

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
