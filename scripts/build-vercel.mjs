// Builds DirectLet for Vercel using the Build Output API, so the layout is
// exactly what Vercel runs and nothing is guessed. Vercel's Root Directory is
// deploy/, so the output goes there:
//   deploy/.vercel/output/static                the website (apps/web/dist)
//   deploy/.vercel/output/functions/api.func    the API as one bundled file
//   deploy/.vercel/output/config.json           routes, headers and the daily cron
//
// Run from the repo root:  pnpm run build:vercel
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "deploy", ".vercel", "output");
const fn = join(out, "functions", "api.func");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function run(args) {
  console.log(`> pnpm ${args.join(" ")}`);
  execFileSync(pnpm, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
}

// pdfkit (the PDF receipts) loads its built-in fonts with a runtime require of
// '#standard-fonts/Name', which a bundler cannot see, so receipts would fail
// online. This rewrites those lines into plain relative requires that get bundled.
// If pdfkit changes and nothing matches, the build stops instead of shipping a
// broken receipt download.
const pdfkitFonts = {
  name: "pdfkit-fonts",
  setup(b) {
    b.onLoad({ filter: /pdfkit[\\/]js[\\/]pdfkit\.node\.mjs$/ }, async (args) => {
      const source = await readFile(args.path, "utf8");
      const patched = source.replace(
        /require\$1\(['"]#standard-fonts\/(\w+)['"]\)/g,
        'require("./standard-fonts/$1.cjs")',
      );
      if (patched === source) {
        throw new Error("pdfkit font loaders not found. Update the pdfkit-fonts step in scripts/build-vercel.mjs.");
      }
      return { contents: patched, loader: "js", resolveDir: dirname(args.path) };
    });
  },
};

rmSync(out, { recursive: true, force: true });
mkdirSync(fn, { recursive: true });

// 1. Prisma's generated client is not committed, so it is made here.
run(["--filter", "@directlet/api", "exec", "prisma", "generate"]);

// 2. The website.
run(["--filter", "@directlet/web", "build"]);
cpSync(join(root, "apps", "web", "dist"), join(out, "static"), { recursive: true });

// 3. The API, bundled into a single file so it needs no node_modules online.
//    The banner lets bundled CommonJS packages use require() inside an ES module.
await build({
  entryPoints: [join(root, "apps", "api", "src", "vercel.ts")],
  outfile: join(fn, "index.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: false,
  logLevel: "info",
  // pg-native is an optional extra that pg loads only if present.
  external: ["pg-native"],
  plugins: [pdfkitFonts],
  banner: {
    js: [
      "import { createRequire as __createRequire } from 'node:module';",
      "import { fileURLToPath as __fileURLToPath } from 'node:url';",
      "import { dirname as __dirname_fn } from 'node:path';",
      "const require = __createRequire(import.meta.url);",
      "const __filename = __fileURLToPath(import.meta.url);",
      "const __dirname = __dirname_fn(__filename);",
    ].join("\n"),
  },
});

writeFileSync(
  join(fn, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "nodejs22.x",
      handler: "index.mjs",
      launcherType: "Nodejs",
      // Express wants the plain Node request, not Vercel's convenience wrapper.
      shouldAddHelpers: false,
      maxDuration: 30,
    },
    null,
    2,
  ),
);

// 4. Routes. /api goes to the function, real files are served as they are,
//    and every other address gets the single-page app (its own router decides).
const securityHeaders = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), geolocation=(self)",
};

writeFileSync(
  join(out, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: "/(.*)", headers: securityHeaders, continue: true },
        {
          src: "/assets/(.*)",
          headers: { "cache-control": "public, max-age=31536000, immutable" },
          continue: true,
        },
        { src: "/api/(.*)", dest: "/api" },
        { handle: "filesystem" },
        { src: "/(.*)", dest: "/index.html" },
      ],
      // Issues next rent charges once a day. Needs CRON_SECRET in the project settings.
      crons: [{ path: "/api/jobs/rent-roll", schedule: "0 4 * * *" }],
    },
    null,
    2,
  ),
);

console.log(`\nBuilt ${out}`);
