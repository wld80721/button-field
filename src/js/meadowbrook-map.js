export const tileSize = 24;
export const mapWidth = 32;
export const mapHeight = 20;

export const trees = [
  [0, 1],
  [2, 0],
  [5, 0],
  [8, 1],
  [11, 0],
  [15, 0],
  [18, 1],
  [21, 0],
  [25, 0],
  [29, 0],
  [31, 2],
  [0, 5],
  [0, 9],
  [0, 13],
  [0, 17],
  [3, 19],
  [7, 19],
  [10, 19],
  [15, 19],
  [19, 19],
  [23, 19],
  [27, 19],
  [31, 18],
  [31, 14],
  [31, 10],
  [31, 6],
  [27, 7],
  [29, 11],
  [5, 14],
  [4, 16],
  [24, 16],
];
export const rocks = [
  [2, 11],
  [6, 17],
  [25, 13],
  [29, 8],
  [9, 3],
  [21, 17],
];

export function blocked(x, y) {
  if (x < 1 || y < 1 || x >= mapWidth - 1 || y >= mapHeight - 1) return true;
  if (
    (x >= 3 && x <= 6 && y >= 2 && y <= 5) ||
    (x >= 23 && x <= 26 && y >= 2 && y <= 5)
  )
    return true;
  if (
    trees.some((t) => t[0] === x && t[1] === y) ||
    rocks.some((t) => t[0] === x && t[1] === y)
  )
    return true;
  if (((x - 26.5) / 3.1) ** 2 + ((y - 10.5) / 4.1) ** 2 < 1.03)
    return true;
  if (y === 8 && ((x >= 10 && x <= 13) || (x >= 16 && x <= 20)))
    return true;
  if (y === 16 && x >= 10 && x <= 20) return true;
  return false;
}

const steps = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function pathTo(player, x, y, interact) {
  const start = [Math.floor(player.x), Math.floor(player.y)];
  const queue = [start];
  const visited = new Map([[start.join(","), null]]);
  for (let i = 0; i < queue.length; i++) {
    const [column, row] = queue[i];
    const distance = Math.abs(column - x) + Math.abs(row - y);
    if (distance <= Number(interact)) {
      const path = [];
      let tile = queue[i];
      while (tile !== start) {
        path.push([tile[0] + 0.5, tile[1] + 0.5]);
        tile = visited.get(tile.join(","));
      }
      return path.reverse();
    }
    for (const [dx, dy] of steps) {
      const next = [column + dx, row + dy];
      const key = next.join(",");
      if (visited.has(key) || blocked(...next)) continue;
      visited.set(key, queue[i]);
      queue.push(next);
    }
  }
  return null;
}
