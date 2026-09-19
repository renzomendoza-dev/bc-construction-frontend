// Local calendar date as YYYY-MM-DD — the format <input type="date"> and the
// backend's LocalDate params use. Don't use toISOString().slice(0, 10) for
// "today": that's the UTC date, which in the Philippines (UTC+8) is still
// yesterday until 8 a.m.
export function localDateString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
