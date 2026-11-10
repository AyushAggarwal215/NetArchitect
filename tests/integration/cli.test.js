import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const execFileAsync = promisify(execFile);
const CLI_PATH = path.resolve("src/cli/index.js");

describe("Command-Line Interface Integration Tests", () => {
  test("CLI prints help and exits 1 when run without arguments", async () => {
    try {
      await execFileAsync("node", [CLI_PATH]);
      assert.fail("Should have failed with exit code 1");
    } catch (err) {
      assert.equal(err.code, 1);
      assert.ok(err.stdout.includes("Usage:"));
      assert.ok(err.stdout.includes("netarchitect run"));
    }
  });

  test("CLI presets command lists built-in scenarios and exits 0", async () => {
    const { stdout } = await execFileAsync("node", [CLI_PATH, "presets"]);
    assert.ok(stdout.includes("campus"));
    assert.ok(stdout.includes("metro"));
    assert.ok(stdout.includes("wan"));
  });

  test("CLI run --preset campus executes end-to-end and exits 0", async () => {
    const tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), "netarch-cli-campus-"));
    const { stdout } = await execFileAsync("node", [CLI_PATH, "run", "--preset", "campus", "--out", tmpOut]);
    assert.ok(stdout.includes("CAMPUS Network Architecture"));
    assert.ok(stdout.includes("Subnet Allocation Summary:"));
    assert.ok(stdout.includes("CORE-ADMIN"));
    assert.ok(fs.existsSync(path.join(tmpOut, "campus", "full_config.txt")));
    fs.rmSync(tmpOut, { recursive: true, force: true });
  });

  test("CLI validate --custom validates scenario and exits 0", async () => {
    const scenarioPath = path.resolve("presets/campus.json");
    const { stdout } = await execFileAsync("node", [CLI_PATH, "validate", "--custom", scenarioPath]);
    assert.ok(stdout.includes("[PASS] Scenario validation successful!"));
    assert.ok(stdout.includes("Profile:     campus"));
  });

  test("CLI exits with code 2 on domain error: physical distance violation", async () => {
    const badScenario = {
      profile: "campus",
      root_prefix: "10.10.0.0/16",
      sites: [
        { name: "SiteA", devices: [{ name: "SW1" }] },
        { name: "SiteB", devices: [{ name: "SW2" }] }
      ],
      links: [
        { a: "SiteA", b: "SiteB", distance_m: 150, media_request: "copper" }
      ],
      vlans: [
        { id: 10, name: "Data", hosts: 50, site: "SiteA" }
      ]
    };

    const tmpFile = path.join(os.tmpdir(), `bad-distance-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify(badScenario));

    try {
      await execFileAsync("node", [CLI_PATH, "run", "--custom", tmpFile]);
      assert.fail("Should have exited with code 2");
    } catch (err) {
      assert.equal(err.code, 2);
      assert.ok(err.stderr.includes("Physical distance violation"));
      assert.ok(err.stderr.includes("IEEE 802.3an"));
      // Assert no stack trace dump
      assert.ok(!err.stderr.includes("at selectMedia"));
    } finally {
      fs.rmSync(tmpFile, { force: true });
    }
  });

  test("CLI exits with code 2 on domain error: address space exhausted", async () => {
    const exhaustScenario = {
      profile: "campus",
      root_prefix: "192.168.1.0/24",
      sites: [
        { name: "SiteA", devices: [{ name: "SW1" }] }
      ],
      links: [],
      vlans: [
        { id: 10, name: "BigVlan1", hosts: 200, site: "SiteA" },
        { id: 20, name: "BigVlan2", hosts: 200, site: "SiteA" }
      ]
    };

    const tmpFile = path.join(os.tmpdir(), `exhaust-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify(exhaustScenario));

    try {
      await execFileAsync("node", [CLI_PATH, "run", "--custom", tmpFile]);
      assert.fail("Should have exited with code 2");
    } catch (err) {
      assert.equal(err.code, 2);
      assert.ok(err.stderr.includes("Address space exhausted"));
      assert.ok(!err.stderr.includes("at allocateVlsm"));
    } finally {
      fs.rmSync(tmpFile, { force: true });
    }
  });

  test("CLI exits with code 2 on unknown preset name", async () => {
    try {
      await execFileAsync("node", [CLI_PATH, "run", "--preset", "unknown_preset"]);
      assert.fail("Should have exited with code 2");
    } catch (err) {
      assert.equal(err.code, 2);
      assert.ok(err.stderr.includes("Unknown preset 'unknown_preset'"));
    }
  });
});

