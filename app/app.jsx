const { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, useContext, createContext } = React;

/** ≤768px: uma coluna, tabs com scroll, menos padding. ≤1024px: tablet (opcional). ≤430px: iPhone estreito. */
const STEPZ_BREAKPOINT_MOBILE = 768;
const STEPZ_BREAKPOINT_TABLET = 1024;
const STEPZ_BREAKPOINT_NARROW = 430;

const StepzViewportContext = createContext({
  width: 1024,
  isMobile: false,
  isTablet: false,
  isNarrow: false,
});

function StepzViewportProvider({ children }) {
  const [width, setWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1024));
  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
  const value = useMemo(() => ({
    width,
    isMobile: width <= STEPZ_BREAKPOINT_MOBILE,
    isTablet: width <= STEPZ_BREAKPOINT_TABLET,
    isNarrow: width <= STEPZ_BREAKPOINT_NARROW,
  }), [width]);
  return (
    <StepzViewportContext.Provider value={value}>
      {children}
    </StepzViewportContext.Provider>
  );
}

function useStepzViewport() {
  return useContext(StepzViewportContext);
}

function AppRoot() {
  return (
    <StepzViewportProvider>
      <App />
    </StepzViewportProvider>
  );
}

const TASK_STATUS = [
  { id: 'todo', label: 'A fazer' },
  { id: 'doing', label: 'Em andamento' },
  { id: 'done', label: 'Concluida' },
];
/** Azul do accent antigo — só para o status «Em andamento» (pills da lista / popover). */
const TASK_STATUS_DOING_COLOR = 'oklch(0.68 0.16 252)';
const TASK_PRIORITIES = [
  { id: 'low', label: 'Baixa', color: 'oklch(0.56 0.14 145)' },
  { id: 'medium', label: 'Media', color: 'oklch(0.62 0.125 88)' },
  { id: 'high', label: 'Alta', color: 'oklch(0.52 0.17 22)' },
];
/** Paleta tipo Notion, um pouco mais escura para contraste com texto branco. */
const TASK_TAG_COLOR_OPTIONS = [
  { label: 'Padrão', color: '#383838' },
  { label: 'Cinza', color: '#5f5e5b' },
  { label: 'Marrom', color: '#523628' },
  { label: 'Laranja', color: '#a87626' },
  { label: 'Amarelo', color: '#c49e02' },
  { label: 'Verde', color: '#366b52' },
  { label: 'Azul', color: '#286892' },
  { label: 'Roxo', color: '#735491' },
  { label: 'Rosa', color: '#9f4176' },
  { label: 'Vermelho', color: '#a73d3d' },
];
const TASK_TAG_COLORS = TASK_TAG_COLOR_OPTIONS.map((o) => o.color);

function collectAllTaskTags(tasks) {
  const set = new Set();
  for (const t of tasks || []) {
    for (const raw of t.tags || []) {
      const x = String(raw || '').trim();
      if (x) set.add(x);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function colorForTaskTag(tag, tagColors) {
  const key = String(tag || '').trim();
  if (!key) return TASK_TAG_COLORS[0];
  const custom = tagColors && tagColors[key];
  if (custom) return custom;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h + key.charCodeAt(i) * (i + 1)) % 2147483647;
  return TASK_TAG_COLORS[Math.abs(h) % TASK_TAG_COLORS.length];
}

/* =============================================================================
 * Recorrência mensal de tasks.
 * Schema (campos opcionais em cada task):
 *   recurrence: 'monthly' | null
 *   recurrenceIntervalDays: number (default 30) — avanço do prazo no ciclo seguinte
 *   recurrenceLeadDays: number (default 7) — reabre N dias antes do dueDate
 *   recurrenceLastDoneAt: ISO da última conclusão (fallback se não houver prazo)
 * Auto-reabertura preserva degraus; reabertura manual remove o último degrau como antes.
 * ============================================================================= */
const RECURRING_DEFAULT_INTERVAL = 30;
const RECURRING_DEFAULT_LEAD = 7;

function isTaskRecurringMonthly(t) {
  return !!(t && t.recurrence === 'monthly');
}

/** Task concluída (boolean ou status legado). */
function isTaskEffectivelyDone(t) {
  return !!(t && (t.done || t.status === 'done'));
}

function normalizeDueDateKey(due) {
  const key = String(due || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : '';
}

function recurringIntervalDays(t) {
  return Number.isFinite(t?.recurrenceIntervalDays) && t.recurrenceIntervalDays > 0
    ? t.recurrenceIntervalDays
    : RECURRING_DEFAULT_INTERVAL;
}

function recurringLeadDays(t) {
  return Number.isFinite(t?.recurrenceLeadDays) && t.recurrenceLeadDays >= 0
    ? t.recurrenceLeadDays
    : RECURRING_DEFAULT_LEAD;
}

/** Próximo prazo estritamente após minAfterKey, somando intervalDays em dias de calendário. */
function nextDueKeyAfter(dueKey, minAfterKey, intervalDays) {
  const interval = intervalDays > 0 ? intervalDays : RECURRING_DEFAULT_INTERVAL;
  let cur = String(dueKey || '').slice(0, 10);
  const minAfter = String(minAfterKey || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cur)) return minAfter;
  let guard = 0;
  while (cur <= minAfter && guard < 120) {
    const next = addCalendarDays(cur, interval);
    if (!next) return minAfter;
    cur = next;
    guard += 1;
  }
  return cur;
}

/**
 * Dia de calendário (YYYY-MM-DD) em que a task concluída volta a "a fazer".
 * Com prazo: dueDate − leadDays. Sem prazo: última conclusão + (interval − lead).
 */
function computeRecurringReopenDateKey(t) {
  if (!isTaskRecurringMonthly(t)) return null;
  const lead = recurringLeadDays(t);
  const due = normalizeDueDateKey(t.dueDate);
  if (due) {
    return addCalendarDays(due, -lead);
  }
  if (!t.recurrenceLastDoneAt) return null;
  const lastKey = dateKeyFromIso(t.recurrenceLastDoneAt);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lastKey)) return null;
  const interval = recurringIntervalDays(t);
  return addCalendarDays(lastKey, Math.max(0, interval - lead));
}

/** Timestamp (ms) no início do dia de reabertura (local), ou null. */
function computeRecurringReopenAt(t) {
  const key = computeRecurringReopenDateKey(t);
  if (!key) return null;
  return Date.parse(`${key}T00:00:00`);
}

/** Campos de recorrência ao concluir — avança o prazo para o ciclo seguinte quando aplicável. */
function patchRecurringOnComplete(task, completedAtIso) {
  const completedKey = dateKeyFromIso(completedAtIso);
  const patch = { recurrenceLastDoneAt: completedAtIso };
  const due = normalizeDueDateKey(task.dueDate);
  if (!due) return patch;
  const reopenKey = computeRecurringReopenDateKey(task);
  const interval = recurringIntervalDays(task);
  if (reopenKey && completedKey >= reopenKey) {
    patch.dueDate = nextDueKeyAfter(due, due, interval);
  } else if (due <= completedKey) {
    patch.dueDate = nextDueKeyAfter(due, completedKey, interval);
  }
  return patch;
}

/**
 * Reabre tasks recorrentes quando hoje >= (prazo − leadDays), preservando state.steps.
 * Atualiza prazo se ainda estiver no passado.
 */
function autoReopenRecurringDue(state, nowMs) {
  if (!state || !Array.isArray(state.tasks) || state.tasks.length === 0) {
    return { changed: false, nextTasks: state?.tasks || [] };
  }
  const today = calendarDateKey(new Date(nowMs ?? Date.now()));
  let changed = false;
  const nextTasks = state.tasks.map((t) => {
    if (!isTaskRecurringMonthly(t)) return t;
    if (!isTaskEffectivelyDone(t)) return t;
    const reopenKey = computeRecurringReopenDateKey(t);
    if (!reopenKey || today < reopenKey) return t;
    changed = true;
    const due = normalizeDueDateKey(t.dueDate);
    let nextDue = t.dueDate;
    if (due && due <= today) {
      nextDue = nextDueKeyAfter(due, today, recurringIntervalDays(t));
    }
    return {
      ...t,
      done: false,
      status: 'todo',
      dueDate: nextDue,
      recurrenceLastDoneAt: undefined,
    };
  });
  return { changed, nextTasks };
}

/** Aplica auto-reabertura (carga, sync remoto, conclusão, timer). */
function applyAutoReopenRecurringState(state, nowMs) {
  const r = autoReopenRecurringDue(state, nowMs ?? Date.now());
  return r.changed ? { ...state, tasks: r.nextTasks } : state;
}

/** @deprecated alias */
function withAutoReopenRecurring(state, nowMs) {
  return applyAutoReopenRecurringState(state, nowMs);
}

const REMOTE_SAVE_DEBOUNCE_MS = 300;
const WAKE_RELOAD_HIDDEN_MS = 60_000;
const REMOTE_RETRY_DELAYS_MS = [2000, 5000, 10000];

function buildCacheMeta(remoteUpdatedAt, stateJson) {
  return {
    remoteUpdatedAt: remoteUpdatedAt || new Date().toISOString(),
    stateHash: String(stateJson || '').length,
  };
}

/** Melhor candidato local (cache + lastGood) para comparar com remoto magro. */
function bestLocalSnapshot(userKey, localState) {
  const local = localState || loadState(userKey);
  const lastGood = typeof loadLastGoodState === 'function' ? loadLastGoodState(userKey) : null;
  if (lastGood) return pickRicherState(lastGood, local);
  return local;
}

function parseSyncedStateJson(json) {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}

/** Cor do projeto: override em `projectColors` ou paleta determinística (definida em stairs.jsx). */
function stepzResolveProjectColor(projectName, projectColors) {
  const map = projectColors && typeof projectColors === 'object' && !Array.isArray(projectColors) ? projectColors : {};
  const n = String(projectName || '').trim();
  if (typeof colorForProjectName === 'function') return colorForProjectName(n, map);
  return stepzTokens.accent;
}

function taskTagColorPickerValue(cssColor) {
  if (typeof cssColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(cssColor.trim())) return cssColor.trim();
  return TASK_TAG_COLORS[0] || '#383838';
}

/** Larguras das pills da lista de tasks (font/padding iguais ao chip inline). */
const TASK_TAG_CHIP_GAP = 4;
const TASK_TAG_CHIP_MAX_W = 72;
const TASK_TAG_CHIP_PAD_X = 12;

let taskTagChipMeasureCanvas = null;
function taskTagChipMeasureCtx() {
  if (typeof document === 'undefined') return null;
  if (!taskTagChipMeasureCanvas) taskTagChipMeasureCanvas = document.createElement('canvas');
  return taskTagChipMeasureCanvas.getContext('2d');
}

function measureTaskTagChipWidthPx(tag) {
  const ctx = taskTagChipMeasureCtx();
  if (!ctx) return TASK_TAG_CHIP_MAX_W;
  ctx.font = `600 9px ${stepzTokens.font}`;
  const tw = ctx.measureText(String(tag || '')).width;
  return Math.min(tw + TASK_TAG_CHIP_PAD_X, TASK_TAG_CHIP_MAX_W);
}

function measureTaskTagsOverflowBadgePx(hiddenCount) {
  const ctx = taskTagChipMeasureCtx();
  if (!ctx) return 24;
  ctx.font = `400 9px ${stepzTokens.font}`;
  return ctx.measureText(`+${hiddenCount}`).width;
}

function countTaskTagsVisibleInWidth(chipWidths, totalTags, containerWidth) {
  const maxW = Math.max(0, containerWidth - 2);
  if (totalTags === 0 || maxW <= 0) return 0;
  for (let k = totalTags; k >= 0; k -= 1) {
    let used = 0;
    for (let i = 0; i < k; i += 1) {
      used += chipWidths[i];
      if (i > 0) used += TASK_TAG_CHIP_GAP;
    }
    const hidden = totalTags - k;
    if (hidden > 0) used += TASK_TAG_CHIP_GAP + measureTaskTagsOverflowBadgePx(hidden);
    if (used <= maxW) return k;
  }
  return 0;
}

const DEFAULT_PROJECT = 'Geral';

function stepzAccentBg() {
  return stepzTokens.accentGradient || stepzTokens.accent;
}

function baseCategoriesSeed() {
  return typeof BASE_CATEGORIES !== 'undefined' ? BASE_CATEGORIES : [];
}

/** Id interno nos dados (tasks/hábitos/degraus); não há UI para mudar. */
function defaultTaskCategoryId() {
  const seed = baseCategoriesSeed();
  return seed[0]?.id || 'mind';
}

function normalizeTaskStatus(statusId, doneFlag) {
  const sid = statusId || 'todo';
  if (doneFlag && sid !== 'done') return 'done';
  if (!doneFlag && sid === 'done') return 'todo';
  return sid;
}

/** Cor do status pelo id normalizado ou pela opção escolhida (Concluída → verde). */
function statusOptionColor(statusId) {
  const sid = statusId || 'todo';
  if (sid === 'done') return stepzTokens.success;
  if (sid === 'doing') return TASK_STATUS_DOING_COLOR;
  return stepzTokens.text;
}

