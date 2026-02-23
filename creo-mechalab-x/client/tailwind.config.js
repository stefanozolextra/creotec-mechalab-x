/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            // ADD THIS FONT FAMILY BLOCK
            fontFamily: {
                sans: ['Outfit', 'sans-serif'],
            },
        },
    },
    plugins: [],
}