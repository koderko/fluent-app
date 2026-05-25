// Storage helpers — namespaced localStorage with JSON.
const Storage = (() => {
  const PREFIX = 'de_'; // dev-english

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
  });

  const saveSettings = (s) => {
    if (s.apiKey !== undefined) set('apiKey', s.apiKey);
    if (s.category !== undefined) set('category', s.category);
    if (s.ttsMode !== undefined) set('ttsMode', s.ttsMode);
  };

  const getDeck = () => get('srsDeck', {});
  const saveDeck = (deck) => set('srsDeck', deck);

  const getStats = () => get('stats', {
    sessions: 0,
    streak: 0,
    lastDay: null,
    learnedCount: 0,
    recent: [], // [{word, ts}]
  });
  const saveStats = (s) => set('stats', s);

  const getCache = () => get('wordCache', []);
  const saveCache = (c) => set('wordCache', c.slice(-50));

  return { get, set, remove, getSettings, saveSettings, getDeck, saveDeck, getStats, saveStats, getCache, saveCache };
})();
