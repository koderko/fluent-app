// Storage helpers — namespaced localStorage with JSON.
const Storage = (() => {
  const PREFIX = 'de_'; // dev-english
  const DECK_TYPES = ['word', 'phrasal', 'tense'];

  const get = (key, fallback = null) => {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  };

  const set = (key, value) => {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage set failed', e);
    }
  };

  const remove = (key) => localStorage.removeItem(PREFIX + key);

  const getSettings = () => ({
    apiKey: get('apiKey', ''),
    category: get('category', 'mixed'),
    ttsMode: get('ttsMode', 'browser'),
    activeDeck: get('activeDeck', 'word'),
  });

  const saveSettings = (s) => {
    if (s.apiKey !== undefined) set('apiKey', s.apiKey);
    if (s.category !== undefined) set('category', s.category);
    if (s.ttsMode !== undefined) set('ttsMode', s.ttsMode);
    if (s.activeDeck !== undefined && DECK_TYPES.includes(s.activeDeck)) set('activeDeck', s.activeDeck);
  };

  // Per-type decks (de_srsDeck_word / _phrasal / _tense).
  // One-time migration: move legacy `de_srsDeck` → `de_srsDeck_word`.
  const migrateLegacyDeck = () => {
    const legacy = get('srsDeck', null);
    if (legacy && Object.keys(legacy).length && !localStorage.getItem(PREFIX + 'srsDeck_word')) {
      set('srsDeck_word', legacy);
      remove('srsDeck');
    }
  };
  migrateLegacyDeck();

  const getDeck = (type) => get('srsDeck_' + (type || getSettings().activeDeck), {});
  const saveDeck = (deck, type) => set('srsDeck_' + (type || getSettings().activeDeck), deck);

  // Per-type word/item cache.
  const getCache = (type) => get('cache_' + (type || getSettings().activeDeck), []);
  const saveCache = (c, type) => set('cache_' + (type || getSettings().activeDeck), c.slice(-50));

  const getStats = () => get('stats', {
    sessions: 0,
    streak: 0,
    lastDay: null,
    learnedCount: 0,
    recent: [], // [{word, ts}]
  });
  const saveStats = (s) => set('stats', s);

  return { get, set, remove, getSettings, saveSettings, getDeck, saveDeck, getStats, saveStats, getCache, saveCache, DECK_TYPES };
})();
