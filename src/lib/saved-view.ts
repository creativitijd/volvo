type SavedSnapshot = { onlySaved: boolean; count: number; active: boolean };

let snapshot: SavedSnapshot = { onlySaved: false, count: 0, active: false };
let toggle = () => {};
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeSaved(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSavedSnapshot() {
  return snapshot;
}

export function setSavedControls(next: { onlySaved: boolean; count: number }, onToggle: () => void) {
  toggle = onToggle;
  if (snapshot.active && snapshot.onlySaved === next.onlySaved && snapshot.count === next.count) return;
  snapshot = { ...next, active: true };
  emit();
}

export function clearSavedControls() {
  toggle = () => {};
  if (!snapshot.active && snapshot.count === 0 && !snapshot.onlySaved) return;
  snapshot = { onlySaved: false, count: 0, active: false };
  emit();
}

export function toggleSaved() {
  toggle();
}
