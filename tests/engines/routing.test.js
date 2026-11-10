import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { selectRouting } from "../../src/engines/routing.js";
import { Scenario, Site, Device, Vlan, SubnetAllocation } from "../../src/core/models.js";

describe("Topology-Aware Routing Engine", () => {
  const makeDummyAlloc = (name, site = "SiteA", network = "10.10.1.0", prefixLen = 24, aggregatePrefix = null) =>
    new SubnetAllocation({
      name,
      site,
      hostsRequested: 50,
      network,
      prefixLen,
      mask: "255.255.255.0",
      wildcard: "0.0.0.255",
      broadcast: "10.10.1.255",
      gateway: "10.10.1.1",
      firstUsable: "10.10.1.1",
      lastUsable: "10.10.1.254",
      usableCount: 254,
      utilization: 19.7,
      aggregatePrefix
    });

  test("Single site / small subnet network selects Single-Area OSPF (Area 0)", () => {
    const scenario = new Scenario({
      profile: "campus",
      rootPrefix: "10.10.0.0/16",
      sites: [new Site({ name: "CampusCore", devices: [new Device({ name: "CORE-1" })] })],
      links: [],
      vlans: [new Vlan({ id: 10, name: "Data", hosts: 100, site: "CampusCore" })]
    });
    const allocs = [makeDummyAlloc("Data", "CampusCore")];

    const { routingConfig, decisions } = selectRouting(scenario, allocs);
    assert.equal(routingConfig.protocol, "ospf");
    assert.equal(routingConfig.isMultiArea, false);
    assert.equal(routingConfig.hasBgp, false);
    assert.equal(routingConfig.ospfAreas["CampusCore"], 0);
    assert.ok(decisions.some(d => d.references.includes("RFC 2328")));
  });

  test("Multi-site network with explicit area partition selects Multi-Area OSPF", () => {
    const scenario = new Scenario({
      profile: "enterprise",
      rootPrefix: "10.10.0.0/16",
      sites: [
        new Site({ name: "Delhi", devices: [new Device({ name: "R1" })], area: 0 }),
        new Site({ name: "Mumbai", devices: [new Device({ name: "R2" })], area: 1 })
      ],
      links: [],
      vlans: []
    });
    const allocs = [
      makeDummyAlloc("Delhi-LAN", "Delhi", "10.10.0.0", 24, "10.10.0.0/24"),
      makeDummyAlloc("Mumbai-LAN", "Mumbai", "10.10.1.0", 24, "10.10.1.0/24")
    ];

    const { routingConfig, decisions } = selectRouting(scenario, allocs);
    assert.equal(routingConfig.isMultiArea, true);
    assert.equal(routingConfig.hasBgp, false);
    assert.equal(routingConfig.ospfAreas["Delhi"], 0);
    assert.equal(routingConfig.ospfAreas["Mumbai"], 1);
    assert.ok(routingConfig.areaRanges[1]);
    assert.ok(decisions.some(d => d.references.includes("RFC 2328")));
  });

  test("Multi-site network with cloud VPC prefix selects Multi-Area OSPF + eBGP", () => {
    const scenario = new Scenario({
      profile: "wan",
      rootPrefix: "10.100.0.0/16",
      sites: [
        new Site({ name: "Delhi", devices: [new Device({ name: "RTR-DELHI" })], area: 0 }),
        new Site({ name: "Mumbai", devices: [new Device({ name: "RTR-MUMBAI" })], area: 1 })
      ],
      links: [],
      vlans: [],
      extras: { cloud_prefix: "10.200.0.0/16" }
    });
    const allocs = [
      makeDummyAlloc("Delhi-IoT", "Delhi", "10.100.0.0", 22, "10.100.0.0/22"),
      makeDummyAlloc("Mumbai-IoT", "Mumbai", "10.100.4.0", 23, "10.100.4.0/23")
    ];

    const { routingConfig, decisions } = selectRouting(scenario, allocs);
    assert.equal(routingConfig.isMultiArea, true);
    assert.equal(routingConfig.hasBgp, true);
    assert.equal(routingConfig.bgpLocalAs, 65001);
    assert.equal(routingConfig.bgpCloudAs, 65010);
    assert.ok(decisions.some(d => d.references.includes("RFC 4271")));
    assert.ok(decisions.some(d => d.references.includes("RFC 6996")));
  });

  test("Topology drives decision even when preset profile name is changed", () => {
    // A scenario named 'campus' that actually has a cloud prefix and 3 areas:
    const scenario = new Scenario({
      profile: "campus", // Misleading preset name
      rootPrefix: "10.100.0.0/16",
      sites: [
        new Site({ name: "HQ", devices: [new Device({ name: "R1" })], area: 0 }),
        new Site({ name: "Branch1", devices: [new Device({ name: "R2" })], area: 1 })
      ],
      links: [],
      vlans: [],
      extras: { cloud_prefix: "10.200.0.0/16" }
    });
    const allocs = [makeDummyAlloc("HQ-Net", "HQ"), makeDummyAlloc("BR-Net", "Branch1")];

    const { routingConfig } = selectRouting(scenario, allocs);
    // Must select BGP + Multi-Area because of cloud prefix and multi-site topology
    assert.equal(routingConfig.hasBgp, true);
    assert.equal(routingConfig.isMultiArea, true);
  });
});

