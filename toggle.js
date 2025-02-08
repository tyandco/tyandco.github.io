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
    if (toggle.checked) {
      document.documentElement.classList.add("dark-mode");
      localStorage.setItem("darkMode", "enabled");
    } else {
      document.documentElement.classList.remove("dark-mode");
      localStorage.setItem("darkMode", "disabled");
    }
  });
});