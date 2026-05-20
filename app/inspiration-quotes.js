// Catálogo de frases para "Inspiração do dia" na Home.
// Edite INSPIRATION_QUOTES: uma entrada por frase, na ordem da rotação (dia 0 = primeira).
// Formato: { q: 'texto da frase', a: 'autor opcional' } — deixe a: '' se não quiser autor.
// INSPIRATION_QUOTES_EPOCH: o primeiro dia desta data mostra a frase [0]; cada dia de calendário avança uma posição.

/** Data âncora (YYYY-MM-DD, UTC). Ajuste ao publicar o catálogo se quiser reiniciar a sequência. */
const INSPIRATION_QUOTES_EPOCH = '2026-05-20';

const INSPIRATION_QUOTES = [
  { q: "A waterfall wouldn't sound so great, if there wasn't any rocks in its way", a: '' },
  { q: "It's okay to feel strong one day and overwhelmed the next. You are human. You are not meant to feel the same every day", a: '' },
  { q: "No matter your age, you'll always wish you started younger. But today is the youngest you'll ever be. So start today!", a: '' },
  { q: "Maybe the point was never permanence, but presence. To be here, now, with all that we are.", a: '' },
  { q: "I don't disappear to be rude. I disappear to breath, think and reset. Time alone makes me better company later.", a: 'L. Buscaglia' },
  { q: "The person who always takes care of everyone else, needs to be taken care of too.", a: '' },
  { q: "The most valuable thing you can give someone is your time.", a: 'Arthur Ashe' },
  { q: "If you are going to overthink, then overthink the positives. Overthink the best outcome. Overthink how good this life could be.", a: '' },
];

/** Dias de calendário entre duas datas ISO (YYYY-MM-DD), fim inclusivo em relação ao início. */
function inspirationDaysSince(fromStr, toStr) {
  const a = new Date(`${String(fromStr || '').slice(0, 10)}T12:00:00Z`);
  const b = new Date(`${String(toStr || '').slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/**
 * Frase do dia: índice sequencial = dias desde epoch, módulo tamanho da lista.
 * @returns {{ quote: { q, a }, index: number, total: number } | null}
 */
function pickInspirationForDay(quotes, epoch, dateKey) {
  const list = Array.isArray(quotes) ? quotes : [];
  const n = list.length;
  if (!n) return null;
  const epochKey = String(epoch || '').slice(0, 10) || dateKey;
  const dayKey = String(dateKey || '').slice(0, 10);
  const dayIndex = inspirationDaysSince(epochKey, dayKey);
  const idx = ((dayIndex % n) + n) % n;
  const item = list[idx];
  if (!item || typeof item.q !== 'string' || !String(item.q).trim()) return null;
  return {
    quote: { q: String(item.q).trim(), a: String(item.a || '').trim() },
    index: idx,
    total: n,
  };
}

Object.assign(window, {
  INSPIRATION_QUOTES,
  INSPIRATION_QUOTES_EPOCH,
  inspirationDaysSince,
  pickInspirationForDay,
});
