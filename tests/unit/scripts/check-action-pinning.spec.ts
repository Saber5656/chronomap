import { describe, expect, it } from "vitest";
import {
  collectWorkflowFiles,
  findUnpinnedActions,
} from "../../../scripts/check-action-pinning.mjs";
import blockScalarFixture from "../fixtures/action-pinning/block-scalar.yml?raw";
import branchFixture from "../fixtures/action-pinning/branch-ref.yml?raw";
import dockerActionFixture from "../fixtures/action-pinning/docker-action.yml?raw";
import dynamicOwnerFixture from "../fixtures/action-pinning/dynamic-owner.yml?raw";
import flowFixture from "../fixtures/action-pinning/flow-ref.yml?raw";
import localActionFixture from "../fixtures/action-pinning/local-action.yml?raw";
import malformedFixture from "../fixtures/action-pinning/malformed-workflow.txt?raw";
import nonStringFixture from "../fixtures/action-pinning/non-string.yml?raw";
import nullValueFixture from "../fixtures/action-pinning/null-value.yml?raw";
import quotedKeyFixture from "../fixtures/action-pinning/quoted-key.yml?raw";
import reusableWorkflowFixture from "../fixtures/action-pinning/reusable-workflow.yml?raw";
import shortShaFixture from "../fixtures/action-pinning/short-sha.yml?raw";
import spacedKeyFixture from "../fixtures/action-pinning/spaced-key.txt?raw";
import tagFixture from "../fixtures/action-pinning/tag-ref.yml?raw";
import validFixture from "../fixtures/action-pinning/valid.yml?raw";
import validFlowFixture from "../fixtures/action-pinning/valid-flow.yaml?raw";
import validReusableWorkflowFixture from "../fixtures/action-pinning/valid-reusable-workflow.yml?raw";

const invalidFixtures = [
  ["tag", tagFixture, "actions/checkout@v4"],
  ["branch", branchFixture, "actions/checkout@main"],
  ["short SHA", shortShaFixture, "actions/checkout@9c091bb"],
  ["flow mapping", flowFixture, "actions/checkout@v4"],
  ["spaced key", spacedKeyFixture, "actions/checkout@main"],
  ["quoted key", quotedKeyFixture, "actions/checkout@v4"],
  ["local action", localActionFixture, "./local-action"],
  ["Docker action", dockerActionFixture, "docker://alpine:3.19"],
  [
    "dynamic owner",
    dynamicOwnerFixture,
    "${{github.actor}}/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0",
  ],
  ["missing value", nullValueFixture, "<missing>"],
  ["non-string value", nonStringFixture, "<non-string>"],
  [
    "mutable reusable workflow",
    reusableWorkflowFixture,
    "owner/repo/.github/workflows/ci.yml@main",
  ],
] as const;

describe("check-action-pinning", () => {
  it("accepts full 40-character commit SHAs in block and flow mappings", () => {
    expect(findUnpinnedActions("valid.yml", validFixture)).toEqual([]);
    expect(findUnpinnedActions("valid-flow.yaml", validFlowFixture)).toEqual([]);
    expect(
      findUnpinnedActions("valid-reusable-workflow.yml", validReusableWorkflowFixture),
    ).toEqual([]);
  });

  it.each(invalidFixtures)("rejects a %s reference", (_name, source, reference) => {
    const findings = findUnpinnedActions("invalid.yml", source);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ reference });
  });

  it("fails closed when workflow YAML is malformed", () => {
    expect(() => findUnpinnedActions("malformed-workflow.yml", malformedFixture)).toThrow(
      /invalid workflow YAML/,
    );
  });

  it("does not inspect uses-like text inside a block scalar", () => {
    expect(findUnpinnedActions("block-scalar.yml", blockScalarFixture)).toEqual([]);
  });

  it("discovers yml and yaml workflow files deterministically", async () => {
    const files = await collectWorkflowFiles("tests/unit/fixtures/action-pinning");

    expect(files).toContain("tests/unit/fixtures/action-pinning/tag-ref.yml");
    expect(files).toContain("tests/unit/fixtures/action-pinning/valid-flow.yaml");
    expect(files).toEqual([...files].sort());
  });
});
