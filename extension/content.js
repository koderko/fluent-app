// Content script — renders a floating overlay with the explanation.
(() => {
  if (window.__deOverlayInstalled) return;
  window.__deOverlayInstalled = true;

  const ns = typeof browser !== 'undefined' ? browser : chrome;
  const OVERLAY_ID = 'de-overlay-root';

  const ensureOverlay = () => {
    let host = document.getElementById(OVERLAY_ID);
    if (host) return host;
    host = document.createElement('div');
    host.id = OVERLAY_ID;
    host.style.cssText = `
      position: fixed; z-index: 2147483647; top: 20px; right: 20px;
      width: 320px; max-width: calc(100vw - 40px);
      background: #1e293b; color: #f1f5f9;
      border: 1px solid #334155; border-radius: 12px;
      padding: 14px 16px; font-family: -apple-system, sans-serif; font-size: 14px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.4);
    `;
    document.body.appendChild(host);
    return host;
  };

  const close = () => document.getElementById(OVERLAY_ID)?.remove();

  const render = ({ text, loading, error, result }) => {
    const host = ensureOverlay();
    let body = '';
    if (loading) {
      body = `<p style="margin:0;color:#94a3b8">Explaining "${escapeHtml(text)}"…</p>`;
    } else if (error) {
      body = `<p style="margin:0;color:#ef4444">${escapeHtml(error)}</p>`;
    } else if (result) {
      body = `
        <div style="font-weight:700;font-size:1.05em;margin-bottom:4px">${escapeHtml(text)}</div>
        <div style="color:#cbd5e1;margin-bottom:6px">${escapeHtml(result.translation_sk || '')}</div>
        <div style="color:#94a3b8;margin-bottom:8px">${escapeHtml(result.meaning_en || '')}</div>
        <div style="background:#0f172a;padding:8px;border-radius:6px;font-size:0.9em">
          <div>${escapeHtml(result.example || '')}</div>
          <div style="color:#94a3b8;margin-top:4px">${escapeHtml(result.example_sk || '')}</div>
        </div>
      `;
    }
    host.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px">
        <strong style="color:#6366f1">📚 Dev English</strong>
        <button id="de-close-btn" style="background:none;border:0;color:#94a3b8;font-size:18px;cursor:pointer;line-height:1">×</button>
      </div>
      ${body}
    `;
    host.querySelector('#de-close-btn').addEventListener('click', close);
  };

  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  ns.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'de:show') render(msg.payload || {});
  });
})();
