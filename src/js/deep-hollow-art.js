import { GROUND, H, T, W, hash, hollowTile, ores, radii } from "./deep-hollow-map.js";

// Camp, miner, ores and terrain artwork adapted from the supplied Deep Hollow.
function rect(c, x, y, w, h, color) {
  c.fillStyle = color;
  c.fillRect(Math.floor(x), Math.floor(y), w, h);
}
export function oreSprite(c, id, x, y, scale = 1) {
  let o = ores[id - 3];
  if (!o) return;
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  rect(c, 3, 7, 10, 5, o.dark);
  rect(c, 4, 5, 8, 6, o.color);
  rect(c, 6, 3, 5, 2, o.color);
  rect(c, 5, 5, 4, 2, o.light);
  rect(c, 3, 8, 3, 2, o.light);
  rect(c, 10, 8, 3, 3, o.color);
  rect(c, 7, 11, 4, 2, o.dark);
  c.restore();
}

export function hollowRenderer(canvas, S, board) {
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  let camX, camY, mine, clock, walk, face;
  const tile = (x, y) => hollowTile(board, x, y);
  const atCamp = () => S.y < GROUND;
  function center() {
    camX = Math.max(0, Math.min(W * T - 480, S.x * T + 8 - 240));
    camY = Math.max(0, Math.min(H * T - 320, S.y * T + 8 - 160));
  }
  function sky() {
    let c = ctx;
    rect(c, 0, 0, 480, 320, "#182328");
    let sy = -camY;
    rect(c, 0, sy, 480, 80, "#a3c7c2");
    rect(c, 0, sy + 36, 480, 44, "#c2d4b6");
    let sunX = 380 - Math.floor(camX * 0.15);
    rect(c, sunX, sy + 7, 24, 24, "#fce3a1");
    rect(c, sunX - 3, sy + 12, 30, 14, "#fce3a1");
    for (let i = -1; i < 12; i++) {
      let x = i * 54 - (Math.floor(camX * 0.25) % 54),
        y = sy + 27 + Math.floor(hash(i, 9, 5) * 14);
      rect(c, x, y, 34, 4, "#d6dfc5");
      rect(c, x + 6, y - 4, 22, 4, "#d6dfc5");
    }
    for (let i = -2; i < 19; i++) {
      let x = i * 32 - (Math.floor(camX * 0.45) % 32),
        h = 12 + Math.floor(hash(i, 8, 3) * 23);
      for (let j = 0; j < h; j += 4)
        rect(c, x + j / 2, sy + 68 - h + j, 32 - j, 4, "#708f8b");
    }
    rect(c, 0, sy + 66, 480, 14, "#799987");
    for (let i = 0; i < 30; i++) {
      let x = i * 22 - (Math.floor(camX * 0.75) % 22),
        hh = 8 + Math.floor(hash(i, 10) * 12);
      rect(c, x, sy + 80 - hh, 6, hh, "#496e67");
      rect(c, x - 4, sy + 80 - hh + 4, 14, 6, "#496e67");
    }
    rect(c, 0, sy + 76, 480, 4, "#729163");
  }
  function campObject(x, y, type) {
    let c = ctx;
    x -= camX;
    y -= camY;
    if (type === "house") {
      rect(c, x, y + 13, 60, 28, "#68513c");
      rect(c, x + 3, y + 15, 54, 26, "#bb9362");
      for (let i = 0; i < 4; i++)
        rect(c, x + 3, y + 20 + i * 6, 54, 1, "#8e6b47");
      rect(c, x - 3, y + 11, 66, 4, "#523d33");
      for (let j = 0; j < 12; j += 2)
        rect(c, x + 2 + j * 2, y + 11 - j, 56 - j * 4, 3, "#815443");
      rect(c, x + 24, y + 1, 12, 2, "#bf8662");
      rect(c, x + 9, y + 21, 12, 10, "#523f36");
      rect(c, x + 11, y + 23, 8, 6, "#ebc978");
      rect(c, x + 38, y + 23, 12, 18, "#5b4537");
      rect(c, x + 40, y + 25, 8, 16, "#856048");
      rect(c, x + 45, y + 32, 2, 2, "#f6d67f");
      rect(c, x + 14, y + 3, 5, 7, "#594b45");
      rect(c, x + 13, y + 2, 7, 2, "#8c7969");
      rect(c, x + 17, y + 14, 28, 7, "#473f32");
      c.fillStyle = "#f2d39b";
      c.font = "6px monospace";
      c.fillText("TRADE", x + 21, y + 20);
    } else if (type === "lift") {
      rect(c, x + 1, y + 6, 3, 34, "#5e4636");
      rect(c, x + 26, y + 6, 3, 34, "#5e4636");
      rect(c, x - 2, y + 2, 34, 5, "#a58255");
      rect(c, x + 12, y + 7, 5, 7, "#7c8276");
      rect(c, x + 14, y + 14, 1, 26, "#d0c29c");
      rect(c, x + 3, y + 24, 24, 3, "#9b7950");
      rect(c, x + 3, y + 37, 24, 3, "#b69b63");
      rect(c, x + 5, y + 29, 20, 8, "#716350");
      rect(c, x + 6, y + 30, 18, 1, "#a38c64");
    } else if (type === "tree") {
      rect(c, x + 7, y + 15, 4, 25, "#765940");
      rect(c, x + 3, y + 6, 12, 17, "#385f53");
      rect(c, x, y + 10, 18, 9, "#4b7d61");
      rect(c, x + 4, y + 2, 10, 13, "#57866a");
      rect(c, x + 4, y + 6, 4, 6, "#77a17a");
    } else {
      rect(c, x, y + 27, 15, 13, "#9b774d");
      rect(c, x + 1, y + 28, 13, 2, "#caa36a");
      rect(c, x + 2, y + 30, 2, 9, "#66513a");
      rect(c, x + 11, y + 30, 2, 9, "#66513a");
      rect(c, x + 6, y + 32, 3, 3, "#edc97e");
    }
  }
  function rock(x, y, id) {
    let c = ctx,
      px = x * T - camX,
      py = y * T - camY,
      d = y - GROUND;
    let dark =
      d < 8
        ? "#583e34"
        : d < 23
          ? "#3f4043"
          : d < 42
            ? "#454045"
            : d < 62
              ? "#423b51"
              : d < 80
                ? "#48353f"
                : "#303d4b";
    let back =
      d < 8
        ? "#46382e"
        : d < 23
          ? "#30353a"
          : d < 42
            ? "#35313b"
            : d < 62
              ? "#322e42"
              : d < 80
                ? "#362832"
                : "#222e3e";
    if (id === 0) {
      rect(c, px, py, 16, 16, back);
      for (let i = 0; i < 4; i++) {
        let ox = Math.floor(hash(x, y, i + 30) * 14),
          oy = Math.floor(hash(y, x, i + 42) * 14);
        rect(c, px + ox, py + oy, 2, 1, dark);
      }
      if (tile(x, y + 1) !== 0) rect(c, px, py + 15, 16, 1, "#191f24");
      if (tile(x - 1, y) !== 0) rect(c, px, py, 1, 16, "#202127");
      return;
    }
    let base =
      id === 1
        ? "#926749"
        : d < 10
          ? "#8c7b70"
          : d < 23
            ? "#777b7e"
            : d < 42
              ? "#82757b"
              : d < 62
                ? "#716683"
                : d < 80
                  ? "#79555d"
                  : "#526b7b";
    let lo = id === 1 ? "#6a4939" : dark,
      hi =
        id === 1
          ? "#b5875b"
          : d < 23
            ? "#a09a91"
            : d < 42
              ? "#aa8e90"
              : d < 62
                ? "#9981a0"
                : d < 80
                  ? "#a9757b"
                  : "#789aa6";
    if (id === 9) {
      base = "#272e35";
      hi = "#424a51";
      lo = "#171d24";
    }
    rect(c, px, py, 16, 16, lo);
    rect(c, px + 1, py + 1, 14, 14, base);
    rect(c, px + 1, py + 1, 14, 1, hi);
    rect(c, px + 1, py + 2, 1, 13, hi);
    rect(c, px + 2, py + 14, 13, 1, lo);
    for (let i = 0; i < 7; i++) {
      let ox = 2 + Math.floor(hash(x, y, i + 90) * 11),
        oy = 3 + Math.floor(hash(y, x, i + 101) * 10);
      rect(
        c,
        px + ox,
        py + oy,
        1 + Math.floor(hash(x, y, i + 3) * 3),
        1,
        i % 3 === 0 ? hi : lo,
      );
    }
    if (y === GROUND) {
      rect(c, px, py, 16, 2, "#6e955a");
      rect(c, px + 2, py + 2, 4, 2, "#4f7b4e");
      rect(c, px + 10, py + 2, 3, 1, "#a4b16f");
    }
    if (id >= 3 && id <= 8) {
      let o = ores[id - 3];
      for (let i = 0; i < 3; i++) {
        let ox = 3 + Math.floor(hash(x, y, 230 + i) * 9),
          oy = 3 + Math.floor(hash(y, x, 340 + i) * 9);
        rect(c, px + ox - 1, py + oy, 5, 4, o.dark);
        rect(c, px + ox, py + oy, 3, 3, o.color);
        rect(c, px + ox, py + oy, 2, 1, o.light);
      }
      if (id >= 6) {
        rect(c, px + 6, py + 5, 3, 6, o.color);
        rect(c, px + 7, py + 3, 1, 2, o.light);
        rect(c, px + 6, py + 5, 1, 4, o.light);
      }
    }
  }
  function player() {
    let c = ctx,
      x = S.x * T - camX,
      y = S.y * T - camY,
      bob =
        clock - walk < 0.13
          ? Math.floor(Math.sin((clock - walk) * 40) * 1.5)
          : 0;
    rect(c, x + 3, y + 14, 11, 2, "#272625");
    c.save();
    c.translate(Math.floor(x + 8), Math.floor(y + bob));
    c.scale(face, 1);
    rect(c, -5, 7, 4, 6, "#634c37");
    rect(c, -6, 8, 2, 4, "#a67a4f");
    rect(c, -3, 9, 7, 4, "#536d70");
    rect(c, -3, 12, 3, 3, "#343b40");
    rect(c, 2, 12, 3, 3, "#343b40");
    rect(c, -4, 14, 4, 1, "#c19a62");
    rect(c, 2, 14, 4, 1, "#c19a62");
    rect(c, -4, 4, 8, 6, "#dfad7a");
    rect(c, -5, 3, 10, 2, "#976b39");
    rect(c, -5, 2, 9, 2, "#d6ab57");
    rect(c, -3, 0, 6, 3, "#f2ce75");
    rect(c, 3, 3, 3, 2, "#fceab0");
    rect(c, 2, 6, 1, 1, "#383735");
    rect(c, -4, 9, 1, 4, "#bd9369");
    rect(c, 4, 9, 2, 3, "#e2b17c");
    if (mine && !mine.blocked) {
      let swing = Math.sin(clock * 30) > 0;
      rect(c, 6, swing ? 4 : 8, 2, 6, "#b18450");
      rect(c, 4, swing ? 3 : 7, 7, 2, "#d4d6ca");
      rect(c, 10, swing ? 4 : 8, 2, 3, "#89999c");
    } else {
      rect(c, 6, 9, 2, 5, "#986f49");
      rect(c, 4, 8, 6, 2, "#b9c1bc");
    }
    c.restore();
  }
  const lightCanvas = document.createElement("canvas");
  lightCanvas.width = 480;
  lightCanvas.height = 320;
  const lc = lightCanvas.getContext("2d");
  function lighting() {
    if (atCamp()) return;
    let cx = S.x * T + 8 - camX,
      cy = S.y * T + 7 - camY,
      r = radii[S.lamp] * T;
    lc.clearRect(0, 0, 480, 320);
    let g = lc.createRadialGradient(cx, cy, 14, cx, cy, r);
    g.addColorStop(0, "rgba(12,15,22,0)");
    g.addColorStop(0.34, "rgba(12,15,22,0.04)");
    g.addColorStop(0.7, "rgba(12,15,22,0.36)");
    g.addColorStop(1, "rgba(9,12,20,0.86)");
    lc.fillStyle = g;
    lc.fillRect(0, 0, 480, 320);
    ctx.drawImage(lightCanvas, 0, 0);
  }
  function paint({ dt, shake, particles, mine: target, clock: elapsed, walk: lastStep, face: facing, reduced }) {
    mine = target;
    clock = reduced ? 0 : elapsed;
    walk = reduced ? -1 : lastStep;
    face = facing;
    let tx = Math.max(0, Math.min(W * T - 480, S.x * T + 8 - 240)),
      ty = Math.max(0, Math.min(H * T - 320, S.y * T + 8 - 160));
    const follow = reduced ? 1 : Math.min(1, dt * 12);
    camX += (tx - camX) * follow;
    camY += (ty - camY) * follow;
    if (Math.abs(camX - tx) < 0.5) camX = tx;
    if (Math.abs(camY - ty) < 0.5) camY = ty;
    ctx.save();
    ctx.translate(
      reduced ? 0 : Math.round(shake * (Math.random() - 0.5)),
      reduced ? 0 : Math.round(shake * (Math.random() - 0.5)),
    );
    sky();
    let x0 = Math.max(0, Math.floor(camX / 16)),
      y0 = Math.max(GROUND, Math.floor(camY / 16));
    for (let y = y0; y < Math.min(H, y0 + 22); y++)
      for (let x = x0; x < Math.min(W, x0 + 32); x++)
        rock(x, y, tile(x, y));
    if (camY < 80) {
      for (let x of [3, 10, 40, 48]) campObject(x * T, 40, "tree");
      campObject(19 * T, 39, "house");
      campObject(30 * T, 39, "house");
      campObject(25.6 * T, 40, "lift");
      campObject(22.7 * T, 40, "crate");
      campObject(33.8 * T, 40, "crate");
      for (let x = 0; x < W; x++) {
        if (x === 26) continue;
        let px = x * 16 - camX,
          py = 77 - camY;
        rect(ctx, px + 3, py, 2, 3, "#b4b978");
        rect(ctx, px + 12, py + 1, 2, 2, "#486d50");
      }
    }
    player();
    for (let p of particles) {
      rect(ctx, p.x - camX, p.y - camY, p.size, p.size, p.col);
    }
    lighting();
    if (mine) {
      let px = mine.x * T - camX,
        py = mine.y * T - camY;
      ctx.strokeStyle = mine.blocked ? "#dd7777" : "#efce88";
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.floor(px) + 0.5, Math.floor(py) + 0.5, 15, 15);
      if (!mine.blocked) {
        let pr = Math.min(1, mine.progress);
        rect(ctx, px + 1, py + 13, 14, 2, "#2b2221");
        rect(ctx, px + 1, py + 13, Math.floor(14 * pr), 2, "#ffd278");
        ctx.strokeStyle = "#4a4038";
        ctx.beginPath();
        ctx.moveTo(px + 8, py + 3);
        ctx.lineTo(px + 5, py + 7);
        ctx.lineTo(px + 9, py + 10);
        if (pr > 0.4) {
          ctx.moveTo(px + 5, py + 7);
          ctx.lineTo(px + 2, py + 9);
          ctx.moveTo(px + 9, py + 10);
          ctx.lineTo(px + 13, py + 6);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function tileAt(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    return [
      Math.floor(((clientX - r.left) * canvas.width / r.width + camX) / T),
      Math.floor(((clientY - r.top) * canvas.height / r.height + camY) / T),
    ];
  }

  center();
  return { paint, center, tileAt };
}
