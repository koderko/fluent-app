(async () => {
  const $ = (s) => document.querySelector(s);

  const storage = {
    get: async (keys) => {
      try { return await browser.storage.local.get(keys); } catch { return {}; }
    },
    set: async (obj) => {
      try { await browser.storage.local.set(obj); } catch {}
    },
  };

  const data = await storage.get(['apiKey', 'category', 'seenWords']);
  const seenWords = Array.isArray(data.seenWords) ? data.seenWords : [];
  let apiKey = data.apiKey || '';
  let category = data.category || 'mixed';

  const showOnboarding = () => {
    $('#loading').classList.add('hidden');
    $('#onboarding').classList.remove('hidden');
    $('#card').classList.add('hidden');
    $('#apiKey').value = apiKey;
    $('#category').value = category;
  };

  const showCard = () => {
    $('#loading').classList.add('hidden');
    $('#onboarding').classList.add('hidden');
    $('#card').classList.remove('hidden');
  };

  $('#saveBtn').addEventListener('click', async () => {
    apiKey = $('#apiKey').value.trim();
    category = $('#category').value;
    await storage.set({ apiKey, category });
    loadWord();
  });
  $('#skipBtn').addEventListener('click', () => {
    apiKey = '';
    category = $('#category').value;
    storage.set({ apiKey, category });
    loadWord();
  });
  $('#settings').addEventListener('click', showOnboarding);

  let currentWord = null;
  const loadWord = async () => {
    $('#loading').classList.remove('hidden');
    $('#onboarding').classList.add('hidden');
    $('#card').classList.add('hidden');
    try {
      const words = await OpenAI.generateWords({ apiKey, category, exclude: seenWords, n: 1 });
      currentWord = words[0];
      if (!currentWord) {
        $('#loading').textContent = 'No words available.';
        return;
      }
      $('#word').textContent = currentWord.word;
      $('#ipa').textContent = currentWord.ipa || '';
      $('#translation').textContent = currentWord.translation_sk || '';
      $('#example').textContent = currentWord.example_sentence || '';
      $('#exampleTrans').textContent = currentWord.example_translation || '';
      seenWords.push(currentWord.word);
      await storage.set({ seenWords: seenWords.slice(-200) });
      showCard();
    } catch (e) {
      $('#loading').textContent = 'Error: ' + e.message;
    }
  };

  $('#speak').addEventListener('click', () => {
    if (currentWord) Speech.speakBrowser(currentWord.word);
  });
  $('#next').addEventListener('click', loadWord);

  if (!apiKey && !data.category) {
    showOnboarding();
  } else {
    loadWord();
  }
})();
