// =====================================================================
// STATE
// =====================================================================
var currentStep = 0;
var selectedProject = null;
var unlockedConcepts = new Set();
var customPrompt = null;
var storedSession1 = null;
var storedSession2 = null;
var chatHistories = {}; // keyed by containerId

var stepLabels = ['Welcome', 'How AI Works', 'Core Concepts', 'Prompt Engineering', 'Project Picker', 'Build 1/3', 'Build 2/3', 'Build 3/3', 'Launch'];
var API_URL = '/api/chat';

// =====================================================================
// PROGRESS PERSISTENCE
// =====================================================================
function saveProgress() {
  try {
    localStorage.setItem('aifs_progress', JSON.stringify({
      currentStep: currentStep,
      selectedProject: selectedProject,
      customPrompt: customPrompt,
      timestamp: Date.now()
    }));
  } catch(e) {}
}

function loadProgress() {
  try {
    var saved = localStorage.getItem('aifs_progress');
    if (!saved) return null;
    var data = JSON.parse(saved);
    // Expire after 7 days
    if (Date.now() - data.timestamp > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem('aifs_progress');
      return null;
    }
    return data;
  } catch(e) { return null; }
}

function clearProgress() {
  localStorage.removeItem('aifs_progress');
}

function showResumeBanner(data) {
  var banner = document.createElement('div');
  banner.className = 'resume-banner';
  banner.id = 'resume-banner';
  banner.innerHTML = '<span>You were on Step ' + data.currentStep + ': ' + (stepLabels[data.currentStep] || '') + '</span>'
    + '<button onclick="resumeProgress()">Resume</button>'
    + '<button class="dismiss-btn" onclick="dismissResume()">Start over</button>';
  var track = document.getElementById('track-ai');
  var firstStep = track ? track.querySelector('.step.active') : null;
  if (firstStep) {
    var inner = firstStep.querySelector('.page-inner');
    if (inner) inner.insertBefore(banner, inner.firstChild);
  }
}

function resumeProgress() {
  var data = loadProgress();
  if (!data) return;
  if (data.selectedProject) {
    selectedProject = data.selectedProject;
    customPrompt = data.customPrompt || null;
    // Mark the project as selected visually
    var option = document.querySelector('.project-option[data-project="' + data.selectedProject + '"]');
    if (option) option.classList.add('selected');
    var btn = document.getElementById('picker-next');
    if (btn) btn.disabled = false;
  }
  var banner = document.getElementById('resume-banner');
  if (banner) banner.remove();
  goToStep(data.currentStep);
}

function dismissResume() {
  clearProgress();
  var banner = document.getElementById('resume-banner');
  if (banner) banner.remove();
}

// =====================================================================
// ANALYTICS EVENTS
// =====================================================================
function trackEvent(name, props) {
  try {
    // Vercel Web Analytics custom events
    if (window.va) {
      window.va('event', { name: name, data: props });
    }
  } catch(e) {}
}

// =====================================================================
// QUIZ CHECKPOINTS
// =====================================================================
var quizAnswered = {};

function checkQuiz(quizId, btn, isCorrect) {
  if (quizAnswered[quizId]) return;

  var options = btn.parentElement.querySelectorAll('.quiz-option');
  options.forEach(function(o) { o.style.pointerEvents = 'none'; });

  if (isCorrect) {
    btn.classList.add('correct');
    quizAnswered[quizId] = true;
  } else {
    btn.classList.add('wrong');
    setTimeout(function() {
      btn.classList.remove('wrong');
      options.forEach(function(o) { o.style.pointerEvents = ''; });
    }, 1200);
    return;
  }

  // Check if all quizzes in this step are answered
  var step = btn.closest('.step');
  if (!step) return;
  var allQuizzes = step.querySelectorAll('.quiz-gate');
  var allAnswered = true;
  allQuizzes.forEach(function(q) {
    if (!quizAnswered[q.dataset.quiz]) allAnswered = false;
  });

  if (allAnswered) {
    var result = step.querySelector('.quiz-result');
    if (result) {
      result.classList.add('pass');
      result.textContent = 'All correct! You can continue.';
    }
    // Enable the next button if it was disabled by quiz
    var nextBtn = step.querySelector('.quiz-next');
    if (nextBtn) nextBtn.disabled = false;
  }
}

// =====================================================================
// PROJECT DATA
// =====================================================================
function makeBuild2Session(opts) {
  return function(prompt) {
    var p = prompt || '';
    var pShort = p.length > 48 ? p.substring(0,48) + '\u2026' : p;
    return [
      { type: 'user', text: opts.userText },
      { type: 'tool', verb: '✎ Editing', file: opts.filename, diffs: [
        { add: true, code: '<span class="cc-kw">async function</span> <span class="cc-fn">' + opts.fnName + '</span>(<span class="cc-var">' + opts.param + '</span>) {' },
        { add: true, code: '  system: <span class="cc-str">"<span class="cc-editable-prompt" onclick="openEditPrompt(\'' + escapeAttr(p) + '\')">' + escapeHtml(pShort) + '</span>"</span>,' },
        { add: true, code: '}' }
      ]},
      { type: 'done', text: opts.doneMsg }
    ];
  };
}

