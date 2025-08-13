import { readFileSync } from "fs";
import { build, context } from "esbuild";
import PKG from "./package.json" with { type: "json" };
import process from "node:process";

const bannerText = readFileSync("./meta.js", "utf8").replace(
  "__VERSION__",
  PKG.version,
);
const outfile = "./main.user.js";
const entryPoints = ["./main.ts"];
async function runDev() {
  console.log("🚀 Starting dev build (watch mode)...");
  const ctx = await context({
    entryPoints,
    outfile,
    banner: { js: bannerText },
    bundle: true,
    sourcemap: true,
    minify: false,
  });
  await ctx.watch();
  console.log("watching...");
}

async function runBuild() {
  console.log("📦 Building for production...");
  await build({
    entryPoints,
    outfile,
    banner: { js: bannerText },
    bundle: true,
    minify: false,
    sourcemap: false,
  });
  console.log("✅ Production build completed!");
}

async function main() {
  const [, , cmd] = process.argv;
  if (cmd === "dev") {
    await runDev();
  } else if (cmd === "build") {
    await runBuild();
  } else {
    console.log("Usage: cli <dev|build>");
    process.exit(1);
  }
}

main();
