// toggle.js

document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.getElementById('theme-toggle');
  const themeToggleContainer = document.querySelector('.theme-toggle');

  // Retrieve saved mode or default to "light"
  const savedMode = localStorage.getItem('theme') || 'light';

  if (savedMode === 'dark') {
    document.body.classList.add('dark-mode');
    themeToggle.checked = true;
  } else {
    document.body.classList.remove('dark-mode');
    themeToggle.checked = false;
  }

  themeToggle.addEventListener('change', () => {
    if (themeToggle.checked) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    }

    // Enable transitions after first toggle
    if (!themeToggleContainer.classList.contains('animate')) {
      themeToggleContainer.classList.add('animate');
    }
  });
});