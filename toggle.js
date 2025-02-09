document.addEventListener('DOMContentLoaded', () => {
  const setTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
  };

  // Set initial theme based on system preference
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(prefersDark ? 'dark' : 'light');

  // Listen for changes in system preferences and update theme accordingly
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    setTheme(e.matches ? 'dark' : 'light');
  });
});