function parseHalfLife(str) {
  if (!str) return 24;
  str = str.toLowerCase();
  const match = str.match(/(\d+(?:\.\d+)?)\s*(min|hour|hr|h|day|d|week|wk|w|month|mo)/i);
  if (match) {
    let val = parseFloat(match[1]);
    let unit = match[2];
    if (unit.startsWith('min')) return val / 60;
    if (unit.startsWith('day') || unit === 'd') return val * 24;
    if (unit.startsWith('week') || unit.startsWith('wk') || unit === 'w') return val * 24 * 7;
    if (unit.startsWith('month') || unit.startsWith('mo')) return val * 24 * 30;
    return val; // hour is default
  }
  // fallback for just a number
  const match2 = str.match(/(\d+(?:\.\d+)?)/);
  if (match2) return parseFloat(match2[1]);
  return 24;
}
console.log(parseHalfLife("1 week")); // 168
console.log(parseHalfLife("165 hours")); // 165
console.log(parseHalfLife("30 min")); // 0.5
console.log(parseHalfLife("2 days")); // 48
