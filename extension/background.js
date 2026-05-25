// Background service worker / event page.
// Sets up context menu "Explain in dev context" and forwards results to content script.

importScriptsIfNeeded();

function importScriptsIfNeeded() {
  // In MV3 service worker we can use importScripts. In Firefox background scripts, scripts are loaded via manifest.
  if (typeof importScripts === 'function') {
    try { importScripts('browser-polyfill.js', 'shared/openai.js'); } catch (e) { /* Firefox handles via manifest */ }
  }
}

const MENU_ID = 'de-explain';

browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: MENU_ID,
    title: 'Explain "%s" in dev context',
    contexts: ['selection'],
  });
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !info.selectionText || !tab?.id) return;
  const text = info.selectionText.trim().slice(0, 200);

  // Send placeholder to content immediately for UX.
  await ensureContentScript(tab.id);
  browser.tabs.sendMessage(tab.id, { type: 'de:show', payload: { text, loading: true } }).catch(() => {});

  try {
    const { apiKey } = await browser.storage.local.get('apiKey');
    if (!apiKey) {
      browser.tabs.sendMessage(tab.id, {
        type: 'de:show',
        payload: { text, error: 'Set API key in the extension popup first.' },
      }).catch(() => {});
      return;
    }
    const result = await OpenAI.explain({ apiKey, text });
    browser.tabs.sendMessage(tab.id, { type: 'de:show', payload: { text, result } }).catch(() => {});
  } catch (e) {
    browser.tabs.sendMessage(tab.id, { type: 'de:show', payload: { text, error: e.message } }).catch(() => {});
  }
});

async function ensureContentScript(tabId) {
  try {
    await browser.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
  } catch (e) {
    // Likely already injected or restricted page.
  }
}
