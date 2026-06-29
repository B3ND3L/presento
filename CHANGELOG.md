# Changelog

All notable changes to **Presento** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
---
## [0.1.1] — 2026-06-29
### ✨ Features 

#### Editor
- **Speaker notes** — add speaker notes to each slide, which are displayed in the presenter view.

### 🔒️ Security

#### Global
- **Fix Broken Access Control** — document are now really protected by password. Previously, anyone with the link could export a PDF of a private deck.
- ---
## [0.1.0] — 2026-06-26

First public release. 🎉

### ✨ Features

#### Editor
- **WYSIWYG slide editor** — create and arrange elements (text, images, shapes, iframes) on a virtual 960 × 540 canvas.
- **Text elements** — rich-text editing via `contenteditable` with bold, italic, underline, strikethrough, font family/size, text colour, and text alignment.
- **Image elements** — insert from URL, upload a local file, or drag-and-drop an image file onto the canvas.
- **Shape elements** — insert rectangles, circles, and triangles with custom fill colour.
- **iFrame elements** — embed any URL as a live preview through the built-in server proxy.
- **Smart alignment guides** — snap-to-align guides appear while dragging, snapping elements to slide edges, centre lines, and other elements (configurable threshold: 6 px).
- **Multi-selection** — Ctrl/Cmd-click to select multiple elements; arrow-key nudging and drag-move work on the whole group.
- **Resize handle** — drag the bottom-right handle to resize the selected element.
- **Z-order control** — bring-forward / send-backward buttons and equivalent context-menu entries.
- **Fragment (progressive reveal)** — mark any element as a Reveal.js fragment; a numbered badge shows the reveal order.
- **Element background colour** with **alpha/opacity** slider (stored as `rgba()`).
- **Slide background** — per-slide solid colour, colour swatches, and background image (URL or file upload).
- **Context menu** (right-click) — edit, copy, cut, paste, duplicate, bring forward, send backward, toggle fragment, delete.
- **Keyboard shortcuts** — Delete/Backspace (delete), Ctrl+S (save), Ctrl+Z/Y (undo/redo), Ctrl+A (select all), Ctrl+C/X/V (copy/cut/paste), Ctrl+D (duplicate), arrow keys (nudge 1 px / 10 px with Shift).
- **Undo / Redo** — snapshot-based history (up to 50 steps); changes are debounced and coalesced (450 ms).
- **Auto-save** — background auto-save every 45 seconds when there are unsaved changes.
- **Split save button** — the main "Save" button now performs a quick save using the last chosen method (online or local) without reopening the modal. A dropdown arrow (`▾`) on the right offers "Save online…" (opens the full modal with password option) and "Save locally" (direct JSON download). The preference is remembered in `localStorage`.
- **Ctrl+S quick save** — the keyboard shortcut now triggers the quick save directly instead of always opening the save modal.


#### Slide management
- Add, delete, and reorder slides.
- Live **thumbnail strip** (left panel) rebuilt as an inline `srcdoc` iframe for pixel-accurate previews.
- Thumbnail refresh is debounced (150 ms) to stay smooth while typing or dragging.

#### Presentation settings
- Choose from 8 built-in Reveal.js **themes** (white, black, beige, moon, sky, solarized, league, serif).
- Choose a **transition** style (slide, fade, zoom, convex, concave, none).
- Theme colours (background, text, font) are probed at runtime and applied to the editor canvas.

#### Save & Export
- **Online save** (PUT `/api/p/{id}`) — persist the presentation to MongoDB with optional password rotation.
- **Offline export** — download the presentation as a self-contained JSON file.
- **JSON import** — re-import a previously exported JSON file from the home page.

#### Viewer
- Full-screen **Reveal.js** presentation viewer (`/p/{id}`).
- **PDF export** via `?print-pdf` query parameter.

#### Access control
- Optional **password protection** per presentation (bcrypt hash stored in MongoDB).
- **Share link** copied to clipboard in one click.
- Presentation IDs are persisted in `localStorage` for quick access to private decks.

#### Infrastructure
- **Internationalization** (i18n) with Babel / gettext — English 🇬🇧 and French 🇫🇷 out of the box; language selectable from the UI or inferred from `Accept-Language`.
- **TLS / reverse-proxy support** via `ProxyHeadersMiddleware` and configurable trusted hosts (`config.toml`).
- **Built-in HTTP proxy** (`/proxy?url=…`) to bypass cross-origin restrictions for iframe previews.
- **Docker Compose** stack (`compose.yml`) bundling Presento + MongoDB; production image published to `ghcr.io/b3nd3l/presento`.
- **GitHub Actions** CI/CD pipeline for automated image build and publish.

---

### 🐛 Bug Fixes

- Fixed **resize handle** not appearing after selecting an element (`0ec7ab2`).
- Fixed several **presentation viewer** rendering issues (`3aaffd1`).
- Fixed **translation fallback** crash when the browser sends an unknown or unsupported language (`38457f2`).
- Fixed `onclick` handler binding issues on dynamically created toolbar buttons (`8a71c78`).
- Fixed **FastAPI middleware** ordering that could corrupt response headers (`4b5af19`).
- Fixed **saving** race condition where a stale title could overwrite the persisted one (`f94456d`).
- Fixed multiple **editor bugs** introduced during the CSS/JS rework: element deselection, z-index jump on selection, ghost resize handle serialised into element HTML (`599acbd`).
- Fixed **x, y coordinate** calculation issues when dropping elements near the canvas edge (`4886b9c`).
- Fixed **fragment badge** and **resize handle** being incorrectly serialised into stored element HTML on save; they are now stripped before persistence (`cleanElementHtml`).

---

### 🔧 Internal / Refactoring

- Full **CSS and JavaScript rework** — design tokens, modular CSS files, editor/viewer separation.
- **edit.js refactoring** — extracted shared helpers (`$`, `getCanvas`, `getEmptyHint`, `setSaveStatus`, `withSelectedElData`, `updateEmptyHint`, `addElementToSlide`, `readFileAsDataURL`) to eliminate repeated DOM-access and control-flow patterns throughout the editor.
- **Selection overlay** moved to a dedicated layer above all elements, preserving visual z-order while keeping the resize handle always clickable.
- Alignment guide DOM nodes are lazily created and reused.
- Thumbnail refresh and history commit are debounced to avoid blocking the UI on rapid changes.

---

[0.1.0]: https://github.com/B3ND3L/presento/releases/tag/v0.1.0
[0.1.1]: https://github.com/B3ND3L/presento/releases/tag/v0.1.1
