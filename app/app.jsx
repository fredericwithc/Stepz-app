const { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, useContext, createContext } = React;

/** ≤768px: uma coluna, tabs com scroll, menos padding. ≤1024px: tablet (opcional). */
const STEPZ_BREAKPOINT_MOBILE = 768;
const STEPZ_BREAKPOINT_TABLET = 1024;

const StepzViewportContext = createContext({
  width: 1024,
  isMobile: false,
  isTablet: false,
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

function LoginScreen({ useSupabase, onSubmitLogin, onSignUp }) {
  const [mode, setMode] = useState('login');
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
          {isSignup ? 'Criar conta' : 'Entrar'}
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
            {busy ? 'Aguardando…' : isSignup ? 'Criar conta' : 'Entrar na app'}
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
  const { isMobile } = useStepzViewport();

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

  /* Refs auxiliares para sync remoto (Supabase):
       - lastSyncedJsonRef: último JSON que sabemos estar igual no remoto. Evita ciclo de eco
         (gravar de volta o que acabámos de receber) e gravações redundantes.
       - remoteSaveTimerRef: timer do debounce (1.2s) das gravações remotas.
       - bootstrapInFlightRef: tag por user para abortar bootstraps obsoletos quando se troca de conta. */
  const lastSyncedJsonRef = useRef('');
  const remoteSaveTimerRef = useRef(null);
  const bootstrapInFlightRef = useRef(null);

  /* Ao mudar de utilizador (login/logout/troca de conta):
       1) Carrega o cache local imediato (snappy UX).
       2) Em background pede o estado ao Supabase — se houver, substitui pelo do servidor.
          Se não houver linha ainda, faz upload do local (bootstrap).
     Chave local: `stepz.v1:<email>`; chave remota: `user_state.user_id = auth.uid()`. */
  useEffect(() => {
    if (!authReady) return;
    const userKey = session && session.email ? session.email.toLowerCase() : null;
    if (userKey === activeUserKeyRef.current) return;
    activeUserKeyRef.current = userKey;
    if (remoteSaveTimerRef.current) {
      clearTimeout(remoteSaveTimerRef.current);
      remoteSaveTimerRef.current = null;
    }
    if (!userKey) {
      lastSyncedJsonRef.current = '';
      bootstrapInFlightRef.current = null;
      setState(defaultState());
      return undefined;
    }
    const local = loadState(userKey);
    lastSyncedJsonRef.current = '';
    setState(local);
    const bootstrapTag = Symbol('bootstrap');
    bootstrapInFlightRef.current = bootstrapTag;
    (async () => {
      const rs = typeof window !== 'undefined' ? window.stepzRemoteState : null;
      if (!rs || typeof rs.load !== 'function') return;
      let res;
      try {
        res = await rs.load();
      } catch (_) {
        return;
      }
      if (bootstrapInFlightRef.current !== bootstrapTag) return;
      if (activeUserKeyRef.current !== userKey) return;
      if (res && res.ok && res.found && res.state && typeof res.state === 'object') {
        lastSyncedJsonRef.current = JSON.stringify(res.state);
        if (remoteSaveTimerRef.current) {
          clearTimeout(remoteSaveTimerRef.current);
          remoteSaveTimerRef.current = null;
        }
        setState(res.state);
        return;
      }
      if (res && res.ok && !res.found && typeof rs.save === 'function') {
        const localJson = JSON.stringify(local);
        lastSyncedJsonRef.current = localJson;
        if (remoteSaveTimerRef.current) {
          clearTimeout(remoteSaveTimerRef.current);
          remoteSaveTimerRef.current = null;
        }
        try { await rs.save(local); } catch (_) { /* swallow — local continua válido */ }
      }
    })();
    return undefined;
  }, [authReady, session]);

  /* A cada mudança de estado, persiste:
       - LOCAL: imediato (cache para offline e arranque rápido).
       - REMOTO: com debounce de 1.2s — só se o JSON realmente diferir do último que sabemos
         estar igual ao remoto (evita eco e gravações redundantes). */
  useEffect(() => {
    const userKey = activeUserKeyRef.current;
    if (!userKey) return undefined;
    saveState(userKey, state);
    const json = JSON.stringify(state);
    if (remoteSaveTimerRef.current) {
      clearTimeout(remoteSaveTimerRef.current);
      remoteSaveTimerRef.current = null;
    }
    if (json === lastSyncedJsonRef.current) return undefined;
    const snapshot = state;
    remoteSaveTimerRef.current = setTimeout(() => {
      const rs = typeof window !== 'undefined' ? window.stepzRemoteState : null;
      if (!rs || typeof rs.save !== 'function') return;
      lastSyncedJsonRef.current = json;
      rs.save(snapshot).catch(() => { /* ignora falhas de rede — local fica como verdade temporária */ });
    }, 1200);
    return () => {
      if (remoteSaveTimerRef.current) {
        clearTimeout(remoteSaveTimerRef.current);
        remoteSaveTimerRef.current = null;
      }
    };
  }, [state]);

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
      return {
        ...s,
        tasks: s.tasks.map(x => x.id === taskId ? { ...x, done: true, status: 'done' } : x),
        steps: newSteps,
      };
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
    const dueDate = isLegacy ? todayStr() : (input.dueDate || todayStr());
    const tags = isLegacy ? [] : input.tags;
    const description = isLegacy ? '' : input.description;
    const project = isLegacy ? DEFAULT_PROJECT : ((input.project || '').trim() || DEFAULT_PROJECT);
    setState(s => ({
      ...s,
      tasks: [...s.tasks, {
        id: cryptoId(), title, category, done: false, dueDate, status, priority, tags, description, project,
      }],
    }));
  };

  const deleteTask = (taskId) => {
    setState(s => ({ ...s, tasks: s.tasks.filter(x => x.id !== taskId) }));
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
        nextSteps = [...s.steps, {
          id: cryptoId(),
          taskId: merged.id,
          title: merged.title,
          project: ((merged.project || '').trim() || DEFAULT_PROJECT),
          category: merged.category,
          completedAt: new Date().toISOString(),
          ...(snapDesc ? { description: snapDesc } : {}),
          ...(Array.isArray(merged.tags) && merged.tags.length ? { tags: [...merged.tags] } : {}),
          ...(merged.priority ? { priority: merged.priority } : {}),
          ...(merged.dueDate ? { dueDate: merged.dueDate } : {}),
        }];
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

      return {
        ...s,
        tasks: s.tasks.map(x => x.id === taskId ? merged : x),
        steps: nextSteps,
      };
    });
  };

  const renameProject = (fromProject, toProject) => {
    const from = (fromProject || '').trim();
    const to = (toProject || '').trim();
    if (!from || !to || from === to) return;
    setState(s => ({
      ...s,
      tasks: s.tasks.map(t => (((t.project || '').trim() || DEFAULT_PROJECT) === from
        ? { ...t, project: to }
        : t)),
    }));
  };

  const toggleHabitToday = (habitId) => {
    const today = todayStr();
    setState(s => {
      const h = s.habits.find(x => x.id === habitId);
      if (!h) return s;
      const wasDoneToday = h.history.includes(today);
      let newHistory, addStep = false, removeStep = false;
      if (wasDoneToday) {
        newHistory = h.history.filter(d => d !== today);
        removeStep = true;
      } else {
        newHistory = [...h.history, today].sort();
        addStep = true;
      }
      let newSteps = s.steps;
      if (addStep) {
        newSteps = [...s.steps, {
          id: cryptoId(),
          habitId: h.id,
          title: h.title,
          category: h.category,
          ...(h.color ? { color: h.color } : {}),
          completedAt: new Date().toISOString(),
        }];
        const newCount = newSteps.length;
        if (newCount % 10 === 0 || newCount % STEPS_PER_LEVEL === 0) {
          setCelebrate({ count: newCount, isLevel: newCount % STEPS_PER_LEVEL === 0 });
        } else {
          setCelebrate({ count: newCount, isLevel: false, brief: true });
        }
      } else if (removeStep) {
        // Remove most recent step for this habit
        const idx = [...s.steps].map((st, i) => ({ st, i })).reverse().find(({ st }) => st.habitId === h.id && st.completedAt.slice(0, 10) === today)?.i;
        if (idx != null) newSteps = s.steps.filter((_, i) => i !== idx);
      }
      return {
        ...s,
        habits: s.habits.map(x => x.id === habitId ? { ...x, history: newHistory } : x),
        steps: newSteps,
      };
    });
  };

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
  const todaySteps = state.steps.filter(s => s.completedAt.slice(0, 10) === todayStr()).length;
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
    return (
      <LoginScreen
        useSupabase={supabaseOn}
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

  return (
    <div style={{ fontFamily: stepzTokens.font, background: stepzTokens.bg, color: stepzTokens.text, minHeight: '100vh' }}>
      <AppHeader
        tab={tab}
        setTab={setTab}
        totalSteps={totalSteps}
        userEmail={session.email}
        onLogout={async () => {
          const sb = typeof getStepzSupabase === 'function' ? getStepzSupabase() : null;
          if (sb) await sb.auth.signOut();
          clearAuthSession();
          setSession(null);
        }}
      />

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
            onAddTask={addTask} onDeleteTask={deleteTask}
            onOpenCreateModal={() => setTaskModalOpen(true)}
            onEditTask={(task) => setEditingTask(task)}
            onUpdateTask={updateTask}
            onRenameProject={renameProject}
            onToggleHabit={toggleHabitToday}
            onEditHabit={(h) => setEditingHabit(h)}
            onStepClick={(i) => setStepDetail(i)}
            taskTagColors={taskTagColors}
            allKnownTaskTags={allKnownTaskTags}
            onSetTaskTagColor={setTaskTagColor}
          />
        )}
        {tab === 'tasks' && (
          <TasksView state={state} onComplete={completeTask} onUncomplete={uncompleteTask}
            onAdd={addTask} onDelete={deleteTask} onOpenCreateModal={() => setTaskModalOpen(true)}
            onEditTask={(task) => setEditingTask(task)} onRenameProject={renameProject} onUpdateTask={updateTask}
            onStepClick={(i) => setStepDetail(i)}
            taskTagColors={taskTagColors}
            allKnownTaskTags={allKnownTaskTags}
            onSetTaskTagColor={setTaskTagColor} />
        )}
        {tab === 'habits' && (
          <HabitsView
            state={state}
            onToggle={toggleHabitToday}
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
          <PostitsView state={state} setState={setState} />
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
      </TaskGridColumnsProvider>
    </div>
  );
}

