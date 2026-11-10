import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { exportAll } from "../../src/output/exporter.js";
import { Scenario, Site, Device, Decision, SubnetAllocation, MediaSelection } from "../../src/core/models.js";

describe("Exporter & Deliverables Generator", () => {
  test("Exports all expected files into temporary directory", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "netarchitect-test-"));
    const scenario = new Scenario({
      profile: "testnet",
      rootPrefix: "10.0.0.0/24",
      sites: [new Site({ name: "SiteA", devices: [new Device({ name: "RTR-A" })] })]
    });

    const deviceConfigs = {
      "RTR-A": "hostname RTR-A\nend\n"
    };

    const decisions = [
      new Decision({
        ruleId: "TEST-001",
        domain: "media",
        subject: "Link1",
        choice: "Cat6a",
        reason: "Within 100m",
        references: ["IEEE 802.3an"]
      })
    ];

    const allocations = [
      new SubnetAllocation({
        name: "SubnetA",
        site: "SiteA",
        hostsRequested: 20,
        network: "10.0.0.0",
        prefixLen: 27,
        mask: "255.255.255.224",
        wildcard: "0.0.0.31",
        broadcast: "10.0.0.31",
        gateway: "10.0.0.1",
        firstUsable: "10.0.0.1",
        lastUsable: "10.0.0.30",
        usableCount: 30,
        utilization: 66.7
      })
    ];

    const mediaResults = [
      new MediaSelection({
        linkA: "SiteA",
        linkB: "SiteB",
        distanceM: 50,
        mediaType: "Cat6a UTP",
        standard: "10GBASE-T"
      })
    ];

    const profileDir = exportAll(tmpDir, scenario, deviceConfigs, decisions, allocations, mediaResults);

    assert.ok(fs.existsSync(path.join(profileDir, "configs", "RTR-A.txt")));
    assert.ok(fs.existsSync(path.join(profileDir, "full_config.txt")));
    assert.ok(fs.existsSync(path.join(profileDir, "rationale.md")));
    assert.ok(fs.existsSync(path.join(profileDir, "allocation.csv")));
    assert.ok(fs.existsSync(path.join(profileDir, "summary.json")));
    assert.ok(fs.existsSync(path.join(profileDir, "verification.json")));

    const summaryJson = JSON.parse(fs.readFileSync(path.join(profileDir, "summary.json"), "utf-8"));
    assert.equal(summaryJson.profile, "testnet");
    assert.equal(summaryJson.totalSubnets, 1);

    // Clean up
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

