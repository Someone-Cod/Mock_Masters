// ═══════════════════════════════════════════
//  app.js — MockMasters main application
// ═══════════════════════════════════════════

// ─── State ───────────────────────────────────────────────────────────────────
let currentUser = null;
let currentPage = 'auth';
let testState = null; // { questions, answers, reviews, currentIdx, timer, exam }
let timerInterval = null;
let allQuestions = []; // fetched from Supabase
let userTests = [];    // fetched test history

// Demo questions for offline/demo mode
const DEMO_QUESTIONS = [
  { id: 1, exam: 'jee', subject: 'physics', difficulty: 'medium', text: 'A body of mass 2 kg is thrown vertically upward with a velocity of 20 m/s. What is the maximum height reached? (g = 10 m/s²)', options: ['10 m', '20 m', '30 m', '40 m'], answer: 1 },
  { id: 2, exam: 'jee', subject: 'chemistry', difficulty: 'easy', text: 'What is the atomic number of Carbon?', options: ['4', '6', '8', '12'], answer: 1 },
  { id: 3, exam: 'jee', subject: 'mathematics', difficulty: 'hard', text: 'The value of ∫₀¹ x² dx is:', options: ['1/4', '1/3', '1/2', '1'], answer: 1 },
  { id: 4, exam: 'mhtcet', subject: 'biology', difficulty: 'easy', text: 'The powerhouse of the cell is:', options: ['Nucleus', 'Ribosome', 'Mitochondria', 'Golgi apparatus'], answer: 2 },
  { id: 5, exam: 'jee', subject: 'physics', difficulty: 'easy', text: 'The SI unit of force is:', options: ['Joule', 'Newton', 'Pascal', 'Watt'], answer: 1 },
  { id: 6, exam: 'jee', subject: 'chemistry', difficulty: 'medium', text: 'Which of the following is a noble gas?', options: ['Oxygen', 'Nitrogen', 'Argon', 'Chlorine'], answer: 2 },
  { id: 7, exam: 'mhtcet', subject: 'mathematics', difficulty: 'medium', text: 'If sin θ = 3/5, then cos θ equals:', options: ['4/5', '3/4', '5/3', '5/4'], answer: 0 },
  { id: 8, exam: 'generic', subject: 'physics', difficulty: 'hard', text: "Which of Maxwell's equations relates a changing magnetic field to an electric field?", options: ["Gauss's law", "Ampere's law", "Faraday's law", "Gauss's law for magnetism"], answer: 2 },
  { id: 9, exam: 'jee', subject: 'mathematics', difficulty: 'easy', text: 'The derivative of sin(x) is:', options: ['cos(x)', '−cos(x)', 'sin(x)', '−sin(x)'], answer: 0 },
  { id: 10, exam: 'jee', subject: 'chemistry', difficulty: 'hard', text: 'Which of the following represents the electronic configuration of Na⁺?', options: ['[Ne]', '[Ar]', '[He] 2s²', '[Ne] 3s¹'], answer: 0 },
];

const DEMO_PAPERS = [
  { id: 'jee_2024_jan_s1', exam: 'jee', title: 'JEE Main 2024 January Session 1', year: 2024 },
  { id: 'jee_2024_jan_s2', exam: 'jee', title: 'JEE Main 2024 January Session 2', year: 2024 },
  { id: 'jee_2024_apr_s1', exam: 'jee', title: 'JEE Main 2024 April Session 1',   year: 2024 },
  { id: 'jee_2023_jan_s1', exam: 'jee', title: 'JEE Main 2023 January Session 1', year: 2023 },
  { id: 'jee_2023_jan_s2', exam: 'jee', title: 'JEE Main 2023 January Session 2', year: 2023 },
  { id: 'jee_2023_apr_s1', exam: 'jee', title: 'JEE Main 2023 April Session 1',   year: 2023 },
  { id: 'jee_2022_jun_s1', exam: 'jee', title: 'JEE Main 2022 June Session 1',    year: 2022 },
  { id: 'jee_2022_jul_s1', exam: 'jee', title: 'JEE Main 2022 July Session 1',    year: 2022 },
  { id: 'jee_2021_feb',    exam: 'jee', title: 'JEE Main 2021 February Session',  year: 2021 },
  { id: 'mht_2024',        exam: 'mhtcet', title: 'MHT-CET 2024',                 year: 2024 },
  { id: 'mht_2023',        exam: 'mhtcet', title: 'MHT-CET 2023',                 year: 2023 },
  { id: 'mht_2022',        exam: 'mhtcet', title: 'MHT-CET 2022',                 year: 2022 },
];

// ─── Show sign-in form immediately on DOM ready (don't wait for Supabase) ─────
document.addEventListener('DOMContentLoaded', () => {
  // Force signinForm visible right away so the card is never blank
  const sf = document.getElementById('signinForm');
  if (sf) { sf.style.display = ''; sf.classList.remove('hidden'); }
  const st = document.getElementById('signinTab');
  if (st) st.classList.add('active');

  // Explicitly hide the other two panels (CSS no longer does this)
  const su = document.getElementById('signupForm');
  if (su) { su.style.display = 'none'; }
  const ff = document.getElementById('forgotForm');
  if (ff) { ff.style.display = 'none'; }

  // Wire tab clicks immediately — don't wait for supabase:ready
  document.getElementById('signinTab')?.addEventListener('click', () => showSigninPanel());
  document.getElementById('signupTab')?.addEventListener('click', () => showSignupPanel());
  document.getElementById('forgotLink')?.addEventListener('click', (e) => { e.preventDefault(); showForgotPanel(); });
  document.getElementById('backToSignin')?.addEventListener('click', (e) => { e.preventDefault(); showSigninPanel(); });
});

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('supabase:ready', async () => {
  setupNavigation();
  setupAuth();
  setupHelp();
  setupTheme();

  if (window._supabase) {
    const { data: { session } } = await db.getSession();
    if (session) {
      currentUser = session.user;
      enterApp();
    } else {
      showPage('auth');
      showSigninPanel(); // ensure form visible after page switch
    }
    db.onAuthChange((_event, session) => {
      if (session) { currentUser = session.user; enterApp(); }
      else {
        currentUser = null;
        const nav = document.getElementById('navbar');
        if (nav) { nav.classList.add('hidden'); nav.style.display = 'none'; }
        showPage('auth');
        showSigninPanel();
      }
    });
  } else {
    showPage('auth');
    showSigninPanel();
  }
});

// ─── Navigation ──────────────────────────────────────────────────────────────
function setupNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });
}

function navigateTo(page) {
  currentPage = page;
  // Hide all pages — both class AND inline style
  document.querySelectorAll('.page').forEach(p => {
    p.classList.add('hidden');
    p.style.display = 'none';
  });
  // Show target page
  const target = document.getElementById('page-' + page);
  if (target) { target.classList.remove('hidden'); target.style.display = ''; }

  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.page === page);
  });
  if (page === 'dashboard') loadDashboard();
  if (page === 'practice') loadPractice();
  if (page === 'papers') loadPapers();
  if (page === 'analytics') loadAnalytics();
}

function showPage(page) {
  document.querySelectorAll('.page').forEach(p => {
    p.classList.add('hidden');
    p.style.display = 'none';
  });
  const target = document.getElementById('page-' + page);
  if (target) { target.classList.remove('hidden'); target.style.display = ''; }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
function setupAuth() {
  // Tab switching handled by DOMContentLoaded above

  // Sign in — full handler with proper error messages
  document.getElementById('signinBtn').addEventListener('click', async () => {
    const email    = document.getElementById('signinEmail').value.trim();
    const password = document.getElementById('signinPassword').value;
    const msg      = document.getElementById('signinMsg');
    msg.textContent = ''; msg.className = 'auth-msg';
    if (!email || !password) { msg.textContent = 'Please fill in all fields.'; return; }

    if (!window._supabase) {
      currentUser = { id: 'demo', email, user_metadata: { full_name: 'Demo User' } };
      enterApp(); return;
    }

    const btn = document.getElementById('signinBtn');
    btn.textContent = 'Signing in…'; btn.disabled = true;
    const { error } = await db.signIn(email, password);
    btn.textContent = 'Sign In'; btn.disabled = false;

    if (error) {
      const e = error.message.toLowerCase();
      if (e.includes('not confirmed') || e.includes('email not confirmed')) {
        msg.innerHTML = 'Email not confirmed yet. <button class="resend-btn" id="resendConfirmBtn">Resend confirmation email</button>';
        document.getElementById('resendConfirmBtn')?.addEventListener('click', async () => {
          const { error: re } = await window._supabase.auth.resend({ type: 'signup', email });
          msg.className = 'auth-msg' + (re ? '' : ' success');
          msg.textContent = re ? re.message : '✅ Confirmation email resent — check your inbox.';
        });
      } else if (e.includes('invalid') || e.includes('credentials') || e.includes('wrong')) {
        msg.textContent = 'Incorrect email or password. Please try again.';
      } else {
        msg.textContent = error.message;
      }
    }
    // success handled by onAuthChange → enterApp()
  });

  // Sign up
  document.getElementById('signupBtn').addEventListener('click', async () => {
    const name     = document.getElementById('signupName').value.trim();
    const email    = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const exam     = document.getElementById('signupExam').value;
    const msg      = document.getElementById('signupMsg');
    msg.textContent = ''; msg.className = 'auth-msg';
    if (!name || !email || !password) { msg.textContent = 'Please fill in all fields.'; return; }
    if (password.length < 8) { msg.textContent = 'Password must be at least 8 characters.'; return; }

    if (!window._supabase) {
      currentUser = { id: 'demo', email, user_metadata: { full_name: name, target_exam: exam } };
      enterApp(); return;
    }

    const btn = document.getElementById('signupBtn');
    btn.textContent = 'Creating account…'; btn.disabled = true;
    const { data, error } = await db.signUp(email, password, { full_name: name, target_exam: exam });
    btn.textContent = 'Create Account'; btn.disabled = false;

    if (error) {
      const e = error.message.toLowerCase();
      if (e.includes('already registered') || e.includes('already exists')) {
        msg.innerHTML = 'Account already exists. <button class="resend-btn" onclick="showSigninPanel()">Sign in instead →</button>';
      } else { msg.textContent = error.message; }
    } else if (data?.session) {
      // email confirmation OFF — auto logged in via onAuthChange
      msg.className = 'auth-msg success';
      msg.textContent = '✅ Account created! Signing you in…';
    } else {
      msg.className = 'auth-msg success';
      msg.innerHTML = '✅ Account created! Check <strong>' + email + '</strong> for a confirmation link, then sign in.<br><small><button class="resend-btn" id="resendNewBtn">Resend email</button></small>';
      document.getElementById('resendNewBtn')?.addEventListener('click', async () => {
        await window._supabase?.auth.resend({ type: 'signup', email });
        msg.textContent = '✅ Resent — check your inbox.';
      });
    }
  });

  // Sign out
  document.getElementById('signOutBtn').addEventListener('click', async () => {
    if (window._supabase) await db.signOut();
    else {
      currentUser = null;
      const nav = document.getElementById('navbar');
      if (nav) { nav.classList.add('hidden'); nav.style.display = 'none'; }
      showPage('auth');
      showSigninPanel();
    }
  });
}

function enterApp() {
  const nav = document.getElementById('navbar');
  if (nav) { nav.classList.remove('hidden'); nav.style.display = ''; }
  // Hide auth page
  const authPage = document.getElementById('page-auth');
  if (authPage) { authPage.style.display = 'none'; }
  navigateTo('dashboard');
}

// ─── Theme ────────────────────────────────────────────────────────────────────
function setupTheme() {
  const stored = localStorage.getItem('mm_theme');
  if (stored === 'dark') applyTheme('dark');
  document.getElementById('themeToggle').addEventListener('click', () => {
    const isDark = document.body.classList.contains('dark');
    applyTheme(isDark ? 'light' : 'dark');
  });
}
function applyTheme(t) {
  document.body.classList.toggle('dark', t === 'dark');
  document.getElementById('themeToggle').textContent = t === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('mm_theme', t);
}

// ─── Help ─────────────────────────────────────────────────────────────────────
function setupHelp() {
  document.getElementById('helpBtn').addEventListener('click', () => {
    _show('helpModal');
  });
  document.getElementById('helpModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('helpModal')) _hide('helpModal');
  });
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
async function loadDashboard() {
  // Load test history
  userTests = await fetchUserTests();
  const numTests = userTests.length;
  const totalCorrect = userTests.reduce((s, t) => s + (t.correct || 0), 0);
  const totalQ = userTests.reduce((s, t) => s + (t.total || 0), 0);
  const avgAcc = totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0;
  const lastDate = numTests > 0 ? formatDate(userTests[0].created_at) : 'Never';

  document.getElementById('statTests').textContent = numTests;
  document.getElementById('statTestsSub').textContent = numTests === 1 ? '1 test' : `${numTests} tests`;
  document.getElementById('statAccuracy').textContent = totalQ > 0 ? `${avgAcc}%` : '—';
  document.getElementById('statAccuracySub').textContent = totalQ > 0 ? 'across all tests' : 'No tests yet';
  document.getElementById('statQuestions').textContent = totalQ || '—';
  document.getElementById('statLastActive').textContent = lastDate;

  // Subject performance
  const subjectEl = document.getElementById('subjectPerformance');
  const subjects = { Physics: {c:0,t:0}, Chemistry: {c:0,t:0}, Mathematics: {c:0,t:0}, Biology: {c:0,t:0} };
  userTests.forEach(test => {
    (test.subject_breakdown || []).forEach(sb => {
      if (subjects[sb.subject]) {
        subjects[sb.subject].c += sb.correct;
        subjects[sb.subject].t += sb.total;
      }
    });
  });
  const bars = Object.entries(subjects)
    .filter(([,v]) => v.t > 0)
    .map(([name, v]) => {
      const pct = Math.round((v.c / v.t) * 100);
      return `<div class="subject-bar-item">
        <div class="subject-bar-label"><span>${name}</span><span>${pct}%</span></div>
        <div class="subject-bar-track"><div class="subject-bar-fill" style="width:${pct}%"></div></div>
      </div>`;
    });
  subjectEl.innerHTML = bars.length ? bars.join('') : '<p class="muted">No data yet. Take a test!</p>';

  // Recent tests list
  const recentEl = document.getElementById('recentTests');
  if (userTests.length === 0) {
    recentEl.innerHTML = '<p class="muted">No tests yet. Start one above!</p>';
  } else {
    recentEl.innerHTML = userTests.slice(0, 5).map(t => `
      <div class="recent-test-item">
        <div class="rtest-info">
          <span class="rtest-name">${t.exam_name || 'Test'}</span>
          <span class="rtest-date">${formatDate(t.created_at)}</span>
        </div>
        <span class="rtest-score">${t.score ?? '—'}%</span>
      </div>
    `).join('');
  }

  document.getElementById('dashboardSubtitle').textContent =
    currentUser?.user_metadata?.full_name
      ? `Hello, ${currentUser.user_metadata.full_name}!`
      : 'Your exam prep hub';

  loadDailyGoal();
}

// ─── Practice ─────────────────────────────────────────────────────────────────
async function loadPractice() {
  document.getElementById('questionBank').innerHTML = '<p class="muted center">Loading questions...</p>';
  allQuestions = await fetchQuestions();
  populateChapterFilter();
  buildChapterList();
  renderQuestionBank();

  ['filterExam','filterSubject','filterDifficulty','filterSort','filterChapter','filterStandard'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => {
      // When subject/exam changes, reset the chapter filter (old chapter may not belong to new subject)
      if (id === 'filterSubject' || id === 'filterExam') {
        const ch = document.getElementById('filterChapter');
        if (ch) ch.value = '';
        populateChapterFilter();
      }
      renderQuestionBank();
      if (id === 'filterExam') buildChapterList();
    });
  });

  // Chapter view toggle
  const toggle = document.getElementById('toggleChapterView');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const list = document.getElementById('chapterList');
      const hidden = list.style.display === 'none';
      list.style.display = hidden ? 'flex' : 'none';
      list.classList.toggle('hidden', !hidden);
      toggle.textContent = hidden ? 'Hide Chapters' : 'Show Chapters';
      if (hidden) buildChapterList();
    });
  }
}

