import { meadowCrops as crops } from "./meadowbrook.js";
import { mapHeight as H, mapWidth as W, rocks, tileSize as T, trees } from "./meadowbrook-map.js";

// Canvas scenery and sprite artwork adapted from the supplied Meadowbrook Farm.
export function meadowRenderer(canvas) {
  const background = document.createElement("canvas");
  background.width = canvas.width;
  background.height = canvas.height;
  let g = background.getContext("2d");

  function rect(x, y, w, h, c) {
    g.fillStyle = c;
    g.fillRect(Math.round(x), Math.round(y), w, h);
  }
  function box(x, y, w, h, c, outline = "#344d32") {
    rect(x, y, w, h, outline);
    rect(x + 1, y + 1, w - 2, h - 2, c);
  }
  function hash(x, y, s = 0) {
    const n = Math.sin(x * 127.1 + y * 311.7 + s * 53.3) * 43758.5453;
    return n - Math.floor(n);
  }
  function tile(x, y) {
    let px = x * T,
      py = y * T,
      rand = hash(x, y);
    rect(
      px,
      py,
      T,
      T,
      ["#699b50", "#6da052", "#70a255", "#699c50"][Math.floor(rand * 4)],
    );
    for (let j = 0; j < 3; j++) {
      let a = hash(x, y, j + 1),
        b = hash(x, y, j + 6);
      rect(
        px + 2 + Math.floor(a * 19),
        py + 2 + Math.floor(b * 19),
        2,
        2,
        j === 0 ? "#87ad5b" : "#5e9047",
      );
    }
    if (rand > 0.85) {
      rect(px + 8, py + 15, 1, 3, "#4f8742");
      rect(px + 7, py + 14, 3, 2, "#e9d891");
    }
  }
  function tree(x, y, kind = 0) {
    let a = x * T + 12,
      b = y * T + 22;
    rect(a - 12, b - 4, 24, 5, "#4f803e");
    rect(a - 3, b - 18, 6, 18, "#75513a");
    rect(a - 1, b - 17, 2, 15, "#a77545");
    rect(a - 16, b - 35, 32, 21, "#335f38");
    rect(a - 13, b - 43, 26, 29, "#3b753c");
    rect(a - 8, b - 47, 16, 32, "#488744");
    rect(a - 16, b - 33, 29, 13, "#4d8c43");
    rect(a - 12, b - 40, 24, 21, "#58974a");
    rect(a - 8, b - 44, 16, 16, "#73a952");
    rect(a - 13, b - 29, 9, 8, "#417e3e");
    rect(a + 5, b - 32, 10, 9, "#417e3e");
    rect(a - 7, b - 39, 5, 3, "#8eb966");
    if (kind) {
      for (let i = 0; i < 4; i++) {
        let xx = a - 11 + Math.floor(hash(x, y, i) * 22),
          yy = b - 36 + Math.floor(hash(y, x, i) * 15);
        rect(xx, yy, 3, 3, "#d66b4d");
        rect(xx, yy, 1, 1, "#ffbd71");
      }
    }
  }
  function pathTile(x, y) {
    let a = x * T,
      b = y * T;
    rect(a, b, 24, 24, "#c9b47b");
    rect(a, b, 24, 2, "#c0a971");
    for (let i = 0; i < 5; i++)
      rect(
        a + Math.floor(hash(x, y, i) * 22),
        b + Math.floor(hash(y, x, i + 9) * 22),
        2,
        1,
        i % 2 ? "#e0ca91" : "#b9a36e",
      );
  }
  function building(x, y, w, h, shop = false) {
    let a = x * T,
      b = y * T,
      ww = w * T,
      hh = h * T;
    rect(a - 3, b + hh - 1, ww + 6, 8, "#4b773d");
    box(a, b + 20, ww, hh - 20, shop ? "#e1c092" : "#ead3a0", "#5d5037");
    for (let i = 0; i < ww; i += 12) {
      rect(a + i, b + 25, 2, hh - 27, "#bc9a70");
    }
    rect(a + 2, b + hh - 7, ww - 4, 5, "#ad865d");
    let roof = shop ? "#487e78" : "#af6246",
      dark = shop ? "#315c5c" : "#814333",
      light = shop ? "#669a88" : "#d17f56";
    for (let i = 0; i < 25; i++) {
      let inset = Math.max(0, 14 - i);
      rect(
        a - 8 + inset,
        b - 10 + i,
        ww + 16 - inset * 2,
        1,
        i % 5 === 0 ? dark : roof,
      );
    }
    rect(a - 8, b + 15, ww + 16, 9, dark);
    rect(a - 8, b + 13, ww + 16, 4, light);
    for (let i = 0; i < ww; i += 12)
      rect(a + i, b + 3 + (i % 24 ? 3 : 0), 9, 2, light);
    let door = a + Math.floor(ww / 2) - 8;
    box(door, b + hh - 24, 16, 24, "#80593e", "#4a4330");
    rect(door + 3, b + hh - 21, 10, 17, "#a7774e");
    rect(door + 11, b + hh - 11, 2, 2, "#f0d183");
    for (let off of [9, ww - 26]) {
      box(a + off, b + 31, 17, 16, "#8db3ab", "#6b543d");
      rect(a + off + 8, b + 32, 2, 14, "#f7e1aa");
      rect(a + off + 1, b + 38, 15, 2, "#f7e1aa");
    }
    if (!shop) {
      box(a + ww - 23, b - 19, 12, 16, "#97725e", "#694d42");
      rect(a + ww - 25, b - 21, 16, 4, "#b08b74");
    } else {
      box(a + ww / 2 - 23, b + 24, 46, 10, "#e4c88b", "#6c5940");
      g.fillStyle = "#4f5337";
      g.font = "bold 7px monospace";
      g.textAlign = "center";
      g.fillText("SEEDS", a + ww / 2, b + 31);
    }
  }
  function pond() {
    for (let y = 7; y <= 14; y++)
      for (let x = 24; x <= 29; x++) {
        let d = ((x - 26.5) / 3.1) ** 2 + ((y - 10.5) / 4.1) ** 2;
        if (d < 1.22) {
          let a = x * T,
            b = y * T;
          rect(a, b, T, T, "#b1ae72");
          if (d < 1.03) {
            rect(a, b, T, T, "#4c8e87");
            rect(a + 2, b + 2, 20, 20, "#50978f");
            let r = hash(x, y);
            rect(
              a + 3 + Math.floor(r * 9),
              b + 6 + Math.floor(r * 9),
              7,
              1,
              "#82b9a1",
            );
            if (r > 0.86) {
              rect(a + 8, b + 10, 10, 5, "#659549");
              rect(a + 11, b + 8, 4, 2, "#e8b4a9");
            }
          }
        }
      }
  }
  function cropDraw(k, stage, x, y) {
    let a = x,
      b = y,
      c = crops[k],
      mature = stage >= c.days;
    rect(a - 1, b - 7, 2, 8, "#3a7137");
    if (stage === 0) {
      rect(a - 3, b - 4, 3, 2, "#8eaf53");
      rect(a + 1, b - 6, 3, 3, "#81aa50");
      return;
    }
    rect(a - 6, b - 10, 5, 5, c.leaf);
    rect(a + 1, b - 12, 5, 6, c.leaf);
    rect(a - 3, b - 13, 3, 6, "#7eac52");
    if (mature) {
      if (k === "carrot") {
        rect(a - 3, b - 6, 6, 7, c.color);
        rect(a - 2, b + 1, 4, 2, c.color);
        rect(a - 1, b + 3, 2, 1, "#bd693a");
      } else if (k === "strawberry") {
        for (let i of [-5, 3]) {
          rect(a + i, b - 6, 5, 6, c.color);
          rect(a + i + 1, b, 3, 2, "#b64450");
          rect(a + i + 1, b - 4, 1, 1, "#f7ce8b");
        }
      } else if (k === "pumpkin") {
        rect(a - 8, b - 7, 16, 9, "#b97632");
        rect(a - 6, b - 9, 12, 12, c.color);
        rect(a - 3, b - 8, 2, 10, "#f5b45c");
        rect(a + 3, b - 8, 2, 10, "#c77f35");
      } else {
        rect(a - 4, b - 6, 8, 8, "#b5a9a1");
        rect(a - 3, b - 7, 6, 8, c.color);
        rect(a - 2, b + 2, 4, 2, "#b2768f");
      }
    }
  }
  function plotDraw(x, y, p, weed, anim) {
    let a = x * T,
      b = y * T;
    rect(a + 1, b + 1, 22, 22, "#85a75a");
    if (p.tilled) {
      rect(a + 1, b + 1, 22, 22, p.water ? "#765a42" : "#a77c50");
      rect(a + 2, b + 2, 20, 20, p.water ? "#68503d" : "#966d48");
      for (let i = 5; i < 23; i += 6) {
        rect(a + 3, b + i, 18, 2, p.water ? "#836449" : "#b78959");
        rect(a + 4, b + i + 2, 15, 1, p.water ? "#5e4937" : "#805a3e");
      }
    } else {
      rect(a + 2, b + 2, 20, 20, "#94a967");
      rect(a + 3, b + 3, 18, 18, "#a2b271");
      rect(a + 5, b + 7, 2, 2, "#8fa25d");
    }
    if (weed) {
      rect(a + 11, b + 9, 2, 10, "#436d39");
      rect(a + 7, b + 11, 5, 3, "#54813c");
      rect(a + 13, b + 7, 4, 4, "#638c42");
    }
    if (p.crop) {
      cropDraw(p.crop, p.growth, a + 12, b + 16);
      if (
        p.growth >= crops[p.crop].days &&
        Math.floor(anim * 2 + x + y) % 5 === 0
      ) {
        rect(a + 18, b + 3, 1, 5, "#fff3bb");
        rect(a + 16, b + 5, 5, 1, "#fff3bb");
      }
    }
  }
  function person(px, py, dir = "down", moving = false, npc = false, anim = 0) {
    let a = Math.round(px * T),
      b = Math.round(py * T),
      step = moving ? Math.floor(anim * 9) % 2 : 0;
    rect(a - 8, b + 5, 16, 4, "#46733e");
    rect(a - 5, b - 1, 4, 7 + (step ? 1 : 0), "#3d5260");
    rect(a + 1, b - 1, 4, 7 + (step ? 0 : 1), "#3d5260");
    rect(a - 6, b + 5 + (step ? 1 : 0), 5, 2, "#513d32");
    rect(a + 1, b + 5 + (step ? 0 : 1), 5, 2, "#513d32");
    rect(a - 6, b - 10, 12, 11, npc ? "#9d6658" : "#557e88");
    rect(a - 4, b - 9, 8, 9, npc ? "#c88a74" : "#7199a0");
    rect(a - 8, b - 8, 2, 7, "#e3ad80");
    rect(a + 6, b - 8, 2, 7, "#e3ad80");
    rect(a - 5, b - 19, 10, 10, "#dca77b");
    rect(a - 4, b - 17, 8, 7, "#f0c697");
    if (dir !== "up") {
      rect(a - 3, b - 15, 1, 2, "#483d35");
      rect(a + 2, b - 15, 1, 2, "#483d35");
      rect(a - 1, b - 12, 2, 1, "#b77d63");
    }
    rect(a - 8, b - 20, 16, 4, npc ? "#704b43" : "#c4a05b");
    rect(a - 5, b - 24, 10, 5, npc ? "#895a49" : "#e5c67d");
    rect(a - 5, b - 20, 10, 1, "#937143");
  }
  function fence(x, y, w) {
    let a = x * T,
      b = y * T;
    rect(a, b + 9, w * T, 4, "#b89860");
    rect(a, b + 16, w * T, 3, "#987744");
    for (let i = 0; i <= w; i++) {
      rect(a + i * T - 2, b + 5, 5, 17, "#876a40");
      rect(a + i * T - 1, b + 5, 3, 16, "#d1ad72");
    }
  }
  function sign(x, y, t) {
    let a = x * T,
      b = y * T;
    rect(a + 11, b + 11, 3, 12, "#72543a");
    box(a - 4, b + 1, 32, 12, "#dfc38b", "#72543a");
    g.fillStyle = "#655138";
    g.textAlign = "center";
    g.font = "bold 7px monospace";
    g.fillText(t, a + 12, b + 9);
  }
  function drawFarm(farm, { anim, facing, moving, selected, reduced }) {
    g.drawImage(background, 0, 0);
    for (const [key, plot] of Object.entries(farm.plots)) {
      const [x, y] = key.split(",").map(Number);
      plotDraw(x, y, plot, farm.weeds[key], reduced ? 0 : anim);
    }
    drawTrees(farm.player, facing, moving && !reduced, reduced ? 0 : anim);
    if (farm.time >= 1080 || farm.time < 420) {
      const shade = farm.time >= 1080 ? Math.min(0.42, (farm.time - 1080) / 600 + 0.05) : 0.16;
      g.fillStyle = `rgba(40,48,90,${shade})`;
      g.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (farm.weather === "Rainy") {
      const weatherFrame = reduced ? 0 : anim;
      for (let i = 0; i < 95; i++) {
        const x = (hash(i, 0) * canvas.width + weatherFrame * 30) % canvas.width;
        const y = (hash(i, 1) * canvas.height + weatherFrame * 210) % canvas.height;
        rect(x, y, 1, 5, "#b6d6db88");
      }
    }
    if (selected) {
      const [x, y] = selected;
      g.strokeStyle = "#fff0a7";
      g.lineWidth = 2;
      g.strokeRect(x * T + 2, y * T + 2, T - 4, T - 4);
    }
  }

  const scenery = trees.map(([x, y], i) => ({ y: y + 1, draw: () => tree(x, y, i % 4 === 0) }));
  scenery.push({ y: 6.8, draw: () => person(25.5, 6.8, "down", false, true, 0) });
  scenery.sort((a, b) => a.y - b.y);

  function drawTrees(player, facing, moving, anim) {
    let drawn = false;
    for (const entry of scenery) {
      if (!drawn && player.y < entry.y) {
        person(player.x, player.y, facing, moving, false, anim);
        drawn = true;
      }
      entry.draw();
    }
    if (!drawn) person(player.x, player.y, facing, moving, false, anim);
  }


    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) tile(x, y);
    for (let x = 2; x < 30; x++) pathTile(x, 6);
    for (let y = 7; y < 19; y++) pathTile(8, y);
    for (let x = 9; x < 24; x++) pathTile(x, 17);
    for (let y = 7; y < 9; y++)
      for (let x = 14; x < 16; x++) pathTile(x, y);
    pond();
    fence(10, 8, 4);
    fence(16, 8, 5);
    fence(10, 16, 11);
    for (let [x, y] of rocks) {
      let a = x * T,
        b = y * T;
      rect(a + 4, b + 14, 15, 6, "#537841");
      rect(a + 5, b + 10, 13, 7, "#77847a");
      rect(a + 8, b + 7, 8, 6, "#a9aaa0");
      rect(a + 7, b + 9, 5, 2, "#c1c2ae");
    }
    building(3, 2, 4, 4);
    building(23, 2, 4, 4, true);
    sign(9, 8, "FIELD");

  g = canvas.getContext("2d");
  g.imageSmoothingEnabled = false;
  return drawFarm;
}

