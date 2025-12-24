// hero.ts
import { heroui } from "@heroui/react";

export default heroui({
    themes: {
        light: {
            colors: {
                background: "#ffffff",
                foreground: "#212936",
            },
        },
        dark: {
            colors: {
                background: "#1e2329",
                foreground: "#a7adba",
            },
        },
    },
});