function renderQuestionBank() {
  const exam = document.getElementById('filterExam').value;
  const subject = document.getElementById('filterSubject').value;
  const diff = document.getElementById('filterDifficulty').value;
  const sort = document.getElementById('filterSort').value;
  const chapter = document.getElementById('filterChapter')?.value || '';
  const standard = document.getElementById('filterStandard')?.value || '';

  let qs = allQuestions.filter(q => {
    if (!q || !q.text) return false; // skip malformed
    if (exam && q.exam !== exam) return false;
    if (subject && q.subject !== subject) return false;
    if (diff && q.difficulty !== diff) return false;
    if (chapter && q.chapter !== chapter) return false;
    // Class filter: when 11 or 12 selected, include that standard + 'mixed' (unclassified are valid for both)
    if (standard && q.standard !== standard && q.standard !== 'mixed') return false;
    return true;
  });

  if (sort === 'easy_first') qs = qs.sort((a,b) => diffOrder(a.difficulty) - diffOrder(b.difficulty));
  if (sort === 'hard_first') qs = qs.sort((a,b) => diffOrder(b.difficulty) - diffOrder(a.difficulty));

  document.getElementById('questionCount').textContent = `${qs.length} questions`;

  if (qs.length === 0) {
    document.getElementById('questionBank').innerHTML = '<p class="muted center">No questions match your filters.</p>';
    _applyZoom(); return;
  }

  const bankHtml = qs.map((q, i) => `
    <div class="q-card">
      <div class="q-card-header">
        <span class="q-tag ${q.difficulty || 'medium'}">${q.difficulty || 'medium'}</span>
        <span class="q-subject">${capitalize(q.subject || 'general')} · ${(q.exam || '').toUpperCase()}${q.chapter ? ' · ' + q.chapter : ''}</span>
      </div>
      <div class="q-text">${i + 1}. ${q.text || 'Question text unavailable'}</div>
      ${q.image_svg ? '<div style="margin:8px 0;background:#fff;border-radius:8px;padding:4px;max-width:380px">' + q.image_svg + '</div>' : ''}
      <div class="q-options-preview">
        ${(q.options||[]).map((opt,oi) => `<div class="q-opt-line">${String.fromCharCode(65+oi)}. ${opt}</div>`).join('')}
      </div>
    </div>
  `).join('');

  const header = qs.length > 0
    ? `<div class="bank-actions"><span class="muted">${qs.length} questions</span>
         <button class="btn-primary" onclick="solveFiltered()">▶ Solve These (${Math.min(30,qs.length)} Q)</button></div>`
    : '<p class="muted center">No questions match these filters.</p>';

  document.getElementById('questionBank').innerHTML = header + bankHtml;
  window._filteredQuestions = qs;
  _applyZoom();
}

// Start a test from the currently filtered questions
function solveFiltered() {
  const qs = window._filteredQuestions || [];
  if (!qs.length) return;
  const exam = document.getElementById('filterExam').value || 'jee';
  const selected = shuffleArray(qs.slice()).slice(0, Math.min(30, qs.length));
  startTest(selected, exam);
}

function diffOrder(d) { return d === 'easy' ? 0 : d === 'medium' ? 1 : 2; }

// ─── Mock Test ────────────────────────────────────────────────────────────────
function quickStart(exam) {
  const qs = allQuestions.length > 0
    ? allQuestions.filter(q => q.exam === exam || exam === 'generic')
    : DEMO_QUESTIONS.filter(q => q.exam === exam || exam === 'generic');

  if (qs.length === 0) {
    
    return;
  }

  const selected = shuffleArray(qs).slice(0, Math.min(30, qs.length));
  startTest(selected, exam);
}

function startTest(questions, exam) {
  testState = {
    questions,
    answers: new Array(questions.length).fill(null),
    reviews: new Array(questions.length).fill(false),
    currentIdx: 0,
    exam,
    elapsed: 0,
  };

  navigateTo('mocktest');

  _hide('pretestState');
  _hide('testResult');
  _show('activeTest');

  buildPalette();
  renderQuestion();
  startTimer();

  document.getElementById('prevBtn').addEventListener('click', prevQuestion);
  document.getElementById('nextBtn').addEventListener('click', nextQuestion);
  document.getElementById('reviewBtn').addEventListener('click', markReview);
  document.getElementById('submitTestBtn').addEventListener('click', submitTest);
}

function renderQuestion() {
  const { questions, currentIdx, answers, reviews } = testState;
  const q = questions[currentIdx];
  document.getElementById('questionProgress').textContent = `Q ${currentIdx + 1} of ${questions.length}`;
  document.getElementById('questionTitle').textContent = `Question ${currentIdx + 1}`;
  document.getElementById('questionContent').textContent = q.text;

  const labels = ['A','B','C','D'];
  document.getElementById('optionsContainer').innerHTML = q.options.map((opt, i) => `
    <button class="option-btn ${answers[currentIdx] === i ? 'selected' : ''}" onclick="selectOption(${i})">
      <span class="option-label">${labels[i]}</span>
      ${opt}
    </button>
  `).join('');

  document.getElementById('reviewBtn').style.background = reviews[currentIdx] ? '#f59e0b' : '';

  // Update palette
  document.querySelectorAll('.palette-num').forEach((el, i) => {
    el.classList.remove('current', 'answered', 'review');
    if (i === currentIdx) el.classList.add('current');
    else if (testState.reviews[i]) el.classList.add('review');
    else if (testState.answers[i] !== null) el.classList.add('answered');
  });
}

function selectOption(idx) {
  testState.answers[testState.currentIdx] = idx;
  renderQuestion();
}

function prevQuestion() {
  if (testState.currentIdx > 0) { testState.currentIdx--; renderQuestion(); }
}

function nextQuestion() {
  if (testState.currentIdx < testState.questions.length - 1) { testState.currentIdx++; renderQuestion(); }
  else submitTest();
}

function markReview() {
  testState.reviews[testState.currentIdx] = !testState.reviews[testState.currentIdx];
  renderQuestion();
}

function buildPalette() {
  document.getElementById('questionPalette').innerHTML = testState.questions.map((_, i) => `
    <div class="palette-num" onclick="jumpTo(${i})">${i + 1}</div>
  `).join('');
}

function jumpTo(idx) { testState.currentIdx = idx; renderQuestion(); }

function startTimer() {
  clearInterval(timerInterval);
  const duration = testState.questions.length * 3 * 60; // 3 min/question
  let remaining = duration;
  updateTimerDisplay(remaining);
  timerInterval = setInterval(() => {
    remaining--;
    testState.elapsed = duration - remaining;
    updateTimerDisplay(remaining);
    if (remaining <= 0) { clearInterval(timerInterval); submitTest(); }
  }, 1000);
}

function updateTimerDisplay(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  document.getElementById('testTimer').textContent =
    `${pad(h)}:${pad(m)}:${pad(s)}`;
}

async function submitTest() {
  clearInterval(timerInterval);
  const { questions, answers } = testState;
  let correct = 0, incorrect = 0, skipped = 0;
  answers.forEach((ans, i) => {
    if (ans === null) skipped++;
    else if (ans === questions[i].answer) correct++;
    else incorrect++;
  });
  const score = Math.round(((correct * 4 - incorrect) / (questions.length * 4)) * 100);

  _hide('activeTest');
  _show('testResult');
  document.getElementById('resultScore').textContent = `${Math.max(0, score)}%`;
  document.getElementById('resultCorrect').textContent = correct;
  document.getElementById('resultIncorrect').textContent = incorrect;
  document.getElementById('resultSkipped').textContent = skipped;

  // Update score circle
  const pct = Math.max(0, score);
  document.querySelector('.score-circle').style.background =
    `conic-gradient(var(--accent) ${pct}%, var(--bg3) ${pct}%)`;

  // Save to Supabase (only with a valid logged-in user)
  if (window._supabase && currentUser && currentUser.id && currentUser.id !== 'demo') {
    try {
      await db.from('test_attempts').insert({
        user_id: currentUser.id,
        exam_name: testState.exam?.toUpperCase() || 'Mock Test',
        total: questions.length,
        correct,
        incorrect,
        skipped,
        score: Math.max(0, Math.min(100, Math.round(score))),
      });
    } catch (e) { console.error('save failed', e); }
  } else {
    // Save to local demo history
    userTests.unshift({
      exam_name: (testState.exam || 'Mock Test').toUpperCase(),
      total: questions.length,
      correct,
      incorrect,
      skipped,
      score: Math.max(0, score),
      created_at: new Date().toISOString(),
    });
    localStorage.setItem('mm_tests', JSON.stringify(userTests.slice(0, 50)));
  }

  document.getElementById('reviewAnswersBtn').onclick = reviewAnswers;
}

function reviewAnswers() {
  _hide('testResult');
  _show('activeTest');
  testState.currentIdx = 0;

  // Render options with correct/wrong highlights
  const { questions, answers } = testState;
  document.getElementById('questionProgress').textContent = `Review — Q 1 of ${questions.length}`;
  document.getElementById('questionContent').textContent = questions[0].text;
  const labels = ['A','B','C','D'];
  document.getElementById('optionsContainer').innerHTML = questions[0].options.map((opt, i) => {
    let cls = '';
    if (i === questions[0].answer) cls = 'correct';
    else if (answers[0] === i) cls = 'wrong';
    return `<button class="option-btn ${cls}" disabled>
      <span class="option-label">${labels[i]}</span>${opt}
    </button>`;
  }).join('');
}

// ─── Papers ───────────────────────────────────────────────────────────────────
async function loadPapers() {
  const papers = await fetchPapers();
  let current = 'all';

  function renderPapers(filter) {
    const filtered = filter === 'all' ? papers : papers.filter(p => p.exam === filter);
    if (filtered.length === 0) {
      document.getElementById('papersGrid').innerHTML = '<p class="muted center">No papers found.</p>';
      return;
    }
    document.getElementById('papersGrid').innerHTML = filtered.map(p => `
      <div class="paper-card">
        <div class="paper-icon">${p.exam === 'jee' ? '🔬' : '🧬'}</div>
        <div class="paper-title">${p.title}</div>
        <div class="paper-meta">${p.exam === 'jee' ? 'JEE Main' : 'MHT-CET'} · ${p.year}</div>
        <button class="paper-download" style="cursor:pointer;border:none;width:100%;text-align:center;" onclick="startPaperCBT('${p.id}','${p.exam}','${p.title}')">▶ Start CBT Test</button>
      </div>
    `).join('');
  }

  document.querySelectorAll('.filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      current = btn.dataset.filter;
      document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderPapers(current);
    });
  });

  renderPapers('all');
}

