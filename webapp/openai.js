// OpenAI API wrapper + offline/fallback path.
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
      const j = await r.json();
      // Support both legacy (flat categories at top level) and new schema
      // ({words:{...}, phrasals:[], tenses:[]}). Normalize to new shape.
      if (j.words || j.phrasals || j.tenses) {
        fallbackCache = {
          words: j.words || {},
          phrasals: Array.isArray(j.phrasals) ? j.phrasals : [],
          tenses: Array.isArray(j.tenses) ? j.tenses : [],
        };
      } else {
        fallbackCache = { words: j, phrasals: [], tenses: [] };
      }
    } catch {
      fallbackCache = { words: { mixed: [] }, phrasals: [], tenses: [] };
    }
    return fallbackCache;
  };

  const pickFallback = async ({ category, exclude = [], n = 10 }) => {
    const data = await loadFallback();
    const words = data.words || {};
    const primary = (words[category] && words[category].length ? words[category] : []);
    const allWords = [];
    const seenWord = new Set();
    const push = (w) => {
      const k = w.word.toLowerCase();
      if (!seenWord.has(k)) { seenWord.add(k); allWords.push(w); }
    };
    primary.forEach(push);
    Object.keys(words).forEach((cat) => {
      if (cat !== category) (words[cat] || []).forEach(push);
    });
    const excl = new Set(exclude.map((w) => w.toLowerCase()));
    let available = allWords.filter((w) => !excl.has(w.word.toLowerCase()));
    if (!available.length) available = allWords;
    return available.sort(() => Math.random() - 0.5).slice(0, n);
  };

  const pickFallbackList = async (kind, { exclude = [], n = 10, idField }) => {
    const data = await loadFallback();
    const pool = data[kind] || [];
    const excl = new Set(exclude.map((x) => String(x).toLowerCase()));
    let available = pool.filter((it) => !excl.has(String(it[idField]).toLowerCase()));
    if (!available.length) available = pool;
    return available.slice().sort(() => Math.random() - 0.5).slice(0, n);
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

  const generatePhrasals = async ({ apiKey, exclude = [], n = 10 }) => {
    if (!apiKey || !navigator.onLine) {
      return pickFallbackList('phrasals', { exclude, n, idField: 'phrase' });
    }
    const excludeList = exclude.slice(-80).join(', ');
    const system = 'You teach English phrasal verbs to a B1-B2 Slovak-speaking software developer. Output strict JSON.';
    const user = `Generate exactly ${n} common, useful English phrasal verbs in a software developer context.
Avoid: ${excludeList || '(none)'}.
Return JSON:
{"phrasals":[{"phrase":"look into","meaning_sk":"preskúmať","particle":"into","base_verb":"look","example_sentence":"...","example_translation":"...","gap_template":"... ___ ...","alt_phrases":["look up","look after","look over"]}]}
"gap_template" must be the example sentence with the phrasal verb replaced by "___".
"alt_phrases" are 3 plausible distractors that share the base verb or particle.`;
    try {
      const j = await chatJSON({ apiKey, system, user });
      const items = Array.isArray(j.phrasals) ? j.phrasals : [];
      if (!items.length) return pickFallbackList('phrasals', { exclude, n, idField: 'phrase' });
      return items;
    } catch (e) {
      console.warn('generatePhrasals fallback:', e.message);
      return pickFallbackList('phrasals', { exclude, n, idField: 'phrase' });
    }
  };

  const generateTenseItems = async ({ apiKey, exclude = [], n = 10 }) => {
    if (!apiKey || !navigator.onLine) {
      return pickFallbackList('tenses', { exclude, n, idField: 'prompt' });
    }
    const excludeList = exclude.slice(-80).join(' || ');
    const system = 'You design English tense practice exercises for a B1-B2 Slovak-speaking learner. Output strict JSON.';
    const user = `Generate exactly ${n} English tense exercises in a software developer context.
Mix three task types randomly: "gap_fill", "mcq", "transform".
Cover a variety of tenses (present simple/continuous/perfect/perfect continuous, past simple/continuous/perfect, future simple/continuous/perfect, conditionals, passive voice).
Avoid prompts: ${excludeList || '(none)'}.
Return JSON:
{"tenses":[
  {"tense":"present perfect","task":"gap_fill","prompt":"I (fix) the bug already.","answer":"have fixed","explanation_sk":"krátke vysvetlenie po slovensky."},
  {"tense":"past simple","task":"mcq","prompt":"We ___ the hotfix yesterday.","options":["deploy","deployed","have deployed","were deploying"],"answer":"deployed","explanation_sk":"..."},
  {"tense":"future perfect","task":"transform","prompt":"Prepíš do Future Perfect: 'I finish the report.' (by Friday)","answer":"I will have finished the report by Friday.","explanation_sk":"..."}
]}
Rules:
- "gap_fill": prompt contains either ___ blank or (verb) in parentheses; "answer" is exact expected token(s) without surrounding text.
- "mcq": exactly 4 plausible options; one of them MUST equal "answer".
- "transform": prompt instructs how to rewrite a sentence; "answer" is one acceptable full-sentence rewrite.
- "explanation_sk": one short Slovak sentence.`;
    try {
      const j = await chatJSON({ apiKey, system, user, temperature: 0.6 });
      const items = Array.isArray(j.tenses) ? j.tenses : [];
      if (!items.length) return pickFallbackList('tenses', { exclude, n, idField: 'prompt' });
      return items;
    } catch (e) {
      console.warn('generateTenseItems fallback:', e.message);
      return pickFallbackList('tenses', { exclude, n, idField: 'prompt' });
    }
  };

  const gradeTenseTransform = async ({ apiKey, prompt, expected, userAnswer }) => {
    if (!apiKey || !navigator.onLine) {
      const ok = typeof Speech !== 'undefined' && Speech.matches
        ? Speech.matches(userAnswer || '', expected || '')
        : (userAnswer || '').trim().toLowerCase() === (expected || '').trim().toLowerCase();
      return { correct: ok, feedback_sk: ok ? 'Správne.' : `Očakávané: ${expected}` };
    }
    const system = 'You grade English tense rewrites. Accept semantically equivalent rewrites that use the correct target tense. Output strict JSON.';
    const user = `Task: ${prompt}
Reference answer: ${expected}
Student answer: ${userAnswer}
Return JSON: {"correct": true|false, "feedback_sk":"krátka spätná väzba po slovensky, max 1 veta"}`;
    try {
      return await chatJSON({ apiKey, system, user, temperature: 0.2 });
    } catch (e) {
      console.warn('gradeTenseTransform fallback:', e.message);
      const ok = (userAnswer || '').trim().toLowerCase() === (expected || '').trim().toLowerCase();
      return { correct: ok, feedback_sk: ok ? 'Správne.' : `Očakávané: ${expected}` };
    }
  };

  const generateClozeQuiz = async ({ apiKey, words }) => {
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

  // Build phrasal-verb gap-fill from cards already in hand (no API needed).
  const buildPhrasalGapQuiz = (phrasals) => {
    return phrasals.map((p) => {
      const sentence = p.gap_template
        || (p.example_sentence || '').replace(new RegExp(`\\b${escapeRe(p.phrase)}\\b`, 'i'), '___');
      const others = phrasals.filter((x) => x.phrase !== p.phrase).map((x) => x.phrase);
      let distractors = Array.isArray(p.alt_phrases) ? p.alt_phrases.slice(0, 3) : [];
      // Pad with other phrasals if needed.
      others.sort(() => Math.random() - 0.5);
      for (const o of others) {
        if (distractors.length >= 3) break;
        if (!distractors.includes(o) && o !== p.phrase) distractors.push(o);
      }
      while (distractors.length < 3) distractors.push('look up');
      return { word: p.phrase, sentence, distractors };
    });
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

  return {
    generateWords, generatePhrasals, generateTenseItems,
    gradeTenseTransform, generateClozeQuiz, buildPhrasalGapQuiz,
    explain, tts, loadFallback,
  };
})();
