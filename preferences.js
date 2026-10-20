// Layout preferences may fall back to this tab. User plans/libraries use their
// own explicit storage errors so unsaved work is never disguised as persistent.
const session = new Map();
export function getPreference(key, fallback = null) {
  try { return localStorage.getItem(key) ?? fallback; }
  catch { return session.get(key) ?? fallback; }
}
export function setPreference(key, value) {
  session.set(key, String(value));
  try { localStorage.setItem(key, String(value)); } catch { /* Session-only preference. */ }
}
export function removePreference(key) {
  session.delete(key);
  try { localStorage.removeItem(key); } catch { /* Session-only preference. */ }
}