// ─── Analytics ────────────────────────────────────────────────────────────────
async function loadAnalytics() {
  const tests = await fetchUserTests();
  if (tests.length === 0) {
    _show('analyticsEmpty');
    _hide('analyticsContent');
    return;
  }
  _hide('analyticsEmpty');
  _show('analyticsContent');

  // ── Answer distribution totals ──
  const totalC  = tests.reduce((s,t) => s + (t.correct   || 0), 0);
  const totalW  = tests.reduce((s,t) => s + (t.incorrect || 0), 0);
  const totalSk = tests.reduce((s,t) => s + (t.skipped   || 0), 0);
  const totalAll = totalC + totalW + totalSk;

  if (totalAll > 0) {
    document.getElementById('pctCorrect').textContent  = Math.round(totalC  / totalAll * 100) + '%';
    document.getElementById('pctWrong').textContent    = Math.round(totalW  / totalAll * 100) + '%';
    document.getElementById('pctSkipped').textContent  = Math.round(totalSk / totalAll * 100) + '%';
  }

  // ── History table ──
  document.getElementById('historyTableBody').innerHTML = tests.map(t =>
    '<tr>' +
    '<td>' + (t.exam_name || '—') + '</td>' +
    '<td>Mock</td>' +
    '<td>' + (t.score ?? '—') + '%</td>' +
    '<td>' + (t.total ? Math.round((t.correct / t.total) * 100) : '—') + '%</td>' +
    '<td>' + formatDate(t.created_at) + '</td>' +
    '<td><span class="q-tag easy">Done</span></td>' +
    '</tr>'
  ).join('');

  // ── Heatmap ──
  buildHeatmap(tests);

  // ── Charts — destroy existing before redraw ──
  ['_chartDist','_chartTrend','_chartJee','_chartMht'].forEach(k => {
    if (window[k]) { try { window[k].destroy(); } catch(e){} window[k] = null; }
  });

  // 1. Answer distribution donut
  const distCtx = document.getElementById('answerDistChart');
  if (distCtx && window.Chart) {
    window._chartDist = new Chart(distCtx, {
      type: 'doughnut',
      data: {
        labels: ['Correct', 'Wrong', 'Skipped'],
        datasets: [{ data: [totalC, totalW, totalSk], backgroundColor: ['#22c55e','#ef4444','#94a3b8'], borderWidth: 0 }]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
  }

  // 2. Score trend line chart
  const trendCtx = document.getElementById('scoreTrendChart');
  if (trendCtx && window.Chart) {
    const last10 = tests.slice(0, 10).reverse();
    window._chartTrend = new Chart(trendCtx, {
      type: 'line',
      data: {
        labels: last10.map(t => formatDate(t.created_at)),
        datasets: [{
          label: 'Score %',
          data: last10.map(t => t.score || 0),
          borderColor: '#4f46e5', backgroundColor: 'rgba(79,70,229,0.1)',
          tension: 0.4, fill: true, pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        scales: { y: { min: 0, max: 100, ticks: { callback: v => v + '%' } } },
        plugins: { legend: { display: false } }
      }
    });
  }

  // 3. Subject accuracy bars (from test_attempts subject_breakdown if available)
  const subjectData = { physics: {c:0,t:0}, chemistry: {c:0,t:0}, mathematics: {c:0,t:0}, biology: {c:0,t:0} };
  tests.forEach(t => {
    if (Array.isArray(t.subject_breakdown)) {
      t.subject_breakdown.forEach(sb => {
        if (subjectData[sb.subject]) {
          subjectData[sb.subject].c += (sb.correct || 0);
          subjectData[sb.subject].t += (sb.total || 0);
        }
      });
    }
  });

  // JEE chart (Physics, Chemistry, Maths)
  const jeeCtx = document.getElementById('jeeAccuracyChart');
  if (jeeCtx && window.Chart) {
    const jeeSubjects = ['physics','chemistry','mathematics'];
    const jeeLabels   = ['Physics','Chemistry','Maths'];
    const jeeData     = jeeSubjects.map(s => subjectData[s].t > 0 ? Math.round(subjectData[s].c / subjectData[s].t * 100) : 0);
    window._chartJee  = new Chart(jeeCtx, {
      type: 'bar',
      data: {
        labels: jeeLabels,
        datasets: [{ label: 'Accuracy %', data: jeeData, backgroundColor: ['#4f46e5','#06b6d4','#f59e0b'], borderRadius: 6 }]
      },
      options: {
        responsive: true,
        scales: { y: { min:0, max:100, ticks: { callback: v => v+'%' } } },
        plugins: { legend: { display: false } }
      }
    });
  }

  // MHT chart (Physics, Chemistry, Maths, Biology)
  const mhtCtx = document.getElementById('mhtAccuracyChart');
  if (mhtCtx && window.Chart) {
    const mhtSubjects = ['physics','chemistry','mathematics','biology'];
    const mhtLabels   = ['Physics','Chemistry','Maths','Biology'];
    const mhtData     = mhtSubjects.map(s => subjectData[s].t > 0 ? Math.round(subjectData[s].c / subjectData[s].t * 100) : 0);
    window._chartMht  = new Chart(mhtCtx, {
      type: 'bar',
      data: {
        labels: mhtLabels,
        datasets: [{ label: 'Accuracy %', data: mhtData, backgroundColor: ['#4f46e5','#06b6d4','#f59e0b','#22c55e'], borderRadius: 6 }]
      },
      options: {
        responsive: true,
        scales: { y: { min:0, max:100, ticks: { callback: v => v+'%' } } },
        plugins: { legend: { display: false } }
      }
    });
  }
}

function buildHeatmap(tests) {
  const grid = document.getElementById('heatmapGrid');
  const dates = {};
  tests.forEach(t => {
    const d = t.created_at?.slice(0, 10);
    if (d) dates[d] = (dates[d] || 0) + 1;
  });
  const cells = [];
  for (let i = 90; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const count = dates[key] || 0;
    const level = count === 0 ? '' : count === 1 ? 'active-1' : count <= 3 ? 'active-2' : 'active-3';
    cells.push(`<div class="heatmap-cell ${level}" title="${key}: ${count} tests"></div>`);
  }
  grid.innerHTML = cells.join('');
}

// ─── Data fetchers ─────────────────────────────────────────────────────────────
async function fetchQuestions() {
  // Always include MHT-CET PYQ questions
  const pyq = typeof MHT_CET_QUESTIONS !== 'undefined' ? MHT_CET_QUESTIONS : [];

  if (!window._supabase) return [...DEMO_QUESTIONS, ...pyq];
  try {
    // Supabase caps each request at 1000 rows — paginate to get everything
    let data = [];
    const PAGE = 1000;
    for (let from = 0; from < 20000; from += PAGE) {
      const { data: chunk, error } = await db.from('questions')
        .select('*')
        .eq('status', 'published')
        .range(from, from + PAGE - 1);
      if (error) break;
      if (!chunk || chunk.length === 0) break;
      data = data.concat(chunk);
      if (chunk.length < PAGE) break;
    }
    if (!data.length) return [...DEMO_QUESTIONS, ...pyq];

    // Normalise Supabase rows — handle varied field names
    const _ansToIdx = (v) => {
      if (typeof v === 'number') return v;
      const s = String(v ?? '').trim().toUpperCase();
      if (s === 'A') return 0;
      if (s === 'B') return 1;
      if (s === 'C') return 2;
      if (s === 'D') return 3;
      const n = parseInt(s, 10);
      return isNaN(n) ? 0 : n;
    };
    const normalised = data.map(q => ({
      id:         q.id,
      exam:       String(q.exam || q.exam_type || 'jee').toLowerCase().replace('-',''),
      subject:    String(q.subject || 'physics').toLowerCase(),
      difficulty: String(q.difficulty || 'medium').toLowerCase(),
      text:       q.text || q.question || q.question_text || '',
      options:    Array.isArray(q.options)
                    ? q.options
                    : [q.option_a ?? q.a ?? '', q.option_b ?? q.b ?? '', q.option_c ?? q.c ?? '', q.option_d ?? q.d ?? ''],
      answer:     _ansToIdx(q.answer ?? q.correct_option ?? q.correct),
      year:       q.year,
      source:     q.source,
      chapter:    q.chapter || 'General',
      standard:   q.standard || 'mixed',
      image_svg:  q.image_svg  || null,
      image_url:  q.image_url  || null,
    })).filter(q => q.text && q.options.length === 4 && q.options.some(o => o && o.trim()));

    // Merge: Supabase questions + PYQ (avoid duplicates by id)
    const supabaseIds = new Set(normalised.map(q => q.id));
    const uniquePyq = pyq.filter(q => !supabaseIds.has(q.id));
    return [...normalised, ...uniquePyq];
  } catch { return [...DEMO_QUESTIONS, ...pyq]; }
}

async function fetchUserTests() {
  // Always load local copy first
  let localTests = [];
  try { localTests = JSON.parse(localStorage.getItem('mm_tests') || '[]'); } catch { localTests = []; }

  if (!window._supabase || !currentUser?.id || currentUser.id === 'demo') {
    return localTests;
  }
  try {
    const { data, error } = await db.from('test_attempts')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });
    if (error || !data || data.length === 0) {
      // Supabase empty or failed — fall back to local so analytics still shows
      return localTests;
    }
    return data;
  } catch {
    return localTests;
  }
}

async function fetchPapers() {
  // Always start with DEMO_PAPERS as base
  const base = DEMO_PAPERS;
  if (!window._supabase) return base;
  try {
    // Only fetch PUBLIC papers (empty placeholder papers are hidden)
    const { data, error } = await db.from('papers')
      .select('*')
      .eq('is_public', true);
    if (error || !data?.length) return base;
    // Normalise: DB stores exam_type ('JEE'/'MHT-CET'); frontend wants lowercase 'exam'
    const normalised = data.map(p => {
      const raw = (p.exam_type || p.exam || '').toLowerCase();
      return {
        ...p,
        exam: raw.includes('jee') ? 'jee'
            : (raw.includes('mht') || raw.includes('cet')) ? 'mhtcet'
            : raw.includes('neet') ? 'neet'
            : 'jee',
        year: p.year || '',
      };
    });
    return normalised;
  } catch { return base; }
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, '0'); }
function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ═══════════════════════════════════════════════════════════════════
//  NEW FEATURES — appended, zero changes to code above
// ═══════════════════════════════════════════════════════════════════

// ─── Forgot Password ──────────────────────────────────────────────────────────
document.addEventListener('supabase:ready', () => {
  document.getElementById('sendResetBtn')?.addEventListener('click', async () => {
    const email = document.getElementById('resetEmail').value.trim();
    const msg   = document.getElementById('forgotMsg');
    msg.textContent = ''; msg.className = 'auth-msg';
    if (!email) { msg.textContent = 'Please enter your email.'; return; }

    if (!window._supabase) {
      msg.className = 'auth-msg success';
      msg.textContent = '(Demo) Reset link would be sent.'; return;
    }
    const btn = document.getElementById('sendResetBtn');
    btn.textContent = 'Sending…'; btn.disabled = true;
    const { error } = await window._supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    btn.textContent = 'Send Reset Link'; btn.disabled = false;
    if (error) { msg.textContent = error.message; }
    else {
      msg.className = 'auth-msg success';
      msg.innerHTML = '✅ Reset link sent to <strong>' + email + '</strong> — check your inbox.';
    }
  });
});

function _show(id)  { const el = document.getElementById(id); if(el){ el.style.display='block'; el.classList.remove('hidden'); } }
function _hide(id)  { const el = document.getElementById(id); if(el){ el.style.display='none';  el.classList.add('hidden'); } }
// Alias for test panels
function _showPanel(id) { _show(id); }
function _hidePanel(id) { _hide(id); }

function showSigninPanel() {
  _show('signinForm');
  _hide('signupForm');
  _hide('forgotForm');
  document.getElementById('signinTab')?.classList.add('active');
  document.getElementById('signupTab')?.classList.remove('active');
  const m = document.getElementById('signinMsg'); if(m) m.textContent = '';
}

function showSignupPanel() {
  _show('signupForm');
  _hide('signinForm');
  _hide('forgotForm');
  document.getElementById('signupTab')?.classList.add('active');
  document.getElementById('signinTab')?.classList.remove('active');
  const m = document.getElementById('signupMsg'); if(m) m.textContent = '';
}

function showForgotPanel() {
  _show('forgotForm');
  _hide('signinForm');
  _hide('signupForm');
  document.getElementById('signinTab')?.classList.remove('active');
  document.getElementById('signupTab')?.classList.remove('active');
  const m = document.getElementById('forgotMsg'); if(m) m.textContent = '';
  const r = document.getElementById('resetEmail'); if(r) r.value = '';
}

// ─── Practice Zoom ────────────────────────────────────────────────────────────
let _practiceZoom = 100;

document.addEventListener('supabase:ready', () => {
  document.getElementById('zoomIn')?.addEventListener('click', () => _setZoom(_practiceZoom + 10));
  document.getElementById('zoomOut')?.addEventListener('click', () => _setZoom(_practiceZoom - 10));
  document.getElementById('zoomReset')?.addEventListener('click', () => _setZoom(100));
  _applyZoom();
});

function _setZoom(val) {
  _practiceZoom = Math.max(70, Math.min(150, val));
  _applyZoom();
}

function _applyZoom() {
  const bank = document.getElementById('questionBank');
  if (bank) {
    // Scale the actual text elements, not just container font-size
    bank.querySelectorAll('.q-text, .q-opt-line').forEach(el => {
      el.style.fontSize = (_practiceZoom / 100 * 15) + 'px';
    });
  }
  const lbl = document.getElementById('zoomLevel');
  if (lbl) lbl.textContent = _practiceZoom + '%';
  const zOut = document.getElementById('zoomOut');
  const zIn  = document.getElementById('zoomIn');
  if (zOut) zOut.disabled = _practiceZoom <= 70;
  if (zIn)  zIn.disabled  = _practiceZoom >= 150;
}

// Keep zoom applied after question bank re-renders
const _origRenderQB = window.renderQuestionBank;
if (typeof renderQuestionBank === 'function') {
  const _origRQB = renderQuestionBank;
  window.renderQuestionBank = function() {
    _origRQB.apply(this, arguments);
    _applyZoom();
  };
}

// ─── Fullscreen during test ───────────────────────────────────────────────────
function _requestFS() {
  try {
    const el = document.documentElement;
    const fn = el.requestFullscreen || el.webkitRequestFullscreen ||
               el.mozRequestFullScreen || el.msRequestFullscreen;
    if (fn) {
      const result = fn.call(el);
      if (result && typeof result.catch === 'function') result.catch(() => {});
    }
  } catch(e) {}
}

function _exitFS() {
  try {
    // Only exit if actually in fullscreen — avoids "Document not active" error
    const fsElement = document.fullscreenElement || document.webkitFullscreenElement ||
                      document.mozFullScreenElement || document.msFullscreenElement;
    if (!fsElement) return;
    const fn = document.exitFullscreen || document.webkitExitFullscreen ||
               document.mozCancelFullScreen || document.msExitFullscreen;
    if (fn) {
      const result = fn.call(document);
      if (result && typeof result.catch === 'function') result.catch(() => {});
    }
  } catch(e) {}
}

// Patch startTest to enter fullscreen + wire inline submit + fix duplicate listeners
const _origStartTest = window.startTest;
window.startTest = function(questions, exam) {
  _origStartTest(questions, exam);

  // Enter fullscreen
  _requestFS();

  // Inline submit button
  const inlineBtn = document.getElementById('submitTestBtnInline');
  if (inlineBtn) {
    const fresh = inlineBtn.cloneNode(true);
    inlineBtn.parentNode.replaceChild(fresh, inlineBtn);
    fresh.addEventListener('click', submitTest);
    _updateInlineSubmit(questions.length);
  }
};

// Patch submitTest to exit fullscreen
const _origSubmitTest = window.submitTest;
window.submitTest = async function() {
  _exitFS();
  await _origSubmitTest.apply(this, arguments);
};

// Patch renderQuestion to also update inline submit counter
const _origRQ = window.renderQuestion;
window.renderQuestion = function() {
  _origRQ.apply(this, arguments);
  if (testState) _updateInlineSubmit(testState.questions.length);
};

function _updateInlineSubmit(total) {
  const btn = document.getElementById('submitTestBtnInline');
  if (!btn || !testState) return;
  const answered = testState.answers.filter(a => a !== null).length;
  btn.textContent = 'Submit Test  (' + answered + ' / ' + total + ' answered)';
}

// Timer warning — turn red in last 5 min
const _origUpdateTimer = window.updateTimerDisplay;
window.updateTimerDisplay = function(secs) {
  _origUpdateTimer(secs);
  const el = document.getElementById('testTimer');
  if (el) el.classList.toggle('warning', secs <= 300);
};
const MHT_CET_QUESTIONS = [
  { id: 'mht_1', exam: 'mhtcet', subject: 'physics', difficulty: 'easy', text: "Two luminous points sources separated by a certain distance are at 10 km from an observer. If the aperture of his eye is 2.5 x 10-3 m and the wavelength of light used is 500 nm the distance of separation between the point sources just seen to be resolved is", options: ['12.2 m', '24.2 m', '2.44 m', '1.22 m'], answer: 2, year: 2025 },
  { id: 'mht_2', exam: 'mhtcet', subject: 'physics', difficulty: 'easy', text: "A door 1.6 m wide requires a force of N to be applied at the free end to open or close it. The force that is required at a point 0.4 m distance from the hinges for opening or closing the door is", options: ['1.2 N', '3.6 N', '2.4 N', '4 N'], answer: 3, year: 2025 },
  { id: 'mht_3', exam: 'mhtcet', subject: 'physics', difficulty: 'easy', text: "0.1 m3 of water at 80o C. The final temperature of the mixture is", options: ['65oC', '70oC', '60oC', '75oC'], answer: 0, year: 2025 },
  { id: 'mht_4', exam: 'mhtcet', subject: 'physics', difficulty: 'easy', text: "The spectral series of the hydrogen atom that lies in the visible region of the electromagnetic spectrum", options: ['Paschen', 'Balmer', 'Lyman', 'Brackett'], answer: 1, year: 2025 },
  { id: 'mht_6', exam: 'mhtcet', subject: 'physics', difficulty: 'easy', text: "The amount of heat energy radiated by a metal at temperature T is E. When the temperature is increased to 3T, energy radiated is", options: ['8 1E', '9 E', '3 E', '27 E'], answer: 0, year: 2025 },
  { id: 'mht_7', exam: 'mhtcet', subject: 'physics', difficulty: 'easy', text: "A man, of mass 60 kg, is riding in a lift. The weights of the man, when the lift is accelerating upwards and down wards at 2m/s2 are respectively (Taking g=2m/s2)", options: ['720 N and 480 N', '480 N and 720 N', '600 N and 800 N', 'None of these'], answer: 0, year: 2025 },
  { id: 'mht_8', exam: 'mhtcet', subject: 'chemistry', difficulty: 'easy', text: "Schottky defect in a crystal is observed when ,", options: ['Unequal number of cations and anions are missing from the lattice', 'Equal number of cations and anions are missing from the lattice', 'An ion leaves its normal site and occupies an interstitial site', 'No ion is missing from its lattice site'], answer: 1, year: 2025 },
  { id: 'mht_9', exam: 'mhtcet', subject: 'chemistry', difficulty: 'easy', text: "The simplest way to check whether a system is colloidal is by", options: ['Electrodialysis', 'Finding out particle size', 'Tyndall effect', 'Brownian movement'], answer: 2, year: 2025 },
  { id: 'mht_10', exam: 'mhtcet', subject: 'chemistry', difficulty: 'easy', text: "An example for a strong electrolyte is", options: ['Urea', 'Ammonium hydroxide', 'Sugar', 'Sodium acetate'], answer: 3, year: 2025 },
  { id: 'mht_11', exam: 'mhtcet', subject: 'chemistry', difficulty: 'easy', text: "An example of a salt that will not hydrolyse is", options: ['CH3COONH4', 'CH3COOK', 'NH4CI', 'KCI'], answer: 3, year: 2025 },
  { id: 'mht_12', exam: 'mhtcet', subject: 'chemistry', difficulty: 'easy', text: "C14 is", options: ['A natural non – radioactive isotope', 'An artificial non – radioactive isotope', 'An artificial radioactive isotope', 'A natural radioactive isotope'], answer: 3, year: 2025 },
  { id: 'mht_13', exam: 'mhtcet', subject: 'chemistry', difficulty: 'easy', text: "A cuprous ore among the following is", options: ['Cuprite', 'Malachite', 'Chalcopyrites', 'Azurite'], answer: 0, year: 2025 },
  { id: 'mht_14', exam: 'mhtcet', subject: 'chemistry', difficulty: 'easy', text: "Smallest among these species is", options: ['Lithium', 'Lithium ion', 'Hydrogen', 'Helium'], answer: 2, year: 2025 },
  { id: 'mht_15', exam: 'mhtcet', subject: 'chemistry', difficulty: 'easy', text: "Sodium chloride is an ionic compound where as hydrogen chloride gas is mainly convalent because", options: ['Electronegativity difference in the case of hydrogen in less than 2.1', 'Hydrogen chloride is a gas', 'Hydrogen is a non metal', 'Sodium is reactive'], answer: 0, year: 2025 },
  { id: 'mht_16', exam: 'mhtcet', subject: 'chemistry', difficulty: 'easy', text: "Convalent compounds have low melting point because", options: ['Convalent molecules are held by weak van der waal’s force of attraction', 'Convalent bond is less exothermic', 'Convalent bond is weaker than ionic bond', 'Convalent molecules have definite shape'], answer: 0, year: 2025 },
  { id: 'mht_17', exam: 'mhtcet', subject: 'chemistry', difficulty: 'easy', text: "Which of the following is an alloy of aluminium?", options: ['magnalium', 'duralumin', 'brass', 'both ‘a’ and ‘b’'], answer: 3, year: 2025 },
  { id: 'mht_18', exam: 'mhtcet', subject: 'chemistry', difficulty: 'easy', text: "3 meters away ?", options: ['0.8 m', '1.2m', '2.2m', '0.93 m'], answer: 0, year: 2025 },
  { id: 'mht_19', exam: 'mhtcet', subject: 'chemistry', difficulty: 'easy', text: "A condensation polymer among the following polymers is", options: ['Teflon', 'Polysterene', 'PVC', 'Decron'], answer: 3, year: 2025 },
  { id: 'mht_20', exam: 'mhtcet', subject: 'chemistry', difficulty: 'easy', text: "A compound that undergoes bromination easily is", options: ['Toluene', 'Benzoic acid', 'Phenol', 'Benzene'], answer: 2, year: 2025 },
  { id: 'mht_21', exam: 'mhtcet', subject: 'chemistry', difficulty: 'easy', text: "A sugar that is not a disaccharide among the following is", options: ['Galactose', 'Lactose', 'Maltose', 'Sucrose'], answer: 0, year: 2025 },
  { id: 'mht_22', exam: 'mhtcet', subject: 'chemistry', difficulty: 'easy', text: "Drying soil invariably contains", options: ['Butyric acid', 'Stearic acid', 'Lauric acid', 'Linoleic acid'], answer: 3, year: 2025 },
  { id: 'mht_23', exam: 'mhtcet', subject: 'chemistry', difficulty: 'easy', text: "Hetrocyclic amino acid among these compound is", options: ['Lysine', 'Tyrosine', 'Proline', 'Serine'], answer: 2, year: 2025 },
  { id: 'mht_24', exam: 'mhtcet', subject: 'chemistry', difficulty: 'easy', text: "Aluminium oxide is not reduced by chemical reactions since", options: ['Reducing agent contaminate', 'The process pollute the environment', 'Aluminium oxide is highly stable', 'Aluminium oxide is reactive'], answer: 2, year: 2025 },
  { id: 'mht_25', exam: 'mhtcet', subject: 'chemistry', difficulty: 'easy', text: "Iron loses magnetic property at", options: ['Melting point', '1000 K', 'Curie point', 'Boiling point'], answer: 2, year: 2025 },
  { id: 'mht_26', exam: 'mhtcet', subject: 'chemistry', difficulty: 'easy', text: "An example for a double salt is", options: ['Potassium ferricyanide', 'Cobalt hexamine chloride', 'Cuprous sulphate', 'Mohr’s salt'], answer: 3, year: 2025 },
  { id: 'mht_27', exam: 'mhtcet', subject: 'chemistry', difficulty: 'easy', text: "The set of compounds in which the reactivity of halogen atom in the ascending order is", options: ['Viny1 chloride, chloroethane, chlorobenzene', 'Viny1 chloride, chlorobenzene, chloroethane', 'chloroethane, chlorobenzene, Viny1 chloride', 'chlorobenzene, Viny1 chloride, chloroethane'], answer: 3, year: 2025 },
  { id: 'mht_28', exam: 'mhtcet', subject: 'physics', difficulty: 'easy', text: "Which one of the following pairs does not have the same dimension ?", options: ['Potential energy and Kinetic energy', 'Density and specific gravity', 'Focal length and height', 'Gravitational force and frictional force'], answer: 1, year: 2025 },
  { id: 'mht_29', exam: 'mhtcet', subject: 'physics', difficulty: 'easy', text: "Which one of the following physical quantity has the same unit as that of pressure ?", options: ['Angular momentum', 'Stress', 'Strain', 'Work'], answer: 1, year: 2025 },
  { id: 'mht_30', exam: 'mhtcet', subject: 'physics', difficulty: 'easy', text: "The symbol of SI unit of inductance is H. It stands for", options: ['Holm', 'Halogen', 'Henry', 'Hertz'], answer: 2, year: 2025 },
  { id: 'mht_31', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "A ball is dropped from a window 24 meters high. How long will it take to reach the ground ?", options: ['2.2 s', '1.2 s', '4.5 s', '0.2s'], answer: 0, year: 2025 },
  { id: 'mht_34', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "Two balls A and B of same masses are thrown from the top of the building. A, thrown upward with velocity V and B, thrown downward with velocity V, then–", options: ['Velocity of A is more than B at the ground', 'Velocity of B is more than A at the ground', 'Both A and B strike the ground with same velocity', 'None of these'], answer: 2, year: 2025 },
  { id: 'mht_35', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "A man getting down a running bus, falls forward because.", options: ['due to inertia of rest, road is left behind and man reaches forward', 'due to inertia of motion upper part of body continues to be in motion in forward direction while feet come to rest as soon as they touch the', 'he leans forward as a matter of habit', 'of the combined effect of all the three factors started in (a), (b) and (c)'], answer: 1, year: 2025 },
  { id: 'mht_36', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "A force 10N acts on a body of mass 20 kg for 10 sec. Change in its momentum is.", options: ['5 kg m/s', '100 kg m/s', '200 kg m/s', '1000 kg m/s'], answer: 1, year: 2025 },
  { id: 'mht_37', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "Swimming is possible on account of", options: ['first law of motion', 'second law of motion', 'third law of motion', 'newton\'s law of gravitation'], answer: 2, year: 2025 },
  { id: 'mht_38', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "What is the sign of the work done by gravity on an man standing on a platform ?", options: ['Zero', 'Positive', 'Negative', 'Depends on the particular situation'], answer: 0, year: 2025 },
  { id: 'mht_40', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "A shell following a parabolic path explodes somewhere in its flight. The centre of mass of fragements will continue to move in", options: ['vertical direction', 'any direction', 'horizontal direction', 'same parabolic path'], answer: 3, year: 2025 },
  { id: 'mht_41', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "Two particles of mass m1 and m2 (m1 > m2) attract each other with a force inversely proportional to the square of the distance between them. If the particles are initially held at rest and then released, the centre of mass will", options: ['move towards m1', 'move towards m2', 'remains at rest', 'None of these'], answer: 2, year: 2025 },
  { id: 'mht_42', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "In which case application of angular velocity is useful ?", options: ['When a body is rotating', 'when a velocity of body is in a straight line', 'When acceleration of body is in a straight line', 'None of these'], answer: 0, year: 2025 },
  { id: 'mht_43', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "S.I. Unit of G is", options: ['m s–2', 'N m² kg–2', 'No unit', 'None of these'], answer: 1, year: 2025 },
  { id: 'mht_44', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "Two particles are placed at some distance, If the mass of each of the two particles is doubled, keeping the distance between them unchanged, the value of gravitational force between them will be", options: ['', '4 times', '', 'unchanged'], answer: 1, year: 2025 },
  { id: 'mht_45', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "The weight of an object at the centre of the earth of radius R is", options: ['zero', 'infinite', 'R times the weight at the surface of the earth', '1/R² times the weight at surface of the earth'], answer: 0, year: 2025 },
  { id: 'mht_46', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "Value of G is", options: ['9.8 m s–2', '6.673 × 10–11 N m² kg–2', '6.673 N', '9.8 N'], answer: 1, year: 2025 },
  { id: 'mht_47', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "Young's modulus is defined as", options: ['the ratio of linear strain to the normal stress', 'the ratio of normal stress to strain', 'product of linear strain and normal stress', 'square of the ratio of normal stress to linear strain'], answer: 1, year: 2025 },
  { id: 'mht_48', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "Which of the following substance has the highest elasticity ?", options: ['Steel', 'Copper', 'Rubber', 'Sponge'], answer: 0, year: 2025 },
  { id: 'mht_49', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "Shearing strain is expressed by", options: ['angle of shear', 'angle of twist', 'decrease in volume', 'increase in volume'], answer: 0, year: 2025 },
  { id: 'mht_50', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "Human ears can sense sound waves travelling in air having wavelength of", options: ['10–3 m', '10–2 m', '1 m', '10² m'], answer: 2, year: 2025 },
  { id: 'mht_51', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "Which of the following statements is wrong ?", options: ['Sound travels in straight line', 'Sound is form of energy', 'Sound travels in the forms of waves', 'Sound travels faster in vacuum than in air'], answer: 3, year: 2025 },
  { id: 'mht_52', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "Voice of a friend is recognised by its", options: ['pitch', 'quality', 'intensity', 'velocity'], answer: 1, year: 2025 },
  { id: 'mht_53', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "Heat is transmitted from higher to lower temperature through actual mass motion of the molecules in", options: ['conduction', 'convection', 'radiation', 'None of these'], answer: 1, year: 2025 },
  { id: 'mht_54', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "The spectrum from a black body radiation is", options: ['line spectrum', 'band spectrum', 'continuous spectrum', 'line and band spectrum'], answer: 2, year: 2025 },
  { id: 'mht_55', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "A polished metal plate with a rough black spot on it is heated to abated 1400 K and quickly taken balck taken into a dark room. Which one of the following statements will be true ?", options: ['The spot will appear brighter than the plate', 'The spot will appear darker than the plate', 'The spot and plate will appear equally bright', 'The spot and the plate will not be visible in the dark'], answer: 0, year: 2025 },
  { id: 'mht_56', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "The wavelength of radiation emitted by a body depends upon", options: ['the natur of its surface', 'the area of its surface', 'the temperature of its surface', 'All of the above'], answer: 3, year: 2025 },
  { id: 'mht_57', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "The fastest mode of transfer of heat is", options: ['conduction', 'convection', 'radiation', 'None of these'], answer: 2, year: 2025 },
  { id: 'mht_58', exam: 'mhtcet', subject: 'chemistry', difficulty: 'medium', text: "The reciprocal of the combined resistance of any number of resistances connected in parallel is equal to", options: ['The sum of reciprocals of individiual resistances', 'reciprocal of the product of individiual resistances', 'reciprocal of sum of all the resistances', 'None of the above'], answer: 0, year: 2025 },
  { id: 'mht_59', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "A current of 1 A is drawn by a filament of an electric bulb. Number of electrons passing through a cross–section of the filament in 16 seconds woulbd be roughly", options: ['1020', '1016', '1018', '1023'], answer: 0, year: 2025 },
  { id: 'mht_60', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "Which of the following represents voltage ?", options: ['', 'Work done × Charge', '', 'Work done × Charge × Time'], answer: 0, year: 2025 },
  { id: 'mht_61', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "If the current I through a resistor is increased by 100% (assume that temperature remains unchanged, the increase in power dissipated will be", options: ['100%', '200%', '300%', '400%'], answer: 2, year: 2025 },
  { id: 'mht_62', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "When two or more resistors are connected in parallel,", options: ['The current passing through each resistor is same', 'The potential difference across each resistor is same', 'Both of the above', 'None of the above'], answer: 1, year: 2025 },
  { id: 'mht_63', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "An object placed at 2F of a convex lens will produce an image", options: ['at 2F', 'same size', 'real and inverted', 'All of these'], answer: 2, year: 2025 },
  { id: 'mht_64', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "An object placed between F and 2F of a convex lens will produce an image", options: ['beyond 2F', 'enlarged', 'real and inverted', 'All of these'], answer: 2, year: 2025 },
  { id: 'mht_65', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "A swimming pool looks shallower than it really is, when seen by a person standing outside near it, because of the phenomenon of", options: ['refraction of light', 'reflection of light', 'dispersion of light', 'None of these'], answer: 0, year: 2025 },
  { id: 'mht_66', exam: 'mhtcet', subject: 'chemistry', difficulty: 'medium', text: "In the extraction of some metals from their ores, coke can be used as a/an..............", options: ['oxidizing agent', 'reducing agent', 'catalyst', 'flux'], answer: 1, year: 2025 },
  { id: 'mht_67', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "................................ are used to produce energy in OTEC .", options: ['Tidal energy', 'Temperature difference between the different layers of water in ocean', 'Ocean waves', 'None of the above'], answer: 1, year: 2025 },
  { id: 'mht_68', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "A photon will have less energy, if its", options: ['amplitude is higher', 'frequency is higher', 'wavelength is longer', 'wavelength is shorter'], answer: 2, year: 2025 },
  { id: 'mht_69', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "A photoelectric cell converts", options: ['light energy into heat energy', 'light energy to sound energy', 'light energy into electric energy', 'electric energy into light energy'], answer: 2, year: 2025 },
  { id: 'mht_70', exam: 'mhtcet', subject: 'physics', difficulty: 'medium', text: "Light of a particular frequency v is incident on a metal surface. When the intensity of incident radiation is increased, the photoelectric current", options: ['decreases', 'increases', 'remain unchanged', 'sometimes increases and sometimes decreases'], answer: 1, year: 2025 },
  { id: 'mht_71', exam: 'mhtcet', subject: 'chemistry', difficulty: 'hard', text: "Which one of the following substances is used in the manufacture of safety matches ?", options: ['Red phosphorus', 'White phosphorus', 'Phosphorus trioxide (P2O3)', 'Black phosphorus'], answer: 0, year: 2025 },
  { id: 'mht_72', exam: 'mhtcet', subject: 'chemistry', difficulty: 'hard', text: "Which one of the following polymeric materials is used for making bullet proof jacket ?", options: ['Nylon –6, 6', 'Rayon', 'Kevlar', 'Dacron'], answer: 2, year: 2025 },
  { id: 'mht_73', exam: 'mhtcet', subject: 'chemistry', difficulty: 'hard', text: "Non–reacting gases have a tendency to mix with each other. This phenomenon is known as.", options: ['chemical reaction', 'diffusion', 'effusion', 'explosion'], answer: 2, year: 2025 },
  { id: 'mht_74', exam: 'mhtcet', subject: 'chemistry', difficulty: 'hard', text: "Alkali halids do not show Frenkel defect because", options: ['cations and anions have almost equal size', 'there is a large difference in size of cations and anions', 'cations and anions have low coordination number', 'anions cannot be accommodated in voids'], answer: 0, year: 2025 },
  { id: 'mht_75', exam: 'mhtcet', subject: 'chemistry', difficulty: 'hard', text: "In NaCl structure", options: ['all octahedral and tetrahedral sites are occupied', 'only octahedral sites are occupied', 'only tetrahedral sites are occupied', 'neither octahedral nor tetrahedral sites are occupied'], answer: 1, year: 2025 },
  { id: 'mht_76', exam: 'mhtcet', subject: 'chemistry', difficulty: 'hard', text: "A mixture of ZnCl2 and PbCl2 can be separated by.", options: ['distillation', 'crystallization', 'sublimation', 'adding acetic acid'], answer: 1, year: 2025 },
  { id: 'mht_77', exam: 'mhtcet', subject: 'chemistry', difficulty: 'hard', text: "Age of fossil may be found out by determining the ratio of two isotopes of carbon. The isotopes are.", options: ['C–12 and C–13', 'C–13 and C–14', 'C–12 and C–14', 'C–12 and carbon black'], answer: 2, year: 2025 },
  { id: 'mht_78', exam: 'mhtcet', subject: 'chemistry', difficulty: 'hard', text: "Which of the following radioactive substances enters/ enter the human body through food chain and causes/cause many physiological disorders ?", options: ['Strontium–90', 'Iodine – 131', 'Cesium – 137', 'All of the above'], answer: 3, year: 2025 },
  { id: 'mht_79', exam: 'mhtcet', subject: 'chemistry', difficulty: 'hard', text: "Rutherford's alpha–particle scattering experiment was responsible for the discovery of.", options: ['Electron', 'Proton', 'Nucleus', 'Helium'], answer: 2, year: 2025 },
  { id: 'mht_80', exam: 'mhtcet', subject: 'chemistry', difficulty: 'hard', text: "The species that has the same number of electrons as", options: ['', '', '', ''], answer: 2, year: 2025 },
  { id: 'mht_81', exam: 'mhtcet', subject: 'chemistry', difficulty: 'hard', text: "Who developed long form of the periodic table ?", options: ['Lothar Meyer', 'Neils Bohr', 'Mendeleev', 'Moseley'], answer: 1, year: 2025 },
  { id: 'mht_82', exam: 'mhtcet', subject: 'chemistry', difficulty: 'hard', text: "Which of the scientists given below discovered that periodic table should be based on the atomic number ?", options: ['Mendeleev', 'Newlands', 'Moseley', 'Lothar Meyer'], answer: 2, year: 2025 },
  { id: 'mht_83', exam: 'mhtcet', subject: 'chemistry', difficulty: 'hard', text: "Which of the following is non–metallic ?", options: ['B', 'Be', 'Mg', 'Al'], answer: 0, year: 2025 },
  { id: 'mht_84', exam: 'mhtcet', subject: 'chemistry', difficulty: 'hard', text: "The only non–metal which is liquid at ordinary temperature is", options: ['Hg', 'Br2', 'NH3', 'None of these'], answer: 1, year: 2025 },
  { id: 'mht_85', exam: 'mhtcet', subject: 'chemistry', difficulty: 'hard', text: "Which one of the following statements is correct ?", options: ['The oxidation number for hydrogen is always zero', 'The oxidation number for hydrogen is always +1', 'The oxidation number for hydrogen is always –1', 'Hydrogen can have more than one oxidation number'], answer: 3, year: 2025 },
  { id: 'mht_86', exam: 'mhtcet', subject: 'chemistry', difficulty: 'hard', text: "Which one of the following elements is least reactive with water ?", options: ['Lithium', 'Sodium', 'Potassium', 'Cesium'], answer: 0, year: 2025 },
  { id: 'mht_87', exam: 'mhtcet', subject: 'physics', difficulty: 'hard', text: "The ionization energy of hydrogen atom in the ground state is", options: ['13.6 MeV', '13.6 eV', '13.6 Joule', 'Zero'], answer: 1, year: 2025 },
  { id: 'mht_88', exam: 'mhtcet', subject: 'chemistry', difficulty: 'hard', text: "Which one of the following gases is placed second in respect of abundance in the Earth's atmosphere ?", options: ['Oxygen', 'Hydrogen', 'Nitrogen', 'Carbon dioxide'], answer: 0, year: 2025 },
  { id: 'mht_89', exam: 'mhtcet', subject: 'chemistry', difficulty: 'hard', text: "Stung by hairs of nettle leaves causes burning pain. This is due to the injection of", options: ['Acetic acid', 'Methanoic acid', 'Sulphuric acid', 'Hydrochloric acid'], answer: 1, year: 2025 },
  { id: 'mht_90', exam: 'mhtcet', subject: 'chemistry', difficulty: 'hard', text: "The chemical formula of baking soda is", options: ['Na2CO3', 'NaHCO3', 'CaCO3', 'NaOH'], answer: 1, year: 2025 },
  { id: 'mht_91', exam: 'mhtcet', subject: 'chemistry', difficulty: 'hard', text: "Nerve agents are a class of", options: ['phosphorus-containing organic chemicals', 'sulphur-containing organic chemicals', 'osmium-containing organic compounds', 'radon-containing organic compounds'], answer: 0, year: 2025 },
  { id: 'mht_92', exam: 'mhtcet', subject: 'chemistry', difficulty: 'hard', text: "The principal use of hydrofluoric acid is", options: ['in etching glass', 'as a bleaching agent', 'as an extremely strong oxidizing agent', 'in the preparation of strong organic fluorine compounds'], answer: 0, year: 2025 },
  { id: 'mht_93', exam: 'mhtcet', subject: 'chemistry', difficulty: 'hard', text: "Which of the following metals burn with a white dazzing light, with oxygen ?", options: ['Sodium', 'Potassium', 'Magnesium', 'Aluminium'], answer: 2, year: 2025 },
  { id: 'mht_94', exam: 'mhtcet', subject: 'chemistry', difficulty: 'hard', text: "Aluminium is obtained by the electrolysis of pure Al2O3 dissolved in", options: ['Bauxite', 'Cryolite', 'Feldspar', 'Alumina'], answer: 1, year: 2025 },
  { id: 'mht_95', exam: 'mhtcet', subject: 'chemistry', difficulty: 'hard', text: "Zinc is", options: ['non – metalleable', 'Brittle', 'ductile', '(a) and (b)'], answer: 3, year: 2025 },
  { id: 'mht_96', exam: 'mhtcet', subject: 'chemistry', difficulty: 'hard', text: "The only non–metal that has luster is", options: ['Sulphur', 'Phosphorus', 'Silicon', 'Iodine'], answer: 3, year: 2025 },
  { id: 'mht_97', exam: 'mhtcet', subject: 'chemistry', difficulty: 'hard', text: "A functional isomer of 1- butyne is", options: ['2-butyne', '1-butene', '2-butene', '1, 3 - butadience'], answer: 3, year: 2025 },
  { id: 'mht_98', exam: 'mhtcet', subject: 'chemistry', difficulty: 'hard', text: "The compound C4H10O can show", options: ['metamerism', 'functional isomerism', 'position isomerism', 'All of these'], answer: 3, year: 2025 },
  { id: 'mht_99', exam: 'mhtcet', subject: 'chemistry', difficulty: 'hard', text: "Which pair of isomerism is not possible together ?", options: ['Ring-chain and functional', 'Geometrical and optical', 'Metamerism and functional', 'Metamerism and chain'], answer: 2, year: 2025 },
  { id: 'mht_100', exam: 'mhtcet', subject: 'chemistry', difficulty: 'hard', text: "Purification of petroleum is carried out by", options: ['fractional distillation', 'steam distillation', 'vacuum distillation', 'simple distillation'], answer: 0, year: 2025 },
];

// ─── PYQ Integration ──────────────────────────────────────────────────────────
// Merge real MHT-CET PYQ questions into allQuestions pool when practice loads,
// and use them in quickStart for mhtcet exam.

// Override fetchQuestions to merge PYQ
const _origFetchQuestions = window.fetchQuestions || fetchQuestions;
window.fetchQuestions = async function() {
  let base = await _origFetchQuestions();
  // Merge MHT-CET PYQ — avoid duplicates by id
  const existingIds = new Set(base.map(q => q.id));
  const newOnes = MHT_CET_QUESTIONS.filter(q => !existingIds.has(q.id));
  return [...base, ...newOnes];
};

// Override quickStart to use PYQ for mhtcet
const _origQuickStart = window.quickStart || quickStart;
window.quickStart = function(exam) {
  // If allQuestions already has PYQ (from practice page load), use it
  // Otherwise merge PYQ directly for the mock test
  if (exam === 'mhtcet') {
    const pool = allQuestions.length > 0
      ? allQuestions.filter(q => q.exam === 'mhtcet')
      : MHT_CET_QUESTIONS;
    if (pool.length === 0) {
      
      return;
    }
    const selected = shuffleArray(pool).slice(0, Math.min(50, pool.length));
    startTest(selected, 'mhtcet');
  } else {
    _origQuickStart(exam);
  }
};

// Show PYQ stats in the exam card subtitle
document.addEventListener('supabase:ready', () => {
  // Update the exam card descriptions with live counts
  setTimeout(() => {
    const mhtInfo = document.querySelector('.exam-card:nth-child(2) .exam-info p');
    if (mhtInfo) mhtInfo.textContent = 'PCM + Chemistry · ' + MHT_CET_QUESTIONS.length + ' PYQ questions';
  }, 500);
});

// ═══════════════════════════════════════════════════════════════════
//  REAL CBT ENGINE — appended, zero changes to original code above
// ═══════════════════════════════════════════════════════════════════

// ─── Exam configs (structure mirrors real exams) ──────────────────────────────
const EXAM_CONFIG = {
  jee: {
    name: 'JEE Main', label: 'JEE Main 2025', duration: 180,
    sections: [
      { name: 'Physics',     subject: 'physics',     mcq: 20, integer: 5, mcqMarks: [4,-1], intMarks: [4,0] },
      { name: 'Chemistry',   subject: 'chemistry',   mcq: 20, integer: 5, mcqMarks: [4,-1], intMarks: [4,0] },
      { name: 'Mathematics', subject: 'mathematics', mcq: 20, integer: 5, mcqMarks: [4,-1], intMarks: [4,0] },
    ]
  },
  mhtcet: {
    name: 'MHT-CET', label: 'MHT-CET 2025',
    // MHT-CET has TWO timed groups:
    //   Group 1 — Physics (50Q, +1/0) + Chemistry (50Q, +1/0) → 90 min
    //   Group 2 — Mathematics (50Q, +2/0) → 90 min
    // Total: 150 questions, 180 min
    duration: 180,
    timerGroups: [
      { sectionIndexes: [0, 1], minutes: 90, label: 'Physics & Chemistry' },
      { sectionIndexes: [2],    minutes: 90, label: 'Mathematics' },
    ],
    sections: [
      { name: 'Physics',     subject: 'physics',     mcq: 50, integer: 0, mcqMarks: [1,0], intMarks: [1,0], group: 0 },
      { name: 'Chemistry',   subject: 'chemistry',   mcq: 50, integer: 0, mcqMarks: [1,0], intMarks: [1,0], group: 0 },
      { name: 'Mathematics', subject: 'mathematics', mcq: 50, integer: 0, mcqMarks: [2,0], intMarks: [2,0], group: 1 },
    ]
  },
  neet: {
    name: 'NEET', label: 'NEET 2025', duration: 200,
    sections: [
      { name: 'Physics',   subject: 'physics',   mcq: 45, integer: 0, mcqMarks: [4,-1], intMarks: [4,-1] },
      { name: 'Chemistry', subject: 'chemistry', mcq: 45, integer: 0, mcqMarks: [4,-1], intMarks: [4,-1] },
      { name: 'Biology',   subject: 'biology',   mcq: 90, integer: 0, mcqMarks: [4,-1], intMarks: [4,-1] },
    ]
  },
  generic: {
    name: 'Generic Test', label: 'Generic Mock Test', duration: 90,
    sections: [
      { name: 'General', subject: null, mcq: 30, integer: 0, mcqMarks: [4,-1], intMarks: [4,0] },
    ]
  }
};

// ─── CBT state extensions ─────────────────────────────────────────────────────
// These extend testState which is already defined in original code
let cbtSections = [];        // array of { name, subject, startIdx, endIdx, mcq, integer, mcqMarks, intMarks }
let cbtCurrentSection = 0;   // active section tab index
let cbtVisited = [];         // per-question visited flag
let cbtQTypes = [];          // per-question: 'mcq' or 'integer'

// ─── Override quickStart ──────────────────────────────────────────────────────
const _cbt_origQuickStart = window.quickStart;
window.quickStart = function(exam) {
  const cfg = EXAM_CONFIG[exam] || EXAM_CONFIG.generic;
  const pool = (allQuestions.length > 0 ? allQuestions : DEMO_QUESTIONS);

  // Build per-section question arrays
  const sectionsData = [];
  let allSelected = [];

  cfg.sections.forEach(sec => {
    // Match subject (case-insensitive). Prefer this exam's own questions,
    // then fall back to ANY exam's questions of the same subject (CET often
    // has too few of its own — JEE-level questions of the same subject are
    // valid practice), and only then to demos.
    const wantSubj = (sec.subject || '').toLowerCase();
    const sameSubject = q => (q.subject || '').toLowerCase() === wantSubj;

    let secPool = pool.filter(q => sameSubject(q) && (q.exam === exam));
    if (secPool.length < (sec.mcq + sec.integer)) {
      // top up from same subject, any exam (deduped)
      const have = new Set(secPool.map(q => q.id));
      const extra = pool.filter(q => sameSubject(q) && !have.has(q.id));
      secPool = secPool.concat(extra);
    }
    if (!sec.subject) {
      secPool = pool.filter(q => q.exam === exam || exam === 'generic');
    }

    const shuffled = shuffleArray(secPool);
    const needed = sec.mcq + sec.integer;
    const taken = shuffled.slice(0, Math.min(needed, shuffled.length));

    // Pad with demo if not enough
    const extra = needed - taken.length;
    if (extra > 0) {
      const demos = shuffleArray(DEMO_QUESTIONS.filter(q =>
        !sec.subject || q.subject === sec.subject
      )).slice(0, extra);
      taken.push(...demos);
    }

    const startIdx = allSelected.length;
    // Mark integer-type questions (last `integer` in the section)
    taken.forEach((q, i) => {
      const isInt = i >= sec.mcq;
      allSelected.push({ ...q, _isInteger: isInt });
    });

    sectionsData.push({
      name: sec.name,
      subject: sec.subject,
      startIdx,
      endIdx: allSelected.length - 1,
      mcq: sec.mcq,
      integer: sec.integer,
      mcqMarks: sec.mcqMarks,
      intMarks: sec.intMarks,
      count: taken.length,
    });
  });

  if (allSelected.length === 0) {
    
    return;
  }

  cbtSections = sectionsData;
  cbtCurrentSection = 0;
  cbtVisited = new Array(allSelected.length).fill(false);
  cbtQTypes = allSelected.map(q => q._isInteger ? 'integer' : 'mcq');
  mhtTimerGroup = 0; // reset MHT-CET group timer

  _cbt_startTest(allSelected, exam, cfg);
};

// ─── Main CBT start (replaces startTest for structured exams) ─────────────────
function _cbt_startTest(questions, exam, cfg) {
  testState = {
    questions,
    answers: new Array(questions.length).fill(null),
    reviews: new Array(questions.length).fill(false),
    currentIdx: 0,
    exam,
    elapsed: 0,
  };

  navigateTo('mocktest');
  _hide('pretestState');
  _hide('testResult');
  _hide('activeTest');
  _show('testInstructions');

  // Populate instructions
  const name = currentUser?.user_metadata?.full_name || 'Candidate';
  document.getElementById('instrExamName').textContent = cfg.label;
  document.getElementById('instrCandidateName').textContent = name;
  document.getElementById('instrExamLabel').textContent = cfg.name;
  document.getElementById('instrTotalQ').textContent = questions.length;
  document.getElementById('instrDuration').textContent = cfg.duration + ' minutes';

  const maxMarks = cbtSections.reduce((s, sec) => {
    return s + sec.mcq * sec.mcqMarks[0] + sec.integer * sec.intMarks[0];
  }, 0);
  document.getElementById('instrTotalMarks').textContent = maxMarks;

  document.getElementById('instrSections').innerHTML = cbtSections.map(sec =>
    '<div class="instr-row"><span>' + sec.name + '</span><strong>' + sec.count + ' Q · +' + sec.mcqMarks[0] + (sec.mcqMarks[1] < 0 ? '/' + sec.mcqMarks[1] : '/0') + '</strong></div>'
  ).join('');

  // MHT-CET: show split-timer info + per-section marks; others show single scheme
  if (testState?.exam === 'mhtcet' && cfg.timerGroups) {
    document.getElementById('instrDuration').textContent = '90 min (P&C) + 90 min (Maths)';
    document.getElementById('instrScheme').innerHTML =
      '<span class="scheme-pill pos">Physics & Chemistry: +1 Correct</span>' +
      '<span class="scheme-pill zero">No Negative Marking</span>' +
      '<span class="scheme-pill pos">Mathematics: +2 Correct</span>' +
      '<span class="scheme-pill zero">No Negative Marking</span>';
  } else {
    const ms = cbtSections[0];
    document.getElementById('instrScheme').innerHTML =
      '<span class="scheme-pill pos">+' + ms.mcqMarks[0] + ' Correct</span>' +
      (ms.mcqMarks[1] < 0 ? '<span class="scheme-pill neg">' + ms.mcqMarks[1] + ' Wrong</span>' : '<span class="scheme-pill zero">0 Wrong (no negative)</span>') +
      '<span class="scheme-pill zero">0 Unattempted</span>';
  }

  // Agree checkbox
  const agreeChk = document.getElementById('instrAgree');
  const startBtn  = document.getElementById('instrStartBtn');
  agreeChk.checked = false;
  agreeChk.onchange = () => startBtn.classList.toggle('ready', agreeChk.checked);
  startBtn.onclick = () => {
    if (!agreeChk.checked) return;
    _hide('testInstructions');
    _cbt_beginActiveTest(cfg, name);
  };
}

function _cbt_beginActiveTest(cfg, name) {
  _show('activeTest');

  // Candidate info
  const initials = name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('cbtCandidateName').textContent = name;
  document.getElementById('cbtExamBadge').textContent = cfg.name;
  document.getElementById('sidebarAvatar').textContent = initials;
  document.getElementById('sidebarName').textContent = name;
  document.getElementById('sidebarExam').textContent = cfg.name;

  // Build section tabs
  _cbt_buildSectionTabs();
  _cbt_buildPalette();
  _cbt_renderQuestion();
  startTimer();

  // Fullscreen
  _requestFS();

  // Wire buttons (clone to remove old listeners)
  _rebind('prevBtn',            () => _cbt_prevQuestion());
  _rebind('nextBtn',            () => _cbt_nextQuestion());
  _rebind('reviewBtn',          () => _cbt_markReview());
  _rebind('clearBtn',           () => _cbt_clearResponse());
  _rebind('submitTestBtn',      () => _cbt_submitTest());
  _rebind('submitTestBtnInline',() => _cbt_submitTest());

  // Integer input live-update
  const intInput = document.getElementById('integerInput');
  intInput.oninput = () => {
    const val = intInput.value.trim();
    testState.answers[testState.currentIdx] = val === '' ? null : parseInt(val);
    _cbt_updatePaletteItem(testState.currentIdx);
    _updateInlineSubmit(testState.questions.length);
  };
}

function _rebind(id, fn) {
  const old = document.getElementById(id);
  if (!old) return;
  const f = old.cloneNode(true);
  old.parentNode.replaceChild(f, old);
  document.getElementById(id).addEventListener('click', fn);
}

// ─── Section tabs ─────────────────────────────────────────────────────────────
function _cbt_buildSectionTabs() {
  document.getElementById('sectionTabs').innerHTML = cbtSections.map((sec, i) =>
    '<button class="section-tab' + (i === 0 ? ' active' : '') + '" onclick="_cbt_switchSection(' + i + ')">' +
    sec.name + '<span class="tab-count">' + sec.count + '</span></button>'
  ).join('');
}

function _cbt_switchSection(idx) {
  cbtCurrentSection = idx;
  document.querySelectorAll('.section-tab').forEach((t, i) => t.classList.toggle('active', i === idx));
  testState.currentIdx = cbtSections[idx].startIdx;
  _cbt_buildPalette();
  _cbt_renderQuestion();
}

// ─── Palette ──────────────────────────────────────────────────────────────────
function _cbt_buildPalette() {
  const sec = cbtSections[cbtCurrentSection];
  document.getElementById('paletteSectionLabel').textContent = sec.name + ' Questions';

  const items = [];
  for (let i = sec.startIdx; i <= sec.endIdx; i++) {
    const relNum = i - sec.startIdx + 1;
    const cls = _cbt_paletteClass(i);
    items.push('<div class="palette-num ' + cls + (i === testState.currentIdx ? ' current' : '') +
      '" onclick="_cbt_jumpTo(' + i + ')">' + relNum + '</div>');
  }
  document.getElementById('questionPalette').innerHTML = items.join('');
  _cbt_updateSectionSummary();
}

function _cbt_paletteClass(i) {
  const ans = testState.answers[i];
  const rev = testState.reviews[i];
  const vis = cbtVisited[i];
  if (rev && ans !== null) return 'answeredreview';
  if (rev) return 'review';
  if (ans !== null) return 'answered';
  if (vis) return 'notanswered';
  return 'notvisited';
}

function _cbt_updatePaletteItem(idx) {
  const sec = cbtSections[cbtCurrentSection];
  const relNum = idx - sec.startIdx;
  const items = document.querySelectorAll('.palette-num');
  if (items[relNum]) {
    items[relNum].className = 'palette-num ' + _cbt_paletteClass(idx) + (idx === testState.currentIdx ? ' current' : '');
  }
  _cbt_updateSectionSummary();
}

function _cbt_updateSectionSummary() {
  const sec = cbtSections[cbtCurrentSection];
  let ans=0, rev=0, notAns=0, notVis=0;
  for (let i = sec.startIdx; i <= sec.endIdx; i++) {
    const cls = _cbt_paletteClass(i);
    if (cls === 'answered' || cls === 'answeredreview') ans++;
    else if (cls === 'review') rev++;
    else if (cls === 'notanswered') notAns++;
    else notVis++;
  }
  document.getElementById('sectionSummary').innerHTML =
    '<div class="ss-item"><div class="ss-dot" style="background:#22c55e"></div>' + ans + ' Answered</div>' +
    '<div class="ss-item"><div class="ss-dot" style="background:#8b5cf6"></div>' + rev + ' Review</div>' +
    '<div class="ss-item"><div class="ss-dot" style="background:#ef4444"></div>' + notAns + ' Not Ans</div>' +
    '<div class="ss-item"><div class="ss-dot" style="background:#94a3b8"></div>' + notVis + ' Not Visited</div>';
}

// ─── Question render ───────────────────────────────────────────────────────────
// ─── Math/symbol rendering (KaTeX) ────────────────────────────────────────────
// Renders LaTeX like $x^2$, \frac{a}{b}, \alpha. Falls back to escaped text
// if KaTeX isn't loaded or the expression is invalid.
function _escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function _renderMath(str) {
  if (str == null) return '';
  str = String(str);
  if (typeof katex === 'undefined') return _escapeHtml(str);
  // Replace $...$ inline math segments; escape the rest as plain text
  const hasDollar = str.indexOf('$') !== -1;
  const looksLatex = /\\[a-zA-Z]+|\^|_\{|\\frac|\\sqrt/.test(str);
  if (!hasDollar && !looksLatex) return _escapeHtml(str);
  try {
    if (hasDollar) {
      // split on $...$ and render each math part
      let out = '', parts = str.split('$');
      for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 1) {
          out += katex.renderToString(parts[i], { throwOnError: false, displayMode: false });
        } else {
          out += _escapeHtml(parts[i]);
        }
      }
      return out;
    }
    // whole string is latex-ish
    return katex.renderToString(str, { throwOnError: false, displayMode: false });
  } catch (e) {
    return _escapeHtml(str);
  }
}

function _cbt_renderQuestion() {
  const { questions, currentIdx, answers, reviews } = testState;
  const q = questions[currentIdx];
  const isInt = cbtQTypes[currentIdx] === 'integer';

  // Mark visited
  cbtVisited[currentIdx] = true;

  // Find section index
  const secIdx = cbtSections.findIndex(s => currentIdx >= s.startIdx && currentIdx <= s.endIdx);
  const sec = cbtSections[secIdx];
  const relNum = currentIdx - sec.startIdx + 1;

  document.getElementById('questionProgress').textContent =
    sec.name + ' — Q ' + relNum + ' of ' + sec.count;
  document.getElementById('questionTitle').textContent =
    'Question ' + relNum;

  // Type badge
  const badge = document.getElementById('qTypeBadge');
  badge.textContent = isInt ? 'Integer Type' : 'MCQ';
  badge.className = 'q-type-badge ' + (isInt ? 'integer' : 'mcq');

  // Question text / image
  if (q.image_svg) {
    document.getElementById('questionContent').innerHTML =
      (q.text ? '<p>' + _renderMath(q.text.replace(/\[STRUCTURE:[^\]]*\]/g,'')) + '</p>' : '') +
      '<div style="margin-top:10px;border-radius:8px;overflow:hidden;border:1px solid var(--bg3);background:#fff">' + q.image_svg + '</div>';
  } else if (q.image_url) {
    document.getElementById('questionContent').innerHTML =
      (q.text ? '<p>' + _renderMath(q.text) + '</p>' : '') +
      '<img src="' + q.image_url + '" style="max-width:100%;border-radius:8px;margin-top:8px;" />';
  } else {
    document.getElementById('questionContent').innerHTML = _renderMath(q.text);
  }

  // Options or integer input
  const optsCont = document.getElementById('optionsContainer');
  const intWrap  = document.getElementById('integerInputWrap');
  const intInput = document.getElementById('integerInput');

  const review = testState.reviewMode === true;

  if (isInt) {
    optsCont.innerHTML = '';
    intWrap.classList.remove('hidden');
    intInput.value = answers[currentIdx] !== null ? answers[currentIdx] : '';
    intInput.disabled = review;
    if (review) {
      const correctVal = q.answer;
      const userVal = answers[currentIdx];
      optsCont.innerHTML = '<div style="margin-top:8px;font-size:14px;">' +
        (userVal == correctVal
          ? '<span style="color:#16a34a">✓ Correct</span>'
          : '<span style="color:#dc2626">✗ Your answer: ' + (userVal ?? '—') +
            ' · Correct: ' + correctVal + '</span>') + '</div>';
    }
  } else {
    intWrap.classList.add('hidden');
    const labels = ['A','B','C','D'];
    optsCont.innerHTML = (q.options || []).map((opt, i) => {
      let cls = 'option-btn';
      let click = 'onclick="cbtSelectOption(' + i + ')"';
      if (review) {
        click = 'disabled style="cursor:default"';   // lock in review
        if (i === q.answer) cls += ' opt-correct';
        else if (answers[currentIdx] === i) cls += ' opt-wrong';
      } else if (answers[currentIdx] === i) {
        cls += ' selected';
      }
      return '<button class="' + cls + '" ' + click + '><span class="option-label">' +
        labels[i] + '</span>' + _renderMath(opt) + '</button>';
    }).join('');
  }

  // Review btn highlight
  document.getElementById('reviewBtn').style.background = reviews[currentIdx] ? '#8b5cf6' : '';

  // Palette
  _cbt_buildPalette();
  _updateInlineSubmit(questions.length);
}

