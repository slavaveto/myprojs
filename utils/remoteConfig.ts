
export interface RemoteConfig {
    type: 'local' | 'remote';
    url?: string;
    token?: string;
    supabaseUrl?: string;
}

export const getRemoteConfig = (projectTitle: string): RemoteConfig => {
    if (!projectTitle) return { type: 'local' };

    // Normalize title: "PsyHelp" -> "PSYHELP"
    const normalizedTitle = projectTitle.trim().toUpperCase().replace(/\s+/g, '');
    
    // DEBUG LOG
    // console.log(`[RemoteConfig] Checking config for title="${projectTitle}" (norm="${normalizedTitle}")`);

    // Explicitly mapping env vars to ensure Webpack replacement works on client-side
    switch (normalizedTitle) {
        case 'PSYHELP':
            const psyUrl = process.env.NEXT_PUBLIC_PSYHELP_POWERSYNC_URL;
            const psyToken = process.env.NEXT_PUBLIC_PSYHELP_SERVICE_KEY;
            
            // console.log(`[RemoteConfig] Found PSYHELP envs:`, { url: !!psyUrl, token: !!psyToken });
            
            if (psyUrl && psyToken) {
                return {
                    type: 'remote',
                    url: psyUrl,
                    token: psyToken,
                    supabaseUrl: process.env.NEXT_PUBLIC_PSYHELP_SUPABASE_URL
                };
            }
            break;

        case 'VIDEOROOM':
             const videoUrl = process.env.NEXT_PUBLIC_VIDEOROOM_POWERSYNC_URL;
             const videoToken = process.env.NEXT_PUBLIC_VIDEOROOM_SERVICE_KEY;

             if (videoUrl && videoToken) {
                return {
                    type: 'remote',
                    url: videoUrl,
                    token: videoToken,
                    supabaseUrl: process.env.NEXT_PUBLIC_VIDEOROOM_SUPABASE_URL
                };
             }
             break;
            
        // Add new remote projects here as manual cases
        
        default:
            // console.log(`[RemoteConfig] No switch case match for ${normalizedTitle}`);
            break;
    }
    
    return { type: 'local' };
};
