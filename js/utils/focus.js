// Remembers which tagged input had focus before a re-render and restores it after.
export function captureFocus(root) {
    const el = document.activeElement;
    if (!root || !el || !root.contains(el) || !el.dataset?.focusKey) return null;
    return { key: el.dataset.focusKey, start: el.selectionStart, end: el.selectionEnd };
}

export function restoreFocus(root, snapshot) {
    if (!snapshot) return;
    const el = root.querySelector(`[data-focus-key="${snapshot.key}"]`);
    if (!el) return;
    el.focus({ preventScroll: true });
    try {
        el.setSelectionRange(snapshot.start, snapshot.end);
    } catch (e) {
        /* some input types don't support selection */
    }
}
