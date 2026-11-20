import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";
import path from "node:path";

describe("complexity rule (ESLint CI check)", () => {
  const backendDir = path.resolve(__dirname, "../../..");
  const eslint = new ESLint({
    cwd: backendDir,
    overrideConfigFile: path.join(backendDir, "eslint.config.js"),
    ignore: false,
  });

  it("fails with location and threshold when a function exceeds max complexity of 25", async () => {
    const fixturePath = path.join(
      backendDir,
      "test/fixtures/complexity/high-complexity.ts",
    );
    const [result] = await eslint.lintFiles([fixturePath]);

    expect(result.errorCount).toBeGreaterThanOrEqual(1);
    const complexityMsg = result.messages.find(
      (m) => m.ruleId === "complexity",
    );
    expect(complexityMsg).toBeDefined();
    expect(complexityMsg?.severity).toBe(2);
    expect(complexityMsg?.line).toBe(1);
    expect(complexityMsg?.message).toContain(
      "has a complexity of 27. Maximum allowed is 25",
    );
  }, 60_000);

  it("passes on clean code with complexity below 25", async () => {
    const code = `
export function simpleAdd(a: number, b: number): number {
  return a + b;
}
`;
    const [result] = await eslint.lintText(code, {
      filePath: path.join(backendDir, "src/simple-test.ts"),
    });
    const complexityMsg = result.messages.find(
      (m) => m.ruleId === "complexity",
    );
    expect(complexityMsg).toBeUndefined();
  }, 60_000);
});
