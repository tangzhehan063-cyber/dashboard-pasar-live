// Bundles the React app into ONE self-contained dist/index.html.
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
const r = await build({ entryPoints: ["src/main.jsx"], bundle: true, minify: true, format: "iife", write: false,
  define: { "process.env.NODE_ENV": '"production"' }, jsx: "automatic", target: "es2020" });
const js = r.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const css = readFileSync("src/styles.css", "utf8");
mkdirSync("dist", { recursive: true });
const html = readFileSync("template.html", "utf8").replace("/*CSS*/", () => css).replace("/*JS*/", () => js);
writeFileSync("dist/index.html", html);
console.log("dist/index.html", (html.length / 1024).toFixed(0) + " KB");
