// Stepz — functional web app
// Real tasks (persisted in localStorage), real habits with streaks,
// real staircase that grows when you complete a task.

const LS_KEY = 'stepz.v1';

/** Constrói a chave do localStorage por utilizador. Sem chave/utilizador devolve a chave legacy. */
function lsKeyForUser(userKey) {
  const k = String(userKey || '').trim().toLowerCase();
  return k ? `${LS_KEY}:${k}` : LS_KEY;
}

const LEVEL_META = [
  { n: 1, name: 'Despertar' },
  { n: 2, name: 'Ritmo' },
  { n: 3, name: 'Constância' },
  { n: 4, name: 'Profundidade' },
  { n: 5, name: 'Maestria' },
  { n: 6, name: 'Integração' },
  { n: 7, name: 'Expansão' },
  { n: 8, name: 'Plenitude' },
];
const STEPS_PER_LEVEL = 50;

const BASE_CATEGORIES = [
  { id: 'health', label: 'Saúde', color: 'oklch(0.70 0.15 145)' },
  { id: 'mind', label: 'Saúde Mental', color: 'oklch(0.72 0.13 230)' },
  { id: 'learn', label: 'Aprendizado', color: 'oklch(0.68 0.16 252)' },
  { id: 'career', label: 'Carreira', color: 'oklch(0.64 0.14 275)' },
  { id: 'relations', label: 'Relações', color: 'oklch(0.68 0.17 22)' },
  { id: 'reflect', label: 'Reflexão', color: 'oklch(0.72 0.12 180)' },
  { id: 'life', label: 'Vida', color: 'oklch(0.68 0.04 260)' },
];

/** Mesmos hex que TASK_TAG_COLOR_OPTIONS em app.jsx — legenda no hover da meta. */
const GOAL_PALETTE_HEX_LABELS = new Map([
  ['#383838', 'Padrão'],
  ['#5f5e5b', 'Cinza'],
  ['#523628', 'Marrom'],
  ['#a87626', 'Laranja'],
  ['#c49e02', 'Amarelo'],
  ['#366b52', 'Verde'],
  ['#286892', 'Azul'],
  ['#735491', 'Roxo'],
  ['#9f4176', 'Rosa'],
  ['#a73d3d', 'Vermelho'],
]);
function goalPaletteHoverLabel(hex) {
  const k = String(hex || '').trim().toLowerCase();
  return GOAL_PALETTE_HEX_LABELS.get(k) || 'Cor';
}

function mergeCategoryLists(base, extra) {
  const map = new Map();
  base.forEach(c => map.set(c.id, { ...c }));
  (extra || []).forEach(c => {
    if (!c?.id) return;
    map.set(c.id, { ...map.get(c.id), ...c });
  });
  return [...map.values()];
}

/** Alias legado — lista base (seed). Preferir `state.categories` no app. */
const CATEGORIES = BASE_CATEGORIES;

const todayStr = () => new Date().toISOString().slice(0, 10);

function loadState(userKey) {
  const storageKey = lsKeyForUser(userKey);
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    const merged = { ...defaultState(), ...s };
    merged.categories = mergeCategoryLists(BASE_CATEGORIES, merged.categories);
    if (!Array.isArray(merged.goals)) merged.goals = [];
    merged.goals = merged.goals.filter(Boolean).map((g) => ({
      ...g,
      milestones: Array.isArray(g.milestones)
        ? g.milestones.map((m) => ({
          id: m.id || cryptoId(),
          title: String(m.title || '').trim(),
          done: !!m.done,
        })).filter((m) => m.title)
        : [],
    }));
    if (Array.isArray(merged.steps)) {
      merged.steps = merged.steps
        .filter(Boolean)
        .map((st) => (st.id ? st : { ...st, id: cryptoId() }));
    }
    /* Estados antigos não tinham `projectOrder`. Derivamos da ordem em que os projetos aparecem
       nas tasks, para que o utilizador não veja a lista a saltar na primeira execução. */
    if (!Array.isArray(merged.projectOrder)) merged.projectOrder = [];
    if (Array.isArray(merged.tasks) && merged.tasks.length > 0) {
      const known = new Set(merged.projectOrder);
      for (const t of merged.tasks) {
        const p = String((t && t.project) || '').trim();
        if (p && !known.has(p)) {
          merged.projectOrder.push(p);
          known.add(p);
        }
      }
    }
    if (!merged.projectColors || typeof merged.projectColors !== 'object' || Array.isArray(merged.projectColors)) {
      merged.projectColors = {};
    }
    return merged;
  } catch (e) { return defaultState(); }
}