// ─── Navigation ───────────────────────────────────────────────────────────────
window.cbtSelectOption = function(idx) {
  testState.answers[testState.currentIdx] = idx;
  _cbt_renderQuestion();
};

function _cbt_jumpTo(idx) {
  testState.currentIdx = idx;
  // switch section tab if needed
  const si = cbtSections.findIndex(s => idx >= s.startIdx && idx <= s.endIdx);
  if (si !== cbtCurrentSection) {
    cbtCurrentSection = si;
    document.querySelectorAll('.section-tab').forEach((t, i) => t.classList.toggle('active', i === si));
  }
  _cbt_renderQuestion();
}

function _cbt_prevQuestion() {
  if (testState.currentIdx > 0) {
    testState.currentIdx--;
    // auto switch section
    const si = cbtSections.findIndex(s => testState.currentIdx >= s.startIdx && testState.currentIdx <= s.endIdx);
    if (si !== cbtCurrentSection) { cbtCurrentSection = si; _cbt_buildSectionTabs(); }
    _cbt_renderQuestion();
  }
}

function _cbt_nextQuestion() {
  if (testState.currentIdx < testState.questions.length - 1) {
    testState.currentIdx++;
    const si = cbtSections.findIndex(s => testState.currentIdx >= s.startIdx && testState.currentIdx <= s.endIdx);
    if (si !== cbtCurrentSection) { cbtCurrentSection = si; _cbt_buildSectionTabs(); }
    _cbt_renderQuestion();
  }
}