function AppHeader({ tab, setTab, totalSteps, userEmail, onLogout }) {
  const { isMobile } = useStepzViewport();
  const tabs = [
    { id: 'home', label: 'Início' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'habits', label: 'Hábitos' },
    { id: 'goals', label: 'Metas' },
    { id: 'postits', label: 'Post-its' },
    { id: 'journey', label: 'Jornada' },
  ];
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <div style={{
      borderBottom: `1px solid ${stepzTokens.border}`,
      background: stepzTokens.bg,
      position: 'sticky',
      top: 0,
      zIndex: 10,
      paddingTop: 'env(safe-area-inset-top, 0px)',
    }}>
      <div style={{
        maxWidth: 1300,
        margin: '0 auto',
        padding: isMobile ? '12px 14px 0' : '18px 28px 0',
        width: '100%',
        boxSizing: 'border-box',
        minWidth: 0,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: isMobile ? 10 : 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <img
              src="logos/svg/lockup-color-transparent-white-text.svg"
              alt="Stepz"
              draggable={false}
              style={{ height: isMobile ? 40 : 48, width: 'auto', display: 'block', objectFit: 'contain' }}
            />
            <div style={{ fontSize: 12, color: stepzTokens.textFaint, marginLeft: 4, padding: '3px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: 4 }}>
              {totalSteps} {totalSteps === 1 ? 'degrau' : 'degraus'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14, flexWrap: 'wrap', justifyContent: 'flex-end', flex: isMobile ? '1 1 auto' : 'none', minWidth: 0 }}>
            {userEmail ? (
              <span
                title={userEmail}
                style={{
                  fontSize: 12,
                  color: stepzTokens.textDim,
                  maxWidth: isMobile ? 160 : 200,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {userEmail}
              </span>
            ) : null}
            <div style={{ fontSize: isMobile ? 12 : 13, color: stepzTokens.textDim, textAlign: 'right', lineHeight: 1.25 }}>{today}</div>
            {typeof onLogout === 'function' ? (
              <button
                type="button"
                onClick={onLogout}
                title="Terminar sessão"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${stepzTokens.borderStrong}`,
                  color: stepzTokens.textDim,
                  fontSize: 11,
                  padding: '6px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontFamily: stepzTokens.font,
                }}
              >
                sair
              </button>
            ) : null}
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
          marginLeft: isMobile ? -4 : 0,
          marginRight: isMobile ? -4 : 0,
          scrollbarWidth: 'thin',
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

function HomeView({ state, totalSteps, todaySteps, dayStreak,
  onCompleteTask, onUncompleteTask, onAddTask, onDeleteTask, onOpenCreateModal, onEditTask, onUpdateTask, onRenameProject, onToggleHabit, onEditHabit, onStepClick,
  taskTagColors, allKnownTaskTags, onSetTaskTagColor }) {
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
  const todayByProject = groupTasksByProject(todayTasks);
  return (
    <>
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
        <Panel2 title="Tasks de hoje" action={<TaskAddButton onClick={onOpenCreateModal} />}>
          {todayTasks.length === 0 ? (
            <Empty msg="Nenhuma task. Adicione uma acima." />
          ) : todayByProject.map(([project, tasks]) => (
            <TaskProjectSection key={`today-${project}`} project={project} count={tasks.length} onRenameProject={onRenameProject} showTaskTableHeader>
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
              <HabitRowToday key={h.id} habit={h} categories={state.categories} onToggle={() => onToggleHabit(h.id)} onEdit={onEditHabit ? () => onEditHabit(h) : undefined} />
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

function TasksView({ state, onComplete, onUncomplete, onAdd, onDelete, onOpenCreateModal, onEditTask, onRenameProject, onUpdateTask, onStepClick, taskTagColors, allKnownTaskTags, onSetTaskTagColor }) {
  const [tagEditor, setTagEditor] = useState(null);
  const [priorityEditor, setPriorityEditor] = useState(null);
  const [statusEditor, setStatusEditor] = useState(null);
  const tagPopoverTask = tagEditor ? state.tasks.find((x) => x.id === tagEditor.taskId) : null;
  const priorityPopoverTask = priorityEditor ? state.tasks.find((x) => x.id === priorityEditor.taskId) : null;
  const statusPopoverTask = statusEditor ? state.tasks.find((x) => x.id === statusEditor.taskId) : null;
  const openCount = state.tasks.filter(t => !t.done).length;
  const allByProject = groupTasksByProject(state.tasks);

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
          allByProject.map(([project, tasks]) => (
            <TaskProjectSection key={`proj-${project}`} project={project} count={tasks.length} onRenameProject={onRenameProject} showTaskTableHeader>
              {tasks.map(t => (
                <TaskItem key={t.id} task={t}
                  taskTagColors={taskTagColors}
                  onTagsPopoverOpen={(anchor) => { setPriorityEditor(null); setStatusEditor(null); setTagEditor({ taskId: t.id, ...anchor }); }}
                  onPriorityPopoverOpen={(anchor) => { setTagEditor(null); setStatusEditor(null); setPriorityEditor({ taskId: t.id, ...anchor }); }}
                  onStatusPopoverOpen={(anchor) => { setTagEditor(null); setPriorityEditor(null); setStatusEditor({ taskId: t.id, ...anchor }); }}
                  onComplete={() => onComplete(t.id)}
                  onUncomplete={t.done ? () => onUncomplete(t.id) : undefined}
                  onUpdateTask={(patch) => onUpdateTask(t.id, patch)}
                  onEditTask={() => onEditTask(t)}
                  onDelete={() => onDelete(t.id)} />
              ))}
            </TaskProjectSection>
          ))
        )}
      </Panel2>

      {taskCompletionArchive.length > 0 && (
        <Panel2 title={`Concluídas · ${taskCompletionArchive.length} no histórico (ligadas aos degraus)`}>
          <div style={{ fontSize: 11, color: stepzTokens.textFaint, marginBottom: 12, lineHeight: 1.45 }}>
            Cada conclusão vira um degrau na escada. Ao apagar a task no projeto, o registro e o degrau permanecem aqui.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[...taskCompletionArchive].reverse().map((st) => (
              <button
                key={st.id || `${st.stepIndex}-${st.completedAt}`}
                type="button"
                onClick={() => onStepClick && onStepClick(st.stepIndex)}
                title="Ver o mesmo degrau da escada"
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                  background: stepzTokens.panel2, borderRadius: 8,
                  border: `1px solid ${stepzTokens.border}`,
                  cursor: onStepClick ? 'pointer' : 'default',
                  textAlign: 'left', fontFamily: stepzTokens.font,
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
                <div style={{ fontSize: 11, color: stepzTokens.textFaint, fontFamily: stepzTokens.fontMono, flexShrink: 0 }}>
                  #{st.stepIndex + 1}
                </div>
              </button>
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

function groupTasksByProject(tasks) {
  const grouped = {};
  tasks.forEach((task) => {
    const project = (task.project || '').trim() || DEFAULT_PROJECT;
    if (!grouped[project]) grouped[project] = [];
    grouped[project].push(task);
  });
  Object.values(grouped).forEach((projectTasks) => {
    projectTasks.sort((a, b) => Number(a.done) - Number(b.done));
  });
  return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
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

function HabitsView({ state, onToggle, onAdd, onDelete, onOpenCreateModal, onEditHabit }) {
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
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
        gap: 12,
        flexWrap: isMobile ? 'wrap' : 'nowrap',
      }}>
        <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 600, letterSpacing: -0.2 }}>{title}</div>
        {action}
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

function TaskItem({ task, onComplete, onUncomplete, onDelete, onUpdateTask, onEditTask, taskTagColors = {}, onTagsPopoverOpen, onPriorityPopoverOpen, onStatusPopoverOpen }) {
  const gridCtx = useContext(TaskGridColumnsContext);
  const { isMobile } = useStepzViewport();
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
    borderBottom: `1px solid ${stepzTokens.border}`,
  };

  return (
    <div>
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
            cursor: onEditTask ? 'pointer' : 'default',
          }}
        >
          {task.title}
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
          onClick={() => startEdit('description', task.description || '')}
          title={task.description || ''}
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

      {editingField === 'description' && (
        <div style={{
          padding: '8px 10px 10px',
          borderBottom: `1px solid ${stepzTokens.border}`,
          background: 'rgba(255,255,255,0.02)',
        }}>
          <div style={{ marginBottom: 6 }}>
            <textarea value={draftValue} onChange={e => setDraftValue(e.target.value)}
              style={{ ...modalInputStyle, minHeight: 70, resize: 'vertical', fontSize: 12 }} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={cancelEdit} style={{ ...modalGhostBtnStyle, padding: '5px 10px', fontSize: 11 }}>cancelar</button>
            <button type="button" onClick={saveEdit} style={{ ...modalPrimaryBtnStyle, padding: '5px 10px', fontSize: 11 }}>salvar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskProjectSection({ project, count, children, onRenameProject, showTaskTableHeader }) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(project);
  const { isMobile } = useStepzViewport();
  useEffect(() => {
    if (!editing) setNewName(project);
  }, [project, editing]);
  const saveRename = () => {
    onRenameProject && onRenameProject(project, newName);
    setEditing(false);
  };
  return (
    <div style={{
      marginBottom: isMobile ? 10 : 12,
      background: stepzTokens.panel2,
      border: `1px solid ${stepzTokens.border}`,
      borderRadius: 10,
      padding: isMobile ? '8px 10px 0' : '10px 12px 0',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? 8 : 10,
        flexWrap: 'nowrap',
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${stepzTokens.border}`,
        borderRadius: 10,
        padding: isMobile ? '6px 10px' : '8px 12px',
        marginBottom: open ? 8 : 0,
      }}>
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
          </>
        )}
      </div>
      {open && (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 8 }}>
          <div style={{ minWidth: 648 }}>
            {showTaskTableHeader ? <TaskTableHeaderRow /> : null}
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

function HabitRowToday({ habit, onToggle, categories, onEdit }) {
  const today = todayStr();
  const doneToday = habit.history.includes(today);
  const streak = computeHabitStreak(habit.history);
  const accent = habitAccentCss(habit, categories);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0' }}>
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
          <div style={{ fontSize: 13, color: stepzTokens.text }}>{habit.title}</div>
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
  );
}

function HabitFullRow({ habit, onToggle, onDelete, onEdit, categories }) {
  const today = todayStr();
  const doneToday = habit.history.includes(today);
  const streak = computeHabitStreak(habit.history);
  const accent = habitAccentCss(habit, categories);
  const slotDays = 10;
  const days = [];
  for (let i = slotDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    days.push({ date: ds, done: habit.history.includes(ds) });
  }
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
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          {days.map(d => (
            <div key={d.date} title={d.date} style={{
              width: 12, height: 12, borderRadius: 2,
              background: d.done ? accent : 'rgba(255,255,255,0.06)',
            }} />
          ))}
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

function TaskCreateModal({ onClose, onCreate, projectOptions = [], taskTagColors = {}, allKnownTaskTags = [], onSetTaskTagColor }) {
  const hasExistingProjects = projectOptions.length > 0;
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState(TASK_STATUS[0].id);
  const [priority, setPriority] = useState(TASK_PRIORITIES[1].id);
  const [projectMode, setProjectMode] = useState(hasExistingProjects ? 'existing' : 'new');
  const [selectedProject, setSelectedProject] = useState(projectOptions[0] || DEFAULT_PROJECT);
  const [newProject, setNewProject] = useState('');
  const [dueDate, setDueDate] = useState(todayStr());
  const [tags, setTags] = useState([]);
  const [tagPopoverAnchor, setTagPopoverAnchor] = useState(null);
  const [description, setDescription] = useState('');

  const resolvedProject = (projectMode === 'existing'
    ? selectedProject
    : newProject).trim() || DEFAULT_PROJECT;

  const submit = () => {
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      category: defaultTaskCategoryId(),
      status, priority, dueDate, tags: tags.slice(0, 6),
      project: resolvedProject,
      description: description.trim(),
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
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={modalInputStyle} />
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            {hasExistingProjects && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setProjectMode('existing')}
                  style={projectMode === 'existing' ? modalChipActiveStyle : modalChipStyle}
                >
                  Projeto existente
                </button>
                <button
                  type="button"
                  onClick={() => setProjectMode('new')}
                  style={projectMode === 'new' ? modalChipActiveStyle : modalChipStyle}
                >
                  Novo projeto
                </button>
              </div>
            )}
            {(projectMode === 'existing' && hasExistingProjects) ? (
              <select
                value={selectedProject}
                onChange={e => setSelectedProject(e.target.value)}
                style={modalInputStyle}
              >
                {projectOptions.map((projectName) => (
                  <option key={projectName} value={projectName} style={{ color: '#000', background: '#fff' }}>
                    {projectName}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={newProject}
                onChange={e => setNewProject(e.target.value)}
                placeholder="Novo projeto (ex: Trabalho, Vida pessoal, Mae)"
                style={modalInputStyle}
              />
            )}
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
  const [selectedProject, setSelectedProject] = useState(projectOptions[0] || normalizedProject);
  const [newProject, setNewProject] = useState(normalizedProject);
  const [dueDate, setDueDate] = useState(task?.dueDate || todayStr());
  const [tagsInput, setTagsInput] = useState((task?.tags || []).join(', '));
  const [description, setDescription] = useState(task?.description || '');

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
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={modalGhostBtnStyle}>cancelar</button>
          <button onClick={submit} style={modalPrimaryBtnStyle}>salvar task</button>
        </div>
      </div>
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
  const detailAccent = rich.goalColor || rich.stepPaletteColor || catMeta.color;
  const detailChipLabel = rich.kind === 'goal'
    ? (rich.goalColor ? goalPaletteLabel(rich.goalColor) : catMeta.label)
    : rich.stepPaletteColor
      ? goalPaletteLabel(rich.stepPaletteColor)
      : catMeta.label;

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
            }}>{detailChipLabel}</span>
            {rich.kind === 'goal' ? (
              <span style={{
                fontSize: 11, color: stepzTokens.textDim,
                padding: '5px 11px', borderRadius: 999,
                border: `1px solid ${stepzTokens.border}`,
              }}>Medalha na parede</span>
            ) : null}
            {rich.kind === 'task' ? (
              <>
                <span style={{
                  fontSize: 11, color: stepzTokens.textDim,
                  padding: '5px 11px', borderRadius: 999,
                  border: `1px solid ${stepzTokens.border}`,
                  maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }} title={rich.project}>Projeto: {rich.project}</span>
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
  const dates = new Set(steps.map(s => s.completedAt.slice(0, 10)));
  let streak = 0;
  let d = new Date();
  while (dates.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  // If today is not done but yesterday is, still count from yesterday
  if (streak === 0) {
    d = new Date();
    d.setDate(d.getDate() - 1);
    while (dates.has(d.toISOString().slice(0, 10))) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
  }
  return streak;
}
function computeHabitStreak(history) {
  if (!history || history.length === 0) return 0;
  const set = new Set(history);
  let streak = 0;
  let d = new Date();
  while (set.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  if (streak === 0) {
    d = new Date();
    d.setDate(d.getDate() - 1);
    while (set.has(d.toISOString().slice(0, 10))) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
  }
  return streak;
}
function formatDate(iso) {
  const d = new Date(iso);
  const today = todayStr();
  const ystr = (() => { const y = new Date(); y.setDate(y.getDate() - 1); return y.toISOString().slice(0, 10); })();
  if (iso === today) return 'Hoje';
  if (iso === ystr) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

ReactDOM.createRoot(document.getElementById('root')).render(<AppRoot />);