var projects = {
  journal: {
    name: 'AI Journal Buddy',
    filename: 'journal.js',
    lines: 18,
    liveLabel: 'AI Journal Buddy — write an entry below',
    launchEmoji: '📓',
    build1: {
      desc: 'Every project starts by importing the tools it needs and setting up the connection to Claude\'s AI.',
      tip: 'We\'re importing the Anthropic SDK and creating a client object — the connection to Claude\'s API. Think of it as plugging in your appliances before you start cooking.',
      ccSession: [
        { type: 'user', text: 'create journal.js and connect it to the Claude API' },
        { type: 'tool', verb: '✎ Creating', file: 'journal.js', diffs: [
          { add: true, code: '<span class="cc-cm">// AI Journal Buddy</span>' },
          { add: true, code: '<span class="cc-kw">import</span> Anthropic <span class="cc-kw">from</span> <span class="cc-str">"@anthropic-ai/sdk"</span>;' },
          { add: true, code: '<span class="cc-kw">const</span> <span class="cc-var">client</span> = <span class="cc-kw">new</span> <span class="cc-fn">Anthropic</span>();' }
        ]},
        { type: 'done', text: 'journal.js created — Claude API connected.' }
      ]
    },
    build2: {
      title: 'The brain of your journal',
      desc: 'This function takes your journal entry, sends it to Claude with a thoughtful prompt, and returns a warm reflection.',
      tip: 'See the highlighted text in the code? That\'s the system prompt — the invisible instructions that shape AI\'s personality. Click it to customize.',
      defaultPrompt: 'You are a warm, thoughtful journal companion. Read this entry and offer a gentle reflection — notice patterns, ask one follow-up question, and end with encouragement.',
      ccSession: makeBuild2Session({
        userText: 'add a reflect() function that sends entries to Claude',
        fnName: 'reflect',
        param: 'entry',
        filename: 'journal.js',
        doneMsg: 'reflect() added — click the orange prompt to customize it.'
      })
    }
  },
  summarizer: {
    name: 'AI Summarizer',
    filename: 'summarizer.js',
    lines: 20,
    liveLabel: 'AI Summarizer — paste any text on the left',
    launchEmoji: '📋',
    build1: {
      desc: 'We start by connecting to the Claude API — the bridge between your code and AI.',
      tip: 'We\'re importing the Anthropic SDK and creating a client object — the connection to Claude\'s API. Think of it as plugging in your appliances before you start cooking.',
      ccSession: [
        { type: 'user', text: 'create summarizer.js and connect it to the Claude API' },
        { type: 'tool', verb: '✎ Creating', file: 'summarizer.js', diffs: [
          { add: true, code: '<span class="cc-cm">// Text Summarizer</span>' },
          { add: true, code: '<span class="cc-kw">import</span> Anthropic <span class="cc-kw">from</span> <span class="cc-str">"@anthropic-ai/sdk"</span>;' },
          { add: true, code: '<span class="cc-kw">const</span> <span class="cc-var">client</span> = <span class="cc-kw">new</span> <span class="cc-fn">Anthropic</span>();' }
        ]},
        { type: 'done', text: 'summarizer.js created — Claude API connected.' }
      ]
    },
    build2: {
      title: 'The summarization engine',
      desc: 'This function takes any text and asks Claude to distill it into clean, scannable bullet points.',
      tip: 'See the highlighted text in the code? That\'s the system prompt — the invisible instructions that shape AI\'s personality. Click it to customize.',
      defaultPrompt: 'Summarize the following text into 3-5 concise bullet points. Focus on key facts and takeaways. Be clear and specific.',
      ccSession: makeBuild2Session({
        userText: 'add a summarize() function that returns bullet points',
        fnName: 'summarize',
        param: 'text',
        filename: 'summarizer.js',
        doneMsg: 'summarize() added — click the orange prompt to customize it.'
      })
    }
  },
  rewriter: {
    name: 'AI Text Rewriter',
    filename: 'rewriter.js',
    lines: 20,
    liveLabel: 'AI Text Rewriter — paste text and pick a tone',
    launchEmoji: '✏️',
    build1: {
      desc: 'Start by creating rewriter.js and connecting to the Anthropic SDK. This tool will take any text and rewrite it in whatever tone you choose.',
      tip: 'We\'re importing the Anthropic SDK and creating a client object — the connection to Claude\'s API. Think of it as plugging in your appliances before you start cooking.',
      ccSession: [
        { type: 'user', text: 'create rewriter.js and connect it to the Anthropic SDK' },
        { type: 'tool', verb: '✎ Creating', file: 'rewriter.js', diffs: [
          { add: true, code: '<span class="cc-cm">// AI Text Rewriter</span>' },
          { add: true, code: '<span class="cc-kw">import</span> Anthropic <span class="cc-kw">from</span> <span class="cc-str">"@anthropic-ai/sdk"</span>;' },
          { add: true, code: '<span class="cc-kw">const</span> <span class="cc-var">client</span> = <span class="cc-kw">new</span> <span class="cc-fn">Anthropic</span>();' }
        ]},
        { type: 'done', text: 'rewriter.js created — Anthropic SDK connected.' }
      ]
    },
    build2: {
      title: 'The rewriting engine',
      desc: 'This function takes text and a tone, then asks Claude to rewrite it — keeping the meaning but changing the style completely.',
      tip: 'See the highlighted text in the code? That\'s the system prompt — the invisible instructions that shape AI\'s personality. Click it to customize.',
      defaultPrompt: 'You are an expert editor. Rewrite the given text in the requested tone while preserving the core meaning. Be natural, not robotic. Match the energy of the requested tone precisely.',
      ccSession: makeBuild2Session({
        userText: 'add a rewrite(text, tone) function that rewrites in the given tone',
        fnName: 'rewrite',
        param: 'text</span>, <span class="cc-var">tone',
        filename: 'rewriter.js',
        doneMsg: 'rewrite() added — click the orange prompt to customize it.'
      })
    }
  },
  freeform: {
    name: 'Your AI App',
    filename: 'app.js',
    lines: 20,
    liveLabel: 'Your AI App — try it out',
    launchEmoji: '💡',
    build1: {
      desc: 'Every Claude Code project starts the same way — connect to the API and you\'re ready to build anything.',
      tip: 'We\'re importing the Anthropic SDK and creating a client object — the connection to Claude\'s API. Think of it as plugging in your appliances before you start cooking.',
      ccSession: [
        { type: 'user', text: 'create app.js with a Claude API connection' },
        { type: 'tool', verb: '✎ Creating', file: 'app.js', diffs: [
          { add: true, code: '<span class="cc-cm">// Your AI App</span>' },
          { add: true, code: '<span class="cc-kw">import</span> Anthropic <span class="cc-kw">from</span> <span class="cc-str">"@anthropic-ai/sdk"</span>;' },
          { add: true, code: '<span class="cc-kw">const</span> <span class="cc-var">client</span> = <span class="cc-kw">new</span> <span class="cc-fn">Anthropic</span>();' }
        ]},
        { type: 'done', text: 'app.js created — Claude API ready.' }
      ]
    },
    build2: {
      title: 'Your AI logic',
      desc: 'The core function that sends user input to Claude and returns a response. This is the engine of your app.',
      tip: 'See the highlighted text in the code? That\'s the system prompt — the invisible instructions that shape AI\'s personality. Click it to customize.',
      defaultPrompt: 'You are a helpful AI assistant. Be friendly, concise, and helpful.',
      ccSession: makeBuild2Session({
        userText: 'add a chat() function that calls Claude with my system prompt',
        fnName: 'chat',
        param: 'input',
        filename: 'app.js',
        doneMsg: 'chat() added — click the orange prompt to make it yours.'
      })
    }
  },
  landingpage: {
    name: 'Landing Page Builder',
    filename: 'landingpage.js',
    lines: 22,
    liveLabel: 'Landing Page Builder — describe your product',
    launchEmoji: '🌐',
    build1: {
      desc: 'Start by creating landingpage.js and connecting to the Claude API. This tool generates complete, ready-to-open HTML pages.',
      tip: 'We\'re importing the Anthropic SDK and creating a client object — the connection to Claude\'s API. Think of it as plugging in your appliances before you start cooking.',
      ccSession: [
        { type: 'user', text: 'create landingpage.js and connect it to the Claude API' },
        { type: 'tool', verb: '✎ Creating', file: 'landingpage.js', diffs: [
          { add: true, code: '<span class="cc-cm">// Landing Page Builder</span>' },
          { add: true, code: '<span class="cc-kw">import</span> Anthropic <span class="cc-kw">from</span> <span class="cc-str">"@anthropic-ai/sdk"</span>;' },
          { add: true, code: '<span class="cc-kw">const</span> <span class="cc-var">client</span> = <span class="cc-kw">new</span> <span class="cc-fn">Anthropic</span>();' }
        ]},
        { type: 'done', text: 'landingpage.js created — Claude API connected.' }
      ]
    },
    build2: {
      title: 'The page generator',
      desc: 'This function takes a product description and generates a complete HTML landing page — hero, features, CTA, and all.',
      tip: 'See the highlighted text in the code? That\'s the system prompt — it tells Claude what kind of page to build. Click it to customize.',
      defaultPrompt: 'You are a landing page designer. Given a product description, generate a complete, beautiful HTML page with inline CSS. Include: a hero section with headline and subheadline, a features grid (3-4 features with icons using emoji), a testimonial quote, and a call-to-action button. Use a modern, clean design with a professional color scheme. The page must be fully self-contained HTML that works when opened directly in a browser. Do not use any external dependencies. Return ONLY the HTML code, no explanation.',
      ccSession: makeBuild2Session({
        userText: 'add a generatePage() function that returns a complete HTML landing page',
        fnName: 'generatePage',
        param: 'description',
        filename: 'landingpage.js',
        doneMsg: 'generatePage() added — click the orange prompt to customize it.'
      })
    }
  },
  socialmedia: {
    name: 'Social Media Post Pack',
    filename: 'socialmedia.js',
    lines: 22,
    liveLabel: 'Social Media Post Pack — describe what to promote',
    launchEmoji: '📱',
    build1: {
      desc: 'Start by creating socialmedia.js and connecting to the Claude API. This tool generates a full set of platform-specific posts.',
      tip: 'We\'re importing the Anthropic SDK and creating a client object — the connection to Claude\'s API. Think of it as plugging in your appliances before you start cooking.',
      ccSession: [
        { type: 'user', text: 'create socialmedia.js and connect it to the Claude API' },
        { type: 'tool', verb: '✎ Creating', file: 'socialmedia.js', diffs: [
          { add: true, code: '<span class="cc-cm">// Social Media Post Pack</span>' },
          { add: true, code: '<span class="cc-kw">import</span> Anthropic <span class="cc-kw">from</span> <span class="cc-str">"@anthropic-ai/sdk"</span>;' },
          { add: true, code: '<span class="cc-kw">const</span> <span class="cc-var">client</span> = <span class="cc-kw">new</span> <span class="cc-fn">Anthropic</span>();' }
        ]},
        { type: 'done', text: 'socialmedia.js created — Claude API connected.' }
      ]
    },
    build2: {
      title: 'The post generator',
      desc: 'This function takes a product or event description and generates ready-to-post content for every major platform.',
      tip: 'See the highlighted text in the code? That\'s the system prompt — it controls the voice and format of every post. Click it to customize.',
      defaultPrompt: 'You are a social media strategist. Given a description, generate 5 platform-specific posts. Format your response EXACTLY like this, with each section separated by ---:\n\nTWITTER\n[short punchy post, under 280 chars, with 2-3 hashtags]\n---\nLINKEDIN\n[professional 3-4 sentence post with a hook opening]\n---\nINSTAGRAM\n[engaging caption with emoji, line breaks for readability, 5 hashtags at the end]\n---\nFACEBOOK\n[conversational 2-3 sentence post with a question to drive engagement]\n---\nTHREADS\n[casual, authentic post with emoji, conversational tone]',
      ccSession: makeBuild2Session({
        userText: 'add a generatePosts() function that returns posts for every platform',
        fnName: 'generatePosts',
        param: 'description',
        filename: 'socialmedia.js',
        doneMsg: 'generatePosts() added — click the orange prompt to customize it.'
      })
    }
  },
  calculator: {
    name: 'Calculator Builder',
    filename: 'calculator.js',
    lines: 22,
    liveLabel: 'Calculator Builder — describe what to calculate',
    launchEmoji: '🧮',
    build1: {
      desc: 'Start by creating calculator.js and connecting to the Claude API. This tool generates working HTML calculators and forms.',
      tip: 'We\'re importing the Anthropic SDK and creating a client object — the connection to Claude\'s API. Think of it as plugging in your appliances before you start cooking.',
      ccSession: [
        { type: 'user', text: 'create calculator.js and connect it to the Claude API' },
        { type: 'tool', verb: '✎ Creating', file: 'calculator.js', diffs: [
          { add: true, code: '<span class="cc-cm">// Calculator Builder</span>' },
          { add: true, code: '<span class="cc-kw">import</span> Anthropic <span class="cc-kw">from</span> <span class="cc-str">"@anthropic-ai/sdk"</span>;' },
          { add: true, code: '<span class="cc-kw">const</span> <span class="cc-var">client</span> = <span class="cc-kw">new</span> <span class="cc-fn">Anthropic</span>();' }
        ]},
        { type: 'done', text: 'calculator.js created — Claude API connected.' }
      ]
    },
    build2: {
      title: 'The calculator engine',
      desc: 'This function takes a description of what you need to calculate and generates a fully interactive HTML calculator.',
      tip: 'See the highlighted text in the code? That\'s the system prompt — it tells Claude what kind of calculator to build. Click it to customize.',
      defaultPrompt: 'You are a calculator builder. Given a description, generate a complete, interactive HTML calculator with inline CSS and JavaScript. The calculator should have labeled input fields, a calculate button, and a clear results display. Use a clean, modern design with rounded corners and a professional color scheme. The page must be fully self-contained HTML that works when opened directly in a browser. Do not use any external dependencies. Return ONLY the HTML code, no explanation.',
      ccSession: makeBuild2Session({
        userText: 'add a buildCalculator() function that returns a working HTML calculator',
        fnName: 'buildCalculator',
        param: 'description',
        filename: 'calculator.js',
        doneMsg: 'buildCalculator() added — click the orange prompt to customize it.'
      })
    }
  }
};