/** Borda suave nas pills de status: `#RRGGBB` aceita sufixo hex alpha; `oklch`/`rgba` usa color-mix. */
function statusOptionBorderSoft(cssColor) {
  const c = String(cssColor || '').trim();
  if (/^#[0-9A-Fa-f]{6}$/i.test(c)) return `${c}66`;
  return `color-mix(in srgb, ${cssColor} 42%, transparent)`;
}

/** Fallback quando o Supabase não está configurado: sessão só no browser. */
const STEPZ_AUTH_STORAGE_KEY = 'stepz.auth.v1';

function loadAuthSession() {
  try {
    const raw = localStorage.getItem(STEPZ_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    const email = typeof p.email === 'string' ? p.email.trim() : '';
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { email };
  } catch (_) { /* ignore */ }
  return null;
}

function saveAuthSession(email) {
  try {
    localStorage.setItem(STEPZ_AUTH_STORAGE_KEY, JSON.stringify({
      email: String(email || '').trim(),
      loggedAt: new Date().toISOString(),
    }));
  } catch (_) { /* ignore */ }
}

function clearAuthSession() {
  try { localStorage.removeItem(STEPZ_AUTH_STORAGE_KEY); } catch (_) { /* ignore */ }
}

function validateLoginInput(email, password) {
  const e = String(email || '').trim();
  const p = String(password || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { ok: false, message: 'Informe um e-mail válido.' };
  if (p.length < 6) return { ok: false, message: 'A senha precisa ter pelo menos 6 caracteres.' };
  return { ok: true };
}

function mapSupabaseAuthError(error) {
  if (!error) return 'Erro ao autenticar.';
  const raw = String(error.message || error);
  const m = raw.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar (link enviado pelo Supabase).';
  if (m.includes('user already registered')) return 'Este e-mail já está cadastrado. Faça login em vez de criar conta.';
  return raw;
}

function PasswordEyeIcon({ open }) {
  if (open) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-6.5 0-10-7-10-7a18.45 18.45 0 0 1 4.13-5.18" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c6.5 0 10 7 10 7a18.5 18.5 0 0 1-3.16 4.19" />
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

function PasswordField({ value, onChange, name, autoComplete, placeholder, inputBase, marginBottom }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative', marginBottom: marginBottom != null ? marginBottom : 16 }}>
      <input
        type={show ? 'text' : 'password'}
        name={name}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{ ...inputBase, paddingRight: 42 }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
        title={show ? 'Ocultar senha' : 'Mostrar senha'}
        tabIndex={-1}
        style={{
          position: 'absolute',
          right: 6,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'transparent',
          border: 'none',
          color: stepzTokens.textDim,
          cursor: 'pointer',
          padding: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
          lineHeight: 0,
        }}
      >
        <PasswordEyeIcon open={show} />
      </button>
    </div>
  );
}

function LoginScreen({ useSupabase, onSubmitLogin, onSignUp, initialMode }) {
  const [mode, setMode] = useState(initialMode === 'signup' ? 'signup' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const isSignup = mode === 'signup';
  const canSignUp = useSupabase && typeof onSignUp === 'function';

  const inputBase = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px 14px',
    borderRadius: 10,
    border: `1px solid ${stepzTokens.borderStrong}`,
    background: 'rgba(0,0,0,0.35)',
    color: stepzTokens.text,
    fontSize: 14,
    fontFamily: stepzTokens.font,
    outline: 'none',
  };

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setInfo('');
    setPassword('');
    setConfirmPassword('');
  };

  const applyResult = (result) => {
    if (!result) return;
    if (typeof result === 'string') {
      setError(result);
      return;
    }
    if (result.error) setError(result.error);
    if (result.info) setInfo(result.info);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    const v = validateLoginInput(email, password);
    if (!v.ok) {
      setError(v.message);
      return;
    }
    if (isSignup && password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    setBusy(true);
    try {
      const fn = isSignup ? onSignUp : onSubmitLogin;
      const result = await fn(String(email).trim(), password);
      applyResult(result);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      fontFamily: stepzTokens.font,
      background: stepzTokens.bg,
      color: stepzTokens.text,
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: stepzTokens.panel,
        border: `1px solid ${stepzTokens.border}`,
        borderRadius: 16,
        padding: '36px 32px 32px',
        boxShadow: '0 24px 48px rgba(0,0,0,0.45)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
          <img
            src="logos/svg/lockup-color-transparent-white-text.svg"
            alt="Stepz"
            draggable={false}
            style={{ height: 44, width: 'auto', display: 'block', objectFit: 'contain' }}
          />
        </div>
        <h1 style={{
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: -0.4,
          margin: '0 0 24px',
          textAlign: 'center',
        }}>
          {isSignup ? 'Criar conta' : 'Login'}
        </h1>
        {!useSupabase ? (
          <p style={{
            fontSize: 13,
            color: stepzTokens.textDim,
            margin: '0 0 20px',
            textAlign: 'center',
            lineHeight: 1.45,
          }}>
            Supabase não configurado: modo local (sem servidor). Cria supabase-config.js na raiz com STEPZ_SUPABASE_URL e STEPZ_SUPABASE_ANON_KEY.
          </p>
        ) : null}
        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: stepzTokens.textDim, marginBottom: 6 }}>
            E-mail
          </label>
          <input
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            placeholder="voce@email.com"
            style={{ ...inputBase, marginBottom: 16 }}
          />
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: stepzTokens.textDim, marginBottom: 6 }}>
            Senha
          </label>
          <PasswordField
            name="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            placeholder="••••••••"
            inputBase={inputBase}
            marginBottom={isSignup ? 16 : (error || info ? 12 : 16)}
          />
          {isSignup ? (
            <>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: stepzTokens.textDim, marginBottom: 6 }}>
                Confirmar senha
              </label>
              <PasswordField
                name="confirm-password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(ev) => setConfirmPassword(ev.target.value)}
                placeholder="••••••••"
                inputBase={inputBase}
                marginBottom={error || info ? 12 : 16}
              />
            </>
          ) : null}
          {error ? (
            <div style={{
              fontSize: 12,
              color: stepzTokens.warn,
              marginBottom: 14,
              lineHeight: 1.35,
            }}>
              {error}
            </div>
          ) : null}
          {info ? (
            <div style={{
              fontSize: 12,
              color: stepzTokens.success,
              marginBottom: 14,
              lineHeight: 1.35,
            }}>
              {info}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 10,
              border: 'none',
              cursor: busy ? 'wait' : 'pointer',
              fontFamily: stepzTokens.font,
              fontSize: 15,
              fontWeight: 600,
              color: '#0a0a0b',
              background: stepzTokens.accentGradient || stepzTokens.accent,
              opacity: busy ? 0.75 : 1,
            }}
          >
            {busy ? 'Aguardando…' : isSignup ? 'Criar conta' : 'Entrar'}
          </button>
          {canSignUp ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => switchMode(isSignup ? 'login' : 'signup')}
              style={{
                width: '100%',
                marginTop: 10,
                padding: '10px 16px',
                borderRadius: 10,
                border: `1px solid ${stepzTokens.borderStrong}`,
                cursor: busy ? 'wait' : 'pointer',
                fontFamily: stepzTokens.font,
                fontSize: 13,
                fontWeight: 600,
                color: stepzTokens.textDim,
                background: 'transparent',
              }}
            >
              {isSignup ? 'Já tem conta? Entrar' : 'Criar conta'}
            </button>
          ) : null}
        </form>
        <div style={{ marginTop: 18, textAlign: 'center' }}>
          <a
            href="index.html"
            style={{
              fontSize: 12,
              color: stepzTokens.textFaint,
              textDecoration: 'none',
              fontFamily: stepzTokens.font,
            }}
          >
            ← Voltar à página inicial
          </a>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [state, setState] = useState(defaultState);
  const activeUserKeyRef = useRef(null);
  const [tab, setTab] = useState('home');
  const [stepDetail, setStepDetail] = useState(null);
  const [celebrate, setCelebrate] = useState(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [goalModal, setGoalModal] = useState(null);
  const [habitModalOpen, setHabitModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [syncPhase, setSyncPhase] = useState('idle'); // idle | loading | ready | offline
  const [syncNotice, setSyncNotice] = useState(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const { isMobile } = useStepzViewport();

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    const sb = typeof getStepzSupabase === 'function' ? getStepzSupabase() : null;
    if (!sb) {
      setSession(loadAuthSession());
      setAuthReady(true);
      return undefined;
    }
    let cancelled = false;
    sb.auth.getSession().then(({ data: { session: s } }) => {
      if (cancelled) return;
      setSession(s?.user?.email ? { email: s.user.email } : null);
      setAuthReady(true);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, s) => {
      setSession(s?.user?.email ? { email: s.user.email } : null);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  /* Sync remoto (Supabase = fonte de verdade; localStorage = espelho após sync OK). */
  const lastSyncedJsonRef = useRef('');
  const remoteSaveTimerRef = useRef(null);
  const remoteRetryTimerRef = useRef(null);
  const remoteRetryAttemptRef = useRef(0);
  const bootstrapInFlightRef = useRef(null);
  const pendingRemoteSnapshotRef = useRef(null);
  const remoteSaveInFlightRef = useRef(false);
  const lastHiddenAtRef = useRef(null);
  const performRemoteSaveRef = useRef(null);
  const rehydrateFromRemoteRef = useRef(null);

  const clearRemoteSaveTimer = () => {
    if (remoteSaveTimerRef.current) {
      clearTimeout(remoteSaveTimerRef.current);
      remoteSaveTimerRef.current = null;
    }
  };

  const clearRemoteRetryTimer = () => {
    if (remoteRetryTimerRef.current) {
      clearTimeout(remoteRetryTimerRef.current);
      remoteRetryTimerRef.current = null;
    }
  };

  const scheduleRemoteRetry = (userKey) => {
    if (!userKey || !pendingRemoteSnapshotRef.current) return;
    const attempt = remoteRetryAttemptRef.current;
    const delay = REMOTE_RETRY_DELAYS_MS[Math.min(attempt, REMOTE_RETRY_DELAYS_MS.length - 1)];
    remoteRetryAttemptRef.current = attempt + 1;
    clearRemoteRetryTimer();
    remoteRetryTimerRef.current = setTimeout(() => {
      remoteRetryTimerRef.current = null;
      const snap = pendingRemoteSnapshotRef.current;
      if (snap && performRemoteSaveRef.current) {
        performRemoteSaveRef.current(snap, userKey);
      }
    }, delay);
  };

  performRemoteSaveRef.current = async (snapshot, userKey) => {
    const rs = typeof window !== 'undefined' ? window.stepzRemoteState : null;
    if (!rs || typeof rs.save !== 'function' || !userKey) return false;
    if (remoteSaveInFlightRef.current) {
      pendingRemoteSnapshotRef.current = snapshot;
      return false;
    }
    const json = JSON.stringify(snapshot);
    if (json === lastSyncedJsonRef.current) {
      pendingRemoteSnapshotRef.current = null;
      return true;
    }

    const referenceState = parseSyncedStateJson(lastSyncedJsonRef.current)
      || bestLocalSnapshot(userKey, stateRef.current);
    if (typeof isSuspiciousWipe === 'function' && isSuspiciousWipe(snapshot, referenceState)) {
      setSyncNotice('Gravação bloqueada: não é permitido substituir dados ricos por um estado vazio.');
      pendingRemoteSnapshotRef.current = null;
      return false;
    }

    remoteSaveInFlightRef.current = true;
    let ok = false;
    try {
      const res = await rs.save(snapshot, { referenceState });
      if (res && res.ok) {
        lastSyncedJsonRef.current = json;
        pendingRemoteSnapshotRef.current = null;
        remoteRetryAttemptRef.current = 0;
        clearRemoteRetryTimer();
        if (typeof saveStateCache === 'function') {
          saveStateCache(userKey, snapshot, buildCacheMeta(res.updatedAt, json));
        }
        if (typeof touchLastGoodIfRich === 'function') {
          touchLastGoodIfRich(userKey, snapshot);
        }
        setSyncNotice(null);
        setSyncPhase((phase) => (phase === 'offline' ? 'ready' : phase));
        ok = true;
      } else if (res && res.reason === 'wipe-blocked') {
        setSyncNotice('Servidor recusou gravar: snapshot vazio sobre dados existentes.');
        pendingRemoteSnapshotRef.current = null;
      } else {
        pendingRemoteSnapshotRef.current = snapshot;
        scheduleRemoteRetry(userKey);
      }
    } catch (_) {
      pendingRemoteSnapshotRef.current = snapshot;
      scheduleRemoteRetry(userKey);
    } finally {
      remoteSaveInFlightRef.current = false;
      const pending = pendingRemoteSnapshotRef.current;
      if (pending && JSON.stringify(pending) !== json && performRemoteSaveRef.current) {
        queueMicrotask(() => performRemoteSaveRef.current(pending, userKey));
      }
    }
    return ok;
  };

  const flushRemoteSave = async () => {
    const userKey = activeUserKeyRef.current;
    if (!userKey) return false;
    const supabaseOn = typeof isSupabaseConfigured === 'function' && isSupabaseConfigured();
    if (!supabaseOn) return false;
    clearRemoteSaveTimer();
    const snap = pendingRemoteSnapshotRef.current || stateRef.current;
    if (!snap || !performRemoteSaveRef.current) return false;
    return performRemoteSaveRef.current(snap, userKey);
  };

  /* Bootstrap: remoto manda; local só espelho ou upload inicial se remoto vazio. */
  useEffect(() => {
    if (!authReady) return;
    const userKey = session && session.email ? session.email.toLowerCase() : null;
    if (userKey === activeUserKeyRef.current) return;
    activeUserKeyRef.current = userKey;
    clearRemoteSaveTimer();
    clearRemoteRetryTimer();
    remoteRetryAttemptRef.current = 0;
    pendingRemoteSnapshotRef.current = null;

    if (!userKey) {
      lastSyncedJsonRef.current = '';
      bootstrapInFlightRef.current = null;
      setSyncPhase('idle');
      setState(defaultState());
      return undefined;
    }

    const supabaseOn = typeof isSupabaseConfigured === 'function' && isSupabaseConfigured();
    const local = applyAutoReopenRecurringState(loadState(userKey));

    if (!supabaseOn) {
      lastSyncedJsonRef.current = JSON.stringify(local);
      setState(local);
      setSyncPhase('ready');
      return undefined;
    }

    setSyncPhase('loading');
    lastSyncedJsonRef.current = '';
    const bootstrapTag = Symbol('bootstrap');
    bootstrapInFlightRef.current = bootstrapTag;

    (async () => {
      const rs = typeof window !== 'undefined' ? window.stepzRemoteState : null;
      if (!rs || typeof rs.load !== 'function') {
        if (bootstrapInFlightRef.current !== bootstrapTag) return;
        setState(local);
        setSyncPhase('offline');
        return;
      }
      let res;
      try {
        res = await rs.load();
      } catch (_) {
        if (bootstrapInFlightRef.current !== bootstrapTag) return;
        setState(local);
        setSyncPhase('offline');
        return;
      }
      if (bootstrapInFlightRef.current !== bootstrapTag) return;
      if (activeUserKeyRef.current !== userKey) return;

      const bestLocal = bestLocalSnapshot(userKey, local);

      if (res && res.ok && res.found && res.state && typeof res.state === 'object') {
        if (typeof isSuspiciousWipe === 'function' && isSuspiciousWipe(res.state, bestLocal)) {
          const rescue = applyAutoReopenRecurringState(bestLocal);
          lastSyncedJsonRef.current = JSON.stringify(res.state);
          saveState(userKey, rescue);
          if (typeof touchLastGoodIfRich === 'function') touchLastGoodIfRich(userKey, rescue);
          setState(rescue);
          setSyncNotice('Remoto vazio ou incompleto — os teus dados locais foram mantidos (não sobrescritos).');
          setSyncPhase('ready');
          return;
        }
        const applied = applyAutoReopenRecurringState(res.state);
        const json = JSON.stringify(res.state);
        lastSyncedJsonRef.current = json;
        if (typeof saveStateCache === 'function') {
          saveStateCache(userKey, applied, buildCacheMeta(res.updatedAt, json));
        }
        if (typeof touchLastGoodIfRich === 'function') touchLastGoodIfRich(userKey, applied);
        setSyncNotice(null);
        setState(applied);
        setSyncPhase('ready');
        return;
      }

      if (res && res.ok && !res.found && typeof rs.save === 'function') {
        const toUpload = applyAutoReopenRecurringState(bestLocal);
        if (typeof stateRichness === 'function' && stateRichness(toUpload) > 0) {
          try {
            const saveRes = await rs.save(toUpload, { force: true, reason: 'save' });
            if (saveRes && saveRes.ok) {
              const json = JSON.stringify(toUpload);
              lastSyncedJsonRef.current = json;
              if (typeof saveStateCache === 'function') {
                saveStateCache(userKey, toUpload, buildCacheMeta(saveRes.updatedAt, json));
              }
              if (typeof touchLastGoodIfRich === 'function') touchLastGoodIfRich(userKey, toUpload);
              setSyncNotice(null);
              setState(toUpload);
              setSyncPhase('ready');
              return;
            }
          } catch (_) { /* upload inicial falhou */ }
        }
      }

      setState(local);
      setSyncPhase('offline');
    })();

    return undefined;
  }, [authReady, session]);

  /* Persistência: remoto com debounce; cache local só após save OK. Sem Supabase → local imediato. */
  useEffect(() => {
    const userKey = activeUserKeyRef.current;
    if (!userKey) return undefined;

    const supabaseOn = typeof isSupabaseConfigured === 'function' && isSupabaseConfigured();
    if (!supabaseOn) {
      saveState(userKey, state);
      if (typeof touchLastGoodIfRich === 'function') touchLastGoodIfRich(userKey, state);
      return undefined;
    }

    if (syncPhase === 'offline') {
      saveState(userKey, state);
      if (typeof touchLastGoodIfRich === 'function') touchLastGoodIfRich(userKey, state);
    }

    if (syncPhase !== 'ready' && syncPhase !== 'offline') return undefined;

    const json = JSON.stringify(state);
    if (json === lastSyncedJsonRef.current) return undefined;

    pendingRemoteSnapshotRef.current = state;
    clearRemoteSaveTimer();
    const snapshot = state;
    remoteSaveTimerRef.current = setTimeout(() => {
      remoteSaveTimerRef.current = null;
      if (performRemoteSaveRef.current) {
        performRemoteSaveRef.current(snapshot, userKey);
      }
    }, REMOTE_SAVE_DEBOUNCE_MS);

    return () => clearRemoteSaveTimer();
  }, [state, syncPhase]);

  rehydrateFromRemoteRef.current = async (userKey) => {
    if (!userKey) return;
    const supabaseOn = typeof isSupabaseConfigured === 'function' && isSupabaseConfigured();
    if (!supabaseOn) return;
    const rs = typeof window !== 'undefined' ? window.stepzRemoteState : null;
    if (!rs || typeof rs.load !== 'function') return;
    const bestLocal = bestLocalSnapshot(userKey, stateRef.current);
    let res;
    try {
      res = await rs.load();
    } catch (_) {
      setSyncPhase('offline');
      return;
    }
    if (!res || !res.ok) {
      setSyncPhase('offline');
      return;
    }
    if (activeUserKeyRef.current !== userKey) return;
    if (res.found && res.state && typeof res.state === 'object') {
      if (typeof isSuspiciousWipe === 'function' && isSuspiciousWipe(res.state, bestLocal)) {
        setSyncNotice('Remoto vazio ou incompleto — os teus dados locais foram mantidos.');
        setSyncPhase('ready');
        return;
      }
      const applied = applyAutoReopenRecurringState(res.state);
      const json = JSON.stringify(res.state);
      lastSyncedJsonRef.current = json;
      if (typeof saveStateCache === 'function') {
        saveStateCache(userKey, applied, buildCacheMeta(res.updatedAt, json));
      }
      if (typeof touchLastGoodIfRich === 'function') touchLastGoodIfRich(userKey, applied);
      setSyncNotice(null);
      setState(applied);
      setSyncPhase('ready');
    }
  };

  /* Wake / fechar: flush ao esconder; re-hidratação após ausência longa (sem reload cego). */
  useEffect(() => {
    if (!session) return undefined;
    if (!activeUserKeyRef.current) return undefined;

    const onVisibility = () => {
      if (document.hidden) {
        lastHiddenAtRef.current = Date.now();
        void flushRemoteSave();
        return;
      }
      const hiddenMs = lastHiddenAtRef.current
        ? Date.now() - lastHiddenAtRef.current
        : 0;
      lastHiddenAtRef.current = null;
      if (hiddenMs >= WAKE_RELOAD_HIDDEN_MS) {
        void (async () => {
          await flushRemoteSave();
          const userKey = activeUserKeyRef.current;
          if (rehydrateFromRemoteRef.current && userKey) {
            await rehydrateFromRemoteRef.current(userKey);
          }
          setState((s) => applyAutoReopenRecurringState(s));
        })();
        return;
      }
      setState((s) => applyAutoReopenRecurringState(s));
    };

    const onPageShow = (e) => {
      if (e.persisted) {
        const userKey = activeUserKeyRef.current;
        if (rehydrateFromRemoteRef.current && userKey) {
          void rehydrateFromRemoteRef.current(userKey);
        }
        setState((s) => applyAutoReopenRecurringState(s));
      }
    };

    const onPageHide = () => { void flushRemoteSave(); };
    const onBeforeUnload = () => { void flushRemoteSave(); };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [session]);

  // Auto-reabertura de tasks recorrentes a cada 5 min (visibility coberto acima).
  useEffect(() => {
    if (!session) return undefined;
    if (!activeUserKeyRef.current) return undefined;
    const id = setInterval(() => {
      setState((s) => applyAutoReopenRecurringState(s));
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [session]);

  // ── Mutations ──
  const completeTask = (taskId) => {
    setState(s => {
      const t = s.tasks.find(x => x.id === taskId);
      if (!t || t.done) return s;
      const desc = String(t.description || '').trim();
      const newStep = {
        id: cryptoId(),
        taskId: t.id,
        title: t.title,
        project: ((t.project || '').trim() || DEFAULT_PROJECT),
        category: t.category,
        completedAt: new Date().toISOString(),
        ...(desc ? { description: desc } : {}),
        ...(Array.isArray(t.tags) && t.tags.length ? { tags: [...t.tags] } : {}),
        ...(t.priority ? { priority: t.priority } : {}),
        ...(t.dueDate ? { dueDate: t.dueDate } : {}),
      };
      const newSteps = [...s.steps, newStep];
      const newCount = newSteps.length;
      // Trigger celebration if milestone
      if (newCount % 10 === 0 || newCount % STEPS_PER_LEVEL === 0) {
        setCelebrate({ count: newCount, isLevel: newCount % STEPS_PER_LEVEL === 0 });
      } else {
        setCelebrate({ count: newCount, isLevel: false, brief: true });
      }
      const nowIso = new Date().toISOString();
      return withAutoReopenRecurring({
        ...s,
        tasks: s.tasks.map(x => {
          if (x.id !== taskId) return x;
          const patched = { ...x, done: true, status: 'done' };
          if (isTaskRecurringMonthly(x)) Object.assign(patched, patchRecurringOnComplete(x, nowIso));
          return patched;
        }),
        steps: newSteps,
      });
    });
  };

  const uncompleteTask = (taskId) => {
    setState(s => {
      const t = s.tasks.find(x => x.id === taskId);
      if (!t || !t.done) return s;
      // Remove the most recent step linked to this task
      const idx = [...s.steps].map((st, i) => ({ st, i })).reverse().find(({ st }) => st.taskId === taskId)?.i;
      const newSteps = idx != null ? s.steps.filter((_, i) => i !== idx) : s.steps;
      const prevStatus = t.status === 'done' ? 'todo' : (t.status || 'todo');
      return {
        ...s,
        tasks: s.tasks.map(x => x.id === taskId ? { ...x, done: false, status: prevStatus } : x),
        steps: newSteps,
      };
    });
  };

  const addTask = (input, maybeCategory) => {
    const isLegacy = typeof input === 'string';
    const title = isLegacy ? input.trim() : (input.title || '').trim();
    if (!title) return;
    const category = isLegacy
      ? (maybeCategory || defaultTaskCategoryId())
      : (input.category || defaultTaskCategoryId());
    const status = isLegacy ? 'todo' : input.status;
    const priority = isLegacy ? 'medium' : input.priority;
    const dueDate = isLegacy
      ? todayStr()
      : (input.dueDate != null && String(input.dueDate).trim()
        ? String(input.dueDate).trim().slice(0, 10)
        : '');
    const tags = isLegacy ? [] : input.tags;
    const description = isLegacy ? '' : input.description;
    const project = isLegacy ? DEFAULT_PROJECT : ((input.project || '').trim() || DEFAULT_PROJECT);
    const recurrence = !isLegacy && input.recurrence === 'monthly' ? 'monthly' : null;
    const doneOnCreate = !isLegacy && status === 'done';
    const statusStored = normalizeTaskStatus(status, doneOnCreate);
    setState(s => {
      const prevOrder = Array.isArray(s.projectOrder) ? s.projectOrder : [];
      const nextProjectOrder = prevOrder.includes(project) ? prevOrder : [...prevOrder, project];
      const taskId = cryptoId();
      const baseTask = {
        id: taskId,
        title,
        category,
        done: doneOnCreate,
        dueDate,
        status: statusStored,
        priority,
        tags,
        description,
        project,
      };
      if (recurrence === 'monthly') {
        baseTask.recurrence = 'monthly';
        baseTask.recurrenceIntervalDays = RECURRING_DEFAULT_INTERVAL;
        baseTask.recurrenceLeadDays = RECURRING_DEFAULT_LEAD;
        if (doneOnCreate) baseTask.recurrenceLastDoneAt = new Date().toISOString();
      }
      let nextSteps = s.steps;
      if (doneOnCreate) {
        const snapDesc = String(description || '').trim();
        const newStep = {
          id: cryptoId(),
          taskId,
          title,
          project,
          category,
          completedAt: new Date().toISOString(),
          ...(snapDesc ? { description: snapDesc } : {}),
          ...(Array.isArray(tags) && tags.length ? { tags: [...tags] } : {}),
          ...(priority ? { priority } : {}),
          ...(dueDate ? { dueDate } : {}),
        };
        nextSteps = [...s.steps, newStep];
        const newCount = nextSteps.length;
        if (newCount % 10 === 0 || newCount % STEPS_PER_LEVEL === 0) {
          setCelebrate({ count: newCount, isLevel: newCount % STEPS_PER_LEVEL === 0 });
        } else {
          setCelebrate({ count: newCount, isLevel: false, brief: true });
        }
      }
      return {
        ...s,
        tasks: [...s.tasks, baseTask],
        steps: nextSteps,
        projectOrder: nextProjectOrder,
      };
    });
  };

  const deleteTask = (taskId) => {
    setState(s => {
      const removed = s.tasks.find(x => x.id === taskId);
      const tasks = s.tasks.filter(x => x.id !== taskId);
      let projectOrder = Array.isArray(s.projectOrder) ? s.projectOrder : [];
      let projectColors = { ...(s.projectColors || {}) };
      if (removed) {
        const proj = ((removed.project || '').trim() || DEFAULT_PROJECT);
        const stillUsed = tasks.some(t => ((t.project || '').trim() || DEFAULT_PROJECT) === proj);
        if (!stillUsed) {
          projectOrder = projectOrder.filter(p => p !== proj);
          delete projectColors[proj];
        }
      }
      return { ...s, tasks, projectOrder, projectColors };
    });
  };

  /** Remove um degrau de task concluída (histórico "Concluídas") e o registro correspondente na escada. */
  const deleteTaskCompletionStep = (ref) => {
    setState((s) => {
      let removeIdx = -1;
      if (ref && ref.id) removeIdx = s.steps.findIndex((st) => st.id === ref.id);
      if ((removeIdx < 0 || removeIdx >= s.steps.length) && ref && typeof ref.stepIndex === 'number') {
        removeIdx = ref.stepIndex;
      }
      if (removeIdx < 0 || removeIdx >= s.steps.length) return s;
      queueMicrotask(() => {
        setStepDetail((cur) => {
          if (cur == null) return null;
          if (cur === removeIdx) return null;
          if (cur > removeIdx) return cur - 1;
          return cur;
        });
      });
      return { ...s, steps: s.steps.filter((_, i) => i !== removeIdx) };
    });
  };

  const updateTask = (taskId, patch) => {
    setState((s) => {
      const t = s.tasks.find(x => x.id === taskId);
      if (!t) return s;

      const merged = {
        ...t,
        ...patch,
        title: (patch.title != null ? patch.title : t.title || '').trim(),
        project: ((patch.project != null ? patch.project : t.project || '').trim() || DEFAULT_PROJECT),
        tags: Array.isArray(patch.tags) ? patch.tags : (t.tags || []),
        description: typeof patch.description === 'string' ? patch.description : (t.description || ''),
      };
      if (!merged.title) return s;

      let nextStatus = merged.status || 'todo';
      let nextDone = merged.done;

      if (patch.status === 'done') {
        nextDone = true;
        nextStatus = 'done';
      } else if (patch.status === 'todo' || patch.status === 'doing') {
        nextDone = false;
        nextStatus = patch.status;
      } else if (patch.done === true) {
        nextDone = true;
        nextStatus = 'done';
      } else if (patch.done === false) {
        nextDone = false;
        if (nextStatus === 'done') nextStatus = 'todo';
      }

      merged.done = nextDone;
      merged.status = normalizeTaskStatus(nextStatus, merged.done);

      const prevDone = t.done;
      const completing = !prevDone && merged.done;
      const reopening = prevDone && !merged.done;

      let nextSteps = s.steps;
      let celebration = null;
      if (completing) {
        const snapDesc = String(merged.description || '').trim();
        const completedAt = new Date().toISOString();
        nextSteps = [...s.steps, {
          id: cryptoId(),
          taskId: merged.id,
          title: merged.title,
          project: ((merged.project || '').trim() || DEFAULT_PROJECT),
          category: merged.category,
          completedAt,
          ...(snapDesc ? { description: snapDesc } : {}),
          ...(Array.isArray(merged.tags) && merged.tags.length ? { tags: [...merged.tags] } : {}),
          ...(merged.priority ? { priority: merged.priority } : {}),
          ...(merged.dueDate ? { dueDate: merged.dueDate } : {}),
        }];
        if (isTaskRecurringMonthly(merged)) Object.assign(merged, patchRecurringOnComplete(merged, completedAt));
        const newCount = nextSteps.length;
        if (newCount % 10 === 0 || newCount % STEPS_PER_LEVEL === 0) {
          celebration = { count: newCount, isLevel: newCount % STEPS_PER_LEVEL === 0 };
        } else {
          celebration = { count: newCount, isLevel: false, brief: true };
        }
      } else if (reopening) {
        const idx = [...s.steps].map((st, i) => ({ st, i })).reverse().find(({ st }) => st.taskId === taskId)?.i;
        nextSteps = idx != null ? s.steps.filter((_, i) => i !== idx) : s.steps;
      }

      if (celebration) queueMicrotask(() => setCelebrate(celebration));

      const nextTasks = s.tasks.map(x => x.id === taskId ? merged : x);
      const prevProject = ((t.project || '').trim() || DEFAULT_PROJECT);
      const nextProject = ((merged.project || '').trim() || DEFAULT_PROJECT);
      let projectOrder = Array.isArray(s.projectOrder) ? s.projectOrder : [];
      if (prevProject !== nextProject) {
        if (!projectOrder.includes(nextProject)) projectOrder = [...projectOrder, nextProject];
        const stillUsed = nextTasks.some(x => ((x.project || '').trim() || DEFAULT_PROJECT) === prevProject);
        if (!stillUsed) projectOrder = projectOrder.filter(p => p !== prevProject);
      }

      return withAutoReopenRecurring({
        ...s,
        tasks: nextTasks,
        steps: nextSteps,
        projectOrder,
      });
    });
  };

  /**
   * Reordena tasks dentro de um projeto e dentro do seu grupo (open ou done).
   * fromVisibleIdx/toVisibleIdx são índices contados apenas entre os items do mesmo grupo
   * (não-feitas formam um grupo, feitas outro). Traduzimos para índices reais no array global
   * `state.tasks` e fazemos um splice imutável.
   */
  const moveTask = (taskId, projectName, fromVisibleIdx, toVisibleIdx, group) => {
    if (fromVisibleIdx === toVisibleIdx) return;
    setState(s => {
      const tasks = s.tasks;
      const proj = ((projectName || '').trim() || DEFAULT_PROJECT);
      const realIndicesInGroup = [];
      tasks.forEach((t, i) => {
        const tp = ((t.project || '').trim() || DEFAULT_PROJECT);
        if (tp !== proj) return;
        const isOpen = !t.done;
        if (group === 'open' && isOpen) realIndicesInGroup.push(i);
        else if (group === 'done' && !isOpen) realIndicesInGroup.push(i);
      });
      if (fromVisibleIdx < 0 || fromVisibleIdx >= realIndicesInGroup.length) return s;
      const fromReal = realIndicesInGroup[fromVisibleIdx];
      const sourceTask = tasks[fromReal];
      if (!sourceTask || sourceTask.id !== taskId) return s;
      /* toVisibleIdx pode ser igual a length (drop após o último item). */
      const clampedTo = Math.max(0, Math.min(toVisibleIdx, realIndicesInGroup.length));
      let toReal;
      if (clampedTo >= realIndicesInGroup.length) {
        /* posição "depois do último": índice real é uma a seguir ao último do grupo. */
        toReal = realIndicesInGroup[realIndicesInGroup.length - 1] + 1;
      } else {
        toReal = realIndicesInGroup[clampedTo];
      }
      const next = tasks.slice();
      const [moved] = next.splice(fromReal, 1);
      const adjustedTo = toReal > fromReal ? toReal - 1 : toReal;
      next.splice(adjustedTo, 0, moved);
      return { ...s, tasks: next };
    });
  };

  /** Reordena a lista de projetos (move o item from→to em state.projectOrder). */
  const moveProject = (fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    setState(s => {
      const order = Array.isArray(s.projectOrder) ? s.projectOrder.slice() : [];
      if (fromIdx < 0 || fromIdx >= order.length) return s;
      const clampedTo = Math.max(0, Math.min(toIdx, order.length));
      const [moved] = order.splice(fromIdx, 1);
      const adjustedTo = clampedTo > fromIdx ? clampedTo - 1 : clampedTo;
      order.splice(adjustedTo, 0, moved);
      return { ...s, projectOrder: order };
    });
  };

  /** Reordena post-its no array global de post-its. */
  const movePostit = (fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    setState(s => {
      const arr = Array.isArray(s.postits) ? s.postits.slice() : [];
      if (fromIdx < 0 || fromIdx >= arr.length) return s;
      const clampedTo = Math.max(0, Math.min(toIdx, arr.length));
      const [moved] = arr.splice(fromIdx, 1);
      const adjustedTo = clampedTo > fromIdx ? clampedTo - 1 : clampedTo;
      arr.splice(adjustedTo, 0, moved);
      return { ...s, postits: arr };
    });
  };

  /** Define ou remove a cor manual de um projeto (afeta degraus e chips). `cssColor` null/'' volta ao automático. */
  const setProjectColor = (projectName, cssColor) => {
    const name = String(projectName || '').trim();
    if (!name) return;
    setState((s) => {
      const next = { ...(s.projectColors || {}) };
      const v = cssColor != null ? String(cssColor).trim() : '';
      if (!v) delete next[name];
      else next[name] = v;
      return { ...s, projectColors: next };
    });
  };

  const renameProject = (fromProject, toProject) => {
    const from = (fromProject || '').trim();
    const to = (toProject || '').trim();
    if (!from || !to || from === to) return;
    setState(s => {
      const prevOrder = Array.isArray(s.projectOrder) ? s.projectOrder : [];
      let nextOrder;
      if (prevOrder.includes(from)) {
        nextOrder = prevOrder.map(p => (p === from ? to : p));
        nextOrder = nextOrder.filter((p, i) => nextOrder.indexOf(p) === i);
      } else if (!prevOrder.includes(to)) {
        nextOrder = [...prevOrder, to];
      } else {
        nextOrder = prevOrder;
      }
      return {
        ...s,
        tasks: s.tasks.map(t => (((t.project || '').trim() || DEFAULT_PROJECT) === from
          ? { ...t, project: to }
          : t)),
        projectOrder: nextOrder,
        projectColors: (() => {
          const pc = { ...(s.projectColors || {}) };
          if (Object.prototype.hasOwnProperty.call(pc, from) && pc[from] != null && String(pc[from]).trim()) {
            pc[to] = pc[from];
            delete pc[from];
          }
          return pc;
        })(),
      };
    });
  };

  /** Marca/desmarca um hábito numa data específica (YYYY-MM-DD). Não permite datas futuras. */
  const toggleHabitDate = (habitId, dateStr) => {
    const target = String(dateStr || '').slice(0, 10);
    if (!target) return;
    const today = todayStr();
    if (target > today) return; // bloqueia futuro
    setState(s => {
      const h = s.habits.find(x => x.id === habitId);
      if (!h) return s;
      const wasDone = h.history.includes(target);
      let newHistory, addStep = false, removeStep = false;
      if (wasDone) {
        newHistory = h.history.filter(d => d !== target);
        removeStep = true;
      } else {
        newHistory = [...h.history, target].sort();
        addStep = true;
      }
      let newSteps = s.steps;
      if (addStep) {
        // Para dias passados, ancora o completedAt ao meio-dia do dia para preservar a ordem cronológica.
        const completedAt = target === today
          ? new Date().toISOString()
          : new Date(`${target}T12:00:00`).toISOString();
        newSteps = [...s.steps, {
          id: cryptoId(),
          habitId: h.id,
          title: h.title,
          ...(h.color ? { color: h.color } : {}),
          completedAt,
        }];
        const newCount = newSteps.length;
        if (newCount % 10 === 0 || newCount % STEPS_PER_LEVEL === 0) {
          setCelebrate({ count: newCount, isLevel: newCount % STEPS_PER_LEVEL === 0 });
        } else {
          setCelebrate({ count: newCount, isLevel: false, brief: true });
        }
      } else if (removeStep) {
        const idx = [...s.steps].map((st, i) => ({ st, i })).reverse().find(({ st }) => st.habitId === h.id && dateKeyFromIso(st.completedAt) === target)?.i;
        if (idx != null) newSteps = s.steps.filter((_, i) => i !== idx);
      }
      return {
        ...s,
        habits: s.habits.map(x => x.id === habitId ? { ...x, history: newHistory } : x),
        steps: newSteps,
      };
    });
  };

  const toggleHabitToday = (habitId) => toggleHabitDate(habitId, todayStr());

  const addHabit = (title) => {
    const t = String(title || '').trim();
    if (!t) return;
    const category = habitCategoryIdFromTitle(t);
    setState(s => ({
      ...s,
      habits: [...s.habits, {
        id: cryptoId(),
        title: t,
        category,
        history: [],
      }],
    }));
  };

  const deleteHabit = (habitId) => {
    setState(s => ({ ...s, habits: s.habits.filter(x => x.id !== habitId) }));
  };

  const updateHabit = (habitId, input) => {
    const title = String(input.title || '').trim();
    if (!title) return;
    const color = (input.color != null && String(input.color).trim())
      ? String(input.color).trim()
      : TASK_TAG_COLOR_OPTIONS[0].color;
    setState((s) => ({
      ...s,
      habits: s.habits.map((h) => (h.id === habitId ? { ...h, title, color } : h)),
    }));
  };

  const addGoal = (input) => {
    const title = (input.title || '').trim();
    if (!title) return;
    const milestones = milestonesFromLines(input.milestoneText, []);
    const completed = milestones.length > 0 && milestones.every((m) => m.done);
    const newGoalId = cryptoId();
    const goalCat = defaultTaskCategoryId();
    const goalColor = (input.color != null && String(input.color).trim())
      ? String(input.color).trim()
      : TASK_TAG_COLOR_OPTIONS[0].color;
    setState((s) => {
      let nextSteps = s.steps;
      if (completed && milestones.length > 0 && !s.steps.some((st) => st.completedGoalId === newGoalId)) {
        nextSteps = [...s.steps, {
          id: cryptoId(),
          completedGoalId: newGoalId,
          title: title.trim(),
          description: (input.description || '').trim(),
          category: goalCat,
          color: goalColor,
          completedAt: new Date().toISOString(),
        }];
        const cnt = nextSteps.length;
        queueMicrotask(() => setCelebrate({
          brief: true,
          goalComplete: true,
          goalTitle: title.trim(),
          count: cnt,
        }));
      }
      return {
        ...s,
        goals: [...(s.goals || []), {
          id: newGoalId,
          title,
          description: (input.description || '').trim(),
          category: goalCat,
          color: goalColor,
          targetDate: input.targetDate || todayStr(),
          durationDays: 0,
          milestones,
          completed,
        }],
        steps: nextSteps,
      };
    });
  };

  const updateGoal = (goalId, input) => {
    setState((s) => {
      const g = (s.goals || []).find((x) => x.id === goalId);
      if (!g) return s;
      const wasComplete = g.completed;
      const milestones = milestonesFromLines(input.milestoneText, g.milestones);
      const completed = milestones.length > 0 && milestones.every((m) => m.done);
      const nextColor = (input.color != null && String(input.color).trim())
        ? String(input.color).trim()
        : g.color;
      const next = {
        ...g,
        title: (input.title || '').trim(),
        description: (input.description || '').trim(),
        category: g.category,
        color: nextColor,
        targetDate: input.targetDate != null ? input.targetDate : g.targetDate,
        durationDays: g.durationDays || 0,
        milestones,
        completed,
      };
      let nextSteps = s.steps;
      if (!wasComplete && completed && milestones.length > 0 && !s.steps.some((st) => st.completedGoalId === goalId)) {
        nextSteps = [...s.steps, {
          id: cryptoId(),
          completedGoalId: goalId,
          title: next.title,
          description: String(next.description || '').trim(),
          category: next.category,
          ...(next.color ? { color: next.color } : {}),
          completedAt: new Date().toISOString(),
        }];
        const cnt = nextSteps.length;
        queueMicrotask(() => setCelebrate({
          brief: true,
          goalComplete: true,
          goalTitle: next.title,
          count: cnt,
        }));
      }
      return {
        ...s,
        goals: s.goals.map((x) => (x.id === goalId ? next : x)),
        steps: nextSteps,
      };
    });
  };

  const deleteGoal = (goalId) => {
    setState((s) => ({ ...s, goals: (s.goals || []).filter((x) => x.id !== goalId) }));
  };

  const toggleGoalMilestone = (goalId, milestoneId) => {
    setState((s) => {
      let nextSteps = s.steps;
      const nextGoals = (s.goals || []).map((g) => {
        if (g.id !== goalId) return g;
        const wasComplete = g.completed;
        const milestones = (g.milestones || []).map((m) =>
          (m.id === milestoneId ? { ...m, done: !m.done } : m)
        );
        const completed = milestones.length > 0 && milestones.every((m) => m.done);
        if (!wasComplete && completed && !s.steps.some((st) => st.completedGoalId === goalId)) {
          nextSteps = [...s.steps, {
            id: cryptoId(),
            completedGoalId: goalId,
            title: g.title,
            description: String(g.description || '').trim(),
            category: g.category,
            ...(g.color ? { color: g.color } : {}),
            completedAt: new Date().toISOString(),
          }];
          const cnt = nextSteps.length;
          queueMicrotask(() => setCelebrate({
            brief: true,
            goalComplete: true,
            goalTitle: g.title,
            count: cnt,
          }));
        }
        return { ...g, milestones, completed };
      });
      return { ...s, goals: nextGoals, steps: nextSteps };
    });
  };

  // Stats
  const totalSteps = state.steps.length;
  const todaySteps = state.steps.filter(s => dateKeyFromIso(s.completedAt) === todayStr()).length;
  const currentLevel = Math.floor(totalSteps / STEPS_PER_LEVEL) + 1;
  const dayStreak = computeDayStreak(state.steps);
  const projectOptions = useMemo(
    () => [...new Set(state.tasks.map(t => (t.project || '').trim()).filter(Boolean))],
    [state.tasks]
  );
  const allKnownTaskTags = useMemo(() => collectAllTaskTags(state.tasks), [state.tasks]);
  const taskTagColors = state.taskTagColors || {};

  const setTaskTagColor = useCallback((tagName, color) => {
    const key = String(tagName || '').trim();
    if (!key || !color) return;
    setState((s) => ({
      ...s,
      taskTagColors: { ...(s.taskTagColors || {}), [key]: color },
    }));
  }, []);

  if (!authReady) {
    return (
      <div style={{
        fontFamily: stepzTokens.font,
        background: stepzTokens.bg,
        color: stepzTokens.textDim,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        Carregando sessão…
      </div>
    );
  }

  const supabaseOn = typeof isSupabaseConfigured === 'function' && isSupabaseConfigured();

  if (!session) {
    /* Lê ?mode=signup vindo da landing (index.html) para abrir já em modo de cadastro. */
    let initialMode = 'login';
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'signup') initialMode = 'signup';
    } catch (_) {}
    return (
      <LoginScreen
        useSupabase={supabaseOn}
        initialMode={initialMode}
        onSubmitLogin={async (loginEmail, loginPassword) => {
          const sb = typeof getStepzSupabase === 'function' ? getStepzSupabase() : null;
          const v = validateLoginInput(loginEmail, loginPassword);
          if (!v.ok) return v.message;
          if (sb) {
            const { error } = await sb.auth.signInWithPassword({
              email: loginEmail,
              password: loginPassword,
            });
            return error ? mapSupabaseAuthError(error) : null;
          }
          saveAuthSession(loginEmail);
          setSession({ email: loginEmail });
          return null;
        }}
        onSignUp={
          supabaseOn
            ? async (signUpEmail, signUpPassword) => {
                const sb = getStepzSupabase();
                if (!sb) return 'Cliente Supabase indisponível.';
                const v = validateLoginInput(signUpEmail, signUpPassword);
                if (!v.ok) return v.message;
                const { data, error } = await sb.auth.signUp({ email: signUpEmail, password: signUpPassword });
                if (error) return mapSupabaseAuthError(error);
                const identities = data && data.user && data.user.identities;
                if (Array.isArray(identities) && identities.length === 0) {
                  return 'Este e-mail já está cadastrado. Faça login em vez de criar conta.';
                }
                if (data && data.session) {
                  return null;
                }
                return { info: 'Conta criada! Enviamos um e-mail de confirmação. Confirme pelo link para fazer login.' };
              }
            : undefined
        }
      />
    );
  }

  if (session && syncPhase === 'loading') {
    return (
      <div style={{
        fontFamily: stepzTokens.font,
        background: stepzTokens.bg,
        color: stepzTokens.textDim,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        A sincronizar…
      </div>
    );
  }

  const handleRestoreFromHistory = async (historyId) => {
    const userKey = activeUserKeyRef.current;
    const rs = typeof window !== 'undefined' ? window.stepzRemoteState : null;
    if (!rs || typeof rs.restoreFromHistory !== 'function') {
      window.alert('Restauro indisponível.');
      return;
    }
    if (!window.confirm('Restaurar este snapshot? Os dados actuais serão substituídos.')) return;
    const res = await rs.restoreFromHistory(historyId);
    if (!res || !res.ok || !res.state) {
      window.alert('Não foi possível restaurar este snapshot.');
      return;
    }
    const applied = applyAutoReopenRecurringState(res.state);
    const json = JSON.stringify(res.state);
    lastSyncedJsonRef.current = json;
    if (userKey && typeof saveStateCache === 'function') {
      saveStateCache(userKey, applied, buildCacheMeta(res.updatedAt, json));
    } else if (userKey) {
      saveState(userKey, applied);
    }
    if (userKey && typeof touchLastGoodIfRich === 'function') touchLastGoodIfRich(userKey, applied);
    setState(applied);
    setSyncNotice(null);
    setHistoryModalOpen(false);
  };

  return (
    <div style={{
      fontFamily: stepzTokens.font,
      background: stepzTokens.bg,
      color: stepzTokens.text,
      minHeight: '100vh',
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      overflowX: 'hidden',
      boxSizing: 'border-box',
    }}>
      <AppHeader
        tab={tab}
        setTab={setTab}
        totalSteps={totalSteps}
        userEmail={session.email}
        onChangePassword={() => setPasswordModalOpen(true)}
        onLogout={async () => {
          const sb = typeof getStepzSupabase === 'function' ? getStepzSupabase() : null;
          if (sb) await sb.auth.signOut();
          clearAuthSession();
          setSession(null);
        }}
        onOpenHistory={supabaseOn ? () => setHistoryModalOpen(true) : undefined}
      />
      <StateHistoryModal
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        onRestore={handleRestoreFromHistory}
      />
      {syncNotice ? (
        <div style={{
          margin: '0 auto',
          maxWidth: 1200,
          padding: '8px 16px',
          fontSize: 12,
          color: stepzTokens.warn,
          background: 'rgba(255,120,80,0.1)',
          borderBottom: `1px solid ${stepzTokens.border}`,
          textAlign: 'center',
        }}>
          {syncNotice}
        </div>
      ) : null}
      {syncPhase === 'offline' && supabaseOn ? (
        <div style={{
          margin: '0 auto',
          maxWidth: 1200,
          padding: '8px 16px',
          fontSize: 12,
          color: stepzTokens.warn,
          background: 'rgba(255,180,80,0.08)',
          borderBottom: `1px solid ${stepzTokens.border}`,
          textAlign: 'center',
        }}>
          Sem ligação ao servidor — a mostrar cache local. As alterações serão enviadas quando a rede voltar.
        </div>
      ) : null}

      <TaskGridColumnsProvider>
      <div style={{
        maxWidth: 1300,
        margin: '0 auto',
        padding: isMobile ? '16px 14px 56px' : '24px 28px 60px',
        width: '100%',
        boxSizing: 'border-box',
        minWidth: 0,
      }}>
        {tab === 'home' && (
          <HomeView
            state={state}
            totalSteps={totalSteps} todaySteps={todaySteps}
            dayStreak={dayStreak}
            onCompleteTask={completeTask} onUncompleteTask={uncompleteTask}
            onDeleteTask={deleteTask}
            onEditTask={(task) => setEditingTask(task)}
            onUpdateTask={updateTask}
            onRenameProject={renameProject}
            onToggleHabit={toggleHabitToday}
            onToggleHabitDate={toggleHabitDate}
            onEditHabit={(h) => setEditingHabit(h)}
            onStepClick={(i) => setStepDetail(i)}
            taskTagColors={taskTagColors}
            allKnownTaskTags={allKnownTaskTags}
            onSetTaskTagColor={setTaskTagColor}
            onSetProjectColor={setProjectColor}
          />
        )}
        {tab === 'tasks' && (
          <TasksView state={state} onComplete={completeTask} onUncomplete={uncompleteTask}
            onAdd={addTask} onDelete={deleteTask} onOpenCreateModal={() => setTaskModalOpen(true)}
            onEditTask={(task) => setEditingTask(task)} onRenameProject={renameProject} onUpdateTask={updateTask}
            onStepClick={(i) => setStepDetail(i)}
            onDeleteTaskCompletionStep={deleteTaskCompletionStep}
            taskTagColors={taskTagColors}
            allKnownTaskTags={allKnownTaskTags}
            onSetTaskTagColor={setTaskTagColor}
            onSetProjectColor={setProjectColor}
            onMoveTask={moveTask}
            onMoveProject={moveProject} />
        )}
        {tab === 'habits' && (
          <HabitsView
            state={state}
            onToggle={toggleHabitToday}
            onToggleDate={toggleHabitDate}
            onAdd={addHabit}
            onDelete={deleteHabit}
            onOpenCreateModal={() => setHabitModalOpen(true)}
            onEditHabit={(h) => setEditingHabit(h)}
          />
        )}
        {tab === 'goals' && (
          <GoalsView
            state={state}
            onNew={() => setGoalModal({ goal: null })}
            onEdit={(g) => setGoalModal({ goal: g })}
            onDeleteGoal={deleteGoal}
            onToggleMilestone={toggleGoalMilestone}
          />
        )}
        {tab === 'postits' && (
          <PostitsView state={state} setState={setState} onMovePostit={movePostit} />
        )}
        {tab === 'journey' && (
          <JourneyView
            state={state}
            totalSteps={totalSteps}
            currentLevel={currentLevel}
            taskTagColors={taskTagColors}
            onStepClick={(i) => setStepDetail(i)}
          />
        )}
      </div>

      {stepDetail !== null && (
        <StepDetailModal
          step={state.steps[stepDetail]}
          index={stepDetail}
          tasks={state.tasks}
          habits={state.habits}
          categories={state.categories}
          taskTagColors={taskTagColors}
          projectColors={state.projectColors}
          onClose={() => setStepDetail(null)}
        />
      )}
      {celebrate && (
        <CelebrationToast {...celebrate} onClose={() => setCelebrate(null)} />
      )}
      {habitModalOpen && (
        <HabitCreateModal
          onClose={() => setHabitModalOpen(false)}
          onCreate={(title) => {
            addHabit(title);
            setHabitModalOpen(false);
          }}
        />
      )}
      {editingHabit && (
        <HabitEditModal
          habit={editingHabit}
          categories={state.categories}
          onClose={() => setEditingHabit(null)}
          onSave={(payload) => {
            updateHabit(editingHabit.id, payload);
            setEditingHabit(null);
          }}
        />
      )}
      {taskModalOpen && (
        <TaskCreateModal
          projectOptions={projectOptions}
          taskTagColors={taskTagColors}
          allKnownTaskTags={allKnownTaskTags}
          onSetTaskTagColor={setTaskTagColor}
          onClose={() => setTaskModalOpen(false)}
          onCreate={(taskInput) => { addTask(taskInput); setTaskModalOpen(false); }}
        />
      )}
      {editingTask && (
        <TaskEditModal
          key={editingTask.id}
          task={editingTask}
          projectOptions={projectOptions}
          onClose={() => setEditingTask(null)}
          onSave={(taskInput) => { updateTask(editingTask.id, taskInput); setEditingTask(null); }}
        />
      )}
      {goalModal && (
        <GoalModal
          goal={goalModal.goal}
          categories={state.categories}
          onClose={() => setGoalModal(null)}
          onSave={(payload) => {
            if (goalModal.goal?.id) updateGoal(goalModal.goal.id, payload);
            else addGoal(payload);
            setGoalModal(null);
          }}
          onDelete={goalModal.goal?.id ? () => { deleteGoal(goalModal.goal.id); setGoalModal(null); } : undefined}
        />
      )}
      {passwordModalOpen ? (
        <ChangePasswordModal
          onClose={() => setPasswordModalOpen(false)}
          onSubmit={async (newPassword) => {
            const sb = typeof getStepzSupabase === 'function' ? getStepzSupabase() : null;
            if (!sb) return 'Supabase não configurado: não é possível alterar a senha.';
            try {
              const { error } = await sb.auth.updateUser({ password: newPassword });
              if (error) return mapSupabaseAuthError(error);
              return null;
            } catch (e) {
              return String(e && e.message ? e.message : e);
            }
          }}
        />
      ) : null}
      </TaskGridColumnsProvider>
    </div>
  );
}

function formatHistoryStateSummary(state) {
  if (!state || typeof state !== 'object') return 'sem dados';
  const tasks = Array.isArray(state.tasks) ? state.tasks.length : 0;
  const steps = Array.isArray(state.steps) ? state.steps.length : 0;
  const habits = Array.isArray(state.habits) ? state.habits.length : 0;
  const goals = Array.isArray(state.goals) ? state.goals.length : 0;
  const postits = Array.isArray(state.postits) ? state.postits.length : 0;
  const parts = [];
  if (tasks) parts.push(`${tasks} task${tasks === 1 ? '' : 's'}`);
  if (steps) parts.push(`${steps} degrau${steps === 1 ? '' : 's'}`);
  if (habits) parts.push(`${habits} hábito${habits === 1 ? '' : 's'}`);
  if (goals) parts.push(`${goals} meta${goals === 1 ? '' : 's'}`);
  if (postits) parts.push(`${postits} post-it${postits === 1 ? '' : 's'}`);
  return parts.length ? parts.join(' · ') : 'vazio';
}

function StateHistoryModal({ open, onClose, onRestore }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [restoringId, setRestoringId] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const rs = typeof window !== 'undefined' ? window.stepzRemoteState : null;
    if (!rs || typeof rs.loadHistory !== 'function') {
      setError('Histórico indisponível (Supabase não configurado).');
      setLoading(false);
      return undefined;
    }
    rs.loadHistory().then((res) => {
      if (cancelled) return;
      if (res && res.ok) {
        setEntries(Array.isArray(res.entries) ? res.entries : []);
      } else {
        setError('Não foi possível carregar o histórico. A tabela user_state_history existe no Supabase?');
      }
      setLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setError('Erro ao carregar histórico.');
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [open]);

  if (!open) return null;

  const formatWhen = (iso) => {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return String(iso || '');
      return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    } catch (_) {
      return String(iso || '');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="stepz-history-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div style={{
        width: '100%',
        maxWidth: 420,
        maxHeight: 'min(80vh, 520px)',
        background: stepzTokens.panel,
        border: `1px solid ${stepzTokens.borderStrong}`,
        borderRadius: 14,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
      }}>
        <div style={{ padding: '16px 18px', borderBottom: `1px solid ${stepzTokens.border}` }}>
          <div id="stepz-history-title" style={{ fontSize: 15, fontWeight: 600 }}>Histórico na nuvem</div>
          <div style={{ fontSize: 12, color: stepzTokens.textDim, marginTop: 4 }}>
            Até {40} snapshots (só quando o estado muda em relação ao último).
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: stepzTokens.textDim, fontSize: 13 }}>A carregar…</div>
          ) : null}
          {error ? (
            <div style={{ padding: 16, fontSize: 12, color: stepzTokens.warn, lineHeight: 1.45 }}>{error}</div>
          ) : null}
          {!loading && !error && entries.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: stepzTokens.textDim, fontSize: 13 }}>
              Ainda não há entradas. Gravações futuras aparecem aqui.
            </div>
          ) : null}
          {!loading && !error && entries.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '10px 8px',
                borderBottom: `1px solid ${stepzTokens.border}`,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: stepzTokens.text }}>{formatWhen(entry.created_at)}</div>
                <div style={{ fontSize: 11, color: stepzTokens.textDim, marginTop: 2 }}>
                  {formatHistoryStateSummary(entry.state)}
                </div>
                <div style={{ fontSize: 11, color: stepzTokens.textFaint, marginTop: 2 }}>
                  {entry.reason === 'manual' ? 'restauro manual' : 'gravação automática'}
                </div>
              </div>
              <button
                type="button"
                disabled={restoringId === entry.id}
                onClick={() => {
                  if (typeof onRestore !== 'function') return;
                  setRestoringId(entry.id);
                  Promise.resolve(onRestore(entry.id)).finally(() => setRestoringId(null));
                }}
                style={{
                  flexShrink: 0,
                  padding: '6px 10px',
                  fontSize: 12,
                  borderRadius: 8,
                  border: `1px solid ${stepzTokens.borderStrong}`,
                  background: stepzTokens.panel2,
                  color: stepzTokens.text,
                  cursor: restoringId === entry.id ? 'wait' : 'pointer',
                  fontFamily: stepzTokens.font,
                }}
              >
                {restoringId === entry.id ? '…' : 'Restaurar'}
              </button>
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 14px', borderTop: `1px solid ${stepzTokens.border}`, textAlign: 'right' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 14px',
              fontSize: 13,
              borderRadius: 8,
              border: `1px solid ${stepzTokens.border}`,
              background: 'transparent',
              color: stepzTokens.textDim,
              cursor: 'pointer',
              fontFamily: stepzTokens.font,
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfileMenu({ userEmail, onChangePassword, onLogout, isMobile, dateSubtitle, onOpenHistory }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  const updateMenuPos = () => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const width = isMobile ? 240 : 260;
    const gap = 8;
    const right = Math.max(8, window.innerWidth - rect.right);
    let top = rect.bottom + gap;
    const maxH = Math.min(window.innerHeight * 0.7, 420);
    if (top + Math.min(maxH, 280) > window.innerHeight - 8) {
      top = Math.max(8, rect.top - gap - Math.min(maxH, 280));
    }
    setMenuPos({ top, right, width, maxHeight: maxH });
  };

  useEffect(() => {
    if (!open) return undefined;
    updateMenuPos();
    const onDocMouseDown = (e) => {
      if (buttonRef.current && buttonRef.current.contains(e.target)) return;
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onReposition = () => updateMenuPos();
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, isMobile]);

  /** Inicial do email para o avatar (Foi pensada de ser estável: sempre o primeiro char a-z, ou "?" se vazio). */
  const initial = (() => {
    const s = String(userEmail || '').trim();
    const ch = s.charAt(0).toUpperCase();
    return /[A-Z0-9]/.test(ch) ? ch : '?';
  })();

  const itemBtn = {
    width: '100%',
    textAlign: 'left',
    background: 'transparent',
    border: 'none',
    padding: '10px 14px',
    fontSize: 13,
    color: stepzTokens.text,
    cursor: 'pointer',
    fontFamily: stepzTokens.font,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    borderRadius: 6,
  };

  const menuPanel = open && menuPos ? (
    <div
      ref={menuRef}
      role="menu"
      style={{
        position: 'fixed',
        top: menuPos.top,
        right: menuPos.right,
        width: menuPos.width,
        maxWidth: 'calc(100vw - 16px)',
        maxHeight: menuPos.maxHeight,
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        background: stepzTokens.panel,
        border: `1px solid ${stepzTokens.borderStrong}`,
        borderRadius: 12,
        padding: 6,
        boxShadow: '0 18px 36px rgba(0,0,0,0.55)',
        zIndex: 10050,
      }}
    >
      <div style={{ padding: '8px 12px 10px', borderBottom: `1px solid ${stepzTokens.border}`, marginBottom: 4 }}>
        <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: stepzTokens.textFaint, marginBottom: 4 }}>conta</div>
        {dateSubtitle ? (
          <div style={{ fontSize: 12, color: stepzTokens.text, marginBottom: 6, lineHeight: 1.3 }}>
            {dateSubtitle}
          </div>
        ) : null}
        <div
          title={userEmail}
          style={{
            fontSize: 12,
            color: stepzTokens.textDim,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {userEmail || 'Sem e-mail'}
        </div>
      </div>
      {typeof onChangePassword === 'function' ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => { setOpen(false); onChangePassword(); }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          style={itemBtn}
        >
          <span aria-hidden style={{ fontSize: 14 }}>🔒</span>
          <span>Editar senha</span>
        </button>
      ) : null}
      {typeof onOpenHistory === 'function' ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => { setOpen(false); onOpenHistory(); }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          style={itemBtn}
        >
          <span aria-hidden style={{ fontSize: 14 }}>🕐</span>
          <span>Histórico na nuvem</span>
        </button>
      ) : null}
      {typeof onLogout === 'function' ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => { setOpen(false); onLogout(); }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          style={{ ...itemBtn, color: 'oklch(0.78 0.14 25)' }}
        >
          <span aria-hidden style={{ fontSize: 14 }}>↩</span>
          <span>Sair</span>
        </button>
      ) : null}
    </div>
  ) : null;

  const RD = typeof ReactDOM !== 'undefined' ? ReactDOM : (typeof window !== 'undefined' ? window.ReactDOM : null);
  const portal = menuPanel && RD && typeof RD.createPortal === 'function'
    ? RD.createPortal(menuPanel, document.body)
    : menuPanel;

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (open) {
            setOpen(false);
            setMenuPos(null);
            return;
          }
          updateMenuPos();
          setOpen(true);
        }}
        title={userEmail ? `Perfil · ${userEmail}` : 'Perfil'}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          width: 34,
          height: 34,
          borderRadius: 999,
          border: `1px solid ${open ? stepzTokens.borderStrong : stepzTokens.border}`,
          background: stepzTokens.accentGradient || stepzTokens.accent,
          color: '#0a0a0b',
          fontWeight: 700,
          fontSize: 13,
          cursor: 'pointer',
          fontFamily: stepzTokens.font,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
      >
        {initial}
      </button>
      {portal}
    </div>
  );
}

