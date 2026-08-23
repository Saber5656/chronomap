import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MARKDOWN_LINK_PATTERN = /!?\[[^\]]*\]\((<[^>]+>|[^)\s]+)(?:\s+["'][^)]*["'])?\)/gu;

export function extractMarkdownLinks(markdown) {
  return [...markdown.matchAll(MARKDOWN_LINK_PATTERN)].map((match) => {
    const rawTarget = match[1] ?? "";
    return rawTarget.startsWith("<") && rawTarget.endsWith(">")
      ? rawTarget.slice(1, -1)
      : rawTarget;
  });
}

function isExternalLink(target) {
  return /^(?:https?:|mailto:|tel:)/iu.test(target);
}

export function validateMarkdownLinks(markdown, { baseDir }) {
  const broken = [];
  const links = extractMarkdownLinks(markdown);
  for (const target of links) {
    if (target.startsWith("#") || isExternalLink(target)) continue;
    const pathTarget = decodeURIComponent(target.split("#", 1)[0]);
    const absoluteTarget = resolve(baseDir, pathTarget);
    if (!existsSync(absoluteTarget)) broken.push({ target, absoluteTarget });
  }
  return { checked: links.length, broken };
}

function main() {
  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const readmePath = resolve(scriptDirectory, "../README.md");
  const result = validateMarkdownLinks(readFileSync(readmePath, "utf8"), {
    baseDir: dirname(readmePath),
  });
  if (result.broken.length > 0) {
    for (const broken of result.broken) {
      console.error(`Broken README link: ${broken.target} -> ${broken.absoluteTarget}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log(
    `Validated ${result.checked} README links (${result.broken.length} broken local links).`,
  );
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
