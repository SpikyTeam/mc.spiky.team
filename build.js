// Rebuilds the mc.spiky.team GitHub Pages tree from two sources:
//   meta-v1.zip        the launcher metadata published as a release asset
//                      of this repository (see the publish job in the
//                      spiky-meta-staging repo)
//   SpikyMC-Sites      site/, wiki/, i18n/, maven/, fmllibs/, successful-login/
// The landing page is the static site/index.html from that repository.
import { execFileSync } from "node:child_process";
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Extract } from "unzip-stream";

const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error("GITHUB_TOKEN is required");
const env = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is required`);
  return v;
};
const api = env("GITHUB_API_URL");
const repo = env("GITHUB_REPOSITORY");
const sourcesRepo = env("SOURCES_REPO");
const sourcesRef = process.env.SOURCES_REF || "main";
const here = process.cwd();

async function download(url, dest) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/octet-stream" } });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  await pipeline(Readable.fromWeb(r.body), createWriteStream(dest));
}

async function latestMetaZip() {
  const r = await fetch(`${api}/repos/${repo}/releases/latest`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  if (!r.ok) throw new Error(`latest release of ${repo} -> ${r.status}`);
  const rel = await r.json();
  const asset = rel.assets.find((a) => a.name === "meta-v1.zip");
  if (!asset) throw new Error(`no meta-v1.zip in ${repo}@${rel.tag_name}`);
  return asset.browser_download_url;
}

const auth = `https://x-access-token:${token}@github.com`;
writeFileSync(".gitcredentials", `${auth}\n`);
writeFileSync(".gitconfig", `[credential]\n\thelper = store --file=${here}/.gitcredentials\n`);
execFileSync("git", ["clone", "--depth", "1", "--branch", sourcesRef, `${auth}/${sourcesRepo}`, "sources"], {
  stdio: "inherit",
  env: { ...process.env, HOME: here, GIT_CONFIG_GLOBAL: `${here}/.gitconfig` },
});
for (const f of [".gitcredentials", ".gitconfig"]) rmSync(f, { force: true });

const out = "build";
rmSync(out, { recursive: true, force: true });
mkdirSync(`${out}/meta/v1`, { recursive: true });

await download(await latestMetaZip(), "meta-v1.zip");
await pipeline(createReadStream("meta-v1.zip"), Extract({ path: `${out}/meta` }));
rmSync("meta-v1.zip", { force: true });

// the launcher asks for both index.json and v1/<uid>/…: same bytes in two places
if (!existsSync(`${out}/meta/index.json`)) throw new Error("meta-v1.zip has no index.json at its root");
const pkgs = JSON.parse(readFileSync(`${out}/meta/index.json`, "utf8")).packages || [];
if (!pkgs.length) throw new Error("meta index.json lists no packages");
writeFileSync(`${out}/meta/v1/index.json`, readFileSync(`${out}/meta/index.json`));

execFileSync("cp", ["-a", ...["wiki", "i18n", "maven", "fmllibs", "successful-login"].map((d) => `sources/${d}`), out], {
  stdio: "inherit",
});
writeFileSync(`${out}/index.html`, readFileSync("sources/site/index.html"));
writeFileSync(`${out}/.nojekyll`, "");
writeFileSync(`${out}/CNAME`, "mc.spiky.team\n");

const size = (p) => (existsSync(p) ? readFileSync(p).length : 0);
console.log(
  `built: index=${size(`${out}/index.html`)}B meta/index.json=${size(`${out}/meta/index.json`)}B ` +
    `packages=${pkgs.length} from ${sourcesRepo}@${sourcesRef}`,
);
