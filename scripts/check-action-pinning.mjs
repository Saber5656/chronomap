import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { isAlias, isMap, isScalar, isSeq, LineCounter, parseDocument } from "yaml";

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
  const workflowFiles = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = path.join(target, entry.name);

    if (entry.isSymbolicLink()) {
      throw new Error(`Refusing to inspect symbolic link: ${entryPath}`);
    }

    if (entry.isFile()) {
      if (WORKFLOW_EXTENSION.test(entry.name)) {
        workflowFiles.push(entryPath);
      }
    }
  }

  return workflowFiles;
}

function resolveNode(document, node) {
  return isAlias(node) ? node.resolve(document) : node;
}

function resolveMap(document, node) {
  const resolved = resolveNode(document, node);
  return isMap(resolved) ? resolved : undefined;
}

function resolveSequence(document, node) {
  const resolved = resolveNode(document, node);
  return isSeq(resolved) ? resolved : undefined;
}

function findPair(map, key) {
  return map.items.find((pair) => isScalar(pair.key) && pair.key.value === key);
}

function resolveUsesReference(document, value) {
  if (value === null || (isScalar(value) && value.value === null)) {
    return "<missing>";
  }

  const resolved = resolveNode(document, value);

  if (isAlias(value) && resolved === undefined) {
    return "<unresolved-alias>";
  }

  return isScalar(resolved) && typeof resolved.value === "string" ? resolved.value : "<non-string>";
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

  function inspectUsesPair(pair) {
    const reference = resolveUsesReference(document, pair.value);
    const line = lineCounter.linePos(isScalar(pair.key) ? (pair.key.range?.[0] ?? 0) : 0).line || 1;

    if (!PINNED_ACTION.test(reference)) {
      findings.push({ file, line, reference });
    }
  }

  const root = resolveMap(document, document.contents);
  const jobsPair = root ? findPair(root, "jobs") : undefined;
  const jobs = jobsPair ? resolveMap(document, jobsPair.value) : undefined;

  for (const jobPair of jobs?.items ?? []) {
    const job = resolveMap(document, jobPair.value);

    if (!job) {
      continue;
    }

    const reusableWorkflowPair = findPair(job, "uses");

    if (reusableWorkflowPair) {
      inspectUsesPair(reusableWorkflowPair);
    }

    const stepsPair = findPair(job, "steps");
    const steps = stepsPair ? resolveSequence(document, stepsPair.value) : undefined;

    for (const stepNode of steps?.items ?? []) {
      const step = resolveMap(document, stepNode);
      const actionPair = step ? findPair(step, "uses") : undefined;

      if (actionPair) {
        inspectUsesPair(actionPair);
      }
    }
  }

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