function dateOffsetStr(offsetDays) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Metas de demonstração — também usadas quando o estado guardado tem lista vazia. */
function exampleGoalsSeed() {
  return [
    {
      id: cryptoId(),
      title: 'Aprender React avançado',
      description: 'Dominar hooks, contexto e performance para projetos reais.',
      category: 'career',
      targetDate: dateOffsetStr(90),
      durationDays: 45,
      completed: false,
      milestones: [
        { id: cryptoId(), title: 'Curso de fundamentos concluído', done: true },
        { id: cryptoId(), title: 'Projeto prático com estado complexo', done: true },
        { id: cryptoId(), title: 'Publicar portfólio com 3 apps React', done: false },
        { id: cryptoId(), title: 'Contribuir para um projeto open source', done: false },
      ],
    },
    {
      id: cryptoId(),
      title: 'Rotina de sono de qualidade',
      description: 'Acordar descansado — menos telas à noite e horário fixo.',
      category: 'health',
      targetDate: dateOffsetStr(21),
      durationDays: 30,
      completed: false,
      milestones: [
        { id: cryptoId(), title: 'Definir horário fixo de dormir/acordar', done: true },
        { id: cryptoId(), title: '14 dias seguidos sem celular na cama', done: false },
        { id: cryptoId(), title: 'Registrar energia ao longo de uma semana', done: false },
      ],
    },
    {
      id: cryptoId(),
      title: 'Ler 12 livros no ano',
      description: 'Um livro por mês — ficção e não ficção.',
      category: 'learn',
      targetDate: dateOffsetStr(245),
      durationDays: 365,
      completed: false,
      milestones: [
        { id: cryptoId(), title: 'Escolher lista inicial de títulos', done: true },
        { id: cryptoId(), title: 'Livro 1 terminado', done: false },
        { id: cryptoId(), title: 'Livro 2 terminado', done: false },
        { id: cryptoId(), title: 'Metade do ano — 6 livros', done: false },
      ],
    },
  ];
}

function defaultState() {
  return {
    createdAt: todayStr(),
    categories: BASE_CATEGORIES.map(c => ({ ...c })),
    tasks: [],
    habits: [],
    /** Cada step é {taskId, title, category, completedAt}. */
    steps: [],
    /** Mapa tag (texto exato após trim) → cor CSS; usado na lista de tasks. */
    taskTagColors: {},
    /** Metas de médio/longo prazo: marcos e progresso derivado. */
    goals: [],
    postits: [],
    /** Ordem manual dos projetos (nomes únicos). Drives groupTasksByProject. */
    projectOrder: [],
    /** Nome do projeto (após trim) → cor CSS (#hex). Sobrepõe a cor automática dos degraus. */
    projectColors: {},
  };
}
function cryptoId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function saveState(userKey, s) {
  /* Retrocompatibilidade: se chamado como saveState(state) (uma única arg objeto), grava na chave legacy. */
  if (s === undefined && userKey && typeof userKey === 'object') {
    try { localStorage.setItem(LS_KEY, JSON.stringify(userKey)); } catch (e) {}
    return;
  }
  const storageKey = lsKeyForUser(userKey);
  try { localStorage.setItem(storageKey, JSON.stringify(s)); } catch (e) {}
}

// ── Layout math (zoomable staircase) ──
const BASE_STEP_W = 16;
const BASE_STEP_H = 12;
const LANDING_W = 36;
const PAD = 80;
/** Múltiplos de 10: patamar largura ×2 + cor dourada (prioridade máxima). */
const STAIRS_DECADE_N = 10;
/** Ouro para marcos de 10 degraus — sempre ganha da cor da categoria. */
const STAIRS_GOLD_FILL = 'url(#stepzStairGold)';
const STAIRS_GOLD_RISER = 'oklch(0.52 0.06 78)';
const STAIRS_GOLD_TEXT = '#0a0a0b';
/** Tom central do gradiente dourado do tread — modal de hábito nos marcos ×10. */
const STAIRS_MODAL_GOLD_ACCENT = '#e9c04a';

function stepX(i, stepW, landingW) {
  const landings = Math.floor(i / STEPS_PER_LEVEL);
  return PAD + i * stepW + landings * landingW;
}

function stairIsDecade(i) {
  return (i + 1) % STAIRS_DECADE_N === 0;
}

/** Largura horizontal deste degrau (marcos ×2). `stepW` já pode estar escalada pelo zoom. */
function stairStrideWidth(i, stepW) {
  return stairIsDecade(i) ? stepW * 2 : stepW;
}

/** Origem X à esquerda do degrau `i`. */
function stairStepLeftX(i, stepW, landingW) {
  let x = PAD;
  for (let j = 0; j < i; j++) {
    x += stairStrideWidth(j, stepW);
    if ((j + 1) % STEPS_PER_LEVEL === 0) x += landingW;
  }
  return x;
}

/** Extremidade direita do trecho desenhado após o último degrau `totalShown - 1` (+ patamares intermediários). */
function stairSpanRightX(totalShown, stepW, landingW) {
  let x = PAD;
  for (let j = 0; j < totalShown; j++) {
    x += stairStrideWidth(j, stepW);
    if ((j + 1) % STEPS_PER_LEVEL === 0) x += landingW;
  }
  return x;
}
function stepY(i, stepH, totalView) {
  // `stepY` retorna o TOPO do degrau (tread). O "chão" fica em `stepY(0) + stepH`.
  return PAD + (totalView - i - 1) * stepH;
}

function liveStairsCategoryRow(catId, categories) {
  const list = Array.isArray(categories) && categories.length ? categories : BASE_CATEGORIES;
  return list.find((c) => c.id === catId) || { id: catId, label: catId || '—', color: 'rgba(242,239,233,0.42)' };
}

/**
 * Cor determinística por nome de projeto. Hash simples sobre os char codes para escolher
 * uma entrada da paleta fixa. O mapa `overrides` (ex.: `state.projectColors`) substitui a cor
 * quando o utilizador define uma cor manual para aquele nome de projeto.
 */
