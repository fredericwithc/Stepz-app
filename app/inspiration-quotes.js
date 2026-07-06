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
  { q: "If you don't ask, the answer is always no.", a: '' },
  { q: "A big part of who I am, is who I'm not anymore.", a: '' },
  { q: "Be the reason someone believes in goodness again. Not because you're perfect. But because you chose to be kind when you had every reason not to.", a: '' },
  { q: "You will never taste victory if you fear the start.", a: '' },
  { q: "Hesitation is the enemy of success, and inaction is the grave of potential. The beginning is the gateway to everything you can achieve.", a: '' },
  { q: "You are allowed to rest, to heal, to begin again. ", a: '' },
  { q: "You've made it through so much you thought would break you. But you are here. You made it this far. Don't forget how far you've come.", a: '' },
  { q: "Stop expecting everyone to have the same heart as you do.", a: '' },
  { q: "Just in case no one reminded you today, you are rare, you are valuable. You matter more than you think.", a: '' },
  { q: "Don't forget to imagine the best case scenario, too.", a: '' },
  { q: "Everything is a win when the goal is the experience.", a: '' },
  { q: "Self-worth isn't something that someone gives to you, which means it's not something they can take away either.", a: '' },
  { q: "You already know what to do, you're just negotiating with comfort.", a: '' },
  { q: "If you don't step forward, then you will always be in the same place.", a: '' },
  { q: "Never regret having a big heart. You didn't lose by giving too much, they lost by not knowing how to keep it.", a: '' },
  { q: "Life is only as good as your mindset. A negative mind will never give you a positive life.", a: '' },
  { q: "Make sure to include yourself on the list of things you need to take care of this week, ok?", a: '' },
  { q: "Reminder: It takes time..", a: '' },
  { q: "Maybe we should just let things be, let people go, don't chase answers, don't fight for closure and never expect an explanation.", a: '' },
  { q: "Always be a good person, even if nothing comes back in return.", a: '' },
  { q: "In a world obssessed with more, is easy to forget the beauty of less. A simple life doesn't mean settling. It means being free from endless chase.", a: '' },
  { q: "Growth isn't always loud or obvious. Sometimes it's simply choosing to keep going, even on the days that feel hard.", a: '' },
  { q: "Maybe real strenght is about being gentle when life gives you evey reason to be hard.", a: '' },
  { q: "Being kind is not a strategy, it's a decision. It's not about a reward. It's about who you choose to be, when no one else is watching.", a: '' },
  { q: "If you do not go after what you want, you'll never have it.", a: '' },
  { q: "Appreciate everything. Appreciate when you walk outside and the sun warms you. Appreciate it when someone smiles at you. Appreciate who you are.", a: '' },
  { q: "Sometimes you just need to watch the sunset. See the sky glow in all the shades of orange and red.", a: '' },
  { q: "Be sure that everyday is a new chance. A new chance to be anything that you want and to do amazing things.", a: '' },
  { q: "The bad news is everything is temporary. Which is also the good news. So if things are going good, enjoy it.", a: '' },
  { q: "You will never be this age again. So please do what makes you happy. Stop waiting for permission. Stop waiting for the right time.", a: '' },
  { q: "Take the trip. Start the thing. Tell the person. Wear the outfit. Try the new hobby. Life is happening right now.", a: '' },
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
