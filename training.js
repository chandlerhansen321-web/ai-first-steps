/* =====================================================================
   TRAINING PAGE v2 — JavaScript
   ===================================================================== */

// =====================================================================
// THEME TOGGLE
// =====================================================================
function toggleTheme() {
  var html = document.documentElement;
  var btn = document.getElementById('theme-toggle');
  if (html.getAttribute('data-theme') === 'dark') {
    html.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
    btn.textContent = '\u{1F319}';
  } else {
    html.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
    btn.textContent = '\u{2600}\u{FE0F}';
  }
}

(function() {
  var saved = localStorage.getItem('theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    var btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = '\u{2600}\u{FE0F}';
  }
})();

// =====================================================================
// SCROLL PROGRESS BAR
// =====================================================================
(function() {
  var bar = document.getElementById('progress-bar');
  if (!bar) return;

  function update() {
    var scrollTop = window.scrollY;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    var pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width = pct + '%';
  }

  window.addEventListener('scroll', update, { passive: true });
  update();
})();

// =====================================================================
// ROLE TOGGLE
// =====================================================================
function setRole(role) {
  document.body.setAttribute('data-role', role);
  localStorage.setItem('training_role', role);

  document.querySelectorAll('.t-role-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.getAttribute('data-role') === role);
  });
}

(function() {
  var saved = localStorage.getItem('training_role');
  if (saved && ['sales', 'strategy', 'marketing'].indexOf(saved) !== -1) {
    setRole(saved);
  }
})();

// =====================================================================
// SIDEBAR SCROLL TRACKING
// =====================================================================
(function() {
  var sections = [];
  var sidebarLinks = [];

  function init() {
    sidebarLinks = document.querySelectorAll('.t-sidebar ul li a');
    sections = [];
    sidebarLinks.forEach(function(link) {
      var href = link.getAttribute('href');
      if (href && href.startsWith('#')) {
        var el = document.getElementById(href.substring(1));
        if (el) sections.push({ el: el, link: link });
      }
    });
  }

  function onScroll() {
    var scrollY = window.scrollY + 120;
    var active = null;

    for (var i = sections.length - 1; i >= 0; i--) {
      if (sections[i].el.offsetTop <= scrollY) {
        active = sections[i];
        break;
      }
    }

    sidebarLinks.forEach(function(link) { link.classList.remove('active'); });
    if (active) active.link.classList.add('active');
  }

  document.addEventListener('DOMContentLoaded', function() {
    init();
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  });
})();

// =====================================================================
// CALENDAR DAY TOGGLE
// =====================================================================
function toggleCalDay(el) {
  var wasOpen = el.classList.contains('open');
  // Close all
  document.querySelectorAll('.t-cal-day').forEach(function(d) {
    d.classList.remove('open');
  });
  // Toggle clicked
  if (!wasOpen) el.classList.add('open');
}

// =====================================================================
// QUIZ ENGINE
// =====================================================================
function checkQuiz(quizId, btn, isCorrect) {
  var quiz = document.getElementById(quizId);
  if (!quiz) return;

  // Disable all options
  quiz.querySelectorAll('.t-quiz-opt').forEach(function(opt) {
    opt.classList.add('disabled');
  });

  if (isCorrect) {
    btn.classList.add('correct');
    showQuizFeedback(quiz, true);
  } else {
    btn.classList.add('wrong');
    // Highlight the correct one
    quiz.querySelectorAll('.t-quiz-opt').forEach(function(opt) {
      // Find the correct one by checking its onclick
      if (opt.getAttribute('onclick') && opt.getAttribute('onclick').indexOf('true') !== -1) {
        opt.classList.add('correct');
      }
    });
    showQuizFeedback(quiz, false);
  }
}

function showQuizFeedback(quiz, correct) {
  var fb = quiz.querySelector('.t-quiz-feedback');
  if (!fb) return;

  if (correct) {
    fb.innerHTML = '<strong style="color:var(--green);">Correct.</strong> That\'s the multiplier effect in action.';
  } else {
    fb.innerHTML = '<strong style="color:var(--yellow);">Not quite.</strong> Check the highlighted answer above.';
  }
  fb.classList.add('show');
}

// =====================================================================
// COPY PROMPT
// =====================================================================
function copyPrompt(el) {
  var text = el.textContent.trim();
  navigator.clipboard.writeText(text).then(function() {
    var copied = el.parentElement.querySelector('.t-prompt-copied');
    if (copied) {
      copied.classList.add('show');
      setTimeout(function() { copied.classList.remove('show'); }, 2000);
    }
  });
}

// =====================================================================
// MULTIPLIER ANIMATION (IntersectionObserver)
// =====================================================================
(function() {
  var mult = document.getElementById('multiplier-visual');
  if (!mult) return;

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  observer.observe(mult);
})();

// =====================================================================
// DECISION TREE
// =====================================================================
var dtState = {};

var dtResults = {
  'yes-yes': {
    title: 'Claude Code \u2014 100%',
    desc: 'Files + repeatable = Claude Code territory. Set up a CLAUDE.md with your project context. Build it once, reuse it every time.'
  },
  'yes-no': {
    title: 'Claude Code',
    desc: 'Even one-time file work is faster in Claude Code. It reads the files directly. No copy-pasting into a chat window.'
  },
  'no-quick': {
    title: 'Claude Chat (Browser)',
    desc: 'Quick question, no files. Browser chat works. Keep it focused: one question, one answer, done.'
  },
  'no-extended': {
    title: 'Consider Claude Code',
    desc: 'Extended sessions burn tokens fast in browser chat because you re-explain context every message. Claude Code with a CLAUDE.md file gives Claude persistent memory. Worth the switch even without files.'
  }
};

function dtAnswer(step, answer) {
  dtState[step] = answer;
  document.querySelector('.t-dt-question[data-dt-step="' + step + '"]').classList.remove('active');

  if (step === 0 && answer === 'yes') {
    document.querySelector('.t-dt-question[data-dt-step="1"]').classList.add('active');
  } else if (step === 0 && answer === 'no') {
    document.querySelector('.t-dt-question[data-dt-step="2"]').classList.add('active');
  } else {
    var key = step === 1 ? 'yes-' + answer : 'no-' + answer;
    var result = dtResults[key];
    var el = document.getElementById('dt-result');
    el.innerHTML = '<div class="t-dt-result-card"><h4>' + result.title + '</h4><p>' + result.desc + '</p></div>';
    el.classList.add('active');
    document.getElementById('dt-reset').style.display = 'inline-block';
  }
}

function dtReset() {
  dtState = {};
  document.querySelectorAll('.t-dt-question').forEach(function(q) { q.classList.remove('active'); });
  document.querySelector('.t-dt-question[data-dt-step="0"]').classList.add('active');
  var el = document.getElementById('dt-result');
  el.classList.remove('active');
  el.innerHTML = '';
  document.getElementById('dt-reset').style.display = 'none';
}

// =====================================================================
// SMOOTH SCROLL
// =====================================================================
document.addEventListener('click', function(e) {
  var link = e.target.closest('a[href^="#"]');
  if (link) {
    var target = document.getElementById(link.getAttribute('href').substring(1));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  }
});
