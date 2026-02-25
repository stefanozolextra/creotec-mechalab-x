const nodemailer = require("nodemailer");

function parseSmtpSecure(value) {
    const normalized = String(value ?? "")
        .trim()
        .toLowerCase();

    if (!normalized) return false;
    if (normalized === "true") return true;
    if (normalized === "false") return false;
    throw new Error('SMTP_SECURE must be "true" or "false".');
}

function readSmtpConfig() {
    const host = String(process.env.SMTP_HOST ?? "").trim();
    const portRaw = String(process.env.SMTP_PORT ?? "").trim();
    const user = String(process.env.SMTP_USER ?? "").trim();
    const pass = String(process.env.SMTP_PASS ?? "");
    const from = String(process.env.SMTP_FROM ?? "").trim();
    const secure = parseSmtpSecure(process.env.SMTP_SECURE);
    const port = Number(portRaw);

    return {
        host,
        port,
        user,
        pass,
        from,
        secure,
        isValid:
            host.length > 0 &&
            from.length > 0 &&
            user.length > 0 &&
            pass.length > 0 &&
            Number.isInteger(port) &&
            port > 0,
    };
}

function isSmtpConfigured() {
    try {
        const config = readSmtpConfig();
        return config.isValid;
    } catch {
        return false;
    }
}

async function sendTraineeCredentialsEmail({ to, traineeName, loginEmail, password, batchCode }) {
    if (!isSmtpConfigured()) {
        throw new Error("SMTP is not configured.");
    }

    if (typeof to !== "string" || !to.trim()) {
        throw new Error("Recipient email is required.");
    }
    if (typeof loginEmail !== "string" || !loginEmail.trim()) {
        throw new Error("Login email is required.");
    }
    if (typeof password !== "string" || !password) {
        throw new Error("Password is required.");
    }

    const config = readSmtpConfig();
    const safeTraineeName = String(traineeName || "Trainee").trim() || "Trainee";
    const safeBatchCode = String(batchCode || "").trim();
    const safeLoginEmail = loginEmail.trim();

    const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
            user: config.user,
            pass: config.pass,
        },
    });

    const subject = "Your CREO MechaLab X Account Credentials";
    const batchLine = safeBatchCode ? `Batch: ${safeBatchCode}` : "Batch: (not assigned)";
    const text = [
        `Hello ${safeTraineeName},`,
        "",
        "Your trainee account is ready.",
        batchLine,
        `Login email: ${safeLoginEmail}`,
        `Temporary password: ${password}`,
        "",
        "Please sign in and change this password as soon as possible.",
    ].join("\n");

    const html = [
        `<p>Hello ${safeTraineeName},</p>`,
        "<p>Your trainee account is ready.</p>",
        "<ul>",
        `<li>${batchLine}</li>`,
        `<li>Login email: ${safeLoginEmail}</li>`,
        `<li>Temporary password: ${password}</li>`,
        "</ul>",
        "<p>Please sign in and change this password as soon as possible.</p>",
    ].join("");

    try {
        await transporter.sendMail({
            from: config.from,
            to: to.trim(),
            subject,
            text,
            html,
        });
    } catch {
        throw new Error("Failed to send credentials email.");
    }
}

module.exports = {
    isSmtpConfigured,
    sendTraineeCredentialsEmail,
};