function _cbt_markReview() {
  testState.reviews[testState.currentIdx] = !testState.reviews[testState.currentIdx];
  _cbt_nextQuestion();
}

function _cbt_clearResponse() {
  testState.answers[testState.currentIdx] = null;
  const intInput = document.getElementById('integerInput');
  if (intInput) intInput.value = '';
  _cbt_renderQuestion();
}

// ─── Timer override for CBT (uses exam duration) ──────────────────────────────
const _cbt_origStartTimer = window.startTimer;
window.startTimer = function() {
  clearInterval(timerInterval);
  const cfg = EXAM_CONFIG[testState?.exam] || EXAM_CONFIG.generic;
  const duration = cfg.duration * 60;
  let remaining = duration;
  updateTimerDisplay(remaining);
  timerInterval = setInterval(() => {
    remaining--;
    testState.elapsed = duration - remaining;
    updateTimerDisplay(remaining);
    const el = document.getElementById('testTimer');
    if (el) el.classList.toggle('warning', remaining <= 300);
    if (remaining <= 0) { clearInterval(timerInterval); _cbt_submitTest(); }
  }, 1000);
};

// ─── Submit & Score (exam-specific marking) ───────────────────────────────────
async function _cbt_submitTest() {
  clearInterval(timerInterval);
  _exitFS();

  const { questions, answers } = testState;
  let totalMarks = 0, correct = 0, incorrect = 0, skipped = 0;
  const sectionResults = cbtSections.map(sec => {
    let sm = 0, sc = 0, si = 0, ss = 0;
    for (let i = sec.startIdx; i <= sec.endIdx; i++) {
      const ans = answers[i];
      const isInt = cbtQTypes[i] === 'integer';
      const marks = isInt ? sec.intMarks : sec.mcqMarks;
      if (ans === null) { ss++; }
      else if (ans === questions[i].answer) { sm += marks[0]; sc++; correct++; }
      else { sm += marks[1]; si++; incorrect++; }
    }
    skipped += ss;
    totalMarks += sm;
    return { name: sec.name, marks: sm, correct: sc, incorrect: si, skipped: ss, total: sec.count };
  });

  // Max possible marks
  const maxMarks = cbtSections.reduce((s, sec) =>
    s + sec.mcq * sec.mcqMarks[0] + sec.integer * sec.intMarks[0], 0);
  const scorePct = maxMarks > 0 ? Math.round(Math.max(0, totalMarks) / maxMarks * 100) : 0;

  _hide('activeTest');
  _show('testResult');
  document.getElementById('resultMarks').textContent =
    Math.max(0, totalMarks) + ' / ' + maxMarks + ' marks';
  document.getElementById('resultScore').textContent = scorePct + '%';
  document.getElementById('resultCorrect').textContent = correct;
  document.getElementById('resultIncorrect').textContent = incorrect;
  document.getElementById('resultSkipped').textContent = skipped;

  const pct = scorePct;
  document.querySelector('.score-circle').style.background =
    'conic-gradient(var(--accent) ' + pct + '%, var(--bg3) ' + pct + '%)';

  // Per-section breakdown
  document.getElementById('resultSectionBreakdown').innerHTML =
    sectionResults.map(r =>
      '<div class="rsb-card"><h5>' + r.name + '</h5>' +
      '<div class="rsb-val">' + Math.max(0, r.marks) + ' marks</div>' +
      '<small style="color:var(--fg2)">' + r.correct + '✓ ' + r.incorrect + '✗ ' + r.skipped + ' skip</small></div>'
    ).join('');

  // Save to Supabase AND localStorage (bulletproof — analytics works either way)
  const attemptRecord = {
    exam_name: (EXAM_CONFIG[testState.exam]?.name || testState.exam || 'Mock Test').toUpperCase(),
    total: Math.max(0, questions.length | 0),
    correct: Math.max(0, correct | 0),
    incorrect: Math.max(0, incorrect | 0),
    skipped: Math.max(0, skipped | 0),
    score: Math.max(0, Math.min(100, Math.round(scorePct))),
    created_at: new Date().toISOString(),
  };
  const subject_breakdown = sectionResults.map(r => ({
    subject: r.name.toLowerCase(),
    correct: Math.max(0, r.correct | 0),
    incorrect: Math.max(0, r.incorrect | 0),
    skipped: Math.max(0, r.skipped | 0),
    total: Math.max(0, r.total | 0),
    marks: Math.max(0, r.marks),
  }));

  // Always save locally first so analytics never shows empty
  try {
    const local = JSON.parse(localStorage.getItem('mm_tests') || '[]');
    local.unshift({ ...attemptRecord, subject_breakdown });
    localStorage.setItem('mm_tests', JSON.stringify(local.slice(0, 50)));
  } catch(e) {}

  // Then try Supabase for logged-in users
  if (window._supabase && currentUser?.id && currentUser.id !== 'demo') {
    try {
      const { error } = await db.from('test_attempts').insert({
        user_id: currentUser.id,
        ...attemptRecord,
        subject_breakdown,
      });
      if (error) {
        console.error('❌ Test save to Supabase failed:', error.message, error.details, error.hint);
      } else {
        console.log('✅ Test saved to Supabase');
      }
    } catch(e) {
      console.error('❌ Test save threw:', e);
    }
  }
  userTests = (() => { try { return JSON.parse(localStorage.getItem('mm_tests')||'[]'); } catch { return []; } })();

  // Record daily goal activity
  recordDailyActivity(questions.length, correct);

  document.getElementById('reviewAnswersBtn').onclick = () => {
    _hide('testResult');
    _show('activeTest');
    testState.reviewMode = true;   // lock answers, show correct/wrong
    testState.currentIdx = 0;
    cbtCurrentSection = 0;
    _cbt_buildSectionTabs();
    _cbt_renderQuestion();
  };
}

