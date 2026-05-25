// OpenAI API wrapper + offline/fallback path.
// Exposes: OpenAI.generateWords({apiKey, category, exclude, n}), OpenAI.explain(...),
//          OpenAI.tts(apiKey, text) -> Blob, OpenAI.loadFallback().
const OpenAI = (() => {
  const CHAT_URL = 'https://api.openai.com/v1/chat/completions';
  const TTS_URL  = 'https://api.openai.com/v1/audio/speech';
  const MODEL = 'gpt-4o-mini';
  const TTS_MODEL = 'gpt-4o-mini-tts';

  const CATEGORIES = {
    emails:      'professional emails (greetings, requests, follow-ups, status updates)',
    standups:    'daily standups (yesterday/today/blockers, sprint vocabulary)',
    code_review: 'code review comments (suggestions, criticism, approval, style)',
    architecture:'software architecture discussions (systems, scaling, trade-offs)',
    interview:   'tech interviews (behavioral and technical answers)',
    mixed:       'mixed software developer professional communication',
  };

  let fallbackCache = null;
  const loadFallback = async () => {
    if (fallbackCache) return fallbackCache;
    try {
      const r = await fetch('wordlist.json');
      fallbackCache = await r.json();
    } catch {
      fallbackCache = { mixed: [] };
    }
    return fallbackCache;
  };

  const pickFallback = async ({ category, exclude = [], n = 10 }) => {
    const data = await loadFallback();
    // Aggregate the picked category + all others as widening pool.
    const primary = (data[category] && data[category].length ? data[category] : []);
    const allWords = [];
    const seenWord = new Set();
    const push = (w) => {
      const k = w.word.toLowerCase();
      if (!seenWord.has(k)) { seenWord.add(k); allWords.push(w); }
    };
    primary.forEach(push);
    Object.keys(data).forEach((cat) => {
      if (cat !== category) (data[cat] || []).forEach(push);
    });
    const excl = new Set(exclude.map((w) => w.toLowerCase()));
    let available = allWords.filter((w) => !excl.has(w.word.toLowerCase()));
    // If user has seen every word in the bundled list, recycle the whole pool.
    if (!available.length) available = allWords;
    return available.sort(() => Math.random() - 0.5).slice(0, n);
  };

  const chatJSON = async ({ apiKey, system, user, temperature = 0.7 }) => {
    const r = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`OpenAI ${r.status}: ${t.slice(0, 200)}`);
    }
    const j = await r.json();
    const text = j.choices?.[0]?.message?.content || '{}';
    return JSON.parse(text);
  };

  const generateWords = async ({ apiKey, category = 'mixed', exclude = [], n = 10 }) => {
    if (!apiKey || !navigator.onLine) {
      return pickFallback({ category, exclude, n });
    }
    const ctx = CATEGORIES[category] || CATEGORIES.mixed;
    const excludeList = exclude.slice(-80).join(', ');
    const system = `You are an English vocabulary coach for a software developer at B1→B2 level (CEFR). Output strict JSON only.`;
    const user = `Generate exactly ${n} useful English words or short phrases for "${ctx}".
Level: B1-B2 (not too simple like "good", not too rare).
Avoid these already seen: ${excludeList || '(none)'}.
Return JSON: {"words":[{"word":"...","ipa":"/.../","translation_sk":"...","example_sentence":"...","example_translation":"..."}]}`;
    try {
      const j = await chatJSON({ apiKey, system, user });
      const words = Array.isArray(j.words) ? j.words : [];
      if (!words.length) return pickFallback({ category, exclude, n });
      return words;
    } catch (e) {
      console.warn('generateWords fallback:', e.message);
      return pickFallback({ category, exclude, n });
    }
  };

  const generateClozeQuiz = async ({ apiKey, words }) => {
    // For each word produce { sentence_with_blank, answer, distractors[3] }.
    if (!apiKey || !navigator.onLine) {
      return words.map((w) => buildLocalCloze(w, words));
    }
    const list = words.map((w) => w.word).join(', ');
    const system = 'You build cloze (fill-in-the-blank) vocabulary quizzes. Output strict JSON.';
    const user = `For each of these B1-B2 dev-context words: ${list}
Create one cloze sentence per word and 3 plausible but wrong distractor words.
Return JSON: {"items":[{"word":"...","sentence":"... ___ ...","distractors":["a","b","c"]}]}`;
    try {
      const j = await chatJSON({ apiKey, system, user });
      const map = new Map((j.items || []).map((i) => [i.word.toLowerCase(), i]));
      return words.map((w) => {
        const m = map.get(w.word.toLowerCase());
        if (m) return { word: w.word, sentence: m.sentence, distractors: m.distractors };
        return buildLocalCloze(w, words);
      });
    } catch (e) {
      console.warn('cloze fallback:', e.message);
      return words.map((w) => buildLocalCloze(w, words));
    }
  };

  const buildLocalCloze = (w, all) => {
    const ex = w.example_sentence || `Please use the word ${w.word}.`;
    const re = new RegExp(`\\b${escapeRe(w.word)}\\b`, 'i');
    const sentence = re.test(ex) ? ex.replace(re, '___') : `${ex} (word: ___)`;
    const others = all.filter((x) => x.word !== w.word).map((x) => x.word);
    const distractors = others.sort(() => Math.random() - 0.5).slice(0, 3);
    while (distractors.length < 3) distractors.push('something');
    return { word: w.word, sentence, distractors };
  };

  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const explain = async ({ apiKey, text }) => {
    if (!apiKey) throw new Error('No API key');
    const system = 'You explain English words/phrases to a B1-B2 Slovak-speaking software developer. Be concise.';
    const user = `Explain "${text}" in a software developer context. Return JSON:
{"meaning_en":"short","translation_sk":"...","example":"short dev-context sentence","example_sk":"..."}`;
    return chatJSON({ apiKey, system, user, temperature: 0.4 });
  };

  const tts = async ({ apiKey, text, voice = 'alloy' }) => {
    const r = await fetch(TTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: TTS_MODEL, voice, input: text, format: 'mp3' }),
    });
    if (!r.ok) throw new Error(`TTS ${r.status}`);
    return r.blob();
  };

  return { generateWords, generateClozeQuiz, explain, tts, loadFallback };
})();
