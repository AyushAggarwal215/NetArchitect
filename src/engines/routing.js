/**
 * src/engines/routing.js
 * Topology-Aware Routing Decision Engine for NetArchitect (CIC-307).
 *
 * Implements deterministic routing protocol selection derived from topology boundaries,
 * subnet scales, and external autonomous system connectivity:
 *  - RFC 2328: OSPF Version 2 (Single-Area & Multi-Area Hierarchies)
 *  - RFC 4271: Border Gateway Protocol 4 (eBGP Inter-Domain Peering)
 *  - RFC 6996: Autonomous System Numbers for Private Enterprise Use
 */

import { RoutingConfig, Decision } from "../core/models.js";
import {
  OSPF_MAX_SUBNETS_SINGLE_AREA,
  ONPREM_ASN,
  CLOUD_ASN
} from "../core/constants.js";

/**
 * Evaluates network parameters and selects optimal routing architecture.
 *
 * @param {import('../core/models.js').Scenario} scenario
 * @param {import('../core/models.js').SubnetAllocation[]} allocations
 * @returns {{ routingConfig: RoutingConfig, decisions: Decision[] }}
 */
export function selectRouting(scenario, allocations) {
  const decisions = [];
  const numSites = scenario.sites.length;
  const numSubnets = allocations.length;
  const cloudObj = scenario.cloud || (scenario.extras && scenario.extras.cloud);
  const cloudPrefix = cloudObj?.prefix || (scenario.extras && scenario.extras.cloud_prefix);
  const hasCloud = Boolean(cloudPrefix);
  const hasExplicitMultiArea = scenario.sites.some(
    s => s.area !== null && s.area !== undefined && s.area !== 0
  );

  // ── Case 1: External Cloud Peering -> Multi-Area OSPF + eBGP ──────────────
  if (numSites > 1 && hasCloud) {
    const ospfAreas = {};
    for (const site of scenario.sites) {
      ospfAreas[site.name] = site.area !== null && site.area !== undefined ? site.area : 0;
    }

    // Identify area range summarization prefixes from hierarchical allocations
    const areaRanges = {};
    for (const alloc of allocations) {
      if (alloc.aggregatePrefix) {
        const area = ospfAreas[alloc.site];
        if (area !== undefined && area !== 0 && !areaRanges[area]) {
          areaRanges[area] = alloc.aggregatePrefix;
        }
      }
    }

    const cloudGatewayIp = cloudObj?.gateway_ip || scenario.extras?.cloud_peer_ip || "10.200.0.1";
    const cloudAsn = cloudObj?.asn || CLOUD_ASN;
    const cloudName = cloudObj?.name || "Cloud VPC";

    const routingConfig = new RoutingConfig({
      protocol: "ospf+bgp",
      ospfAreas,
      isMultiArea: true,
      hasBgp: true,
      bgpLocalAs: ONPREM_ASN,
      bgpCloudAs: cloudAsn,
      bgpPeerIp: cloudGatewayIp,
      areaRanges
    });

    const areaSummaryParts = scenario.sites.map(s => {
      const a = ospfAreas[s.name];
      return a === 0 ? `${s.name}: Area 0 backbone` : `${s.name}: Area ${a}`;
    });
    const areaSummaryStr = areaSummaryParts.join(", ");

    decisions.push(new Decision({
      ruleId: "ROUTE-001",
      domain: "routing",
      subject: "Global WAN Routing Architecture",
      choice: `Hierarchical Multi-Area OSPF + eBGP (ASN ${ONPREM_ASN} <-> ${cloudAsn})`,
      reason: `Selected Multi-Area OSPF with eBGP peering because the network spans ${numSites} geographically ` +
        `dispersed sites with ${numSubnets} allocated subnets and requires hybrid cloud integration with ${cloudName} ` +
        `(${cloudPrefix}). Each site is designated into an OSPF area hierarchy (${areaSummaryStr}) ` +
        `to contain link-state advertisement (LSA) flooding and enable Area Border Router (ABR) route summarization via 'area range' (RFC 2328). ` +
        `External routing to cloud VPC uses eBGP across Private ASNs (On-Premises ASN ${ONPREM_ASN} to Cloud Provider ` +
        `ASN ${cloudAsn} at ${cloudGatewayIp}) ensuring administrative domain separation and route filtering (RFC 4271, RFC 6996).`,
      references: ["RFC 2328", "RFC 4271", "RFC 6996"],
      alternative: "Static default routes to cloud",
      rejectionReason: "Fails to provide dynamic failover, AS path loop prevention, or automated route exchange with cloud gateway."
    }));

    return { routingConfig, decisions };
  }

  // ── Case 2: Multi-Site Internal Network without Cloud -> Multi-Area OSPF ──
  if (numSites > 1 && (hasExplicitMultiArea || numSubnets >= OSPF_MAX_SUBNETS_SINGLE_AREA)) {
    const ospfAreas = {};
    for (const site of scenario.sites) {
      ospfAreas[site.name] = site.area !== null && site.area !== undefined ? site.area : 0;
    }

    const areaRanges = {};
    for (const alloc of allocations) {
      if (alloc.aggregatePrefix) {
        const area = ospfAreas[alloc.site];
        if (area !== undefined && area !== 0 && !areaRanges[area]) {
          areaRanges[area] = alloc.aggregatePrefix;
        }
      }
    }

    const routingConfig = new RoutingConfig({
      protocol: "ospf",
      ospfAreas,
      isMultiArea: true,
      hasBgp: false,
      areaRanges
    });

    decisions.push(new Decision({
      ruleId: "ROUTE-002",
      domain: "routing",
      subject: "Multi-Area OSPF Partitioning",
      choice: "Multi-Area OSPF (RFC 2328)",
      reason: `Selected Multi-Area OSPF because the network comprises ${numSites} discrete physical sites and ` +
        `${numSubnets} subnets with explicit area designations. Partitioning into non-backbone areas attached to ` +
        `Backbone Area 0 minimizes SPF calculation frequency during local link flaps and prevents topology instability ` +
        `from rippling across inter-site WAN/MAN links.`,
      references: ["RFC 2328"],
      alternative: "Flat Single-Area OSPF",
      rejectionReason: `Exceeds single-area scalability best practices; LSA-1/LSA-2 flood propagation across WAN links causes unnecessary SPF recalculations.`
    }));

    return { routingConfig, decisions };
  }

  // ── Case 3: Single Autonomous Domain / Subnets < 50 -> Single-Area OSPF (Area 0) ──
  const ospfAreas = {};
  for (const site of scenario.sites) {
    ospfAreas[site.name] = 0;
  }

  const routingConfig = new RoutingConfig({
    protocol: "ospf",
    ospfAreas,
    isMultiArea: false,
    hasBgp: false
  });

  const topologyContext = scenario.profile === "metro"
    ? "Metro MAN EVPL triangle connecting HQ and remote branches"
    : `Enterprise Campus LAN across ${numSites} site(s)`;

  decisions.push(new Decision({
    ruleId: "ROUTE-003",
    domain: "routing",
    subject: "Intra-Domain Interior Gateway Protocol",
    choice: "Single-Area OSPF (Area 0 Backbone)",
    reason: `Selected Single-Area OSPF (Area 0) for the ${topologyContext}. ` +
      `With ${numSites} site(s) and ${numSubnets} total subnets (strictly below the ${OSPF_MAX_SUBNETS_SINGLE_AREA} ` +
      `subnet threshold), a single backbone area provides sub-second Dijkstra SPF convergence without the ` +
      `administrative complexity of ABR route summarization or virtual links (RFC 2328). ` +
      `Link-state advertisements ensure loop-free shortest-path forwarding over redundant links.`,
    references: ["RFC 2328"],
    alternative: "EIGRP or RIPv2",
    rejectionReason: "RIPv2 suffers from slow 15-hop limit and periodic broadcast overhead; EIGRP is proprietary-derived whereas OSPF is open IETF standard."
  }));

  return { routingConfig, decisions };
}

