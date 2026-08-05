"use client";

/**
 * Light / dark appearance switch. Toggles the `.dark` class on <html> (which drives every
 * dark: utility) and remembers the choice in localStorage. Which label shows is driven by
 * CSS (dark: variants) rather than React state, so there's no hydration mismatch or flash
 * and no state updates in effects. The initial class is set by an inline script in the
 * root layout before paint.
 */
export function ThemeToggle() {
  function toggle() {
    const isDark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("theme", isDark ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle light and dark appearance"
      className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 px-3 py-2 text-sm font-bold uppercase tracking-wide text-neutral-700 transition-colors hover:border-neutral-500 hover:text-black dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-neutral-400 dark:hover:text-white"
    >
      {/* Shown in dark mode — offers a switch to light. */}
      <span className="hidden items-center gap-2 dark:flex">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
        Light mode
      </span>
      {/* Shown in light mode — offers a switch to dark. */}
      <span className="flex items-center gap-2 dark:hidden">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        Dark mode
      </span>
    </button>
  );
}
