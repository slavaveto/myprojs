
export interface RemoteConfig {
    type: 'local' | 'remote';
    url?: string;
    token?: string;        // Token for PowerSync (Dev Token or Custom JWT with sub)
    serviceKey?: string;   // Original Supabase Service Key (for Direct access & Upload)
    supabaseUrl?: string;
}

export const getRemoteConfig = (projectTitle: string): RemoteConfig => {
    if (!projectTitle) return { type: 'local' };

    // Normalize title: "PsyHelp" -> "PSYHELP"
    const normalizedTitle = projectTitle.trim().toUpperCase().replace(/\s+/g, '');
    
 

    // Explicitly mapping env vars to ensure Webpack replacement works on client-side
    switch (normalizedTitle) {
        case 'PSYHELP':
            const psyUrl = process.env.NEXT_PUBLIC_PSYHELP_POWERSYNC_URL;
            const psyServiceKey = process.env.NEXT_PUBLIC_PSYHELP_SERVICE_KEY;
            const psyPowerSyncToken = process.env.NEXT_PUBLIC_PSYHELP_POWERSYNC_TOKEN; // New token
            
            if (psyUrl && (psyPowerSyncToken || psyServiceKey)) {
                return {
                    type: 'remote',
                    url: psyUrl,
                    token: psyPowerSyncToken || psyServiceKey, // Prefer specific PS token
                    serviceKey: psyServiceKey,
                    supabaseUrl: process.env.NEXT_PUBLIC_PSYHELP_SUPABASE_URL
                };
            }
            break;

        case 'VIDEOROOM':
             const videoUrl = process.env.NEXT_PUBLIC_VIDEOROOM_POWERSYNC_URL;
             const videoServiceKey = process.env.NEXT_PUBLIC_VIDEOROOM_SERVICE_KEY;
             const videoPowerSyncToken = process.env.NEXT_PUBLIC_VIDEOROOM_POWERSYNC_TOKEN; // New token

             if (videoUrl && (videoPowerSyncToken || videoServiceKey)) {
                return {
                    type: 'remote',
                    url: videoUrl,
                    token: videoPowerSyncToken || videoServiceKey, // Prefer specific PS token
                    serviceKey: videoServiceKey,
                    supabaseUrl: process.env.NEXT_PUBLIC_VIDEOROOM_SUPABASE_URL
                };
             }
             break;
            
        // Add new remote projects here as manual cases
        
        default:
            break;
    }
    
    return { type: 'local' };
};