// =====================================================================
// THEME
// =====================================================================
function toggleTheme() {
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  var next = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  document.getElementById('theme-toggle').textContent = next === 'dark' ? '☀️' : '🌙';
}

// =====================================================================
// TRACK SWITCHING
// =====================================================================
function switchTrack(track) {
  document.querySelectorAll('.track').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.track-tab').forEach(function(b) { b.classList.remove('active'); });
  document.getElementById('track-' + track).classList.add('active');
  document.getElementById('tab-' + track).classList.add('active');

  var wizardProgress = document.getElementById('wizard-progress');
  if (wizardProgress) wizardProgress.style.visibility = track === 'ai' ? 'visible' : 'hidden';

  if (track === 'claude') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  trackEvent('track_switched', { track: track });
}

// =====================================================================
// WIZARD NAVIGATION
// =====================================================================
function goToStep(n) {
  var prevStep = currentStep;
  document.querySelectorAll('#track-ai .step').forEach(function(s) { s.classList.remove('active'); });
  var target = document.querySelector('#track-ai .step[data-step="' + n + '"]');
  if (target) target.classList.add('active');
  currentStep = n;

  // Update progress bar
  document.querySelectorAll('.progress-step').forEach(function(dot, i) {
    dot.classList.remove('active', 'done', 'pulse');
    if (i === n) dot.classList.add('active');
    else if (i < n) dot.classList.add('done');
  });
  var fill = document.getElementById('progress-fill');
  if (fill) fill.style.width = (n / 8 * 100) + '%';
  var lbl = document.getElementById('wizard-step-label');
  if (lbl) lbl.textContent = stepLabels[n] || '';

  // Micro-celebrations
  if (n > prevStep && prevStep >= 0) {
    var prevDot = document.querySelector('.progress-step[data-step="' + prevStep + '"]');
    if (prevDot) { prevDot.classList.add('pulse'); }
    var toastMessages = {
      1: null, // no toast for leaving welcome
      2: 'Section complete!',
      3: 'Concepts unlocked!',
      4: 'Quiz passed — nice work!',
      5: null, // project picked, toast handled in selectProject
      6: 'Build step complete!',
      7: 'Build step complete!',
      8: 'You built it!'
    };
    var msg = toastMessages[n];
    if (msg) showToast(msg);
  }

  if (n >= 5 && n <= 7 && selectedProject) {
    populateBuildStep(n);
  }
  if (n === 8 && selectedProject) {
    populateLaunch();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });

  trackEvent('step_reached', { step: n, label: stepLabels[n] });
  saveProgress();
}

function showToast(message, duration) {
  var container = document.getElementById('toast-container');
  if (!container) return;
  var toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(function() {
    toast.classList.add('leaving');
    setTimeout(function() { toast.remove(); }, 300);
  }, duration || 2500);
}

// =====================================================================
// CONCEPTS
// =====================================================================
function expandConcept(card) {
  var wasExpanded = card.classList.contains('expanded');
  if (!wasExpanded) {
    card.classList.add('expanded');
    unlockedConcepts.add(card.dataset.concept);
  } else {
    card.classList.remove('expanded');
  }
  var progress = document.getElementById('concepts-progress');
  if (progress) progress.textContent = unlockedConcepts.size + ' of 6';
  if (unlockedConcepts.size >= 6) {
    var btn = document.getElementById('concepts-next');
    if (btn) { btn.disabled = false; }
  }
}

// =====================================================================
// PROJECT SELECTION
// =====================================================================
function selectProject(id) {
  selectedProject = id;
  customPrompt = null;
  storedSession1 = null;
  storedSession2 = null;
  document.querySelectorAll('.project-option').forEach(function(o) { o.classList.remove('selected'); });
  var option = document.querySelector('.project-option[data-project="' + id + '"]');
  if (option) option.classList.add('selected');
  var btn = document.getElementById('picker-next');
  if (btn) btn.disabled = false;

  trackEvent('project_selected', { project: id });
  saveProgress();
}

function startBuild() {
  if (!selectedProject) return;
  goToStep(5);
}

// =====================================================================
// BUILD — CC SESSION RENDERING
// =====================================================================
function renderItem(item) {
  if (item.type === 'user') {
    return '<div class="cc-user-row"><span class="cc-chevron">&gt;</span><span class="cc-user-text">' + escapeHtml(item.text) + '</span></div>';
  } else if (item.type === 'tool') {
    var diffs = '';
    item.diffs.forEach(function(d) {
      var rc = d.add ? 'add' : '';
      var sign = d.add ? '+' : '&nbsp;';
      diffs += '<div class="cc-diff-row ' + rc + '"><span class="cc-sign">' + sign + '</span><span class="cc-code">' + d.code + '</span></div>';
    });
    return '<div class="cc-tool-block"><div class="cc-tool-header"><span class="cc-tool-verb">' + escapeHtml(item.verb) + '</span><span class="cc-tool-file">' + escapeHtml(item.file) + '</span></div><div class="cc-diff-area">' + diffs + '</div></div>';
  } else if (item.type === 'done') {
    return '<div class="cc-done-row">&#10003; ' + escapeHtml(item.text) + '</div>';
  }
  return '';
}

function renderCCSession(containerId, items) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var html = '<div class="cc-session"><div class="cc-toolbar"><div class="cc-dots"><span></span><span></span><span></span></div><span class="cc-title">Claude Code</span></div><div class="cc-body">';
  items.forEach(function(item) { html += renderItem(item); });
  html += '</div></div>';
  container.innerHTML = html;
}