function AppHeader({ tab, setTab, totalSteps, userEmail, onLogout, onChangePassword, onOpenHistory }) {
  const { isMobile } = useStepzViewport();
  const tabs = [
    { id: 'home', label: 'Início' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'habits', label: 'Hábitos' },
    { id: 'goals', label: 'Metas' },
    { id: 'postits', label: 'Post-its' },
    { id: 'journey', label: 'Jornada' },
  ];
  const todayFull = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const todayShort = new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
  const today = isMobile ? todayShort : todayFull;
  return (
    <div style={{
      borderBottom: `1px solid ${stepzTokens.border}`,
      background: stepzTokens.bg,
      position: 'sticky',
      top: 0,
      zIndex: 40,
      paddingTop: 'env(safe-area-inset-top, 0px)',
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      overflow: 'visible',
      boxSizing: 'border-box',
    }}>
      <div style={{
        maxWidth: 1300,
        margin: '0 auto',
        padding: isMobile ? '12px 14px 0' : '18px 28px 0',
        width: '100%',
        boxSizing: 'border-box',
        minWidth: 0,
        overflow: 'visible',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: isMobile ? 8 : 14,
          flexWrap: 'nowrap',
          overflow: 'visible',
          position: 'relative',
          zIndex: 2,
          minWidth: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, minWidth: 0, flex: '1 1 auto' }}>
            <img
              src="logos/svg/lockup-color-transparent-white-text.svg"
              alt="Stepz"
              draggable={false}
              style={{ height: isMobile ? 36 : 48, width: 'auto', display: 'block', objectFit: 'contain', flexShrink: 0 }}
            />
            <div style={{
              fontSize: isMobile ? 11 : 12,
              color: stepzTokens.textFaint,
              marginLeft: 2,
              padding: isMobile ? '2px 7px' : '3px 8px',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 4,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}>
              {totalSteps} {totalSteps === 1 ? 'degrau' : 'degraus'}
            </div>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? 8 : 14,
            justifyContent: 'flex-end',
            flexShrink: 0,
            minWidth: 0,
          }}>
            {!isMobile ? (
              <div
                title={todayFull}
                style={{
                  fontSize: 13,
                  color: stepzTokens.textDim,
                  textAlign: 'right',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                }}
              >
                {today}
              </div>
            ) : null}
            <ProfileMenu
              userEmail={userEmail}
              onChangePassword={onChangePassword}
              onLogout={onLogout}
              isMobile={isMobile}
              dateSubtitle={isMobile ? todayFull : undefined}
              onOpenHistory={onOpenHistory}
            />
          </div>
        </div>
        <div style={{
          display: 'flex',
          gap: isMobile ? 2 : 4,
          marginTop: 14,
          overflowX: isMobile ? 'auto' : 'visible',
          WebkitOverflowScrolling: 'touch',
          flexWrap: 'nowrap',
          paddingBottom: 2,
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          scrollbarWidth: isMobile ? 'none' : 'thin',
        }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              type="button"
              style={{
                padding: isMobile ? '10px 12px' : '10px 14px',
                fontSize: isMobile ? 13 : 14,
                background: 'transparent',
                border: 'none',
                flexShrink: 0,
                color: tab === t.id ? stepzTokens.text : stepzTokens.textDim,
                borderBottom: tab === t.id ? `2px solid ${stepzTokens.accent}` : '2px solid transparent',
                fontWeight: tab === t.id ? 500 : 400,
                cursor: 'pointer',
                fontFamily: stepzTokens.font,
              }}>{t.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Inspiração do dia — catálogo em app/inspiration-quotes.js, rotação sequencial por dia de calendário. */
function HomeInspirationQuote() {
  const { isMobile } = useStepzViewport();
  const day = todayStr();
  const catalog = typeof INSPIRATION_QUOTES !== 'undefined' ? INSPIRATION_QUOTES : [];
  const epoch = typeof INSPIRATION_QUOTES_EPOCH !== 'undefined' ? INSPIRATION_QUOTES_EPOCH : day;
  const pickFn = typeof pickInspirationForDay === 'function' ? pickInspirationForDay : null;
  const picked = pickFn ? pickFn(catalog, epoch, day) : null;

  const wrapStyle = {
    marginBottom: isMobile ? 12 : 14,
    padding: isMobile ? '12px 14px' : '14px 18px',
    borderRadius: 12,
    border: `1px solid ${stepzTokens.border}`,
    background: 'rgba(255,255,255,0.03)',
    maxWidth: '100%',
    boxSizing: 'border-box',
  };

  if (!catalog.length) {
    return (
      <div style={{ ...wrapStyle, fontSize: 12, color: stepzTokens.textDim, lineHeight: 1.45 }}>
        Nenhuma frase no catálogo. Adicione entradas em{' '}
        <code style={{ fontSize: 11, color: stepzTokens.textFaint }}>app/inspiration-quotes.js</code>.
      </div>
    );
  }

  if (!picked || !picked.quote?.q) return null;

  const { quote, index, total } = picked;

  return (
    <div style={wrapStyle}>
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 10,
        marginBottom: 8,
        flexWrap: 'wrap',
      }}>
        <div style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: stepzTokens.accent,
        }}>
          Inspiração do dia
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          flexWrap: 'wrap',
          alignItems: isMobile ? 'flex-start' : 'baseline',
          gap: isMobile ? 6 : 10,
          minWidth: 0,
          fontSize: isMobile ? 13 : 14,
          lineHeight: 1.55,
          color: stepzTokens.text,
          overflowWrap: 'break-word',
          wordBreak: 'break-word',
        }}
      >
        <span style={{ fontStyle: 'italic', fontWeight: 400, whiteSpace: 'normal' }}>
          “{quote.q}”
        </span>
        {quote.a ? (
          <span style={{
            color: stepzTokens.textDim,
            fontStyle: 'normal',
            fontWeight: 500,
            fontSize: isMobile ? 12 : 13,
            whiteSpace: 'normal',
          }}>
            — {quote.a}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function HomeView({ state, totalSteps, todaySteps, dayStreak,
  onCompleteTask, onUncompleteTask, onDeleteTask, onEditTask, onUpdateTask, onRenameProject, onToggleHabit, onToggleHabitDate, onEditHabit, onStepClick,
  taskTagColors, allKnownTaskTags, onSetTaskTagColor, onSetProjectColor }) {
  const { isMobile } = useStepzViewport();
  const [tagEditor, setTagEditor] = useState(null);
  const [priorityEditor, setPriorityEditor] = useState(null);
  const [statusEditor, setStatusEditor] = useState(null);
  const tagPopoverTask = tagEditor ? state.tasks.find((x) => x.id === tagEditor.taskId) : null;
  const priorityPopoverTask = priorityEditor ? state.tasks.find((x) => x.id === priorityEditor.taskId) : null;
  const statusPopoverTask = statusEditor ? state.tasks.find((x) => x.id === statusEditor.taskId) : null;
  const todayTasks = state.tasks
    .filter(t => t.dueDate === todayStr() || !t.done)
    .sort((a, b) => Number(a.done) - Number(b.done));
  const todayByProject = groupTasksByProject(todayTasks, state.projectOrder);
  return (
    <>
    <HomeInspirationQuote />
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr 340px',
      gap: isMobile ? 16 : 20,
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 14 : 18, minWidth: 0 }}>
        <LiveStairs
          steps={state.steps}
          tasks={state.tasks}
          habits={state.habits}
          categories={state.categories}
          taskTagColors={taskTagColors}
          projectColors={state.projectColors}
          onStepClick={onStepClick}
          layoutCompact={isMobile}
        />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: isMobile ? 8 : 12,
        }}>
          <Tile label="Total" value={totalSteps} accent={stepzTokens.accent} />
          <Tile label="Hoje" value={todaySteps} accent={stepzTokens.warn} />
          <Tile label="Streak" value={`${dayStreak}d`} accent={stepzTokens.success} />
        </div>
        <Panel2 title="Tasks a fazer">
          {todayTasks.length === 0 ? (
            <Empty msg="Nenhuma task. Crie uma na aba Tasks." />
          ) : todayByProject.map(([project, tasks]) => (
            <TaskProjectSection
              key={`today-${project}`}
              project={project}
              count={tasks.length}
              onRenameProject={onRenameProject}
              showTaskTableHeader
              projectAccentColor={stepzResolveProjectColor(project, state.projectColors)}
              onSetProjectColor={typeof onSetProjectColor === 'function' ? (c) => onSetProjectColor(project, c) : undefined}
            >
              {tasks.map(t => (
                <TaskItem key={t.id} task={t}
                  taskTagColors={taskTagColors}
                  onTagsPopoverOpen={(anchor) => { setPriorityEditor(null); setStatusEditor(null); setTagEditor({ taskId: t.id, ...anchor }); }}
                  onPriorityPopoverOpen={(anchor) => { setTagEditor(null); setStatusEditor(null); setPriorityEditor({ taskId: t.id, ...anchor }); }}
                  onStatusPopoverOpen={(anchor) => { setTagEditor(null); setPriorityEditor(null); setStatusEditor({ taskId: t.id, ...anchor }); }}
                  onComplete={() => onCompleteTask(t.id)}
                  onUncomplete={() => onUncompleteTask(t.id)}
                  onUpdateTask={(patch) => onUpdateTask(t.id, patch)}
                  onEditTask={() => onEditTask(t)}
                  onDelete={() => onDeleteTask(t.id)} />
              ))}
            </TaskProjectSection>
          ))}
        </Panel2>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 14 : 18, minWidth: 0 }}>
        <Panel2 title="Hábitos diários">
          {state.habits.length === 0 ? <Empty msg="Vá para Hábitos para criar." small /> :
            state.habits.map(h => (
              <HabitRowToday key={h.id} habit={h} categories={state.categories} onToggle={() => onToggleHabit(h.id)} onToggleDate={onToggleHabitDate ? (date) => onToggleHabitDate(h.id, date) : undefined} onEdit={onEditHabit ? () => onEditHabit(h) : undefined} />
            ))
          }
        </Panel2>
        <Panel2 title={`Coleção · ${Math.min(LEVEL_META.length, Math.floor(totalSteps / STEPS_PER_LEVEL))} / ${LEVEL_META.length}`}>
          <PatamarCollectionGrid totalSteps={totalSteps} />
        </Panel2>
      </div>
    </div>
    {tagEditor && tagPopoverTask && (
      <TaskTagsPopover
        key={tagEditor.taskId}
        anchor={{ left: tagEditor.left, top: tagEditor.top }}
        taskTags={tagPopoverTask.tags || []}
        allKnownTags={allKnownTaskTags}
        tagColors={taskTagColors}
        onClose={() => setTagEditor(null)}
        onSave={(tags) => onUpdateTask(tagEditor.taskId, { tags })}
        onSetTagColor={onSetTaskTagColor}
      />
    )}
    {priorityEditor && priorityPopoverTask && (
      <TaskPriorityPopover
        key={`pri-${priorityEditor.taskId}`}
        anchor={{ left: priorityEditor.left, top: priorityEditor.top }}
        priorityId={priorityPopoverTask.priority || TASK_PRIORITIES[1].id}
        onClose={() => setPriorityEditor(null)}
        onSave={(pid) => onUpdateTask(priorityEditor.taskId, { priority: pid })}
      />
    )}
    {statusEditor && statusPopoverTask && (
      <TaskStatusPopover
        key={`sta-${statusEditor.taskId}`}
        anchor={{ left: statusEditor.left, top: statusEditor.top }}
        statusId={normalizeTaskStatus(statusPopoverTask.status, statusPopoverTask.done)}
        onClose={() => setStatusEditor(null)}
        onSave={(sid) => onUpdateTask(statusEditor.taskId, { status: sid })}
      />
    )}
    </>
  );
}

