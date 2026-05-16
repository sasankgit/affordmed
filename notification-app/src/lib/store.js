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