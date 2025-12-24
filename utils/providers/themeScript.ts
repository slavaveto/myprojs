export const themeScript = `
    (function() {
        try {
            const isLocalStorageAvailable = (() => {
                try {
                    const testKey = '__test__';
                    localStorage.setItem(testKey, 'test');
                    localStorage.removeItem(testKey);
                    return true;
                } catch (e) {
                    return false;
                }
            })();

            const theme = isLocalStorageAvailable
                ? localStorage.getItem('theme') || 'system'
                : 'system';

            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            const appliedTheme = theme === 'system' ? systemTheme : theme;
            document.documentElement.classList.remove('light', 'dark');
            document.documentElement.classList.add(appliedTheme);
        } catch (e) {

        }
    })();
`;