function TasksView({ state, onComplete, onUncomplete, onAdd, onDelete, onOpenCreateModal, onEditTask, onRenameProject, onUpdateTask, onStepClick, onDeleteTaskCompletionStep, taskTagColors, allKnownTaskTags, onSetTaskTagColor, onSetProjectColor, onMoveTask, onMoveProject }) {
  const [tagEditor, setTagEditor] = useState(null);
  const [priorityEditor, setPriorityEditor] = useState(null);
  const [statusEditor, setStatusEditor] = useState(null);
  const tagPopoverTask = tagEditor ? state.tasks.find((x) => x.id === tagEditor.taskId) : null;
  const priorityPopoverTask = priorityEditor ? state.tasks.find((x) => x.id === priorityEditor.taskId) : null;
  const statusPopoverTask = statusEditor ? state.tasks.find((x) => x.id === statusEditor.taskId) : null;
  const openCount = state.tasks.filter(t => !t.done).length;
  const allByProject = groupTasksByProject(state.tasks, state.projectOrder);

  const projectDrag = useDraggableList(onMoveProject);

  const taskCompletionArchive = useMemo(() => (
    state.steps
      .map((st, stepIndex) => ({ ...st, stepIndex }))
      .filter(st => st.taskId)
  ), [state.steps]);

  return (
    <>
    <div style={{
      maxWidth: 'min(1180px, 100%)',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
      width: '100%',
      minWidth: 0,
      boxSizing: 'border-box',
    }}>
      <Panel2 title={`Tasks por projeto · ${openCount} abertas`} action={<TaskAddButton onClick={onOpenCreateModal} />}>
        {state.tasks.length === 0 ? (
          <Empty msg="Nenhuma task ainda. Crie uma acima." />
        ) : (
          allByProject.map(([project, tasks], projectIdx) => {
            const openTasks = tasks.filter((t) => !t.done);
            const doneTasks = tasks.filter((t) => t.done);
            const isThisProjectDragging = !!(projectDrag.drag && projectDrag.drag.fromIdx === projectIdx);
            const dropBefore = !!(projectDrag.drag && projectDrag.drag.dropIdx === projectIdx && projectDrag.drag.fromIdx !== projectIdx && projectDrag.drag.fromIdx !== projectIdx - 1);
            const dropAfter = projectIdx === allByProject.length - 1 && !!(projectDrag.drag && projectDrag.drag.dropIdx === allByProject.length && projectDrag.drag.fromIdx !== allByProject.length - 1);
            const renderRow = (t, idx, extras) => (
              <TaskItem key={t.id} task={t}
                setItemRef={extras.setItemRef}
                dragHandleProps={extras.dragHandleProps}
                isDragging={extras.isDragging}
                taskTagColors={taskTagColors}
                onTagsPopoverOpen={(anchor) => { setPriorityEditor(null); setStatusEditor(null); setTagEditor({ taskId: t.id, ...anchor }); }}
                onPriorityPopoverOpen={(anchor) => { setTagEditor(null); setStatusEditor(null); setPriorityEditor({ taskId: t.id, ...anchor }); }}
                onStatusPopoverOpen={(anchor) => { setTagEditor(null); setPriorityEditor(null); setStatusEditor({ taskId: t.id, ...anchor }); }}
                onComplete={() => onComplete(t.id)}
                onUncomplete={t.done ? () => onUncomplete(t.id) : undefined}
                onUpdateTask={(patch) => onUpdateTask(t.id, patch)}
                onEditTask={() => onEditTask(t)}
                onDelete={() => onDelete(t.id)} />
            );
            return (
              <TaskProjectSection
                key={`proj-${project}`}
                project={project}
                count={tasks.length}
                onRenameProject={onRenameProject}
                showTaskTableHeader
                projectDragHandleProps={onMoveProject ? projectDrag.getHandleProps(projectIdx) : undefined}
                projectItemRef={onMoveProject ? projectDrag.setItemEl(projectIdx) : undefined}
                isProjectDragging={isThisProjectDragging}
                dropBefore={dropBefore}
                dropAfter={dropAfter}
                projectAccentColor={stepzResolveProjectColor(project, state.projectColors)}
                onSetProjectColor={typeof onSetProjectColor === 'function' ? (c) => onSetProjectColor(project, c) : undefined}
              >
                <DraggableTaskGroup
                  tasks={openTasks}
                  project={project}
                  group="open"
                  onMoveTask={onMoveTask}
                  renderItem={renderRow}
                />
                <DraggableTaskGroup
                  tasks={doneTasks}
                  project={project}
                  group="done"
                  onMoveTask={onMoveTask}
                  renderItem={renderRow}
                />
              </TaskProjectSection>
            );
          })
        )}
      </Panel2>

      {taskCompletionArchive.length > 0 && (
        <Panel2 title={`Concluídas · ${taskCompletionArchive.length} no histórico (ligadas aos degraus)`}>
          <div style={{ fontSize: 11, color: stepzTokens.textFaint, marginBottom: 12, lineHeight: 1.45 }}>
            Cada conclusão vira um degrau na escada. Ao apagar a task no projeto, o registro e o degrau permanecem aqui.
            {' '}Use o ✕ ao lado do número para remover essa conclusão e o degrau correspondente.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[...taskCompletionArchive].reverse().map((st) => (
              <div
                key={st.id || `${st.stepIndex}-${st.completedAt}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  background: stepzTokens.panel2,
                  borderRadius: 8,
                  border: `1px solid ${stepzTokens.border}`,
                  fontFamily: stepzTokens.font,
                }}
              >
                <button
                  type="button"
                  onClick={() => onStepClick && onStepClick(st.stepIndex)}
                  title="Ver o mesmo degrau da escada"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: onStepClick ? 'pointer' : 'default',
                    textAlign: 'left',
                    fontFamily: stepzTokens.font,
                    color: 'inherit',
                  }}
                >
                  <div style={{ width: 4, height: 28, background: stepzTokens.accent, borderRadius: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: stepzTokens.text, fontWeight: 500 }}>{st.title}</div>
                    <div style={{ fontSize: 11, color: stepzTokens.textFaint, marginTop: 2 }}>
                      {(st.project || DEFAULT_PROJECT)} · {formatDate(st.completedAt.slice(0, 10))}
                      {' · '}{formatRelative(st.completedAt)}
                    </div>
                  </div>
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {typeof onDeleteTaskCompletionStep === 'function' ? (
                    <button
                      type="button"
                      title="Apagar esta conclusão e o degrau na escada"
                      aria-label="Apagar conclusão e degrau"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!confirm('Remover esta conclusão e o degrau correspondente na escada?')) return;
                        onDeleteTaskCompletionStep({ id: st.id, stepIndex: st.stepIndex });
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: stepzTokens.textFaint,
                        cursor: 'pointer',
                        fontSize: 18,
                        lineHeight: 1,
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontFamily: stepzTokens.font,
                      }}
                    >×</button>
                  ) : null}
                  <span style={{ fontSize: 11, color: stepzTokens.textFaint, fontFamily: stepzTokens.fontMono }}>
                    #{st.stepIndex + 1}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Panel2>
      )}
    </div>
    {tagEditor && tagPopoverTask && (
      <TaskTagsPopover
        key={tagEditor.taskId}
        anchor={{ left: tagEditor.left, top: tagEditor.top }}
        taskTags={tagPopoverTask.tags || []}
        allKnownTags={allKnownTaskTags}
        tagColors={taskTagColors}
        onClose={() => setTagEditor(null)}
        onSave={(tags) => onUpdateTask(tagEditor.taskId, { tags })}
        onSetTagColor={onSetTaskTagColor}
      />
    )}
    {priorityEditor && priorityPopoverTask && (
      <TaskPriorityPopover
        key={`pri-${priorityEditor.taskId}`}
        anchor={{ left: priorityEditor.left, top: priorityEditor.top }}
        priorityId={priorityPopoverTask.priority || TASK_PRIORITIES[1].id}
        onClose={() => setPriorityEditor(null)}
        onSave={(pid) => onUpdateTask(priorityEditor.taskId, { priority: pid })}
      />
    )}
    {statusEditor && statusPopoverTask && (
      <TaskStatusPopover
        key={`sta-${statusEditor.taskId}`}
        anchor={{ left: statusEditor.left, top: statusEditor.top }}
        statusId={normalizeTaskStatus(statusPopoverTask.status, statusPopoverTask.done)}
        onClose={() => setStatusEditor(null)}
        onSave={(sid) => onUpdateTask(statusEditor.taskId, { status: sid })}
      />
    )}
    </>
  );
}

/* =============================================================================
 * Drag-and-drop: helpers genéricos (sem libs externas).
 * Usa Pointer Events com setPointerCapture — funciona em rato e touch.
 * - useDraggableList: lista vertical (tasks dentro de um projeto, lista de projetos).
 * - useMasonryDrag:   grelha de post-its em colunas (drop pelo cartão mais próximo).
 * - DragHandle/DropIndicator: componentes apresentacionais partilhados.
 * ============================================================================= */

function DragHandle({ onPointerDown, onPointerMove, onPointerUp, onPointerCancel, isMobile, isActive, label = 'Arrastar para reordenar', dim = false }) {
  /* opacidade: em mobile sempre visível; no desktop um pouco mais ténue para não competir
     com a leitura, e em hover do parent (gerido pelo parent via state) sobe. */
  const baseOpacity = isActive ? 1 : (isMobile ? 0.75 : (dim ? 0.15 : 0.6));
  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      aria-label={label}
      title={label}
      style={{
        background: 'transparent',
        border: 'none',
        padding: 0,
        width: 28,
        height: 28,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: isActive ? 'grabbing' : 'grab',
        color: stepzTokens.textFaint,
        touchAction: 'none',
        opacity: baseOpacity,
        transition: 'opacity 120ms ease',
        flexShrink: 0,
      }}
    >
      <svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true" focusable="false">
        <circle cx="2" cy="2" r="1.2" fill="currentColor" />
        <circle cx="8" cy="2" r="1.2" fill="currentColor" />
        <circle cx="2" cy="7" r="1.2" fill="currentColor" />
        <circle cx="8" cy="7" r="1.2" fill="currentColor" />
        <circle cx="2" cy="12" r="1.2" fill="currentColor" />
        <circle cx="8" cy="12" r="1.2" fill="currentColor" />
      </svg>
    </button>
  );
}

function DropIndicator({ active, inset = 0 }) {
  if (!active) return null;
  return (
    <div aria-hidden="true" style={{
      height: 2,
      marginLeft: inset,
      background: stepzTokens.accent,
      borderRadius: 2,
      boxShadow: `0 0 0 2px ${stepzTokens.accent}33`,
      pointerEvents: 'none',
    }} />
  );
}

/**
 * Wrapper de grupo de tasks arrastáveis (open ou done dentro de um projeto).
 * `renderItem(task, idx, { dragHandleProps, setItemRef, isDragging })` produz o JSX da row.
 */
function DraggableTaskGroup({ tasks, project, group, onMoveTask, renderItem }) {
  const { drag, setItemEl, getHandleProps } = useDraggableList((from, to) => {
    if (typeof onMoveTask !== 'function') return;
    const t = tasks[from];
    if (!t) return;
    onMoveTask(t.id, project, from, to, group);
  });
  return (
    <>
      {tasks.map((t, idx) => {
        const isDragging = !!(drag && drag.fromIdx === idx);
        /* Mostra o indicador "antes do idx" se: dropIdx === idx, e não é o próprio item nem o seguinte ao próprio. */
        const showBefore = !!(drag && drag.dropIdx === idx && drag.fromIdx !== idx && drag.fromIdx !== idx - 1);
        return (
          <React.Fragment key={t.id}>
            <DropIndicator active={showBefore} inset={24} />
            {renderItem(t, idx, {
              dragHandleProps: getHandleProps(idx),
              setItemRef: setItemEl(idx),
              isDragging,
            })}
          </React.Fragment>
        );
      })}
      <DropIndicator
        active={!!(drag && drag.dropIdx === tasks.length && drag.fromIdx !== tasks.length - 1)}
        inset={24}
      />
    </>
  );
}

/**
 * Estado/handlers para reordenar uma lista vertical. O componente lista regista cada item
 * via `setItemEl(idx)` (ref callback). No pointerdown chamamos `setPointerCapture` no handle
 * para receber os pointermove/up mesmo fora do botão.
 *
 * `onMove(fromIdx, toIdx)` é chamado no pointerup (toIdx é o índice "alvo" — o helper splice
 * imutável em moveTask/moveProject já lida com from<to vs from>to).
 */
function useDraggableList(onMove) {
  const itemElsRef = useRef([]);
  const [drag, setDrag] = useState(null); // { fromIdx, dropIdx }
  const pointerIdRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => { dragRef.current = drag; }, [drag]);

  const setItemEl = useCallback((idx) => (el) => {
    itemElsRef.current[idx] = el || null;
  }, []);

  const computeDropIdx = useCallback((clientY) => {
    const els = itemElsRef.current;
    let count = 0;
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const midY = r.top + r.height / 2;
      if (clientY < midY) return count;
      count += 1;
    }
    return count;
  }, []);

  const onPointerMove = useCallback((e) => {
    const cur = dragRef.current;
    if (!cur) return;
    if (pointerIdRef.current != null && e.pointerId !== pointerIdRef.current) return;
    const dropIdx = computeDropIdx(e.clientY);
    if (dropIdx !== cur.dropIdx) setDrag({ ...cur, dropIdx });
  }, [computeDropIdx]);

  const finishDrag = useCallback((commit) => {
    const cur = dragRef.current;
    if (!cur) return;
    setDrag(null);
    pointerIdRef.current = null;
    if (commit && typeof onMove === 'function' && cur.fromIdx !== cur.dropIdx) {
      onMove(cur.fromIdx, cur.dropIdx);
    }
  }, [onMove]);

  const onPointerUp = useCallback((e) => {
    if (pointerIdRef.current != null && e && e.pointerId !== pointerIdRef.current) return;
    finishDrag(true);
  }, [finishDrag]);

  const onPointerCancel = useCallback(() => finishDrag(false), [finishDrag]);

  const getHandleProps = useCallback((idx) => ({
    onPointerDown: (e) => {
      if (e.button != null && e.button !== 0) return;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
      pointerIdRef.current = e.pointerId;
      setDrag({ fromIdx: idx, dropIdx: idx });
      e.preventDefault();
      e.stopPropagation();
    },
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  }), [onPointerMove, onPointerUp, onPointerCancel]);

  return { drag, setItemEl, getHandleProps };
}

/**
 * Drag para grelhas tipo masonry (post-its). Usa distância euclidiana ao centro de cada
 * cartão para encontrar o alvo; decide antes/depois pela posição vertical no cartão alvo.
 * `itemKeys` é a lista de chaves visíveis (ordem do subset filtrado); o componente passa
 * `fromIdx`/`toIdx` que se referem a essas chaves — é responsabilidade do caller traduzi-las
 * para índices reais do array global antes de chamar a mutation.
 */
function useMasonryDrag(onMove) {
  const itemElsRef = useRef([]);
  const [drag, setDrag] = useState(null);
  const pointerIdRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => { dragRef.current = drag; }, [drag]);

  const setItemEl = useCallback((idx) => (el) => {
    itemElsRef.current[idx] = el || null;
  }, []);

  const computeDropIdx = useCallback((clientX, clientY) => {
    const els = itemElsRef.current;
    let best = { idx: -1, dist: Infinity, before: true };
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < best.dist) {
        best = { idx: i, dist: d2, before: clientY < cy };
      }
    }
    if (best.idx < 0) return 0;
    return best.before ? best.idx : best.idx + 1;
  }, []);

  const onPointerMove = useCallback((e) => {
    const cur = dragRef.current;
    if (!cur) return;
    if (pointerIdRef.current != null && e.pointerId !== pointerIdRef.current) return;
    const dropIdx = computeDropIdx(e.clientX, e.clientY);
    if (dropIdx !== cur.dropIdx) setDrag({ ...cur, dropIdx });
  }, [computeDropIdx]);

  const finishDrag = useCallback((commit) => {
    const cur = dragRef.current;
    if (!cur) return;
    setDrag(null);
    pointerIdRef.current = null;
    if (commit && typeof onMove === 'function' && cur.fromIdx !== cur.dropIdx) {
      onMove(cur.fromIdx, cur.dropIdx);
    }
  }, [onMove]);

  const onPointerUp = useCallback((e) => {
    if (pointerIdRef.current != null && e && e.pointerId !== pointerIdRef.current) return;
    finishDrag(true);
  }, [finishDrag]);

  const onPointerCancel = useCallback(() => finishDrag(false), [finishDrag]);

  const getHandleProps = useCallback((idx) => ({
    onPointerDown: (e) => {
      if (e.button != null && e.button !== 0) return;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
      pointerIdRef.current = e.pointerId;
      setDrag({ fromIdx: idx, dropIdx: idx });
      e.preventDefault();
      e.stopPropagation();
    },
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  }), [onPointerMove, onPointerUp, onPointerCancel]);

  return { drag, setItemEl, getHandleProps };
}

/**
 * Agrupa tasks por projeto. Ordem dos projetos vem de `projectOrder` (drag manual);
 * projetos não listados ali vão para o fim na ordem em que aparecem nas tasks (compat).
 * Dentro de cada projeto, sort estável: primeiro as não-concluídas, depois as concluídas —
 * preservando a ordem original do array em ambos os grupos (essa ordem é o que o utilizador
 * controla via drag).
 */
function groupTasksByProject(tasks, projectOrder) {
  const grouped = {};
  tasks.forEach((task) => {
    const project = (task.project || '').trim() || DEFAULT_PROJECT;
    if (!grouped[project]) grouped[project] = [];
    grouped[project].push(task);
  });
  Object.values(grouped).forEach((projectTasks) => {
    const open = projectTasks.filter((t) => !t.done);
    const done = projectTasks.filter((t) => t.done);
    projectTasks.length = 0;
    projectTasks.push(...open, ...done);
  });
  const ordered = [];
  const seen = new Set();
  const orderList = Array.isArray(projectOrder) ? projectOrder : [];
  for (const p of orderList) {
    if (grouped[p]) {
      ordered.push([p, grouped[p]]);
      seen.add(p);
    }
  }
  for (const [p, list] of Object.entries(grouped)) {
    if (!seen.has(p)) ordered.push([p, list]);
  }
  return ordered;
}

/** Iniciais dos dias da semana em PT-BR (índice 0 = domingo, como Date.getDay()). */
const WEEKDAY_LETTERS_PT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
function weekdayLetterPt(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${String(dateStr).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return WEEKDAY_LETTERS_PT[d.getDay()];
}

function habitCategoryMeta(habit, categories) {
  const list = Array.isArray(categories) && categories.length ? categories : baseCategoriesSeed();
  const id = habit?.category || defaultTaskCategoryId();
  const row = list.find((c) => c.id === id);
  return row || list[0] || { id: 'mind', label: '—', color: stepzTokens.textDim };
}

function habitAccentCss(habit, categories) {
  const c = habit?.color != null && String(habit.color).trim();
  if (c) return String(habit.color).trim();
  return habitCategoryMeta(habit, categories).color;
}

function initialHabitEditColor(habit, categories) {
  if (habit?.color != null && String(habit.color).trim()) return String(habit.color).trim();
  return habitCategoryMeta(habit, categories).color || TASK_TAG_COLOR_OPTIONS[0].color;
}

/** Cor/categoria interna para hábitos sem UI de categoria: estável pelo título. */
function habitCategoryIdFromTitle(title) {
  const seed = baseCategoriesSeed();
  if (!seed.length) return defaultTaskCategoryId();
  const s = String(title || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i) * (i + 1)) % 2147483647;
  return seed[Math.abs(h) % seed.length].id;
}

function goalAccentCss(goal, categories) {
  const list = Array.isArray(categories) && categories.length ? categories : baseCategoriesSeed();
  const c = goal?.color != null && String(goal.color).trim();
  if (c) return String(goal.color).trim();
  return habitCategoryMeta({ category: goal?.category }, list).color || stepzTokens.accent;
}

function goalPaletteLabel(cssColor) {
  const c = String(cssColor || '').trim();
  if (!c) return '—';
  const opt = TASK_TAG_COLOR_OPTIONS.find((o) => o.color.toLowerCase() === c.toLowerCase());
  if (opt) return opt.label;
  return 'Cor personalizada';
}

function initialGoalModalColor(goal, categories) {
  const list = Array.isArray(categories) && categories.length ? categories : baseCategoriesSeed();
  if (goal?.color != null && String(goal.color).trim()) return String(goal.color).trim();
  return habitCategoryMeta({ category: goal?.category }, list).color || TASK_TAG_COLOR_OPTIONS[0].color;
}

function computeGoalProgress(g) {
  const ms = g.milestones || [];
  if (ms.length === 0) return g.completed ? 100 : 0;
  return Math.round((ms.filter((m) => m.done).length / ms.length) * 100);
}

function isGoalComplete(g) {
  if (g.completed) return true;
  const ms = g.milestones || [];
  return ms.length > 0 && ms.every((m) => m.done);
}

function milestonesFromLines(text, prevMilestones) {
  const lines = String(text || '').split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const prev = prevMilestones || [];
  return lines.map((title, i) => {
    if (prev[i] && prev[i].title === title) return prev[i];
    const same = prev.find((m) => m.title === title);
    return same ? { ...same, title } : { id: cryptoId(), title, done: false };
  });
}

function goalToMilestoneText(g) {
  return (g.milestones || []).map((m) => m.title).join('\n');
}

const habitBarControlStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: `1px solid ${stepzTokens.border}`,
  color: stepzTokens.text,
  fontSize: 12,
  padding: '8px 10px',
  borderRadius: 8,
  outline: 'none',
  fontFamily: stepzTokens.font,
};

function HabitsAddBar({ onAdd, onOpenCreateModal }) {
  const [val, setVal] = useState('');
  const { isMobile } = useStepzViewport();
  const submit = () => {
    const t = val.trim();
    if (!t) return;
    onAdd(t);
    setVal('');
  };
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', width: isMobile ? '100%' : 'auto' }}>
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="Novo hábito…"
        style={{
          ...habitBarControlStyle,
          flex: isMobile ? '1 1 100%' : '1 1 160px',
          width: isMobile ? '100%' : 260,
          maxWidth: isMobile ? '100%' : '52vw',
          minWidth: isMobile ? 0 : 160,
        }}
      />
      <button
        type="button"
        onClick={() => {
          const t = val.trim();
          if (t) {
            onAdd(t);
            setVal('');
          } else {
            onOpenCreateModal && onOpenCreateModal();
          }
        }}
        title={val.trim() ? 'Adicionar hábito com o texto do campo' : 'Abrir formulário para novo hábito'}
        style={{
          width: 34,
          height: 34,
          flexShrink: 0,
          borderRadius: 8,
          border: 'none',
          background: stepzAccentBg(),
          color: '#0a0a0b',
          fontSize: 18,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: stepzTokens.font,
          lineHeight: 1,
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        +
      </button>
    </div>
  );
}

function HabitsView({ state, onToggle, onToggleDate, onAdd, onDelete, onOpenCreateModal, onEditHabit }) {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18, width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <Panel2 title="Seus hábitos" action={<HabitsAddBar onAdd={onAdd} onOpenCreateModal={onOpenCreateModal} />}>
        {state.habits.length === 0 ? <Empty msg="Crie seu primeiro hábito acima." /> :
          state.habits.map(h => (
            <HabitFullRow
              key={h.id}
              habit={h}
              categories={state.categories}
              onToggle={() => onToggle(h.id)}
              onToggleDate={onToggleDate ? (date) => onToggleDate(h.id, date) : undefined}
              onDelete={() => onDelete(h.id)}
              onEdit={onEditHabit ? () => onEditHabit(h) : undefined}
            />
          ))
        }
      </Panel2>
    </div>
  );
}

function GoalMetricTile({ label, value, accent, icon }) {
  return (
    <div style={{
      background: stepzTokens.panel,
      border: `1px solid ${stepzTokens.border}`,
      borderRadius: 12,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: accent, display: 'flex', alignItems: 'center' }}>{icon}</span>
        <span style={{ fontSize: 11, color: stepzTokens.textDim, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
      </div>
      <div style={{
        fontSize: 26,
        fontWeight: 600,
        letterSpacing: -0.8,
        color: accent || stepzTokens.text,
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
    </div>
  );
}

function durationPillStyle(days) {
  const n = Number(days) || 0;
  const bg = n <= 35 ? 'oklch(0.42 0.14 25)' : 'oklch(0.48 0.14 75)';
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    color: '#fff',
    background: bg,
  };
}

function GoalCard({ goal, categories, onEdit, onDelete, onToggleMilestone }) {
  const accent = goalAccentCss(goal, categories);
  const pct = computeGoalProgress(goal);
  const dateLabel = goal.targetDate
    ? new Date(`${goal.targetDate}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
  const dur = goal.durationDays != null && goal.durationDays > 0 ? `${goal.durationDays} dias` : null;

  return (
    <div style={{
      background: stepzTokens.panel,
      border: `1px solid ${stepzTokens.border}`,
      borderRadius: 14,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
    }}>
      <div style={{
        padding: '16px 18px 14px',
        background: `linear-gradient(165deg, color-mix(in srgb, ${accent} 22%, transparent) 0%, ${stepzTokens.panel} 62%)`,
        borderBottom: `1px solid ${stepzTokens.border}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: -0.3, color: accent }}>{goal.title}</div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              type="button"
              title="Editar meta"
              onClick={() => onEdit(goal)}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${stepzTokens.border}`,
                color: stepzTokens.textDim,
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: 6,
                cursor: 'pointer',
                fontFamily: stepzTokens.font,
              }}
            >editar</button>
            <button
              type="button"
              title="Apagar meta"
              onClick={() => { if (confirm('Apagar esta meta?')) onDelete(goal.id); }}
              style={{
                background: 'transparent',
                border: `1px solid ${stepzTokens.border}`,
                color: stepzTokens.textFaint,
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: 6,
                cursor: 'pointer',
                fontFamily: stepzTokens.font,
              }}
            >✕</button>
          </div>
        </div>
        {goal.description ? (
          <div style={{ fontSize: 13, color: stepzTokens.textDim, lineHeight: 1.45, marginBottom: 10 }}>{goal.description}</div>
        ) : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: stepzTokens.textDim }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
              <path d="M5 2v2M11 2v2M2.5 6.5h11" />
            </svg>
            {dateLabel}
          </div>
          {dur ? <span style={durationPillStyle(goal.durationDays)}>{dur}</span> : null}
        </div>
      </div>
      <div style={{ padding: '14px 18px 12px', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: stepzTokens.text }}>Progresso geral</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: accent }}>{pct}%</span>
        </div>
        <div style={{
          height: 8,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
          marginBottom: 14,
        }}>
          <div style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 999,
            background: accent,
            transition: 'width 0.25s ease',
          }} />
        </div>
        <div style={{ fontSize: 11, color: stepzTokens.textDim, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>Marcos</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(goal.milestones || []).length === 0 ? (
            <div style={{ fontSize: 12, color: stepzTokens.textFaint }}>Nenhum marco — edite a meta para adicionar.</div>
          ) : (goal.milestones || []).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onToggleMilestone(goal.id, m.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                textAlign: 'left',
                padding: '8px 12px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontFamily: stepzTokens.font,
                background: m.done
                  ? `color-mix(in srgb, ${accent} 28%, rgba(255,255,255,0.04))`
                  : 'rgba(255,255,255,0.04)',
              }}
            >
              <span style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                border: m.done ? 'none' : `2px solid ${stepzTokens.border}`,
                background: m.done ? stepzTokens.success : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {m.done ? (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#0a0a0b" strokeWidth="2.2">
                    <path d="M2 6l3 3 5-6" />
                  </svg>
                ) : null}
              </span>
              <span style={{
                fontSize: 13,
                color: m.done ? stepzTokens.text : stepzTokens.textDim,
                textDecoration: m.done ? 'none' : 'none',
              }}>{m.title}</span>
            </button>
          ))}
        </div>
        <div style={{ marginTop: 14 }}>
          <span style={{
            display: 'inline-flex',
            padding: '4px 12px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 600,
            color: '#fff',
            background: accent,
          }}>{goalPaletteLabel(accent)}</span>
        </div>
      </div>
    </div>
  );
}