function renderCCInput(containerId, stepNum) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var proj = projects[selectedProject] || {};
  var suggestion;
  if (stepNum === 5) {
    var session = proj.build1 && proj.build1.ccSession;
    var ex = null;
    if (Array.isArray(session)) {
      var userItem = session.find(function(m) { return m.type === 'user'; });
      ex = userItem ? userItem.text : null;
    }
    suggestion = ex || 'create a file and connect it to the Anthropic SDK';
  } else {
    var hints = {
      journal: 'add a reflect() function that takes a journal entry and returns an AI reflection',
      summarizer: 'add a summarize() function that takes text and returns 3 bullet points',
      rewriter: 'add a rewrite(text, tone) function that returns the rewritten version',
      freeform: 'add a chat() function that takes user input and returns an AI response',
      landingpage: 'add a generatePage() function that returns a complete HTML landing page',
      socialmedia: 'add a generatePosts() function that returns posts for every platform',
      calculator: 'add a buildCalculator() function that returns a working HTML calculator'
    };
    suggestion = hints[selectedProject] || 'add a function that takes input and returns an AI response';
  }
  var safeId = containerId.replace(/[^a-zA-Z0-9_-]/g, '');
  container.innerHTML = '<div class="cc-session" style="display:flex;flex-direction:column;">'
    + '<div class="cc-toolbar"><div class="cc-dots"><span></span><span></span><span></span></div><span class="cc-title">Claude Code</span></div>'
    + '<div class="cc-body" id="' + containerId + '-body">'
    + '<div class="cc-suggestion-hint"><span class="cc-suggestion-label">Try &rarr;</span>'
    + '<span class="cc-suggestion-text" onclick="useSuggestion(\'' + safeId + '\')">' + escapeHtml(suggestion) + '</span>'
    + '</div></div>'
    + '<div class="cc-input-row" id="' + containerId + '-input-row">'
    + '<span class="cc-input-chevron">&gt;</span>'
    + '<input type="text" class="cc-prompt-field" id="' + containerId + '-input" placeholder="Describe what to build..." '
    + 'onkeydown="if(event.key===\'Enter\')submitCCPrompt(' + stepNum + ')">'
    + '<button class="cc-submit-btn" onclick="submitCCPrompt(' + stepNum + ')">&#8629;</button>'
    + '</div></div>';
  setTimeout(function() {
    var inp = document.getElementById(containerId + '-input');
    if (inp) inp.focus();
  }, 80);
}

function useSuggestion(containerId) {
  var hint = document.getElementById(containerId + '-body');
  var suggEl = hint ? hint.querySelector('.cc-suggestion-text') : null;
  var input = document.getElementById(containerId + '-input');
  if (suggEl && input) {
    input.value = suggEl.textContent;
    input.focus();
  }
}

function submitCCPrompt(stepNum) {
  var containerId = stepNum === 5 ? 'build1-cc' : 'build2-cc';
  var input = document.getElementById(containerId + '-input');
  var userPrompt = input ? input.value.trim() : '';
  if (!userPrompt) { if (input) input.focus(); return; }

  var body = document.getElementById(containerId + '-body');
  var inputRow = document.getElementById(containerId + '-input-row');
  var proj = projects[selectedProject];

  // Append user row
  body.insertAdjacentHTML('beforeend', renderItem({ type: 'user', text: userPrompt }));

  // Append thinking row
  var thinkingRow = document.createElement('div');
  thinkingRow.className = 'cc-thinking-row';
  thinkingRow.innerHTML = '<span style="color:#3a3a55;font-family:var(--mono)">building</span><span class="cc-thinking-dots"><span>.</span><span>.</span><span>.</span></span>';
  body.appendChild(thinkingRow);

  if (inputRow) inputRow.style.display = 'none';

  // After a brief pause, show the session
  setTimeout(function() {
    if (thinkingRow.parentNode) thinkingRow.remove();

    var sessionItems;
    if (stepNum === 5) {
      var raw = proj.build1.ccSession;
      sessionItems = Array.isArray(raw) ? raw.slice(1) : raw;
      storedSession1 = [{ type: 'user', text: userPrompt }].concat(Array.isArray(raw) ? raw.slice(1) : []);
    } else {
      var full = proj.build2.ccSession(customPrompt || proj.build2.defaultPrompt);
      sessionItems = full.slice(1);
      storedSession2 = [{ type: 'user', text: userPrompt }].concat(full.slice(1));
    }

    playSession(containerId, sessionItems, function() {
      var nextId = stepNum === 5 ? 'build1-next' : 'build2-next';
      var nextBtn = document.getElementById(nextId);
      if (nextBtn) {
        nextBtn.disabled = false;
        nextBtn.classList.add('btn-unlocked');
        setTimeout(function() { nextBtn.classList.remove('btn-unlocked'); }, 700);
      }
    });
  }, 900);
}

function playSession(containerId, items, onComplete) {
  var body = document.getElementById(containerId + '-body');
  if (!body) return;
  items.forEach(function(item, i) {
    setTimeout(function() {
      var html = renderItem(item);
      if (html) {
        body.insertAdjacentHTML('beforeend', html);
        body.lastElementChild.classList.add('cc-item-enter');
      }
      if (i === items.length - 1 && onComplete) onComplete();
    }, i * 400);
  });
}

// =====================================================================
// POPULATE BUILD STEPS
// =====================================================================
function populateBuildStep(stepNum) {
  var proj = projects[selectedProject];
  if (!proj) return;
  if (stepNum === 5) {
    var d = document.getElementById('build1-desc');
    if (d) d.textContent = proj.build1.desc;
    var t = document.getElementById('build1-tip');
    if (t) t.textContent = proj.build1.tip;
    if (storedSession1) {
      renderCCSession('build1-cc', storedSession1);
      var nb = document.getElementById('build1-next');
      if (nb) nb.disabled = false;
    } else {
      renderCCInput('build1-cc', 5);
    }
  } else if (stepNum === 6) {
    var t2 = document.getElementById('build2-title');
    if (t2) t2.textContent = proj.build2.title;
    var d2 = document.getElementById('build2-desc');
    if (d2) d2.textContent = proj.build2.desc;
    var t2t = document.getElementById('build2-tip');
    if (t2t) t2t.textContent = proj.build2.tip;
    if (storedSession2) {
      renderCCSession('build2-cc', storedSession2);
      var nb2 = document.getElementById('build2-next');
      if (nb2) nb2.disabled = false;
    } else {
      renderCCInput('build2-cc', 6);
    }
  } else if (stepNum === 7) {
    var d3 = document.getElementById('build3-desc');
    if (d3) d3.textContent = proj.name + ' is complete. Try it out in the live preview — this is real AI, running live.';
    var t3 = document.getElementById('build3-tip');
    if (t3) t3.textContent = 'When you hit send, your code calls the Claude API live. The response streams back in real time — not scripted, this is actual AI.';
    var lbl = document.getElementById('live-app-label');
    if (lbl) lbl.textContent = proj.liveLabel;
    var liveUI = document.getElementById('live-app-ui');
    if (liveUI && !liveUI.children.length) renderLiveApp('live-app-ui', selectedProject);
  }
}

function populateLaunch() {
  var proj = projects[selectedProject];
  if (!proj) return;
  var desc = document.getElementById('launch-desc');
  if (desc) desc.textContent = 'That response you just got? That was your code calling Claude\'s API live. You\'re officially a builder.';
  var sl = document.getElementById('stat-lines');
  if (sl) sl.textContent = proj.lines;
  var le = document.getElementById('launch-emoji');
  if (le) le.textContent = proj.launchEmoji;
  var ll = document.getElementById('launch-live-label');
  if (ll) ll.textContent = proj.liveLabel;
  var launchUI = document.getElementById('launch-live-ui');
  if (launchUI && !launchUI.children.length) renderLiveApp('launch-live-ui', selectedProject);
  // Populate share card
  var sce = document.getElementById('share-card-emoji');
  if (sce) sce.textContent = proj.launchEmoji;
  var sct = document.getElementById('share-card-title');
  if (sct) sct.textContent = 'I built ' + proj.name;
  var scl = document.getElementById('share-card-lines');
  if (scl) scl.textContent = proj.lines;
}

// =====================================================================
// PROMPT TOOLTIP
// =====================================================================
function openEditPrompt(currentPromptText) {
  if (tooltipInput) tooltipInput.value = currentPromptText;
  if (tooltipOverlay) tooltipOverlay.classList.add('visible');
  setTimeout(function() { if (tooltipInput) tooltipInput.focus(); }, 100);
}

