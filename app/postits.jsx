// Post-its board — Notion-style sticky-note canvas with sidebar tags.
// Each note has: id, title, color (theme), tag, items[], comments?[], createdAt, updatedAt
// comments[]: { id, itemId, preview, body, createdAt, updatedAt }
// Each item has: id, text (plain fallback), html? (rich content), link?, sub[], highlight?

const POSTIT_FONT_COLORS = [
  '#f2efe9', '#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa', '#da77f2', '#868e96',
];

function postitEscapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function postitTextToHtml(text) {
  const raw = String(text ?? '');
  if (!raw.trim()) return '<br>';
  return postitEscapeHtml(raw).replace(/\n/g, '<br>');
}

function postitSanitizeHtml(html) {
  return String(html || '').replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').trim();
}

function postitHtmlToPlain(html) {
  if (!html) return '';
  try {
    const d = typeof document !== 'undefined' ? document.createElement('div') : null;
    if (!d) return '';
    d.innerHTML = html;
    return (d.innerText || d.textContent || '').replace(/\u00a0/g, ' ').trim();
  } catch {
    return '';
  }
}

/** Seleção com texto real dentro deste contentEditable (não só cursor). */
function postitEditorHasTextSelection(editorEl) {
  if (typeof window === 'undefined' || !editorEl) return false;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  if (range.collapsed || sel.isCollapsed) return false;
  if (!editorEl.contains(range.commonAncestorContainer)) return false;
  try {
    const raw = String(sel.toString() || '').replace(/\u200b/g, '');
    return raw.trim().length > 0;
  } catch {
    return false;
  }
}

/** Envolve a seleção num âncora de comentário (sublinhado visual via CSS). */
function wrapPostitCommentAnchor(editorEl, commentId) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
  const range = sel.getRangeAt(0);
  if (range.collapsed || !editorEl.contains(range.commonAncestorContainer)) return false;
  const span = document.createElement('span');
  span.setAttribute('data-postit-comment', commentId);
  span.className = 'postit-comment-mark';
  span.title = 'Trecho com comentário — veja o painel à direita';
  try {
    range.surroundContents(span);
  } catch {
    try {
      const frag = range.extractContents();
      span.appendChild(frag);
      range.insertNode(span);
    } catch {
      return false;
    }
  }
  try {
    sel.removeAllRanges();
  } catch (_) { /* ignore */ }
  return true;
}

function stripCommentAnchorFromHtml(html, commentId) {
  if (!html || typeof document === 'undefined') return html;
  try {
    const d = document.createElement('div');
    d.innerHTML = html;
    d.querySelectorAll('span[data-postit-comment]').forEach((span) => {
      if (span.getAttribute('data-postit-comment') !== String(commentId)) return;
      const parent = span.parentNode;
      if (!parent) return;
      while (span.firstChild) parent.insertBefore(span.firstChild, span);
      parent.removeChild(span);
    });
    return d.innerHTML;
  } catch {
    return html;
  }
}

const POSTIT_COLORS = [
  { id: 'amber',  label: 'Âmbar',  bg: 'oklch(0.32 0.07 70)',  border: 'oklch(0.55 0.13 70)',  accent: 'oklch(0.85 0.15 75)' },
  { id: 'rose',   label: 'Rosa',   bg: 'oklch(0.30 0.07 20)',  border: 'oklch(0.50 0.13 20)',  accent: 'oklch(0.82 0.13 25)' },
  { id: 'violet', label: 'Violeta',bg: 'oklch(0.28 0.08 310)', border: 'oklch(0.48 0.14 310)', accent: 'oklch(0.78 0.14 310)' },
  { id: 'teal',   label: 'Teal',   bg: 'oklch(0.28 0.06 200)', border: 'oklch(0.48 0.12 200)', accent: 'oklch(0.78 0.13 200)' },
  { id: 'green',  label: 'Verde',  bg: 'oklch(0.28 0.06 155)', border: 'oklch(0.48 0.13 155)', accent: 'oklch(0.78 0.13 155)' },
  { id: 'gray',   label: 'Cinza',  bg: 'oklch(0.22 0.01 250)', border: 'oklch(0.40 0.02 250)', accent: 'oklch(0.75 0.01 250)' },
];

