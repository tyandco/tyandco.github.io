document.addEventListener('DOMContentLoaded', () => {
  const navToggle = document.getElementById('nav-toggle');
  const slideNav = document.getElementById('slide-nav');

  if (navToggle && slideNav) {
    navToggle.addEventListener('click', () => {
      slideNav.classList.toggle('open');
    });
  } else {
    console.error('Navigation toggle or slide navigation element not found');
  }
});