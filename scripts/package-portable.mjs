import { execFileSync } from "node:child_process";
import fs from "node:fs";
const { version } = JSON.parse(fs.readFileSync("package.json", "utf8"));
const prefix = `pppoe-radius-${version}/`;
for (const [format, extension] of [["zip", "zip"], ["tar.gz", "tar.gz"]]) {
  const filename = `pppoe-radius-${version}.${extension}`;
  execFileSync("git", ["archive", `--format=${format}`, `--prefix=${prefix}`, "-o", filename, "HEAD"], { stdio: "inherit" });
  console.log(`Created ${filename}`);
}
console.log("Archives contain committed source only; local .env, dependencies, build output and untracked secrets are excluded.");
