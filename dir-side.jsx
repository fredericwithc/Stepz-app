// Side-view staircase variations — inspired by the classical hand-drawn
// staircase illustration (steps profiled from the side, solid hatched
// body underneath, figure at the top).

// ── Shared primitives ────────────────────────────────────────
function HatchPattern({ id, color = 'rgba(255,255,255,0.08)' }) {
  return (
    <defs>
      <pattern id={id} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(-45)">
        <line x1="0" y1="0" x2="0" y2="6" stroke={color} strokeWidth="1" />
      </pattern>
    </defs>
  );
}

function FigureAtTop({ x, y, accent = 'oklch(0.68 0.18 280)' }) {
  // Tiny triumphant figure — arms up
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle cx="0" cy="-22" r="5" fill={accent} />
      <line x1="0" y1="-17" x2="0" y2="-4" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="0" y1="-14" x2="-8" y2="-22" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="0" y1="-14" x2="8" y2="-22" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="0" y1="-4" x2="-4" y2="3" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="0" y1="-4" x2="4" y2="3" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
    </g>
  );
}

// ═══════════════════════════════════════════════════════════
// Variation A · Clássica lateral — faithful to the reference
// ═══════════════════════════════════════════════════════════
function StairsSideClassic({ currentIdx = 28, total = 36 }) {
  const stepW = 22;
  const stepH = 16;
  const baseX = 60;
  const baseY = 340;

  const steps = [];
  const arrows = [];
  for (let i = 0; i < total; i++) {
    const x = baseX + i * stepW;
    const top = baseY - (i + 1) * stepH;
    const completed = i < currentIdx;
    const isCurrent = i === currentIdx - 1;
    const isMilestone = (i + 1) % 10 === 0;
    const accent = completed
      ? (isMilestone ? 'oklch(0.78 0.14 70)' : 'oklch(0.68 0.18 280)')
      : 'rgba(255,255,255,0.22)';

    // Step "tread" (top face)
    steps.push(
      <rect key={`t-${i}`} x={x} y={top} width={stepW} height={4}
        fill={accent}
        opacity={completed ? 1 : 0.4}
      />
    );
    // Step "riser" (front face) — hatched for completed
    steps.push(
      <rect key={`r-${i}`} x={x} y={top + 4} width={stepW} height={stepH - 4}
        fill={completed ? 'rgba(255,255,255,0.03)' : 'transparent'}
        stroke={completed ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'}
        strokeWidth="1"
      />
    );

    // Little arrow from previous step
    if (i > 0 && completed) {
      const px = x - stepW / 2;
      const py = top + stepH + 8;
      arrows.push(
        <path key={`a-${i}`}
          d={`M ${px - 4} ${py + 4} Q ${px} ${py - 8}, ${x + 2} ${top + 2}`}
          fill="none" stroke={accent} strokeWidth="1.2" strokeLinecap="round"
          markerEnd={`url(#arr-${isMilestone ? 'gold' : 'violet'})`}
          opacity="0.55"
        />
      );
    }

    if (isCurrent) {
      // current indicator dot + pulse
      steps.push(
        <g key={`c-${i}`}>
          <circle cx={x + stepW / 2} cy={top - 10} r="4" fill="#fff" />
          <circle cx={x + stepW / 2} cy={top - 10} r="9" fill="none" stroke="#fff" strokeWidth="1" opacity="0.3">
            <animate attributeName="r" values="6;14;6" dur="2.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4;0;0.4" dur="2.2s" repeatCount="indefinite" />
          </circle>
        </g>
      );
    }
  }

  // Solid "hill" underneath — a big hatched triangle
  const hillW = total * stepW;
  const hillPath = `M ${baseX} ${baseY} L ${baseX + hillW} ${baseY - total * stepH + 4} L ${baseX + hillW} ${baseY} Z`;

  // Finish line flag at top
  const topX = baseX + total * stepW;
  const topY = baseY - total * stepH;

  return (
    <div style={{
      background: stepzTokens.panel,
      border: `1px solid ${stepzTokens.border}`,
      borderRadius: 16,
      padding: '24px 28px 16px',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 12, color: stepzTokens.textDim, letterSpacing: 0.5, textTransform: 'uppercase' }}>sua escada</div>
          <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: -1 }}>
            300 <span style={{ fontSize: 16, color: stepzTokens.textDim, fontWeight: 400 }}>degraus em 385 dias</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: stepzTokens.textDim, textTransform: 'uppercase', letterSpacing: 0.4 }}>nível atual</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: stepzTokens.accent, letterSpacing: -0.5 }}>5</div>
        </div>
      </div>

      <svg viewBox={`0 0 ${baseX + hillW + 60} ${baseY + 20}`} style={{ width: '100%', display: 'block' }}>
        <HatchPattern id="hatchA" color="rgba(255,255,255,0.05)" />
        <defs>
          <marker id="arr-violet" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="oklch(0.68 0.18 280)" />
          </marker>
          <marker id="arr-gold" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="oklch(0.78 0.14 70)" />
          </marker>
        </defs>

        {/* Ground line */}
        <line x1="20" y1={baseY} x2={baseX + hillW + 40} y2={baseY} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

        {/* Solid hill */}
        <path d={hillPath} fill="url(#hatchA)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

        {arrows}
        {steps}

        <FigureAtTop x={topX + 8} y={topY + 4} />

        {/* Start label */}
        <text x={baseX} y={baseY + 16} fontSize="10" fill={stepzTokens.textFaint} fontFamily={stepzTokens.font}>
          abr 2025
        </text>
        <text x={baseX + hillW - 20} y={baseY + 16} fontSize="10" fill={stepzTokens.textFaint} fontFamily={stepzTokens.font}>
          hoje
        </text>
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Variation B · Estilizada com etiquetas nos degraus
// ═══════════════════════════════════════════════════════════
function StairsSideLabeled({ currentIdx = 10 }) {
  // Show last 10 steps with task labels, plus a compressed "..." behind.
  const labels = [
    'Leu 20 páginas',
    'Meditou',
    'Treinou',
    'Ligou p/ mãe',
    'Diário noite',
    'Leu 20 páginas',
    'Meditou',
    'Caminhou',
    'Código 1h',
    'Hoje',
  ];

  const stepW = 68;
  const stepH = 30;
  const baseX = 40;
  const baseY = 360;
  const total = labels.length;

  const steps = [];
  for (let i = 0; i < total; i++) {
    const x = baseX + i * stepW;
    const top = baseY - (i + 1) * stepH;
    const isCurrent = i === total - 1;
    const isMilestone = (i + 1) % 5 === 0 && !isCurrent;
    const fill = isCurrent ? 'oklch(0.68 0.18 280)'
      : isMilestone ? 'oklch(0.78 0.14 70)'
      : 'rgba(255,255,255,0.08)';
    const textColor = isCurrent ? '#fff' : stepzTokens.textDim;

    steps.push(
      <g key={i}>
        {/* Tread */}
        <rect x={x} y={top} width={stepW} height={6} fill={fill} />
        {/* Riser */}
        <rect x={x} y={top + 6} width={stepW} height={stepH - 6}
          fill={isCurrent ? 'oklch(0.68 0.18 280 / 0.2)' : 'rgba(255,255,255,0.02)'}
          stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        {/* Label on tread */}
        <text x={x + stepW / 2} y={top - 6} textAnchor="middle"
          fontSize="11" fill={textColor} fontFamily={stepzTokens.font}
          fontWeight={isCurrent ? 600 : 400}>
          {labels[i]}
        </text>
        {/* Step number on riser */}
        <text x={x + stepW / 2} y={top + stepH - 10} textAnchor="middle"
          fontSize="10" fill="rgba(255,255,255,0.35)" fontFamily={stepzTokens.fontMono}>
          {291 + i}
        </text>
      </g>
    );
  }

  // Compressed "earlier steps" on the left — a faded stair ghost
  const ghostSteps = [];
  for (let i = 0; i < 8; i++) {
    const x = baseX - (8 - i) * 14;
    const top = baseY - (i + 1) * 4 - 12;
    ghostSteps.push(
      <rect key={i} x={x} y={top} width={14} height={2} fill="rgba(255,255,255,0.12)" opacity={0.3 + i * 0.08} />
    );
  }

  const topX = baseX + total * stepW;
  const topY = baseY - total * stepH;

  return (
    <div style={{
      background: stepzTokens.panel,
      border: `1px solid ${stepzTokens.border}`,
      borderRadius: 16,
      padding: '24px 28px 16px',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 12, color: stepzTokens.textDim, letterSpacing: 0.5, textTransform: 'uppercase' }}>últimos degraus</div>
          <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: -0.6 }}>
            Você subiu <span style={{ color: stepzTokens.accent }}>10 degraus</span> esta semana
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['7d', '30d', '90d', 'Tudo'].map((t, i) => (
            <div key={t} style={{
              padding: '5px 10px', fontSize: 11, fontWeight: 500,
              background: i === 0 ? 'rgba(255,255,255,0.07)' : 'transparent',
              color: i === 0 ? stepzTokens.text : stepzTokens.textDim, borderRadius: 5,
            }}>{t}</div>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${baseX + total * stepW + 40} ${baseY + 20}`} style={{ width: '100%', display: 'block' }}>
        <HatchPattern id="hatchB" color="rgba(255,255,255,0.04)" />
        {/* Ground */}
        <line x1="10" y1={baseY} x2={baseX + total * stepW + 20} y2={baseY} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
        {/* Hill underneath */}
        <path d={`M ${baseX} ${baseY} L ${baseX + total * stepW} ${baseY - total * stepH + 6} L ${baseX + total * stepW} ${baseY} Z`}
          fill="url(#hatchB)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

        {ghostSteps}
        <text x={baseX - 60} y={baseY + 14} fontSize="10" fill={stepzTokens.textFaint} fontFamily={stepzTokens.font}>
          …290 degraus antes
        </text>

        {steps}

        <FigureAtTop x={topX + 12} y={topY + 4} />
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Variation C · Escada com patamares (níveis)
// ═══════════════════════════════════════════════════════════
function StairsLanding({ currentIdx = 28 }) {
  // 5 landings of 10 steps each, with a landing break between them.
  // Shows as: 10 steps, flat landing with level marker, 10 steps, flat…
  const stepW = 18;
  const stepH = 14;
  const landingW = 30;
  const baseX = 50;
  const baseY = 320;
  const stepsPerLanding = 10;
  const landings = 4; // levels 1..4 done, working on 5
  const currentInLevel = 8; // we're 8/10 into level 5

  const elements = [];
  let x = baseX;
  let y = baseY;
  let stepIdx = 0;

  for (let L = 0; L < 5; L++) {
    // 10 steps for this level
    const stepsThisLevel = L === 4 ? currentInLevel : stepsPerLanding;
    const levelDone = L < 4;

    for (let s = 0; s < stepsPerLanding; s++) {
      const completed = stepIdx < currentIdx;
      const isCurrent = stepIdx === currentIdx - 1;
      const fill = completed
        ? (s === stepsPerLanding - 1 ? 'oklch(0.78 0.14 70)' : 'oklch(0.68 0.18 280)')
        : 'rgba(255,255,255,0.08)';

      const top = y - stepH;
      elements.push(
        <g key={`s-${L}-${s}`}>
          <rect x={x} y={top} width={stepW} height={4} fill={fill} opacity={completed ? 1 : 0.5} />
          <rect x={x} y={top + 4} width={stepW} height={stepH - 4}
            fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          {isCurrent && (
            <circle cx={x + stepW / 2} cy={top - 8} r="3.5" fill="#fff">
              <animate attributeName="opacity" values="1;0.4;1" dur="1.8s" repeatCount="indefinite" />
            </circle>
          )}
        </g>
      );
      x += stepW;
      y -= stepH;
      stepIdx++;
      if (!completed && s >= stepsThisLevel - 1) break;
    }

    // Landing
    if (L < 4 || true) {
      const landingTop = y;
      const isLastReached = L === 3;
      elements.push(
        <g key={`L-${L}`}>
          <rect x={x} y={landingTop} width={landingW} height={6}
            fill={levelDone ? 'oklch(0.78 0.14 70)' : 'rgba(255,255,255,0.1)'} />
          <rect x={x} y={landingTop + 6} width={landingW} height={stepH - 4}
            fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          {/* Level badge above landing */}
          <g transform={`translate(${x + landingW / 2}, ${landingTop - 14})`}>
            <circle r="11" fill={levelDone ? 'oklch(0.78 0.14 70)' : 'rgba(255,255,255,0.08)'}
              stroke={levelDone ? 'none' : 'rgba(255,255,255,0.15)'} strokeWidth="1" />
            <text textAnchor="middle" y="4" fontSize="11" fontWeight="700"
              fill={levelDone ? '#0a0a0b' : stepzTokens.textDim} fontFamily={stepzTokens.font}>
              {L + 1}
            </text>
          </g>
        </g>
      );
      x += landingW;
    }
  }

  const topX = x - 20;
  const topY = y;

  const totalW = x + 60;
  return (
    <div style={{
      background: stepzTokens.panel,
      border: `1px solid ${stepzTokens.border}`,
      borderRadius: 16,
      padding: '24px 28px 16px',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 12, color: stepzTokens.textDim, letterSpacing: 0.5, textTransform: 'uppercase' }}>sua escada</div>
          <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: -0.8 }}>
            Nível 5 · <span style={{ color: stepzTokens.textDim, fontWeight: 400, fontSize: 18 }}>300 degraus</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: stepzTokens.textDim }}>próximo patamar</div>
          <div style={{ fontSize: 16, fontWeight: 500, color: 'oklch(0.78 0.14 70)' }}>2 degraus</div>
        </div>
      </div>

      <svg viewBox={`0 0 ${totalW} ${baseY + 30}`} style={{ width: '100%', display: 'block' }}>
        <HatchPattern id="hatchC" color="rgba(255,255,255,0.04)" />
        {/* Ground */}
        <line x1="10" y1={baseY} x2={totalW - 10} y2={baseY} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
        {/* Hill silhouette — follow stepped outline */}
        <path d={(() => {
          let d = `M ${baseX} ${baseY}`;
          let xi = baseX, yi = baseY;
          for (let L = 0; L < 5; L++) {
            const steps = L === 4 ? currentInLevel : stepsPerLanding;
            for (let s = 0; s < steps; s++) { yi -= stepH; d += ` L ${xi} ${yi}`; xi += stepW; d += ` L ${xi} ${yi}`; }
            if (L < 4) { xi += landingW; d += ` L ${xi} ${yi}`; }
          }
          d += ` L ${xi} ${baseY} Z`;
          return d;
        })()} fill="url(#hatchC)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

        {elements}
        <FigureAtTop x={topX} y={topY - 2} />

        {/* Start / end labels */}
        <text x={baseX} y={baseY + 16} fontSize="10" fill={stepzTokens.textFaint} fontFamily={stepzTokens.font}>começo</text>
      </svg>

      {/* Level row under the svg */}
      <div style={{ display: 'flex', gap: 6, marginTop: 4, justifyContent: 'space-between', padding: '0 8px' }}>
        {[
          { n: 1, t: 'Despertar', done: true },
          { n: 2, t: 'Ritmo', done: true },
          { n: 3, t: 'Constância', done: true },
          { n: 4, t: 'Profundidade', done: true },
          { n: 5, t: 'Maestria', done: false, active: true },
          { n: 6, t: '?', done: false, locked: true },
        ].map((l) => (
          <div key={l.n} style={{
            flex: 1, textAlign: 'center',
            padding: '6px 4px', borderRadius: 6,
            background: l.active ? 'oklch(0.68 0.18 280 / 0.12)' : 'transparent',
            border: l.active ? '1px solid oklch(0.68 0.18 280 / 0.3)' : '1px solid transparent',
          }}>
            <div style={{ fontSize: 10, color: l.locked ? stepzTokens.textFaint : l.done ? 'oklch(0.78 0.14 70)' : stepzTokens.accent, fontWeight: 600 }}>
              NÍVEL {l.n}
            </div>
            <div style={{ fontSize: 11, color: l.locked ? stepzTokens.textFaint : stepzTokens.text, marginTop: 2 }}>
              {l.t}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Dashboards wrapping each variation
function DashboardSideClassic() {
  return (
    <div style={{ fontFamily: stepzTokens.font, background: stepzTokens.bg, color: stepzTokens.text, minHeight: '100%' }}>
      <TopBar />
      <div style={{ padding: 28, display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <StairsSideClassic />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <StatTile compact label="Dias seguidos" value="1" accent="oklch(0.78 0.14 70)" />
            <StatTile compact label="Jornada" value="385d" />
            <StatTile compact label="Dias/degrau" value="13.8" />
            <StatTile compact label="Conquistas" value="28" accent={stepzTokens.accent} />
          </div>
          <Panel title="Tarefas de hoje" action="Ver todas →">
            {sampleTasks.slice(0, 5).map((t, i) => <TaskRow key={i} {...t} />)}
            <div style={{ marginTop: 10, padding: '10px 12px', background: stepzTokens.accentSoft, borderRadius: 8, fontSize: 12 }}>
              <strong style={{ color: stepzTokens.accent }}>+2 degraus hoje.</strong> Faltam 3 para o nível 6.
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
          <Panel title="Próximo marco">
            <div style={{ fontSize: 13, color: stepzTokens.textDim, marginBottom: 10 }}>
              Degrau 310 · "Explorador"
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: '80%', height: '100%', background: 'oklch(0.78 0.14 70)' }} />
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: stepzTokens.textFaint }}>10 degraus restantes</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function DashboardSideLabeled() {
  return (
    <div style={{ fontFamily: stepzTokens.font, background: stepzTokens.bg, color: stepzTokens.text, minHeight: '100%' }}>
      <TopBar />
      <div style={{ padding: 28, display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <StairsSideLabeled />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <StatTile compact label="Total" value="300" accent={stepzTokens.accent} />
            <StatTile compact label="Streak" value="1d" accent="oklch(0.78 0.14 70)" />
            <StatTile compact label="Jornada" value="385d" />
            <StatTile compact label="Dias/degrau" value="13.8" />
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
                  <div style={{ fontSize: 13 }}>{h.title}</div>
                  <div style={{ fontSize: 11, color: stepzTokens.textFaint }}>{h.streak}d</div>
                </div>
              </div>
            ))}
          </Panel>
          <Panel title="Nível 5 · Maestria">
            <div style={{ fontSize: 13, color: stepzTokens.textDim, marginBottom: 10 }}>300/310 degraus</div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: '80%', height: '100%', background: stepzTokens.accent }} />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function DashboardLanding() {
  return (
    <div style={{ fontFamily: stepzTokens.font, background: stepzTokens.bg, color: stepzTokens.text, minHeight: '100%' }}>
      <TopBar />
      <div style={{ padding: 28, display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <StairsLanding />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <StatTile compact label="Degraus" value="300" accent={stepzTokens.accent} />
            <StatTile compact label="Streak" value="1d" accent="oklch(0.78 0.14 70)" />
            <StatTile compact label="Jornada" value="385d" />
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
                  <div style={{ fontSize: 13 }}>{h.title}</div>
                  <div style={{ fontSize: 11, color: stepzTokens.textFaint }}>{h.streak}d</div>
                </div>
              </div>
            ))}
          </Panel>
          <Panel title="Patamar atual">
            <div style={{ fontSize: 13, color: stepzTokens.text, marginBottom: 4, fontWeight: 500 }}>
              Nível 5 · Maestria
            </div>
            <div style={{ fontSize: 12, color: stepzTokens.textDim, lineHeight: 1.5 }}>
              8 de 10 degraus para o próximo patamar. Você está quase lá.
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  DashboardSideClassic, DashboardSideLabeled, DashboardLanding,
  StairsSideClassic, StairsSideLabeled, StairsLanding,
});
