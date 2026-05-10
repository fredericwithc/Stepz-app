// Interactive zoomable staircase — blends direction B (task labels on steps)
// with C (landings/levels). Three "LOD" (levels-of-detail) swap smoothly
// based on zoom:
//   zoom < 0.7  → C-style: compact steps, visible landings + level badges
//   0.7 – 1.6   → hybrid: steps get taller, dates every 10 appear
//   zoom > 1.6  → B-style: each step shows task title + number on riser
//
// Controls: mouse wheel (cmd/ctrl+wheel for zoom), +/- buttons, drag to pan,
// fit button. Auto-centers on "today" on mount.

const LEVEL_META = [
  { n: 1, name: 'Despertar' },
  { n: 2, name: 'Ritmo' },
  { n: 3, name: 'Constância' },
  { n: 4, name: 'Profundidade' },
  { n: 5, name: 'Maestria' },
  { n: 6, name: 'Integração' },
  { n: 7, name: 'Expansão' },
];

// Sample task feed — cycles so all 300 steps have plausible labels
const TASK_CATALOG = [
  { t: 'Meditou 10min', c: 'Saúde Mental' },
  { t: 'Leu 20 páginas', c: 'Aprendizado' },
  { t: 'Treino de força', c: 'Saúde' },
  { t: 'Diário da manhã', c: 'Reflexão' },
  { t: 'Caminhada longa', c: 'Saúde' },
  { t: 'Código novo', c: 'Carreira' },
  { t: 'Ligou p/ mãe', c: 'Relações' },
  { t: 'Gratidão', c: 'Reflexão' },
  { t: 'Corrida 5km', c: 'Saúde' },
  { t: 'Estudou inglês', c: 'Aprendizado' },
  { t: 'Organizou finanças', c: 'Vida' },
  { t: 'Plano da semana', c: 'Vida' },
];

function taskFor(stepIdx) {
  const t = TASK_CATALOG[stepIdx % TASK_CATALOG.length];
  const daysAgo = 300 - stepIdx;
  return { title: t.t, category: t.c, daysAgo };
}

// ── Layout math — shared across LODs so zoom "feels" continuous ──
const TOTAL_STEPS = 300;
const STEPS_PER_LEVEL = 50;
const BASE_STEP_W = 14;   // step width at zoom=1 (wider → labels legible earlier)
const BASE_STEP_H = 10;   // step rise at zoom=1
const LANDING_W = 34;
const PAD = 80;

function stepX(i, stepW, landingW) {
  const landings = Math.floor(i / STEPS_PER_LEVEL);
  return PAD + i * stepW + landings * landingW;
}
function stepY(i, stepH) {
  return PAD + (TOTAL_STEPS - i) * stepH;
}

