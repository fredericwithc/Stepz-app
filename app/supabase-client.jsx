// Cliente Supabase (browser). Requer script UMD + STEPZ_SUPABASE_URL / STEPZ_SUPABASE_ANON_KEY em window.

function stepzSupabaseLib() {
  const g = typeof window !== 'undefined' ? window : {};
  return g.supabase || null;
}

function stepzCreateSupabaseClient() {
  try {
    const lib = stepzSupabaseLib();
    if (!lib || typeof lib.createClient !== 'function') return null;
    const url = typeof window !== 'undefined' && window.STEPZ_SUPABASE_URL;
    const key = typeof window !== 'undefined' && window.STEPZ_SUPABASE_ANON_KEY;
    const u = String(url || '').trim();
    const k = String(key || '').trim();
    if (!u || !k) return null;
    if (u.includes('YOUR_PROJECT') || k.includes('YOUR_ANON')) return null;
    if (!/^https:\/\//i.test(u)) return null;
    if (!k.startsWith('eyJ')) return null;
    return lib.createClient(u, k, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    });
  } catch (_) {
    return null;
  }
}

let _stepzSbCache;
function getStepzSupabase() {
  if (_stepzSbCache !== undefined) return _stepzSbCache;
  _stepzSbCache = stepzCreateSupabaseClient();
  return _stepzSbCache;
}

function isSupabaseConfigured() {
  return getStepzSupabase() != null;
}

Object.assign(window, {
  getStepzSupabase,
  isSupabaseConfigured,
  stepzCreateSupabaseClient,
});
