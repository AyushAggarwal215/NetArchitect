import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadPresetScenario, executePipeline } from "../../src/cli/commands.js";
import { IPv4NetworkOracle } from "../helpers/ip-oracle.js";

describe("End-to-End Presets Integration Verification", () => {
  const presets = [
    { name: "campus", expectedDevices: ["CORE-ADMIN", "DIST-SCIENCE", "DIST-RESI"], minSubnets: 11 },
    { name: "metro", expectedDevices: ["RTR-FINTECH-HQ", "RTR-BRANCH-EAST", "RTR-BRANCH-WEST"], minSubnets: 7 },
    { name: "wan", expectedDevices: ["RTR-DELHI", "RTR-MUMBAI", "RTR-BENGALURU", "RTR-CHENNAI"], minSubnets: 15 }
  ];

  for (const preset of presets) {
    test(`Pipeline successfully executes preset '${preset.name}' with zero overlaps`, () => {
      const tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), `netarch-preset-${preset.name}-`));
      const scenario = loadPresetScenario(preset.name);

      const exitCode = executePipeline(scenario, tmpOut);
      assert.equal(exitCode, 0);

      const profileDir = path.join(tmpOut, preset.name);
      assert.ok(fs.existsSync(profileDir), `Profile dir ${profileDir} must exist`);

      // 1. Deliverables existence
      assert.ok(fs.existsSync(path.join(profileDir, "full_config.txt")));
      assert.ok(fs.existsSync(path.join(profileDir, `${preset.name}_full_config.txt`)));
      assert.ok(fs.existsSync(path.join(profileDir, "rationale.md")));
      assert.ok(fs.existsSync(path.join(profileDir, "allocation.csv")));
      assert.ok(fs.existsSync(path.join(profileDir, "summary.json")));
      assert.ok(fs.existsSync(path.join(profileDir, "verification.json")));

      // 2. Expected devices generated
      const configsDir = path.join(profileDir, "configs");
      assert.ok(fs.existsSync(configsDir));
      const configFiles = fs.readdirSync(configsDir);
      for (const devName of preset.expectedDevices) {
        assert.ok(
          configFiles.includes(`${devName}.txt`),
          `Expected device config '${devName}.txt' missing in ${preset.name}`
        );
      }

      // 3. Verification.json passes security checks
      const verificationJson = JSON.parse(fs.readFileSync(path.join(profileDir, "verification.json"), "utf-8"));
      assert.equal(verificationJson.status, "PASS", `Verification status failed for ${preset.name}`);
      assert.equal(verificationJson.errors.length, 0);

      // 4. CSV Subnet Overlap and Containment Audit
      const csvLines = fs.readFileSync(path.join(profileDir, "allocation.csv"), "utf-8")
        .trim()
        .split("\n")
        .slice(1); // skip header

      assert.ok(
        csvLines.length >= preset.minSubnets,
        `Expected at least ${preset.minSubnets} subnets, got ${csvLines.length}`
      );

      const rootOracle = new IPv4NetworkOracle(scenario.rootPrefix);
      const subnets = [];

      for (const line of csvLines) {
        const parts = line.split(",");
        const network = parts[2];
        const prefixLen = parts[3];
        const oracle = new IPv4NetworkOracle(`${network}/${prefixLen}`);
        subnets.push(oracle);

        // Assert inside root
        assert.ok(
          rootOracle.contains(oracle),
          `Subnet ${network}/${prefixLen} outside root ${scenario.rootPrefix} in ${preset.name}`
        );

        // Assert power-of-two alignment
        assert.ok(
          oracle.isAligned(),
          `Subnet ${network}/${prefixLen} is unaligned in ${preset.name}`
        );
      }

      // Assert pairwise non-overlap
      for (let i = 0; i < subnets.length; i++) {
        for (let j = i + 1; j < subnets.length; j++) {
          assert.equal(
            subnets[i].overlaps(subnets[j]),
            false,
            `Overlap detected in ${preset.name} between ${subnets[i].networkAddressString} and ${subnets[j].networkAddressString}`
          );
        }
      }

      // Clean up
      fs.rmSync(tmpOut, { recursive: true, force: true });
    });
  }
});