const POSTIT_TAGS = [
  { id: 'lembrete',  label: 'Lembretes',  icon: '🔔' },
  { id: 'tarefa',    label: 'Tarefas',    icon: '✓' },
  { id: 'habito',    label: 'Hábitos',    icon: '◉' },
  { id: 'ideia',     label: 'Ideias',     icon: '💡' },
  { id: 'evento',    label: 'Eventos',    icon: '📅' },
  { id: 'link',      label: 'Links',      icon: '🔗' },
  { id: 'dica',      label: 'Dicas',      icon: '⚡' },
  { id: 'priorizar', label: 'Priorizar',  icon: '⚑' },
  { id: 'compras',   label: 'Compras',    icon: '🛒' },
  { id: 'contas',    label: 'Contas',     icon: '💰' },
];

/** Mesmo breakpoint que app.jsx (768) — Post-its é ficheiro à parte, sem contexto partilhado. */
const STEPZ_POSTITS_MOBILE_MAX = 768;

function useStepzPostitsNarrow() {
  const [narrow, setNarrow] = React.useState(() => typeof window !== 'undefined' && window.innerWidth <= STEPZ_POSTITS_MOBILE_MAX);
  React.useEffect(() => {
    const fn = () => setNarrow(window.innerWidth <= STEPZ_POSTITS_MOBILE_MAX);
    window.addEventListener('resize', fn);
    window.addEventListener('orientationchange', fn);
    return () => {
      window.removeEventListener('resize', fn);
      window.removeEventListener('orientationchange', fn);
    };
  }, []);
  return narrow;
}

