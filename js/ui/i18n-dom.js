// Translates static markup (index.html) from data attributes:
//   data-i18n="key"             textContent
//   data-i18n-html="key_html"   innerHTML, sanitized
//   data-i18n-title="key"       title attribute
//   data-i18n-placeholder="key" placeholder attribute
//   data-i18n-aria="key"        aria-label attribute
//   data-i18n-alt="key"         alt attribute
// An element whose key is missing keeps the English already in the markup, so
// this is safe to run before every string has been moved into the table.
// Kept apart from js/core/i18n.js so that module stays free of DOM code.

import { hasKey, t, tHtml } from '../core/i18n.js';
import { sanitizeHtml } from './ui-utils.js';

const ATTRS = [
    ['data-i18n-title', 'title'],
    ['data-i18n-placeholder', 'placeholder'],
    ['data-i18n-aria', 'aria-label'],
    ['data-i18n-alt', 'alt'],
];

export function applyDomI18n(root = document) {
    for (const el of root.querySelectorAll('[data-i18n]')) {
        const key = el.getAttribute('data-i18n');
        if (hasKey(key)) el.textContent = t(key);
        else t(key);   // records the miss for ?i18n-debug
    }
    for (const el of root.querySelectorAll('[data-i18n-html]')) {
        const key = el.getAttribute('data-i18n-html');
        if (hasKey(key)) el.innerHTML = sanitizeHtml(tHtml(key));
        else t(key);
    }
    for (const [data, attr] of ATTRS) {
        for (const el of root.querySelectorAll(`[${data}]`)) {
            const key = el.getAttribute(data);
            if (hasKey(key)) el.setAttribute(attr, t(key));
            else t(key);
        }
    }
}
