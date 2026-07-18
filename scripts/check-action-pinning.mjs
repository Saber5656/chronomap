import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { isScalar, LineCounter, parseDocument, visit } from "yaml";

const WORKFLOW_EXTENSION = /\.ya?ml$/i;
const OWNER = "[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?";
const ACTION_PATH_SEGMENT = "[A-Za-z0-9_.-]+";
const PINNED_ACTION = new RegExp(
  `^${OWNER}\\/${ACTION_PATH_SEGMENT}(?:\\/${ACTION_PATH_SEGMENT})*@[0-9a-f]{40}$`,
);

export async function collectWorkflowFiles(target) {
  const targetStat = await lstat(target);

  if (targetStat.isSymbolicLink()) {
    throw new Error(`Refusing to inspect symbolic link: ${target}`);
  }

  if (targetStat.isFile()) {
    return WORKFLOW_EXTENSION.test(target) ? [target] : [];
  }

  if (!targetStat.isDirectory()) {
    return [];
  }

  const entries = await readdir(target, { withFileTypes: true });
  const nestedFiles = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = path.join(target, entry.name);

    if (entry.isSymbolicLink()) {
      throw new Error(`Refusing to inspect symbolic link: ${entryPath}`);
    }

    if (entry.isFile()) {
      if (WORKFLOW_EXTENSION.test(entry.name)) {
        nestedFiles.push(entryPath);
      }
      continue;
    }

    if (entry.isDirectory()) {
      nestedFiles.push(...(await collectWorkflowFiles(entryPath)));
    }
  }

  return nestedFiles;
}

export function findUnpinnedActions(file, source) {
  const lineCounter = new LineCounter();
  const document = parseDocument(source, {
    lineCounter,
    prettyErrors: true,
    strict: true,
    stringKeys: true,
    uniqueKeys: true,
  });

  if (document.errors.length > 0) {
    const parseErrors = document.errors.map((error) => error.message).join("; ");
    throw new Error(`${file}: invalid workflow YAML: ${parseErrors}`);
  }

  const findings = [];

  visit(document, {
    Pair(_key, pair) {
      if (!isScalar(pair.key) || pair.key.value !== "uses") {
        return;
      }

      const reference =
        pair.value === null || (isScalar(pair.value) && pair.value.value === null)
          ? "<missing>"
          : isScalar(pair.value) && typeof pair.value.value === "string"
            ? pair.value.value
            : "<non-string>";
      const line = lineCounter.linePos(pair.key.range?.[0] ?? 0).line || 1;

      if (!PINNED_ACTION.test(reference)) {
        findings.push({ file, line, reference });
      }
    },
  });

  return findings;
}

async function main(targets) {
  const requestedTargets = targets.length > 0 ? targets : [".github/workflows"];

  try {
    const workflowFiles = [
      ...new Set(
        (await Promise.all(requestedTargets.map((target) => collectWorkflowFiles(target)))).flat(),
      ),
    ].sort();

    if (workflowFiles.length === 0) {
      throw new Error("No workflow YAML files found in the requested targets.");
    }

    const findings = (
      await Promise.all(
        workflowFiles.map(async (file) => findUnpinnedActions(file, await readFile(file, "utf8"))),
      )
    ).flat();

    if (findings.length > 0) {
      for (const finding of findings) {
        console.error(
          `${finding.file}:${finding.line}: uses '${finding.reference}' must be pinned to a full 40-character commit SHA.`,
        );
      }
      process.exitCode = 1;
    } else {
      console.log(
        `Checked ${workflowFiles.length} workflow file(s): every action is pinned to a full commit SHA.`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Action pinning check failed: ${message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}
