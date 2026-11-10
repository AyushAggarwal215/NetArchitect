import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { normalizeScenarioData } from "../../src/core/validation.js";
import { selectMedia } from "../../src/engines/media.js";
import { allocateVlsm, allocateHierarchical } from "../../src/engines/vlsm.js";
import { selectRouting } from "../../src/engines/routing.js";
import { generateAllConfigs } from "../../src/config/generator.js";
import { isAllowedIosLine, validateAllDeviceConfigs } from "../../src/config/ios-validator.js";

describe("Cisco IOS Configuration Generator & Compliance", () => {
  const loadPreset = (name) => {
    const filePath = path.resolve("presets", `${name}.json`);
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return normalizeScenarioData(raw);
  };

  const runPipelineForPreset = (presetName) => {
    const scenario = loadPreset(presetName);

    // Media
    const mediaResults = scenario.links.map(l =>
      selectMedia(l.a, l.b, l.distanceM, { mediaRequest: l.mediaRequest, profile: scenario.profile }).selection
    );

    // Requests
    const vlanReqs = scenario.vlans.map(v => ({ name: v.name, hosts: v.hosts, site: v.site }));
    const ptpReqs = scenario.links.map(l => ({ name: `P2P-${l.a}-${l.b}`, hosts: 2, site: l.a, isPtp: true }));
    const lbReqs = [];
    for (const s of scenario.sites) {
      for (const d of s.devices) {
        lbReqs.push({ name: `Lo0-${d.name}`, hosts: 1, site: s.name, isLoopback: true });
      }
    }

    const allowSlash31 = Boolean(scenario.extras && scenario.extras.allow_slash31);
    let allocations;

    if (scenario.profile === "wan") {
      const sitesVlans = {};
      for (const r of vlanReqs) {
        if (!sitesVlans[r.site]) sitesVlans[r.site] = [];
        sitesVlans[r.site].push(r);
      }
      allocations = allocateHierarchical(scenario.rootPrefix, sitesVlans, ptpReqs, lbReqs, { allowSlash31 }).allocations;
    } else {
      allocations = allocateVlsm(scenario.rootPrefix, [...vlanReqs, ...ptpReqs, ...lbReqs], { allowSlash31 }).allocations;
    }

    const { routingConfig } = selectRouting(scenario, allocations);
    const { configs, decisions } = generateAllConfigs(scenario, allocations, mediaResults, routingConfig);

    return { scenario, allocations, configs, decisions };
  };

  test("Campus preset configs satisfy strict allowlist, security hardening, and zero duplicate IPs", () => {
    const { scenario, allocations, configs } = runPipelineForPreset("campus");

    assert.equal(Object.keys(configs).length, 3);
    assert.ok(configs["CORE-ADMIN"]);
    assert.ok(configs["DIST-SCIENCE"]);
    assert.ok(configs["DIST-RESI"]);

    // Allowlist check
    for (const [hostname, text] of Object.entries(configs)) {
      const lines = text.split("\n");
      for (const line of lines) {
        assert.ok(
          isAllowedIosLine(line),
          `Campus device ${hostname} emitted unapproved command line: '${line}'`
        );
      }
    }

    // Security assertions
    const coreText = configs["CORE-ADMIN"];
    assert.ok(coreText.includes("spanning-tree mode rapid-pvst"));
    assert.ok(coreText.includes("spanning-tree vlan 10 priority 4096"));
    assert.ok(coreText.includes("vlan 999"));
    assert.ok(coreText.includes("name NATIVE"));
    assert.ok(coreText.includes("switchport mode access"));
    assert.ok(coreText.includes("spanning-tree portfast"));
    assert.ok(coreText.includes("spanning-tree bpduguard enable"));
    assert.ok(coreText.includes("router ospf 1"));
    assert.ok(coreText.includes("passive-interface Vlan10"));

    // Global multi-device consistency (zero IP collisions)
    assert.doesNotThrow(() => validateAllDeviceConfigs(configs));
  });

  test("Metro preset configs include EVPL subinterfaces and QoS policy", () => {
    const { configs } = runPipelineForPreset("metro");
    assert.equal(Object.keys(configs).length, 3);
    assert.ok(configs["RTR-FINTECH-HQ"]);

    const hqText = configs["RTR-FINTECH-HQ"];
    assert.ok(hqText.includes("class-map match-all VOICE-CLASS"));
    assert.ok(hqText.includes("match dscp ef"));
    assert.ok(hqText.includes("policy-map QOS-POLICY"));
    assert.ok(hqText.includes("priority percent 30"));
    assert.ok(hqText.includes("service-policy output QOS-POLICY"));
    assert.ok(hqText.includes("encapsulation dot1Q 10"));

    assert.doesNotThrow(() => validateAllDeviceConfigs(configs));
  });

  test("WAN preset configs include Multi-Area OSPF, eBGP, and IPsec VPN tunnel", () => {
    const { configs } = runPipelineForPreset("wan");
    assert.equal(Object.keys(configs).length, 4);
    assert.ok(configs["RTR-DELHI"]);

    const delhiText = configs["RTR-DELHI"];
    // OSPF area-range summaries
    assert.ok(delhiText.includes("area 1 range"));
    assert.ok(delhiText.includes("area 2 range"));
    assert.ok(delhiText.includes("area 3 range"));

    // BGP
    assert.ok(delhiText.includes("router bgp 65001"));
    assert.ok(delhiText.includes("neighbor 10.200.0.1 remote-as 65010"));

    // IPsec
    assert.ok(delhiText.includes("crypto isakmp policy 10"));
    assert.ok(delhiText.includes("encr aes 256"));
    assert.ok(delhiText.includes("group 14"));
    assert.ok(delhiText.includes("crypto isakmp key CHANGE_ME_BEFORE_DEPLOYMENT"));
    assert.ok(delhiText.includes("crypto ipsec transform-set IPSEC-TS esp-aes 256 esp-sha256-hmac"));
    assert.ok(delhiText.includes("crypto map IPSEC-MAP 10 ipsec-isakmp"));

    assert.doesNotThrow(() => validateAllDeviceConfigs(configs));
  });
});