function closeTooltip() {
  if (tooltipOverlay) tooltipOverlay.classList.remove('visible');
}

function applyPrompt() {
  var val = tooltipInput ? tooltipInput.value.trim() : '';
  if (val) {
    customPrompt = val;
    if (currentStep === 6) populateBuildStep(6);
  }
  closeTooltip();
}

// =====================================================================
// LIVE APP RENDERING
// =====================================================================
function getSystemPrompt() {
  var proj = projects[selectedProject];
  if (!proj) return 'You are a helpful AI assistant.';
  return customPrompt || proj.build2.defaultPrompt;
}

function renderLiveApp(containerId, projectId) {
  var container = document.getElementById(containerId);
  if (!container) return;

  if (projectId === 'journal' || projectId === 'freeform') {
    var placeholders = {
      journal: { welcome: 'Hi! I\'m your journal buddy. Write about your day, a challenge, or anything on your mind — I\'ll reflect it back to you.', input: 'What\'s on your mind today?' },
      freeform: { welcome: 'Your AI app is live! Type a message and see how it responds — shaped by the system prompt you set.', input: 'Type a message to your AI app...' }
    };
    var ph = placeholders[projectId] || placeholders.freeform;
    var placeholder = ph.welcome;
    var inputPlaceholder = ph.input;
    container.innerHTML = '<div class="chat-app">'
      + '<div class="chat-msgs" id="' + containerId + '-messages">'
      + '<div class="msg msg-ai">' + escapeHtml(placeholder) + '</div>'
      + '</div>'
      + '<div class="chat-input-row">'
      + '<textarea id="' + containerId + '-input" placeholder="' + inputPlaceholder + '" rows="2" onkeydown="handleChatKey(event,\'' + containerId + '\')"></textarea>'
      + '<button class="send-btn" id="' + containerId + '-send" onclick="sendChat(\'' + containerId + '\')">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>'
      + '</button></div></div>';

  } else if (projectId === 'landingpage' || projectId === 'calculator') {
    var labels = {
      landingpage: { input: 'Describe your product or idea...', btn: 'Generate Page', placeholder: 'Describe your product and watch AI build a complete landing page' },
      calculator: { input: 'Describe what to calculate (e.g. "mortgage calculator", "tip splitter")...', btn: 'Build Calculator', placeholder: 'Describe a calculator and watch AI build it live' }
    };
    var lbl = labels[projectId];
    container.innerHTML = '<div class="generator-app">'
      + '<div class="generator-input-area">'
      + '<textarea class="generator-textarea" id="' + containerId + '-input" placeholder="' + lbl.input + '"></textarea>'
      + '<button class="btn btn-primary" style="align-self:flex-end;" id="' + containerId + '-btn" onclick="runGenerator(\'' + containerId + '\',\'' + projectId + '\')">' + lbl.btn + ' →</button>'
      + '</div>'
      + '<div class="generator-preview" id="' + containerId + '-preview">'
      + '<div class="generator-placeholder">' + lbl.placeholder + '</div>'
      + '</div>'
      + '</div>';

  } else if (projectId === 'socialmedia') {
    container.innerHTML = '<div class="generator-app">'
      + '<div class="generator-input-area">'
      + '<textarea class="generator-textarea" id="' + containerId + '-input" placeholder="Describe your product launch, event, or announcement..."></textarea>'
      + '<button class="btn btn-primary" style="align-self:flex-end;" id="' + containerId + '-btn" onclick="runSocialMedia(\'' + containerId + '\')">Generate Posts →</button>'
      + '</div>'
      + '<div class="generator-preview social-preview" id="' + containerId + '-preview">'
      + '<div class="generator-placeholder">Describe what to promote and get ready-to-post content for every platform</div>'
      + '</div>'
      + '</div>';

  } else if (projectId === 'summarizer') {
    container.innerHTML = '<div class="split-app">'
      + '<div class="split-left">'
      + '<div class="split-label">Paste your text <button class="btn btn-primary" style="padding:5px 12px;font-size:11px;border-radius:100px;" onclick="runSummarizer(\'' + containerId + '\')">Summarize →</button></div>'
      + '<textarea class="split-textarea" id="' + containerId + '-input" placeholder="Paste any article, email, or document here..."></textarea>'
      + '</div>'
      + '<div class="split-right">'
      + '<div class="split-label">Key points</div>'
      + '<div class="split-output" id="' + containerId + '-output"><div class="split-placeholder">Paste text on the left and hit Summarize →</div></div>'
      + '</div></div>';

  } else if (projectId === 'rewriter') {
    container.innerHTML = '<div class="tool-app">'
      + '<div class="tool-pane">'
      + '<div class="tool-pane-label">Your text</div>'
      + '<textarea class="tool-textarea" id="' + containerId + '-input" placeholder="Paste any text here..."></textarea>'
      + '<div class="tool-controls">'
      + '<select id="' + containerId + '-tone" class="tool-select">'
      + '<option value="professional">Professional</option>'
      + '<option value="casual">Casual</option>'
      + '<option value="simple">Simple English</option>'
      + '<option value="punchy">Punchy &amp; direct</option>'
      + '</select>'
      + '<button class="tool-go-btn" onclick="runTool(\'' + containerId + '\')">Rewrite →</button>'
      + '</div></div>'
      + '<div class="tool-divider"></div>'
      + '<div class="tool-pane">'
      + '<div class="tool-pane-label">Claude\'s version</div>'
      + '<div class="tool-output" id="' + containerId + '-output"><p class="tool-placeholder">Your rewritten text appears here.</p></div>'
      + '</div></div>';
  }
}

// =====================================================================
// STREAMING API
// =====================================================================
async function streamFromClaude(messageOrHistory, systemPrompt, onChunk, onDone, onError, maxTokens) {
  try {
    var body = { systemPrompt: systemPrompt, maxTokens: maxTokens || 1024 };
    if (Array.isArray(messageOrHistory)) {
      body.messages = messageOrHistory;
    } else {
      body.message = messageOrHistory;
    }
    var res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      var err = await res.json().catch(function() { return { error: 'Request failed' }; });
      onError(err.error || 'Something went wrong');
      return;
    }
    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';
    while (true) {
      var result = await reader.read();
      if (result.done) break;
      buffer += decoder.decode(result.value, { stream: true });
      var lines = buffer.split('\n');
      buffer = lines.pop();
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (!line.startsWith('data: ')) continue;
        var data = line.slice(6).trim();
        if (data === '[DONE]') { onDone(); return; }
        try {
          var parsed = JSON.parse(data);
          if (parsed.error) { onError(parsed.error); return; }
          if (parsed.text) onChunk(parsed.text);
        } catch(e) {}
      }
    }
    onDone();
  } catch(err) {
    onError(err.message || 'Network error');
  }
}

// =====================================================================
// CHAT INTERACTIONS (journal + freeform)
// =====================================================================
function handleChatKey(e, containerId) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(containerId); }
}

function sendChat(containerId) {
  var input = document.getElementById(containerId + '-input');
  var messages = document.getElementById(containerId + '-messages');
  var sendBtn = document.getElementById(containerId + '-send');
  if (!input || !messages) return;
  var text = input.value.trim();
  if (!text) return;

  // Initialize history if needed
  if (!chatHistories[containerId]) chatHistories[containerId] = [];
  chatHistories[containerId].push({ role: 'user', content: text });

  var userMsg = document.createElement('div');
  userMsg.className = 'msg msg-user';
  userMsg.textContent = text;
  messages.appendChild(userMsg);
  input.value = '';
  input.disabled = true;
  if (sendBtn) sendBtn.disabled = true;
  messages.scrollTop = messages.scrollHeight;

  var aiMsg = document.createElement('div');
  aiMsg.className = 'msg msg-ai';
  aiMsg.innerHTML = '<span class="ai-text"></span><span class="typing-cursor"></span>';
  messages.appendChild(aiMsg);
  messages.scrollTop = messages.scrollHeight;

  var aiEl = aiMsg.querySelector('.ai-text');
  var accumulated = '';

  trackEvent('demo_used', { project: selectedProject });

  streamFromClaude(
    chatHistories[containerId],
    getSystemPrompt(),
    function(chunk) {
      accumulated += chunk;
      aiEl.textContent += chunk;
      messages.scrollTop = messages.scrollHeight;
    },
    function() {
      var cursor = aiMsg.querySelector('.typing-cursor');
      if (cursor) cursor.remove();
      chatHistories[containerId].push({ role: 'assistant', content: accumulated });
      input.disabled = false;
      if (sendBtn) sendBtn.disabled = false;
      input.focus();
    },
    function(err) {
      aiMsg.innerHTML = '<span style="color:var(--accent)">Could not connect to AI. Make sure you\'re running locally with <code>vercel dev</code>.</span>';
      // Remove the failed user message from history
      chatHistories[containerId].pop();
      input.disabled = false;
      if (sendBtn) sendBtn.disabled = false;
    }
  );
}

