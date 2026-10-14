function pad(n) { return String(n).padStart(2, '0'); }

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtDate(s) {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${y}年${Number(m)}月${Number(d)}日`;
}

function fmtDateTime(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 计算某个纪念日在今天之后的下一次发生时间；不循环且已过期则返回 null
function nextOccur(dateStr, repeatYearly) {
  const base = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!repeatYearly) return base >= today ? base : null;
  let n = new Date(base);
  n.setFullYear(today.getFullYear());
  if (n < today) n.setFullYear(today.getFullYear() + 1);
  return n;
}

function daysUntil(d) {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((d - t) / 86400000);
}

// 给纪念日列表附加 { next, days }，按临近程度排序
function annivList(rows) {
  return rows
    .map((a) => {
      const n = nextOccur(a.date, a.repeat_yearly);
      if (!n) return null;
      return { ...a, next: n, days: daysUntil(n) };
    })
    .filter(Boolean)
    .sort((x, y) => x.days - y.days);
}

module.exports = { pad, todayStr, fmtDate, fmtDateTime, nextOccur, daysUntil, annivList };
