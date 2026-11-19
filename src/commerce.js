export function parseDate(value) {
  if (!value) return null;
  const source = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? value.replace(' ', 'T') + 'Z' : value;
  const date = new Date(source);
  return Number.isNaN(date.valueOf()) ? null : date;
}
export function timestamp(value) {
  const date = parseDate(value);
  return date ? new Intl.DateTimeFormat('en', { dateStyle:'medium', timeStyle:'short', timeZone:'UTC' }).format(date) + ' UTC' : '—';
}
export function money(value, currency = 'EUR') {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('en', { style:'currency', currency }).format(Number(value));
}
export function snapshot(row) {
  if (typeof row.snapshot !== 'string') return row.snapshot || {};
  try { return JSON.parse(row.snapshot); } catch { return {}; }
}
export function offerState(offer, pack, now = Date.now()) {
  if (!Number(offer.enabled)) return 'disabled';
  if (pack && !Number(pack.enabled)) return 'package disabled';
  const start = parseDate(offer.starts_at), end = parseDate(offer.ends_at);
  if (!start || !end) return 'invalid schedule';
  if (now < start.valueOf()) return 'scheduled';
  return now >= end.valueOf() ? 'expired' : 'active';
}
export function sameTerms(a, b) {
  return Number(a.package_amount) === Number(b.package_amount) &&
    Number(a.periods) === Number(b.periods) && Number(a.count_devices) === Number(b.count_devices) &&
    Number(a.offer_id || 0) === Number(b.offer_id || 0);
}