// =====================================================================
// SUMMARIZER INTERACTIONS
// =====================================================================
function runSummarizer(containerId) {
  var input = document.getElementById(containerId + '-input');
  var output = document.getElementById(containerId + '-output');
  if (!input || !output) return;
  var text = input.value.trim();
  if (!text) return;

  output.innerHTML = '<div class="split-placeholder">Summarizing<span class="typing-cursor"></span></div>';
  var accumulated = '';

  trackEvent('demo_used', { project: selectedProject });

  streamFromClaude(
    text,
    getSystemPrompt(),
    function(chunk) {
      accumulated += chunk;
      renderBullets(output, accumulated, true);
    },
    function() {
      renderBullets(output, accumulated, false);
    },
    function(err) {
      output.innerHTML = '<div class="split-placeholder" style="color:var(--accent)">Could not connect to AI. Make sure you\'re running locally with <code>vercel dev</code>.</div>';
    }
  );
}

var _renderBulletsRAF = null;
function renderBullets(container, text, streaming) {
  if (streaming) {
    if (_renderBulletsRAF) cancelAnimationFrame(_renderBulletsRAF);
    _renderBulletsRAF = requestAnimationFrame(function() {
      _renderBulletsRAF = null;
      _doRenderBullets(container, text, true);
    });
  } else {
    if (_renderBulletsRAF) { cancelAnimationFrame(_renderBulletsRAF); _renderBulletsRAF = null; }
    _doRenderBullets(container, text, false);
  }
}

function _doRenderBullets(container, text, streaming) {
  var lines = text.split('\n').filter(function(l) { return l.trim(); });
  var html = '';
  lines.forEach(function(line) {
    var clean = line.replace(/^[•\-\*]\s*/, '').trim();
    if (!clean) return;
    if (line.match(/^[•\-\*]/)) {
      html += '<div class="bullet-row"><div class="bullet-dot"></div><div style="font-size:13px;color:var(--ink);line-height:1.55;">' + escapeHtml(clean) + '</div></div>';
    } else {
      html += '<p style="font-size:13px;margin-bottom:8px;">' + escapeHtml(clean) + (streaming ? '<span class="typing-cursor"></span>' : '') + '</p>';
    }
  });
  if (!html && streaming) html = '<div class="split-placeholder">Summarizing<span class="typing-cursor"></span></div>';
  container.innerHTML = html;
}

// =====================================================================
// TRY-IT SANDBOX (step 1 live demo)
// =====================================================================
function runTryIt() {
  var input = document.getElementById('try-it-input');
  var output = document.getElementById('try-it-output');
  var btn = document.getElementById('try-it-btn');
  if (!input || !output) return;
  var text = input.value.trim();
  if (!text) return;

  input.disabled = true;
  if (btn) btn.disabled = true;
  output.innerHTML = '<span class="typing-cursor"></span>';
  var accumulated = '';

  trackEvent('demo_used', { project: 'try-it-sandbox' });

  streamFromClaude(
    text,
    'You are a helpful AI assistant. Keep your response concise — 2-3 sentences max.',
    function(chunk) {
      accumulated += chunk;
      output.textContent = accumulated;
    },
    function() {
      input.disabled = false;
      if (btn) btn.disabled = false;
      input.value = '';
      input.focus();
    },
    function(err) {
      output.innerHTML = '<span class="try-it-placeholder" style="color:var(--accent)">Could not connect to AI. Try again later.</span>';
      input.disabled = false;
      if (btn) btn.disabled = false;
    },
    256
  );
}

// =====================================================================
// PROMPT PLAYGROUND (step 3)
// =====================================================================
function runPlayground(side) {
  var input = document.getElementById('playground-' + side);
  var output = document.getElementById('playground-' + side + '-output');
  var btn = document.getElementById('playground-run-' + side);
  if (!input || !output) return;
  var text = input.value.trim();
  if (!text) return;

  btn.disabled = true;
  output.innerHTML = '<span class="typing-cursor"></span>';
  var accumulated = '';

  trackEvent('demo_used', { project: 'prompt-playground' });

  streamFromClaude(
    text,
    'You are a helpful assistant. Respond naturally.',
    function(chunk) {
      accumulated += chunk;
      output.textContent = accumulated;
    },
    function() {
      btn.disabled = false;
    },
    function(err) {
      output.innerHTML = '<span class="playground-output-placeholder" style="color:var(--accent)">Could not connect. Try again later.</span>';
      btn.disabled = false;
    },
    256
  );
}

// =====================================================================
// CONCEPT EXERCISES (step 2)
// =====================================================================
function runConceptExercise(type) {
  if (type === 'prompt') {
    var input = document.getElementById('exercise-prompt-input');
    var output = document.getElementById('exercise-prompt-output');
    if (!input) return;
    var text = input.value.trim();
    if (!text) return;
    output.style.display = 'block';
    output.innerHTML = '<span class="typing-cursor"></span>';
    var accumulated = '';
    streamFromClaude(text, null, function(chunk) {
      accumulated += chunk;
      output.textContent = accumulated;
    }, function() {}, function(err) {
      output.innerHTML = '<span style="color:var(--accent)">Could not connect.</span>';
    }, 256);

  } else if (type === 'sysprompt-plain' || type === 'sysprompt-pirate') {
    var comparison = document.getElementById('sysprompt-comparison');
    var outputId = type === 'sysprompt-plain' ? 'exercise-sysprompt-plain' : 'exercise-sysprompt-pirate';
    var output = document.getElementById(outputId);
    var btn = document.getElementById(type === 'sysprompt-plain' ? 'exercise-sysprompt-btn1' : 'exercise-sysprompt-btn2');
    if (!output) return;
    comparison.style.display = 'grid';
    output.innerHTML = '<span class="typing-cursor"></span>';
    if (btn) btn.disabled = true;
    var accumulated = '';
    var sysPrompt = type === 'sysprompt-pirate' ? 'You are a pirate captain. Speak like a pirate in all responses. Use pirate slang and expressions.' : null;
    streamFromClaude('What is artificial intelligence?', sysPrompt, function(chunk) {
      accumulated += chunk;
      output.textContent = accumulated;
    }, function() {
      if (btn) btn.disabled = false;
    }, function(err) {
      output.innerHTML = '<span style="color:var(--accent)">Could not connect.</span>';
      if (btn) btn.disabled = false;
    }, 256);
  }
}

function updateTokenCount() {
  var input = document.getElementById('exercise-token-input');
  var count = document.getElementById('token-count');
  if (!input || !count) return;
  var text = input.value;
  count.textContent = Math.ceil(text.length / 4);
}

// =====================================================================
// SHARE CARD (step 8)
// =====================================================================
function copyShareText() {
  var proj = projects[selectedProject];
  if (!proj) return;
  var text = 'I built ' + proj.name + ' with AI in 15 minutes using AI First Steps! ai-first-steps-self.vercel.app';
  navigator.clipboard.writeText(text).then(function() {
    showToast('Copied to clipboard!');
  }).catch(function() {
    showToast('Could not copy');
  });
}

