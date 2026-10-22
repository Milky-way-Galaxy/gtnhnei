// Layout preferences may fall back to this tab. User plans/libraries use their
// own explicit storage errors so unsaved work is never disguised as persistent.
const session = new Map();
export function getPreference(key, fallback = null) {
  if (session.has(key)) return session.get(key) ?? fallback;
  try { return localStorage.getItem(key) ?? fallback; }
  catch { return fallback; }
}
export function setPreference(key, value) {
  try { localStorage.setItem(key, String(value)); session.delete(key); }
  catch { session.set(key, String(value)); }
}
export function removePreference(key) {
  try { localStorage.removeItem(key); session.delete(key); }
  catch { session.set(key, null); /* Hide a retained value for this tab. */ }
}
