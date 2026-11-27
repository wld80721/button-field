const sprites = new Map();

// The source sprites are drawn at their native pixel scale and shared by the field and interiors.
function pixelSprite(id) {
  if (sprites.has(id)) return sprites.get(id);
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 52;
  const c = canvas.getContext("2d");
  const box = (color, x, y, width, height) => {
    c.fillStyle = color;
    c.fillRect(x, y, width, height);
  };
  const shape = (color, points) => {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(...points[0]);
    for (const point of points.slice(1)) c.lineTo(...point);
    c.closePath();
    c.fill();
  };
  const ink = "#162e35";
  const soil = "#76503c";
  const wood = "#a46a43";
  const honey = "#e7ac66";
  const shade = "#173d396f";
  const shadow = (x = 3, width = 58) => box(shade, x, 45, width, 4);
  const roof = (dark, light) => {
    shape(ink, [[3, 26], [17, 8], [47, 8], [61, 26], [61, 30], [3, 30]]);
    shape(dark, [[6, 25], [18, 10], [46, 10], [58, 25]]);
    shape(light, [[16, 19], [22, 11], [45, 11], [51, 19]]);
    for (let x = 13; x < 53; x += 9) box(dark, x, 18, 2, 5);
    box(light, 7, 25, 50, 2);
  };
  const cabin = (dark, light) => {
    shadow();
    box(ink, 9, 25, 46, 21);
    box(wood, 12, 26, 40, 17);
    for (let y = 30; y < 43; y += 5) box(soil, 12, y, 40, 1);
    box(honey, 12, 27, 3, 15);
    box(ink, 27, 30, 12, 15);
    box(soil, 29, 32, 8, 12);
    box(honey, 34, 38, 2, 2);
    box(ink, 16, 31, 8, 8);
    box("#f9d782", 18, 33, 4, 4);
    box(ink, 42, 31, 8, 8);
    box("#f9d782", 44, 33, 4, 4);
    roof(dark, light);
  };
  const pine = (x, y) => {
    box("#553d34", x + 10, y + 27, 6, 11);
    box("#936045", x + 11, y + 27, 2, 10);
    shape("#173e38", [[x + 13, y], [x + 24, y + 17], [x + 20, y + 17], [x + 29, y + 32], [x, y + 32], [x + 6, y + 19], [x + 3, y + 19]]);
    shape("#2d794c", [[x + 13, y + 3], [x + 17, y + 13], [x + 15, y + 13], [x + 24, y + 27], [x + 5, y + 27]]);
    box("#64a858", x + 9, y + 22, 6, 2);
    box("#8cba66", x + 12, y + 12, 3, 2);
  };
  const oak = () => {
    shadow(10, 43);
    box("#4b4631", 25, 28, 13, 19);
    box("#936347", 27, 28, 8, 17);
    box("#b4845a", 28, 31, 3, 11);
    shape("#18473a", [[8, 22], [13, 22], [13, 14], [20, 14], [20, 8], [37, 8], [37, 12], [48, 12], [48, 20], [56, 20], [56, 34], [47, 34], [47, 39], [16, 39], [16, 35], [8, 35]]);
    shape("#3a824d", [[11, 23], [17, 23], [17, 16], [23, 16], [23, 10], [37, 10], [37, 14], [46, 14], [46, 24], [51, 24], [51, 31], [43, 31], [43, 34], [18, 34], [18, 30], [11, 30]]);
    box("#6ba85a", 24, 12, 11, 4);
    box("#70b261", 19, 18, 13, 4);
    box("#508f47", 36, 17, 8, 6);
    box("#a9c873", 21, 18, 4, 2);
    box("#a9c873", 31, 12, 3, 3);
    box("#e9be71", 42, 25, 2, 2);
    box("#edab6b", 23, 27, 2, 2);
  };
  const flower = (x, y, color) => {
    box("#226348", x, y + 2, 2, 9);
    box("#6ba65b", x - 3, y + 6, 4, 2);
    box(color, x - 3, y, 8, 3);
    box(color, x, y - 2, 2, 7);
    box("#f8e6a8", x, y + 1, 2, 2);
  };
  const stone = (x, y, width) => {
    box(ink, x, y + 3, width, 10);
    box("#69867d", x + 2, y, width - 4, 10);
    box("#b1b79a", x + 3, y + 1, width - 8, 2);
    box("#45665f", x + 2, y + 8, width - 4, 3);
  };
  switch (id) {
    case "workshop":
      cabin("#854537", "#cb7355");
      box(ink, 42, 4, 7, 11);
      box("#a56a63", 44, 3, 6, 5);
      box(honey, 29, 20, 7, 4);
      break;
    case "forge":
      cabin("#47586d", "#728a9a");
      box(ink, 43, 3, 9, 17);
      box("#738185", 45, 5, 5, 13);
      box("#fa923c", 29, 35, 8, 8);
      box("#ffd270", 31, 39, 4, 4);
      shape("#293d49", [[1, 36], [16, 36], [13, 40], [10, 40], [10, 44], [4, 44], [4, 39]]);
      box("#abc3ca", 2, 36, 13, 1);
      break;
    case "camp":
      shadow();
      shape(ink, [[4, 44], [24, 12], [46, 44]]);
      shape("#b47f55", [[8, 42], [24, 15], [41, 42]]);
      shape("#e6be7d", [[12, 39], [24, 16], [26, 25], [20, 39]]);
      shape("#25473f", [[19, 42], [25, 29], [33, 42]]);
      stone(45, 34, 15);
      box("#e77a46", 49, 33, 6, 9);
      box("#ffe3a0", 51, 35, 3, 7);
      break;
    case "farm":
      shadow();
      shape("#47372e", [[8, 23], [54, 23], [63, 44], [2, 44]]);
      shape("#9c6647", [[11, 25], [52, 25], [59, 41], [6, 41]]);
      box("#bb8657", 9, 31, 46, 3);
      box("#bb8657", 7, 38, 50, 2);
      flower(17, 25, "#f5ae68");
      flower(31, 20, "#b9e083");
      flower(46, 25, "#f5d777");
      box(honey, 3, 20, 2, 15);
      box(honey, 56, 19, 2, 15);
      box(wood, 2, 24, 56, 2);
      break;
    case "grove":
      shadow();
      pine(1, 9);
      pine(32, 4);
      box("#5c5980", 27, 21, 12, 25);
      box("#8990af", 29, 19, 8, 25);
      box("#d4b9ee", 32, 25, 3, 10);
      box("#efdbfc", 30, 29, 7, 2);
      break;
    case "mine":
      shadow();
      shape(ink, [[2, 44], [2, 36], [13, 22], [13, 17], [26, 9], [40, 9], [49, 17], [61, 36], [61, 44]]);
      shape("#596d76", [[5, 41], [14, 25], [16, 17], [27, 11], [39, 11], [47, 18], [58, 41]]);
      shape("#879294", [[17, 19], [28, 12], [39, 12], [43, 17], [34, 20], [19, 24]]);
      box(honey, 19, 26, 28, 5);
      box(wood, 19, 29, 5, 14);
      box(wood, 42, 29, 5, 14);
      box("#192931", 24, 31, 18, 13);
      box("#cf916d", 11, 34, 4, 3);
      box("#ae9cd8", 50, 32, 3, 4);
      box("#a4a9a0", 23, 44, 20, 2);
      break;
    case "bosses":
      shadow();
      pine(0, 8);
      pine(37, 4);
      box(ink, 18, 23, 29, 17);
      box(wood, 20, 25, 25, 12);
      box(honey, 22, 26, 21, 2);
      box("#f0d69a", 28, 30, 9, 5);
      box(soil, 21, 39, 4, 7);
      box(soil, 41, 39, 4, 7);
      break;
    case "gate":
      shadow();
      stone(3, 31, 19);
      stone(42, 31, 19);
      box(ink, 14, 14, 36, 30);
      box("#819486", 16, 16, 32, 27);
      box("#a9ad8c", 18, 17, 28, 3);
      box("#4c665f", 22, 21, 20, 23);
      box("#243d3c", 25, 24, 14, 20);
      box("#c0a86b", 29, 13, 7, 6);
      box("#f2d78c", 29, 26, 1, 12);
      box("#f2d78c", 35, 31, 1, 10);
      box("#d59c50", 10, 28, 4, 9);
      box("#f5d27a", 11, 27, 2, 5);
      box("#d59c50", 50, 28, 4, 9);
      box("#f5d27a", 51, 27, 2, 5);
      break;
    case "tree":
      shadow(13, 39);
      pine(15, 5);
      pine(28, 11);
      break;
    case "oak":
      oak();
      break;
    case "flowers":
      flower(17, 27, "#f9d781");
      flower(31, 16, "#f6a78a");
      flower(44, 24, "#ddbef0");
      box("#67aa66", 7, 36, 8, 2);
      box("#9fb963", 48, 37, 10, 2);
      break;
    case "grass":
      for (const [x, y] of [[6, 16], [20, 33], [27, 21], [44, 36], [52, 12]]) {
        shape("#215d43", [[x, y], [x + 4, y + 3], [x + 6, y + 8], [x + 6, y + 1], [x + 9, y - 1], [x + 8, y + 11], [x + 2, y + 11]]);
        box("#70b45b", x + 6, y + 2, 2, 5);
      }
      break;
    case "crop":
      flower(19, 26, "#f3cb73");
      flower(30, 20, "#f3cb73");
      flower(43, 27, "#f3cb73");
      break;
    case "vein":
      stone(11, 24, 43);
      stone(19, 15, 28);
      box("#c7cdaa", 22, 16, 16, 2);
      box("#d59770", 35, 19, 7, 5);
      box("#ffd19a", 38, 19, 3, 4);
      box("#c78a67", 18, 28, 7, 6);
      box("#e8af85", 20, 28, 3, 3);
      box("#bc806b", 39, 29, 9, 5);
      break;
    case "workbench":
      box(ink, 7, 26, 51, 6);
      box(honey, 7, 26, 51, 3);
      box(wood, 10, 32, 8, 13);
      box(wood, 45, 32, 8, 13);
      box(soil, 17, 34, 29, 3);
      box("#899d9a", 18, 20, 12, 5);
      box(soil, 27, 22, 9, 2);
      box("#909a83", 42, 18, 10, 7);
      box("#f7d784", 45, 19, 4, 5);
      break;
    case "anvil":
      box(soil, 20, 34, 25, 11);
      box(honey, 21, 34, 23, 3);
      shape(ink, [[6, 21], [57, 21], [52, 28], [39, 30], [39, 35], [24, 35], [24, 30], [14, 28]]);
      shape("#708a98", [[10, 21], [54, 21], [51, 25], [37, 27], [36, 32], [27, 32], [27, 27], [16, 25]]);
      box("#c5cebf", 10, 21, 43, 2);
      break;
    case "butterfly":
      box("#ffd685", 21, 16, 9, 9);
      box("#ffad79", 34, 16, 9, 9);
      box("#d88360", 25, 23, 14, 6);
      box(ink, 30, 19, 4, 12);
      break;
    case "bird":
      shape("#384253", [[10, 26], [26, 27], [28, 19], [42, 19], [44, 24], [48, 25], [44, 28], [42, 32], [31, 36], [23, 36]]);
      box("#9fc4bd", 31, 20, 10, 7);
      box("#d9ddd0", 29, 28, 12, 4);
      box("#6e9a9e", 21, 27, 12, 3);
      box(ink, 39, 22, 2, 2);
      box(honey, 45, 25, 4, 2);
      break;
    case "stone":
      stone(17, 26, 30);
      box("#c5dc9b", 30, 28, 3, 7);
      box("#c5dc9b", 26, 31, 11, 2);
      break;
    case "stump":
    case "carving":
      box(ink, 16, 21, 33, 21);
      box(wood, 19, 24, 27, 15);
      box(honey, 18, 19, 29, 7);
      box("#704634", 25, 21, 14, 3);
      box(id === "stump" ? ink : "#f0d29c", 29, 28, 8, 10);
      break;
    case "rock":
      stone(18, 26, 28);
      break;
    case "lantern":
      box(ink, 24, 16, 17, 25);
      box(wood, 26, 19, 13, 19);
      box("#ffd679", 29, 22, 7, 13);
      box("#fff0b7", 31, 26, 3, 7);
      box(honey, 28, 15, 9, 3);
      break;
    case "trophy":
      box(ink, 21, 13, 22, 26);
      box("#c68749", 23, 15, 18, 9);
      box("#f7d378", 27, 14, 10, 14);
      box("#c68749", 30, 27, 4, 7);
      box("#f7d378", 25, 34, 14, 3);
      break;
  }
  const url = canvas.toDataURL();
  sprites.set(id, url);
  return url;
}

function fieldSprite(id) {
  return '<img class="living-sprite" alt="" draggable="false" src="' + pixelSprite(id) + '">';
}

export { fieldSprite, pixelSprite };
