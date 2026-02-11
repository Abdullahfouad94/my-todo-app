const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { readUsers, writeUsers } = require("../utils/fileStore");
const { generateOTP, sendOTPEmail } = require("../utils/email");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

function generateToken(user) {
    return jwt.sign(
        { id: user.id, username: user.username, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: "Username, email, and password are required" });
        }
        if (username.trim().length < 3) {
            return res.status(400).json({ error: "Username must be at least 3 characters" });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: "Password must be at least 8 characters" });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: "Invalid email format" });
        }

        const users = readUsers();
        if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
            return res.status(409).json({ error: "Email already registered" });
        }
        if (users.find(u => u.username.toLowerCase() === username.trim().toLowerCase())) {
            return res.status(409).json({ error: "Username already taken" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = {
            id: uuidv4(),
            username: username.trim(),
            email: email.toLowerCase(),
            password: hashedPassword,
            verified: true,
            otp: null,
            otpExpires: null,
            githubId: null,
            createdAt: new Date().toISOString(),
        };

        users.push(newUser);
        writeUsers(users);

        const token = generateToken(newUser);
        res.status(201).json({ token, user: { id: newUser.id, username: newUser.username, email: newUser.email } });
    } catch (err) {
        console.error("Register error:", err);
        res.status(500).json({ error: "Registration failed. Please try again." });
    }
});

// POST /api/auth/verify-otp
router.post("/verify-otp", (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) {
        return res.status(400).json({ error: "Email and OTP are required" });
    }

    const users = readUsers();
    const user = users.find(u => u.email === email.toLowerCase());
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }
    if (user.verified) {
        return res.status(400).json({ error: "Email already verified" });
    }
    if (user.otp !== otp) {
        return res.status(400).json({ error: "Invalid verification code" });
    }
    if (Date.now() > user.otpExpires) {
        return res.status(400).json({ error: "Verification code expired. Request a new one." });
    }

    user.verified = true;
    user.otp = null;
    user.otpExpires = null;
    writeUsers(users);

    const token = generateToken(user);
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        const users = readUsers();
        const user = users.find(u => u.email === email.toLowerCase());
        if (!user || !user.password) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        if (!user.verified) {
            return res.status(403).json({ error: "Email not verified", needsVerification: true });
        }

        const token = generateToken(user);
        res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: "Login failed. Please try again." });
    }
});

// POST /api/auth/resend-otp
router.post("/resend-otp", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }

        const users = readUsers();
        const user = users.find(u => u.email === email.toLowerCase());
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        if (user.verified) {
            return res.status(400).json({ error: "Email already verified" });
        }

        const otp = generateOTP();
        user.otp = otp;
        user.otpExpires = Date.now() + 10 * 60 * 1000;
        writeUsers(users);

        await sendOTPEmail(user.email, user.username, otp);

        res.json({ message: "New verification code sent" });
    } catch (err) {
        console.error("Resend OTP error:", err);
        res.status(500).json({ error: "Failed to resend code. Please try again." });
    }
});

// GET /api/auth/github — redirect to GitHub OAuth
router.get("/github", (req, res) => {
    const params = new URLSearchParams({
        client_id: process.env.GITHUB_CLIENT_ID,
        redirect_uri: process.env.GITHUB_CALLBACK_URL,
        scope: "user:email",
    });
    res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

// GET /api/auth/github/callback
router.get("/github/callback", async (req, res) => {
    try {
        const { code } = req.query;
        if (!code) {
            return res.redirect("/login.html?error=GitHub+authentication+failed");
        }

        // Exchange code for access token
        const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({
                client_id: process.env.GITHUB_CLIENT_ID,
                client_secret: process.env.GITHUB_CLIENT_SECRET,
                code,
            }),
        });
        const tokenData = await tokenRes.json();

        if (!tokenData.access_token) {
            return res.redirect("/login.html?error=GitHub+authentication+failed");
        }

        // Get GitHub user info
        const userRes = await fetch("https://api.github.com/user", {
            headers: { Authorization: `Bearer ${tokenData.access_token}`, "User-Agent": "MyToDoApp" },
        });
        const githubUser = await userRes.json();

        // Get GitHub user emails (profile email can be null)
        const emailsRes = await fetch("https://api.github.com/user/emails", {
            headers: { Authorization: `Bearer ${tokenData.access_token}`, "User-Agent": "MyToDoApp" },
        });
        const emails = await emailsRes.json();
        const primaryEmail = emails.find(e => e.primary && e.verified)?.email || emails[0]?.email;

        if (!primaryEmail) {
            return res.redirect("/login.html?error=No+email+found+on+GitHub+account");
        }

        const users = readUsers();
        let user = users.find(u => u.githubId === String(githubUser.id));

        if (!user) {
            // Check if a user with this email already exists — link accounts
            user = users.find(u => u.email === primaryEmail.toLowerCase());
            if (user) {
                user.githubId = String(githubUser.id);
                user.verified = true;
                writeUsers(users);
            }
        }

        if (!user) {
            // Create new user from GitHub
            user = {
                id: uuidv4(),
                username: githubUser.login,
                email: primaryEmail.toLowerCase(),
                password: null,
                verified: true,
                otp: null,
                otpExpires: null,
                githubId: String(githubUser.id),
                createdAt: new Date().toISOString(),
            };
            users.push(user);
            writeUsers(users);
        }

        const token = generateToken(user);
        res.redirect(`/login.html?token=${token}`);
    } catch (err) {
        console.error("GitHub OAuth error:", err);
        res.redirect("/login.html?error=GitHub+authentication+failed");
    }
});

// GET /api/auth/me — protected
router.get("/me", authMiddleware, (req, res) => {
    const users = readUsers();
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }
    res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        verified: user.verified,
        hasGithub: !!user.githubId,
        createdAt: user.createdAt,
    });
});

module.exports = router;
