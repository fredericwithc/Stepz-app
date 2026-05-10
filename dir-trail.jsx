// Direction 2: Vertical timeline trail
// The "staircase" is abstracted into a vertical spine on the left that
// fills as you climb. Days/milestones sit along it as nodes. Feels like
// a journey log — reads top-to-bottom (today at top, origin at bottom).

function VerticalTrail({ currentIdx = 28, total = 36 }) {
  // 36 nodes, last N filled. We show a window of ~18 for density.
  const nodes = [];
  const window = 22;
  const start = Math.max(0, currentIdx - 14);
  for (let i = start; i < start + window && i < total; i++) {
    const completed = i < currentIdx;
    const isCurrent = i === currentIdx - 1;
    const isMilestone = (i + 1) % 10 === 0;
    nodes.push({ i, completed, isCurrent, isMilestone });
  }

  const rowH = 28;
  const height = nodes.length * rowH;

  return (
    <div style={{
      background: stepzTokens.panel,
      border: `1px solid ${stepzTokens.border}`,
      borderRadius: 16,
      padding: '22px 24px',
      display: 'flex',
      flexDirection: 'column',
      height: 520,
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: stepzTokens.textDim, letterSpacing: 0.4, textTransform: 'uppercase' }}>sua trilha</div>
          <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: -0.8 }}>
            300<span style={{ fontSize: 16, color: stepzTokens.textDim, fontWeight: 400 }}> / ∞</span>
          </div>
          <div style={{ fontSize: 12, color: stepzTokens.textFaint, marginTop: 2 }}>degraus trilhados em 385 dias</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', background: stepzTokens.accentSoft, color: stepzTokens.accent,
            borderRadius: 99, fontSize: 12, fontWeight: 500,
          }}>Nível 5</div>
          <div style={{ fontSize: 11, color: stepzTokens.textFaint, marginTop: 6 }}>+100 para nível 6</div>
        </div>
      </div>

      {/* Scroll window with trail */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Spine */}
        <div style={{
          position: 'absolute', left: 22, top: 0, bottom: 0, width: 2,
          background: 'rgba(255,255,255,0.06)',
        }} />
        {/* Filled portion */}
        <div style={{
          position: 'absolute', left: 22, bottom: 0,
          height: `${(14 / nodes.length) * 100}%`, width: 2,
          background: `linear-gradient(to top, ${stepzTokens.accent}, oklch(0.55 0.18 310))`,
        }} />

        <div style={{ display: 'flex', flexDirection: 'column-reverse', height: '100%' }}>
          {nodes.map((n) => (
            <div key={n.i} style={{ display: 'flex', alignItems: 'center', gap: 16, height: rowH, flexShrink: 0 }}>
              <div style={{ position: 'relative', width: 46, display: 'flex', justifyContent: 'center' }}>
                <div style={{
                  width: n.isCurrent ? 14 : n.isMilestone ? 11 : 8,
                  height: n.isCurrent ? 14 : n.isMilestone ? 11 : 8,
                  borderRadius: 99,
                  background: n.completed
                    ? (n.isMilestone ? 'oklch(0.78 0.14 70)' : stepzTokens.accent)
                    : 'rgba(255,255,255,0.12)',
                  boxShadow: n.isCurrent ? `0 0 0 4px oklch(0.68 0.18 280 / 0.25)` : 'none',
                  border: n.isCurrent ? '2px solid #fff' : 'none',
                }} />
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                <div style={{ color: n.completed ? stepzTokens.text : stepzTokens.textFaint }}>
                  {n.isCurrent ? 'Hoje — Estudar JavaScript' :
                   n.isMilestone && n.completed ? `Marco · degrau ${n.i + 1}` :
                   n.completed ? `Degrau ${n.i + 1}` : `Degrau ${n.i + 1}`}
                </div>
                <div style={{ color: stepzTokens.textFaint, fontFamily: stepzTokens.fontMono, fontSize: 11 }}>
                  {n.completed ? (n.isCurrent ? 'agora' : `${Math.abs(n.i - currentIdx) + 1}d`) : '—'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 11, color: stepzTokens.textFaint, textAlign: 'center', marginTop: 10, paddingTop: 10, borderTop: `1px solid ${stepzTokens.border}` }}>
        ↓ role para ver o começo da sua jornada
      </div>
    </div>
  );
}

function DashboardTrail() {
  return (
    <div style={{ fontFamily: stepzTokens.font, background: stepzTokens.bg, color: stepzTokens.text, minHeight: '100%' }}>
      <TopBar />
      <div style={{ padding: 28, display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20 }}>
        {/* Left column — trail dominates */}
        <VerticalTrail />

        {/* Right column — tasks, habits, stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <StatTile compact label="Streak" value="1d" accent="oklch(0.78 0.14 70)"
              icon={<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1c0 3-3 4-3 7a3 3 0 006 0c0-1-.5-2-1-2.5.5 1 0 2-1 2-1 0-1-1-.5-2 1.5-2 0-4.5-.5-4.5z"/></svg>} />
            <StatTile compact label="Jornada" value="385d" />
            <StatTile compact label="Ritmo" value="13.8d" />
            <StatTile compact label="Conquistas" value="28" accent={stepzTokens.accent} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Panel title="Tarefas de hoje" action="Ver todas →">
              {sampleTasks.slice(0, 4).map((t, i) => <TaskRow key={i} {...t} />)}
            </Panel>
            <Panel title="Hábitos diários" action="Ver todos →">
              {sampleHabits.map((h, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: h.color, opacity: h.done ? 1 : 0.4 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: stepzTokens.text }}>{h.title}</div>
                    <div style={{ fontSize: 11, color: stepzTokens.textFaint }}>{h.streak}d</div>
                  </div>
                </div>
              ))}
            </Panel>
          </div>

          <Panel title="Últimas conquistas">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { n: 'Cem degraus', d: 'Fev 2025', color: 'oklch(0.78 0.14 70)' },
                { n: '30 dias de meditação', d: 'Mar 2026', color: stepzTokens.accent },
                { n: 'Primeiro livro', d: 'Abr 2026', color: 'oklch(0.72 0.15 155)' },
              ].map((a, i) => (
                <div key={i} style={{
                  background: stepzTokens.panel2,
                  border: `1px solid ${stepzTokens.border}`,
                  borderRadius: 10, padding: '12px 14px',
                }}>
                  <div style={{ width: 26, height: 26, borderRadius: 6, background: a.color, opacity: 0.2, marginBottom: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 10, height: 10, borderRadius: 5, background: a.color }} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: stepzTokens.text }}>{a.n}</div>
                  <div style={{ fontSize: 11, color: stepzTokens.textFaint, marginTop: 2 }}>{a.d}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DashboardTrail });
