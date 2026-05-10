// Sync de estado por utilizador no Supabase.
// Modelo "blob único": uma linha em public.user_state com { user_id, state jsonb, updated_at }.
// A tabela tem RLS — cada utilizador só lê/escreve a sua linha (auth.uid() = user_id).

async function stepzGetUserId() {
  const sb = typeof getStepzSupabase === 'function' ? getStepzSupabase() : null;
  if (!sb) return null;
  try {
    const { data, error } = await sb.auth.getUser();
    if (error || !data || !data.user || !data.user.id) return null;
    return data.user.id;
  } catch (_) {
    return null;
  }
}

async function stepzLoadRemoteState() {
  const sb = typeof getStepzSupabase === 'function' ? getStepzSupabase() : null;
  if (!sb) return { ok: false, reason: 'no-supabase' };
  const userId = await stepzGetUserId();
  if (!userId) return { ok: false, reason: 'no-session' };
  try {
    const { data, error } = await sb
      .from('user_state')
      .select('state, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return { ok: false, reason: 'error', error };
    if (!data) return { ok: true, found: false };
    return { ok: true, found: true, state: data.state, updatedAt: data.updated_at };
  } catch (e) {
    return { ok: false, reason: 'exception', error: e };
  }
}

async function stepzSaveRemoteState(state) {
  const sb = typeof getStepzSupabase === 'function' ? getStepzSupabase() : null;
  if (!sb) return { ok: false, reason: 'no-supabase' };
  const userId = await stepzGetUserId();
  if (!userId) return { ok: false, reason: 'no-session' };
  try {
    const { error } = await sb
      .from('user_state')
      .upsert(
        { user_id: userId, state, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
    if (error) return { ok: false, reason: 'error', error };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'exception', error: e };
  }
}

window.stepzRemoteState = {
  getUserId: stepzGetUserId,
  load: stepzLoadRemoteState,
  save: stepzSaveRemoteState,
};
