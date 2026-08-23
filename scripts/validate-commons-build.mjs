import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const distRoot = resolve(process.argv[2] ?? "dist");
const needle = "commons.wikimedia.org";

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

if (!statSync(distRoot, { throwIfNoEntry: false })) {
  throw new Error(`Missing build directory: ${distRoot}`);
}

const offenders = filesUnder(distRoot).filter((path) => readFileSync(path).includes(needle));
if (offenders.length > 0) {
  throw new Error(
    `Flag-off build contains ${needle}:\n${offenders.map((path) => `- ${path}`).join("\n")}`,
  );
}

console.log(`Commons flag-off bundle check passed: ${distRoot}`);
