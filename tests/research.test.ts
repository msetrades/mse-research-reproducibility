import { test } from "node:test";
import assert from "node:assert/strict";
import { buildArchive, completeness, stableStringify, sensitivityEffect, validateArchive, type ResearchRun } from "../src/lib/research.ts";

const baseRun: Omit<ResearchRun, "id" | "createdAt" | "fingerprint"> = {
  study: "Demand forecast v2", field: "Energy", question: "Does weather improve demand estimates?", protocol: "Rolling-origin evaluation",
  dataSource: "meter.csv", dataVersion: "sha256:sample", codeUrl: "https://github.com/example/model", commit: "a1b2c3d",
  environment: "Python 3.12; pandas 2.2", seed: "42", metric: "MAE", value: 4.2, unit: "kWh", limitations: "One site only", artifactUrl: "",
};

test("stable serialization ignores object key insertion order", () => {
  assert.equal(stableStringify({ b: 2, a: 1 }), stableStringify({ a: 1, b: 2 }));
});

test("completeness score identifies missing reproducibility fields", () => {
  const report = completeness({ ...baseRun, commit: "", seed: "" });
  assert.equal(report.score, 80);
  assert.deepEqual(report.missing, ["Code commit", "Random seed"]);
});

test("sensitivity calculation reports absolute and baseline-relative output span", () => {
  const result = sensitivityEffect({ baselineInput: 10, lowInput: 8, highInput: 12, baselineOutput: 50, lowOutput: 42, highOutput: 58 });
  assert.equal(result.inputSpan, 4);
  assert.equal(result.absoluteOutputSpan, 16);
  assert.equal(result.relativeOutputSpanPct, 32);
});

test("versioned archive validates and rejects unsupported shapes", () => {
  const run = { ...baseRun, id: "r1", createdAt: "2026-01-01T00:00:00.000Z", fingerprint: "abc" };
  assert.deepEqual(validateArchive(buildArchive([run], [])).runs, [run]);
  assert.throws(() => validateArchive({ version: 9, runs: [], sensitivity: [] }), /version 1/);
});
