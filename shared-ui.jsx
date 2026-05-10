// Shared bits used across the three dashboard directions.
// Dark-mode tokens + tiny presentational components.

const stepzTokens = {
  bg: '#0a0a0b',
  panel: '#111114',
  panel2: '#17171c',
  border: 'rgba(242, 239, 233, 0.06)',
  borderStrong: 'rgba(242, 239, 233, 0.12)',
  text: '#f2efe9',
  textDim: 'rgba(242, 239, 233, 0.62)',
  textFaint: 'rgba(242, 239, 233, 0.38)',
  accent: '#7c5cff',
  accentSoft: 'rgba(124, 92, 255, 0.22)',
  highlight: '#e9dcff',
  accentGradient: 'linear-gradient(135deg, #c79bff 0%, #7c5cff 100%)',
  success: 'oklch(0.72 0.15 155)',      // green
  warn: 'oklch(0.78 0.14 70)',          // amber
  font: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
  fontMono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
};

function TopBar({ title = 'Stepz', active = 'Home' }) {
  const tabs = ['Home', 'Tasks', 'Habits', 'Goals', 'Journal'];
  const today = 'terça-feira, 21 de abril de 2026';
  return (
    <div style={{ borderBottom: `1px solid ${stepzTokens.border}`, background: stepzTokens.bg }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 32px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img
            src="logos/svg/lockup-color-transparent-white-text.svg"
            alt={title}
            draggable={false}
            style={{ height: 48, width: 'auto', display: 'block', objectFit: 'contain' }}
          />
        </div>
        <div style={{ fontSize: 13, color: stepzTokens.textDim }}>{today}</div>
      </div>
      <div style={{ display: 'flex', gap: 4, padding: '14px 24px 0' }}>
        {tabs.map((t) => (
          <div key={t} style={{
            padding: '10px 14px',
            fontSize: 14,
            color: t === active ? stepzTokens.text : stepzTokens.textDim,
            borderBottom: t === active ? `2px solid ${stepzTokens.accent}` : '2px solid transparent',
            fontWeight: t === active ? 500 : 400,
            cursor: 'default',
          }}>{t}</div>
        ))}
      </div>
    </div>
  );
}

// Tiny chart-less stat card
function StatTile({ icon, value, label, accent, compact }) {
  return (
    <div style={{
      background: stepzTokens.panel,
      border: `1px solid ${stepzTokens.border}`,
      borderRadius: 12,
      padding: compact ? '14px 16px' : '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: accent || stepzTokens.textDim, fontSize: 13 }}>
        {icon}
        <span style={{ color: stepzTokens.textDim }}>{label}</span>
      </div>
      <div style={{ fontSize: compact ? 24 : 30, fontWeight: 600, color: stepzTokens.text, letterSpacing: -0.8, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  );
}

function TaskRow({ title, category, done }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
      <div style={{
        width: 18, height: 18, borderRadius: 9,
        border: `1.5px solid ${done ? stepzTokens.success : 'rgba(255,255,255,0.25)'}`,
        background: done ? stepzTokens.success : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {done && <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#0a0a0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5l2 2 4-4" /></svg>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, color: done ? stepzTokens.textFaint : stepzTokens.text,
          textDecoration: done ? 'line-through' : 'none',
          textDecorationColor: 'rgba(232,232,234,0.3)',
        }}>{title}</div>
        <div style={{ fontSize: 12, color: stepzTokens.textFaint, marginTop: 2 }}>{category}</div>
      </div>
    </div>
  );
}

function Panel({ title, action, children, style }) {
  return (
    <div style={{
      background: stepzTokens.panel,
      border: `1px solid ${stepzTokens.border}`,
      borderRadius: 14,
      padding: '20px 22px',
      ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: stepzTokens.text, letterSpacing: -0.2 }}>{title}</div>
        {action && <div style={{ fontSize: 12, color: stepzTokens.accent, cursor: 'default' }}>{action}</div>}
      </div>
      {children}
    </div>
  );
}

// Sample data shared by all directions
const sampleTasks = [
  { title: 'Meditar por 10 minutos', category: 'Saúde Mental', done: true },
  { title: 'Ler 20 páginas', category: 'Aprendizado', done: true },
  { title: 'Exercício físico 30min', category: 'Saúde', done: false },
  { title: 'Estudar JavaScript', category: 'Carreira', done: false },
  { title: 'Ligar para a mãe', category: 'Relações', done: false },
];

const sampleHabits = [
  { title: 'Meditação', streak: 12, done: true, color: 'oklch(0.72 0.15 155)' },
  { title: 'Exercício', streak: 8, done: false, color: 'oklch(0.78 0.14 70)' },
  { title: 'Leitura', streak: 15, done: true, color: '#7c5cff' },
  { title: 'Gratidão', streak: 20, done: true, color: 'oklch(0.72 0.15 200)' },
];

Object.assign(window, { stepzTokens, TopBar, StatTile, TaskRow, Panel, sampleTasks, sampleHabits });
