import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    reactStrictMode: false,
    transpilePackages: ['@powersync/web', '@journeyapps/wa-sqlite'],
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
    // Headers for PowerSync / SQLite WASM
    headers: async () => {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'Cross-Origin-Embedder-Policy',
                        value: 'require-corp',
                    },
                    {
                        key: 'Cross-Origin-Opener-Policy',
                        value: 'same-origin',
                    },
                ],
            },
            // Allow WASM files to be served correctly (Scoped to worker folder)
            {
                source: '/worker/:path*.wasm',
                headers: [
                    {
                        key: 'Content-Type',
                        value: 'application/wasm',
                    },
                ],
            },
        ];
    },
    // Rewrite root WASM requests to /worker/ folder
    rewrites: async () => {
        return [
            {
                source: '/:path*.wasm',
                destination: '/worker/:path*.wasm',
            },
        ];
    },
    /* config options here */
};

export default nextConfig;
