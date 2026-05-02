export function formatDate(ms: number, locale = "ja-JP"): string {
  if (!ms) return "";
  return new Date(ms).toLocaleDateString(locale);
}

export function formatDuration(sec: number): string {
  if (!sec) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}時間${m}分`;
  return `${m}分`;
}

export function formatRelativeDate(ms: number): string {
  if (!ms) return "";
  const diff = Date.now() - ms;
  const day = 1000 * 60 * 60 * 24;
  const days = Math.floor(diff / day);
  if (days < 1) return "今日";
  if (days < 7) return `${days}日前`;
  if (days < 30) return `${Math.floor(days / 7)}週間前`;
  return new Date(ms).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
