const crypto = require("crypto");

const UPPERCASE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERCASE_CHARS = "abcdefghijklmnopqrstuvwxyz";
const DIGIT_CHARS = "0123456789";
const SYMBOL_CHARS = "!@#$%^&*()-_=+[]{};:,.?";

const ALL_PASSWORD_CHARS = `${UPPERCASE_CHARS}${LOWERCASE_CHARS}${DIGIT_CHARS}${SYMBOL_CHARS}`;

function getRandomChar(chars) {
    return chars[crypto.randomInt(0, chars.length)];
}

function shuffleCharacters(characters) {
    const shuffled = [...characters];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = crypto.randomInt(0, index + 1);
        const tmp = shuffled[index];
        shuffled[index] = shuffled[swapIndex];
        shuffled[swapIndex] = tmp;
    }
    return shuffled;
}

function generateStrongPassword(length = 14) {
    const safeLength = Number.isInteger(length) && length >= 4 ? length : 14;

    const chars = [
        getRandomChar(UPPERCASE_CHARS),
        getRandomChar(LOWERCASE_CHARS),
        getRandomChar(DIGIT_CHARS),
        getRandomChar(SYMBOL_CHARS),
    ];

    for (let index = chars.length; index < safeLength; index += 1) {
        chars.push(getRandomChar(ALL_PASSWORD_CHARS));
    }

    return shuffleCharacters(chars).join("");
}

module.exports = {
    generateStrongPassword,
};
