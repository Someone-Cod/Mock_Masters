// ═══════════════════════════════════════════
//  supabase.js — Supabase client wrapper
//  Replace SUPABASE_URL and SUPABASE_ANON_KEY with your project credentials
// ═══════════════════════════════════════════

const SUPABASE_URL = 'https://klyupctuhjahdsaqtuaj.supabase.co';
// After the JWT secret was rotated, use the modern *publishable* key
// (sb_publishable_…) — the recommended client key, independent of JWT rotation.
const SUPABASE_ANON_KEY = 'sb_publishable_vgTDr7FinuMNpago3jUuhQ_RF9sp5co';

// Load Supabase SDK from CDN dynamically
(function () {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  script.onload = () => {
    window._supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'mockmasters_session',
        storage: window.localStorage,
      }
    });
    document.dispatchEvent(new Event('supabase:ready'));
  };
  script.onerror = () => {
    console.warn('Supabase SDK failed to load. Running in demo mode.');
    window._supabase = null;
    document.dispatchEvent(new Event('supabase:ready'));
  };
  document.head.appendChild(script);
})();

// ─── Helper wrappers ─────────────────────────────────────────────────────────

const db = {
  // Auth
  signUp: (email, password, meta) =>
    window._supabase?.auth.signUp({ email, password, options: { data: meta } }),

  signIn: (email, password) =>
    window._supabase?.auth.signInWithPassword({ email, password }),

  signOut: () => window._supabase?.auth.signOut(),

  // Send a password-reset email; the link lands the user back on /reset-password.
  resetPassword: (email, opts) =>
    window._supabase?.auth.resetPasswordForEmail(email, opts),

  // Set a new password for the currently-authenticated (or recovery) session.
  updatePassword: (password) =>
    window._supabase?.auth.updateUser({ password }),

  // OAuth sign-in (full-page redirect to the provider).
  signInWithOAuth: (provider, opts) =>
    window._supabase?.auth.signInWithOAuth({ provider, options: opts }),

  getSession: () => window._supabase?.auth.getSession(),

  onAuthChange: (cb) => window._supabase?.auth.onAuthStateChange(cb),

  // Data
  from: (table) => window._supabase?.from(table),

  // Server-side RPCs (SECURITY DEFINER). Used for test questions + grading so
  // the correct answers are NEVER sent to the client before submission.
  //   get_test_questions(...) → questions WITHOUT correct_option
  //   grade_test(answers)     → is_correct per question, verified on the server
  rpc: (fn, params) => window._supabase?.rpc(fn, params),
};
