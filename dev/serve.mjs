// Dev preview: rebuilds on every save and auto-reloads the browser. Uses mock data (dev/mock.js).
import { context } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, watch } from "fs";
const out = "dev/www"; mkdirSync(out, { recursive: true });
const page = () => readFileSync("template.html", "utf8")
  .replace("<head>", () => `<head><script>${readFileSync("dev/mock.js", "utf8")}</script>`)
  .replace("/*CSS*/", () => readFileSync("src/styles.css", "utf8"))
  .replace("<script>/*JS*/</script>", `<script src="app.js"></script><script>new EventSource("/esbuild").addEventListener("change",()=>location.reload())</script>`);
writeFileSync(out + "/index.html", page());
for (const f of ["src/styles.css", "template.html", "dev/mock.js"]) watch(f, () => { writeFileSync(out + "/index.html", page()); ctx.rebuild(); });
const ctx = await context({ entryPoints: { app: "src/main.jsx" }, bundle: true, outdir: out, jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' }, logLevel: "info" });
await ctx.watch();
const { port } = await ctx.serve({ servedir: out, host: "0.0.0.0", port: Number(process.env.PORT) || 5173 });
console.log("Preview: http://localhost:" + port);
