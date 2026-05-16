// tracks which notification IDs have been read, stored in memory
// persists across page navigations within the same session using localStorage

const STORAGE_KEY = "read_notifications";

function getReadSet() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveReadSet(set) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // silently fail if storage is unavailable
  }
}

export function isRead(id) {
  return getReadSet().has(id);
}

export function markRead(id) {
  const set = getReadSet();
  set.add(id);
  saveReadSet(set);
}

export function markAllRead(ids) {
  const set = getReadSet();
  ids.forEach((id) => set.add(id));
  saveReadSet(set);
}