// ─── Exam-aware dashboard cards ───────────────────────────────────────────────
// Read user's target exam from signup and personalise dashboard
document.addEventListener('supabase:ready', () => {
  setTimeout(() => {
    const targetExam = currentUser?.user_metadata?.target_exam || 'generic';
    const cfg = EXAM_CONFIG[targetExam] || EXAM_CONFIG.generic;

    // Highlight their exam card
    document.querySelectorAll('.exam-card').forEach(card => {
      const cardExam = card.getAttribute('onclick')?.match(/'(\w+)'/)?.[1];
      if (cardExam === targetExam) {
        card.style.border = '2px solid var(--accent)';
        card.style.boxShadow = '0 0 0 4px color-mix(in srgb, var(--accent) 15%, transparent)';
        const badge = document.createElement('span');
        badge.style.cssText = 'font-size:0.7rem;background:var(--accent);color:#fff;border-radius:10px;padding:2px 8px;margin-left:6px;';
        badge.textContent = 'Your Exam';
        card.querySelector('h4')?.appendChild(badge);
      }
    });

    // Update dashboard subtitle with exam
    const nameEl = document.getElementById('dashboardSubtitle');
    const uname = currentUser?.user_metadata?.full_name;
    if (nameEl && uname) {
      nameEl.textContent = 'Hello, ' + uname + '! Preparing for ' + cfg.name;
    }
  }, 600);
});