function GoalsView({ state, onNew, onEdit, onDeleteGoal, onToggleMilestone }) {
  const goals = state.goals || [];
  const activeGoals = goals.filter((g) => !isGoalComplete(g));
  const completedGoals = goals.filter((g) => isGoalComplete(g));
  const stats = useMemo(() => {
    const list = state.goals || [];
    const complete = list.filter(isGoalComplete).length;
    const active = list.filter((g) => !isGoalComplete(g)).length;
    const inProgress = list.filter((g) => !isGoalComplete(g) && computeGoalProgress(g) > 0).length;
    const withM = list.filter((g) => (g.milestones || []).length > 0);
    const avg = withM.length
      ? Math.round(withM.reduce((a, g) => a + computeGoalProgress(g), 0) / withM.length)
      : 0;
    return { active, inProgress, complete, avg };
  }, [state.goals]);

  return (
    <div style={{
      maxWidth: 1100,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 22,
      width: '100%',
      minWidth: 0,
      boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5 }}>Minhas Metas</div>
          <div style={{ fontSize: 14, color: stepzTokens.textDim, marginTop: 4 }}>Transforme seus sonhos em realidade</div>
        </div>
        <button
          type="button"
          onClick={onNew}
          style={{
            padding: '10px 18px',
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            fontFamily: stepzTokens.font,
            fontWeight: 600,
            fontSize: 14,
            background: stepzAccentBg(),
            color: '#0a0a0b',
          }}
        >+ Nova Meta</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        <GoalMetricTile
          label="Metas ativas"
          value={stats.active}
          accent={stepzTokens.accent}
          icon={(
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="4" />
            </svg>
          )}
        />
        <GoalMetricTile
          label="Em progresso"
          value={stats.inProgress}
          accent={stepzTokens.warn}
          icon={(
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 17l6-6 4 4 8-8" />
              <path d="M14 7h7v7" />
            </svg>
          )}
        />
        <GoalMetricTile
          label="Completas"
          value={stats.complete}
          accent={stepzTokens.success}
          icon={(
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 12l5 5 11-11" />
            </svg>
          )}
        />
        <GoalMetricTile
          label="Progresso médio"
          value={`${stats.avg}%`}
          accent={stepzTokens.accent}
          icon={(
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19h16" />
              <path d="M7 15l3-3 3 2 5-6" />
            </svg>
          )}
        />
      </div>
      {goals.length === 0 ? (
        <Panel2 title="Suas metas">
          <Empty msg="Ainda não há metas. Clique em «+ Nova Meta» para começar." />
        </Panel2>
      ) : (
        <>
          <Panel2 title={`Em atividade · ${activeGoals.length}`}>
            {activeGoals.length === 0 ? (
              <Empty msg="Nenhuma meta em curso. Todas estão concluídas — ver secção abaixo." small />
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
                gap: 18,
              }}>
                {activeGoals.map((g) => (
                  <GoalCard
                    key={g.id}
                    goal={g}
                    categories={state.categories}
                    onEdit={onEdit}
                    onDelete={onDeleteGoal}
                    onToggleMilestone={onToggleMilestone}
                  />
                ))}
              </div>
            )}
          </Panel2>
          {completedGoals.length > 0 ? (
            <Panel2 title={`Concluídas · ${completedGoals.length}`}>
              <div style={{ fontSize: 11, color: stepzTokens.textFaint, marginBottom: 14, lineHeight: 1.45 }}>
                Metas com todos os marcos feitos. Continuam aqui para consulta; cada conclusão também gerou um degrau especial na escada.
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
                gap: 18,
              }}>
                {completedGoals.map((g) => (
                  <GoalCard
                    key={g.id}
                    goal={g}
                    categories={state.categories}
                    onEdit={onEdit}
                    onDelete={onDeleteGoal}
                    onToggleMilestone={onToggleMilestone}
                  />
                ))}
              </div>
            </Panel2>
          ) : null}
        </>
      )}
    </div>
  );
}

/** Mesmo formato do picker de cores das tags: quadradinho, lista com nome + ✓, «Outra» + confirmar. */
function GoalPaletteColorPicker({ color, onChange }) {
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const ignoreOutsideUntilRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ left: 0, top: 0 });
  const [customDraft, setCustomDraft] = useState(() => taskTagColorPickerValue(String(color || '').trim()));

  const cur = String(color || '').trim();

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const pad = 8;
    const menuW = 188;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 400;
    const left = Math.max(pad, Math.min(r.left, vw - menuW - pad));
    setMenuPos({ left, top: r.bottom + 6 });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setCustomDraft(taskTagColorPickerValue(cur));
    ignoreOutsideUntilRef.current = 0;
  }, [open, cur]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (Date.now() < ignoreOutsideUntilRef.current) return;
      const t = e.target;
      if (menuRef.current?.contains(t)) return;
      if (btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const bumpIgnoreOutside = () => {
    ignoreOutsideUntilRef.current = Date.now() + 5000;
  };

  return (
    <>
      <button
        type="button"
        ref={btnRef}
        title="Cor da meta"
        aria-label="Escolher cor da meta"
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          background: cur || TASK_TAG_COLOR_OPTIONS[0].color,
          border: '1px solid rgba(255,255,255,0.28)',
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)',
          cursor: 'pointer',
          padding: 0,
          flexShrink: 0,
        }}
      />
      {open ? (
        <div
          ref={menuRef}
          role="menu"
          data-goal-color-popover
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: menuPos.left,
            top: menuPos.top,
            zIndex: 200,
            width: 188,
            padding: '8px 6px',
            background: stepzTokens.panel,
            border: `1px solid ${stepzTokens.borderStrong}`,
            borderRadius: 8,
            boxShadow: '0 12px 36px rgba(0,0,0,0.5)',
            fontFamily: stepzTokens.font,
          }}
        >
          <div style={{ fontSize: 9, color: stepzTokens.textFaint, textTransform: 'uppercase', letterSpacing: 0.4, padding: '2px 8px 6px' }}>
            Cores
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 'min(280px, 55vh)', overflowY: 'auto' }}>
            {TASK_TAG_COLOR_OPTIONS.map((opt) => {
              const sel = cur.toLowerCase() === String(opt.color).toLowerCase();
              return (
                <button
                  key={opt.label}
                  type="button"
                  role="menuitem"
                  title={opt.label}
                  onClick={() => {
                    onChange(opt.color);
                    setOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: 'none',
                    background: sel ? stepzTokens.accentSoft : 'transparent',
                    cursor: 'pointer',
                    fontFamily: stepzTokens.font,
                    textAlign: 'left',
                  }}
                >
                  <span style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    flexShrink: 0,
                    background: opt.color,
                    border: '1px solid rgba(255,255,255,0.18)',
                    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.15)',
                  }} aria-hidden />
                  <span style={{
                    fontSize: 12,
                    color: stepzTokens.text,
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>{opt.label}</span>
                  {sel ? (
                    <span style={{ fontSize: 11, color: stepzTokens.text, flexShrink: 0 }}>✓</span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${stepzTokens.border}` }}>
            <div style={{ fontSize: 9, color: stepzTokens.textFaint, textTransform: 'uppercase', letterSpacing: 0.35, marginBottom: 6 }}>
              Outra
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="color"
                value={customDraft}
                onChange={(e) => {
                  setCustomDraft(e.target.value);
                  bumpIgnoreOutside();
                }}
                onPointerDown={bumpIgnoreOutside}
                onClick={bumpIgnoreOutside}
                aria-label="Escolher cor personalizada"
                style={{
                  width: 32,
                  height: 26,
                  padding: 0,
                  border: `1px solid ${stepzTokens.borderStrong}`,
                  borderRadius: 5,
                  cursor: 'pointer',
                  background: 'transparent',
                }}
              />
              <button
                type="button"
                onClick={() => {
                  onChange(customDraft);
                  setOpen(false);
                }}
                style={{
                  flex: '1 1 100px',
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: `1px solid ${stepzTokens.borderStrong}`,
                  background: stepzTokens.accentSoft,
                  color: stepzTokens.text,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: stepzTokens.font,
                }}
              >
                Salvar cor
              </button>
            </div>
            <div style={{ fontSize: 9, color: stepzTokens.textFaint, marginTop: 6, lineHeight: 1.35 }}>
              O diálogo do sistema fica fora deste menu — use «Salvar cor» depois de escolher.
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function GoalModal({ goal, categories, onClose, onSave, onDelete }) {
  const isEdit = !!goal?.id;
  const [title, setTitle] = useState(goal?.title || '');
  const [description, setDescription] = useState(goal?.description || '');
  const [targetDate, setTargetDate] = useState(goal?.targetDate || todayStr());
  const [goalColor, setGoalColor] = useState(() => initialGoalModalColor(goal, categories));
  const [milestoneItems, setMilestoneItems] = useState(() => {
    const raw = goal ? goalToMilestoneText(goal) : '';
    const lines = String(raw || '').split(/\n+/).map((l) => l.trim()).filter(Boolean);
    return lines.length
      ? lines.map((t) => ({ id: cryptoId(), title: t }))
      : [{ id: cryptoId(), title: '' }, { id: cryptoId(), title: '' }];
  });

  useEffect(() => {
    setTitle(goal?.title || '');
    setDescription(goal?.description || '');
    setTargetDate(goal?.targetDate || todayStr());
    setGoalColor(initialGoalModalColor(goal, categories));
    const raw = goal ? goalToMilestoneText(goal) : '';
    const lines = String(raw || '').split(/\n+/).map((l) => l.trim()).filter(Boolean);
    setMilestoneItems(lines.length
      ? lines.map((t) => ({ id: cryptoId(), title: t }))
      : [{ id: cryptoId(), title: '' }, { id: cryptoId(), title: '' }]);
  }, [goal]);

  const daysToTarget = useMemo(() => {
    if (!targetDate) return null;
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const d = new Date(`${targetDate}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return null;
    const diffDays = Math.ceil((d.getTime() - start.getTime()) / 86400000);
    return diffDays;
  }, [targetDate]);

  const submit = () => {
    if (!title.trim()) return;
    const milestoneText = milestoneItems
      .map((x) => String(x.title || '').trim())
      .filter(Boolean)
      .join('\n');
    onSave({
      title: title.trim(),
      description: description.trim(),
      targetDate,
      milestoneText,
      color: goalColor,
    });
  };

  const updateMilestoneTitle = (id, nextTitle) => {
    setMilestoneItems((prev) => prev.map((x) => (x.id === id ? { ...x, title: nextTitle } : x)));
  };
  const addMilestoneRow = () => {
    setMilestoneItems((prev) => [...prev, { id: cryptoId(), title: '' }]);
  };
  const removeMilestoneRow = (id) => {
    setMilestoneItems((prev) => {
      const next = prev.filter((x) => x.id !== id);
      return next.length ? next : [{ id: cryptoId(), title: '' }, { id: cryptoId(), title: '' }];
    });
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 130,
      backdropFilter: 'blur(5px)',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 520, maxWidth: 'calc(100vw - 28px)',
        maxHeight: 'min(90vh, 720px)',
        overflow: 'auto',
        background: stepzTokens.panel,
        border: `1px solid ${stepzTokens.borderStrong}`,
        borderRadius: 14,
        padding: '22px 22px 18px',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: stepzTokens.accent, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>
              {isEdit ? 'Editar meta' : 'Nova meta'}
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: -0.4 }}>
              {isEdit ? 'Editar meta' : 'Definir meta'}
            </div>
          </div>
          <GoalPaletteColorPicker color={goalColor} onChange={setGoalColor} />
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título da meta"
            style={modalInputStyle}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição (opcional)"
            style={{ ...modalInputStyle, minHeight: 72, resize: 'vertical', fontSize: 13 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              style={{ ...modalInputStyle, width: 220 }}
            />
            <div style={{ fontSize: 12, color: stepzTokens.textDim, marginTop: 1 }}>
              {daysToTarget == null ? '—' : (daysToTarget < 0
                ? `${Math.abs(daysToTarget)} dias atrasado`
                : daysToTarget === 0 ? 'é hoje' : `faltam ${daysToTarget} dias`)}
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: stepzTokens.textDim }}>Marcos</div>
              <button
                type="button"
                onClick={addMilestoneRow}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: `1px solid ${stepzTokens.border}`,
                  background: 'rgba(255,255,255,0.04)',
                  color: stepzTokens.text,
                  cursor: 'pointer',
                  fontFamily: stepzTokens.font,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >+ adicionar</button>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {milestoneItems.map((it, idx) => (
                <div key={it.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 999,
                    border: `2px solid ${stepzTokens.borderStrong}`,
                    background: 'transparent',
                    flexShrink: 0,
                  }} />
                  <input
                    value={it.title}
                    onChange={(e) => updateMilestoneTitle(it.id, e.target.value)}
                    placeholder={idx === 0 ? 'Ler 150 páginas' : idx === 1 ? 'Correr 5km' : 'Novo marco'}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addMilestoneRow();
                      }
                    }}
                    style={{ ...modalInputStyle, padding: '10px 12px', fontSize: 13 }}
                  />
                  <button
                    type="button"
                    title="Remover marco"
                    onClick={() => removeMilestoneRow(it.id)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      border: `1px solid ${stepzTokens.border}`,
                      background: 'transparent',
                      color: stepzTokens.textDim,
                      cursor: 'pointer',
                      fontFamily: stepzTokens.font,
                      fontSize: 14,
                      flexShrink: 0,
                    }}
                  >✕</button>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4, flexWrap: 'wrap' }}>
            {onDelete ? (
              <button
                type="button"
                onClick={() => { if (confirm('Apagar esta meta?')) onDelete(); }}
                style={{
                  marginRight: 'auto',
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: `1px solid ${stepzTokens.border}`,
                  background: 'transparent',
                  color: stepzTokens.textDim,
                  cursor: 'pointer',
                  fontFamily: stepzTokens.font,
                  fontSize: 13,
                }}
              >Apagar</button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                border: `1px solid ${stepzTokens.border}`,
                background: 'transparent',
                color: stepzTokens.text,
                cursor: 'pointer',
                fontFamily: stepzTokens.font,
                fontSize: 13,
              }}
            >Cancelar</button>
            <button
              type="button"
              onClick={submit}
              style={{
                padding: '10px 18px',
                borderRadius: 8,
                border: 'none',
                background: stepzAccentBg(),
                color: '#0a0a0b',
                cursor: 'pointer',
                fontFamily: stepzTokens.font,
                fontWeight: 600,
                fontSize: 13,
              }}
            >Guardar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function JourneyView({ state, totalSteps, currentLevel, onStepClick, taskTagColors = {} }) {
  const { isMobile } = useStepzViewport();
  const grouped = useMemo(() => {
    const byDate = {};
    [...state.steps].reverse().forEach((s, ri) => {
      const d = s.completedAt.slice(0, 10);
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push({ ...s, idx: state.steps.length - 1 - ri });
    });
    return Object.entries(byDate);
  }, [state.steps]);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18, width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
          <LiveStairs
            steps={state.steps}
            tasks={state.tasks}
            habits={state.habits}
            categories={state.categories}
            taskTagColors={taskTagColors}
            projectColors={state.projectColors}
            onStepClick={onStepClick}
            layoutCompact={isMobile}
          />
      <Panel2 title={`${totalSteps} ${totalSteps === 1 ? 'degrau' : 'degraus'} · Nível ${currentLevel}`}>
        {grouped.length === 0 ? <Empty msg="Sua jornada começa quando você completa a primeira task." /> :
          grouped.map(([date, steps]) => (
            <div key={date} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, color: stepzTokens.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                {formatDate(date)}
              </div>
              {steps.map(st => (
                <div key={st.idx} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                  background: stepzTokens.panel2, borderRadius: 8, marginBottom: 6,
                }}>
                  <div style={{ width: 4, height: 28, background: stepzTokens.accent, borderRadius: 2 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: stepzTokens.text }}>{st.title}</div>
                    <div style={{ fontSize: 11, color: stepzTokens.textFaint }}>
                      {new Date(st.completedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: stepzTokens.textFaint, fontFamily: stepzTokens.fontMono }}>#{st.idx + 1}</div>
                </div>
              ))}
            </div>
          ))
        }
      </Panel2>
    </div>
  );
}

