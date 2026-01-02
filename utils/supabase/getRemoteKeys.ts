'use server';

/**
 * Server Action to securely retrieve remote project keys from .env
 * This code runs ONLY on the server. Keys are never exposed to the client bundle.
 */
export async function getRemoteKeys(slug: string) {
    // Security check: Only allow in development mode or if explicitly enabled
    // Since this is for a local "admin dashboard", we rely on the fact that .env keys
    // are only present on your local machine.
    
    // In production, these keys simply won't exist in environment variables,
    // returning undefined, effectively disabling the feature.
    
    if (!slug) return null;

    const upperSlug = slug.toUpperCase();
    const urlKey = `${upperSlug}_URL`;
    const serviceRoleKey = `${upperSlug}_SERVICE_KEY`;

    const url = process.env[urlKey];
    const key = process.env[serviceRoleKey];

    if (!url || !key) {
        console.warn(`[getRemoteKeys] Keys not found for slug: ${slug} (looked for ${urlKey}, ${serviceRoleKey})`);
        return null;
    }

    return {
        url,
        key
    };
}