const STEPZ_PROJECT_PALETTE = [
  '#7c5cff', // roxo Stepz
  '#286892', // azul
  '#366b52', // verde
  '#a87626', // âmbar
  '#9f4176', // rosa
  '#a73d3d', // vermelho
  '#735491', // lavender
  '#3d7a7a', // teal
  '#6b5f3c', // oliva
  '#523628', // marrom
];
function colorForProjectName(name, overrides) {
  const key = String(name || '').trim();
  if (!key) return STEPZ_PROJECT_PALETTE[0];
  if (overrides && typeof overrides === 'object' && overrides[key]) return overrides[key];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h + key.charCodeAt(i) * (i + 1)) % 2147483647;
  return STEPZ_PROJECT_PALETTE[Math.abs(h) % STEPZ_PROJECT_PALETTE.length];
}

/** Igual a `habitAccentCss` em app.jsx: cor explícita do hábito ou cor da categoria. */
function liveStairsHabitAccentFill(habit, categories, accentFallback) {
  if (!habit) return accentFallback;
  const hc = habit.color != null && String(habit.color).trim();
  if (hc) return String(habit.color).trim();
  const list = Array.isArray(categories) && categories.length ? categories : BASE_CATEGORIES;
  const defaultId = list[0]?.id || 'mind';
  const catId = habit.category || defaultId;
  const row = list.find((c) => c.id === catId) || list[0];
  return (row && row.color) ? row.color : accentFallback;
}

/** Cor do tread antes do override dourado dos marcos de 10 — mesma lógica que pinta cada degrau. */
function liveStairsStepBaseCatFill(stepData, habits, tasks, categories, projectColors, accentFallback) {
  if (!stepData) return accentFallback;
  if (stepData.color) return String(stepData.color).trim();
  if (stepData.taskId) {
    const projectName = String(stepData.project || '').trim();
    return projectName ? colorForProjectName(projectName, projectColors) : accentFallback;
  }
  if (stepData.habitId) {
    const h = Array.isArray(habits) ? habits.find((x) => x.id === stepData.habitId) : null;
    return liveStairsHabitAccentFill(h, categories, accentFallback);
  }
  if (stepData.category) {
    return liveStairsCategoryRow(stepData.category, categories).color;
  }
  return accentFallback;
}

function liveStairsResolveRich(step, tasks, habits) {
  if (step?.completedGoalId) {
    const description = String(step.description || '').trim();
    const category = step.category;
    return {
      task: null,
      habit: null,
      description,
      tags: [],
      priorityLabel: '',
      dueDate: '',
      project: '',
      category,
      kind: 'goal',
    };
  }
  const task = step?.taskId && Array.isArray(tasks) ? tasks.find((t) => t.id === step.taskId) : null;
  const habit = step?.habitId && Array.isArray(habits) ? habits.find((h) => h.id === step.habitId) : null;
  const description = String((step?.description != null ? step.description : task?.description) || '').trim();
  const tags = Array.isArray(step?.tags) ? step.tags : (Array.isArray(task?.tags) ? [...task.tags] : []);
  const pid = step?.priority || task?.priority || '';
  const priorityLabel = pid === 'low' ? 'Baixa' : pid === 'medium' ? 'Media' : pid === 'high' ? 'Alta' : '';
  const dueDate = step?.dueDate || task?.dueDate || '';
  const project = String(step?.project ?? task?.project ?? '').trim();
  const category = habit ? undefined : (step?.category || task?.category);
  const kind = step?.taskId ? 'task' : step?.habitId ? 'habit' : 'other';
  return {
    task, habit, description, tags, priorityLabel, dueDate, project, category, kind,
  };
}

function liveStairsTagChipColor(tag, tagColors) {
  const key = String(tag || '').trim();
  if (!key) return '#383838';
  const custom = tagColors && tagColors[key];
  if (custom) return custom;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h + key.charCodeAt(i) * (i + 1)) % 2147483647;
  const palette = ['#383838', '#5f5e5b', '#366b52', '#286892', '#735491', '#a73d3d'];
  return palette[Math.abs(h) % palette.length];
}