function defaultPostits() {
  return [
    {
      id: cryptoId(), title: 'Bem-vindo ao quadro', color: 'violet', tag: 'dica',
      items: [
        { id: cryptoId(), text: 'Clique em "+ post-it" para criar um novo' },
        { id: cryptoId(), text: 'Use a barra lateral para filtrar por categoria' },
        { id: cryptoId(), text: 'Arraste para reordenar' },
      ],
      comments: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
  ];
}

function PostitsView({ state, setState, onMovePostit }) {
  const postits = state.postits || [];
  const narrow = useStepzPostitsNarrow();
  const [filter, setFilter] = React.useState('all');
  const [editing, setEditing] = React.useState(null); // postit id

  const updatePostits = (updater) => {
    setState(s => ({ ...s, postits: updater(s.postits || []) }));
  };

  /* `filtered` (definido mais abaixo) é o subset visível conforme o filtro de categoria.
     O hook de drag opera nos índices visíveis; aqui traduzimos para índices reais no array global. */
  const moveVisible = React.useCallback((fromVis, toVis) => {
    if (typeof onMovePostit !== 'function') return;
    const all = state.postits || [];
    const visList = filter === 'all' ? all : all.filter(p => p.tag === filter);
    const src = visList[fromVis];
    if (!src) return;
    const realFrom = all.findIndex(p => p.id === src.id);
    let realTo;
    if (toVis >= visList.length) {
      /* Drop após o último visível: vai para a posição depois do último real desse subset.
         Se o filtro é "all", isto é simplesmente o fim do array. */
      const lastVis = visList[visList.length - 1];
      const lastRealIdx = lastVis ? all.findIndex(p => p.id === lastVis.id) : -1;
      realTo = lastRealIdx >= 0 ? lastRealIdx + 1 : all.length;
    } else {
      const target = visList[toVis];
      realTo = target ? all.findIndex(p => p.id === target.id) : all.length;
    }
    if (realFrom === realTo) return;
    onMovePostit(realFrom, realTo);
  }, [onMovePostit, state.postits, filter]);

  const masonryDrag = useMasonryDrag(moveVisible);

  const addPostit = () => {
    const np = {
      id: cryptoId(), title: 'Nova nota',
      color: POSTIT_COLORS[Math.floor(Math.random() * POSTIT_COLORS.length)].id,
      tag: filter !== 'all' ? filter : 'lembrete',
      items: [{ id: cryptoId(), text: '' }],
      comments: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    updatePostits(arr => [np, ...arr]);
    setEditing(np.id);
  };

  const updatePostit = (id, patch) => {
    updatePostits(arr => arr.map(p => p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p));
  };

  const deletePostit = (id) => {
    if (!confirm('Apagar este post-it?')) return;
    updatePostits(arr => arr.filter(p => p.id !== id));
  };

  const filtered = filter === 'all' ? postits : postits.filter(p => p.tag === filter);
  const counts = React.useMemo(() => {
    const c = { all: postits.length };
    POSTIT_TAGS.forEach(t => { c[t.id] = postits.filter(p => p.tag === t.id).length; });
    return c;
  }, [postits]);

  const activePostit = React.useMemo(() => postits.find((p) => p.id === editing) || null, [postits, editing]);

  const updateCommentBody = (postitId, commentId, body) => {
    updatePostits((arr) => arr.map((p) => {
      if (p.id !== postitId) return p;
      const comments = (p.comments || []).map((c) =>
        (c.id === commentId ? { ...c, body, updatedAt: new Date().toISOString() } : c));
      return { ...p, comments, updatedAt: new Date().toISOString() };
    }));
  };

  const deleteComment = (postitId, commentId) => {
    updatePostits((arr) => arr.map((p) => {
      if (p.id !== postitId) return p;
      const comments = (p.comments || []).filter((c) => c.id !== commentId);
      const items = p.items.map((it) => {
        if (!it.html) return it;
        const newHtml = stripCommentAnchorFromHtml(it.html, commentId);
        const plain = postitHtmlToPlain(newHtml);
        const emptyVisual = !plain && (!newHtml || newHtml === '<br>' || newHtml === '<div><br></div>');
        return {
          ...it,
          text: plain,
          html: emptyVisual ? undefined : newHtml,
        };
      });
      return { ...p, comments, items, updatedAt: new Date().toISOString() };
    }));
  };

  return (
    <>
    <style dangerouslySetInnerHTML={{ __html: `
      .postit-item-editor a { color: var(--postit-link-accent, #7c5cff); text-decoration: underline; text-underline-offset: 2px; }
      .postit-comment-mark {
        text-decoration: underline;
        text-underline-offset: 2px;
        background: rgba(255, 214, 102, 0.2);
        border-radius: 2px;
        padding: 0 2px;
      }
    ` }} />
    <div style={{
      display: 'grid',
      gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : 'minmax(160px, 180px) minmax(0, 1fr) minmax(240px, 300px)',
      gap: narrow ? 16 : 24,
      alignItems: 'start',
      width: '100%',
      minWidth: 0,
    }}>
      {/* Sidebar / filtros */}
      <div style={{
        position: narrow ? 'relative' : 'sticky',
        top: narrow ? undefined : 80,
        width: '100%',
        minWidth: 0,
      }}>
        <div style={{
          fontSize: 11,
          color: stepzTokens.textDim,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: narrow ? 8 : 10,
          paddingLeft: narrow ? 2 : 10,
        }}>
          Categorias
        </div>
        <div style={{
          display: 'flex',
          flexDirection: narrow ? 'row' : 'column',
          gap: narrow ? 6 : 4,
          overflowX: narrow ? 'auto' : 'visible',
          WebkitOverflowScrolling: 'touch',
          flexWrap: 'nowrap',
          paddingBottom: narrow ? 6 : 0,
        }}>
          <SidebarItem
            chip={narrow}
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            icon="◳"
            label="Todos"
            count={counts.all}
          />
          {POSTIT_TAGS.map(t => (
            <SidebarItem
              chip={narrow}
              key={t.id}
              active={filter === t.id}
              onClick={() => setFilter(t.id)}
              icon={t.icon}
              label={t.label}
              count={counts[t.id] || 0}
            />
          ))}
        </div>
        <button type="button" onClick={addPostit} style={{
          marginTop: 16, width: '100%',
          background: stepzTokens.accentGradient || stepzTokens.accent, color: '#0a0a0b', border: 'none',
          padding: '10px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          cursor: 'pointer', fontFamily: stepzTokens.font,
        }}>
          + post-it
        </button>
      </div>

      {/* Board */}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: narrow ? 22 : 26,
          fontWeight: 700,
          letterSpacing: -0.6,
          marginBottom: narrow ? 14 : 18,
          fontFamily: 'Georgia, serif',
          fontStyle: 'italic',
          lineHeight: 1.15,
        }}>
          Post-its
        </div>
        {filtered.length === 0 ? (
          <div style={{
            padding: '60px 20px', textAlign: 'center',
            background: stepzTokens.panel, border: `1px dashed ${stepzTokens.border}`,
            borderRadius: 12, color: stepzTokens.textFaint, fontSize: 13,
          }}>
            Nenhum post-it {filter !== 'all' ? 'nesta categoria' : 'ainda'}.
            <br/>
            <button onClick={addPostit} style={{
              marginTop: 12, background: 'transparent', border: `1px solid ${stepzTokens.border}`,
              color: stepzTokens.accent, padding: '6px 14px', borderRadius: 6,
              cursor: 'pointer', fontFamily: stepzTokens.font, fontSize: 12,
            }}>criar o primeiro</button>
          </div>
        ) : (
          <div style={{
            columnCount: narrow ? 1 : 3,
            columnGap: 16,
          }} className="postit-masonry">
            {filtered.map((p, idx) => {
              const isDragging = !!(masonryDrag.drag && masonryDrag.drag.fromIdx === idx);
              return (
                <PostitCard
                  key={p.id}
                  postit={p}
                  isEditing={editing === p.id}
                  onEdit={() => setEditing(p.id)}
                  onBlur={() => setEditing(null)}
                  onChange={patch => updatePostit(p.id, patch)}
                  onDelete={() => deletePostit(p.id)}
                  setItemRef={onMovePostit ? masonryDrag.setItemEl(idx) : undefined}
                  dragHandleProps={onMovePostit ? masonryDrag.getHandleProps(idx) : undefined}
                  isDragging={isDragging}
                  narrow={narrow}
                />
              );
            })}
          </div>
        )}
      </div>

      <div style={{
        position: narrow ? 'relative' : 'sticky',
        top: narrow ? undefined : 80,
        alignSelf: 'start',
        maxHeight: narrow ? 'min(42vh, 380px)' : 'calc(100vh - 96px)',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        width: '100%',
        minWidth: 0,
      }}>
        <PostitCommentsPanel
          postit={activePostit}
          onUpdateBody={updateCommentBody}
          onDelete={deleteComment}
        />
      </div>
    </div>
    </>
  );
}

