#!/usr/bin/env node

require("dotenv").config();

const { readEmailDeliveryConfig } = require("../utils/mailer");

try {
    const config = readEmailDeliveryConfig();

    if (!config.isValid) {
        console.error("Email delivery config is incomplete.");
        console.error("Required: BREVO_API_KEY and SMTP_FROM.");
        process.exit(1);
    }

    console.log("Email delivery config looks valid for Brevo API usage.");
    console.log(`Sender email: ${config.sender.email}`);
    console.log(`Sender name: ${config.sender.name}`);
    console.log("This check validates local configuration only and does not contact Brevo.");
    process.exit(0);
} catch (error) {
    console.error("Email delivery config verify failed:", error?.message || error);
    process.exit(1);
}