function ZoomableStairs({ currentIdx = 300 }) {
  const containerRef = React.useRef(null);
  const [size, setSize] = React.useState({ w: 900, h: 500 });
  // Transform: we store base zoom (1..10), pan offset in view px.
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [hover, setHover] = React.useState(null); // {i, x, y}

  // Refs mirror state so event handlers always read fresh values — React
  // batches rapid button clicks, so reading `zoom`/`pan` from closure gives
  // stale values on the 2nd+ click. Refs sidestep that.
  const zoomRef = React.useRef(zoom);
  const panRef = React.useRef(pan);
  React.useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  React.useEffect(() => { panRef.current = pan; }, [pan]);

  // Measure container
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

  // ── Fit-to-view helper — computes zoom + pan so the whole staircase
  // fits with some padding, and the current step sits near the right edge.
  const fitToView = React.useCallback((w, h) => {
    if (w < 50 || h < 50) return { z: 1, px: 0, py: 0 };
    // Staircase natural dimensions at zoom=1
    const naturalW = stepX(TOTAL_STEPS, BASE_STEP_W, LANDING_W) + 60;
    const naturalH = stepY(0, BASE_STEP_H) + 40;
    const zFit = Math.min((w - 80) / naturalW, (h - 80) / naturalH);
    const z = Math.max(0.22, Math.min(0.6, zFit));
    // Center staircase horizontally, anchor ground line at bottom
    const scaledW = naturalW * z;
    const scaledH = naturalH * z;
    const px = (w - scaledW) / 2;
    const py = h - scaledH - 20;
    return { z, px, py };
  }, []);

  // Initialize to fit-view on mount / when size becomes available.
  const didInit = React.useRef(false);
  React.useEffect(() => {
    if (didInit.current || size.w < 50) return;
    didInit.current = true;
    const f = fitToView(size.w, size.h);
    zoomRef.current = f.z;
    panRef.current = { x: f.px, y: f.py };
    setZoom(f.z);
    setPan({ x: f.px, y: f.py });
  }, [size.w, size.h, fitToView]);

  const stepW = BASE_STEP_W * zoom;
  const stepH = BASE_STEP_H * zoom;
  const landingW = LANDING_W * zoom;

  // Clamp pan so you can't fling the staircase entirely off-screen
  const totalW = stepX(TOTAL_STEPS, stepW, landingW) + 60;
  const totalH = stepY(0, stepH) + 40;

  // Determine LOD — by zoom alone, no stepW gate, so labels always appear
  // when the user zooms in past the threshold.
  const lod = zoom < 0.7 ? 'far' : zoom < 1.5 ? 'mid' : 'close';

  // Apply a zoom anchored at (cx, cy) in VIEW coordinates. Reads from refs
  // so rapid successive calls compose correctly.
  const zoomAt = (cx, cy, factor) => {
    const z0 = zoomRef.current;
    const p0 = panRef.current;
    const next = Math.max(0.22, Math.min(6, z0 * factor));
    const k = next / z0;
    const newPan = { x: cx - (cx - p0.x) * k, y: cy - (cy - p0.y) * k };
    zoomRef.current = next;
    panRef.current = newPan;
    setZoom(next);
    setPan(newPan);
  };

  // Zoom centered on the current step. Computes anchor using the ref-fresh
  // transform so multi-click chains stay locked on "today".
  const zoomOnCurrent = (factor) => {
    const z0 = zoomRef.current;
    const p0 = panRef.current;
    const sw = BASE_STEP_W * z0;
    const sh = BASE_STEP_H * z0;
    const lw = LANDING_W * z0;
    const cxWorld = stepX(currentIdx - 1, sw, lw) + sw / 2;
    const cyWorld = stepY(currentIdx - 1, sh) + sh / 2;
    const cxView = p0.x + cxWorld;
    const cyView = p0.y + cyWorld;
    zoomAt(cxView, cyView, factor);
  };

  // Wheel zoom + pan
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;
      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 30) {
        zoomAt(cx, cy, Math.exp(-e.deltaY * 0.0025));
      } else {
        setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Drag to pan
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
  const onPointerUp = (e) => { dragging.current = null; };

  // Build elements
  const baseY = stepY(0, stepH);
  const elements = [];

  // Hill outline (only visible at far zoom)
  if (lod === 'far') {
    let d = `M ${PAD} ${baseY}`;
    for (let i = 0; i < TOTAL_STEPS; i++) {
      const x1 = stepX(i, stepW, landingW);
      const y1 = stepY(i, stepH);
      const y2 = stepY(i + 1, stepH);
      d += ` L ${x1} ${y1} L ${x1 + stepW} ${y1}`;
      // landing
      if ((i + 1) % STEPS_PER_LEVEL === 0) {
        d += ` L ${x1 + stepW + landingW} ${y1}`;
      }
    }
    d += ` L ${stepX(TOTAL_STEPS, stepW, landingW)} ${baseY} Z`;
    elements.push(
      <path key="hill" d={d} fill="url(#hatchZ)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
    );
  }

  // Steps
  for (let i = 0; i < TOTAL_STEPS; i++) {
    const x = stepX(i, stepW, landingW);
    const y = stepY(i, stepH);
    const completed = i < currentIdx;
    const isCurrent = i === currentIdx - 1;
    const isMilestone = (i + 1) % 10 === 0 && !isCurrent;
    const isLastInLevel = (i + 1) % STEPS_PER_LEVEL === 0;

    const fill = isCurrent ? '#fff'
      : completed ? (isLastInLevel ? 'oklch(0.78 0.14 70)' : isMilestone ? 'oklch(0.73 0.1 55)' : 'oklch(0.68 0.18 280)')
      : 'rgba(255,255,255,0.09)';

    const treadH = Math.max(2, stepH * 0.35);
    const riserH = stepH - treadH;

    elements.push(
      <g key={`s-${i}`} data-step={i}
        style={{ cursor: 'pointer' }}
        onMouseEnter={(e) => {
          const r = containerRef.current.getBoundingClientRect();
          setHover({ i, x: e.clientX - r.left, y: e.clientY - r.top });
        }}
        onMouseLeave={() => setHover(null)}
      >
        {/* Hit area */}
        <rect x={x} y={y} width={stepW} height={stepH} fill="transparent" />
        {/* Tread */}
        <rect x={x} y={y} width={stepW} height={treadH} fill={fill} opacity={completed ? 1 : 0.5} />
        {/* Riser */}
        {stepH > 6 && (
          <rect x={x} y={y + treadH} width={stepW} height={riserH}
            fill={isCurrent ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.02)'}
            stroke="rgba(255,255,255,0.06)" strokeWidth={stepH > 14 ? 1 : 0.5} />
        )}

        {/* Current pulse */}
        {isCurrent && (
          <circle cx={x + stepW / 2} cy={y - Math.max(8, stepH * 0.8)} r="4" fill="#fff">
            <animate attributeName="opacity" values="1;0.3;1" dur="1.8s" repeatCount="indefinite" />
          </circle>
        )}

        {/* Close LOD: task label — scales with stepW, always rendered when close */}
        {lod === 'close' && completed && (
          <g>
            <text x={x + stepW / 2} y={y - 6} textAnchor="middle"
              fontSize={Math.max(8, Math.min(11, stepW * 0.32))}
              fill={isCurrent ? '#fff' : stepzTokens.textDim}
              fontFamily={stepzTokens.font}
              fontWeight={isCurrent ? 600 : 400}>
              {taskFor(i).title.length > 14 ? taskFor(i).title.slice(0, 13) + '…' : taskFor(i).title}
            </text>
            {stepH > 16 && (
              <text x={x + stepW / 2} y={y + stepH - 4} textAnchor="middle"
                fontSize={Math.max(7, Math.min(9, stepW * 0.22))}
                fill="rgba(255,255,255,0.3)"
                fontFamily={stepzTokens.fontMono}>
                #{i + 1}
              </text>
            )}
          </g>
        )}
      </g>
    );

    // Landing after every STEPS_PER_LEVEL
    if ((i + 1) % STEPS_PER_LEVEL === 0 && i < TOTAL_STEPS - 1) {
      const lx = x + stepW;
      const ly = stepY(i + 1, stepH); // flat at top of last step
      const levelN = Math.floor((i + 1) / STEPS_PER_LEVEL);
      const levelDone = completed;
      elements.push(
        <g key={`land-${i}`}>
          <rect x={lx} y={ly} width={landingW} height={treadH}
            fill={levelDone ? 'oklch(0.78 0.14 70)' : 'rgba(255,255,255,0.15)'} />
          <rect x={lx} y={ly + treadH} width={landingW} height={Math.max(4, stepH * 0.7)}
            fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          {/* Level badge */}
          {(lod !== 'close' || zoom < 2.5) && (
            <g transform={`translate(${lx + landingW / 2}, ${ly - 18})`}>
              <circle r="12" fill={levelDone ? 'oklch(0.78 0.14 70)' : 'rgba(255,255,255,0.1)'}
                stroke={levelDone ? 'none' : 'rgba(255,255,255,0.2)'} strokeWidth="1" />
              <text textAnchor="middle" y="4" fontSize="11" fontWeight="700"
                fill={levelDone ? '#0a0a0b' : stepzTokens.textDim} fontFamily={stepzTokens.font}>
                {levelN}
              </text>
            </g>
          )}
          {/* Level name label (far LOD) */}
          {lod === 'far' && (
            <text x={lx + landingW / 2} y={ly - 36} textAnchor="middle"
              fontSize="10" fill={stepzTokens.textDim} fontFamily={stepzTokens.font} fontWeight="500">
              {LEVEL_META[levelN - 1]?.name}
            </text>
          )}
        </g>
      );
    }

    // Milestone markers at mid zoom
    if (lod === 'mid' && completed && (i + 1) % 10 === 0 && !isLastInLevel) {
      elements.push(
        <text key={`m-${i}`} x={x + stepW / 2} y={y - 8} textAnchor="middle"
          fontSize="9" fill="rgba(255,255,255,0.4)" fontFamily={stepzTokens.fontMono}>
          {i + 1}
        </text>
      );
    }
  }

  // Figure at top (current)
  const fx = stepX(currentIdx - 1, stepW, landingW) + stepW / 2;
  const fy = stepY(currentIdx - 1, stepH);
  const figScale = Math.max(0.6, Math.min(1.4, zoom));
  elements.push(
    <g key="fig" transform={`translate(${fx}, ${fy - 8}) scale(${figScale})`}>
      <circle cx="0" cy="-16" r="4" fill="oklch(0.68 0.18 280)" />
      <line x1="0" y1="-12" x2="0" y2="-2" stroke="oklch(0.68 0.18 280)" strokeWidth="2" strokeLinecap="round" />
      <line x1="0" y1="-10" x2="-6" y2="-16" stroke="oklch(0.68 0.18 280)" strokeWidth="2" strokeLinecap="round" />
      <line x1="0" y1="-10" x2="6" y2="-16" stroke="oklch(0.68 0.18 280)" strokeWidth="2" strokeLinecap="round" />
      <line x1="0" y1="-2" x2="-3" y2="3" stroke="oklch(0.68 0.18 280)" strokeWidth="2" strokeLinecap="round" />
      <line x1="0" y1="-2" x2="3" y2="3" stroke="oklch(0.68 0.18 280)" strokeWidth="2" strokeLinecap="round" />
    </g>
  );

  // Hover tooltip
  const hoverData = hover && hover.i < currentIdx ? taskFor(hover.i) : null;

  return (
    <div style={{
      background: stepzTokens.panel,
      border: `1px solid ${stepzTokens.border}`,
      borderRadius: 16,
      overflow: 'hidden',
      position: 'relative',
      height: 540,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px', borderBottom: `1px solid ${stepzTokens.border}` }}>
        <div>
          <div style={{ fontSize: 11, color: stepzTokens.textDim, letterSpacing: 0.5, textTransform: 'uppercase' }}>sua escada</div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.6, marginTop: 2 }}>
            300 degraus · <span style={{ color: stepzTokens.accent, fontWeight: 600 }}>Nível 6 · Integração</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 11, color: stepzTokens.textFaint, marginRight: 6, fontFamily: stepzTokens.fontMono }}>
            {lod === 'far' ? 'visão geral' : lod === 'mid' ? 'níveis' : 'detalhes'}
          </div>
          <ZoomBtn onClick={() => zoomOnCurrent(0.75)}>−</ZoomBtn>
          <div style={{
            width: 60, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.04)', borderRadius: 6,
            fontSize: 12, color: stepzTokens.textDim, fontFamily: stepzTokens.fontMono,
          }}>{Math.round(zoom * 100)}%</div>
          <ZoomBtn onClick={() => zoomOnCurrent(1.4)}>+</ZoomBtn>
          <ZoomBtn onClick={() => {
            const f = fitToView(size.w, size.h);
            zoomRef.current = f.z;
            panRef.current = { x: f.px, y: f.py };
            setZoom(f.z);
            setPan({ x: f.px, y: f.py });
          }} wide>ajustar</ZoomBtn>
        </div>
      </div>

      {/* Viewport */}
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          flex: 1, position: 'relative', overflow: 'hidden',
          cursor: dragging.current ? 'grabbing' : 'grab',
          touchAction: 'none',
          background: `radial-gradient(ellipse at 70% 30%, oklch(0.22 0.08 280 / 0.25), transparent 60%)`,
        }}
      >
        <svg
          width={size.w} height={size.h - 60}
          style={{ display: 'block', userSelect: 'none' }}
        >
          <defs>
            <pattern id="hatchZ" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(-45)">
              <line x1="0" y1="0" x2="0" y2="7" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            </pattern>
          </defs>
          <g transform={`translate(${pan.x}, ${pan.y})`}>
            {/* Ground line */}
            <line x1={PAD - 40} y1={baseY} x2={totalW} y2={baseY} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
            {elements}
          </g>
        </svg>

        {/* Hover tooltip */}
        {hoverData && (
          <div style={{
            position: 'absolute',
            left: Math.min(hover.x + 14, size.w - 220),
            top: Math.max(hover.y - 60, 8),
            background: 'rgba(10,10,12,0.96)',
            border: `1px solid ${stepzTokens.borderStrong}`,
            borderRadius: 8, padding: '10px 12px',
            pointerEvents: 'none',
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
            minWidth: 180, maxWidth: 240, zIndex: 2,
          }}>
            <div style={{ fontSize: 10, color: stepzTokens.accent, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4 }}>
              degrau {hover.i + 1}
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: stepzTokens.text, marginBottom: 2 }}>
              {hoverData.title}
            </div>
            <div style={{ fontSize: 11, color: stepzTokens.textDim }}>
              {hoverData.category} · há {hoverData.daysAgo} {hoverData.daysAgo === 1 ? 'dia' : 'dias'}
            </div>
          </div>
        )}

        {/* Zoom hint (bottom-left) */}
        <div style={{
          position: 'absolute', left: 14, bottom: 12,
          fontSize: 10, color: stepzTokens.textFaint,
          fontFamily: stepzTokens.fontMono, letterSpacing: 0.3,
        }}>
          ⌘ + scroll · zoom · arraste p/ mover · hover p/ detalhes
        </div>

        {/* Mini-map (top-right) */}
        <MiniMap currentIdx={currentIdx} />
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
        border: `1px solid ${stepzTokens.border}`,
        background: 'rgba(255,255,255,0.04)',
        color: stepzTokens.text,
        borderRadius: 6,
        height: 28,
        width: wide ? 72 : 28,
        padding: 0,
        fontSize: wide ? 11 : 14,
        cursor: 'pointer',
        fontFamily: stepzTokens.font,
        transition: 'background .12s',
      }}>{children}</button>
  );
}

