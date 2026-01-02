import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getRemoteKeys } from '@/utils/supabase/getRemoteKeys';
import { supabase as localClient } from '@/utils/supabase/supabaseClient';

// Cache clients to avoid recreating them on every render/request
// Key: slug, Value: SupabaseClient
const clientCache: Record<string, SupabaseClient> = {};

export const getProjectClient = async (slug?: string): Promise<SupabaseClient | null> => {
    // 1. If no slug provided, return the default local client
    if (!slug) {
        return localClient;
    }

    // 2. Check cache first
    if (clientCache[slug]) {
        return clientCache[slug];
    }

    // 3. Fetch keys from Server Action
    const keys = await getRemoteKeys(slug);

    if (!keys) {
        console.error(`Could not retrieve keys for remote project: ${slug}`);
        return null;
    }

    // 4. Create new client
    // Note: We use the SERVICE_ROLE key here, which bypasses RLS.
    // This is safe because this code runs in your local admin dashboard context.
    const newClient = createClient(keys.url, keys.key, {
        auth: {
            persistSession: false, // We don't need auth session persistence for admin actions
            autoRefreshToken: false,
        }
    });

    // 5. Cache and return
    clientCache[slug] = newClient;
    return newClient;
};

