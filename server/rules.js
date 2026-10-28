'use strict';
// Rules for the HAYSAG table. The upstream engine still creates and deals tiles.
function effective(game, tile) {
  return tile.isFakeJoker ? { color: game.okey.color, number: game.okey.number } : tile;
}
function wild(game, tile) { return !tile.isFakeJoker && tile.color === game.okey.color && tile.number === game.okey.number; }
function groupValue(game, tiles, pairs = false) {
  if (!Array.isArray(tiles) || tiles.some(t => !t)) return null;
  const normal = tiles.filter(t => !wild(game, t)).map(t => effective(game, t));
  if (pairs) return tiles.length === 2 && (normal.length < 2 || normal.every(t => t.color === normal[0].color && t.number === normal[0].number)) ? 0 : null;
  if (tiles.length < 3 || tiles.length > 13 || !normal.length) return null;
  const sameNumber = normal.every(t => t.number === normal[0].number);
  if (tiles.length <= 4 && sameNumber && new Set(normal.map(t => t.color)).size === normal.length) return normal[0].number * tiles.length;
  if (!normal.every(t => t.color === normal[0].color) || new Set(normal.map(t => t.number)).size !== normal.length) return null;
  // Choose the highest legal interval when end jokers have more than one interpretation.
  for (let start = 14 - tiles.length; start >= 1; start--) {
    if (normal.every(t => t.number >= start && t.number < start + tiles.length)) return tiles.length * (2 * start + tiles.length - 1) / 2;
  }
  return null;
}
function selectedGroups(game, index, groups, pairs = false) {
  const hand = game.playerTiles[index];
  if (!Array.isArray(groups) || !groups.length || groups.length > 11) throw new Error('Önce geçerli grupları seçin.');
  const used = new Set();
  const tiles = groups.map(ids => {
    if (!Array.isArray(ids) || ids.length < 2 || ids.length > 13) throw new Error('Geçersiz grup.');
    return ids.map(id => {
      const tile = hand.find(t => t.id === id);
      if (!tile || used.has(id)) throw new Error('Taşlar elinizde bulunmalı ve bir kez kullanılmalı.');
      used.add(id);
      return tile;
    });
  });
  if (used.size >= hand.length) throw new Error('Bitirmek için elinizde bir atış taşı kalmalı.');
  const values = tiles.map(g => groupValue(game, g, pairs));
  if (values.some(v => v === null)) throw new Error(pairs ? 'Her çift aynı iki taştan oluşmalı.' : 'Geçersiz seri veya per.');
  return { tiles, used, score: values.reduce((a,b) => a + b, 0) };
}
module.exports = { effective, wild, groupValue, selectedGroups };
