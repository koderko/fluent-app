// Main app: view switching, Quick / Session / Stats / Settings.
(() => {
  let state = {
    settings: Storage.getSettings(),
    deck: Storage.getDeck(),
    stats: Storage.getStats(),
    cache: Storage.getCache(),
    currentWord: null,
    session: null, // { size, words[], idx, results[] }
  };

  // ---------- Utilities ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const toast = (msg, ms = 2200) => {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.add('hidden'), ms);
  };

  const switchView = (name) => {
    $$('.view').forEach((v) => v.classList.add('hidden'));
    $('#view-' + name)?.classList.remove('hidden');
    $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
    if (name === 'stats') renderStats();
    if (name === 'quick') ensureCurrentWord();
    if (name === 'settings') renderSettings();
  };

  // ---------- Settings ----------
  const renderSettings = () => {
    $('#apiKey').value = state.settings.apiKey || '';
    $('#category').value = state.settings.category || 'mixed';
    $('#ttsMode').value = state.settings.ttsMode || 'browser';
    const used = Object.keys(state.deck).length;
    $('#storageInfo').textContent = `Local progress: ${used} words tracked.`;
  };

  $('#saveSettings').addEventListener('click', () => {
    state.settings.apiKey = $('#apiKey').value.trim();
    state.settings.category = $('#category').value;
    state.settings.ttsMode = $('#ttsMode').value;
    Storage.saveSettings(state.settings);
    toast('Saved');
    if (!state.currentWord) switchView('quick');
  });

  $('#clearKey').addEventListener('click', () => {
    if (!confirm('Clear API key from this browser?')) return;
    state.settings.apiKey = '';
    Storage.saveSettings({ apiKey: '' });
    $('#apiKey').value = '';
    toast('API key cleared');
  });

  // ---------- Word source ----------
  const getSeenList = () => Object.keys(state.deck);

  const ensureCache = async (n = 5) => {
    if (state.cache.length >= n) return;
    const newWords = await OpenAI.generateWords({
      apiKey: state.settings.apiKey,
      category: state.settings.category,
      exclude: getSeenList(),
      n: 10,
    });
    state.cache = state.cache.concat(newWords);
    Storage.saveCache(state.cache);
  };

  const nextWord = async () => {
    // Prefer due cards first.
    const due = SRS.dueCards(state.deck);
    if (due.length) {
      const c = due[0];
      return c.data && c.data.word ? c.data : { word: c.word };
    }
    await ensureCache(1);
    const w = state.cache.shift();
    Storage.saveCache(state.cache);
    return w;
  };

  // ---------- Quick mode ----------
  const animateCardIn = () => {
    const el = $('#card');
    if (!el) return;
    el.classList.remove('card-enter', 'card-leave');
    // Force reflow so the animation re-runs on every render.
    void el.offsetWidth;
    el.classList.add('card-enter');
  };

  const renderCard = (w) => {
    state.currentWord = w;
    $('#qWord').textContent = w.word || '—';
    $('#qIpa').textContent = w.ipa || '';
    $('#qTranslation').textContent = w.translation_sk || '';
    $('#qExample').textContent = w.example_sentence || '';
    $('#qExampleTrans').textContent = w.example_translation || '';
    $('#qRecResult').textContent = '';
    const card = state.deck[w.word?.toLowerCase()];
    $('#qStatus').textContent = card
      ? `Seen ${card.repetitions}× · next ${card.dueDate}`
      : 'New word';
    animateCardIn();
  };

  const ensureCurrentWord = async () => {
    if (state.currentWord) return;
    try {
      const w = await nextWord();
      renderCard(w);
    } catch (e) {
      toast('Could not load word: ' + e.message);
    }
  };

  $('#qSpeak').addEventListener('click', async () => {
    const w = state.currentWord; if (!w) return;
    if (state.settings.ttsMode === 'openai' && state.settings.apiKey) {
      try {
        const blob = await OpenAI.tts({ apiKey: state.settings.apiKey, text: w.word });
        const url = URL.createObjectURL(blob);
        const a = new Audio(url);
        a.play();
        a.onended = () => URL.revokeObjectURL(url);
        return;
      } catch (e) {
        toast('TTS error, using browser voice');
      }
    }
    Speech.speakBrowser(w.word);
  });

  $('#qListen').addEventListener('click', async () => {
    const w = state.currentWord; if (!w) return;
    $('#qRecResult').textContent = '🎤 …';
    try {
      const heard = await Speech.recognize();
      const ok = Speech.matches(heard, w.word);
      $('#qRecResult').textContent = ok ? `✓ ${heard}` : `✗ ${heard}`;
    } catch (e) {
      $('#qRecResult').textContent = '— ' + e.message;
    }
  });

  $$('.rate').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const q = parseInt(btn.dataset.q, 10);
      btn.classList.remove('pulse'); void btn.offsetWidth; btn.classList.add('pulse');
      const cardEl = $('#card');
      cardEl?.classList.remove('card-enter');
      cardEl?.classList.add('card-leave');
      await new Promise((r) => setTimeout(r, 180));
      cardEl?.classList.remove('card-leave');
      reviewCurrent(q);
    });
  });

  $('#qSkip').addEventListener('click', async () => {
    state.currentWord = null;
    await ensureCurrentWord();
  });

  const reviewCurrent = async (quality) => {
    const w = state.currentWord; if (!w) return;
    const key = w.word.toLowerCase();
    const card = state.deck[key] || SRS.newCard(w.word, w);
    card.data = w;
    SRS.review(card, quality);
    state.deck[key] = card;
    Storage.saveDeck(state.deck);
    bumpStats(w);
    state.currentWord = null;
    await ensureCurrentWord();
  };

  const bumpStats = (w) => {
    const s = state.stats;
    const today = SRS.today();
    if (s.lastDay !== today) {
      const y = new Date(Date.now() - 86400000);
      const yesterday = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
      s.streak = s.lastDay === yesterday ? s.streak + 1 : 1;
      s.lastDay = today;
    }
    s.learnedCount = Object.keys(state.deck).length;
    s.recent = [{ word: w.word, ts: Date.now() }, ...s.recent.filter((r) => r.word !== w.word)].slice(0, 10);
    Storage.saveStats(s);
  };

  // ---------- Session mode ----------
  $('#startSession').addEventListener('click', async () => {
    const size = parseInt($('#sessionSize').value, 10);
    const due = SRS.dueCards(state.deck).map((c) => c.data || { word: c.word });
    const fromDue = due.slice(0, size);
    const needNew = Math.max(0, size - fromDue.length);
    let fresh = [];
    if (needNew > 0) {
      await ensureCache(needNew);
      fresh = state.cache.splice(0, needNew);
      Storage.saveCache(state.cache);
    }
    state.session = {
      size,
      words: [...fromDue, ...fresh],
      idx: 0,
      results: [],
    };
    $('#sessionSetup').classList.add('hidden');
    $('#sessionDone').classList.add('hidden');
    $('#sessionRun').classList.remove('hidden');
    renderSessionCard();
  });

  const renderSessionCard = () => {
    const s = state.session;
    if (s.idx >= s.words.length) return startQuiz();
    const w = s.words[s.idx];
    const total = s.words.length;
    $('#progressBar').style.width = `${(s.idx / total) * 100}%`;
    const html = `
      <div class="card">
        <div class="card-word">${escapeHtml(w.word)}</div>
        <div class="card-ipa">${escapeHtml(w.ipa || '')}</div>
        <div class="card-actions">
          <button class="speak-btn">🔊</button>
        </div>
        <div class="card-translation">${escapeHtml(w.translation_sk || '')}</div>
        <div class="card-example">
          <p>${escapeHtml(w.example_sentence || '')}</p>
          <p class="muted">${escapeHtml(w.example_translation || '')}</p>
        </div>
        <div class="rating">
          <button class="rate hard" data-q="2">Hard</button>
          <button class="rate ok" data-q="4">OK</button>
          <button class="rate easy" data-q="5">Easy</button>
        </div>
      </div>
    `;
    const el = $('#sessionCard');
    el.innerHTML = html;
    el.querySelector('.speak-btn').addEventListener('click', () => Speech.speakBrowser(w.word));
    el.querySelectorAll('.rate').forEach((b) => b.addEventListener('click', () => {
      const q = parseInt(b.dataset.q, 10);
      const key = w.word.toLowerCase();
      const card = state.deck[key] || SRS.newCard(w.word, w);
      card.data = w;
      SRS.review(card, q);
      state.deck[key] = card;
      Storage.saveDeck(state.deck);
      bumpStats(w);
      s.idx++;
      renderSessionCard();
    }));
  };

  const startQuiz = async () => {
    $('#progressBar').style.width = '100%';
    $('#sessionRun').classList.add('hidden');
    const quizEl = $('#sessionQuiz');
    quizEl.classList.remove('hidden');
    quizEl.innerHTML = '<p class="muted">Loading quiz…</p>';
    const s = state.session;
    const clozes = await OpenAI.generateClozeQuiz({ apiKey: state.settings.apiKey, words: s.words });
    let qIdx = 0;
    let correct = 0;
    const renderQ = () => {
      if (qIdx >= clozes.length) return finishSession(correct, clozes.length);
      const item = clozes[qIdx];
      const isCloze = qIdx % 2 === 0; // alternate cloze and MCQ
      const options = shuffle([item.word, ...item.distractors]);
      const prompt = isCloze
        ? `Fill in: ${escapeHtml(item.sentence).replace('___', '<span class="blank">___</span>')}`
        : `Which word means roughly: <em>${escapeHtml(state.session.words.find((w) => w.word === item.word)?.translation_sk || item.word)}</em>?`;
      quizEl.innerHTML = `
        <div class="card">
          <p class="muted">Question ${qIdx + 1} / ${clozes.length}</p>
          <div class="quiz-question">${prompt}</div>
          <div class="quiz-options">
            ${options.map((o) => `<button data-opt="${escapeAttr(o)}">${escapeHtml(o)}</button>`).join('')}
          </div>
        </div>
      `;
      quizEl.querySelectorAll('.quiz-options button').forEach((b) => {
        b.addEventListener('click', () => {
          const picked = b.dataset.opt;
          const right = picked.toLowerCase() === item.word.toLowerCase();
          if (right) { b.classList.add('correct'); correct++; }
          else {
            b.classList.add('wrong');
            const correctBtn = quizEl.querySelector(`.quiz-options button[data-opt="${escapeAttr(item.word)}"]`);
            if (correctBtn) correctBtn.classList.add('correct');
            // Penalize SRS on wrong.
            const key = item.word.toLowerCase();
            const card = state.deck[key];
            if (card) { SRS.review(card, 2); state.deck[key] = card; Storage.saveDeck(state.deck); }
          }
          quizEl.querySelectorAll('.quiz-options button').forEach((x) => x.disabled = true);
          setTimeout(() => { qIdx++; renderQ(); }, 900);
        });
      });
    };
    renderQ();
  };

  const finishSession = (correct, total) => {
    $('#sessionQuiz').classList.add('hidden');
    const done = $('#sessionDone');
    done.classList.remove('hidden');
    $('#sessionScore').textContent = `Score: ${correct} / ${total}`;
    const s = state.stats;
    s.sessions = (s.sessions || 0) + 1;
    Storage.saveStats(s);
    state.session = null;
  };

  $('#sessionAgain').addEventListener('click', () => {
    $('#sessionDone').classList.add('hidden');
    $('#sessionSetup').classList.remove('hidden');
  });

  // ---------- Stats ----------
  const renderStats = () => {
    state.stats = Storage.getStats();
    state.deck = Storage.getDeck();
    $('#statTotal').textContent = Object.keys(state.deck).length;
    $('#statDue').textContent = SRS.dueCount(state.deck);
    $('#statStreak').textContent = state.stats.streak || 0;
    $('#statSessions').textContent = state.stats.sessions || 0;
    const ul = $('#recentWords');
    ul.innerHTML = (state.stats.recent || []).map((r) => {
      const card = state.deck[r.word.toLowerCase()];
      const sub = card ? `due ${card.dueDate}` : '';
      return `<li><span>${escapeHtml(r.word)}</span><span class="muted">${sub}</span></li>`;
    }).join('');
  };

  // ---------- Nav ----------
  $$('.nav-btn').forEach((b) => b.addEventListener('click', () => switchView(b.dataset.view)));

  // ---------- Helpers ----------
  const shuffle = (a) => a.slice().sort(() => Math.random() - 0.5);
  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const escapeAttr = (s) => escapeHtml(s).replace(/"/g, '&quot;');

  // ---------- Init ----------
  const init = () => {
    if (!state.settings.apiKey) {
      switchView('settings');
      toast('Enter API key or use offline wordlist');
    } else {
      switchView('quick');
    }
  };
  init();
})();