// ═══════════════════════════════════════════════════════════════════
//  MHT-CET SPLIT TIMER & SECTION LOCK
// ═══════════════════════════════════════════════════════════════════

let mhtTimerGroup = 0;       // 0 = PC group, 1 = Maths group
let mhtGroupInterval = null;

// Override startTimer for MHT-CET split-timer behaviour
const _mht_origStartTimer = window.startTimer;
window.startTimer = function() {
  if (testState?.exam !== 'mhtcet') {
    _mht_origStartTimer();
    return;
  }
  mhtTimerGroup = 0;
  _mht_startGroupTimer();
};

function _mht_startGroupTimer() {
  clearInterval(timerInterval);
  clearInterval(mhtGroupInterval);

  const cfg = EXAM_CONFIG.mhtcet;
  const group = cfg.timerGroups[mhtTimerGroup];
  let remaining = group.minutes * 60;

  // Lock/unlock tabs for current group
  _mht_applyTabLocks();

  // Show which group is active in topbar
  const badge = document.getElementById('cbtExamBadge');
  if (badge) badge.textContent = 'MHT-CET — ' + group.label + ' (' + group.minutes + ' min)';

  updateTimerDisplay(remaining);

  timerInterval = setInterval(() => {
    remaining--;
    testState.elapsed = (testState.elapsed || 0) + 1;
    updateTimerDisplay(remaining);
    const el = document.getElementById('testTimer');
    if (el) el.classList.toggle('warning', remaining <= 300);

    if (remaining <= 0) {
      clearInterval(timerInterval);
      _mht_onGroupTimeUp();
    }
  }, 1000);
}

