// Main app: view switching, Quick / Session / Stats / Settings.
(() => {
  let state = {
    settings: Storage.getSettings(),
    deck: {},
    cache: [],
    stats: Storage.getStats(),
    currentItem: null,
    session: null, // { size, items[], idx, results[] }
  };
  // activeDeck is 'word' | 'phrasal' | 'tense'
  state.deck = Storage.getDeck(state.settings.activeDeck);
  state.cache = Storage.getCache(state.settings.activeDeck);

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
    if (name === 'quick') ensureCurrentItem();
    if (name === 'settings') renderSettings();
    if (name === 'quick' || name === 'session') syncModeTabs();
  };

  // ---------- Active deck switching ----------
  const syncModeTabs = () => {
    const cur = state.settings.activeDeck;
    document.querySelectorAll('[data-mode-tabs] .mode-tab').forEach((b) => {
      b.classList.toggle('active', b.dataset.mode === cur);
    });
    const sel = $('#deckMode');
    if (sel) sel.value = cur;
  };

  const setActiveDeck = (type, { goView } = {}) => {
    if (!type || type === state.settings.activeDeck) {
      syncModeTabs();
      return;
    }
    state.settings.activeDeck = type;
    Storage.saveSettings({ activeDeck: type });
    state.deck = Storage.getDeck(type);
    state.cache = Storage.getCache(type);
    state.currentItem = null;
    // Drop any in-flight session — items belong to a different deck now.
    if (state.session) {
      state.session = null;
      $('#sessionRun')?.classList.add('hidden');
      $('#sessionQuiz')?.classList.add('hidden');
      $('#sessionDone')?.classList.add('hidden');
      $('#sessionSetup')?.classList.remove('hidden');
    }
    syncModeTabs();
    if (goView) switchView(goView);
    else {
      // Re-render the visible view.
      const visible = document.querySelector('.view:not(.hidden)');
      if (visible?.id === 'view-quick') ensureCurrentItem();
      if (visible?.id === 'view-stats') renderStats();
      if (visible?.id === 'view-settings') renderSettings();
    }
  };

  // ---------- Item identity ----------
  // Each card type has a different "id" field on its data payload.
  const itemId = (data) => {
    if (!data) return '';
    if (data.type === 'phrasal') return ('phrasal:' + (data.phrase || '')).toLowerCase();
    if (data.type === 'tense')   return ('tense:' + (data.prompt || '')).toLowerCase();
    return ('word:' + (data.word || '')).toLowerCase();
  };
  const itemLabel = (data) => {
    if (!data) return '';
    if (data.type === 'phrasal') return data.phrase || '';
    if (data.type === 'tense')   return data.prompt || '';
    return data.word || '';
  };

  // ---------- Settings ----------
  const renderSettings = () => {
    $('#apiKey').value = state.settings.apiKey || '';
    $('#category').value = state.settings.category || 'mixed';
    $('#ttsMode').value = state.settings.ttsMode || 'browser';
    $('#deckMode').value = state.settings.activeDeck || 'word';
    const used = Object.keys(state.deck).length;
    const labels = { word: 'words', phrasal: 'phrasal verbs', tense: 'tense items' };
    $('#storageInfo').textContent = `Local progress: ${used} ${labels[state.settings.activeDeck] || 'items'} tracked.`;
  };

  $('#saveSettings').addEventListener('click', () => {
    state.settings.apiKey = $('#apiKey').value.trim();
    state.settings.category = $('#category').value;
    state.settings.ttsMode = $('#ttsMode').value;
    Storage.saveSettings({
      apiKey: state.settings.apiKey,
      category: state.settings.category,
      ttsMode: state.settings.ttsMode,
    });
    const newDeck = $('#deckMode').value;
    if (newDeck !== state.settings.activeDeck) {
      setActiveDeck(newDeck, { goView: 'quick' });
    } else {
      switchView('quick');
    }
    toast('Saved');
  });

  // Tabs in Quick / Session — switch deck instantly.
  document.querySelectorAll('[data-mode-tabs] .mode-tab').forEach((b) => {
    b.addEventListener('click', () => setActiveDeck(b.dataset.mode));
  });

  $('#clearKey').addEventListener('click', () => {
    if (!confirm('Clear API key from this browser?')) return;
    state.settings.apiKey = '';
    Storage.saveSettings({ apiKey: '' });
    $('#apiKey').value = '';
    toast('API key cleared');
  });

  // ---------- Item source ----------
  const getSeenList = () => {
    return Object.values(state.deck).map((c) => itemLabel(c.data));
  };

  const generateBatch = async (n) => {
    const apiKey = state.settings.apiKey;
    const exclude = getSeenList();
    if (state.settings.activeDeck === 'phrasal') {
      const items = await OpenAI.generatePhrasals({ apiKey, exclude, n });
      return items.map((x) => ({ ...x, type: 'phrasal' }));
    }
    if (state.settings.activeDeck === 'tense') {
      const items = await OpenAI.generateTenseItems({ apiKey, exclude, n });
      return items.map((x) => ({ ...x, type: 'tense' }));
    }
    const words = await OpenAI.generateWords({
      apiKey, category: state.settings.category, exclude, n,
    });
    return words.map((x) => ({ ...x, type: 'word' }));
  };

  const ensureCache = async (n = 5) => {
    if (state.cache.length >= n) return;
    const fresh = await generateBatch(10);
    state.cache = state.cache.concat(fresh);
    Storage.saveCache(state.cache, state.settings.activeDeck);
  };

  const nextItem = async () => {
    const due = SRS.dueCards(state.deck);
    if (due.length) {
      const c = due[0];
      return c.data;
    }
    await ensureCache(1);
    const it = state.cache.shift();
    Storage.saveCache(state.cache, state.settings.activeDeck);
    return it;
  };

  // ---------- Quick mode rendering ----------
  const setQuickBaseDom = ({ word = '', ipa = '', translation = '', example = '', exampleTrans = '', showActions = true, status = '' }) => {
    $('#qWord').textContent = word || '—';
    $('#qIpa').textContent = ipa || '';
    $('#qTranslation').textContent = translation || '';
    $('#qExample').textContent = example || '';
    $('#qExampleTrans').textContent = exampleTrans || '';
    $('#qRecResult').textContent = '';
    $('#qActions').classList.toggle('hidden', !showActions);
    $('#qStatus').textContent = status;
    $('#qTaskArea').classList.add('hidden');
    $('#qTaskArea').innerHTML = '';
    $('#qRating').classList.remove('hidden');
  };

  const cardStatusText = (data) => {
    const card = state.deck[itemId(data)];
    return card ? `Seen ${card.repetitions}× · next ${card.dueDate}` : 'New';
  };

  const renderItem = (data) => {
    state.currentItem = data;
    const type = data.type || 'word';
    if (type === 'word') {
      setQuickBaseDom({
        word: data.word,
        ipa: data.ipa,
        translation: data.translation_sk,
        example: data.example_sentence,
        exampleTrans: data.example_translation,
        showActions: true,
        status: cardStatusText(data),
      });
      return;
    }
    if (type === 'phrasal') {
      setQuickBaseDom({
        word: data.phrase,
        ipa: data.particle ? `+ ${data.particle}` : '',
        translation: data.meaning_sk,
        example: data.example_sentence,
        exampleTrans: data.example_translation,
        showActions: true,
        status: cardStatusText(data),
      });
      return;
    }
    if (type === 'tense') {
      renderTenseCard(data);
      return;
    }
  };

  const renderTenseCard = (data) => {
    state.currentItem = data;
    $('#qWord').textContent = `⏳ ${data.tense || 'tense'}`;
    $('#qIpa').textContent = data.task || '';
    $('#qTranslation').textContent = '';
    $('#qExample').textContent = data.prompt || '';
    $('#qExampleTrans').textContent = '';
    $('#qRecResult').textContent = '';
    $('#qActions').classList.add('hidden');
    $('#qStatus').textContent = cardStatusText(data);
    $('#qRating').classList.add('hidden');
    const area = $('#qTaskArea');
    area.classList.remove('hidden');

    const explainRowHtml = `<div class="explain-row"><button type="button" class="ghost explain-btn">💡 Vysvetli tento čas</button></div>`;
    const wireExplain = () => {
      const eb = area.querySelector('.explain-btn');
      if (eb) eb.addEventListener('click', () => TensesExplain.open(data.tense, { apiKey: state.settings.apiKey }));
    };

    if (data.task === 'mcq') {
      const options = (data.options || []).slice().sort(() => Math.random() - 0.5);
      area.innerHTML = `
        ${explainRowHtml}
        <div class="quiz-options">
          ${options.map((o) => `<button data-opt="${escapeAttr(o)}">${escapeHtml(o)}</button>`).join('')}
        </div>
        <div class="tense-feedback hidden"></div>
      `;
      wireExplain();
      area.querySelectorAll('.quiz-options button').forEach((b) => {
        b.addEventListener('click', () => {
          const right = b.dataset.opt.trim().toLowerCase() === (data.answer || '').trim().toLowerCase();
          area.querySelectorAll('.quiz-options button').forEach((x) => x.disabled = true);
          if (right) b.classList.add('correct');
          else {
            b.classList.add('wrong');
            const correctBtn = area.querySelector(`.quiz-options button[data-opt="${escapeAttr(data.answer)}"]`);
            if (correctBtn) correctBtn.classList.add('correct');
          }
          showTenseFeedback(area, right, data);
          finishTenseAnswer(right);
        });
      });
      return;
    }

    // gap_fill or transform — both use a text input.
    const placeholder = data.task === 'gap_fill' ? 'Doplň správny tvar' : 'Prepíš celú vetu';
    area.innerHTML = `
      ${explainRowHtml}
      <input type="text" id="qTenseInput" placeholder="${escapeAttr(placeholder)}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" />
      <div class="row" style="margin-top:8px;">
        <button id="qTenseCheck" class="primary">Skontrolovať</button>
        <button id="qTenseShow" class="ghost">Ukázať</button>
      </div>
      <div class="tense-feedback hidden"></div>
    `;
    wireExplain();
    const input = area.querySelector('#qTenseInput');
    input.focus();
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') area.querySelector('#qTenseCheck').click(); });
    area.querySelector('#qTenseShow').addEventListener('click', () => {
      showTenseFeedback(area, false, data, true);
    });
    area.querySelector('#qTenseCheck').addEventListener('click', async () => {
      const user = (input.value || '').trim();
      if (!user) { input.focus(); return; }
      let result;
      if (data.task === 'gap_fill') {
        const ok = user.toLowerCase() === (data.answer || '').toLowerCase();
        result = { correct: ok, feedback_sk: ok ? 'Správne.' : `Správne: ${data.answer}` };
      } else {
        area.querySelector('#qTenseCheck').disabled = true;
        showTenseFeedback(area, null, data, false, 'Kontrolujem…');
        result = await OpenAI.gradeTenseTransform({
          apiKey: state.settings.apiKey,
          prompt: data.prompt,
          expected: data.answer,
          userAnswer: user,
        });
      }
      showTenseFeedback(area, result.correct, data, false, result.feedback_sk);
      finishTenseAnswer(result.correct);
    });
  };

  const showTenseFeedback = (area, correct, data, reveal = false, msg = null) => {
    const fb = area.querySelector('.tense-feedback');
    if (!fb) return;
    fb.classList.remove('hidden', 'correct', 'wrong');
    let text;
    if (reveal) {
      fb.classList.add('wrong');
      text = `Správna odpoveď: ${data.answer}. ${data.explanation_sk || ''}`;
    } else if (msg && correct === null) {
      text = msg;
    } else {
      fb.classList.add(correct ? 'correct' : 'wrong');
      text = (msg || (correct ? 'Správne.' : `Správne: ${data.answer}`)) + (data.explanation_sk ? ` · ${data.explanation_sk}` : '');
    }
    fb.textContent = text;
  };

  // On correct: auto-advance after a delay. On wrong: show a "Rozumiem"
  // button so the user can read the correct answer before continuing.
  const awaitContinue = (container, correct, onContinue, correctDelay = 1100) => {
    if (correct) {
      setTimeout(onContinue, correctDelay);
      return;
    }
    if (!container) { onContinue(); return; }
    const wrap = document.createElement('div');
    wrap.className = 'row continue-row';
    wrap.style.marginTop = '12px';
    wrap.innerHTML = '<button type="button" class="primary continue-btn">Rozumiem</button>';
    container.appendChild(wrap);
    const btn = wrap.querySelector('.continue-btn');
    btn.focus();
    let done = false;
    btn.addEventListener('click', () => {
      if (done) return;
      done = true;
      onContinue();
    });
  };

  const finishTenseAnswer = (correct) => {
    awaitContinue($('#qTaskArea'), correct, () => reviewCurrent(correct ? 5 : 2));
  };

  const ensureCurrentItem = async () => {
    if (state.currentItem) {
      renderItem(state.currentItem);
      return;
    }
    try {
      const it = await nextItem();
      if (!it || !itemLabel(it)) {
        toast('No more items — check API key or Settings.');
        setQuickBaseDom({ word: '—', status: 'Open Settings to add an API key.' });
        return;
      }
      renderItem(it);
    } catch (e) {
      console.error(e);
      toast('Could not load item: ' + e.message);
    }
  };

  // ---------- TTS / mic ----------
  $('#qSpeak').addEventListener('click', async () => {
    const it = state.currentItem; if (!it) return;
    const text = itemLabel(it) || '';
    if (state.settings.ttsMode === 'openai' && state.settings.apiKey) {
      try {
        const blob = await OpenAI.tts({ apiKey: state.settings.apiKey, text });
        const url = URL.createObjectURL(blob);
        const a = new Audio(url);
        a.play();
        a.onended = () => URL.revokeObjectURL(url);
        return;
      } catch (e) {
        toast('TTS error, using browser voice');
      }
    }
    Speech.speakBrowser(text);
  });

  $('#qListen').addEventListener('click', async () => {
    const it = state.currentItem; if (!it) return;
    $('#qRecResult').textContent = '🎤 …';
    try {
      const heard = await Speech.recognize();
      const ok = Speech.matches(heard, itemLabel(it));
      $('#qRecResult').textContent = ok ? `✓ ${heard}` : `✗ ${heard}`;
    } catch (e) {
      $('#qRecResult').textContent = '— ' + e.message;
    }
  });

  // ---------- Rating ----------
  $$('.rate').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const q = parseInt(btn.dataset.q, 10);
      btn.classList.remove('pulse'); void btn.offsetWidth; btn.classList.add('pulse');
      await new Promise((r) => setTimeout(r, 220));
      reviewCurrent(q);
    });
  });

  $('#qSkip').addEventListener('click', async () => {
    state.currentItem = null;
    await ensureCurrentItem();
  });

  const reviewCurrent = async (quality) => {
    const it = state.currentItem; if (!it) return;
    const id = itemId(it);
    const card = state.deck[id] || SRS.newCard(id, it);
    card.data = it;
    SRS.review(card, quality);
    state.deck[id] = card;
    Storage.saveDeck(state.deck, state.settings.activeDeck);
    bumpStats(it);
    state.currentItem = null;
    await ensureCurrentItem();
  };

  const bumpStats = (it) => {
    const s = state.stats;
    const today = SRS.today();
    if (s.lastDay !== today) {
      const y = new Date(Date.now() - 86400000);
      const yesterday = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
      s.streak = s.lastDay === yesterday ? s.streak + 1 : 1;
      s.lastDay = today;
    }
    // learnedCount = sum across decks
    let total = 0;
    for (const t of Storage.DECK_TYPES) total += Object.keys(Storage.getDeck(t)).length;
    s.learnedCount = total;
    const label = itemLabel(it);
    s.recent = [{ word: label, ts: Date.now() }, ...s.recent.filter((r) => r.word !== label)].slice(0, 10);
    Storage.saveStats(s);
  };

  // ---------- Session mode ----------
  $('#startSession').addEventListener('click', async () => {
    const size = parseInt($('#sessionSize').value, 10);
    const due = SRS.dueCards(state.deck).map((c) => c.data);
    const fromDue = due.slice(0, size);
    const needNew = Math.max(0, size - fromDue.length);
    let fresh = [];
    if (needNew > 0) {
      await ensureCache(needNew);
      fresh = state.cache.splice(0, needNew);
      Storage.saveCache(state.cache, state.settings.activeDeck);
    }
    state.session = {
      size,
      items: [...fromDue, ...fresh],
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
    if (s.idx >= s.items.length) return startQuiz();
    const it = s.items[s.idx];
    const total = s.items.length;
    $('#progressBar').style.width = `${(s.idx / total) * 100}%`;
    const type = it.type || 'word';
    let bodyHtml;
    if (type === 'phrasal') {
      bodyHtml = `
        <div class="card-word">${escapeHtml(it.phrase || '')}</div>
        <div class="card-ipa">${escapeHtml(it.particle ? '+ ' + it.particle : '')}</div>
        <div class="card-actions"><button class="speak-btn">🔊</button></div>
        <div class="card-translation">${escapeHtml(it.meaning_sk || '')}</div>
        <div class="card-example">
          <p>${escapeHtml(it.example_sentence || '')}</p>
          <p class="muted">${escapeHtml(it.example_translation || '')}</p>
        </div>
      `;
    } else if (type === 'tense') {
      // Sessions render tense items via Quick-style logic but in #sessionCard.
      bodyHtml = renderTenseSessionBody(it);
    } else {
      bodyHtml = `
        <div class="card-word">${escapeHtml(it.word || '')}</div>
        <div class="card-ipa">${escapeHtml(it.ipa || '')}</div>
        <div class="card-actions"><button class="speak-btn">🔊</button></div>
        <div class="card-translation">${escapeHtml(it.translation_sk || '')}</div>
        <div class="card-example">
          <p>${escapeHtml(it.example_sentence || '')}</p>
          <p class="muted">${escapeHtml(it.example_translation || '')}</p>
        </div>
      `;
    }
    const ratingHtml = (type === 'tense') ? '' : `
      <div class="rating">
        <button class="rate hard" data-q="2">Hard</button>
        <button class="rate ok" data-q="4">OK</button>
        <button class="rate easy" data-q="5">Easy</button>
      </div>`;
    const el = $('#sessionCard');
    el.innerHTML = `<div class="card">${bodyHtml}${ratingHtml}</div>`;
    const speakBtn = el.querySelector('.speak-btn');
    if (speakBtn) speakBtn.addEventListener('click', () => Speech.speakBrowser(itemLabel(it)));
    el.querySelectorAll('.rate').forEach((b) => b.addEventListener('click', () => {
      const q = parseInt(b.dataset.q, 10);
      const id = itemId(it);
      const card = state.deck[id] || SRS.newCard(id, it);
      card.data = it;
      SRS.review(card, q);
      state.deck[id] = card;
      Storage.saveDeck(state.deck, state.settings.activeDeck);
      bumpStats(it);
      s.idx++;
      renderSessionCard();
    }));
    if (type === 'tense') {
      wireTenseSessionBody(el, it, () => { s.idx++; renderSessionCard(); });
    }
  };

  const renderTenseSessionBody = (it) => {
    const head = `<div class="card-word">⏳ ${escapeHtml(it.tense || '')}</div>
                  <div class="card-ipa">${escapeHtml(it.task || '')}</div>
                  <div class="card-example"><p>${escapeHtml(it.prompt || '')}</p></div>
                  <div class="explain-row"><button type="button" class="ghost explain-btn">💡 Vysvetli tento čas</button></div>`;
    if (it.task === 'mcq') {
      const options = (it.options || []).slice().sort(() => Math.random() - 0.5);
      return head + `<div class="quiz-options">
          ${options.map((o) => `<button data-opt="${escapeAttr(o)}">${escapeHtml(o)}</button>`).join('')}
        </div><div class="tense-feedback hidden"></div>`;
    }
    return head + `
      <input type="text" class="qTenseInput" placeholder="${it.task === 'gap_fill' ? 'Doplň tvar' : 'Prepíš vetu'}" autocomplete="off" />
      <div class="row" style="margin-top:8px;">
        <button class="qTenseCheck primary">Skontrolovať</button>
        <button class="qTenseShow ghost">Ukázať</button>
      </div>
      <div class="tense-feedback hidden"></div>
    `;
  };

  const wireTenseSessionBody = (root, it, onDone) => {
    const explainBtn = root.querySelector('.explain-btn');
    if (explainBtn) explainBtn.addEventListener('click', () => TensesExplain.open(it.tense, { apiKey: state.settings.apiKey }));
    const apply = (correct) => {
      const id = itemId(it);
      const card = state.deck[id] || SRS.newCard(id, it);
      card.data = it;
      SRS.review(card, correct ? 5 : 2);
      state.deck[id] = card;
      Storage.saveDeck(state.deck, state.settings.activeDeck);
      bumpStats(it);
      awaitContinue(root, correct, onDone);
    };
    if (it.task === 'mcq') {
      root.querySelectorAll('.quiz-options button').forEach((b) => {
        b.addEventListener('click', () => {
          const right = b.dataset.opt.trim().toLowerCase() === (it.answer || '').trim().toLowerCase();
          root.querySelectorAll('.quiz-options button').forEach((x) => x.disabled = true);
          if (right) b.classList.add('correct');
          else {
            b.classList.add('wrong');
            const cb = root.querySelector(`.quiz-options button[data-opt="${escapeAttr(it.answer)}"]`);
            if (cb) cb.classList.add('correct');
          }
          showTenseFeedback(root, right, it);
          apply(right);
        });
      });
      return;
    }
    const input = root.querySelector('.qTenseInput');
    input.focus();
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') root.querySelector('.qTenseCheck').click(); });
    root.querySelector('.qTenseShow').addEventListener('click', () => {
      showTenseFeedback(root, false, it, true);
      apply(false);
    });
    root.querySelector('.qTenseCheck').addEventListener('click', async () => {
      const user = (input.value || '').trim();
      if (!user) { input.focus(); return; }
      let result;
      if (it.task === 'gap_fill') {
        const ok = user.toLowerCase() === (it.answer || '').toLowerCase();
        result = { correct: ok, feedback_sk: ok ? 'Správne.' : `Správne: ${it.answer}` };
      } else {
        root.querySelector('.qTenseCheck').disabled = true;
        showTenseFeedback(root, null, it, false, 'Kontrolujem…');
        result = await OpenAI.gradeTenseTransform({
          apiKey: state.settings.apiKey,
          prompt: it.prompt, expected: it.answer, userAnswer: user,
        });
      }
      showTenseFeedback(root, result.correct, it, false, result.feedback_sk);
      apply(result.correct);
    });
  };

  const startQuiz = async () => {
    const s = state.session;
    $('#progressBar').style.width = '100%';
    $('#sessionRun').classList.add('hidden');
    const quizEl = $('#sessionQuiz');
    quizEl.classList.remove('hidden');

    const type = state.settings.activeDeck;
    if (type === 'tense') {
      // Tense session already had per-card quiz; just finish.
      const correct = (s.results || []).filter(Boolean).length;
      return finishSession(correct, s.items.length);
    }

    quizEl.innerHTML = '<p class="muted">Loading quiz…</p>';
    let cards;
    if (type === 'phrasal') {
      cards = OpenAI.buildPhrasalGapQuiz(s.items);
    } else {
      // 'word' deck
      cards = await OpenAI.generateClozeQuiz({ apiKey: state.settings.apiKey, words: s.items });
    }

    let qIdx = 0;
    let correct = 0;
    const renderQ = () => {
      if (qIdx >= cards.length) return finishSession(correct, cards.length);
      const item = cards[qIdx];
      const isCloze = qIdx % 2 === 0;
      const options = shuffle([item.word, ...item.distractors]);
      const sourceItem = s.items.find((w) => itemLabel(w).toLowerCase() === String(item.word).toLowerCase());
      const meaningStr = sourceItem ? (sourceItem.meaning_sk || sourceItem.translation_sk || item.word) : item.word;
      const prompt = isCloze
        ? `Fill in: ${escapeHtml(item.sentence || '').replace('___', '<span class="blank">___</span>')}`
        : `Which one means: <em>${escapeHtml(meaningStr)}</em>?`;
      quizEl.innerHTML = `
        <div class="card">
          <p class="muted">Question ${qIdx + 1} / ${cards.length}</p>
          <div class="quiz-question">${prompt}</div>
          <div class="quiz-options">
            ${options.map((o) => `<button data-opt="${escapeAttr(o)}">${escapeHtml(o)}</button>`).join('')}
          </div>
        </div>
      `;
      quizEl.querySelectorAll('.quiz-options button').forEach((b) => {
        b.addEventListener('click', () => {
          const picked = b.dataset.opt;
          const right = picked.toLowerCase() === String(item.word).toLowerCase();
          if (right) { b.classList.add('correct'); correct++; }
          else {
            b.classList.add('wrong');
            const correctBtn = quizEl.querySelector(`.quiz-options button[data-opt="${escapeAttr(item.word)}"]`);
            if (correctBtn) correctBtn.classList.add('correct');
            // Penalize SRS on wrong using matching deck card.
            const matchData = s.items.find((w) => itemLabel(w).toLowerCase() === String(item.word).toLowerCase());
            if (matchData) {
              const id = itemId(matchData);
              const card = state.deck[id];
              if (card) { SRS.review(card, 2); state.deck[id] = card; Storage.saveDeck(state.deck, state.settings.activeDeck); }
            }
          }
          quizEl.querySelectorAll('.quiz-options button').forEach((x) => x.disabled = true);
          awaitContinue(quizEl.querySelector('.card'), right, () => { qIdx++; renderQ(); }, 900);
        });
      });
    };
    renderQ();
  };

  const finishSession = (correct, total) => {
    $('#sessionQuiz').classList.add('hidden');
    const done = $('#sessionDone');
    done.classList.remove('hidden');
    $('#sessionScore').textContent = total ? `Score: ${correct} / ${total}` : 'Session complete';
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
  const MODE_LABELS = { word: 'Slová', phrasal: 'Phrasal verbs', tense: 'Časy' };
  const renderStats = () => {
    state.stats = Storage.getStats();
    state.deck = Storage.getDeck(state.settings.activeDeck);
    const byMode = $('#statsByMode');
    byMode.innerHTML = Storage.DECK_TYPES.map((t) => {
      const d = Storage.getDeck(t);
      const learned = Object.keys(d).length;
      const due = SRS.dueCount(d);
      return `<div class="stat-row">
        <span class="stat-label">${escapeHtml(MODE_LABELS[t] || t)}</span>
        <span class="stat-pill"><strong>${learned}</strong> learned</span>
        <span class="stat-pill due"><strong>${due}</strong> due</span>
      </div>`;
    }).join('');
    $('#statStreak').textContent = state.stats.streak || 0;
    $('#statSessions').textContent = state.stats.sessions || 0;
    const ul = $('#recentWords');
    ul.innerHTML = (state.stats.recent || []).map((r) => {
      return `<li><span>${escapeHtml(r.word)}</span><span class="muted">${new Date(r.ts).toLocaleDateString()}</span></li>`;
    }).join('');
  };

  // ---------- Nav ----------
  $$('.nav-btn').forEach((b) => b.addEventListener('click', () => switchView(b.dataset.view)));

  // ---------- Helpers ----------
  const shuffle = (a) => a.slice().sort(() => Math.random() - 0.5);
  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const escapeAttr = (s) => escapeHtml(s).replace(/"/g, '&quot;');

  // ---------- Migration ----------
  const migrateDeckDueDates = () => {
    const today = SRS.today();
    for (const t of Storage.DECK_TYPES) {
      const deck = Storage.getDeck(t);
      let changed = 0;
      for (const k of Object.keys(deck)) {
        const c = deck[k];
        if (!c.dueDate || c.dueDate <= today) {
          const interval = Math.max(1, c.interval || 1);
          const d = new Date(); d.setHours(0, 0, 0, 0);
          d.setDate(d.getDate() + interval);
          c.dueDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          changed++;
        }
      }
      if (changed) Storage.saveDeck(deck, t);
    }
  };

  // ---------- Init ----------
  const init = () => {
    migrateDeckDueDates();
    if (!state.settings.apiKey) {
      switchView('settings');
      toast('Enter API key or use offline wordlist');
    } else {
      switchView('quick');
    }
  };
  init();
})();
