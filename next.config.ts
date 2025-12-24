import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    reactStrictMode: false,
    eslint: {
        ignoreDuringBuilds: true, // Игнорировать ошибки ESLint во время сборки
    },
    images: {
        domains: ['storage.googleapis.com'], // Добавьте ваш хост
    },
    redirects: async () => {
        return [
            {
                source: "/wise-pay/supervision_group",
                destination: "https://wise.com/pay/r/TgKZfOMashVnXfQ",
                permanent: false,
            },

        ];
    },
    /* config options here */
};

export default nextConfig;