// =====================================================================
// REWRITER INTERACTIONS
// =====================================================================
function runTool(containerId) {
  var input = document.getElementById(containerId + '-input');
  var toneEl = document.getElementById(containerId + '-tone');
  var output = document.getElementById(containerId + '-output');
  if (!input || !output) return;
  var text = input.value.trim();
  var tone = toneEl ? toneEl.value : 'professional';
  if (!text) return;

  var para = document.createElement('p');
  para.style.cssText = 'font-size:13px;line-height:1.6;white-space:pre-wrap;';
  var cursor = document.createElement('span');
  cursor.className = 'typing-cursor';
  var textNode = document.createTextNode('Rewriting\u2026');
  para.appendChild(textNode);
  para.appendChild(cursor);
  output.innerHTML = '';
  output.appendChild(para);
  var accumulated = '';

  trackEvent('demo_used', { project: selectedProject });

  streamFromClaude(
    'Rewrite in a ' + tone + ' tone:\n\n' + text,
    getSystemPrompt(),
    function(chunk) {
      accumulated += chunk;
      textNode.data = accumulated;
    },
    function() {
      cursor.remove();
    },
    function(err) {
      output.innerHTML = '<p class="tool-placeholder" style="color:var(--accent)">Could not connect to AI. Make sure you\'re running locally with <code>vercel dev</code>.</p>';
    }
  );
}

// =====================================================================
// GENERATOR INTERACTIONS (landingpage + calculator)
// =====================================================================
function runGenerator(containerId, projectId) {
  var input = document.getElementById(containerId + '-input');
  var preview = document.getElementById(containerId + '-preview');
  var btn = document.getElementById(containerId + '-btn');
  if (!input || !preview) return;
  var text = input.value.trim();
  if (!text) return;

  btn.disabled = true;
  preview.innerHTML = '<div class="generator-loading">Generating<span class="typing-cursor"></span></div>';
  var accumulated = '';

  trackEvent('demo_used', { project: selectedProject });

  var sysPrompt = getSystemPrompt();

  streamFromClaude(
    text,
    sysPrompt,
    function(chunk) {
      accumulated += chunk;
    },
    function() {
      // Extract HTML from response (look for ```html blocks or full doc)
      var html = extractHtml(accumulated);
      renderInIframe(preview, html);
      btn.disabled = false;
    },
    function(err) {
      preview.innerHTML = '<div class="generator-placeholder" style="color:var(--accent)">Could not connect to AI. Make sure you\'re running locally with <code>vercel dev</code>.</div>';
      btn.disabled = false;
    },
    4096
  );
}

