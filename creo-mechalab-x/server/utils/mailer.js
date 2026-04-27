const EMAIL_NOT_CONFIGURED_MESSAGE = "Email delivery is not configured.";
const DEFAULT_SENDER_NAME = "CREO MechaLab X";
const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseSenderAddress(value) {
    const rawValue = String(value || "").trim();
    if (!rawValue) return null;

    const displayAddressMatch = rawValue.match(/^(.*)<([^>]+)>$/);
    if (displayAddressMatch) {
        const name = displayAddressMatch[1].trim().replace(/^"+|"+$/g, "");
        const email = displayAddressMatch[2].trim();
        if (!SIMPLE_EMAIL_PATTERN.test(email)) return null;
        return {
            name: name || DEFAULT_SENDER_NAME,
            email,
        };
    }

    if (!SIMPLE_EMAIL_PATTERN.test(rawValue)) return null;
    return {
        name: DEFAULT_SENDER_NAME,
        email: rawValue,
    };
}

function readEmailDeliveryConfig() {
    const apiKey = String(process.env.BREVO_API_KEY ?? "").trim();
    const sender = parseSenderAddress(process.env.SMTP_FROM);

    return {
        apiKey,
        sender,
        isValid: Boolean(apiKey && sender?.email),
    };
}

function isEmailDeliveryConfigured() {
    try {
        return readEmailDeliveryConfig().isValid;
    } catch {
        return false;
    }
}

async function sendTraineeCredentialsEmail({ to, traineeName, loginEmail, password, batchCode }) {
    if (!isEmailDeliveryConfigured()) {
        throw new Error(EMAIL_NOT_CONFIGURED_MESSAGE);
    }

    if (typeof to !== "string" || !to.trim()) throw new Error("Recipient email is required.");
    if (typeof loginEmail !== "string" || !loginEmail.trim()) throw new Error("Login email is required.");
    if (typeof password !== "string" || !password) throw new Error("Password is required.");

    const { apiKey, sender } = readEmailDeliveryConfig();
    const safeTraineeName = String(traineeName || "Trainee").trim() || "Trainee";
    const safeBatchCode = String(batchCode || "").trim();
    const safeLoginEmail = loginEmail.trim();
    const subject = "Your CREO MechaLab X Account Credentials";
    const batchLine = safeBatchCode ? `Batch: ${safeBatchCode}` : "Batch: (not assigned)";

    const html = [
        `<p>Hello ${safeTraineeName},</p>`,
        "<p>Your trainee account is ready.</p>",
        "<ul>",
        `<li>${batchLine}</li>`,
        `<li>Login email: ${safeLoginEmail}</li>`,
        `<li>Temporary password: <code style=\"background-color: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 14px; color: #0f172a;\">${password}</code></li>`,
        "</ul>",
        "<p>Please sign in and change this password as soon as possible.</p>",
    ].join("");

    try {
        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "api-key": apiKey,
            },
            body: JSON.stringify({
                sender,
                to: [{ email: to.trim() }],
                subject,
                htmlContent: html,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Brevo API error:", errorText);
            throw new Error("Failed to send credentials email via API.");
        }

        console.log(`Email successfully sent via Brevo API to ${to.trim()}`);
    } catch (error) {
        console.error("Mailer error:", error?.message || error);
        throw new Error("Failed to send credentials email.");
    }
}

module.exports = {
    EMAIL_NOT_CONFIGURED_MESSAGE,
    readEmailDeliveryConfig,
    isEmailDeliveryConfigured,
    sendTraineeCredentialsEmail,
};
