/** localStorage key for the remembered light/dark choice. */
export const THEME_KEY = "kca-theme";

/**
 * Inlined in <head> so it runs before first paint and the page never flashes
 * the wrong theme: a saved choice wins, otherwise follow the OS setting.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;
