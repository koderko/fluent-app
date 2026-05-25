# Dev English – B1→B2

English vocabulary trainer for software developers. Two-part project:

- **Webapp / PWA** in `/webapp` — installable from any modern browser, deployable to GitHub Pages, works offline.
- **Browser extension** in `/extension` — Firefox + Chrome (Manifest V3). Toolbar popup with one-word Quick mode, plus right-click *"Explain in dev context"* on any selected text on the web.

Both use the same OpenAI logic. No backend, no build step, no npm. Pure HTML/CSS/JS.

## Features

- **Spaced repetition (SM-2)** — words come back at optimal intervals.
- **Categories** — emails, standups, code review, architecture, interviews, mixed.
- **Cloze + multiple choice quiz** at the end of each session.
- **TTS** via free Web Speech API by default, optional OpenAI TTS for better voice.
- **Speech recognition** — say the word, get ✓/✗ feedback.
- **Offline fallback** — bundled curated B1-B2 dev wordlist so the app works even without an API key.
- **PWA** — installable on phone / desktop, fully offline shell.
- **Per-device progress** in `localStorage` / `browser.storage.local`. No sync, no tracking, no server.

## 1. Setup an OpenAI API key

The app calls OpenAI directly from your browser. **You** pay for usage.

1. Go to <https://platform.openai.com/api-keys> and create a **new** secret key (don't reuse one).
2. Open <https://platform.openai.com/account/limits> and set a **hard spending limit of $5**. This is the safety net if the key ever leaks.
3. Copy the key. You'll paste it in the app's Settings on first run.

Cost estimate: `gpt-4o-mini` is the model used; generating 10 words costs roughly $0.0001. TTS (only if you switch to OpenAI mode) is about $0.015 per 1000 characters. Web Speech (default) is free.

## 2. Deploy the webapp to GitHub Pages

Three steps:

1. Push this repo to GitHub.
2. Repo → **Settings → Pages** → **Source: Deploy from a branch**, **Branch: `main` / folder: `/webapp`** → Save.
3. Wait ~1 minute, then open `https://<your-username>.github.io/<repo-name>/`.

On first run, the app asks for your API key (stored in your browser's `localStorage` only — never sent anywhere except api.openai.com).

### Install as PWA

- **Mobile**: open the GitHub Pages URL in Chrome/Firefox → menu → *Add to Home screen*.
- **Desktop Chrome**: address bar → install icon (⊕).

## 3. Install the Firefox extension

This is the dev-install path (temporary, until you publish to addons.mozilla.org).

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select `extension/manifest.json`.
4. Click the toolbar icon → *Save* an API key in the popup.

Re-loads on every Firefox restart. To make it permanent: zip the `/extension/` folder and submit to AMO, or self-sign via [web-ext](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/).

**On Android Firefox**: same `about:debugging` flow over USB (see Firefox docs for [debugging mobile Firefox](https://extensionworkshop.com/documentation/develop/developing-extensions-for-firefox-for-android/)).

## 4. Install the Chrome extension

1. Open `chrome://extensions`.
2. Toggle **Developer mode** on (top right).
3. Click **Load unpacked** and select the `extension/` folder.
4. Pin the icon, click it, set the API key.

## Using the extension

- **Toolbar popup** — one word at a time, ⌵ button for next.
- **Right-click on any text on a webpage** → *Explain "…" in dev context* → floating panel with translation, example, dev-context meaning. Great for reading GitHub issues, docs, Stack Overflow in your second language.

## Security & privacy

- API key is stored locally only (`localStorage` for the webapp, `browser.storage.local` for the extension).
- Nothing is sent anywhere except `api.openai.com`.
- `.gitignore` blocks `*.key`, `.env*`, and `*.local.json` so accidental commits don't expose keys.
- Use a key that's **only** used for this app, with a $5 hard limit.

## Project layout

```
webapp/
  index.html, app.css, app.js
  storage.js   — localStorage helpers
  srs.js       — SM-2 spaced repetition
  speech.js    — Web Speech (TTS + recognition)
  openai.js    — API wrapper + offline fallback
  wordlist.json — curated B1-B2 dev words by category
  manifest.webmanifest, sw.js — PWA shell
  icons/

extension/
  manifest.json
  popup.html / popup.js / popup.css
  background.js  — context menu handler
  content.js     — floating overlay on web pages
  browser-polyfill.js
  shared/
    openai.js    — copy of webapp version (path-aware)
    speech.js    — copy of webapp version
    wordlist.json — copy of webapp version
  icons/
```

If you change anything in `webapp/openai.js`, `speech.js`, or `wordlist.json`, copy the change into `extension/shared/`. Two-line sync command:

```bash
cp webapp/speech.js extension/shared/
cp webapp/wordlist.json extension/shared/
# openai.js diverges slightly (path-aware fallback) — sync manually.
```

## Verification

After deploying / loading:

- [ ] Webapp opens, settings prompt appears.
- [ ] Save API key → Quick mode shows a word with translation + example.
- [ ] 🔊 button speaks the word.
- [ ] 🎤 button accepts speech, shows ✓ or ✗.
- [ ] Hard / OK / Easy buttons cycle to the next word.
- [ ] Session 10 → cards → cloze + MCQ quiz → score.
- [ ] Stats view shows learned count, streak, recent words.
- [ ] DevTools → Application → Service Workers: registered. Lighthouse PWA audit: installable.
- [ ] Disable network → app still loads, falls back to bundled wordlist.
- [ ] Extension popup loads, shows a word.
- [ ] Right-click selected text on any page → *Explain in dev context* → overlay appears.

## License

MIT — see `LICENSE`.