// ═══════════════════════════════════════════════════════════
// Live zoomable staircase — grows with state.steps
// ═══════════════════════════════════════════════════════════
function LiveStairs({
  steps,
  onStepClick,
  tasks = [],
  habits = [],
  categories,
  taskTagColors = {},
  projectColors = {},
  layoutCompact = false,
}) {
  const containerRef = React.useRef(null);
  /* Inicia com 0×0 para que o efeito de "primeira centralização" só dispare depois
     de o ResizeObserver medir o tamanho real do contentor. Sem isto, em ecrãs estreitos
     a inicialização corria com 900×460 (default antigo) e a escada ficava fora do viewport. */
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [hover, setHover] = React.useState(null);

  const zoomRef = React.useRef(zoom);
  const panRef = React.useRef(pan);
  React.useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  React.useEffect(() => { panRef.current = pan; }, [pan]);

  // The staircase always shows at least the next level's worth so there's
  // visible "future" above the user's current step.
  const totalShown = Math.max(STEPS_PER_LEVEL, Math.ceil((steps.length + 10) / STEPS_PER_LEVEL) * STEPS_PER_LEVEL);
  const currentIdx = steps.length;

  // Measure
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fitToView = React.useCallback((w, h) => {
    if (w < 50 || h < 50) return { z: 1, px: 0, py: 0 };
    const naturalW = stairSpanRightX(totalShown, BASE_STEP_W, LANDING_W) - PAD + 60;
    const naturalH = stepY(0, BASE_STEP_H, totalShown) + BASE_STEP_H + 40;
    const zFit = Math.min((w - 80) / naturalW, (h - 80) / naturalH);
    const z = Math.max(0.25, Math.min(1.2, zFit));
    const scaledW = naturalW * z;
    const scaledH = naturalH * z;
    return { z, px: (w - scaledW) / 2, py: h - scaledH - 20 };
  }, [totalShown]);

  /** Primeira pintura: zoom tipo “detalhes” e último degrau ativo centrado no SVG (igual uso típico ~237%). */
  const initialViewportLastStep = React.useCallback((w, h) => {
    if (w < 50 || h < 80) return { z: 1, px: 0, py: 0 };
    const svgH = Math.max(80, h - 60);
    const n = steps.length;
    const focusIdx = n > 0 ? n - 1 : 0;
    let z = 2.35;
    if (w < 420) z = Math.max(1.65, z - 0.45);
    z = Math.max(1.45, Math.min(3.5, z));
    const sw = BASE_STEP_W * z;
    const sh = BASE_STEP_H * z;
    const lw = LANDING_W * z;
    const cx = stairStepLeftX(focusIdx, sw, lw) + stairStrideWidth(focusIdx, sw) / 2;
    const cy = stepY(focusIdx, sh, totalShown) + sh / 2;
    return {
      z,
      px: w / 2 - cx,
      py: svgH / 2 - cy,
    };
  }, [steps.length, totalShown]);

  const didInit = React.useRef(false);
  React.useEffect(() => {
    if (didInit.current || size.w < 50) return;
    didInit.current = true;
    const f = initialViewportLastStep(size.w, size.h);
    zoomRef.current = f.z; panRef.current = { x: f.px, y: f.py };
    setZoom(f.z); setPan({ x: f.px, y: f.py });
  }, [size.w, size.h, initialViewportLastStep]);

  const stepW = BASE_STEP_W * zoom;
  const stepH = BASE_STEP_H * zoom;
  const landingW = LANDING_W * zoom;
  const lod = zoom < 0.6 ? 'far' : zoom < 1.3 ? 'mid' : 'close';

  const zoomAt = (cx, cy, factor) => {
    const z0 = zoomRef.current;
    const p0 = panRef.current;
    const next = Math.max(0.22, Math.min(6, z0 * factor));
    const k = next / z0;
    const newPan = { x: cx - (cx - p0.x) * k, y: cy - (cy - p0.y) * k };
    zoomRef.current = next; panRef.current = newPan;
    setZoom(next); setPan(newPan);
  };
  const zoomOnCurrent = (factor) => {
    const z0 = zoomRef.current;
    const p0 = panRef.current;
    const sw = BASE_STEP_W * z0, sh = BASE_STEP_H * z0, lw = LANDING_W * z0;
    const i = Math.max(0, currentIdx - 1);
    const cxWorld = stairStepLeftX(i, sw, lw) + stairStrideWidth(i, sw) / 2;
    const cyWorld = stepY(i, sh, totalShown) + sh / 2;
    zoomAt(p0.x + cxWorld, p0.y + cyWorld, factor);
  };

  // Wheel
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const cx = e.clientX - r.left, cy = e.clientY - r.top;
      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 30) {
        zoomAt(cx, cy, Math.exp(-e.deltaY * 0.0025));
      } else {
        setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Drag
  const dragging = React.useRef(null);
  const onPointerDown = (e) => {
    if (e.target.closest('[data-step]')) return;
    dragging.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragging.current) return;
    const d = dragging.current;
    setPan({ x: d.px + (e.clientX - d.x), y: d.py + (e.clientY - d.y) });
  };
  const onPointerUp = () => { dragging.current = null; };

  const baseY = stepY(0, stepH, totalShown) + stepH;
  const elements = [];

  // Hill outline at far zoom
  if (lod === 'far' && totalShown > 0) {
    let d = `M ${PAD} ${baseY}`;
    for (let i = 0; i < totalShown; i++) {
      const x1 = stairStepLeftX(i, stepW, landingW);
      const wi = stairStrideWidth(i, stepW);
      const y1 = stepY(i, stepH, totalShown);
      d += ` L ${x1} ${y1} L ${x1 + wi} ${y1}`;
      if ((i + 1) % STEPS_PER_LEVEL === 0) d += ` L ${x1 + wi + landingW} ${y1}`;
    }
    d += ` L ${stairSpanRightX(totalShown, stepW, landingW)} ${baseY} Z`;
    elements.push(<path key="hill" d={d} fill="url(#hatchLive)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />);
  }

  // Steps
  for (let i = 0; i < totalShown; i++) {
    const x = stairStepLeftX(i, stepW, landingW);
    const w = stairStrideWidth(i, stepW);
    const y = stepY(i, stepH, totalShown);
    const completed = i < currentIdx;
    const isLastInLevel = (i + 1) % STEPS_PER_LEVEL === 0;
    const isDecade = stairIsDecade(i);

    const stepData = completed ? steps[i] : null;
    const isGoalStep = !!(completed && stepData?.completedGoalId);
    const accentFallback = typeof stepzTokens !== 'undefined' ? stepzTokens.accent : '#7c5cff';
    const catFill = !completed || !stepData
      ? accentFallback
      : liveStairsStepBaseCatFill(stepData, habits, tasks, categories, projectColors, accentFallback);

    let treadFill;
    let riserFill;
    let riserStroke = 'rgba(255,255,255,0.06)';
    if (!completed) {
      treadFill = 'rgba(255,255,255,0.08)';
      riserFill = 'rgba(255,255,255,0.02)';
    } else if (isDecade) {
      treadFill = STAIRS_GOLD_FILL;
      riserFill = STAIRS_GOLD_RISER;
      riserStroke = 'rgba(0,0,0,0.18)';
    } else if (isGoalStep) {
      treadFill = catFill;
      riserFill = `color-mix(in oklch, ${catFill} 36%, oklch(0.12 0.03 285))`;
      riserStroke = 'rgba(255,255,255,0.1)';
    } else {
      treadFill = catFill;
      riserFill = 'rgba(255,255,255,0.035)';
      riserStroke = 'rgba(255,255,255,0.08)';
    }

    const treadH = Math.max(2, stepH * 0.35);
    const riserH = stepH - treadH;

    /** Número na face frontal (riser): fundo escuro pede texto claro; marco dourado usa tons âmbar. */
    const riserLabelFill = !completed ? 'rgba(255,255,255,0.28)'
      : isDecade ? 'rgba(255, 236, 190, 0.95)'
        : 'rgba(255,255,255,0.52)';

    elements.push(
      <g key={`s-${i}`} data-step={i}
        style={{ cursor: completed ? 'pointer' : 'default' }}
        onMouseEnter={(e) => {
          if (!completed) return;
          const r = containerRef.current.getBoundingClientRect();
          setHover({ i, x: e.clientX - r.left, y: e.clientY - r.top });
        }}
        onMouseMove={(e) => {
          if (!completed) return;
          const r = containerRef.current.getBoundingClientRect();
          setHover({ i, x: e.clientX - r.left, y: e.clientY - r.top });
        }}
        onMouseLeave={() => setHover(null)}
        onClick={() => completed && onStepClick && onStepClick(i)}
      >
        <rect x={x} y={y} width={w} height={stepH} fill="transparent" />
        <rect x={x} y={y} width={w} height={treadH} fill={treadFill} opacity={completed ? 1 : 0.5} />
        {stepH > 6 && (
          <rect x={x} y={y + treadH} width={w} height={riserH}
            fill={riserFill}
            stroke={riserStroke} strokeWidth={stepH > 14 ? 1 : 0.5} />
        )}
        {completed && isGoalStep && (() => {
          const medalW = Math.min(Math.max(w * 0.92, 38), 78);
          const medalH = medalW * (180 / 120);
          const gid = `g${i}`;
          const shadowRy = Math.max(4, medalW * 0.06);
          return (
            <g transform={`translate(${x + w / 2}, ${y - Math.max(3, stepH * 0.12)})`} pointerEvents="none">
              <ellipse cx="0" cy={-(shadowRy * 0.35)} rx={medalW * 0.38} ry={shadowRy} fill="rgba(0,0,0,0.38)" />
              <svg x={-medalW / 2} y={-medalH} width={medalW} height={medalH} viewBox="0 0 120 180" overflow="visible">
                <defs>
                  <linearGradient id={`goalGoldStar-${gid}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#f6d365" />
                    <stop offset="1" stopColor="#b8853a" />
                  </linearGradient>
                  <radialGradient id={`goalShineStar-${gid}`} cx="0.3" cy="0.3" r="0.7">
                    <stop offset="0" stopColor="#fff5d4" stopOpacity="0.6" />
                    <stop offset="1" stopColor="#fff5d4" stopOpacity="0" />
                  </radialGradient>
                </defs>
                <g transform="translate(60, 10)">
                  <g>
                    <animateTransform
                      attributeName="transform"
                      type="rotate"
                      values="-11;11;-11"
                      dur="2.2s"
                      repeatCount="indefinite"
                      calcMode="spline"
                      keyTimes="0;0.5;1"
                      keySplines="0.42 0 0.58 1;0.42 0 0.58 1"
                    />
                    <g transform="translate(-60, -10)">
                      <circle cx="60" cy="10" r="2" fill="#999" />
                      <path d="M 40 10 L 80 10 L 70 65 L 60 57 L 50 65 Z" fill={catFill} />
                      <path d="M 60 10 L 80 10 L 70 65 L 60 57 Z" fill="#000" opacity="0.32" />
                      <g transform="translate(60, 90)">
                        <polygon
                          points="0,-26 7,-8 26,-8 11,4 17,22 0,12 -17,22 -11,4 -26,-8 -7,-8"
                          fill={`url(#goalGoldStar-${gid})`}
                          stroke="#7a5424"
                          strokeWidth="1"
                        />
                        <polygon
                          points="0,-18 4,-5 16,-5 7,3 10,15 0,8 -10,15 -7,3 -16,-5 -4,-5"
                          fill={`url(#goalShineStar-${gid})`}
                        />
                        <text y="3" textAnchor="middle" fontFamily={stepzTokens.fontMono} fontSize="9" fontWeight="700" fill="#3a2410">
                          {i + 1}
                        </text>
                      </g>
                    </g>
                  </g>
                </g>
              </svg>
            </g>
          );
        })()}
        {lod === 'close' && completed && stepData && stepH > 10 && riserH > 4 && (
          <text
            x={x + w / 2}
            y={y + treadH + riserH / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={Math.max(8, Math.min(13, riserH * 0.62, w * 0.2))}
            fill={riserLabelFill}
            fontFamily={stepzTokens.fontMono}
            fontWeight={600}>
            {`#${i + 1}`}
          </text>
        )}
      </g>
    );

    // Landing
    if ((i + 1) % STEPS_PER_LEVEL === 0 && i < totalShown - 1) {
      const lx = x + w;
      const ly = stepY(i + 1, stepH, totalShown);
      const levelN = Math.floor((i + 1) / STEPS_PER_LEVEL);
      const levelDone = completed;
      const landingAccent = typeof stepzTokens !== 'undefined' ? stepzTokens.warn : 'oklch(0.82 0.14 88)';
      elements.push(
        <g key={`L-${i}`}>
          <rect x={lx} y={ly} width={landingW} height={treadH}
            fill={levelDone ? landingAccent : 'rgba(255,255,255,0.15)'} />
          <rect x={lx} y={ly + treadH} width={landingW} height={Math.max(4, stepH * 0.7)}
            fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          <g transform={`translate(${lx + landingW / 2}, ${ly - 18})`}>
            <circle r="12" fill={levelDone ? landingAccent : 'rgba(255,255,255,0.1)'}
              stroke={levelDone ? 'none' : 'rgba(255,255,255,0.2)'} strokeWidth="1" />
            <text textAnchor="middle" y="4" fontSize="11" fontWeight="700"
              fill={levelDone ? '#0a0a0b' : stepzTokens.textDim} fontFamily={stepzTokens.font}>
              {levelN}
            </text>
          </g>
          {lod === 'far' && (
            <text x={lx + landingW / 2} y={ly - 36} textAnchor="middle"
              fontSize="10" fill={stepzTokens.textDim} fontFamily={stepzTokens.font} fontWeight="500">
              {LEVEL_META[levelN - 1]?.name}
            </text>
          )}
        </g>
      );
    }

    if (lod === 'mid' && completed && (i + 1) % 10 === 0 && !isLastInLevel) {
      elements.push(
        <text key={`m-${i}`} x={x + w / 2} y={y - 8} textAnchor="middle"
          fontSize="9" fill="rgba(255,255,255,0.4)" fontFamily={stepzTokens.fontMono}>{i + 1}</text>
      );
    }
  }

  // Figura no degrau: emoji homem caminhando; espelho horizontal para seguir +x (subida da escada).
  const walkerEmojiFont = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  const walkerFig = (fx, fy, figScale, opacity = 1) => (
    <g key="fig" transform={`translate(${fx}, ${fy}) scale(${figScale})`} opacity={opacity}>
      <text
        x={0}
        y={0}
        textAnchor="middle"
        dominantBaseline="central"
        transform="scale(-1, 1)"
        fontSize={28}
        style={{ fontFamily: walkerEmojiFont }}
      >
        {'🚶‍♂️'}
      </text>
    </g>
  );

  /** Ancoragem acima do espelho do degrau para o emoji não “afundar” no tread. */
  const walkerLift = Math.max(26, stepH * 1.08);
  if (currentIdx > 0) {
    const fi = currentIdx - 1;
    const fx = stairStepLeftX(fi, stepW, landingW) + stairStrideWidth(fi, stepW) / 2;
    const fy = stepY(currentIdx - 1, stepH, totalShown);
    const figScale = Math.max(0.55, Math.min(1.35, zoom));
    elements.push(walkerFig(fx, fy - walkerLift, figScale, 1));
  } else {
    const fx = PAD - 14;
    const fy = baseY;
    elements.push(walkerFig(fx, fy - walkerLift, 1, 0.72));
  }

  const hoverData = hover && hover.i < currentIdx ? steps[hover.i] : null;
  const hoverRich = hoverData ? liveStairsResolveRich(hoverData, tasks, habits) : null;
  const hoverCat = hoverRich && hoverRich.kind !== 'habit'
    ? liveStairsCategoryRow(hoverRich.category, categories)
    : null;
  const hoverPaletteHex = hoverData?.color ? String(hoverData.color).trim() : '';
  const hoverUsePalette = !!(hoverPaletteHex && (hoverRich?.kind === 'goal' || hoverRich?.kind === 'habit'));
  const hoverIsHabit = hoverRich?.kind === 'habit';
  const accentFallbackHover = typeof stepzTokens !== 'undefined' ? stepzTokens.accent : '#7c5cff';
  const hoverStepBaseFill = hoverData
    ? liveStairsStepBaseCatFill(hoverData, habits, tasks, categories, projectColors, accentFallbackHover)
    : accentFallbackHover;
  const hoverHabitDecade = !!(hoverIsHabit && hover != null && stairIsDecade(hover.i));
  const hoverHabitAccent = hoverIsHabit
    ? (hoverHabitDecade ? STAIRS_MODAL_GOLD_ACCENT : hoverStepBaseFill)
    : '';
  const hoverHabitModalBg = hoverIsHabit && hoverHabitAccent
    ? `linear-gradient(168deg, color-mix(in srgb, ${hoverHabitAccent} 28%, rgb(8,8,11)) 0%, rgb(9,9,11) 50%, rgb(10,10,12) 100%)`
    : 'rgba(10,10,12,0.96)';
  /* Tasks: chip = projeto. Metas: chip = paleta ou categoria. Hábitos: sem chip — cor só no modal. */
  const hoverIsTask = hoverRich?.kind === 'task';
  const hoverProjectName = hoverIsTask ? String(hoverRich?.project || '').trim() : '';
  let hoverChipBg;
  let hoverChipLabel;
  if (hoverIsHabit) {
    hoverChipBg = '';
    hoverChipLabel = '';
  } else if (hoverUsePalette) {
    hoverChipBg = hoverPaletteHex;
    hoverChipLabel = goalPaletteHoverLabel(hoverPaletteHex);
  } else if (hoverIsTask && hoverProjectName) {
    hoverChipBg = colorForProjectName(hoverProjectName, projectColors);
    hoverChipLabel = hoverProjectName;
  } else {
    hoverChipBg = hoverCat?.color ?? 'rgba(242,239,233,0.42)';
    hoverChipLabel = hoverCat?.label ?? '—';
  }
  const hoverShowMainChip = !hoverIsHabit && !!hoverChipLabel && hoverChipLabel !== '—';
  const currentLevel = Math.floor(currentIdx / STEPS_PER_LEVEL) + 1;
  const stepsInLevel = currentIdx % STEPS_PER_LEVEL;

  return (
    <div style={{
      background: stepzTokens.panel,
      border: `1px solid ${stepzTokens.border}`,
      borderRadius: 16,
      overflow: 'hidden',
      position: 'relative',
      height: layoutCompact ? 'clamp(280px, 46vh, 420px)' : 500,
      display: 'flex', flexDirection: 'column',
      minWidth: 0,
    }}>
      <div style={{
        display: 'flex',
        alignItems: layoutCompact ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        flexWrap: layoutCompact ? 'wrap' : 'nowrap',
        gap: layoutCompact ? 10 : 0,
        rowGap: layoutCompact ? 10 : undefined,
        padding: layoutCompact ? '14px 14px 12px' : '18px 22px 14px',
        borderBottom: `1px solid ${stepzTokens.border}`,
      }}>
        <div style={{ flex: layoutCompact ? '1 1 100%' : 'none', minWidth: 0 }}>
          <div style={{ fontSize: 11, color: stepzTokens.textDim, letterSpacing: 0.5, textTransform: 'uppercase' }}>sua escada</div>
          <div style={{
            fontSize: layoutCompact ? 17 : 22,
            fontWeight: 600,
            letterSpacing: -0.6,
            marginTop: 2,
            lineHeight: 1.25,
          }}>
            {currentIdx} {currentIdx === 1 ? 'degrau' : 'degraus'} ·{' '}
            <span style={{ color: stepzTokens.accent, fontWeight: 600 }}>
              Nível {currentLevel} · {LEVEL_META[currentLevel - 1]?.name || '—'}
            </span>
          </div>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: layoutCompact ? 6 : 8,
          flexWrap: layoutCompact ? 'wrap' : 'nowrap',
          justifyContent: layoutCompact ? 'flex-end' : 'flex-start',
          flex: layoutCompact ? '1 1 auto' : 'none',
          marginLeft: layoutCompact ? 'auto' : undefined,
        }}>
          <div style={{ fontSize: 11, color: stepzTokens.textFaint, marginRight: 6, fontFamily: stepzTokens.fontMono }}>
            {lod === 'far' ? 'visão geral' : lod === 'mid' ? 'níveis' : 'detalhes'}
          </div>
          <ZoomBtn onClick={() => zoomOnCurrent(0.75)}>−</ZoomBtn>
          <div style={{
            width: 56, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.04)', borderRadius: 6,
            fontSize: 12, color: stepzTokens.textDim, fontFamily: stepzTokens.fontMono,
          }}>{Math.round(zoom * 100)}%</div>
          <ZoomBtn onClick={() => zoomOnCurrent(1.4)}>+</ZoomBtn>
          <ZoomBtn onClick={() => {
            const f = fitToView(size.w, size.h);
            zoomRef.current = f.z; panRef.current = { x: f.px, y: f.py };
            setZoom(f.z); setPan({ x: f.px, y: f.py });
          }} wide>ajustar</ZoomBtn>
        </div>
      </div>

      <div ref={containerRef}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        style={{
          flex: 1, position: 'relative', overflow: 'hidden',
          cursor: dragging.current ? 'grabbing' : 'grab', touchAction: 'none',
          background: `radial-gradient(ellipse at 70% 30%, oklch(0.28 0.075 252 / 0.22), transparent 62%)`,
        }}>
        <svg width={size.w} height={Math.max(0, size.h - 60)} style={{ display: 'block', userSelect: 'none' }}>
          <defs>
            <linearGradient id="stepzStairGold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f7ebb8" />
              <stop offset="42%" stopColor="#e9c04a" />
              <stop offset="100%" stopColor="#b8892a" />
            </linearGradient>
            <pattern id="hatchLive" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(-45)">
              <line x1="0" y1="0" x2="0" y2="7" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            </pattern>
          </defs>
          <g transform={`translate(${pan.x}, ${pan.y})`}>
            <line x1={PAD - 40} y1={baseY} x2={stairSpanRightX(totalShown, stepW, landingW) + 40} y2={baseY} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
            {elements}
          </g>
        </svg>

        {hoverData && hoverRich && (
          <div style={{
            position: 'absolute',
            left: Math.min(hover.x + 14, Math.max(8, size.w - 304)),
            top: Math.max(hover.y - 72, 8),
            background: hoverHabitModalBg,
            border: `1px solid ${hoverIsHabit && hoverHabitAccent ? hoverHabitAccent : stepzTokens.borderStrong}`,
            borderRadius: 10, padding: '12px 14px',
            pointerEvents: 'none',
            boxShadow: hoverIsHabit && hoverHabitAccent
              ? `0 12px 44px rgba(0,0,0,0.58), 0 0 40px ${hoverHabitAccent}33`
              : '0 12px 44px rgba(0,0,0,0.55)',
            minWidth: 200, maxWidth: 300, zIndex: 2,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
              <div style={{
                fontSize: 10,
                color: hoverIsHabit && hoverHabitAccent ? hoverHabitAccent : stepzTokens.accent,
                letterSpacing: 0.45, textTransform: 'uppercase',
              }}>
                degrau {hover.i + 1}
              </div>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
                padding: '3px 8px', borderRadius: 999,
                border: `1px solid ${hoverIsHabit && hoverHabitAccent ? hoverHabitAccent : stepzTokens.border}`,
                color: hoverIsHabit && hoverHabitAccent ? hoverHabitAccent : stepzTokens.textDim,
                fontFamily: stepzTokens.fontMono,
                background: hoverIsHabit && hoverHabitAccent ? `${hoverHabitAccent}14` : 'transparent',
              }}>
                {hoverRich.kind === 'goal' ? 'meta' : hoverRich.kind === 'habit' ? 'hábito' : hoverRich.kind === 'task' ? 'task' : '—'}
              </div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: stepzTokens.text, lineHeight: 1.25, marginBottom: 8 }}>
              {hoverData.title}
            </div>
            {(hoverShowMainChip || (hoverRich.kind === 'task' && hoverRich.priorityLabel)) ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: hoverRich.description ? 8 : 6 }}>
                {hoverShowMainChip ? (
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 999,
                    color: '#fff', background: hoverChipBg,
                    maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }} title={hoverChipLabel}>{hoverChipLabel}</span>
                ) : null}
                {hoverRich.kind === 'task' && hoverRich.priorityLabel ? (
                  <span style={{
                    fontSize: 10, color: stepzTokens.textDim,
                    padding: '3px 9px', borderRadius: 999, border: `1px solid ${stepzTokens.border}`,
                  }}>{hoverRich.priorityLabel}</span>
                ) : null}
              </div>
            ) : null}
            {hoverRich.description ? (
              <div style={{
                fontSize: 12, color: stepzTokens.textDim, lineHeight: 1.45,
                maxHeight: 120, overflow: 'auto',
                whiteSpace: 'pre-wrap',
                padding: '8px 10px', borderRadius: 8,
                border: `1px solid ${stepzTokens.border}`,
                background: 'rgba(255,255,255,0.03)',
                marginBottom: 8,
              }}>{hoverRich.description}</div>
            ) : null}
            {hoverRich.kind === 'task' && hoverRich.tags.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                {hoverRich.tags.slice(0, 8).map((tg) => (
                  <span key={tg} style={{
                    fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 999,
                    color: '#fff', background: liveStairsTagChipColor(tg, taskTagColors),
                    maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }} title={tg}>{tg}</span>
                ))}
              </div>
            ) : null}
            <div style={{ fontSize: 11, color: stepzTokens.textDim }}>
              {formatRelative(hoverData.completedAt)}
              {hoverRich.kind === 'task' && hoverRich.dueDate ? (
                <span style={{ display: 'block', marginTop: 4, color: stepzTokens.textFaint }}>
                  Prazo da task: {(() => {
                    const iso = hoverRich.dueDate;
                    const d = new Date(`${iso}T12:00:00`);
                    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
                  })()}
                </span>
              ) : null}
            </div>
          </div>
        )}

        {currentIdx === 0 && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
          }}>
            <div style={{
              background: 'rgba(10,10,12,0.85)', padding: '20px 28px', borderRadius: 12,
              border: `1px solid ${stepzTokens.border}`, textAlign: 'center', maxWidth: 360,
            }}>
              <div style={{ fontSize: 16, color: stepzTokens.text, fontWeight: 500, marginBottom: 6 }}>Sua escada começa aqui</div>
              <div style={{ fontSize: 13, color: stepzTokens.textDim, lineHeight: 1.5 }}>
                Cada task ou hábito que você completar vira um degrau. Comece marcando uma das tasks de hoje.
              </div>
            </div>
          </div>
        )}

        <div style={{
          position: 'absolute', left: 14, bottom: 12,
          fontSize: 10, color: stepzTokens.textFaint,
          fontFamily: stepzTokens.fontMono, letterSpacing: 0.3,
        }}>
          ⌘ + scroll · zoom · arraste p/ mover · passe o mouse p/ resumo · clique p/ detalhes
        </div>
      </div>
    </div>
  );
}

function ZoomBtn({ children, onClick, wide }) {
  return (
    <button onClick={onClick}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
      style={{
        border: `1px solid ${stepzTokens.border}`, background: 'rgba(255,255,255,0.04)',
        color: stepzTokens.text, borderRadius: 6, height: 28,
        width: wide ? 70 : 28, padding: 0,
        fontSize: wide ? 11 : 14, cursor: 'pointer',
        fontFamily: stepzTokens.font, transition: 'background .12s',
      }}>{children}</button>
  );
}

function formatRelative(iso) {
  if (!iso) return '';
  const then = new Date(iso);
  const now = new Date();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  if (diffHr < 24) return `há ${diffHr}h`;
  if (diffDay === 1) return 'ontem';
  if (diffDay < 30) return `há ${diffDay} dias`;
  return then.toLocaleDateString('pt-BR');
}

Object.assign(window, {
  LiveStairs, LEVEL_META, STEPS_PER_LEVEL, BASE_CATEGORIES, CATEGORIES,
  loadState, saveState, defaultState, cryptoId, todayStr, formatRelative,
  mergeCategoryLists,
});
