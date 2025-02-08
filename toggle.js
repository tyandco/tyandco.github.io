// toggle.js

document.addEventListener("DOMContentLoaded", function () {
  const toggle = document.getElementById("theme-toggle");

  // Check localStorage for dark mode preference
  const darkModeSetting = localStorage.getItem("darkMode");
  if (darkModeSetting === "enabled") {
    document.documentElement.classList.add("dark-mode");
    toggle.checked = true;
  }

  toggle.addEventListener("change", function () {
    document.body.classList.toggle('dark-mode', toggle.checked);
    if (toggle.checked) {
      localStorage.setItem("darkMode", "enabled");
    } else {
      localStorage.setItem("darkMode", "disabled");
    }
  });
});