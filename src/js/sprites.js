import { blueprints } from "./blacksmith-data.js";
import { rarity } from "./data.js";
import { firstWorld, recordWorld, worlds } from "./world-data.js";

function svg(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges" aria-hidden="true">${body}</svg>`;
}
function coin() {
  return svg(
    '<path fill="#633822" d="M10 2h12v4h5v5h3v12h-5v5H7v-5H2V9h4V5h4z"/><path fill="#ffaf2f" d="M10 4h12v4h4v15h-5v4H10v-4H5V9h5z"/><path fill="#ffe782" d="M10 6h12v3H10zM7 10h3v10H7z"/><path fill="#bd6324" d="M14 10h6v3h-3v7h-3z"/>',
  );
}
const worldMarks = {
  desert: "M26 23h2v2h2v2h-2v2h-2v-2h-2v-2h2z",
  frozen: "M26 22h2v3h3v2h-3v3h-2v-3h-3v-2h3z",
  volcano: "M27 21h2v5h2v3h-8v-3h2v-2h2z",
  celestial: "M27 21h1v4h4v1h-4v4h-1v-4h-4v-1h4z",
};

const signaturePaths = {
  bolt: ["#99edff", "M15 2h11v5h-5v6h6v4h-7v5h-5v7h-7v-6h4v-7H7v-4h5V7h3z"],
  seed: ["#b7ed76", "M15 5h8v3h4v8h-4v5h-5v6h-7v-4H7v-5H5v-6h6v3h4zm3 10h4v-4h-4z"],
  ghost: ["#e1beff", "M10 4h12v4h5v14h-3v5h-5v-4h-5v4H8v-4H5V9h5zm1 7v5h4v-5zm8 0v5h4v-5z"],
  flame: ["#ffb16c", "M16 2h5v8h4v6h4v8h-5v5H9v-5H4v-8h5v-6h4v7h3zm1 16v5h-3v3h7v-6h-2v-2z"],
};

function signatureMark(mark) {
  const [color, path] = signaturePaths[mark];
  return svg(`<path fill="${color}" d="${path}" fill-rule="evenodd"/>`);
}

function gearIcon(item) {
  const set = Object.hasOwn(blueprints, item.set) && blueprints[item.set];
  return itemIcon(item.slot, item.r, recordWorld(item), set);
}

