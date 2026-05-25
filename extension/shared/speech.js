// Web Speech API helpers — TTS + speech recognition.
const Speech = (() => {
  const speakBrowser = (text, lang = 'en-US') => new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 0.95;
    u.onend = resolve;
    u.onerror = resolve;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  });

  const recognize = (lang = 'en-US', timeoutMs = 5000) => new Promise((resolve, reject) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return reject(new Error('SpeechRecognition not supported'));
    const r = new SR();
    r.lang = lang;
    r.interimResults = false;
    r.maxAlternatives = 1;
    let done = false;
    const finish = (val, err) => {
      if (done) return; done = true;
      try { r.stop(); } catch {}
      err ? reject(err) : resolve(val);
    };
    r.onresult = (e) => finish(e.results[0][0].transcript);
    r.onerror = (e) => finish(null, new Error(e.error || 'rec error'));
    r.onend = () => finish(null, new Error('no speech'));
    r.start();
    setTimeout(() => finish(null, new Error('timeout')), timeoutMs);
  });

  const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z\s']/g, '').trim();

  const matches = (heard, target) => {
    const h = normalize(heard);
    const t = normalize(target);
    if (!h || !t) return false;
    return h === t || h.includes(t) || t.includes(h);
  };

  return { speakBrowser, recognize, matches, normalize };
})();
