document.addEventListener('DOMContentLoaded', function () {
  // Mobile nav toggle
  var navToggle = document.querySelector('.nav-toggle');
  var header = document.querySelector('.site-header');
  if (navToggle && header) {
    navToggle.addEventListener('click', function () {
      header.classList.toggle('nav-open');
    });
    document.querySelectorAll('.main-nav a').forEach(function (link) {
      link.addEventListener('click', function () {
        header.classList.remove('nav-open');
      });
    });
  }

  // Mobile dropdown toggle (Hizmetler)
  document.querySelectorAll('.has-dropdown > a').forEach(function (trigger) {
    trigger.addEventListener('click', function (e) {
      if (window.innerWidth > 760) return;
      e.preventDefault();
      trigger.parentElement.classList.toggle('open');
    });
  });

  // FAQ accordion
  document.querySelectorAll('.faq-item').forEach(function (item) {
    var question = item.querySelector('.faq-question');
    var answer = item.querySelector('.faq-answer');
    if (!question || !answer) return;
    question.addEventListener('click', function () {
      var isActive = item.classList.contains('active');
      document.querySelectorAll('.faq-item.active').forEach(function (openItem) {
        if (openItem !== item) {
          openItem.classList.remove('active');
          openItem.querySelector('.faq-answer').style.maxHeight = null;
        }
      });
      if (isActive) {
        item.classList.remove('active');
        answer.style.maxHeight = null;
      } else {
        item.classList.add('active');
        answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  });

  // Footer year
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});