function formatPostitCommentDay(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

function PostitCommentsPanel({ postit, onUpdateBody, onDelete }) {
  if (!postit) {
    return (
      <div style={{
        padding: 14,
        background: stepzTokens.panel,
        border: `1px solid ${stepzTokens.border}`,
        borderRadius: 10,
        fontSize: 12,
        color: stepzTokens.textDim,
        lineHeight: 1.45,
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: stepzTokens.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          Comentários
        </div>
        Clique num post-it para o editar. Selecione texto num item e use o botão 💬 na barra para ligar um comentário a esse trecho.
      </div>
    );
  }
  const comments = postit.comments || [];
  return (
    <div style={{
      padding: 14,
      background: stepzTokens.panel,
      border: `1px solid ${stepzTokens.border}`,
      borderRadius: 10,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: stepzTokens.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
        Comentários — {postit.title || 'Sem título'}
      </div>
      {comments.length === 0 ? (
        <div style={{ fontSize: 12, color: stepzTokens.textDim }}>
          Nenhum comentário. Selecione texto no post-it e clique em 💬 na barra de formatação.
        </div>
      ) : comments.map((c) => {
        const edited = c.updatedAt && c.createdAt && (new Date(c.updatedAt) - new Date(c.createdAt) > 1500);
        return (
          <div
            key={c.id}
            style={{
              marginBottom: 12,
              padding: 12,
              background: stepzTokens.panel2,
              borderRadius: 8,
              border: `1px solid ${stepzTokens.border}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: stepzTokens.accentSoft,
                color: stepzTokens.accent,
                fontSize: 12,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>T</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: stepzTokens.text }}>Tu</div>
                <div style={{ fontSize: 10, color: stepzTokens.textFaint }}>
                  {formatPostitCommentDay(c.createdAt)}
                  {edited ? <span style={{ marginLeft: 6 }}>(editado)</span> : null}
                </div>
              </div>
              <button
                type="button"
                title="Apagar comentário"
                onClick={() => {
                  if (!confirm('Apagar este comentário e o destaque no texto?')) return;
                  onDelete(postit.id, c.id);
                }}
                style={{
                  background: 'transparent',
                  border: `1px solid ${stepzTokens.border}`,
                  color: stepzTokens.textDim,
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontFamily: stepzTokens.font,
                }}
              >
                apagar
              </button>
            </div>
            <div style={{
              fontSize: 11,
              color: stepzTokens.textDim,
              marginBottom: 8,
              fontStyle: 'italic',
              wordBreak: 'break-word',
            }}>
              “{c.preview || '…'}”
            </div>
            <textarea
              value={c.body || ''}
              onChange={(e) => onUpdateBody(postit.id, c.id, e.target.value)}
              placeholder="Detalhes, links, dados…"
              style={{
                width: '100%',
                minHeight: 72,
                resize: 'vertical',
                background: 'rgba(0,0,0,0.25)',
                border: `1px solid ${stepzTokens.border}`,
                borderRadius: 6,
                color: stepzTokens.text,
                fontSize: 12,
                fontFamily: stepzTokens.font,
                padding: 8,
                outline: 'none',
                lineHeight: 1.45,
                boxSizing: 'border-box',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

function SidebarItem({ active, onClick, icon, label, count, chip }) {
  return (
    <button type="button" onClick={onClick}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
      style={{
        display: 'flex', alignItems: 'center', gap: chip ? 6 : 10,
        padding: chip ? '7px 10px' : '8px 10px', borderRadius: 6, cursor: 'pointer',
        background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
        border: `1px solid ${active ? stepzTokens.borderStrong : 'transparent'}`,
        color: active ? stepzTokens.text : stepzTokens.textDim,
        fontSize: chip ? 12 : 13, fontFamily: stepzTokens.font,
        textAlign: 'left',
        flexShrink: chip ? 0 : undefined,
        whiteSpace: chip ? 'nowrap' : undefined,
      }}>
      <span style={{ width: 16, fontSize: 12, opacity: 0.85 }}>{icon}</span>
      <span style={{ flex: chip ? 'none' : 1, textOverflow: chip ? 'ellipsis' : undefined, overflow: chip ? 'hidden' : undefined }}>{label}</span>
      {count > 0 && (
        <span style={{ fontSize: 10, color: stepzTokens.textFaint, fontFamily: stepzTokens.fontMono }}>
          {count}
        </span>
      )}
    </button>
  );
}

function PostitCard({ postit, isEditing, onEdit, onBlur, onChange, onDelete, setItemRef, dragHandleProps, isDragging, narrow }) {
  const color = POSTIT_COLORS.find(c => c.id === postit.color) || POSTIT_COLORS[0];
  const tag = POSTIT_TAGS.find(t => t.id === postit.tag);
  const [showColors, setShowColors] = React.useState(false);
  const [cardHover, setCardHover] = React.useState(false);

  const updateItem = (itemId, patch) => {
    onChange({ items: postit.items.map(it => it.id === itemId ? { ...it, ...patch } : it) });
  };
  const addItem = () => {
    onChange({ items: [...postit.items, { id: cryptoId(), text: '' }] });
  };
  const deleteItem = (itemId) => {
    onChange({ items: postit.items.filter(it => it.id !== itemId) });
  };

  return (
    <div
      ref={setItemRef || undefined}
      style={{
        breakInside: 'avoid',
        marginBottom: 16,
        background: color.bg,
        border: `1px solid ${color.border}`,
        borderRadius: 10,
        padding: '12px 14px 14px',
        position: 'relative',
        transition: 'transform .12s, box-shadow .12s, opacity .12s',
        opacity: isDragging ? 0.55 : 1,
        transform: isDragging ? 'scale(0.985)' : 'none',
      }}
      onMouseEnter={(e) => {
        setCardHover(true);
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
        const ctrl = e.currentTarget.querySelector('[data-controls]');
        if (ctrl) ctrl.style.opacity = 1;
      }}
      onMouseLeave={(e) => {
        setCardHover(false);
        e.currentTarget.style.boxShadow = 'none';
        const ctrl = e.currentTarget.querySelector('[data-controls]');
        if (ctrl) ctrl.style.opacity = 0;
      }}
    >
      {/* Header: drag handle (opcional) + tag icon + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {dragHandleProps ? (
          <button
            type="button"
            {...dragHandleProps}
            aria-label="Arrastar para reordenar"
            title="Arrastar para reordenar"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              width: 28,
              height: 28,
              marginLeft: -8,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isDragging ? 'grabbing' : 'grab',
              color: color.accent,
              touchAction: 'none',
              opacity: isDragging ? 1 : (narrow ? 0.65 : (cardHover ? 0.7 : 0.2)),
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
        ) : null}
        <span style={{ fontSize: 13, color: color.accent, opacity: 0.9 }}>{tag?.icon || '◉'}</span>
        <input
          value={postit.title}
          onChange={e => onChange({ title: e.target.value })}
          onFocus={onEdit}
          placeholder="Título"
          style={{
            flex: 1, background: 'transparent', border: 'none',
            color: color.accent, fontWeight: 600, fontSize: 14,
            fontFamily: stepzTokens.font, outline: 'none', padding: 0,
            letterSpacing: -0.2,
          }}
        />
      </div>

      {/* Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {postit.items.map(it => (
          <PostitItem
            key={it.id}
            item={it}
            color={color}
            onChange={patch => updateItem(it.id, patch)}
            onDelete={() => deleteItem(it.id)}
            onAddBelow={addItem}
            onFocus={onEdit}
            onCommentAnchorCreated={({ commentId, itemId, preview }) => {
              const next = [...(postit.comments || []), {
                id: commentId,
                itemId,
                preview,
                body: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }];
              onChange({ comments: next });
            }}
          />
        ))}
      </div>

      <button onClick={addItem}
        style={{
          marginTop: 8, background: 'transparent', border: 'none',
          color: color.accent, opacity: 0.55, fontSize: 11,
          cursor: 'pointer', padding: '2px 0', fontFamily: stepzTokens.font,
        }}
        onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
        onMouseLeave={(e) => e.currentTarget.style.opacity = 0.55}>
        + item
      </button>

      {/* Controls (visible on hover) */}
      <div data-controls style={{
        position: 'absolute', top: 8, right: 8,
        display: 'flex', gap: 4,
        opacity: 0, transition: 'opacity .15s',
      }}>
        {/* Tag selector */}
        <select value={postit.tag} onChange={e => onChange({ tag: e.target.value })}
          style={{
            background: 'rgba(0,0,0,0.3)', border: `1px solid ${color.border}`,
            color: color.accent, fontSize: 10, padding: '2px 4px', borderRadius: 4,
            fontFamily: stepzTokens.font, outline: 'none', cursor: 'pointer',
          }}>
          {POSTIT_TAGS.map(t => <option key={t.id} value={t.id} style={{ color: '#000', background: '#fff' }}>{t.label}</option>)}
        </select>
        {/* Color swatches */}
        <button onClick={() => setShowColors(!showColors)}
          style={{
            width: 18, height: 18, borderRadius: 9,
            background: color.accent, border: '1px solid rgba(0,0,0,0.3)',
            cursor: 'pointer', padding: 0,
          }}/>
        {showColors && (
          <div style={{
            position: 'absolute', top: 24, right: 0, zIndex: 5,
            background: '#1a1a20', border: `1px solid ${stepzTokens.borderStrong}`,
            borderRadius: 6, padding: 6, display: 'flex', gap: 4,
          }}>
            {POSTIT_COLORS.map(c => (
              <button key={c.id} onClick={() => { onChange({ color: c.id }); setShowColors(false); }}
                style={{
                  width: 18, height: 18, borderRadius: 9,
                  background: c.accent, border: c.id === postit.color ? '2px solid #fff' : '1px solid rgba(0,0,0,0.3)',
                  cursor: 'pointer', padding: 0,
                }}/>
            ))}
          </div>
        )}
        {/* Delete */}
        <button onClick={onDelete} title="Apagar"
          style={{
            background: 'rgba(0,0,0,0.3)', border: `1px solid ${color.border}`,
            color: color.accent, fontSize: 12, width: 18, height: 18, borderRadius: 4,
            cursor: 'pointer', padding: 0, lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
      </div>
    </div>
  );
}

function PostitFormatToolbar({ editorRef, accent, onComment }) {
  const run = (cmd, val) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    try {
      document.execCommand(cmd, false, val);
    } catch (_) { /* browsers variam */ }
  };
  const btnBase = {
    minWidth: 26,
    height: 26,
    padding: '0 6px',
    borderRadius: 5,
    border: `1px solid rgba(255,255,255,0.14)`,
    background: 'rgba(0,0,0,0.35)',
    color: stepzTokens.text,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: stepzTokens.font,
    lineHeight: 1,
  };
  return (
    <div
      onMouseDown={(e) => e.preventDefault()}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 4,
        marginBottom: 6,
        padding: '6px 8px',
        borderRadius: 6,
        background: 'rgba(0,0,0,0.28)',
        border: `1px solid rgba(255,255,255,0.08)`,
      }}
    >
      <button type="button" title="Negrito" onMouseDown={(e) => e.preventDefault()} onClick={() => run('bold')} style={{ ...btnBase, fontWeight: 800 }}>B</button>
      <button type="button" title="Itálico" onMouseDown={(e) => e.preventDefault()} onClick={() => run('italic')} style={{ ...btnBase, fontStyle: 'italic', fontWeight: 600 }}>I</button>
      <button type="button" title="Sublinhar" onMouseDown={(e) => e.preventDefault()} onClick={() => run('underline')} style={{ ...btnBase, textDecoration: 'underline' }}>U</button>
      <button type="button" title="Riscado" onMouseDown={(e) => e.preventDefault()} onClick={() => run('strikeThrough')} style={{ ...btnBase, textDecoration: 'line-through' }}>S</button>
      {typeof onComment === 'function' ? (
        <button type="button" title="Comentário neste trecho — painel à direita" onMouseDown={(e) => e.preventDefault()} onClick={() => onComment()} style={{ ...btnBase, fontSize: 13 }}>💬</button>
      ) : null}
      <span style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.12)', margin: '0 2px' }} aria-hidden />
      {POSTIT_FONT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          title={`Cor ${c}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run('foreColor', c)}
          style={{
            width: 22,
            height: 22,
            borderRadius: 4,
            padding: 0,
            border: `2px solid ${c === '#f2efe9' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}`,
            background: c,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        />
      ))}
      <label
        title="Outra cor"
        onMouseDown={(e) => e.preventDefault()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 26,
          height: 26,
          borderRadius: 5,
          border: `1px dashed ${accent}`,
          cursor: 'pointer',
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.06)',
        }}
      >
        <input
          type="color"
          defaultValue="#f2efe9"
          onChange={(e) => run('foreColor', e.target.value)}
          style={{ width: 32, height: 32, padding: 0, border: 'none', cursor: 'pointer', transform: 'scale(1.2)' }}
          aria-label="Cor personalizada"
        />
      </label>
      <button type="button" title="Limpar formatação" onMouseDown={(e) => e.preventDefault()} onClick={() => run('removeFormat')} style={{ ...btnBase, fontSize: 10, fontWeight: 600 }}>limpar</button>
    </div>
  );
}

function PostitItem({ item, color, onChange, onDelete, onAddBelow, onFocus, onCommentAnchorCreated }) {
  const editorRef = React.useRef(null);
  const selRafRef = React.useRef(null);
  const [showTools, setShowTools] = React.useState(false);

  const syncToolbar = React.useCallback(() => {
    const el = editorRef.current;
    setShowTools(el ? postitEditorHasTextSelection(el) : false);
  }, []);

  const scheduleSyncToolbar = React.useCallback(() => {
    if (selRafRef.current != null) cancelAnimationFrame(selRafRef.current);
    selRafRef.current = requestAnimationFrame(() => {
      selRafRef.current = null;
      syncToolbar();
    });
  }, [syncToolbar]);

  React.useEffect(() => {
    const onSelectionChange = () => scheduleSyncToolbar();
    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      if (selRafRef.current != null) cancelAnimationFrame(selRafRef.current);
    };
  }, [scheduleSyncToolbar]);

  React.useLayoutEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const html = item.html
      ? postitSanitizeHtml(item.html)
      : postitTextToHtml(item.text);
    el.innerHTML = html || '<br>';
  }, [item.id]);

  const flush = React.useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const rawHtml = postitSanitizeHtml(el.innerHTML);
    const plain = postitHtmlToPlain(rawHtml);
    const payload = { text: plain };
    const emptyVisual = !plain && (!rawHtml || rawHtml === '<br>' || rawHtml === '<div><br></div>');
    if (!emptyVisual && rawHtml) payload.html = rawHtml;
    else payload.html = undefined;
    onChange(payload);
  }, [onChange]);

  const tryCreateComment = React.useCallback(() => {
    const el = editorRef.current;
    if (!el || !postitEditorHasTextSelection(el) || !onCommentAnchorCreated) return;
    const sel = window.getSelection();
    const preview = String(sel?.toString() || '').replace(/\u200b/g, '').trim().slice(0, 200);
    const commentId = cryptoId();
    if (!wrapPostitCommentAnchor(el, commentId)) return;
    flush();
    onCommentAnchorCreated({ commentId, itemId: item.id, preview });
    setShowTools(false);
    scheduleSyncToolbar();
  }, [flush, item.id, onCommentAnchorCreated, scheduleSyncToolbar]);

  const onEditorKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      flush();
      onAddBelow();
      return;
    }
    if (e.key === 'Backspace') {
      const plain = postitHtmlToPlain(editorRef.current?.innerHTML || '');
      if (!plain) {
        e.preventDefault();
        onDelete();
      }
    }
  };

  return (
    <div style={{ width: '100%', ['--postit-link-accent']: color.accent }}>
      {showTools ? (
        <PostitFormatToolbar
          editorRef={editorRef}
          accent={color.accent}
          onComment={onCommentAnchorCreated ? tryCreateComment : undefined}
        />
      ) : null}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{
          marginTop: 9, width: 4, height: 4, borderRadius: 2,
          background: color.accent, opacity: 0.7, flexShrink: 0,
        }}/>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          onInput={flush}
          onFocus={() => { onFocus(); }}
          onBlur={() => { flush(); setShowTools(false); }}
          onMouseUp={(e) => {
            if (!editorRef.current?.contains(e.target)) return;
            requestAnimationFrame(() => {
              requestAnimationFrame(() => syncToolbar());
            });
          }}
          onKeyUp={() => scheduleSyncToolbar()}
          onKeyDown={onEditorKeyDown}
          title="Selecione texto para mostrar negrito, cores, etc. Enter novo item; Shift+Enter nova linha."
          className="postit-item-editor"
          style={{
            flex: 1,
            minHeight: 22,
            background: 'transparent',
            border: 'none',
            color: stepzTokens.text,
            fontSize: 13,
            fontFamily: stepzTokens.font,
            outline: 'none',
            padding: '2px 0',
            lineHeight: 1.45,
            wordBreak: 'break-word',
          }}
        />
      </div>
    </div>
  );
}

Object.assign(window, { PostitsView, defaultPostits, POSTIT_TAGS, POSTIT_COLORS });
