import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { normalizeScenarioData, validateScenario } from "../../src/core/validation.js";
import { InvalidParameterError } from "../../src/core/errors.js";

describe("Scenario Validation Logic", () => {
  const baseValidScenario = () => ({
    profile: "campus",
    root_prefix: "10.10.0.0/16",
    resiliency: true,
    sites: [
      { name: "SiteA", devices: [{ name: "SW-A", type: "l3_switch" }] },
      { name: "SiteB", devices: [{ name: "SW-B", type: "l3_switch" }] },
      { name: "SiteC", devices: [{ name: "SW-C", type: "l3_switch" }] }
    ],
    links: [
      { a: "SiteA", b: "SiteB", distance_m: 80 },
      { a: "SiteB", b: "SiteC", distance_m: 120 },
      { a: "SiteA", b: "SiteC", distance_m: 200 }
    ],
    vlans: [
      { id: 10, name: "Admin", hosts: 50, site: "SiteA" },
      { id: 20, name: "Faculty", hosts: 100, site: "SiteB" }
    ]
  });

  test("Valid scenario passes successfully", () => {
    const raw = baseValidScenario();
    const scenario = normalizeScenarioData(raw);
    assert.equal(scenario.profile, "campus");
    assert.equal(scenario.rootPrefix, "10.10.0.0/16");
    assert.equal(scenario.sites.length, 3);
    assert.equal(scenario.links.length, 3);
  });

  test("Rejects non-RFC1918 root prefix", () => {
    const raw = baseValidScenario();
    raw.root_prefix = "8.8.8.0/24";
    assert.throws(() => normalizeScenarioData(raw), /RFC 1918/);
  });

  test("Rejects duplicate site names", () => {
    const raw = baseValidScenario();
    raw.sites.push({ name: "SiteA", devices: [] });
    assert.throws(() => normalizeScenarioData(raw), /Duplicate site name/);
  });

  test("Rejects duplicate device names across sites", () => {
    const raw = baseValidScenario();
    raw.sites[1].devices.push({ name: "SW-A" });
    assert.throws(() => normalizeScenarioData(raw), /Duplicate device name/);
  });

  test("Rejects unknown link endpoints", () => {
    const raw = baseValidScenario();
    raw.links.push({ a: "SiteA", b: "NonexistentSite", distance_m: 50 });
    assert.throws(() => normalizeScenarioData(raw), /unknown site\/device/);
  });

  test("Rejects negative or zero link distance", () => {
    const raw = baseValidScenario();
    raw.links[0].distance_m = -10;
    assert.throws(() => normalizeScenarioData(raw), /positive number/);
    raw.links[0].distance_m = 0;
    assert.throws(() => normalizeScenarioData(raw), /positive number/);
  });

  test("Rejects invalid VLAN IDs (below 1, above 4094, and reserved 1002-1005)", () => {
    const rawLow = baseValidScenario();
    rawLow.vlans[0].id = 0;
    assert.throws(() => normalizeScenarioData(rawLow), /out of standard 802.1Q range/);

    const rawHigh = baseValidScenario();
    rawHigh.vlans[0].id = 4095;
    assert.throws(() => normalizeScenarioData(rawHigh), /out of standard 802.1Q range/);

    const rawRes = baseValidScenario();
    rawRes.vlans[0].id = 1002;
    assert.throws(() => normalizeScenarioData(rawRes), /reserved legacy Token Ring/);
  });

  test("Rejects duplicate VLAN IDs", () => {
    const raw = baseValidScenario();
    raw.vlans.push({ id: 10, name: "DuplicateVlan", hosts: 20, site: "SiteA" });
    assert.throws(() => normalizeScenarioData(raw), /Duplicate VLAN ID/);
  });

  test("Rejects resiliency failure when a site has < 2 links", () => {
    const raw = baseValidScenario();
    // Remove link A-C, so SiteC has only 1 link (B-C)
    raw.links = [
      { a: "SiteA", b: "SiteB", distance_m: 80 },
      { a: "SiteB", b: "SiteC", distance_m: 120 }
    ];
    assert.throws(() => normalizeScenarioData(raw), /requires at least 2 disjoint physical links/);
  });
});

