// Static grammar reference for English tenses + on-demand AI examples.
const TensesExplain = (() => {
  const TENSE_EXPLAIN = {
    'present simple': {
      name_sk: 'Prítomný jednoduchý',
      when_sk: 'Pravidelné činnosti, fakty, návyky, všeobecné pravdy a stavy. V programátorskej praxi: čo robíš každý deň, ako sa systém správa, čo platí všeobecne.',
      form: 'I/you/we/they + verb · he/she/it + verb-s · neg: do/does not + verb · ?: do/does + subj + verb',
      signals: ['always', 'usually', 'often', 'sometimes', 'never', 'every day', 'on Mondays'],
      examples: [
        { en: 'I write unit tests before merging.', sk: 'Pred mergom píšem unit testy.' },
        { en: 'The build runs every night at 2 AM.', sk: 'Build beží každú noc o 2:00.' },
        { en: 'She does not review PRs on Fridays.', sk: 'V piatok PR-ká nereviewuje.' },
      ],
      compare_sk: 'Na rozdiel od present continuous opisuje rutinu, nie práve prebiehajúcu akciu.',
    },
    'present continuous': {
      name_sk: 'Prítomný priebehový',
      when_sk: 'Akcia, ktorá práve teraz prebieha, alebo dočasná situácia okolo tohto obdobia. Tiež plánované budúce udalosti s konkrétnym časom.',
      form: 'am/is/are + verb-ing',
      signals: ['now', 'right now', 'at the moment', 'currently', 'today', 'this week'],
      examples: [
        { en: 'I am debugging the auth flow right now.', sk: 'Práve teraz debugujem auth flow.' },
        { en: 'We are migrating to Postgres this sprint.', sk: 'Tento sprint migrujeme na Postgres.' },
        { en: 'He is presenting the architecture at 3 PM.', sk: 'O 15:00 prezentuje architektúru.' },
      ],
      compare_sk: 'Stavové slovesá (know, want, need, believe) v continuous obyčajne nepoužívaš.',
    },
    'present perfect': {
      name_sk: 'Predprítomný',
      when_sk: 'Minulá akcia s následkom v prítomnosti, alebo skúsenosť bez konkrétneho času. Často: "už/ešte nie/niekedy/odkedy". Akcia začala v minulosti a trvá doteraz.',
      form: 'have/has + past participle (3. tvar)',
      signals: ['already', 'just', 'yet', 'ever', 'never', 'since', 'for', 'so far', 'recently'],
      examples: [
        { en: 'I have just deployed the hotfix.', sk: 'Práve som nasadil hotfix.' },
        { en: 'She has worked here for three years.', sk: 'Pracuje tu tri roky (a stále).' },
        { en: 'We have not finished the migration yet.', sk: 'Migráciu sme ešte nedokončili.' },
      ],
      compare_sk: 'Past simple = konkrétny čas v minulosti ("yesterday"). Present perfect = bez presného času, alebo trvá doteraz.',
    },
    'present perfect continuous': {
      name_sk: 'Predprítomný priebehový',
      when_sk: 'Akcia, ktorá začala v minulosti, trvala určitý čas a buď stále prebieha, alebo práve skončila s viditeľným následkom. Dôraz na trvanie.',
      form: 'have/has been + verb-ing',
      signals: ['for', 'since', 'all day', 'lately', 'recently', 'how long'],
      examples: [
        { en: 'I have been debugging this for two hours.', sk: 'Toto debugujem už dve hodiny.' },
        { en: 'She has been working on the refactor since Monday.', sk: 'Na refaktoringu robí od pondelka.' },
        { en: 'My eyes hurt — I have been staring at logs all day.', sk: 'Bolia ma oči — celý deň pozerám do logov.' },
      ],
      compare_sk: 'Present perfect = výsledok / koľko-krát. Present perfect continuous = ako dlho / proces.',
    },
    'past simple': {
      name_sk: 'Minulý jednoduchý',
      when_sk: 'Dokončená akcia v konkrétnom minulom čase. Sled udalostí v príbehu / postmortem.',
      form: 'verb-ed (pravidelné) alebo 2. tvar (nepravidelné) · neg: did not + verb · ?: did + subj + verb',
      signals: ['yesterday', 'last week', 'ago', 'in 2021', 'when', 'then'],
      examples: [
        { en: 'We deployed the hotfix yesterday.', sk: 'Hotfix sme nasadili včera.' },
        { en: 'The service crashed at 3:14 AM.', sk: 'Služba spadla o 3:14.' },
        { en: 'I did not see the alert in time.', sk: 'Alert som nezachytil včas.' },
      ],
      compare_sk: 'Past simple potrebuje (aspoň implicitný) konkrétny čas. Bez neho použi present perfect.',
    },
    'past continuous': {
      name_sk: 'Minulý priebehový',
      when_sk: 'Akcia, ktorá prebiehala v určitom okamihu v minulosti, alebo pozadie pre inú (kratšiu) akciu.',
      form: 'was/were + verb-ing',
      signals: ['while', 'when', 'at 5 PM yesterday', 'all morning'],
      examples: [
        { en: 'I was reviewing the PR when the alert fired.', sk: 'Reviewoval som PR, keď zazvonil alert.' },
        { en: 'They were deploying while I was on call.', sk: 'Deployovali, kým som mal pohotovosť.' },
        { en: 'At 9 AM we were still discussing the design.', sk: 'O 9:00 sme ešte stále riešili dizajn.' },
      ],
      compare_sk: 'Dlhšia akcia v pozadí (continuous) + kratšia ktorá ju preruší (simple).',
    },
    'past perfect': {
      name_sk: 'Predminulý',
      when_sk: 'Akcia, ktorá sa stala PRED inou minulou akciou. Vďaka nemu je jasné poradie udalostí.',
      form: 'had + past participle (3. tvar)',
      signals: ['before', 'after', 'by the time', 'already', 'just', 'never... before'],
      examples: [
        { en: 'By the time I joined, they had already shipped v1.', sk: 'Než som nastúpil, už nasadili v1.' },
        { en: 'The server crashed because someone had pushed a bad config.', sk: 'Server spadol, lebo niekto pred tým pushol zlý config.' },
        { en: 'I realized I had forgotten to add the migration.', sk: 'Uvedomil som si, že som zabudol pridať migráciu.' },
      ],
      compare_sk: 'Použi keď v jednej vete máš dve minulé udalosti a chceš zdôrazniť, ktorá bola skôr.',
    },
    'future simple': {
      name_sk: 'Budúci jednoduchý',
      when_sk: 'Rozhodnutia urobené v momente reči, predpovede, ponuky, sľuby. "will" je neutrálne budúce.',
      form: 'will + verb · neg: will not (won\'t) + verb',
      signals: ['tomorrow', 'next week', 'soon', 'in an hour', 'probably', 'I think'],
      examples: [
        { en: 'I will push the fix after lunch.', sk: 'Po obede pushnem ten fix.' },
        { en: 'This refactor will probably take a week.', sk: 'Tento refaktoring asi zaberie týždeň.' },
        { en: 'We will not break backward compatibility.', sk: 'Spätnú kompatibilitu neporušíme.' },
      ],
      compare_sk: 'Plánovaný zámer (going to / present continuous) vs. rozhodnutie práve teraz (will).',
    },
    'future continuous': {
      name_sk: 'Budúci priebehový',
      when_sk: 'Akcia, ktorá bude PREBIEHAŤ v určitom okamihu v budúcnosti.',
      form: 'will be + verb-ing',
      signals: ['this time tomorrow', 'at 5 PM tomorrow', 'while', 'when'],
      examples: [
        { en: 'This time tomorrow I will be presenting the demo.', sk: 'Zajtra v túto dobu budem prezentovať demo.' },
        { en: 'We will be running migrations during the maintenance window.', sk: 'Počas údržbového okna budeme spúšťať migrácie.' },
        { en: 'Don\'t call at 3 — I will be deploying.', sk: 'O tretej nevolaj — budem deployovať.' },
      ],
    },
    'future perfect': {
      name_sk: 'Predbudúci',
      when_sk: 'Akcia, ktorá bude DOKONČENÁ pred určitým bodom v budúcnosti.',
      form: 'will have + past participle (3. tvar)',
      signals: ['by Friday', 'by then', 'by the end of', 'by the time', 'before'],
      examples: [
        { en: 'By Friday I will have finished the migration.', sk: 'Do piatka tú migráciu dokončím.' },
        { en: 'By the time you read this, the deploy will have completed.', sk: 'Kým si toto prečítaš, deploy bude hotový.' },
        { en: 'We will have shipped v2 by Q3.', sk: 'V2 nasadíme do Q3.' },
      ],
    },
    'conditionals': {
      name_sk: 'Podmienkové vety',
      when_sk: 'Podmienka + dôsledok. Štyri základné typy: 0. všeobecná pravda, 1. reálna budúca podmienka, 2. nereálna prítomná, 3. nereálna minulá.',
      form: '0: if + present, present · 1: if + present, will + verb · 2: if + past, would + verb · 3: if + past perfect, would have + 3.tvar',
      signals: ['if', 'unless', 'when (type 0)', 'would', 'would have'],
      examples: [
        { en: 'If you push to main, CI runs automatically. (type 0)', sk: 'Ak pushneš do main, CI sa spustí. (typ 0)' },
        { en: 'If the build passes, I will merge it. (type 1)', sk: 'Ak prejde build, mergnem to. (typ 1)' },
        { en: 'If I had more time, I would refactor this. (type 2)', sk: 'Keby som mal viac času, refaktoroval by som to. (typ 2)' },
        { en: 'If we had monitored memory, we would not have crashed. (type 3)', sk: 'Keby sme sledovali pamäť, nespadli by sme. (typ 3)' },
      ],
    },
    'passive voice': {
      name_sk: 'Trpný rod',
      when_sk: 'Keď je dôležitejšie, ČO sa deje s objektom, než kto to robí. Bežné v dokumentácii, postmortemoch a tech specs.',
      form: 'be + past participle (3. tvar) · čas určuje sloveso "be" (is/was/has been/will be...)',
      signals: ['by (autor akcie)', 'be done', 'be deployed', 'be merged'],
      examples: [
        { en: 'The PR was merged by the maintainer.', sk: 'PR bol zmergovaný maintainerom.' },
        { en: 'Logs are stored in S3 for 30 days.', sk: 'Logy sú ukladané v S3 30 dní.' },
        { en: 'The service has been migrated to Kubernetes.', sk: 'Služba bola presunutá na Kubernetes.' },
      ],
      compare_sk: 'Použiješ keď agent (kto akciu robí) nie je dôležitý alebo známy.',
    },
  };

  const normalizeTenseKey = (s) => String(s || '').toLowerCase().trim();

  const lookup = (tenseName) => {
    const k = normalizeTenseKey(tenseName);
    if (TENSE_EXPLAIN[k]) return TENSE_EXPLAIN[k];
    // Loose match: e.g. "Present Perfect (continuous)" or "the present perfect tense".
    for (const key of Object.keys(TENSE_EXPLAIN)) {
      if (k.includes(key)) return TENSE_EXPLAIN[key];
    }
    return null;
  };

  const CACHE_PREFIX = 'tense_explain_extra:';
  const getCached = (key) => {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  };
  const setCached = (key, val) => {
    try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(val)); } catch {}
  };

  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const renderExtra = (extra) => {
    if (!extra) return '';
    const exHtml = (extra.extra_examples || []).map((e) => `
      <li>
        <div>${escapeHtml(e.en)}</div>
        <div class="muted">${escapeHtml(e.sk)}</div>
      </li>`).join('');
    const notes = extra.notes_sk ? `<p class="explain-notes">${escapeHtml(extra.notes_sk)}</p>` : '';
    return `<div class="explain-extra">
      <h4>Viac príkladov (AI)</h4>
      ${exHtml ? `<ul class="explain-examples">${exHtml}</ul>` : ''}
      ${notes}
    </div>`;
  };

  const close = () => {
    const m = document.getElementById('explainModal');
    if (m) { m.classList.add('hidden'); m.innerHTML = ''; }
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };

  const open = (tenseName, { apiKey } = {}) => {
    const modal = document.getElementById('explainModal');
    if (!modal) return;
    const info = lookup(tenseName);
    const title = info?.name_sk
      ? `${info.name_sk} <span class="muted">· ${escapeHtml(tenseName)}</span>`
      : `Vysvetlenie: ${escapeHtml(tenseName)}`;
    const body = info ? `
      <section>
        <h4>Kedy ho použiť</h4>
        <p>${escapeHtml(info.when_sk)}</p>
      </section>
      <section>
        <h4>Tvorenie</h4>
        <p class="explain-form">${escapeHtml(info.form)}</p>
      </section>
      ${info.signals?.length ? `
      <section>
        <h4>Signálne slová</h4>
        <p class="explain-signals">${info.signals.map((s) => `<span class="signal-pill">${escapeHtml(s)}</span>`).join(' ')}</p>
      </section>` : ''}
      <section>
        <h4>Príklady</h4>
        <ul class="explain-examples">
          ${info.examples.map((e) => `<li>
            <div>${escapeHtml(e.en)}</div>
            <div class="muted">${escapeHtml(e.sk)}</div>
          </li>`).join('')}
        </ul>
      </section>
      ${info.compare_sk ? `<section><h4>Pozor na</h4><p>${escapeHtml(info.compare_sk)}</p></section>` : ''}
    ` : `<p class="muted">Pre tento čas zatiaľ nemáme statické vysvetlenie. Skús "Viac príkladov (AI)".</p>`;

    const cacheKey = normalizeTenseKey(tenseName);
    const cached = getCached(cacheKey);

    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-card card">
        <button class="modal-close" aria-label="Zavrieť">✕</button>
        <h3 class="explain-title">${title}</h3>
        <div class="explain-body">${body}</div>
        <div class="explain-extra-mount">${cached ? renderExtra(cached) : ''}</div>
        <div class="row" style="margin-top:12px;">
          <button class="primary explain-more">Viac príkladov (AI)</button>
        </div>
        <p class="hint explain-status"></p>
      </div>
    `;
    modal.classList.remove('hidden');

    modal.querySelector('.modal-overlay').addEventListener('click', close);
    modal.querySelector('.modal-close').addEventListener('click', close);
    document.addEventListener('keydown', onKey);

    const moreBtn = modal.querySelector('.explain-more');
    const status = modal.querySelector('.explain-status');
    if (!apiKey) {
      moreBtn.disabled = true;
      status.textContent = 'Pridaj OpenAI API kľúč v Settings pre AI príklady.';
    }
    moreBtn.addEventListener('click', async () => {
      if (!apiKey) return;
      moreBtn.disabled = true;
      status.textContent = 'Načítavam…';
      try {
        const extra = await OpenAI.explainTense({ apiKey, tense: tenseName });
        setCached(cacheKey, extra);
        modal.querySelector('.explain-extra-mount').innerHTML = renderExtra(extra);
        status.textContent = '';
      } catch (e) {
        status.textContent = 'Chyba: ' + (e.message || e);
        moreBtn.disabled = false;
      }
    });
  };

  return { open, close, normalizeTenseKey, TENSE_EXPLAIN };
})();