function extractHtml(text) {
  // Try to extract from ```html ... ``` code block
  var match = text.match(/```html\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  // Try ``` ... ``` generic code block
  match = text.match(/```\s*([\s\S]*?)```/);
  if (match && match[1].trim().indexOf('<') === 0) return match[1].trim();
  // If the response starts with <, treat entire thing as HTML
  var trimmed = text.trim();
  if (trimmed.indexOf('<!') === 0 || trimmed.indexOf('<html') === 0 || trimmed.indexOf('<div') === 0) return trimmed;
  // Fallback: wrap in basic HTML
  return '<html><body style="font-family:system-ui,sans-serif;padding:24px;"><pre style="white-space:pre-wrap;">' + trimmed.replace(/</g, '&lt;') + '</pre></body></html>';
}

function renderInIframe(container, html) {
  container.innerHTML = '';
  var iframe = document.createElement('iframe');
  iframe.sandbox = 'allow-scripts';
  iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;min-height:300px;';
  container.appendChild(iframe);
  var doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
}

// =====================================================================
// SOCIAL MEDIA INTERACTIONS
// =====================================================================
function runSocialMedia(containerId) {
  var input = document.getElementById(containerId + '-input');
  var preview = document.getElementById(containerId + '-preview');
  var btn = document.getElementById(containerId + '-btn');
  if (!input || !preview) return;
  var text = input.value.trim();
  if (!text) return;

  btn.disabled = true;
  preview.innerHTML = '<div class="generator-loading">Generating posts<span class="typing-cursor"></span></div>';
  var accumulated = '';

  trackEvent('demo_used', { project: selectedProject });

  streamFromClaude(
    text,
    getSystemPrompt(),
    function(chunk) {
      accumulated += chunk;
    },
    function() {
      renderSocialCards(preview, accumulated);
      btn.disabled = false;
    },
    function(err) {
      preview.innerHTML = '<div class="generator-placeholder" style="color:var(--accent)">Could not connect to AI. Make sure you\'re running locally with <code>vercel dev</code>.</div>';
      btn.disabled = false;
    }
  );
}

function renderSocialCards(container, text) {
  var platforms = ['twitter', 'linkedin', 'instagram', 'facebook', 'threads'];
  var platformLabels = { twitter: 'Twitter / X', linkedin: 'LinkedIn', instagram: 'Instagram', facebook: 'Facebook', threads: 'Threads' };

  // Split by --- or platform headers
  var sections = text.split(/\n---\n|\n-{3,}\n/);

  // If no splits, try to detect platform headers
  if (sections.length <= 1) {
    sections = [];
    var current = { platform: '', content: '' };
    text.split('\n').forEach(function(line) {
      var platformMatch = line.match(/^\*{0,2}(twitter|linkedin|instagram|facebook|threads|x\b)/i);
      if (platformMatch) {
        if (current.content.trim()) sections.push(current);
        var p = platformMatch[1].toLowerCase();
        if (p === 'x') p = 'twitter';
        current = { platform: p, content: '' };
      } else {
        current.content += line + '\n';
      }
    });
    if (current.content.trim()) sections.push(current);
  }

  // Build cards
  var html = '';
  if (sections.length > 0 && typeof sections[0] === 'string') {
    // sections are plain strings, try to detect platform from content
    sections.forEach(function(section, i) {
      var sec = section.trim();
      if (!sec) return;
      var detectedPlatform = platforms[i] || 'twitter';
      // Try to detect platform from first line
      platforms.forEach(function(p) {
        if (sec.toLowerCase().indexOf(p) === 0 || sec.toLowerCase().indexOf('**' + p) === 0) {
          detectedPlatform = p;
          // Remove the platform header line
          sec = sec.replace(/^.*\n/, '').trim();
        }
      });
      if (sec.toLowerCase().indexOf('x ') === 0 || sec.toLowerCase().indexOf('**x') === 0) {
        detectedPlatform = 'twitter';
        sec = sec.replace(/^.*\n/, '').trim();
      }
      html += buildSocialCard(detectedPlatform, sec);
    });
  } else {
    // sections are objects with platform/content
    sections.forEach(function(sec) {
      if (!sec.content || !sec.content.trim()) return;
      html += buildSocialCard(sec.platform || 'twitter', sec.content.trim());
    });
  }

  if (!html) {
    html = buildSocialCard('twitter', text.trim());
  }

  container.innerHTML = html;
}

function buildSocialCard(platform, content) {
  var labels = { twitter: 'Twitter / X', linkedin: 'LinkedIn', instagram: 'Instagram', facebook: 'Facebook', threads: 'Threads' };
  // Clean up markdown bold/headers from content
  var clean = content
    .replace(/^#+\s*/gm, '')
    .replace(/\*{1,2}(.*?)\*{1,2}/g, '$1')
    .trim();
  var escaped = escapeHtml(clean);
  var attrEscaped = escapeAttr(clean);
  return '<div class="social-post-card">'
    + '<div class="social-post-header">'
    + '<span class="social-platform-badge ' + platform + '">' + (labels[platform] || platform) + '</span>'
    + '<button class="social-copy-btn" onclick="copyToClipboard(this, \'' + attrEscaped + '\', \'Copied!\', 1800)">Copy</button>'
    + '</div>'
    + '<div class="social-post-body">' + escaped + '</div>'
    + '</div>';
}

// =====================================================================
// EXPORT CODE
// =====================================================================
function exportProjectCode() {
  var proj = projects[selectedProject];
  if (!proj) return;

  var sysPrompt = customPrompt || proj.build2.defaultPrompt;
  var code = '';

  if (selectedProject === 'journal') {
    code = '// AI Journal Buddy\n'
      + '// Built with AI First Steps\n\n'
      + 'import Anthropic from "@anthropic-ai/sdk";\n\n'
      + 'const client = new Anthropic();\n\n'
      + 'async function reflect(entry) {\n'
      + '  const response = await client.messages.create({\n'
      + '    model: "claude-sonnet-4-20250514",\n'
      + '    max_tokens: 1024,\n'
      + '    system: ' + JSON.stringify(sysPrompt) + ',\n'
      + '    messages: [{ role: "user", content: entry }]\n'
      + '  });\n'
      + '  return response.content[0].text;\n'
      + '}\n\n'
      + '// Example usage:\n'
      + '// const reflection = await reflect("Today I felt overwhelmed but managed to finish my project...");\n'
      + '// console.log(reflection);\n\n'
      + 'export { reflect };\n';
  } else if (selectedProject === 'summarizer') {
    code = '// AI Summarizer\n'
      + '// Built with AI First Steps\n\n'
      + 'import Anthropic from "@anthropic-ai/sdk";\n\n'
      + 'const client = new Anthropic();\n\n'
      + 'async function summarize(text) {\n'
      + '  const response = await client.messages.create({\n'
      + '    model: "claude-sonnet-4-20250514",\n'
      + '    max_tokens: 1024,\n'
      + '    system: ' + JSON.stringify(sysPrompt) + ',\n'
      + '    messages: [{ role: "user", content: text }]\n'
      + '  });\n'
      + '  return response.content[0].text;\n'
      + '}\n\n'
      + '// Example usage:\n'
      + '// const summary = await summarize("Paste your long article or document here...");\n'
      + '// console.log(summary);\n\n'
      + 'export { summarize };\n';
  } else if (selectedProject === 'rewriter') {
    code = '// AI Text Rewriter\n'
      + '// Built with AI First Steps\n\n'
      + 'import Anthropic from "@anthropic-ai/sdk";\n\n'
      + 'const client = new Anthropic();\n\n'
      + 'async function rewrite(text, tone) {\n'
      + '  const response = await client.messages.create({\n'
      + '    model: "claude-sonnet-4-20250514",\n'
      + '    max_tokens: 1024,\n'
      + '    system: ' + JSON.stringify(sysPrompt) + ',\n'
      + '    messages: [{ role: "user", content: `Rewrite in a ${tone} tone:\\n\\n${text}` }]\n'
      + '  });\n'
      + '  return response.content[0].text;\n'
      + '}\n\n'
      + '// Example usage:\n'
      + '// const result = await rewrite("Your text here", "professional");\n'
      + '// console.log(result);\n\n'
      + 'export { rewrite };\n';
  } else if (selectedProject === 'landingpage') {
    code = '// AI Landing Page Builder\n'
      + '// Built with AI First Steps\n\n'
      + 'import Anthropic from "@anthropic-ai/sdk";\n'
      + 'import { writeFileSync } from "fs";\n\n'
      + 'const client = new Anthropic();\n\n'
      + 'async function generatePage(description) {\n'
      + '  const response = await client.messages.create({\n'
      + '    model: "claude-sonnet-4-20250514",\n'
      + '    max_tokens: 4096,\n'
      + '    system: ' + JSON.stringify(sysPrompt) + ',\n'
      + '    messages: [{ role: "user", content: description }]\n'
      + '  });\n'
      + '  const html = response.content[0].text;\n'
      + '  writeFileSync("landing-page.html", html);\n'
      + '  console.log("Saved to landing-page.html — open it in your browser!");\n'
      + '  return html;\n'
      + '}\n\n'
      + '// Example usage:\n'
      + '// await generatePage("A project management app for freelancers called TaskFlow");\n\n'
      + 'export { generatePage };\n';
  } else if (selectedProject === 'socialmedia') {
    code = '// AI Social Media Post Pack\n'
      + '// Built with AI First Steps\n\n'
      + 'import Anthropic from "@anthropic-ai/sdk";\n\n'
      + 'const client = new Anthropic();\n\n'
      + 'async function generatePosts(announcement) {\n'
      + '  const response = await client.messages.create({\n'
      + '    model: "claude-sonnet-4-20250514",\n'
      + '    max_tokens: 2048,\n'
      + '    system: ' + JSON.stringify(sysPrompt) + ',\n'
      + '    messages: [{ role: "user", content: announcement }]\n'
      + '  });\n'
      + '  return response.content[0].text;\n'
      + '}\n\n'
      + '// Example usage:\n'
      + '// const posts = await generatePosts("We just launched our new mobile app!");\n'
      + '// console.log(posts);\n\n'
      + 'export { generatePosts };\n';
  } else if (selectedProject === 'calculator') {
    code = '// AI Calculator Builder\n'
      + '// Built with AI First Steps\n\n'
      + 'import Anthropic from "@anthropic-ai/sdk";\n'
      + 'import { writeFileSync } from "fs";\n\n'
      + 'const client = new Anthropic();\n\n'
      + 'async function buildCalculator(description) {\n'
      + '  const response = await client.messages.create({\n'
      + '    model: "claude-sonnet-4-20250514",\n'
      + '    max_tokens: 4096,\n'
      + '    system: ' + JSON.stringify(sysPrompt) + ',\n'
      + '    messages: [{ role: "user", content: description }]\n'
      + '  });\n'
      + '  const html = response.content[0].text;\n'
      + '  writeFileSync("calculator.html", html);\n'
      + '  console.log("Saved to calculator.html — open it in your browser!");\n'
      + '  return html;\n'
      + '}\n\n'
      + '// Example usage:\n'
      + '// await buildCalculator("A mortgage calculator with monthly payments and amortization schedule");\n\n'
      + 'export { buildCalculator };\n';
  } else {
    code = '// Your AI App\n'
      + '// Built with AI First Steps\n\n'
      + 'import Anthropic from "@anthropic-ai/sdk";\n\n'
      + 'const client = new Anthropic();\n\n'
      + 'async function chat(input) {\n'
      + '  const response = await client.messages.create({\n'
      + '    model: "claude-sonnet-4-20250514",\n'
      + '    max_tokens: 1024,\n'
      + '    system: ' + JSON.stringify(sysPrompt) + ',\n'
      + '    messages: [{ role: "user", content: input }]\n'
      + '  });\n'
      + '  return response.content[0].text;\n'
      + '}\n\n'
      + '// Example usage:\n'
      + '// const reply = await chat("Hello, how can you help me?");\n'
      + '// console.log(reply);\n\n'
      + 'export { chat };\n';
  }

  var blob = new Blob([code], { type: 'text/javascript' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = proj.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  trackEvent('code_exported', { project: selectedProject });
}

// =====================================================================
// COPY UTILITIES
// =====================================================================
function copyToClipboard(btn, text, label, duration, noCopiedClass) {
  var prev = btn.textContent;
  navigator.clipboard.writeText(text).then(function() {
    btn.textContent = label || 'Copied!';
    if (!noCopiedClass) btn.classList.add('copied');
    setTimeout(function() {
      btn.textContent = prev;
      if (!noCopiedClass) btn.classList.remove('copied');
    }, duration || 1800);
  }).catch(function() {
    btn.textContent = 'Failed';
    setTimeout(function() { btn.textContent = prev; }, 1800);
  });
}

function copyPE(btn, text)     { copyToClipboard(btn, text); }
function copyPrompt(btn, text) { copyToClipboard(btn, text); }
function copyText(btn, text) {
  copyToClipboard(btn, text.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
}
function copyCLI(btn, text)    { copyToClipboard(btn, text, '✓', 2000, true); }

// =====================================================================
// UTILS
// =====================================================================
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return String(str).replace(/'/g, "\\'").replace(/"/g, '\\"');
}

// =====================================================================
// CACHED DOM REFS
// =====================================================================
var tooltipInput, tooltipOverlay;

// =====================================================================
// INIT
// =====================================================================
document.addEventListener('DOMContentLoaded', function() {
  // Check for saved progress
  var savedProgress = loadProgress();
  if (savedProgress && savedProgress.currentStep > 0) {
    showResumeBanner(savedProgress);
  }

  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  var toggle = document.getElementById('theme-toggle');
  if (toggle) toggle.textContent = isDark ? '☀️' : '🌙';

  tooltipInput = document.getElementById('tooltip-input');
  tooltipOverlay = document.getElementById('tooltip-overlay');

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeTooltip();
    if (e.key === 'Enter' && tooltipOverlay && tooltipOverlay.classList.contains('visible')) applyPrompt();
  });

  // Sidebar scroll tracking
  var claudeSections = document.querySelectorAll('#track-claude section[id]');
  var claudeNavLinks = document.querySelectorAll('#claude-sidebar a');
  var claudeNavMap = {};
  claudeNavLinks.forEach(function(l) {
    var href = l.getAttribute('href');
    if (href && href[0] === '#') claudeNavMap[href.slice(1)] = l;
  });

  var claudeObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        claudeNavLinks.forEach(function(l) { l.classList.remove('active'); });
        var match = claudeNavMap[entry.target.id];
        if (match) match.classList.add('active');
      }
    });
  }, { rootMargin: '-15% 0px -75% 0px' });

  claudeSections.forEach(function(s) { claudeObserver.observe(s); });
});
