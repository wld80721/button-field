import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [template, css, bundle] = await Promise.all([
  read("src/index.html"),
  read("src/styles.css"),
  build({
    absWorkingDir: fileURLToPath(root),
    entryPoints: ["src/js/main.js"],
    bundle: true,
    format: "iife",
    legalComments: "none",
    target: "es2022",
    write: false,
  }),
]);
if (/<\/style/i.test(css))
  throw new Error("Unexpected closing tag in stylesheet");
const js = bundle.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const styleTag = '<link rel="stylesheet" href="styles.css" />';
const scriptTag = '<script type="module" src="js/main.js"></script>';
if (!template.includes(styleTag) || !template.includes(scriptTag))
  throw new Error("Missing standalone asset markers");
const html = template
  .replace(styleTag, () => `<style>\n${css}</style>`)
  .replace(scriptTag, () => `<script>\n${js}</script>`);
if (process.argv.includes("--check")) {
  if (html !== (await read("index.html"))) {
    throw new Error("Root index.html is out of date. Run npm run build.");
  }
} else {
  await writeFile(new URL("index.html", root), html);
}
