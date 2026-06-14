import { globalIndex } from './dataIndex.js';

export function parseSize(sizeStr) {
  if (!sizeStr) return null;
  const order = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  const idx = order.indexOf(sizeStr.toUpperCase().trim());
  if (idx !== -1) return { type: 'standard', value: idx, raw: sizeStr };
  const numMatch = sizeStr.match(/(\d+(?:\.\d+)?)/);
  if (numMatch) return { type: 'numeric', value: parseFloat(numMatch[1]), raw: sizeStr };
  return { type: 'unknown', value: 0, raw: sizeStr };
}

export function matchSize(costumeSize, actorSize) {
  if (!costumeSize && !actorSize) return { level: 'unknown', label: '未填尺码' };
  if (!costumeSize || !actorSize) return { level: 'unknown', label: '部分未填' };
  const c = parseSize(costumeSize);
  const a = parseSize(actorSize);
  if (!c || !a || c.type === 'unknown' || a.type === 'unknown') return { level: 'unknown', label: '无法匹配' };
  if (c.type !== a.type) return { level: 'unknown', label: '尺码类型不同' };
  const diff = Math.abs(c.value - a.value);
  if (diff === 0) return { level: 'perfect', label: '完全匹配' };
  if (diff <= 1 && c.type === 'standard') return { level: c.value > a.value ? 'loose' : 'tight', label: c.value > a.value ? '偏大' : '偏小' };
  if (diff <= 2 && c.type === 'numeric') return { level: c.value > a.value ? 'loose' : 'tight', label: c.value > a.value ? '偏大' : '偏小' };
  return { level: 'mismatch', label: '差异较大' };
}

export function getActorById(id) {
  return globalIndex.getActorById(id);
}

export function getActorsByPlay(play) {
  return globalIndex.getActorsByPlay(play);
}

export function getMatchBadgeClass(level) {
  if (level === 'perfect') return 'match-perfect';
  if (level === 'loose' || level === 'tight') return 'match-close';
  if (level === 'mismatch') return 'match-mismatch';
  return 'match-unknown';
}

export function findActorByName(name) {
  return globalIndex.findActorByName(name);
}

export function searchActorsByName(name) {
  return globalIndex.searchActorsByName(name);
}

export function getActorBorrowHistory(actorName) {
  return globalIndex.getActorBorrowHistory(actorName);
}

export function getActorReservationHistory(actorName) {
  return globalIndex.getActorReservationHistory(actorName);
}

export function getActorCostumeHistory(actorName) {
  return globalIndex.getActorCostumeHistory(actorName);
}

export function checkPlayMatch(costumePlay, actorPlays) {
  if (!costumePlay) return { match: true, label: '服装未填剧目' };
  if (!actorPlays || actorPlays.length === 0) return { match: false, label: '演员未填参演剧目' };
  const playList = Array.isArray(actorPlays) ? actorPlays : String(actorPlays).split(/[,，、\s]+/).map((s) => s.trim()).filter(Boolean);
  const found = playList.some((p) => String(p).trim() === String(costumePlay).trim());
  if (found) return { match: true, label: `匹配剧目「${costumePlay}」` };
  return { match: false, label: `演员参演剧目不包含「${costumePlay}」` };
}
