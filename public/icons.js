/* =====================================================================
 * icons.js — inline SVG icon set (feather-style, stroke = currentColor)
 *   window.iconHTML(name, cls)  → svg markup string
 *   auto-injects into any [data-icon] element on load
 * ===================================================================== */
(function (global) {
  'use strict';

  // inner markup per icon (24x24 viewBox)
  const I = {
    cpu: '<rect x="6.5" y="6.5" width="11" height="11" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 2.5v3M15 2.5v3M9 18.5v3M15 18.5v3M2.5 9h3M2.5 15h3M18.5 9h3M18.5 15h3"/>',
    play: '<polygon points="7 4 19 12 7 20" fill="currentColor" stroke="none"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" stroke="none"/>',
    rotate: '<path d="M21 3v6h-6"/><path d="M20.5 13a8.5 8.5 0 1 1-2.6-7.1L21 9"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M18.5 6l-1 14a2 2 0 0 1-2 1.8H8.5a2 2 0 0 1-2-1.8L5.5 6"/><path d="M10 11v6M14 11v6"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h7"/>',
    folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    clear: '<circle cx="12" cy="12" r="9.5"/><path d="M15 9l-6 6M9 9l6 6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4l1.4-1.4M18 6l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    help: '<circle cx="12" cy="12" r="9.5"/><path d="M9.2 9.2a2.8 2.8 0 0 1 5.5.8c0 1.9-2.7 2.5-2.7 4"/><circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none"/>',
    support: '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="3.6"/><path d="M5 5l4 4M15 15l4 4M19 5l-4 4M5 19l4-4"/>',
    step: '<polygon points="6 4 15 12 6 20" fill="currentColor" stroke="none"/><rect x="17" y="4.5" width="2.2" height="15" rx="1" fill="currentColor" stroke="none"/>',
    restart: '<path d="M22 4v6h-6"/><path d="M2 20v-6h6"/><path d="M3.4 9a8.5 8.5 0 0 1 14-3.2L22 10M2 14l4.6 4.2A8.5 8.5 0 0 0 20.6 15"/>',
    close: '<path d="M18 6L6 18M6 6l12 12"/>',
    globe: '<circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19"/><path d="M12 2.5c2.6 2.5 4 5.9 4 9.5s-1.4 7-4 9.5c-2.6-2.5-4-5.9-4-9.5s1.4-7 4-9.5z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    fit: '<path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9"/><path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9"/><path d="M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15"/><path d="M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15"/>'
  };

  function iconHTML(name, cls) {
    const inner = I[name];
    if (!inner) return '';
    return `<svg class="icon${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" `
      + `stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" `
      + `aria-hidden="true">${inner}</svg>`;
  }

  function injectAll(root) {
    (root || document).querySelectorAll('[data-icon]').forEach(el => {
      if (el.dataset.iconDone) return;
      el.insertAdjacentHTML('afterbegin', iconHTML(el.dataset.icon));
      el.dataset.iconDone = '1';
    });
  }

  global.ICONS = I;
  global.iconHTML = iconHTML;
  global.injectIcons = injectAll;

  // inject immediately (scripts are at end of <body>, so DOM is ready)
  injectAll(document);
})(window);