function MiniMap({ currentIdx }) {
  const W = 140, H = 46;
  // compress the 300 steps into a tiny silhouette
  const stepW = W / TOTAL_STEPS;
  const maxH = H - 6;
  const stepH = maxH / TOTAL_STEPS;
  const path = [`M 2 ${H - 2}`];
  for (let i = 0; i < TOTAL_STEPS; i++) {
    const x = 2 + i * stepW;
    const y = H - 2 - (i + 1) * stepH;
    path.push(`L ${x} ${y} L ${x + stepW} ${y}`);
  }
  path.push(`L ${W - 2} ${H - 2} Z`);
  const doneW = 2 + (currentIdx * stepW);
  return (
    <div style={{
      position: 'absolute', right: 14, top: 14,
      background: 'rgba(10,10,12,0.8)',
      border: `1px solid ${stepzTokens.border}`,
      borderRadius: 6,
      padding: 6, pointerEvents: 'none',
    }}>
      <svg width={W} height={H}>
        <clipPath id="miniClip">
          <rect x="0" y="0" width={doneW} height={H} />
        </clipPath>
        <path d={path.join(' ')} fill="rgba(255,255,255,0.06)" />
        <path d={path.join(' ')} fill="oklch(0.68 0.18 280)" clipPath="url(#miniClip)" />
        <circle cx={doneW - 2} cy={H - 2 - currentIdx * stepH} r="2.5" fill="#fff" />
      </svg>
      <div style={{ fontSize: 9, color: stepzTokens.textFaint, textAlign: 'center', marginTop: 2, fontFamily: stepzTokens.fontMono }}>
        300 / ∞
      </div>
    </div>
  );
}

