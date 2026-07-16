// Sync de estado por utilizador no Supabase.
// Modelo "blob único": uma linha em public.user_state com { user_id, state jsonb, updated_at }.
// Histórico em public.user_state_history (últimas 40 entradas por utilizador).
// Histórico selectivo: só dedupe de estado idêntico (sem throttle por tempo).

const HISTORY_MAX_ENTRIES = 40;

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

function stepzWipeGuardBlocked(candidateState, referenceState) {
  if (typeof isSuspiciousWipe !== 'function') return false;
  if (!referenceState) return false;
  return isSuspiciousWipe(candidateState, referenceState);
}

function stepzStableStateJson(state) {
  try {
    return JSON.stringify(state);
  } catch (_) {
    return '';
  }
}

async function stepzLoadCurrentRemoteStateRow(sb, userId) {
  const { data, error } = await sb
    .from('user_state')
    .select('state, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return { ok: false, error };
  if (!data) return { ok: true, found: false };
  return { ok: true, found: true, state: data.state, updatedAt: data.updated_at };
}

async function stepzLoadLatestHistoryRow(sb, userId) {
  const { data, error } = await sb
    .from('user_state_history')
    .select('id, state, created_at, reason')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, error };
  if (!data) return { ok: true, found: false };
  return { ok: true, found: true, row: data };
}

async function stepzPruneStateHistory(sb, userId) {
  const { data: rows, error } = await sb
    .from('user_state_history')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error || !Array.isArray(rows) || rows.length <= HISTORY_MAX_ENTRIES) return;
  const toDelete = rows.slice(HISTORY_MAX_ENTRIES).map((r) => r.id);
  if (!toDelete.length) return;
  await sb.from('user_state_history').delete().in('id', toDelete);
}

/**
 * Insere no histórico só quando o estado difere do último snapshot.
 * Saves iguais (retries / flush sem mudança) não criam linha nova.
 */
async function stepzInsertStateHistory(sb, userId, state, reason) {
  const reasonKey = reason || 'save';
  const nextJson = stepzStableStateJson(state);

  const latest = await stepzLoadLatestHistoryRow(sb, userId);
  if (!latest.ok) {
    const msg = latest.error && (latest.error.message || String(latest.error));
    if (msg && /does not exist|relation.*user_state_history/i.test(msg)) {
      return { ok: false, error: latest.error, skipped: false };
    }
    /* Sem leitura da última linha: tenta inserir na mesma (melhor ter histórico). */
  } else if (latest.found && latest.row) {
    const prevJson = stepzStableStateJson(latest.row.state);
    if (prevJson && nextJson && prevJson === nextJson) {
      return { ok: true, skipped: true, reason: 'duplicate' };
    }
  }

  const { error } = await sb.from('user_state_history').insert({
    user_id: userId,
    state,
    reason: reasonKey,
  });
  if (error) return { ok: false, error, skipped: false };
  await stepzPruneStateHistory(sb, userId);
  return { ok: true, skipped: false };
}

async function stepzLoadRemoteState() {
  const sb = typeof getStepzSupabase === 'function' ? getStepzSupabase() : null;
  if (!sb) return { ok: false, reason: 'no-supabase' };
  const userId = await stepzGetUserId();
  if (!userId) return { ok: false, reason: 'no-session' };
  try {
    const row = await stepzLoadCurrentRemoteStateRow(sb, userId);
    if (!row.ok) return { ok: false, reason: 'error', error: row.error };
    if (!row.found) return { ok: true, found: false };
    return { ok: true, found: true, state: row.state, updatedAt: row.updatedAt };
  } catch (e) {
    return { ok: false, reason: 'exception', error: e };
  }
}

/**
 * @param {object} state
 * @param {{ force?: boolean, reason?: string, referenceState?: object }} [opts]
 */
async function stepzSaveRemoteState(state, opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const sb = typeof getStepzSupabase === 'function' ? getStepzSupabase() : null;
  if (!sb) return { ok: false, reason: 'no-supabase' };
  const userId = await stepzGetUserId();
  if (!userId) return { ok: false, reason: 'no-session' };
  const updatedAt = new Date().toISOString();
  try {
    if (!options.force) {
      let reference = options.referenceState || null;
      if (!reference) {
        const current = await stepzLoadCurrentRemoteStateRow(sb, userId);
        if (current.ok && current.found && current.state) reference = current.state;
      }
      if (stepzWipeGuardBlocked(state, reference)) {
        return { ok: false, reason: 'wipe-blocked' };
      }
    }

    const hist = await stepzInsertStateHistory(sb, userId, state, options.reason || 'save');
    if (!hist.ok) {
      /* Histórico opcional se a tabela ainda não existir — continua o upsert. */
      const msg = hist.error && (hist.error.message || String(hist.error));
      if (msg && !/does not exist|relation.*user_state_history/i.test(msg)) {
        return { ok: false, reason: 'history-error', error: hist.error };
      }
    }

    const { error } = await sb
      .from('user_state')
      .upsert(
        { user_id: userId, state, updated_at: updatedAt },
        { onConflict: 'user_id' },
      );
    if (error) return { ok: false, reason: 'error', error };
    return { ok: true, updatedAt, historySkipped: !!(hist && hist.skipped) };
  } catch (e) {
    return { ok: false, reason: 'exception', error: e };
  }
}

/** Grava imediatamente no remoto (sem debounce — usar a partir do App). */
async function stepzFlushPendingSave(state, opts) {
  return stepzSaveRemoteState(state, opts);
}

async function stepzLoadStateHistory() {
  const sb = typeof getStepzSupabase === 'function' ? getStepzSupabase() : null;
  if (!sb) return { ok: false, reason: 'no-supabase' };
  const userId = await stepzGetUserId();
  if (!userId) return { ok: false, reason: 'no-session' };
  try {
    const { data, error } = await sb
      .from('user_state_history')
      .select('id, created_at, reason, state')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(HISTORY_MAX_ENTRIES);
    if (error) return { ok: false, reason: 'error', error };
    return { ok: true, entries: Array.isArray(data) ? data : [] };
  } catch (e) {
    return { ok: false, reason: 'exception', error: e };
  }
}

async function stepzRestoreFromHistory(historyId) {
  const sb = typeof getStepzSupabase === 'function' ? getStepzSupabase() : null;
  if (!sb) return { ok: false, reason: 'no-supabase' };
  const userId = await stepzGetUserId();
  if (!userId) return { ok: false, reason: 'no-session' };
  const id = String(historyId || '').trim();
  if (!id) return { ok: false, reason: 'no-id' };
  try {
    const { data, error } = await sb
      .from('user_state_history')
      .select('id, state, created_at')
      .eq('user_id', userId)
      .eq('id', id)
      .maybeSingle();
    if (error) return { ok: false, reason: 'error', error };
    if (!data || !data.state) return { ok: false, reason: 'not-found' };
    const saveRes = await stepzSaveRemoteState(data.state, { force: true, reason: 'manual' });
    if (!saveRes.ok) return saveRes;
    return { ok: true, state: data.state, updatedAt: saveRes.updatedAt, createdAt: data.created_at };
  } catch (e) {
    return { ok: false, reason: 'exception', error: e };
  }
}

window.stepzRemoteState = {
  getUserId: stepzGetUserId,
  load: stepzLoadRemoteState,
  save: stepzSaveRemoteState,
  flushPendingSave: stepzFlushPendingSave,
  loadHistory: stepzLoadStateHistory,
  restoreFromHistory: stepzRestoreFromHistory,
};