export function drawMeadowTool(canvas, i) {
  let a = canvas.getContext("2d");
  a.imageSmoothingEnabled = false;
  const r = (x, y, w, h, c) => {
    a.fillStyle = c;
    a.fillRect(x, y, w, h);
  };
  a.clearRect(0, 0, 24, 24);
  if (i === 0) {
    r(8, 5, 2, 9, "#ecc79c");
    r(11, 3, 2, 10, "#ecc79c");
    r(14, 5, 2, 9, "#ecc79c");
    r(17, 8, 2, 7, "#ecc79c");
    r(6, 11, 3, 7, "#cf9a78");
    r(9, 12, 10, 8, "#ecc79c");
    r(10, 20, 7, 2, "#c18b64");
  }
  if (i === 1 || i === 5) {
    r(6, 7, 3, 14, "#b18b5c");
    r(7, 8, 2, 12, "#ddbc7d");
    if (i === 1) {
      r(5, 4, 15, 4, "#9faeb0");
      r(16, 7, 4, 5, "#788b89");
      r(5, 4, 14, 1, "#d4d7c1");
    } else {
      r(8, 3, 12, 3, "#c9d1c2");
      r(17, 6, 4, 4, "#9eafac");
      r(13, 10, 5, 2, "#9eafac");
    }
  }
  if (i === 2) {
    r(5, 4, 14, 17, "#bc9b5d");
    r(6, 5, 12, 15, "#e4c17b");
    r(6, 3, 12, 3, "#e9d9a0");
    r(10, 10, 4, 6, "#718d48");
    r(8, 12, 3, 3, "#718d48");
  }
  if (i === 3) {
    r(6, 9, 13, 12, "#789ba4");
    r(8, 10, 8, 9, "#a0c2c3");
    r(2, 5, 3, 8, "#93aab0");
    r(3, 4, 6, 3, "#93aab0");
    r(16, 6, 5, 6, "#8eabb0");
    r(19, 3, 3, 5, "#b5c6bd");
    r(5, 20, 14, 2, "#587a81");
  }
  if (i === 4) {
    r(4, 11, 16, 9, "#bb9866");
    r(5, 10, 14, 2, "#ebc98b");
    r(7, 6, 2, 6, "#ad875a");
    r(15, 6, 2, 6, "#ad875a");
    r(9, 4, 6, 2, "#d9b980");
    r(7, 13, 2, 6, "#8f704e");
    r(12, 13, 2, 6, "#8f704e");
    r(17, 13, 1, 6, "#8f704e");
  }
}