function _mht_onGroupTimeUp() {
  const cfg = EXAM_CONFIG.mhtcet;
  if (mhtTimerGroup === 0) {
    // PC group done → move to Maths
    mhtTimerGroup = 1;
    const mathsStart = cbtSections[2]?.startIdx ?? 0;
    testState.currentIdx = mathsStart;
    cbtCurrentSection = 2;

    // Show transition alert
    _mht_showGroupTransition('Physics & Chemistry time is up!', 'Starting Mathematics section — 90 minutes');

    setTimeout(() => {
      _mht_startGroupTimer();
      _cbt_buildSectionTabs();
      _cbt_renderQuestion();
    }, 3000);
  } else {
    // Both groups done → auto submit
    _cbt_submitTest();
  }
}

function _mht_showGroupTransition(line1, line2) {
  // Show a brief full-screen notice
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:99999;
    display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;
    font-family:'Sora',sans-serif;text-align:center;padding:24px;
  `;
  overlay.innerHTML = `
    <div style="font-size:2rem;margin-bottom:12px;">⏱</div>
    <h2 style="font-size:1.5rem;margin-bottom:8px;">${line1}</h2>
    <p style="font-size:1rem;color:#94a3b8;margin-bottom:18px;">${line2}</p>
    <div style="font-size:0.85rem;color:#64748b;">Starting in 3 seconds…</div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 3000);
}

function _mht_applyTabLocks() {
  if (testState?.exam !== 'mhtcet') return;
  const cfg = EXAM_CONFIG.mhtcet;
  const activeGroupIndexes = cfg.timerGroups[mhtTimerGroup].sectionIndexes;

  document.querySelectorAll('.section-tab').forEach((tab, i) => {
    const locked = !activeGroupIndexes.includes(i);
    tab.disabled = locked;
    tab.style.opacity = locked ? '0.4' : '1';
    tab.style.cursor = locked ? 'not-allowed' : 'pointer';
    tab.title = locked ? (mhtTimerGroup === 0
      ? 'Maths opens after Physics & Chemistry timer ends'
      : 'Physics & Chemistry time has ended') : '';
  });
}

// Also patch _cbt_buildSectionTabs to re-apply locks after rebuild
const _mht_origBuildTabs = _cbt_buildSectionTabs;
const _patched_cbt_buildSectionTabs = function() {
  _mht_origBuildTabs();
  if (testState?.exam === 'mhtcet') _mht_applyTabLocks();
};
// Expose globally so _cbt_switchSection uses the patched version
window._cbt_buildSectionTabsPatched = _patched_cbt_buildSectionTabs;

// Update instructions panel for MHT-CET to show split-timer info
const _mht_origBeginActiveTest = _cbt_beginActiveTest;
// Override to set mhtTimerGroup = 0 on fresh start
const _mht_origCbtBegin = window._cbt_beginActiveTest || _cbt_beginActiveTest;

// Patch instrScheme for MHT-CET (different marks per section)
const _mht_origStartTest = _cbt_startTest || window._cbt_startTest;
document.addEventListener('supabase:ready', () => {
  // Nothing extra needed — config is self-contained
});

// ─── Papers: Start CBT from paper card ────────────────────────────────────────
async function startPaperCBT(paperId, exam, title) {
  const examKey = String(exam || 'jee').toLowerCase().replace(/[^a-z]/g, '');
  const mapped = examKey.includes('mht') || examKey.includes('cet') ? 'mhtcet'
               : examKey.includes('neet') ? 'neet'
               : 'jee';

  // Load THIS paper's own questions (linked by paper_id) so each paper is distinct
  let paperQs = [];
  if (window._supabase && paperId) {
    try {
      const { data } = await db.from('questions')
        .select('*').eq('paper_id', paperId).eq('status', 'published');
      if (data && data.length) {
        const _ansToIdx = (v) => {
          const s = String(v ?? '').trim().toUpperCase();
          return s === 'A' ? 0 : s === 'B' ? 1 : s === 'C' ? 2 : s === 'D' ? 3 : 0;
        };
        paperQs = data.map(q => ({
          id: q.id,
          exam: mapped,
          subject: String(q.subject || 'physics').toLowerCase(),
          difficulty: (q.difficulty || 'medium').toLowerCase(),
          text: q.question_text || '',
          options: [q.option_a, q.option_b, q.option_c, q.option_d],
          answer: _ansToIdx(q.correct_option),
          chapter: q.chapter || 'General',
          image_svg: q.image_svg || null,
          image_url: q.image_url || null,
        })).filter(q => q.text && q.options.every(o => o && String(o).trim()));
      }
    } catch (e) { console.warn('paper load failed', e); }
  }

  if (paperQs.length === 0) {
    // fallback: generic exam test
    quickStart(mapped);
    return;
  }

  // Build one section per subject from THIS paper's questions
  _startTestFromPool(paperQs, mapped, title);
}

// Build & start a CBT directly from a fixed pool of questions (used by papers)
function _startTestFromPool(poolQs, exam, title) {
  const cfg = EXAM_CONFIG[exam] || EXAM_CONFIG.jee;
  const bySubject = {};
  poolQs.forEach(q => { (bySubject[q.subject] = bySubject[q.subject] || []).push(q); });

  const sectionsData = [];
  let allSelected = [];
  (cfg.sections || []).forEach(sec => {
    const subjQs = bySubject[(sec.subject || '').toLowerCase()] || [];
    if (subjQs.length === 0) return;
    const startIdx = allSelected.length;
    subjQs.forEach((q, i) => allSelected.push({ ...q, _isInteger: false }));
    sectionsData.push({
      name: sec.name, subject: sec.subject, startIdx,
      endIdx: allSelected.length - 1,
      mcq: subjQs.length, integer: 0,
      mcqMarks: sec.mcqMarks, intMarks: sec.intMarks,
      count: subjQs.length,
    });
  });

  if (allSelected.length === 0) { quickStart(exam); return; }

  cbtSections = sectionsData;
  cbtCurrentSection = 0;
  cbtVisited = new Array(allSelected.length).fill(false);
  cbtQTypes = allSelected.map(() => 'mcq');
  mhtTimerGroup = 0;
  _cbt_startTest(allSelected, exam, cfg);
}

// ═══════════════════════════════════════════════════════════
//  ADVANCED FEATURES: Daily Goals, Chapters, Weak Detection
// ═══════════════════════════════════════════════════════════

const DAILY_GOAL = 15;

async function loadDailyGoal() {
  let solved = 0, streak = 0;
  const today = new Date().toISOString().slice(0, 10);

  if (window._supabase && currentUser && currentUser.id && currentUser.id !== 'demo') {
    try {
      const { data } = await db.from('daily_activity')
        .select('*').eq('user_id', currentUser.id)
        .order('activity_date', { ascending: false }).limit(60);
      if (data?.length) {
        const todayRow = data.find(d => d.activity_date === today);
        solved = todayRow?.questions_solved || 0;
        // Calculate streak
        let cur = new Date();
        for (const row of data) {
          const ds = cur.toISOString().slice(0,10);
          if (row.activity_date === ds && row.questions_solved > 0) {
            streak++; cur.setDate(cur.getDate() - 1);
          } else break;
        }
      }
    } catch(e) {}
  } else {
    try {
      const local = JSON.parse(localStorage.getItem('mm_daily') || '{}');
      solved = local[today] || 0;
      streak = parseInt(localStorage.getItem('mm_streak') || '0');
    } catch(e) {}
  }

  const pct = Math.min(100, Math.round(solved / DAILY_GOAL * 100));
  const fill = document.getElementById('goalProgressFill');
  const text = document.getElementById('dailyGoalText');
  const sc   = document.getElementById('streakCount');
  if (fill) fill.style.width = pct + '%';
  if (text) text.textContent = `${solved} / ${DAILY_GOAL} questions today`;
  if (sc)   sc.textContent = streak;

  document.querySelectorAll('.milestone').forEach(m => {
    if (pct >= parseInt(m.dataset.pct)) m.classList.add('reached');
    else m.classList.remove('reached');
  });
}

async function recordDailyActivity(count, correct) {
  const today = new Date().toISOString().slice(0, 10);
  if (window._supabase && currentUser && currentUser.id && currentUser.id !== 'demo') {
    try {
      const { data } = await db.from('daily_activity')
        .select('*').eq('user_id', currentUser.id).eq('activity_date', today).maybeSingle();
      if (data) {
        await db.from('daily_activity').update({
          questions_solved: (data.questions_solved||0) + count,
          correct: (data.correct||0) + correct
        }).eq('id', data.id);
      } else {
        await db.from('daily_activity').insert({
          user_id: currentUser.id, activity_date: today,
          questions_solved: count, correct, goal: DAILY_GOAL
        });
      }
    } catch(e) {}
  } else {
    try {
      const local = JSON.parse(localStorage.getItem('mm_daily') || '{}');
      local[today] = (local[today] || 0) + count;
      localStorage.setItem('mm_daily', JSON.stringify(local));
    } catch(e) {}
  }
}

// ── Chapter-wise PYQ list ──
function buildChapterList() {
  const exam = document.getElementById('filterExam')?.value || '';
  const grouped = {};
  allQuestions.forEach(q => {
    if (exam && q.exam !== exam) return;
    const ch = q.chapter || 'General';
    if (!grouped[ch]) grouped[ch] = { total: 0, byYear: {}, subject: q.subject };
    grouped[ch].total++;
    grouped[ch].byYear[q.year] = (grouped[ch].byYear[q.year] || 0) + 1;
  });

  // Weak chapters from user history
  const weakChapters = getWeakChapters();

  const sorted = Object.entries(grouped).sort((a,b) => b[1].total - a[1].total);
  const subjIcon = { physics:'⚛️', chemistry:'🧪', mathematics:'📐', biology:'🧬' };

  const html = sorted.map(([ch, d]) => {
    const y2026 = d.byYear[2026] || 0;
    const y2025 = d.byYear[2025] || 0;
    const trend = y2026 > y2025 ? '<span class="up">↑</span>' : y2026 < y2025 ? '<span class="down">↓</span>' : '';
    const weak = weakChapters.includes(ch) ? '<span class="weak-chapter-badge">Weak</span>' : '';
    return `
      <div class="chapter-item" onclick="practiceChapter('${ch.replace(/'/g,"")}')">
        <div class="chapter-item-left">
          <div class="chapter-icon">${subjIcon[d.subject] || '📖'}</div>
          <div>
            <div class="chapter-name">${ch} ${weak}</div>
            <div class="chapter-sub">${capitalize(d.subject || '')}</div>
          </div>
        </div>
        <div class="chapter-stats">
          <span class="chapter-year-stat">2026: ${y2026} ${trend}</span>
          <span class="chapter-year-stat">2025: ${y2025}</span>
          <span class="chapter-count">${d.total} Qs</span>
        </div>
      </div>`;
  }).join('');

  const el = document.getElementById('chapterList');
  if (el) el.innerHTML = html || '<p class="muted">No chapters found.</p>';
}

function practiceChapter(chapter) {
  // Filter question bank to this chapter
  const sel = document.getElementById('filterChapter');
  if (sel) {
    // Ensure option exists
    if (![...sel.options].find(o => o.value === chapter)) {
      const opt = document.createElement('option');
      opt.value = chapter; opt.textContent = chapter;
      sel.appendChild(opt);
    }
    sel.value = chapter;
  }
  renderQuestionBank();
  document.getElementById('questionBank')?.scrollIntoView({ behavior: 'smooth' });
}

function populateChapterFilter() {
  const sel = document.getElementById('filterChapter');
  if (!sel) return;
  const subject = (document.getElementById('filterSubject')?.value || '').toLowerCase();
  const exam = (document.getElementById('filterExam')?.value || '').toLowerCase();
  // Only chapters that belong to the selected subject (and exam, if chosen)
  const chapters = [...new Set(
    allQuestions
      .filter(q => (!subject || (q.subject || '').toLowerCase() === subject))
      .filter(q => (!exam || (q.exam || '').toLowerCase() === exam))
      .map(q => q.chapter)
      .filter(Boolean)
  )].sort();
  const current = sel.value;
  sel.innerHTML = '<option value="">All Topics</option>' +
    chapters.map(c => `<option value="${c}">${c}</option>`).join('');
  // keep selection if still valid
  if (chapters.includes(current)) sel.value = current;
}

// ── Weak chapter detection from test history ──
function getWeakChapters() {
  const chapterPerf = {};
  (userTests || []).forEach(t => {
    if (Array.isArray(t.chapter_breakdown)) {
      t.chapter_breakdown.forEach(cb => {
        if (!chapterPerf[cb.chapter]) chapterPerf[cb.chapter] = { correct: 0, total: 0 };
        chapterPerf[cb.chapter].correct += cb.correct || 0;
        chapterPerf[cb.chapter].total += cb.total || 0;
      });
    }
  });
  return Object.entries(chapterPerf)
    .filter(([_, p]) => p.total >= 3 && (p.correct / p.total) < 0.5)
    .map(([ch]) => ch);
}
