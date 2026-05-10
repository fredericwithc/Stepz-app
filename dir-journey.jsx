// Direction 3: Journey map (serpentine path, Duolingo-ish but minimal)
// The staircase reimagined as a winding trail that snakes across the
// viewport. Completed steps are filled nodes; milestones are bigger
// "plateaus". Current position has a subtle pulse. Reads as a game map
// but stays minimal/dark.

function JourneyMap({ currentIdx = 28 }) {
  // Build a serpentine path: 6 rows, 6 cols, snake pattern = 36 steps.
  const rows = 6;
  const cols = 6;
  const cellW = 110;
  const cellH = 58;
  const padX = 40;
  const padY = 30;

  const points = [];
  for (let r = 0; r < rows; r++) {
    const rowFromBottom = rows - 1 - r;
    for (let c = 0; c < cols; c++) {
      const snakeC = rowFromBottom % 2 === 0 ? c : cols - 1 - c;
      const i = rowFromBottom * cols + c; // 0 at bottom-left
      points[i] = {
        x: padX + snakeC * cellW + (snakeC * 6 % 17), // tiny jitter
        y: padY + r * cellH,
      };
    }
  }

  // Build path string through all points
  let pathD = '';
  points.forEach((p, i) => {
    if (i === 0) pathD += `M ${p.x} ${p.y}`;
    else {
      const prev = points[i - 1];
      const mx = (prev.x + p.x) / 2;
      pathD += ` Q ${mx} ${prev.y}, ${p.x} ${p.y}`;
    }
  });

  const width = padX * 2 + (cols - 1) * cellW + 20;
  const height = padY * 2 + (rows - 1) * cellH;

  return (
    <div style={{
      background: `radial-gradient(ellipse at 30% 30%, oklch(0.22 0.06 280 / 0.35), transparent 70%), ${stepzTokens.panel}`,
      border: `1px solid ${stepzTokens.border}`,
      borderRadius: 16,
      padding: '22px 24px',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: stepzTokens.textDim, letterSpacing: 0.4, textTransform: 'uppercase' }}>sua jornada</div>
          <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: -0.8 }}>
            300 <span style={{ fontSize: 15, color: stepzTokens.textDim, fontWeight: 400 }}>degraus · Nível 5</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['1S', '1M', '3M', 'TUDO'].map((f, i) => (
            <div key={f} style={{
              padding: '6px 10px',
              fontSize: 11, fontWeight: 500,
              color: i === 3 ? stepzTokens.text : stepzTokens.textDim,
              background: i === 3 ? 'rgba(255,255,255,0.06)' : 'transparent',
              borderRadius: 6,
            }}>{f}</div>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height + 20}`} style={{ width: '100%', display: 'block' }}>
        <defs>
          <linearGradient id="trailGrad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="oklch(0.68 0.18 280)" />
            <stop offset="1" stopColor="oklch(0.55 0.18 310)" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Full path (faint) */}
        <path d={pathD} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3" strokeLinecap="round" />
        {/* Completed portion — we re-draw up to currentIdx by building a partial path */}
        <path d={pathD} fill="none" stroke="url(#trailGrad)" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={`${(currentIdx / points.length) * 2000} 2000`} />

        {points.map((p, i) => {
          const completed = i < currentIdx;
          const isCurrent = i === currentIdx - 1;
          const isMilestone = (i + 1) % 10 === 0;
          const r = isCurrent ? 10 : isMilestone ? 9 : 5;
          return (
            <g key={i}>
              {isCurrent && (
                <circle cx={p.x} cy={p.y} r="16" fill="oklch(0.68 0.18 280 / 0.3)" filter="url(#glow)">
                  <animate attributeName="r" values="12;18;12" dur="2.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.5;0.15;0.5" dur="2.5s" repeatCount="indefinite" />
                </circle>
              )}
              <circle cx={p.x} cy={p.y} r={r}
                fill={isCurrent ? '#fff'
                  : completed
                    ? (isMilestone ? 'oklch(0.78 0.14 70)' : 'oklch(0.68 0.18 280)')
                    : 'rgba(255,255,255,0.08)'}
                stroke={completed && !isCurrent ? 'rgba(10,10,11,0.6)' : 'none'}
                strokeWidth="1.5"
              />
              {isMilestone && completed && !isCurrent && (
                <text x={p.x} y={p.y + 3} textAnchor="middle" fill="#0a0a0b" fontSize="9" fontWeight="700" fontFamily={stepzTokens.font}>
                  {Math.floor((i + 1) / 10) * 10}
                </text>
              )}
              {isCurrent && (
                <g>
                  <rect x={p.x - 26} y={p.y - 34} width="52" height="20" rx="4" fill="oklch(0.68 0.18 280)" />
                  <text x={p.x} y={p.y - 20} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="600" fontFamily={stepzTokens.font}>hoje</text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: stepzTokens.textFaint, marginTop: 6, padding: '0 8px' }}>
        <span>começo · abr 2025</span>
        <span>hoje · degrau 300 de ∞</span>
      </div>
    </div>
  );
}

function DashboardJourney() {
  return (
    <div style={{ fontFamily: stepzTokens.font, background: stepzTokens.bg, color: stepzTokens.text, minHeight: '100%' }}>
      <TopBar />
      <div style={{ padding: 28, display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <JourneyMap />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <StatTile compact label="Hoje" value="+2" accent={stepzTokens.accent}
              icon={<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2"/></svg>} />
            <StatTile compact label="Streak" value="1d" accent="oklch(0.78 0.14 70)" />
            <StatTile compact label="Dias/degrau" value="13.8" />
            <StatTile compact label="Conquistas" value="28" />
          </div>

          <Panel title="Tarefas de hoje" action="Ver todas →">
            {sampleTasks.slice(0, 5).map((t, i) => <TaskRow key={i} {...t} />)}
          </Panel>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Panel title="Hábitos diários" action="Ver todos →">
            {sampleHabits.map((h, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0' }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: h.color, opacity: h.done ? 1 : 0.35 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: stepzTokens.text }}>{h.title}</div>
                  <div style={{ fontSize: 11, color: stepzTokens.textFaint }}>{h.streak} dias</div>
                </div>
                {h.done && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke={stepzTokens.success} strokeWidth="2" strokeLinecap="round"><path d="M2 6l3 3 5-6" /></svg>}
              </div>
            ))}
          </Panel>

          <Panel title="Próximo marco">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'oklch(0.78 0.14 70 / 0.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 14, height: 14, borderRadius: 7, background: 'oklch(0.78 0.14 70)' }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>Degrau 310</div>
                <div style={{ fontSize: 11, color: stepzTokens.textFaint }}>"Explorador"</div>
              </div>
            </div>
            <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: '80%', height: '100%', background: 'oklch(0.78 0.14 70)' }} />
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: stepzTokens.textFaint, textAlign: 'right' }}>10 a mais</div>
          </Panel>

          <Panel title="Reflexão de hoje">
            <div style={{ fontSize: 13, color: stepzTokens.textDim, lineHeight: 1.5, fontStyle: 'italic' }}>
              "Você subiu 14 degraus esta semana — o maior ritmo desde fevereiro."
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DashboardJourney });
