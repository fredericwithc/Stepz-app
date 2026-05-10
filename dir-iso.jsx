// Direction 1: Isometric Ascending Staircase
// Each completed task is a stone step. Camera looks back down the stairs
// so you see the path traveled. A small "you are here" marker floats
// near the top. The staircase IS the hero — stats hug the edges.

function IsometricStairs({ steps = 36, currentIdx = 28 }) {
  // We draw N steps receding into the distance with an isometric-ish projection.
  // Each step is a parallelogram "top" + subtle side.
  const stepW = 220;
  const stepH = 14;
  const stepDepth = 32;
  const xShift = 18;       // horizontal offset per step
  const yRise = 22;        // how much each step rises

  const rows = [];
  for (let i = 0; i < steps; i++) {
    const fromTop = steps - 1 - i;
    const x = 40 + fromTop * xShift;
    const y = 40 + fromTop * yRise;
    const completed = i < currentIdx;
    const isCurrent = i === currentIdx - 1;
    const opacity = completed ? 1 : 0.22;

    rows.push(
      <g key={i} style={{ opacity }}>
        {/* Side face */}
        <polygon
          points={`${x},${y + stepH} ${x + stepW},${y + stepH} ${x + stepW},${y + stepH + 18} ${x},${y + stepH + 18}`}
          fill={completed ? 'oklch(0.22 0.03 280)' : 'rgba(255,255,255,0.04)'}
        />
        {/* Top face */}
        <polygon
          points={`${x + stepDepth},${y} ${x + stepW + stepDepth},${y} ${x + stepW},${y + stepH} ${x},${y + stepH}`}
          fill={isCurrent
            ? 'oklch(0.68 0.18 280)'
            : completed ? 'oklch(0.32 0.04 280)' : 'rgba(255,255,255,0.06)'}
          stroke={isCurrent ? 'oklch(0.85 0.12 280)' : 'rgba(255,255,255,0.05)'}
          strokeWidth={isCurrent ? 1.5 : 0.5}
        />
        {/* milestone glow */}
        {completed && (i + 1) % 10 === 0 && (
          <circle cx={x + stepDepth / 2 + stepW / 2} cy={y + 4} r={5}
            fill="oklch(0.78 0.14 70)" opacity="0.9" />
        )}
      </g>
    );
  }

  // Current marker
  const cIdx = currentIdx - 1;
  const cFromTop = steps - 1 - cIdx;
  const cx = 40 + cFromTop * xShift + stepDepth / 2 + stepW / 2;
  const cy = 40 + cFromTop * yRise - 6;

  return (
    <div style={{
      position: 'relative',
      background: `radial-gradient(ellipse at 70% 20%, oklch(0.22 0.06 280 / 0.45), transparent 60%), ${stepzTokens.panel}`,
      border: `1px solid ${stepzTokens.border}`,
      borderRadius: 16,
      padding: 20,
      overflow: 'hidden',
      height: 380,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6, position: 'relative', zIndex: 2 }}>
        <div>
          <div style={{ fontSize: 12, color: stepzTokens.textDim, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 2 }}>Sua escada</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: stepzTokens.text, letterSpacing: -0.8 }}>
            300 <span style={{ color: stepzTokens.textDim, fontWeight: 400, fontSize: 18 }}>degraus subidos</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: stepzTokens.textDim }}>Nível</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: stepzTokens.accent, letterSpacing: -0.5 }}>5</div>
        </div>
      </div>
      <svg viewBox="0 0 900 340" style={{ width: '100%', height: 290, marginTop: 4 }}>
        {rows}
        {/* Current marker tag */}
        <g>
          <line x1={cx} y1={cy} x2={cx} y2={cy - 32} stroke="oklch(0.85 0.12 280)" strokeWidth="1" strokeDasharray="2 3" />
          <circle cx={cx} cy={cy - 38} r={18} fill="oklch(0.68 0.18 280)" />
          <text x={cx} y={cy - 33} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="600" fontFamily={stepzTokens.font}>você</text>
        </g>
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: stepzTokens.textFaint, marginTop: 4 }}>
        <span>← onde você começou</span>
        <span>próximo nível em 100 degraus</span>
      </div>
    </div>
  );
}

function DashboardIso() {
  return (
    <div style={{ fontFamily: stepzTokens.font, background: stepzTokens.bg, color: stepzTokens.text, minHeight: '100%' }}>
      <TopBar />
      <div style={{ padding: 28, display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
        {/* Left column — the stairs dominate */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <IsometricStairs />

          {/* Stats row under stairs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <StatTile compact label="Dias seguidos" value="1" accent="oklch(0.78 0.14 70)"
              icon={<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1c0 3-3 4-3 7a3 3 0 006 0c0-1-.5-2-1-2.5.5 1 0 2-1 2-1 0-1-1-.5-2 1.5-2 0-4.5-.5-4.5z"/></svg>} />
            <StatTile compact label="Dias de jornada" value="385" />
            <StatTile compact label="Dias por degrau" value="13.8" />
            <StatTile compact label="Conquistas" value="28" accent={stepzTokens.accent} />
          </div>

          <Panel title="Tarefas de hoje" action="Ver todas →">
            {sampleTasks.slice(0, 4).map((t, i) => <TaskRow key={i} {...t} />)}
            <div style={{ marginTop: 12, padding: '10px 12px', background: stepzTokens.accentSoft, borderRadius: 8, fontSize: 12, color: stepzTokens.text }}>
              <strong style={{ color: stepzTokens.accent }}>+2 degraus hoje.</strong> Faltam 3 para o degrau 301.
            </div>
          </Panel>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Panel title="Hábitos diários" action="Ver todos →">
            {sampleHabits.map((h, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
                <div style={{
                  width: 10, height: 10, borderRadius: 5, background: h.color, opacity: h.done ? 1 : 0.4,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: stepzTokens.text }}>{h.title}</div>
                  <div style={{ fontSize: 11, color: stepzTokens.textFaint }}>{h.streak} dias seguidos</div>
                </div>
                <div style={{
                  fontSize: 11, fontFamily: stepzTokens.fontMono,
                  color: h.done ? stepzTokens.success : stepzTokens.textFaint,
                }}>{h.done ? '✓' : '—'}</div>
              </div>
            ))}
          </Panel>

          <Panel title="Próximo marco">
            <div style={{ fontSize: 13, color: stepzTokens.textDim, marginBottom: 10 }}>
              Degrau 301 — "Cem dias de constância"
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: '80%', height: '100%', background: stepzTokens.accent }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: stepzTokens.textFaint }}>
              <span>80 de 100</span>
              <span>20 restantes</span>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DashboardIso });
