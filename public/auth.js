// --- Token helpers ---
function getToken() { return localStorage.getItem("token"); }
function setToken(token) { localStorage.setItem("token", token); }
function removeToken() { localStorage.removeItem("token"); }

// --- Dark mode (shared across auth pages) ---
if (localStorage.getItem("darkMode") === "true") {
    document.body.classList.add("dark");
}

// --- Redirect if already logged in ---
if (getToken()) {
    window.location.href = "/index.html";
}

// --- Check for token in URL (GitHub OAuth callback) ---
(function checkURLToken() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
        setToken(token);
        window.location.href = "/index.html";
        return;
    }
    const error = params.get("error");
    if (error) {
        showError("login-error", decodeURIComponent(error));
    }
})();

// --- Helpers ---
function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = message;
        el.style.display = "block";
    }
}

function hideError(elementId) {
    const el = document.getElementById(elementId);
    if (el) el.style.display = "none";
}

function showSuccess(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = message;
        el.style.display = "block";
    }
}

// --- Login form ---
const loginForm = document.getElementById("login-form");
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        hideError("login-error");

        const email = document.getElementById("login-email").value.trim();
        const password = document.getElementById("login-password").value;
        const submitBtn = loginForm.querySelector("button[type='submit']");
        submitBtn.disabled = true;

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();

            if (!res.ok) {
                if (data.needsVerification) {
                    window.location.href = `/verify.html?email=${encodeURIComponent(email)}`;
                    return;
                }
                showError("login-error", data.error);
                submitBtn.disabled = false;
                return;
            }

            setToken(data.token);
            window.location.href = "/index.html";
        } catch (err) {
            showError("login-error", "Network error. Please try again.");
            submitBtn.disabled = false;
        }
    });
}

// --- Register form ---
const registerForm = document.getElementById("register-form");
if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        hideError("register-error");

        const username = document.getElementById("reg-username").value.trim();
        const email = document.getElementById("reg-email").value.trim();
        const password = document.getElementById("reg-password").value;
        const confirmPassword = document.getElementById("reg-confirm-password").value;
        const submitBtn = registerForm.querySelector("button[type='submit']");

        if (password !== confirmPassword) {
            showError("register-error", "Passwords do not match");
            return;
        }

        submitBtn.disabled = true;

        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, email, password }),
            });
            const data = await res.json();

            if (!res.ok) {
                showError("register-error", data.error);
                submitBtn.disabled = false;
                return;
            }

            setToken(data.token);
            window.location.href = "/index.html";
        } catch (err) {
            showError("register-error", "Network error. Please try again.");
            submitBtn.disabled = false;
        }
    });
}

// --- OTP Verify form ---
const verifyForm = document.getElementById("verify-form");
if (verifyForm) {
    const params = new URLSearchParams(window.location.search);
    const email = params.get("email") || "";
    const emailDisplay = document.getElementById("verify-email-display");
    if (emailDisplay) emailDisplay.textContent = email;

    verifyForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        hideError("verify-error");

        const otp = document.getElementById("otp-input").value.trim();
        const submitBtn = verifyForm.querySelector("button[type='submit']");
        submitBtn.disabled = true;

        try {
            const res = await fetch("/api/auth/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, otp }),
            });
            const data = await res.json();

            if (!res.ok) {
                showError("verify-error", data.error);
                submitBtn.disabled = false;
                return;
            }

            setToken(data.token);
            window.location.href = "/index.html";
        } catch (err) {
            showError("verify-error", "Network error. Please try again.");
            submitBtn.disabled = false;
        }
    });

    // Resend OTP with cooldown
    const resendBtn = document.getElementById("resend-btn");
    if (resendBtn) {
        resendBtn.addEventListener("click", async () => {
            resendBtn.disabled = true;
            hideError("verify-error");

            try {
                const res = await fetch("/api/auth/resend-otp", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email }),
                });
                const data = await res.json();

                if (!res.ok) {
                    showError("verify-error", data.error);
                    resendBtn.disabled = false;
                    return;
                }

                showSuccess("verify-success", "New code sent!");

                // 60-second cooldown
                let seconds = 60;
                resendBtn.textContent = `Resend Code (${seconds}s)`;
                const interval = setInterval(() => {
                    seconds--;
                    resendBtn.textContent = `Resend Code (${seconds}s)`;
                    if (seconds <= 0) {
                        clearInterval(interval);
                        resendBtn.textContent = "Resend Code";
                        resendBtn.disabled = false;
                    }
                }, 1000);
            } catch (err) {
                showError("verify-error", "Network error. Please try again.");
                resendBtn.disabled = false;
            }
        });
    }
}

// --- GitHub login button ---
const githubBtn = document.getElementById("github-login-btn");
if (githubBtn) {
    githubBtn.addEventListener("click", () => {
        window.location.href = "/api/auth/github";
    });
}