// ── Reusable bits ──
function Tile({ label, value, accent }) {
  const { isMobile } = useStepzViewport();
  return (
    <div style={{
      background: stepzTokens.panel, border: `1px solid ${stepzTokens.border}`,
      borderRadius: 12, padding: isMobile ? '10px 12px' : '14px 16px',
      minWidth: 0,
    }}>
      <div style={{ fontSize: isMobile ? 10 : 11, color: stepzTokens.textDim, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>{label}</div>
      <div style={{
        fontSize: isMobile ? 20 : 26,
        fontWeight: 600,
        letterSpacing: -0.8,
        color: accent || stepzTokens.text,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.1,
      }}>
        {value}
      </div>
    </div>
  );
}

function Panel2({ title, action, children }) {
  const { isMobile } = useStepzViewport();
  return (
    <div style={{
      background: stepzTokens.panel, border: `1px solid ${stepzTokens.border}`,
      borderRadius: isMobile ? 12 : 14, padding: isMobile ? '14px 14px' : '18px 22px',
      minWidth: 0,
    }}>
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
        gap: isMobile ? 10 : 12,
        flexWrap: 'nowrap',
        minWidth: 0,
      }}>
        <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 600, letterSpacing: -0.2, minWidth: 0 }}>{title}</div>
        {action ? (
          <div style={{ flexShrink: 0, alignSelf: isMobile ? 'flex-end' : 'center' }}>{action}</div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/** Ícones da coleção de patamares (ref: grid estilo “álbum de figurinhas”). */
const PATAMAR_COLLECTION_ICONS = ['🌅', '🥁', '🌊', '🌳', '🔨', '🧬', '⛰️', '☯️'];

function PatamarCollectionGrid({ totalSteps }) {
  const currentLevel = Math.floor(totalSteps / STEPS_PER_LEVEL) + 1;
  const { isMobile } = useStepzViewport();

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
      gap: isMobile ? 6 : 8,
    }}>
      {LEVEL_META.slice(0, 8).map((l, i) => {
        const lvl = i + 1;
        const done = lvl < currentLevel;
        const active = lvl === currentLevel;
        const locked = lvl > currentLevel;
        const stepsInLevel = active ? totalSteps % STEPS_PER_LEVEL : 0;
        const progress = STEPS_PER_LEVEL > 0 ? stepsInLevel / STEPS_PER_LEVEL : 0;

        let bg;
        let borderStyle;
        let boxShadow;
        if (locked) {
          bg = 'linear-gradient(155deg, #2a2a2f 0%, #18181c 100%)';
          borderStyle = `1px solid ${stepzTokens.border}`;
          boxShadow = 'none';
        } else if (done) {
          bg = 'linear-gradient(155deg, oklch(0.48 0.12 55) 0%, oklch(0.30 0.07 48) 55%, oklch(0.22 0.05 40) 100%)';
          borderStyle = '1px solid rgba(251, 191, 36, 0.55)';
          boxShadow = '0 0 0 1px rgba(251, 191, 36, 0.12), 0 6px 16px rgba(251, 191, 36, 0.14)';
        } else {
          bg = 'linear-gradient(155deg, oklch(0.38 0.14 295) 0%, oklch(0.26 0.11 285) 55%, oklch(0.20 0.08 280) 100%)';
          borderStyle = '1px solid rgba(167, 139, 250, 0.55)';
          boxShadow = '0 0 0 1px rgba(124, 92, 255, 0.18), 0 6px 18px rgba(124, 92, 255, 0.18)';
        }

        return (
          <div
            key={l.n}
            title={locked ? 'Complete o patamar anterior' : l.name}
            style={{
              aspectRatio: '1',
              borderRadius: isMobile ? 8 : 12,
              background: bg,
              border: borderStyle,
              boxShadow,
              padding: isMobile ? '5px 4px 4px' : '8px 6px 6px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              textAlign: 'center',
              minHeight: 0,
              opacity: locked ? 0.72 : 1,
              filter: locked ? 'grayscale(1)' : 'none',
            }}
          >
            <div style={{
              fontSize: isMobile ? 'clamp(11px, 3.4vw, 14px)' : 'clamp(16px, 4.2vw, 22px)',
              lineHeight: 1,
              marginTop: 1,
              filter: locked ? 'grayscale(1) brightness(0.85)' : 'none',
            }}>
              {PATAMAR_COLLECTION_ICONS[i]}
            </div>
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: isMobile ? 1 : 3,
              width: '100%',
              minHeight: 0,
            }}>
              <div style={{
                fontSize: isMobile ? 8 : 10,
                fontWeight: 700,
                color: locked ? 'rgba(242,239,233,0.42)' : '#f2efe9',
                lineHeight: 1.15,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
              }}>
                {l.name}
              </div>
              <div style={{
                fontSize: isMobile ? 7 : 9,
                fontWeight: 500,
                letterSpacing: 0.02,
                color: locked
                  ? 'rgba(242,239,233,0.38)'
                  : done
                    ? 'rgba(254, 243, 199, 0.92)'
                    : 'rgba(237, 233, 254, 0.88)',
              }}>
                {locked ? 'trancado' : done ? '100%' : `${stepsInLevel}/${STEPS_PER_LEVEL}`}
              </div>
            </div>
            {active ? (
              <div style={{
                width: '100%',
                height: isMobile ? 3 : 4,
                borderRadius: 3,
                background: 'rgba(0,0,0,0.35)',
                overflow: 'hidden',
                flexShrink: 0,
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, progress * 100)}%`,
                  borderRadius: 3,
                  background: stepzTokens.accentGradient || stepzTokens.accent,
                  transition: 'width 0.25s ease',
                }} />
              </div>
            ) : (
              <div style={{ height: isMobile ? 3 : 4, flexShrink: 0 }} aria-hidden />
            )}
          </div>
        );
      })}
    </div>
  );
}

const TASK_GRID_STORAGE_KEY = 'stepz.taskGridCols.v1';
const TASK_GRID_WIDTH_DEFAULTS = {
  title: 200,
  status: 112,
  due: 128,
  priority: 88,
  tags: 108,
  description: 160,
};
const TASK_GRID_COL_MIN = 52;
const TASK_GRID_COL_MAX = 560;

function clampTaskGridCol(n) {
  return Math.min(TASK_GRID_COL_MAX, Math.max(TASK_GRID_COL_MIN, Math.round(n)));
}

function loadTaskGridWidths() {
  try {
    const raw = localStorage.getItem(TASK_GRID_STORAGE_KEY);
    if (!raw) return { ...TASK_GRID_WIDTH_DEFAULTS };
    const p = JSON.parse(raw);
    const out = { ...TASK_GRID_WIDTH_DEFAULTS };
    Object.keys(TASK_GRID_WIDTH_DEFAULTS).forEach((k) => {
      if (typeof p[k] === 'number' && Number.isFinite(p[k])) out[k] = clampTaskGridCol(p[k]);
    });
    return out;
  } catch {
    return { ...TASK_GRID_WIDTH_DEFAULTS };
  }
}

function saveTaskGridWidths(w) {
  try {
    localStorage.setItem(TASK_GRID_STORAGE_KEY, JSON.stringify(w));
  } catch (_) { /* ignore */ }
}

function buildTaskGridTemplate(w) {
  return `22px ${w.title}px ${w.status}px ${w.due}px ${w.priority}px ${w.tags}px minmax(${w.description}px, 1fr) 26px`;
}

const TaskGridColumnsContext = createContext(null);

function TaskGridColumnsProvider({ children }) {
  const [widths, setWidths] = useState(loadTaskGridWidths);
  const widthsRef = useRef(widths);
  widthsRef.current = widths;

  useEffect(() => { saveTaskGridWidths(widths); }, [widths]);

  const gridTemplateColumns = useMemo(() => buildTaskGridTemplate(widths), [widths]);

  const beginResize = useCallback((boundaryIndex, e) => {
    e.preventDefault();
    const keys = ['title', 'status', 'due', 'priority', 'tags', 'description'];
    const leftKey = keys[boundaryIndex];
    const rightKey = keys[boundaryIndex + 1];
    if (!leftKey || !rightKey) return;
    const startX = e.clientX;
    const startWidths = { ...widthsRef.current };

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      let lw = startWidths[leftKey] + dx;
      let rw = startWidths[rightKey] - dx;
      if (lw < TASK_GRID_COL_MIN) {
        rw -= (TASK_GRID_COL_MIN - lw);
        lw = TASK_GRID_COL_MIN;
      }
      if (rw < TASK_GRID_COL_MIN) {
        lw -= (TASK_GRID_COL_MIN - rw);
        rw = TASK_GRID_COL_MIN;
      }
      lw = clampTaskGridCol(lw);
      rw = clampTaskGridCol(rw);
      setWidths((prev) => ({ ...prev, [leftKey]: lw, [rightKey]: rw }));
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const value = useMemo(() => ({ gridTemplateColumns, beginResize }), [gridTemplateColumns, beginResize]);

  return (
    <TaskGridColumnsContext.Provider value={value}>
      {children}
    </TaskGridColumnsContext.Provider>
  );
}

function TaskTableHeaderRow() {
  const ctx = useContext(TaskGridColumnsContext);
  const { isMobile } = useStepzViewport();
  const gridTemplateColumns = ctx?.gridTemplateColumns ?? buildTaskGridTemplate(TASK_GRID_WIDTH_DEFAULTS);
  const beginResize = ctx?.beginResize;

  const th = {
    fontSize: 9,
    color: stepzTokens.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.45,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    minWidth: 0,
  };

  const HeadCell = ({ children, boundary }) => (
    <div style={{ ...th, position: 'relative', minWidth: 0 }}>
      {children}
      {boundary != null && beginResize && (
        <div
          role="separator"
          aria-orientation="vertical"
          title="Arrastar para redimensionar"
          onMouseDown={(ev) => beginResize(boundary, ev)}
          style={{
            position: 'absolute',
            right: -5,
            top: -3,
            bottom: -3,
            width: 10,
            cursor: 'col-resize',
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{
            width: 2,
            height: '68%',
            borderRadius: 999,
            background: `linear-gradient(180deg, transparent 0%, ${stepzTokens.borderStrong} 18%, ${stepzTokens.borderStrong} 82%, transparent 100%)`,
            boxShadow: '0 0 0 1px rgba(0,0,0,0.15)',
            pointerEvents: 'none',
          }} />
        </div>
      )}
    </div>
  );

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns,
      gap: isMobile ? '0 8px' : '0 10px',
      alignItems: 'center',
      padding: isMobile ? '3px 8px 6px' : '4px 10px 8px',
      borderBottom: `1px solid ${stepzTokens.border}`,
      marginBottom: 2,
    }}>
      <span style={th} />
      <HeadCell boundary={0}>Tarefa</HeadCell>
      <HeadCell boundary={1}>Status</HeadCell>
      <HeadCell boundary={2}>Prazo</HeadCell>
      <HeadCell boundary={3}>Prior.</HeadCell>
      <HeadCell boundary={4}>Tags</HeadCell>
      <HeadCell>Descrição</HeadCell>
      <span style={th} />
    </div>
  );
}

function TaskTagsPopover({
  anchor,
  taskTags,
  allKnownTags,
  tagColors,
  onClose,
  onSave,
  onSetTagColor,
}) {
  const panelRef = useRef(null);
  const colorMenuRef = useRef(null);
  const [draft, setDraft] = useState(() => [...(taskTags || [])]);
  const [input, setInput] = useState('');
  const [colorPickerTag, setColorPickerTag] = useState(null);
  const [colorPickerPos, setColorPickerPos] = useState(null);
  const taskSig = (taskTags || []).join('|');

  useEffect(() => {
    setDraft([...(taskTags || [])]);
    setInput('');
    setColorPickerTag(null);
    setColorPickerPos(null);
  }, [anchor.left, anchor.top, taskSig]);

  useEffect(() => {
    const onDoc = (e) => {
      if (typeof e.target.closest === 'function' && e.target.closest('[data-tag-color-popover]')) return;
      if (!panelRef.current || panelRef.current.contains(e.target)) return;
      if (typeof e.target.closest === 'function' && e.target.closest('[data-tags-trigger]')) return;
      if (typeof e.target.closest === 'function' && e.target.closest('[data-priority-trigger]')) return;
      if (typeof e.target.closest === 'function' && e.target.closest('[data-status-trigger]')) return;
      onClose();
    };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (colorPickerTag) {
        setColorPickerTag(null);
        setColorPickerPos(null);
      } else {
        onClose();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, colorPickerTag]);

  useEffect(() => {
    if (!colorPickerTag) return;
    /** Captura: o painel de tags faz stopPropagation em mousedown; sem capture o document não recebe cliques lá dentro. */
    const closePick = (e) => {
      if (colorMenuRef.current?.contains(e.target)) return;
      if (typeof e.target.closest === 'function' && e.target.closest('[data-tag-color-trigger]')) return;
      setColorPickerTag(null);
      setColorPickerPos(null);
    };
    document.addEventListener('mousedown', closePick, true);
    return () => document.removeEventListener('mousedown', closePick, true);
  }, [colorPickerTag]);

  const libraryTags = useMemo(() => {
    const s = new Set([...(allKnownTags || []), ...draft]);
    return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [allKnownTags, draft]);

  const addFromInput = () => {
    const t = input.trim();
    if (!t || draft.includes(t) || draft.length >= 6) return;
    setDraft([...draft, t]);
    setInput('');
  };

  const toggleLibraryTag = (t) => {
    if (draft.includes(t)) setDraft(draft.filter((x) => x !== t));
    else if (draft.length < 6) setDraft([...draft, t]);
  };

  const save = () => {
    onSave(draft);
    onClose();
  };

  const vw = typeof window !== 'undefined' ? window.innerWidth : 400;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 700;
  const panelW = 260;
  let left = anchor.left;
  let top = anchor.top;
  if (left + panelW > vw - 8) left = Math.max(8, vw - panelW - 8);
  if (left < 8) left = 8;
  if (top + 360 > vh) top = Math.max(8, anchor.top - 280);

  const openTagColorMenu = (tag, ev) => {
    ev.stopPropagation();
    ev.preventDefault();
    if (colorPickerTag === tag) {
      setColorPickerTag(null);
      setColorPickerPos(null);
      return;
    }
    const r = ev.currentTarget.getBoundingClientRect();
    const mw = 132;
    const mh = 128;
    let pl = r.right - mw;
    let pt = r.bottom + 4;
    if (pl < 8) pl = 8;
    if (pl + mw > vw - 8) pl = vw - mw - 8;
    if (pt + mh > vh - 8) pt = Math.max(8, r.top - mh - 4);
    setColorPickerTag(tag);
    setColorPickerPos({ left: pl, top: pt });
  };

  const panel = (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Editar tags"
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        left,
        top,
        zIndex: 220,
        width: panelW,
        maxHeight: 'min(400px, 72vh)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: stepzTokens.panel,
        border: `1px solid ${stepzTokens.borderStrong}`,
        borderRadius: 10,
        boxShadow: '0 18px 52px rgba(0,0,0,0.55)',
        fontFamily: stepzTokens.font,
      }}
    >
      <div style={{ padding: '10px 12px 8px', borderBottom: `1px solid ${stepzTokens.border}`, flexShrink: 0 }}>
        <div style={{ fontSize: 9, color: stepzTokens.accent, textTransform: 'uppercase', letterSpacing: 0.45, marginBottom: 6 }}>Tags desta task</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, minHeight: 22, marginBottom: 6 }}>
          {draft.length === 0 ? (
            <span style={{ fontSize: 10, color: stepzTokens.textFaint }}>Nenhuma</span>
          ) : (
            draft.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setDraft(draft.filter((x) => x !== tag))}
                title="Remover desta task"
                style={{
                  fontSize: 9,
                  color: '#ffffff',
                  padding: '2px 7px',
                  borderRadius: 999,
                  background: colorForTaskTag(tag, tagColors),
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  maxWidth: 120,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {tag} ×
              </button>
            ))
          )}
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addFromInput();
              }
            }}
            placeholder="Nova tag"
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${stepzTokens.borderStrong}`,
              borderRadius: 7,
              color: stepzTokens.text,
              fontSize: 11,
              padding: '6px 8px',
              outline: 'none',
              fontFamily: stepzTokens.font,
            }}
          />
          <button type="button" onClick={addFromInput} style={{
            background: stepzAccentBg(),
            border: 'none',
            color: '#0a0a0b',
            fontSize: 10,
            fontWeight: 600,
            padding: '6px 10px',
            borderRadius: 7,
            cursor: 'pointer',
            fontFamily: stepzTokens.font,
          }}>+</button>
        </div>
      </div>

      <div style={{ padding: '8px 12px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <div style={{ fontSize: 9, color: stepzTokens.textFaint, marginBottom: 6 }}>Todas as tags</div>
        {libraryTags.length === 0 ? (
          <div style={{ fontSize: 10, color: stepzTokens.textFaint }}>Adicione acima.</div>
        ) : (
          libraryTags.map((tag) => {
            const selected = draft.includes(tag);
            const col = colorForTaskTag(tag, tagColors);
            return (
              <div
                key={tag}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 0',
                  borderBottom: `1px solid ${stepzTokens.border}`,
                }}
              >
                <span style={{
                  display: 'inline-block',
                  fontSize: 9,
                  color: '#ffffff',
                  padding: '2px 7px',
                  borderRadius: 999,
                  background: col,
                  fontWeight: 600,
                  maxWidth: 120,
                  width: 'fit-content',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  verticalAlign: 'middle',
                }} title={tag}>{tag}</span>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    title={selected ? 'Remover desta task' : 'Incluir nesta task'}
                    onClick={() => toggleLibraryTag(tag)}
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      padding: '3px 7px',
                      borderRadius: 999,
                      border: `1px solid ${stepzTokens.borderStrong}`,
                      background: selected ? stepzTokens.accentSoft : 'transparent',
                      color: selected ? stepzTokens.text : stepzTokens.textDim,
                      cursor: 'pointer',
                      fontFamily: stepzTokens.font,
                    }}
                  >
                    {selected ? '✓' : '+'}
                  </button>
                  <button
                    type="button"
                    data-tag-color-trigger
                    title="Cor da tag"
                    aria-label={`Escolher cor: ${tag}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => openTagColorMenu(tag, e)}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      background: col,
                      border: `1px solid rgba(255,255,255,0.22)`,
                      boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.15)',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      <div style={{
        padding: '8px 12px',
        borderTop: `1px solid ${stepzTokens.border}`,
        display: 'flex',
        gap: 6,
        justifyContent: 'flex-end',
        flexShrink: 0,
      }}>
        <button type="button" onClick={onClose} style={{
          background: 'transparent',
          border: `1px solid ${stepzTokens.borderStrong}`,
          color: stepzTokens.textDim,
          padding: '5px 11px',
          borderRadius: 7,
          cursor: 'pointer',
          fontFamily: stepzTokens.font,
          fontSize: 11,
        }}>cancelar</button>
        <button type="button" onClick={save} style={{
          background: stepzAccentBg(),
          border: 'none',
          color: '#0a0a0b',
          padding: '5px 11px',
          borderRadius: 7,
          cursor: 'pointer',
          fontFamily: stepzTokens.font,
          fontSize: 11,
          fontWeight: 600,
        }}>salvar</button>
      </div>
    </div>
  );

  const pickTag = colorPickerTag;
  const pickCol = pickTag ? colorForTaskTag(pickTag, tagColors) : '';
  const colorMenu = pickTag && colorPickerPos && (
    <div
      ref={colorMenuRef}
      data-tag-color-popover
      role="menu"
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        left: colorPickerPos.left,
        top: colorPickerPos.top,
        zIndex: 230,
        width: 188,
        padding: '8px 6px',
        background: stepzTokens.panel,
        border: `1px solid ${stepzTokens.borderStrong}`,
        borderRadius: 8,
        boxShadow: '0 12px 36px rgba(0,0,0,0.5)',
        fontFamily: stepzTokens.font,
      }}
    >
      <div style={{ fontSize: 9, color: stepzTokens.textFaint, textTransform: 'uppercase', letterSpacing: 0.4, padding: '2px 8px 6px' }}>
        Cores
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 'min(280px, 55vh)', overflowY: 'auto' }}>
        {TASK_TAG_COLOR_OPTIONS.map((opt) => {
          const sel = pickCol === opt.color;
          return (
            <button
              key={`pick-${pickTag}-${opt.label}`}
              type="button"
              title={opt.label}
              onClick={() => {
                onSetTagColor(pickTag, opt.color);
                setColorPickerTag(null);
                setColorPickerPos(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '6px 8px',
                borderRadius: 6,
                border: 'none',
                background: sel ? stepzTokens.accentSoft : 'transparent',
                cursor: 'pointer',
                fontFamily: stepzTokens.font,
                textAlign: 'left',
              }}
            >
              <span style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                flexShrink: 0,
                background: opt.color,
                border: '1px solid rgba(255,255,255,0.18)',
                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.15)',
              }} aria-hidden />
              <span style={{
                fontSize: 12,
                color: stepzTokens.text,
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>{opt.label}</span>
              {sel && (
                <span style={{ fontSize: 11, color: stepzTokens.text, flexShrink: 0 }}>✓</span>
              )}
            </button>
          );
        })}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer' }}>
        <span style={{ fontSize: 9, color: stepzTokens.textFaint, flexShrink: 0 }}>Outra</span>
        <input
          type="color"
          value={taskTagColorPickerValue(pickCol)}
          onChange={(e) => onSetTagColor(pickTag, e.target.value)}
          aria-label={`Cor personalizada: ${pickTag}`}
          style={{
            width: 28,
            height: 22,
            padding: 0,
            border: `1px solid ${stepzTokens.borderStrong}`,
            borderRadius: 5,
            cursor: 'pointer',
            background: 'transparent',
          }}
        />
      </label>
    </div>
  );

  if (typeof document === 'undefined') return null;
  const RD = typeof ReactDOM !== 'undefined' ? ReactDOM : window.ReactDOM;
  if (!RD || typeof RD.createPortal !== 'function') return null;
  return RD.createPortal(
    <>
      {panel}
      {colorMenu}
    </>,
    document.body,
  );
}

function TaskPriorityPopover({
  anchor,
  priorityId,
  onClose,
  onSave,
}) {
  const panelRef = useRef(null);
  const resolvedId = priorityId || TASK_PRIORITIES[1].id;

  useEffect(() => {
    const onDoc = (e) => {
      if (!panelRef.current || panelRef.current.contains(e.target)) return;
      if (typeof e.target.closest === 'function' && e.target.closest('[data-priority-trigger]')) return;
      if (typeof e.target.closest === 'function' && e.target.closest('[data-tags-trigger]')) return;
      if (typeof e.target.closest === 'function' && e.target.closest('[data-status-trigger]')) return;
      onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const vw = typeof window !== 'undefined' ? window.innerWidth : 400;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 700;
  const panelW = 248;
  let left = anchor.left;
  let top = anchor.top;
  if (left + panelW > vw - 8) left = Math.max(8, vw - panelW - 8);
  if (left < 8) left = 8;
  if (top + 280 > vh) top = Math.max(8, anchor.top - 240);

  const current = TASK_PRIORITIES.find((p) => p.id === resolvedId) || TASK_PRIORITIES[1];

  const panel = (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Prioridade"
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        left,
        top,
        zIndex: 220,
        width: panelW,
        maxHeight: 'min(320px, 70vh)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: stepzTokens.panel,
        border: `1px solid ${stepzTokens.borderStrong}`,
        borderRadius: 10,
        boxShadow: '0 18px 52px rgba(0,0,0,0.55)',
        fontFamily: stepzTokens.font,
      }}
    >
      <div style={{ padding: '10px 12px 8px', borderBottom: `1px solid ${stepzTokens.border}`, flexShrink: 0 }}>
        <div style={{ fontSize: 9, color: stepzTokens.accent, textTransform: 'uppercase', letterSpacing: 0.45, marginBottom: 6 }}>
          Prioridade desta task
        </div>
        <span style={{
          display: 'inline-block',
          fontSize: 9,
          color: '#ffffff',
          padding: '2px 7px',
          borderRadius: 999,
          background: current.color,
          fontWeight: 600,
          maxWidth: 140,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }} title={current.label}>{current.label}</span>
      </div>

      <div style={{ padding: '8px 12px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <div style={{ fontSize: 9, color: stepzTokens.textFaint, marginBottom: 6 }}>Todas as prioridades</div>
        {TASK_PRIORITIES.map((p) => {
          const sel = resolvedId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                if (p.id !== resolvedId) onSave(p.id);
                onClose();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                width: '100%',
                padding: '6px 0',
                borderBottom: `1px solid ${stepzTokens.border}`,
                background: 'transparent',
                border: 'none',
                borderRadius: 0,
                cursor: 'pointer',
                fontFamily: stepzTokens.font,
                textAlign: 'left',
              }}
            >
              <span style={{
                display: 'inline-block',
                fontSize: 9,
                color: '#ffffff',
                padding: '2px 7px',
                borderRadius: 999,
                background: p.color,
                fontWeight: 600,
                maxWidth: 120,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }} title={p.label}>{p.label}</span>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  width: 14,
                  textAlign: 'center',
                  color: stepzTokens.text,
                  opacity: sel ? 1 : 0,
                }}>✓</span>
                <span style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  background: p.color,
                  border: `1px solid rgba(255,255,255,0.22)`,
                  boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)',
                  flexShrink: 0,
                }} aria-hidden />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  const RD = typeof ReactDOM !== 'undefined' ? ReactDOM : window.ReactDOM;
  if (!RD || typeof RD.createPortal !== 'function') return null;
  return RD.createPortal(panel, document.body);
}

function TaskStatusPopover({
  anchor,
  statusId,
  onClose,
  onSave,
}) {
  const panelRef = useRef(null);
  const resolvedId = statusId || 'todo';

  useEffect(() => {
    const onDoc = (e) => {
      if (!panelRef.current || panelRef.current.contains(e.target)) return;
      if (typeof e.target.closest === 'function' && e.target.closest('[data-status-trigger]')) return;
      if (typeof e.target.closest === 'function' && e.target.closest('[data-tags-trigger]')) return;
      if (typeof e.target.closest === 'function' && e.target.closest('[data-priority-trigger]')) return;
      onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const vw = typeof window !== 'undefined' ? window.innerWidth : 400;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 700;
  const panelW = 268;
  let left = anchor.left;
  let top = anchor.top;
  if (left + panelW > vw - 8) left = Math.max(8, vw - panelW - 8);
  if (left < 8) left = 8;
  if (top + 300 > vh) top = Math.max(8, anchor.top - 260);

  const statusRowDot = (sid) => {
    const c = statusOptionColor(sid);
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 9,
        fontWeight: 600,
        padding: '2px 7px',
        borderRadius: 999,
        border: `1px solid ${statusOptionBorderSoft(c)}`,
        background: 'rgba(255,255,255,0.05)',
        color: c,
        maxWidth: 148,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        <span style={{ width: 5, height: 5, borderRadius: 3, background: c, flexShrink: 0 }} />
        {(TASK_STATUS.find((s) => s.id === sid) || TASK_STATUS[0]).label}
      </span>
    );
  };

  const panel = (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Status"
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        left,
        top,
        zIndex: 220,
        width: panelW,
        maxHeight: 'min(340px, 70vh)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: stepzTokens.panel,
        border: `1px solid ${stepzTokens.borderStrong}`,
        borderRadius: 10,
        boxShadow: '0 18px 52px rgba(0,0,0,0.55)',
        fontFamily: stepzTokens.font,
      }}
    >
      <div style={{ padding: '10px 12px 8px', borderBottom: `1px solid ${stepzTokens.border}`, flexShrink: 0 }}>
        <div style={{ fontSize: 9, color: stepzTokens.accent, textTransform: 'uppercase', letterSpacing: 0.45, marginBottom: 6 }}>
          Status desta task
        </div>
        {statusRowDot(resolvedId)}
      </div>

      <div style={{ padding: '8px 12px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <div style={{ fontSize: 9, color: stepzTokens.textFaint, marginBottom: 6 }}>Todos os status</div>
        {TASK_STATUS.map((s) => {
          const sel = resolvedId === s.id;
          const c = statusOptionColor(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                if (s.id !== resolvedId) onSave(s.id);
                onClose();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                width: '100%',
                padding: '6px 0',
                borderBottom: `1px solid ${stepzTokens.border}`,
                background: 'transparent',
                border: 'none',
                borderRadius: 0,
                cursor: 'pointer',
                fontFamily: stepzTokens.font,
                textAlign: 'left',
              }}
            >
              {statusRowDot(s.id)}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  width: 14,
                  textAlign: 'center',
                  color: stepzTokens.text,
                  opacity: sel ? 1 : 0,
                }}>✓</span>
                <span style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  background: c,
                  border: `1px solid rgba(255,255,255,0.22)`,
                  flexShrink: 0,
                }} aria-hidden />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  const RD = typeof ReactDOM !== 'undefined' ? ReactDOM : window.ReactDOM;
  if (!RD || typeof RD.createPortal !== 'function') return null;
  return RD.createPortal(panel, document.body);
}

function TaskAddButton({ onClick }) {
  return (
    <button onClick={onClick}
      style={{
        background: stepzAccentBg(), border: 'none', color: '#0a0a0b',
        fontSize: 12, fontWeight: 600, padding: '7px 12px', borderRadius: 7,
        cursor: 'pointer', fontFamily: stepzTokens.font,
      }}>+ nova task</button>
  );
}

function TaskTagsTriggerCell({ tagsList, taskTagColors, taskId, onTagsPopoverOpen }) {
  const wrapRef = useRef(null);
  const tagSig = tagsList.join('\u0001');
  const chipWidths = useMemo(() => tagsList.map((t) => measureTaskTagChipWidthPx(t)), [tagSig]);
  const [visible, setVisible] = useState(() => tagsList.length);

  const applyFit = useCallback(() => {
    const el = wrapRef.current;
    if (!el || tagsList.length === 0) return;
    const w = el.clientWidth;
    if (w <= 0) return;
    const n = countTaskTagsVisibleInWidth(chipWidths, tagsList.length, w);
    setVisible((prev) => (prev === n ? prev : n));
  }, [chipWidths, tagsList.length]);

  useLayoutEffect(() => {
    if (tagsList.length === 0) {
      setVisible(0);
      return;
    }
    applyFit();
  }, [tagsList.length, tagSig, applyFit]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => applyFit());
    ro.observe(el);
    return () => ro.disconnect();
  }, [applyFit]);

  const overflow = tagsList.length > visible ? tagsList.length - visible : 0;
  const tagsShown = tagsList.slice(0, visible);

  return (
    <div
      ref={wrapRef}
      data-tags-trigger
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (onTagsPopoverOpen) {
            const r = e.currentTarget.getBoundingClientRect();
            onTagsPopoverOpen({ left: r.left, top: r.bottom + 6 });
          }
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (!onTagsPopoverOpen) return;
        const r = e.currentTarget.getBoundingClientRect();
        onTagsPopoverOpen({ left: r.left, top: r.bottom + 6 });
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: TASK_TAG_CHIP_GAP,
        minWidth: 0,
        width: '100%',
        overflow: 'hidden',
        cursor: onTagsPopoverOpen ? 'pointer' : 'default',
      }}
    >
      {tagsList.length === 0 ? (
        <span style={{ fontSize: 10, color: stepzTokens.textFaint }}>+</span>
      ) : (
        <>
          {tagsShown.map((tag) => (
            <span key={`${taskId}-${tag}`} style={{
              fontSize: 9,
              color: '#ffffff',
              padding: '2px 6px',
              borderRadius: 4,
              background: colorForTaskTag(tag, taskTagColors),
              fontWeight: 600,
              flexShrink: 0,
              maxWidth: TASK_TAG_CHIP_MAX_W,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>{tag}</span>
          ))}
          {overflow > 0 && (
            <span style={{ fontSize: 9, color: stepzTokens.textFaint, flexShrink: 0 }} title={`${overflow} tag${overflow === 1 ? '' : 's'} oculta${overflow === 1 ? '' : 's'}`}>+{overflow}</span>
          )}
        </>
      )}
    </div>
  );
}

const TASK_DESC_MODAL_EXPAND_LS = 'stepz.taskDescModalExpanded.v1';

/** Modal para ver e editar a descrição completa da task (não fica limitado à coluna da tabela). */
function TaskDescriptionEditorModal({ taskTitle, value, onChange, onSave, onClose }) {
  const { isMobile } = useStepzViewport();
  const taRef = useRef(null);
  const [expanded, setExpanded] = useState(() => {
    if (typeof window === 'undefined' || isMobile) return false;
    try {
      return localStorage.getItem(TASK_DESC_MODAL_EXPAND_LS) === '1';
    } catch {
      return false;
    }
  });

  const toggleExpanded = () => {
    setExpanded((v) => {
      const next = !v;
      if (!isMobile) {
        try {
          localStorage.setItem(TASK_DESC_MODAL_EXPAND_LS, next ? '1' : '0');
        } catch (_) { /* ignore */ }
      }
      return next;
    });
  };

  useEffect(() => {
    const id = requestAnimationFrame(() => taRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onSave();
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, onSave]);

  const panel = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-desc-editor-title"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 140,
        background: 'rgba(0,0,0,0.62)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? '16px 14px' : '24px',
        boxSizing: 'border-box',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: isMobile ? '100%' : (expanded ? 'min(96vw, 1120px)' : 'min(92vw, 640px)'),
          height: isMobile
            ? (expanded ? 'min(92vh, 720px)' : undefined)
            : (expanded ? 'min(88vh, 820px)' : 'min(72vh, 520px)'),
          maxWidth: isMobile ? '100%' : '96vw',
          maxHeight: isMobile ? (expanded ? '92vh' : 'min(92vh, 720px)') : '92vh',
          minWidth: isMobile ? undefined : (expanded ? 480 : 380),
          minHeight: isMobile ? (expanded ? 'min(70vh, 480px)' : undefined) : (expanded ? 420 : 300),
          resize: isMobile ? 'none' : 'both',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: stepzTokens.panel,
          border: `1px solid ${stepzTokens.borderStrong}`,
          borderRadius: isMobile ? 12 : 14,
          padding: isMobile ? '16px 16px 14px' : '22px 22px 18px',
          boxSizing: 'border-box',
          boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: isMobile ? 12 : 14,
          minWidth: 0,
          flexShrink: 0,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              id="task-desc-editor-title"
              style={{
                fontSize: 11,
                color: stepzTokens.accent,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 6,
              }}
            >
              Descrição da task
            </div>
            {taskTitle ? (
              <div style={{
                fontSize: isMobile ? 14 : 16,
                fontWeight: 600,
                color: stepzTokens.text,
                lineHeight: 1.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }} title={taskTitle}>
                {taskTitle}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={toggleExpanded}
            title={expanded ? 'Janela menor' : 'Janela maior para ler mais texto'}
            style={{
              flexShrink: 0,
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${stepzTokens.border}`,
              color: stepzTokens.textDim,
              fontSize: 11,
              fontWeight: 600,
              padding: isMobile ? '8px 10px' : '7px 12px',
              borderRadius: 8,
              cursor: 'pointer',
              fontFamily: stepzTokens.font,
              whiteSpace: 'nowrap',
            }}
          >
            {expanded ? '⊟ Reduzir' : '⊞ Ampliar'}
          </button>
        </div>
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Escreva os detalhes desta task…"
          style={{
            ...modalInputStyle,
            width: '100%',
            boxSizing: 'border-box',
            flex: 1,
            minHeight: isMobile ? (expanded ? 'min(55vh, 420px)' : 160) : 120,
            minWidth: 0,
            resize: 'none',
            fontSize: isMobile ? 14 : 15,
            lineHeight: 1.55,
            marginBottom: isMobile ? 14 : 16,
            overflow: 'auto',
          }}
        />
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column-reverse' : 'row',
          gap: isMobile ? 8 : 10,
          justifyContent: 'flex-end',
          flexShrink: 0,
        }}>
          <button type="button" onClick={onClose} style={{
            ...modalGhostBtnStyle,
            width: isMobile ? '100%' : undefined,
            padding: isMobile ? '10px 14px' : undefined,
          }}>
            cancelar
          </button>
          <button type="button" onClick={onSave} style={{
            ...modalPrimaryBtnStyle,
            width: isMobile ? '100%' : undefined,
            padding: isMobile ? '10px 14px' : undefined,
          }}>
            salvar
          </button>
        </div>
        {!isMobile ? (
          <div style={{ marginTop: 10, fontSize: 10, color: stepzTokens.textFaint, textAlign: 'right', flexShrink: 0 }}>
            Arraste o canto da janela para redimensionar · Ctrl+Enter salvar · Esc fechar
          </div>
        ) : null}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  const RD = typeof ReactDOM !== 'undefined' ? ReactDOM : window.ReactDOM;
  if (!RD || typeof RD.createPortal !== 'function') return panel;
  return RD.createPortal(panel, document.body);
}

function TaskItem({ task, onComplete, onUncomplete, onDelete, onUpdateTask, onEditTask, taskTagColors = {}, onTagsPopoverOpen, onPriorityPopoverOpen, onStatusPopoverOpen, dragHandleProps, isDragging, setItemRef }) {
  const gridCtx = useContext(TaskGridColumnsContext);
  const { isMobile } = useStepzViewport();
  const [hovered, setHovered] = useState(false);
  const gridTemplateColumns = gridCtx?.gridTemplateColumns ?? buildTaskGridTemplate(TASK_GRID_WIDTH_DEFAULTS);
  const priority = TASK_PRIORITIES.find(p => p.id === task.priority) || TASK_PRIORITIES[1];
  const status = TASK_STATUS.find(s => s.id === normalizeTaskStatus(task.status, task.done)) || TASK_STATUS[0];
  const dueLabel = task.dueDate ? formatDate(task.dueDate) : '—';
  const normalizedStatusId = normalizeTaskStatus(task.status, task.done);
  const statusColor = statusOptionColor(normalizedStatusId);

  const [editingField, setEditingField] = useState(null);
  const [draftValue, setDraftValue] = useState('');
  const startEdit = (field, value) => {
    setEditingField(field);
    setDraftValue(value || '');
  };
  const cancelEdit = () => {
    setEditingField(null);
    setDraftValue('');
  };
  const saveEdit = () => {
    if (!editingField || !onUpdateTask) return;
    if (editingField === 'description') {
      onUpdateTask({ description: draftValue });
      cancelEdit();
    }
  };

  const inlineSelectStyle = {
    ...modalInputStyle,
    width: '100%',
    boxSizing: 'border-box',
    padding: '2px 6px',
    fontSize: 10,
    lineHeight: 1.2,
    minHeight: 24,
  };

  const tagsList = task.tags || [];

  const rowStyle = {
    display: 'grid',
    gridTemplateColumns,
    gap: isMobile ? '0 8px' : '0 10px',
    alignItems: 'center',
    padding: isMobile ? '6px 8px' : '7px 10px',
    borderBottom: dragHandleProps ? 'none' : `1px solid ${stepzTokens.border}`,
    flex: 1,
    minWidth: 0,
  };

  const wrapperStyle = dragHandleProps ? {
    display: 'flex',
    alignItems: 'stretch',
    borderBottom: `1px solid ${stepzTokens.border}`,
    opacity: isDragging ? 0.55 : 1,
    background: isDragging ? 'rgba(255,255,255,0.04)' : 'transparent',
    transform: isDragging ? 'scale(0.995)' : 'none',
    transformOrigin: 'left center',
    transition: 'opacity 120ms ease, background 120ms ease, transform 120ms ease',
  } : null;

  return (
    <div
      ref={setItemRef || undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={wrapperStyle || undefined}
    >
      {dragHandleProps ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          paddingLeft: isMobile ? 2 : 4,
          paddingRight: isMobile ? 2 : 0,
          flexShrink: 0,
        }}>
          <DragHandle {...dragHandleProps} isMobile={isMobile} dim={!hovered && !isDragging} isActive={isDragging} />
        </div>
      ) : null}
      <div style={rowStyle}>
        <button
          type="button"
          onClick={() => task.done ? onUncomplete && onUncomplete() : onComplete()}
          style={{
            width: isMobile ? 18 : 22, height: isMobile ? 18 : 22,
            borderRadius: isMobile ? 9 : 11,
            border: `1.5px solid ${task.done ? stepzTokens.success : 'rgba(255,255,255,0.25)'}`,
            background: task.done ? stepzTokens.success : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, cursor: 'pointer', padding: 0,
          }}>
          {task.done && <svg width={isMobile ? 10 : 12} height={isMobile ? 10 : 12} viewBox="0 0 12 12" fill="none" stroke="#0a0a0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l3 3 5-6" /></svg>}
        </button>

        <div
          onClick={onEditTask ? (e) => { e.stopPropagation(); onEditTask(); } : undefined}
          title={task.title}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            minWidth: 0,
            cursor: onEditTask ? 'pointer' : 'default',
          }}
        >
          <span
            style={{
              fontSize: isMobile ? 11 : 12,
              fontWeight: 600,
              letterSpacing: -0.2,
              color: task.done ? stepzTokens.textFaint : stepzTokens.text,
              textDecoration: task.done ? 'line-through' : 'none',
              textDecorationColor: 'rgba(232,232,234,0.25)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
              flexShrink: 1,
            }}
          >
            {task.title}
          </span>
          {isTaskRecurringMonthly(task) && (
            <span
              title="Repete mensalmente — reabre 7 dias antes do prazo"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: isMobile ? '1px 6px' : '2px 7px',
                borderRadius: 999,
                border: `1px solid ${stepzTokens.borderStrong}`,
                background: 'rgba(212,175,55,0.08)',
                color: stepzTokens.textDim,
                fontSize: isMobile ? 8 : 9,
                fontWeight: 600,
                letterSpacing: 0.2,
                flexShrink: 0,
                lineHeight: 1,
                whiteSpace: 'nowrap',
              }}
            >
              ↻ Mensal
            </span>
          )}
        </div>

        <div style={{ minWidth: 0 }} onClick={e => e.stopPropagation()}>
          <button
            type="button"
            data-status-trigger
            title="Alterar status"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (!onStatusPopoverOpen) return;
                const r = e.currentTarget.getBoundingClientRect();
                onStatusPopoverOpen({ left: r.left, top: r.bottom + 6 });
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (!onStatusPopoverOpen) return;
              const r = e.currentTarget.getBoundingClientRect();
              onStatusPopoverOpen({ left: r.left, top: r.bottom + 6 });
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              maxWidth: '100%',
              padding: isMobile ? '2px 8px' : '3px 9px',
              borderRadius: 999,
              border: `1px solid ${statusOptionBorderSoft(statusColor)}`,
              background: 'rgba(255,255,255,0.05)',
              color: statusColor,
              fontSize: isMobile ? 9 : 10,
              fontWeight: 600,
              cursor: onStatusPopoverOpen ? 'pointer' : 'default',
              fontFamily: stepzTokens.font,
              appearance: 'none',
              WebkitAppearance: 'none',
              boxShadow: 'none',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 3, background: statusColor, flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{status.label}</span>
          </button>
        </div>

        <div style={{ minWidth: 0 }} onClick={e => e.stopPropagation()}>
          {editingField === 'dueDate' ? (
            <input
              type="date"
              value={draftValue}
              autoFocus
              onChange={(e) => {
                const v = e.target.value;
                if (onUpdateTask) onUpdateTask({ dueDate: v });
                cancelEdit();
              }}
              style={{ ...inlineSelectStyle, color: stepzTokens.text }}
            />
          ) : (
            <button
              type="button"
              onClick={() => startEdit('dueDate', task.dueDate || todayStr())}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                fontSize: 10,
                color: stepzTokens.textDim,
                cursor: 'pointer',
                fontFamily: stepzTokens.font,
                textAlign: 'left',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '100%',
              }}
            >
              {dueLabel}
            </button>
          )}
        </div>

        <div style={{ minWidth: 0 }} onClick={e => e.stopPropagation()}>
          <button
            type="button"
            data-priority-trigger
            title="Alterar prioridade"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (!onPriorityPopoverOpen) return;
                const r = e.currentTarget.getBoundingClientRect();
                onPriorityPopoverOpen({ left: r.left, top: r.bottom + 6 });
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (!onPriorityPopoverOpen) return;
              const r = e.currentTarget.getBoundingClientRect();
              onPriorityPopoverOpen({ left: r.left, top: r.bottom + 6 });
            }}
            style={{
              display: 'inline-block',
              maxWidth: '100%',
              padding: '2px 8px',
              borderRadius: 4,
              border: 'none',
              background: priority.color,
              color: '#ffffff',
              fontSize: 10,
              fontWeight: 600,
              cursor: onPriorityPopoverOpen ? 'pointer' : 'default',
              fontFamily: stepzTokens.font,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {priority.label}
          </button>
        </div>

        <div style={{ minWidth: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
          <TaskTagsTriggerCell
            tagsList={tagsList}
            taskTagColors={taskTagColors}
            taskId={task.id}
            onTagsPopoverOpen={onTagsPopoverOpen}
          />
        </div>

        <div
          onClick={(e) => {
            e.stopPropagation();
            startEdit('description', task.description || '');
          }}
          title={task.description || 'Clique para ver e editar a descrição'}
          style={{
            fontSize: 10,
            color: task.description ? stepzTokens.textDim : stepzTokens.textFaint,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
            cursor: 'pointer',
          }}
        >
          {task.description || '—'}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          {onDelete && (
            <button type="button" onClick={onDelete} title="Apagar"
              style={{ background: 'transparent', border: 'none', color: stepzTokens.textFaint, cursor: 'pointer', fontSize: 16, padding: 2, opacity: 0.5 }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.5 }}>×</button>
          )}
        </div>
      </div>

      {editingField === 'description' ? (
        <TaskDescriptionEditorModal
          taskTitle={task.title}
          value={draftValue}
          onChange={setDraftValue}
          onSave={saveEdit}
          onClose={cancelEdit}
        />
      ) : null}
    </div>
  );
}

function ProjectColorDotButton({ accent, isMobile, onPick }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!wrapRef.current || wrapRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        title="Cor do projeto"
        aria-label="Cor do projeto"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: isMobile ? 30 : 28,
          height: isMobile ? 30 : 28,
          borderRadius: 8,
          border: `1px solid ${stepzTokens.borderStrong}`,
          background: stepzTokens.panel2,
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          touchAction: 'manipulation',
        }}
      >
        <span style={{
          width: isMobile ? 14 : 13,
          height: isMobile ? 14 : 13,
          borderRadius: 5,
          background: accent,
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.28)',
        }} />
      </button>
      {open ? (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 40,
            padding: 10,
            background: stepzTokens.panel,
            border: `1px solid ${stepzTokens.borderStrong}`,
            borderRadius: 12,
            boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
            minWidth: 200,
          }}
        >
          <div style={{
            fontSize: 10, fontWeight: 600, color: stepzTokens.textFaint,
            textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
          }}>Cor do projeto</div>
          <button
            type="button"
            onClick={() => { onPick(null); setOpen(false); }}
            style={{
              width: '100%',
              marginBottom: 10,
              padding: '8px 10px',
              borderRadius: 8,
              border: `1px dashed ${stepzTokens.border}`,
              background: 'transparent',
              color: stepzTokens.textDim,
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: stepzTokens.font,
            }}
          >
            Automático (paleta)
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {TASK_TAG_COLOR_OPTIONS.map((opt) => (
              <button
                key={opt.color}
                type="button"
                title={opt.label}
                aria-label={opt.label}
                onClick={() => { onPick(opt.color); setOpen(false); }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: String(accent || '').toLowerCase() === opt.color.toLowerCase()
                    ? `2px solid ${stepzTokens.highlight}`
                    : '1px solid rgba(0,0,0,0.35)',
                  background: opt.color,
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TaskProjectSection({ project, count, children, onRenameProject, showTaskTableHeader, projectDragHandleProps, projectItemRef, isProjectDragging, dropBefore, dropAfter, projectAccentColor, onSetProjectColor }) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(project);
  const [headerHover, setHeaderHover] = useState(false);
  const { isMobile } = useStepzViewport();
  useEffect(() => {
    if (!editing) setNewName(project);
  }, [project, editing]);
  const saveRename = () => {
    onRenameProject && onRenameProject(project, newName);
    setEditing(false);
  };
  return (
    <>
    <DropIndicator active={!!dropBefore} inset={isMobile ? 0 : 4} />
    <div
      ref={projectItemRef}
      onMouseEnter={() => setHeaderHover(true)}
      onMouseLeave={() => setHeaderHover(false)}
      style={{
        marginBottom: isMobile ? 10 : 12,
        background: stepzTokens.panel2,
        border: `1px solid ${stepzTokens.border}`,
        borderRadius: 10,
        padding: isMobile ? '8px 10px 0' : '10px 12px 0',
        opacity: isProjectDragging ? 0.55 : 1,
        transform: isProjectDragging ? 'scale(0.998)' : 'none',
        transformOrigin: 'left center',
        transition: 'opacity 120ms ease, transform 120ms ease',
      }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? 6 : 8,
        flexWrap: 'nowrap',
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${stepzTokens.border}`,
        borderRadius: 10,
        padding: isMobile ? '6px 10px' : '8px 12px',
        marginBottom: open ? 8 : 0,
      }}>
        {projectDragHandleProps ? (
          <DragHandle {...projectDragHandleProps} isMobile={isMobile} dim={!headerHover && !isProjectDragging} isActive={isProjectDragging} label="Arrastar para reordenar projeto" />
        ) : null}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          title={open ? 'Fechar projeto' : 'Abrir projeto'}
          style={{
            background: 'transparent',
            border: 'none',
            color: stepzTokens.textDim,
            cursor: 'pointer',
            fontSize: isMobile ? 12 : 13,
            padding: 0,
            flexShrink: 0,
            width: 18,
            lineHeight: 1,
          }}
        >
          {open ? '▾' : '▸'}
        </button>
        {!editing ? (
          <>
            <button
              type="button"
              onClick={() => { setEditing(true); setNewName(project); }}
              title="Clique para editar nome do projeto"
              style={{
                flex: 1,
                minWidth: 0,
                background: 'transparent',
                border: 'none',
                color: stepzTokens.text,
                fontSize: isMobile ? 12 : 13,
                fontWeight: 600,
                letterSpacing: -0.2,
                cursor: 'pointer',
                padding: 0,
                textAlign: 'left',
              }}
            >
              {project}
            </button>
            <span style={{
              fontFamily: stepzTokens.fontMono,
              fontSize: isMobile ? 10 : 11,
              color: stepzTokens.textFaint,
              flexShrink: 0,
            }}>
              {count}
            </span>
            {typeof onSetProjectColor === 'function' ? (
              <ProjectColorDotButton
                accent={projectAccentColor || stepzTokens.accent}
                isMobile={isMobile}
                onPick={onSetProjectColor}
              />
            ) : null}
          </>
        ) : (
          <>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') saveRename();
                if (e.key === 'Escape') { setEditing(false); setNewName(project); }
              }}
              autoFocus
              style={{
                ...modalInputStyle,
                flex: 1,
                minWidth: 120,
                height: 30,
                fontSize: 13,
                fontWeight: 600,
                padding: '6px 10px',
              }}
            />
            {onRenameProject && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={saveRename}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: stepzTokens.accent,
                    fontSize: 11,
                    cursor: 'pointer',
                    fontFamily: stepzTokens.font,
                    padding: '4px 6px',
                    fontWeight: 600,
                  }}
                >
                  salvar
                </button>
                <button
                  type="button"
                  onClick={() => { setEditing(false); setNewName(project); }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'oklch(0.72 0.14 25)',
                    fontSize: 11,
                    cursor: 'pointer',
                    fontFamily: stepzTokens.font,
                    padding: '4px 6px',
                  }}
                >
                  cancelar
                </button>
              </div>
            )}
            <span style={{
              fontFamily: stepzTokens.fontMono,
              fontSize: 11,
              color: stepzTokens.textFaint,
              flexShrink: 0,
            }}>
              {count}
            </span>
            {typeof onSetProjectColor === 'function' ? (
              <ProjectColorDotButton
                accent={projectAccentColor || stepzTokens.accent}
                isMobile={isMobile}
                onPick={onSetProjectColor}
              />
            ) : null}
          </>
        )}
      </div>
      {open && (
        <div style={{
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 8,
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
        }}>
          <div style={{ minWidth: 648 }}>
            {showTaskTableHeader ? <TaskTableHeaderRow /> : null}
            {children}
          </div>
        </div>
      )}
    </div>
    <DropIndicator active={!!dropAfter} inset={isMobile ? 0 : 4} />
    </>
  );
}

function HabitRowToday({ habit, onToggle, onToggleDate, categories, onEdit }) {
  const today = todayStr();
  const doneToday = habit.history.includes(today);
  const streak = computeHabitStreak(habit.history);
  const accent = habitAccentCss(habit, categories);
  const slotDays = 10;
  const days = [];
  for (let i = slotDays - 1; i >= 0; i--) {
    const ds = addCalendarDays(today, -i);
    days.push({
      date: ds,
      done: habit.history.includes(ds),
      letter: weekdayLetterPt(ds),
      isToday: ds === today,
    });
  }
  const SLOT = 14;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', minWidth: 0 }} onClick={onToggle}>
          <div style={{
            width: 18, height: 18, borderRadius: 9,
            border: `1.5px solid ${doneToday ? accent : 'rgba(255,255,255,0.22)'}`,
            background: doneToday ? accent : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {doneToday && <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#0a0a0b" strokeWidth="2" strokeLinecap="round"><path d="M2 5l2 2 4-4" /></svg>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: stepzTokens.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{habit.title}</div>
            <div style={{ fontSize: 11, color: accent, marginTop: 2, fontWeight: 500 }}>
              {streak} {streak === 1 ? 'dia' : 'dias'} seguidos
            </div>
          </div>
        </div>
        {onEdit ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            style={{
              flexShrink: 0,
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${stepzTokens.border}`,
              color: stepzTokens.textDim,
              fontSize: 11,
              padding: '4px 8px',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: stepzTokens.font,
            }}
          >editar</button>
        ) : null}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 30 }}>
        <div style={{ display: 'flex', gap: 3 }}>
          {days.map(d => (
            <div key={`l-${d.date}`} style={{
              width: SLOT,
              textAlign: 'center',
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 0.4,
              color: d.isToday ? accent : stepzTokens.textFaint,
              lineHeight: 1,
            }}>{d.letter}</div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          {days.map(d => {
            const clickable = !!onToggleDate;
            const dateLabel = new Date(`${d.date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
            const title = `${dateLabel}${d.isToday ? ' (hoje)' : ''} · ${d.done ? 'feito — clique para desmarcar' : 'clique para marcar'}`;
            const commonStyle = {
              width: SLOT,
              height: SLOT,
              borderRadius: 3,
              background: d.done ? accent : 'rgba(255,255,255,0.06)',
              border: d.isToday && !d.done ? `1px solid color-mix(in srgb, ${accent} 55%, transparent)` : 'none',
              padding: 0,
              boxSizing: 'border-box',
            };
            if (!clickable) {
              return <div key={d.date} title={title} style={commonStyle} />;
            }
            return (
              <button
                key={d.date}
                type="button"
                title={title}
                aria-pressed={d.done}
                onClick={(e) => { e.stopPropagation(); onToggleDate(d.date); }}
                style={{
                  ...commonStyle,
                  cursor: 'pointer',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  boxShadow: 'none',
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function HabitFullRow({ habit, onToggle, onToggleDate, onDelete, onEdit, categories }) {
  const today = todayStr();
  const doneToday = habit.history.includes(today);
  const streak = computeHabitStreak(habit.history);
  const accent = habitAccentCss(habit, categories);
  const slotDays = 10;
  const days = [];
  for (let i = slotDays - 1; i >= 0; i--) {
    const ds = addCalendarDays(today, -i);
    days.push({
      date: ds,
      done: habit.history.includes(ds),
      letter: weekdayLetterPt(ds),
      isToday: ds === today,
    });
  }
  const SLOT = 14;
  return (
    <div style={{
      padding: '14px 0 14px 6px',
      borderBottom: `1px solid ${stepzTokens.border}`,
      borderLeft: `3px solid color-mix(in srgb, ${accent} 38%, transparent)`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" onClick={onToggle}
          style={{
            width: 22, height: 22, borderRadius: 11,
            border: `1.5px solid ${doneToday ? accent : 'rgba(255,255,255,0.22)'}`,
            background: doneToday ? accent : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, cursor: 'pointer', padding: 0,
            appearance: 'none',
            WebkitAppearance: 'none',
            boxShadow: 'none',
          }}>
          {doneToday && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#0a0a0b" strokeWidth="2.5" strokeLinecap="round"><path d="M2 6l3 3 5-6" /></svg>}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, color: stepzTokens.text, fontWeight: 500 }}>{habit.title}</div>
          <div style={{ fontSize: 11, color: accent, marginTop: 2, fontWeight: 500 }}>
            {streak} {streak === 1 ? 'dia' : 'dias'} · {habit.history.length} total
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 3 }}>
            {days.map(d => (
              <div key={`l-${d.date}`} style={{
                width: SLOT,
                textAlign: 'center',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 0.4,
                color: d.isToday ? accent : stepzTokens.textFaint,
                lineHeight: 1,
              }}>{d.letter}</div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            {days.map(d => {
              const clickable = !!onToggleDate;
              const dateLabel = new Date(`${d.date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
              const title = `${dateLabel}${d.isToday ? ' (hoje)' : ''} · ${d.done ? 'feito — clique para desmarcar' : 'clique para marcar'}`;
              const commonStyle = {
                width: SLOT,
                height: SLOT,
                borderRadius: 3,
                background: d.done ? accent : 'rgba(255,255,255,0.06)',
                border: d.isToday && !d.done ? `1px solid color-mix(in srgb, ${accent} 55%, transparent)` : 'none',
                padding: 0,
                boxSizing: 'border-box',
              };
              if (!clickable) {
                return <div key={d.date} title={title} style={commonStyle} />;
              }
              return (
                <button
                  key={d.date}
                  type="button"
                  title={title}
                  aria-pressed={d.done}
                  onClick={(e) => { e.stopPropagation(); onToggleDate(d.date); }}
                  style={{
                    ...commonStyle,
                    cursor: 'pointer',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    boxShadow: 'none',
                  }}
                />
              );
            })}
          </div>
        </div>
        {onEdit ? (
          <button type="button" title="Editar hábito" onClick={(e) => { e.stopPropagation(); onEdit(); }}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${stepzTokens.border}`,
              color: stepzTokens.textDim,
              cursor: 'pointer',
              fontSize: 11,
              padding: '4px 8px',
              borderRadius: 6,
              fontFamily: stepzTokens.font,
              flexShrink: 0,
            }}>editar</button>
        ) : null}
        {onDelete && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }}
            style={{ background: 'transparent', border: 'none', color: stepzTokens.textFaint, cursor: 'pointer', fontSize: 16, padding: 4, opacity: 0.5, marginLeft: 4 }}>×</button>
        )}
      </div>
    </div>
  );
}

function AddInline({ onAdd, placeholder = 'Nova task…' }) {
  const [val, setVal] = useState('');
  const submit = () => { if (val.trim()) { onAdd(val); setVal(''); } };
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder={placeholder}
        style={{
          background: 'rgba(255,255,255,0.04)', border: `1px solid ${stepzTokens.border}`,
          color: stepzTokens.text, fontSize: 12, padding: '6px 10px', borderRadius: 6,
          width: 220, outline: 'none', fontFamily: stepzTokens.font,
        }} />
      <button onClick={submit}
        style={{
          background: stepzAccentBg(), border: 'none', color: '#0a0a0b',
          fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 6,
          cursor: 'pointer', fontFamily: stepzTokens.font,
        }}>+</button>
    </div>
  );
}

function HabitCreateModal({ onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const submit = () => {
    const t = title.trim();
    if (!t) return;
    onCreate(t);
    setTitle('');
  };
  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 130,
        backdropFilter: 'blur(5px)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="habit-create-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 440,
          maxWidth: 'calc(100vw - 28px)',
          background: stepzTokens.panel,
          border: `1px solid ${stepzTokens.borderStrong}`,
          borderRadius: 14,
          padding: '22px 22px 18px',
        }}
      >
        <div style={{ fontSize: 11, color: stepzTokens.accent, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>
          Hábitos
        </div>
        <div id="habit-create-title" style={{ fontSize: 20, fontWeight: 600, letterSpacing: -0.4, marginBottom: 16 }}>
          Novo hábito
        </div>
        <label htmlFor="habit-create-name" style={{ fontSize: 11, color: stepzTokens.textDim, display: 'block', marginBottom: 6 }}>
          Nome
        </label>
        <input
          id="habit-create-name"
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Ex.: Meditar 10 minutos"
          style={{ ...modalInputStyle, width: '100%', boxSizing: 'border-box', marginBottom: 16 }}
        />
        <div style={{ fontSize: 12, color: stepzTokens.textDim, lineHeight: 1.45, marginBottom: 16 }}>
          Você marca o hábito nos dias em que cumprir. Cada dia concluído conta um degrau na sua escada.
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} style={modalGhostBtnStyle}>
            cancelar
          </button>
          <button type="button" onClick={submit} style={modalPrimaryBtnStyle}>
            criar hábito
          </button>
        </div>
      </div>
    </div>
  );
}

function HabitEditModal({ habit, categories, onClose, onSave }) {
  const [title, setTitle] = useState(habit?.title || '');
  const [habitColor, setHabitColor] = useState(() => initialHabitEditColor(habit, categories));
  useEffect(() => {
    setTitle(habit?.title || '');
    setHabitColor(initialHabitEditColor(habit, categories));
  }, [habit?.id, habit?.title, habit?.color, habit?.category, categories]);
  const submit = () => {
    const t = title.trim();
    if (!t) return;
    onSave({ title: t, color: habitColor });
  };
  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 135,
        backdropFilter: 'blur(5px)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="habit-edit-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 440,
          maxWidth: 'calc(100vw - 28px)',
          background: stepzTokens.panel,
          border: `1px solid ${stepzTokens.borderStrong}`,
          borderRadius: 14,
          padding: '22px 22px 18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: stepzTokens.accent, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>
              Hábitos
            </div>
            <div id="habit-edit-title" style={{ fontSize: 20, fontWeight: 600, letterSpacing: -0.4 }}>
              Editar hábito
            </div>
          </div>
          <GoalPaletteColorPicker color={habitColor} onChange={setHabitColor} />
        </div>
        <label htmlFor="habit-edit-name" style={{ fontSize: 11, color: stepzTokens.textDim, display: 'block', marginBottom: 6 }}>
          Nome
        </label>
        <input
          id="habit-edit-name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Nome do hábito"
          style={{ ...modalInputStyle, width: '100%', boxSizing: 'border-box', marginBottom: 16 }}
        />
        <div style={{ fontSize: 12, color: stepzTokens.textDim, lineHeight: 1.45, marginBottom: 16 }}>
          A cor vale para a lista e para novos degraus na escada (histórico antigo mantém a cor que tinha no dia).
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} style={modalGhostBtnStyle}>
            cancelar
          </button>
          <button type="button" onClick={submit} style={modalPrimaryBtnStyle}>
            guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function RecurringMonthlyToggle({ checked, onChange }) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 10,
        border: `1px solid ${checked ? stepzTokens.accent : stepzTokens.borderStrong}`,
        background: checked ? 'rgba(212,175,55,0.08)' : 'rgba(255,255,255,0.02)',
        cursor: 'pointer',
        transition: 'background 0.12s ease, border-color 0.12s ease',
      }}
    >
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 2, accentColor: stepzTokens.accent, cursor: 'pointer' }}
      />
      <span style={{ display: 'grid', gap: 2 }}>
        <span style={{ fontSize: 13, color: stepzTokens.text, fontWeight: 600 }}>
          ↻ Repete mensalmente
        </span>
        <span style={{ fontSize: 11, color: stepzTokens.textDim, lineHeight: 1.4 }}>
          Reabre automaticamente 7 dias antes da data de prazo. O prazo avança ~30 dias ao concluir cada ciclo. Os degraus anteriores são preservados.
        </span>
      </span>
    </label>
  );
}

function TaskCreateModal({ onClose, onCreate, projectOptions = [], taskTagColors = {}, allKnownTaskTags = [], onSetTaskTagColor }) {
  const hasExistingProjects = projectOptions.length > 0;
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState(TASK_STATUS[0].id);
  const [priority, setPriority] = useState(TASK_PRIORITIES[1].id);
  const [projectMode, setProjectMode] = useState(hasExistingProjects ? 'existing' : 'new');
  const [selectedProject, setSelectedProject] = useState('');
  const [newProject, setNewProject] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [tags, setTags] = useState([]);
  const [tagPopoverAnchor, setTagPopoverAnchor] = useState(null);
  const [description, setDescription] = useState('');
  const [recurringMonthly, setRecurringMonthly] = useState(false);
  const [projectError, setProjectError] = useState('');

  const submit = () => {
    if (!title.trim()) return;
    const projectTrim = (projectMode === 'existing' ? selectedProject : newProject).trim();
    if (!projectTrim) {
      setProjectError('Informe o projeto da task.');
      return;
    }
    setProjectError('');
    onCreate({
      title: title.trim(),
      category: defaultTaskCategoryId(),
      status, priority, dueDate, tags: tags.slice(0, 6),
      project: projectTrim,
      description: description.trim(),
      recurrence: recurringMonthly ? 'monthly' : null,
      recurrenceIntervalDays: recurringMonthly ? RECURRING_DEFAULT_INTERVAL : null,
      recurrenceLeadDays: recurringMonthly ? RECURRING_DEFAULT_LEAD : null,
    });
  };

  const openTagsPopover = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTagPopoverAnchor({ left: r.left, top: r.bottom + 6 });
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 130,
      backdropFilter: 'blur(5px)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 560, maxWidth: 'calc(100vw - 28px)',
        background: stepzTokens.panel, border: `1px solid ${stepzTokens.borderStrong}`,
        borderRadius: 14, padding: '22px 22px 18px',
      }}>
        <div style={{ fontSize: 11, color: stepzTokens.accent, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>
          Criar task
        </div>
        <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: -0.4, marginBottom: 16 }}>Nova tarefa</div>

        <div style={{ display: 'grid', gap: 12 }}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titulo da task"
            onKeyDown={e => e.key === 'Enter' && submit()}
            style={modalInputStyle} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <select value={status} onChange={e => setStatus(e.target.value)} style={modalInputStyle}>
              {TASK_STATUS.map(s => <option key={s.id} value={s.id} style={{ color: '#000', background: '#fff' }}>{s.label}</option>)}
            </select>
            <select value={priority} onChange={e => setPriority(e.target.value)} style={modalInputStyle}>
              {TASK_PRIORITIES.map(p => <option key={p.id} value={p.id} style={{ color: '#000', background: '#fff' }}>{p.label}</option>)}
            </select>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              title="Opcional — deixe em branco se não quiser prazo"
              style={modalInputStyle}
            />
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: stepzTokens.textDim, letterSpacing: 0.3 }}>
              Projeto <span style={{ color: stepzTokens.accent }}>*</span>
            </div>
            {hasExistingProjects && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => { setProjectMode('existing'); setProjectError(''); }}
                  style={projectMode === 'existing' ? modalChipActiveStyle : modalChipStyle}
                >
                  Projeto existente
                </button>
                <button
                  type="button"
                  onClick={() => { setProjectMode('new'); setProjectError(''); }}
                  style={projectMode === 'new' ? modalChipActiveStyle : modalChipStyle}
                >
                  Novo projeto
                </button>
              </div>
            )}
            {(projectMode === 'existing' && hasExistingProjects) ? (
              <select
                value={selectedProject}
                onChange={e => { setSelectedProject(e.target.value); setProjectError(''); }}
                style={modalInputStyle}
              >
                <option value="" disabled style={{ color: '#000', background: '#fff' }}>
                  Selecione um projeto
                </option>
                {projectOptions.map((projectName) => (
                  <option key={projectName} value={projectName} style={{ color: '#000', background: '#fff' }}>
                    {projectName}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={newProject}
                onChange={e => { setNewProject(e.target.value); setProjectError(''); }}
                placeholder="Nome do projeto (obrigatório)"
                style={modalInputStyle}
              />
            )}
            {projectError ? (
              <div style={{ fontSize: 12, color: '#f87171', lineHeight: 1.35 }}>{projectError}</div>
            ) : null}
          </div>

          <button
            type="button"
            data-tags-trigger
            title="Abrir biblioteca de tags"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openTagsPopover(e);
              }
            }}
            onClick={(e) => {
              e.preventDefault();
              openTagsPopover(e);
            }}
            style={{
              ...modalInputStyle,
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 6,
              cursor: 'pointer',
              minHeight: 42,
              boxSizing: 'border-box',
              appearance: 'none',
              WebkitAppearance: 'none',
              textAlign: 'left',
            }}
          >
            {tags.length === 0 ? (
              <span style={{ color: stepzTokens.textFaint, fontSize: 13 }}>
                Clique para escolher tags já usadas ou criar novas
              </span>
            ) : (
              tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: 10,
                    color: '#ffffff',
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: colorForTaskTag(tag, taskTagColors),
                    fontWeight: 600,
                  }}
                >
                  {tag}
                </span>
              ))
            )}
          </button>

          <textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Descricao da task"
            style={{ ...modalInputStyle, minHeight: 92, resize: 'vertical' }} />

          <RecurringMonthlyToggle checked={recurringMonthly} onChange={setRecurringMonthly} />
        </div>

        {tagPopoverAnchor && (
          <TaskTagsPopover
            anchor={tagPopoverAnchor}
            taskTags={tags}
            allKnownTags={allKnownTaskTags}
            tagColors={taskTagColors}
            onClose={() => setTagPopoverAnchor(null)}
            onSave={(next) => setTags(next)}
            onSetTagColor={onSetTaskTagColor || (() => {})}
          />
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={modalGhostBtnStyle}>cancelar</button>
          <button onClick={submit} style={modalPrimaryBtnStyle}>criar task</button>
        </div>
      </div>
    </div>
  );
}

function TaskEditModal({ task, onClose, onSave, projectOptions = [] }) {
  const normalizedProject = ((task?.project || '').trim() || DEFAULT_PROJECT);
  const hasExistingProjects = projectOptions.length > 0;
  const [title, setTitle] = useState(task?.title || '');
  const [status, setStatus] = useState(task?.status || TASK_STATUS[0].id);
  const [priority, setPriority] = useState(task?.priority || TASK_PRIORITIES[1].id);
  const [projectMode, setProjectMode] = useState(projectOptions.includes(normalizedProject) ? 'existing' : 'new');
  const [selectedProject, setSelectedProject] = useState(
    projectOptions.includes(normalizedProject)
      ? normalizedProject
      : (projectOptions[0] || normalizedProject),
  );
  const [newProject, setNewProject] = useState(normalizedProject);
  const [dueDate, setDueDate] = useState(task?.dueDate || todayStr());
  const [tagsInput, setTagsInput] = useState((task?.tags || []).join(', '));
  const [description, setDescription] = useState(task?.description || '');
  const [recurringMonthly, setRecurringMonthly] = useState(isTaskRecurringMonthly(task));

  const resolvedProject = (projectMode === 'existing' ? selectedProject : newProject).trim() || DEFAULT_PROJECT;
  const submit = () => {
    if (!title.trim()) return;
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean).slice(0, 6);
    onSave({
      title: title.trim(),
      category: task.category,
      status, priority, dueDate, tags,
      project: resolvedProject,
      description: description.trim(),
      recurrence: recurringMonthly ? 'monthly' : null,
      recurrenceIntervalDays: recurringMonthly ? RECURRING_DEFAULT_INTERVAL : null,
      recurrenceLeadDays: recurringMonthly ? RECURRING_DEFAULT_LEAD : null,
    });
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 130,
      backdropFilter: 'blur(5px)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 560, maxWidth: 'calc(100vw - 28px)',
        background: stepzTokens.panel, border: `1px solid ${stepzTokens.borderStrong}`,
        borderRadius: 14, padding: '22px 22px 18px',
      }}>
        <div style={{ fontSize: 11, color: stepzTokens.accent, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>
          Editar task
        </div>
        <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: -0.4, marginBottom: 16 }}>Atualizar tarefa</div>

        <div style={{ display: 'grid', gap: 12 }}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titulo da task"
            onKeyDown={e => e.key === 'Enter' && submit()}
            style={modalInputStyle} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <select value={status} onChange={e => setStatus(e.target.value)} style={modalInputStyle}>
              {TASK_STATUS.map(s => <option key={s.id} value={s.id} style={{ color: '#000', background: '#fff' }}>{s.label}</option>)}
            </select>
            <select value={priority} onChange={e => setPriority(e.target.value)} style={modalInputStyle}>
              {TASK_PRIORITIES.map(p => <option key={p.id} value={p.id} style={{ color: '#000', background: '#fff' }}>{p.label}</option>)}
            </select>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={modalInputStyle} />
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            {hasExistingProjects && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setProjectMode('existing')}
                  style={projectMode === 'existing' ? modalChipActiveStyle : modalChipStyle}>
                  Projeto existente
                </button>
                <button type="button" onClick={() => setProjectMode('new')}
                  style={projectMode === 'new' ? modalChipActiveStyle : modalChipStyle}>
                  Novo projeto
                </button>
              </div>
            )}
            {(projectMode === 'existing' && hasExistingProjects) ? (
              <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} style={modalInputStyle}>
                {projectOptions.map((projectName) => (
                  <option key={projectName} value={projectName} style={{ color: '#000', background: '#fff' }}>
                    {projectName}
                  </option>
                ))}
              </select>
            ) : (
              <input value={newProject} onChange={e => setNewProject(e.target.value)}
                placeholder="Projeto da task" style={modalInputStyle} />
            )}
          </div>

          <input value={tagsInput} onChange={e => setTagsInput(e.target.value)}
            placeholder="Tags separadas por virgula (ex: foco, saude, semana)"
            style={modalInputStyle} />

          <textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Descricao da task"
            style={{ ...modalInputStyle, minHeight: 92, resize: 'vertical' }} />

          <RecurringMonthlyToggle checked={recurringMonthly} onChange={setRecurringMonthly} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={modalGhostBtnStyle}>cancelar</button>
          <button onClick={submit} style={modalPrimaryBtnStyle}>salvar task</button>
        </div>
      </div>
    </div>
  );
}

function ChangePasswordModal({ onClose, onSubmit }) {
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const inputBase = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    borderRadius: 8,
    border: `1px solid ${stepzTokens.borderStrong}`,
    background: 'rgba(0,0,0,0.35)',
    color: stepzTokens.text,
    fontSize: 13,
    fontFamily: stepzTokens.font,
    outline: 'none',
  };

  const handleSubmit = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    setError('');
    setInfo('');
    if (newPwd.length < 6) {
      setError('A nova senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setError('As senhas não coincidem.');
      return;
    }
    setBusy(true);
    try {
      const msg = await onSubmit(newPwd);
      if (msg) {
        setError(msg);
      } else {
        setInfo('Senha alterada com sucesso.');
        setTimeout(() => onClose(), 900);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: 16,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 380,
          background: stepzTokens.panel,
          border: `1px solid ${stepzTokens.borderStrong}`,
          borderRadius: 14,
          padding: '22px 22px 20px',
          boxShadow: '0 24px 48px rgba(0,0,0,0.45)',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: -0.2, marginBottom: 4 }}>Editar senha</div>
        <div style={{ fontSize: 12, color: stepzTokens.textDim, marginBottom: 16, lineHeight: 1.4 }}>
          Escolha uma nova senha com pelo menos 6 caracteres.
        </div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: stepzTokens.textDim, marginBottom: 6 }}>
          Nova senha
        </label>
        <PasswordField
          name="new-password"
          autoComplete="new-password"
          value={newPwd}
          onChange={(ev) => setNewPwd(ev.target.value)}
          placeholder="••••••••"
          inputBase={inputBase}
          marginBottom={14}
        />
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: stepzTokens.textDim, marginBottom: 6 }}>
          Confirmar nova senha
        </label>
        <PasswordField
          name="confirm-new-password"
          autoComplete="new-password"
          value={confirmPwd}
          onChange={(ev) => setConfirmPwd(ev.target.value)}
          placeholder="••••••••"
          inputBase={inputBase}
          marginBottom={error || info ? 10 : 14}
        />
        {error ? (
          <div style={{ fontSize: 12, color: stepzTokens.warn, marginBottom: 12, lineHeight: 1.35 }}>{error}</div>
        ) : null}
        {info ? (
          <div style={{ fontSize: 12, color: stepzTokens.success, marginBottom: 12, lineHeight: 1.35 }}>{info}</div>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button type="button" onClick={onClose} style={modalGhostBtnStyle}>cancelar</button>
          <button type="submit" disabled={busy} style={{ ...modalPrimaryBtnStyle, opacity: busy ? 0.7 : 1, cursor: busy ? 'wait' : 'pointer' }}>
            {busy ? 'Salvando…' : 'Salvar senha'}
          </button>
        </div>
      </form>
    </div>
  );
}

const modalInputStyle = {
  background: 'rgba(255,255,255,0.04)', border: `1px solid ${stepzTokens.border}`,
  color: stepzTokens.text, fontSize: 13, padding: '10px 12px', borderRadius: 8,
  outline: 'none', fontFamily: stepzTokens.font, width: '100%',
};
const modalGhostBtnStyle = {
  background: 'rgba(255,255,255,0.04)', border: `1px solid ${stepzTokens.border}`,
  color: stepzTokens.textDim, fontSize: 12, padding: '8px 12px', borderRadius: 7,
  cursor: 'pointer', fontFamily: stepzTokens.font,
};
const modalPrimaryBtnStyle = {
  background: stepzAccentBg(), border: 'none', color: '#0a0a0b',
  fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 7,
  cursor: 'pointer', fontFamily: stepzTokens.font,
};
const modalChipStyle = {
  background: 'rgba(255,255,255,0.03)',
  border: `1px solid ${stepzTokens.border}`,
  color: stepzTokens.textDim,
  fontSize: 11,
  padding: '7px 10px',
  borderRadius: 999,
  cursor: 'pointer',
  fontFamily: stepzTokens.font,
};
const modalChipActiveStyle = {
  ...modalChipStyle,
  background: stepzTokens.accentSoft,
  border: `1px solid ${stepzTokens.accent}`,
  color: stepzTokens.text,
};

function Empty({ msg, small }) {
  return (
    <div style={{
      padding: small ? '12px 0' : '24px 0', textAlign: 'center',
      fontSize: small ? 12 : 13, color: stepzTokens.textFaint,
    }}>{msg}</div>
  );
}

function enrichStepDetail(step, tasks, habits) {
  if (!step) return null;
  if (step.completedGoalId) {
    const description = String(step.description || '').trim();
    const category = step.category;
    const goalColor = step.color != null && String(step.color).trim() ? String(step.color).trim() : '';
    return {
      task: null,
      habit: null,
      description,
      tags: [],
      priority: '',
      dueDate: '',
      project: '',
      category,
      goalColor,
      kind: 'goal',
    };
  }
  const task = step.taskId && Array.isArray(tasks) ? tasks.find((t) => t.id === step.taskId) : null;
  const habit = step.habitId && Array.isArray(habits) ? habits.find((h) => h.id === step.habitId) : null;
  const description = String((step.description != null ? step.description : task?.description) || '').trim();
  const tags = Array.isArray(step.tags) ? step.tags : (Array.isArray(task?.tags) ? [...task.tags] : []);
  const priority = step.priority || task?.priority || '';
  const dueDate = step.dueDate || task?.dueDate || '';
  const project = String(step.project ?? task?.project ?? '').trim() || DEFAULT_PROJECT;
  const category = step.category || task?.category || habit?.category;
  const kind = step.taskId ? 'task' : step.habitId ? 'habit' : 'other';
  const stepPaletteColor = (step.color != null && String(step.color).trim())
    ? String(step.color).trim()
    : (habit?.color != null && String(habit.color).trim())
      ? String(habit.color).trim()
      : '';
  return { task, habit, description, tags, priority, dueDate, project, category, stepPaletteColor, kind };
}

function StepDetailModal({
  step,
  index,
  onClose,
  tasks = [],
  habits = [],
  categories,
  taskTagColors = {},
  projectColors = {},
}) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!step) return null;
  const rich = enrichStepDetail(step, tasks, habits);
  const catMeta = habitCategoryMeta({ category: rich.category }, categories || []);
  const priMeta = TASK_PRIORITIES.find((p) => p.id === rich.priority);
  /* Tasks: chip principal = projeto + cor do projeto (categorias antigas foram descontinuadas).
     Hábitos e metas mantêm o chip da paleta/categoria existente. */
  const isTaskStep = rich.kind === 'task';
  const taskProjectName = isTaskStep ? (rich.project || '').trim() : '';
  let detailAccent;
  let detailChipLabel;
  if (rich.kind === 'goal') {
    detailAccent = rich.goalColor || catMeta.color;
    detailChipLabel = rich.goalColor ? goalPaletteLabel(rich.goalColor) : catMeta.label;
  } else if (isTaskStep && taskProjectName) {
    detailAccent = stepzResolveProjectColor(taskProjectName, projectColors);
    detailChipLabel = taskProjectName;
  } else if (rich.stepPaletteColor) {
    detailAccent = rich.stepPaletteColor;
    detailChipLabel = goalPaletteLabel(rich.stepPaletteColor);
  } else {
    detailAccent = catMeta.color;
    detailChipLabel = catMeta.label;
  }

  const kindLabel = rich.kind === 'goal' ? 'Meta' : rich.kind === 'habit' ? 'Hábito' : rich.kind === 'task' ? 'Task' : '—';

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.62)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      backdropFilter: 'blur(6px)',
    }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(520px, calc(100vw - 36px))',
          maxHeight: 'min(88vh, 720px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 16,
          border: `1px solid ${stepzTokens.borderStrong}`,
          background: stepzTokens.panel,
          boxShadow: '0 24px 80px rgba(0,0,0,0.65)',
        }}
      >
        <div style={{
          height: 5,
          flexShrink: 0,
          background: stepzTokens.accentGradient || stepzTokens.accent,
        }} />
        <div style={{ padding: '22px 26px 20px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: stepzTokens.accent, letterSpacing: 0.55, textTransform: 'uppercase' }}>
              {rich.kind === 'goal' ? 'Meta na escada' : `Degrau ${index + 1}`}
            </div>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
              padding: '5px 11px', borderRadius: 999,
              border: `1px solid ${stepzTokens.border}`,
              color: stepzTokens.textDim,
              fontFamily: stepzTokens.fontMono,
            }}>{kindLabel}</div>
          </div>

          <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: -0.55, lineHeight: 1.15, marginBottom: 14 }}>
            {step.title}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '5px 11px', borderRadius: 999,
              color: '#fff', background: detailAccent,
              maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }} title={detailChipLabel}>{detailChipLabel}</span>
            {rich.kind === 'goal' ? (
              <span style={{
                fontSize: 11, color: stepzTokens.textDim,
                padding: '5px 11px', borderRadius: 999,
                border: `1px solid ${stepzTokens.border}`,
              }}>Medalha na parede</span>
            ) : null}
            {rich.kind === 'task' ? (
              <>
                {rich.dueDate ? (
                  <span style={{
                    fontSize: 11, color: stepzTokens.textDim,
                    padding: '5px 11px', borderRadius: 999,
                    border: `1px solid ${stepzTokens.border}`,
                  }}>Prazo: {formatDate(rich.dueDate)}</span>
                ) : null}
                {priMeta ? (
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '5px 11px', borderRadius: 999,
                    border: `1px solid ${statusOptionBorderSoft(priMeta.color)}`,
                    color: priMeta.color,
                  }}>{priMeta.label}</span>
                ) : null}
              </>
            ) : null}
          </div>

          {rich.description ? (
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 10, letterSpacing: 0.45, textTransform: 'uppercase',
                color: stepzTokens.textFaint, marginBottom: 8,
              }}>Descrição</div>
              <div style={{
                fontSize: 14, color: stepzTokens.textDim, lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                padding: '12px 14px',
                borderRadius: 12,
                border: `1px solid ${stepzTokens.border}`,
                background: stepzTokens.panel2,
              }}>{rich.description}</div>
            </div>
          ) : (
            <div style={{
              fontSize: 13, color: stepzTokens.textFaint,
              padding: '12px 14px',
              borderRadius: 12,
              border: `1px dashed ${stepzTokens.border}`,
              marginBottom: 16,
            }}>
              Sem descrição registrada neste degrau.
            </div>
          )}

          {rich.kind === 'task' && rich.tags.length > 0 ? (
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 10, letterSpacing: 0.45, textTransform: 'uppercase',
                color: stepzTokens.textFaint, marginBottom: 8,
              }}>Tags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {rich.tags.map((tg) => (
                  <span key={tg} style={{
                    fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 999,
                    color: '#fff',
                    background: colorForTaskTag(tg, taskTagColors),
                    maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }} title={tg}>{tg}</span>
                ))}
              </div>
            </div>
          ) : null}

          <div style={{
            paddingTop: 14,
            borderTop: `1px solid ${stepzTokens.border}`,
            fontSize: 13, color: stepzTokens.textDim, lineHeight: 1.55,
          }}>
            <div style={{ color: stepzTokens.text, fontWeight: 600, marginBottom: 4 }}>Conclusão</div>
            {new Date(step.completedAt).toLocaleString('pt-BR')}
            <div style={{ marginTop: 6, color: stepzTokens.textFaint }}>{formatRelative(step.completedAt)}</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
            <button type="button" onClick={onClose} style={{
              background: stepzAccentBg(),
              border: 'none',
              color: '#0a0a0b',
              padding: '10px 18px',
              borderRadius: 10,
              cursor: 'pointer',
              fontFamily: stepzTokens.font,
              fontSize: 13,
              fontWeight: 600,
            }}>Fechar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CelebrationToast({ count, isLevel, brief, goalComplete, goalTitle, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, brief ? (goalComplete ? 2600 : 1800) : 3500);
    return () => clearTimeout(t);
  }, [brief, goalComplete, onClose]);
  if (brief && goalComplete) {
    return (
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 200,
        background: stepzTokens.panel, border: `1px solid ${stepzTokens.borderStrong}`,
        borderRadius: 10, padding: '12px 18px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', gap: 10,
        animation: 'slideUp .25s ease-out',
        maxWidth: 340,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 18,
          background: 'linear-gradient(145deg, #f7ebb8, #c9a227)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#0a0a0b', fontWeight: 800, fontSize: 16, flexShrink: 0,
        }}>★</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, color: stepzTokens.accent, fontWeight: 600 }}>Meta alcançada</div>
          <div style={{ fontSize: 13, color: stepzTokens.text, fontWeight: 500, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={goalTitle}>
            {goalTitle || 'Nova conquista'}
          </div>
          <div style={{ fontSize: 11, color: stepzTokens.textFaint, marginTop: 4 }}>
            Um degrau especial com medalha na escada · #{count}
          </div>
        </div>
      </div>
    );
  }
  if (brief) {
    return (
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 200,
        background: stepzTokens.panel, border: `1px solid ${stepzTokens.borderStrong}`,
        borderRadius: 10, padding: '12px 18px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', gap: 10,
        animation: 'slideUp .25s ease-out',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 14, background: stepzAccentBg(),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#0a0a0b', fontWeight: 700, fontSize: 13,
        }}>+1</div>
        <div>
          <div style={{ fontSize: 13, color: stepzTokens.text }}>Degrau {count}</div>
          <div style={{ fontSize: 11, color: stepzTokens.textFaint }}>você está subindo</div>
        </div>
      </div>
    );
  }
  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 200, pointerEvents: 'none',
    }}>
      <div style={{
        background: stepzTokens.panel,
        border: `2px solid ${isLevel ? stepzTokens.warn : stepzTokens.accent}`,
        borderRadius: 16, padding: '32px 44px', textAlign: 'center',
        boxShadow: '0 20px 80px rgba(0,0,0,0.6)',
        animation: 'pop .35s ease-out',
      }}>
        <div style={{ fontSize: 11, color: isLevel ? stepzTokens.warn : stepzTokens.accent, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
          {isLevel ? 'NOVO PATAMAR' : 'MARCO'}
        </div>
        <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: -1, marginBottom: 6 }}>
          {count} degraus
        </div>
        <div style={{ fontSize: 14, color: stepzTokens.textDim }}>
          {isLevel
            ? `Bem-vindo ao Nível ${Math.floor(count / STEPS_PER_LEVEL) + 1} · ${LEVEL_META[Math.floor(count / STEPS_PER_LEVEL)]?.name || ''}`
            : 'Continue subindo'}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──
function computeDayStreak(steps) {
  if (steps.length === 0) return 0;
  const dates = new Set(steps.map(s => dateKeyFromIso(s.completedAt)).filter(Boolean));
  const today = todayStr();
  let streak = 0;
  let key = today;
  while (dates.has(key)) {
    streak++;
    key = addCalendarDays(key, -1);
    if (!key) break;
  }
  if (streak === 0) {
    key = addCalendarDays(today, -1);
    while (key && dates.has(key)) {
      streak++;
      key = addCalendarDays(key, -1);
    }
  }
  return streak;
}
function computeHabitStreak(history) {
  if (!history || history.length === 0) return 0;
  const set = new Set(history);
  const today = todayStr();
  let streak = 0;
  let key = today;
  while (set.has(key)) {
    streak++;
    key = addCalendarDays(key, -1);
    if (!key) break;
  }
  if (streak === 0) {
    key = addCalendarDays(today, -1);
    while (key && set.has(key)) {
      streak++;
      key = addCalendarDays(key, -1);
    }
  }
  return streak;
}
function formatDate(iso) {
  if (!iso) return '—';
  const key = String(iso).slice(0, 10);
  // Ancora ao meio-dia local: evita o "off-by-one" em fusos negativos (ex.: UTC-3),
  // onde "YYYY-MM-DD" pura é interpretada como meia-noite UTC e cai para o dia anterior.
  const d = new Date(`${key}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  const today = todayStr();
  const yesterday = addCalendarDays(today, -1);
  if (key === today) return 'Hoje';
  if (key === yesterday) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

ReactDOM.createRoot(document.getElementById('root')).render(<AppRoot />);
