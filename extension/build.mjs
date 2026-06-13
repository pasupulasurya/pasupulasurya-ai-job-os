// Bundle extension TS -> dist/. Mirrors the lab's esbuild approach.
import { build } from "esbuild";

for (const entry of ["content", "background"]) {
  await build({
    entryPoints: [`extension/src/${entry}.ts`],
    bundle: true,
    outfile: `extension/dist/${entry}.js`,
    format: "iife",
    target: "chrome120",
    logLevel: "info",
  });
}
