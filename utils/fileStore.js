const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DATA_DIR = path.join(__dirname, "..", "data");
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(path.join(DATA_DIR, "todo.db"));

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");

// Create tables on startup
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT,
        verified INTEGER NOT NULL DEFAULT 0,
        otp TEXT,
        otpExpires INTEGER,
        githubId TEXT,
        createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY,
        text TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0,
        priority TEXT NOT NULL DEFAULT 'medium',
        category TEXT NOT NULL DEFAULT '',
        dueDate TEXT,
        notes TEXT NOT NULL DEFAULT '',
        createdAt TEXT NOT NULL,
        completedAt TEXT,
        userId TEXT NOT NULL,
        sortOrder INTEGER
    );
`);

// --- Users ---

function deserializeUser(row) {
    if (!row) return null;
    return {
        ...row,
        verified: !!row.verified,
        otp: row.otp || null,
        otpExpires: row.otpExpires || null,
        githubId: row.githubId || null,
        password: row.password || null,
    };
}

function readUsers() {
    const rows = db.prepare("SELECT * FROM users").all();
    return rows.map(deserializeUser);
}

function writeUsers(users) {
    const upsert = db.prepare(`
        INSERT OR REPLACE INTO users (id, username, email, password, verified, otp, otpExpires, githubId, createdAt)
        VALUES (@id, @username, @email, @password, @verified, @otp, @otpExpires, @githubId, @createdAt)
    `);

    const deleteAll = db.prepare("DELETE FROM users");
    const transaction = db.transaction((users) => {
        deleteAll.run();
        for (const u of users) {
            upsert.run({
                id: u.id,
                username: u.username,
                email: u.email,
                password: u.password || null,
                verified: u.verified ? 1 : 0,
                otp: u.otp || null,
                otpExpires: u.otpExpires || null,
                githubId: u.githubId || null,
                createdAt: u.createdAt,
            });
        }
    });

    transaction(users);
}

// --- Tasks ---

function deserializeTask(row) {
    if (!row) return null;
    const { sortOrder, ...rest } = row;
    return {
        ...rest,
        completed: !!row.completed,
        dueDate: row.dueDate || null,
        completedAt: row.completedAt || null,
    };
}

function readTasks() {
    const rows = db.prepare("SELECT * FROM tasks ORDER BY sortOrder ASC, id ASC").all();
    return rows.map(deserializeTask);
}

function writeTasks(tasks) {
    const upsert = db.prepare(`
        INSERT OR REPLACE INTO tasks (id, text, completed, priority, category, dueDate, notes, createdAt, completedAt, userId, sortOrder)
        VALUES (@id, @text, @completed, @priority, @category, @dueDate, @notes, @createdAt, @completedAt, @userId, @sortOrder)
    `);

    const deleteAll = db.prepare("DELETE FROM tasks");
    const transaction = db.transaction((tasks) => {
        deleteAll.run();
        for (let i = 0; i < tasks.length; i++) {
            const t = tasks[i];
            upsert.run({
                id: t.id,
                text: t.text,
                completed: t.completed ? 1 : 0,
                priority: t.priority || "medium",
                category: t.category || "",
                dueDate: t.dueDate || null,
                notes: t.notes || "",
                createdAt: t.createdAt,
                completedAt: t.completedAt || null,
                userId: t.userId,
                sortOrder: i,
            });
        }
    });

    transaction(tasks);
}

module.exports = { readTasks, writeTasks, readUsers, writeUsers };