function DashboardZoomable() {
  return (
    <div style={{ fontFamily: stepzTokens.font, background: stepzTokens.bg, color: stepzTokens.text, minHeight: '100%' }}>
      <TopBar />
      <div style={{ padding: 28, display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <ZoomableStairs currentIdx={300} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <StatTile compact label="Degraus" value="300" accent={stepzTokens.accent} />
            <StatTile compact label="Streak" value="1d" accent="oklch(0.78 0.14 70)" />
            <StatTile compact label="Jornada" value="385d" />
            <StatTile compact label="Conquistas" value="28" />
          </div>
          <Panel title="Tarefas de hoje" action="Ver todas →">
            {sampleTasks.slice(0, 5).map((t, i) => <TaskRow key={i} {...t} />)}
            <div style={{ marginTop: 10, padding: '10px 12px', background: stepzTokens.accentSoft, borderRadius: 8, fontSize: 12 }}>
              <strong style={{ color: stepzTokens.accent }}>Próximo patamar em 2 degraus.</strong> Você está no nível 6.
            </div>
          </Panel>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Panel title="Hábitos diários" action="Ver todos →">
            {sampleHabits.map((h, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0' }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: h.color, opacity: h.done ? 1 : 0.35 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13 }}>{h.title}</div>
                  <div style={{ fontSize: 11, color: stepzTokens.textFaint }}>{h.streak} dias</div>
                </div>
                {h.done && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke={stepzTokens.success} strokeWidth="2" strokeLinecap="round"><path d="M2 6l3 3 5-6" /></svg>}
              </div>
            ))}
          </Panel>
          <Panel title="Patamares">
            {LEVEL_META.slice(0, 6).map((l, i) => {
              const active = i === 5;
              const done = i < 5;
              return (
                <div key={l.n} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0',
                  borderBottom: i < 5 ? `1px solid ${stepzTokens.border}` : 'none',
                }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 13, flexShrink: 0,
                    background: done ? 'oklch(0.78 0.14 70)' : active ? stepzTokens.accent : 'rgba(255,255,255,0.08)',
                    color: done || active ? '#0a0a0b' : stepzTokens.textDim,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                  }}>{l.n}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: active ? 600 : 400,
                      color: done || active ? stepzTokens.text : stepzTokens.textFaint }}>
                      {l.name}
                    </div>
                    <div style={{ fontSize: 11, color: stepzTokens.textFaint }}>
                      {done ? 'completo' : active ? '50/50 em progresso' : `50 degraus`}
                    </div>
                  </div>
                </div>
              );
            })}
          </Panel>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DashboardZoomable, ZoomableStairs });
