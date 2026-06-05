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
  { q: "I don't disappear to be rude. I disappear to breath, think and reset. Time alone makes me better company later.", a: '' },
  { q: "The person who always takes care of everyone else, needs to be taken care of too.", a: '' },
  { q: "The most valuable thing you can give someone is your time.", a: '' },
  { q: "If you are going to overthink, then overthink the positives. Overthink the best outcome. Overthink how good this life could be.", a: '' },
  { q: "Stop rushing. Don't waste your time holding on to the things you cannot change. If it's out of your control, let it be out of your mind.", a: '' },
  { q: "The amount of good things in your life, depends on your ability to notice them.", a: '' },
  { q: "You will lose yourself more than once, you will find yourself more than once too. That is the journey. To forget. To remember. To begin again.", a: '' },
  { q: "You have fought battles that no one knows about. And you're still going. That matters.", a: '' },
  { q: "If you can overthink the worst, why can't you overthink the best?", a: '' },
  { q: "Forgive yourself for not knowing earlier what only time could teach", a: '' },
  { q: "Imagine reading a book with no way to turn back the page, how carefully would you read it? That's life.", a: '' },
  { q: "Maybe the secret to having a good life is realizing how good it already is.", a: '' },
  { q: "Some seasons of life will change you, and that's okay, we aren't meant to stay the same.", a: '' },
  { q: "You will get there. But right now you are here. And here is beautiful.", a: '' },
  { q: "There are moments where silence says more than words ever could.", a: '' },
  { q: "A big part of who I am, is who I'm not anymore.", a: '' },
  { q: "Be the reason someone believes in goodness again. Not because you're perfect. But because you chose to be kind when you had every reason not to.", a: '' },
  { q: "You will never taste victory if you fear the start.", a: '' },
  { q: "Hesitation is the enemy of success, and inaction is the grave of potential. The beginning is the gateway to everything you can achieve.", a: '' },
  { q: "You are allowed to rest, to heal, to begin again. ", a: '' },
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
