/* =====================================================================
   TRAINING PAGE — JavaScript
   Role toggle, sidebar scroll tracking, expandables, pipeline flow,
   decision tree, theme toggle
   ===================================================================== */

// =====================================================================
// THEME TOGGLE (same as main site)
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

// Restore theme on load
(function() {
  var saved = localStorage.getItem('theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    var btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = '\u{2600}\u{FE0F}';
  }
})();

// =====================================================================
// ROLE TOGGLE
// =====================================================================
function setRole(role) {
  document.body.setAttribute('data-role', role);
  localStorage.setItem('training_role', role);

  // Update all toggle buttons
  document.querySelectorAll('.t-role-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.getAttribute('data-role') === role);
  });
}

// Restore role on load
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

    sidebarLinks.forEach(function(link) {
      link.classList.remove('active');
    });

    if (active) {
      active.link.classList.add('active');
    }
  }

  document.addEventListener('DOMContentLoaded', function() {
    init();
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  });
})();

// =====================================================================
// EXPANDABLE CARDS
// =====================================================================
function toggleExpand(el) {
  el.classList.toggle('open');
}

// =====================================================================
// PIPELINE FLOW (Interactive step-through)
// =====================================================================
var currentPipelineStep = 0;
var totalPipelineSteps = 8;

function setPipelineStep(n) {
  currentPipelineStep = n;

  // Update step highlights
  document.querySelectorAll('.t-pipeline-step').forEach(function(step) {
    step.classList.toggle('active', parseInt(step.getAttribute('data-pipeline-step')) === n);
  });

  // Update detail panel
  document.querySelectorAll('.t-pipeline-detail-inner').forEach(function(detail) {
    detail.style.display = parseInt(detail.getAttribute('data-detail')) === n ? 'block' : 'none';
  });

  // Update nav buttons
  var prev = document.getElementById('pipeline-prev');
  var next = document.getElementById('pipeline-next');
  var counter = document.getElementById('pipeline-counter');

  if (prev) prev.disabled = n === 0;
  if (next) next.disabled = n === totalPipelineSteps - 1;
  if (counter) counter.textContent = (n + 1) + ' of ' + totalPipelineSteps;

  // Scroll the active step into view in the flow
  var activeStep = document.querySelector('.t-pipeline-step.active');
  if (activeStep) {
    activeStep.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
}

function stepPipeline(dir) {
  var next = currentPipelineStep + dir;
  if (next >= 0 && next < totalPipelineSteps) {
    setPipelineStep(next);
  }
}

// =====================================================================
// DECISION TREE
// =====================================================================
var dtState = {};

var dtResults = {
  // files=yes
  'yes-yes': {
    title: 'Claude Code — absolutely',
    desc: 'You\'re working with files AND you\'ll do this again. Claude Code reads your project context automatically and can build reusable workflows. Set up a CLAUDE.md file once and every future session starts with full context.'
  },
  'yes-no': {
    title: 'Claude Code',
    desc: 'Even for one-time file-based work, Claude Code is more efficient. It reads the files directly instead of you copy-pasting content into chat. Open it in your project folder and describe what you need.'
  },
  // files=no
  'no-quick': {
    title: 'Claude Chat (Browser)',
    desc: 'Quick question, no files needed — browser chat is perfect. Keep it focused: one clear question, get your answer, move on. No need to set up a project context for a simple question.'
  },
  'no-extended': {
    title: 'Consider Claude Code',
    desc: 'Extended work sessions burn through tokens fast in browser chat because you keep re-explaining context. Even without files, Claude Code with a CLAUDE.md gives Claude persistent memory of your role and preferences. Worth the switch.'
  }
};

function dtAnswer(step, answer) {
  dtState[step] = answer;

  // Hide current question
  document.querySelector('.t-dt-question[data-dt-step="' + step + '"]').classList.remove('active');

  if (step === 0 && answer === 'yes') {
    // Go to question 1 (repeatable?)
    document.querySelector('.t-dt-question[data-dt-step="1"]').classList.add('active');
  } else if (step === 0 && answer === 'no') {
    // Go to question 2 (quick or extended?)
    document.querySelector('.t-dt-question[data-dt-step="2"]').classList.add('active');
  } else {
    // Show result
    var key;
    if (step === 1) {
      key = 'yes-' + answer;
    } else {
      key = 'no-' + answer;
    }

    var result = dtResults[key];
    var el = document.getElementById('dt-result');
    el.innerHTML = '<div class="t-dt-result-card"><h4>' + result.title + '</h4><p>' + result.desc + '</p></div>';
    el.classList.add('active');
    document.getElementById('dt-reset').style.display = 'inline-block';
  }
}

function dtReset() {
  dtState = {};

  // Reset all questions
  document.querySelectorAll('.t-dt-question').forEach(function(q) {
    q.classList.remove('active');
  });

  // Show first question
  document.querySelector('.t-dt-question[data-dt-step="0"]').classList.add('active');

  // Hide result
  var el = document.getElementById('dt-result');
  el.classList.remove('active');
  el.innerHTML = '';
  document.getElementById('dt-reset').style.display = 'none';
}

// =====================================================================
// SMOOTH SCROLL FOR ANCHOR LINKS
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