function itemIcon(k, r, worldId = firstWorld, set) {
  const c = rarity[r].color,
    theme = worlds[worldId].terrain,
    d = set?.color || theme?.tiles[2] || rarity[r].wood;
  let p = "";
  if (k === 0)
    p = `<path fill="#172c32" d="M4 13h5V5h4v6h2V3h5v8h2V7h5v7h3v11l-6 5H10l-6-7z"/><path fill="${d}" d="M6 15h5V7h2v8h4V5h2v10h5V9h2v7h2v8l-5 4H11l-5-6z"/><path fill="${c}" d="M10 19h15v5H10zm2 6h10v3H12z"/>`;
  if (k === 1)
    p = `<path fill="#172c32" d="M10 5h12v4h5v4h3v10h-4v5H6v-5H2V13h4V9h4z"/><path fill="${theme ? d : "#cf8b38"}" d="M10 11h12v3h4v9h-5v4H11v-4H6v-9h4z"/><path fill="#ffe0a0" d="M10 14h4v3h-4v5H8v-8z"/><path fill="#172c32" d="M12 16h8v7h-8z"/><path fill="${c}" d="M11 3h10l5 6-10 8L6 9z"/><path fill="#fff" opacity=".7" d="M11 5h8v3h-8z"/>`;
  if (k === 2)
    p = `<path fill="#152d31" d="M6 3h15v17h8v10H3v-9h3z"/><path fill="${d}" d="M8 5h11v17h8v6H5v-6h3z"/><path fill="${c}" d="M8 6h11v5H8zm-3 17h22v4H5z"/><path fill="#fff4cb" d="M11 12h6v2h-6zm0 5h6v2h-6z"/>`;
  if (k === 3)
    p = `<path fill="#172d31" d="M13 1h6v6h6v4h5v10h-5v5h-6v5h-6v-5H7v-5H2V11h5V7h6z"/><path fill="${d}" d="M14 3h4v7h6v3h4v6h-5v5h-5v5h-4v-5H9v-5H4v-6h5v-3h5z"/><path fill="${c}" d="M13 9h6v4h4v6h-4v4h-6v-4H9v-6h4z"/><path fill="#fff" opacity=".75" d="M13 11h5v3h-5z"/>`;
  if (theme)
    p += `<path fill="#172c32" d="M23 20h9v12H21v-9h2z"/><path fill="${worlds[worldId].accent}" d="${worldMarks[worldId]}"/>`;
  if (r >= 5) {
    const halo = r === 6 ? "M16 0h2v5h-2zM0 14h5v2H0zM28 13h4v2h-4zM19 28h2v4h-2zM23 3h5v2h-5z" : "M1 12h3v8H1zM28 8h3v10h-3z";
    p = `<path fill="${c}" d="${halo}"/>` + p;
  }
  if (set) p += `<g transform="translate(13 12) scale(.38)"><rect width="32" height="32" fill="#261e2a"/><path fill="${set.color}" d="${signaturePaths[set.emblem][1]}" fill-rule="evenodd"/></g>`;
  return svg(p);
}
function chestIcon(r) {
  const a = rarity[r];
  return `<svg viewBox="0 0 64 54" shape-rendering="crispEdges" aria-hidden="true"><ellipse cx="32" cy="47" rx="27" ry="5" fill="#102d2e" opacity=".5"/><path fill="#17282b" d="M9 4h46v4h5v35h-5v5H9v-5H4V8h5z"/><path fill="${a.wood}" d="M7 24h50v18l-4 4H11l-4-4z"/><path fill="${a.light}" d="M11 6h42v4h5v14H6V10h5z"/><path fill="#fff3be" opacity=".45" d="M12 8h40v3H12z"/><path fill="#192d31" opacity=".55" d="M6 22h52v4H6zm3 12h46v2H9z"/><path fill="#17282b" d="M11 4h10v43H11zm32 0h10v43H43z"/><path fill="${a.metal}" d="M13 6h6v39h-6zm32 0h6v39h-6z"/><path fill="#fff" opacity=".6" d="M13 8h2v15h-2zm32 0h2v15h-2z"/><path fill="#17282b" d="M25 21h14v13H25z"/><path fill="${a.metal}" d="M27 23h10v9H27z"/><path fill="#182d31" d="M31 25h3v5h-3z"/></svg>`;
}
function openedChestIcon(r) {
  const a = rarity[r];
  return `<svg viewBox="0 0 64 54" shape-rendering="crispEdges" aria-hidden="true"><ellipse cx="32" cy="47" rx="27" ry="5" fill="#102d2e" opacity=".5"/><path fill="#17282b" d="M8 1h48v5h4v17H4V6h4z"/><path fill="${a.light}" d="M10 3h44v5h4v13H6V8h4z"/><path fill="${a.wood}" d="M9 9h46v11H9z"/><path fill="${a.metal}" d="M13 3h6v19h-6zm32 0h6v19h-6z"/><path fill="#17282b" d="M4 23h56v20h-5v5H9v-5H4z"/><path fill="#3a251b" d="M7 23h50v10H7z"/><path fill="${a.wood}" d="M7 33h50v10l-4 3H11l-4-3z"/><path fill="${a.light}" d="M7 30h50v5H7z"/><path fill="${a.metal}" d="M13 30h6v16h-6zm32 0h6v16h-6zM27 29h10v9H27z"/><path fill="#17282b" d="M31 31h3v5h-3z"/></svg>`;
}

export { signatureMark, chestIcon, coin, gearIcon, itemIcon, openedChestIcon, svg };
