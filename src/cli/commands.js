/**
 * src/cli/commands.js
 * CLI command handlers and pipeline orchestrator for NetArchitect.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeScenarioData } from "../core/validation.js";
import { selectMedia } from "../engines/media.js";
import { allocateVlsm, allocateHierarchical } from "../engines/vlsm.js";
import { selectRouting } from "../engines/routing.js";
import { generateAllConfigs } from "../config/generator.js";
import { exportAll } from "../output/exporter.js";
import { InvalidParameterError } from "../core/errors.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * List available built-in preset scenarios.
 */
export function listPresets() {
  console.log("NetArchitect — Available Built-in Presets (CIC-307)");
  console.log("=".repeat(75));
  console.log("  1. campus   — St. Jude University Campus LAN (1,600 endpoints, OM4/Cat6a, PoE, RSTP, OSPF Area 0)");
  console.log("  2. metro    — Apex Financial Metro MAN (450 users + 100 colo servers, OS2 SMF, EVPL, QoS, Dual-Homed)");
  console.log("  3. wan      — TransGlobal Logistics WAN (2,000 IoT + 200 srv/mgmt, 4 Cities + AWS VPC, OSPF/BGP/IPsec)");
  console.log("");
  console.log("Usage examples:");
  console.log("  node src/cli/index.js run --preset campus");
  console.log("  node src/cli/index.js run --preset metro");
  console.log("  node src/cli/index.js run --preset wan");
  console.log("  node src/cli/index.js validate --custom path/to/scenario.json");
  return 0;
}

/**
 * Load a preset Scenario from disk.
 * @param {string} presetName - "campus" | "metro" | "wan"
 * @returns {import('../core/models.js').Scenario}
 */
export function loadPresetScenario(presetName) {
  const allowed = ["campus", "metro", "wan"];
  if (!allowed.includes(presetName.toLowerCase())) {
    throw new InvalidParameterError(
      `Unknown preset '${presetName}'. Available built-in presets: ${allowed.join(", ")}`
    );
  }

  // Look relative to module directory or current working directory presets/
  const candidatePaths = [
    path.resolve(__dirname, "../../presets", `${presetName}.json`),
    path.resolve("presets", `${presetName}.json`)
  ];

  let rawContent = null;
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      rawContent = fs.readFileSync(p, "utf-8");
      break;
    }
  }

  if (!rawContent) {
    throw new InvalidParameterError(`Preset file for '${presetName}' could not be located.`);
  }

  const rawJson = JSON.parse(rawContent);
  return normalizeScenarioData(rawJson);
}

/**
 * Load a custom Scenario from a JSON file path.
 * @param {string} filePath
 * @returns {import('../core/models.js').Scenario}
 */
export function loadCustomScenario(filePath) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    throw new InvalidParameterError(`Custom scenario file not found: '${filePath}'`);
  }

  let rawJson;
  try {
    const rawContent = fs.readFileSync(fullPath, "utf-8");
    rawJson = JSON.parse(rawContent);
  } catch (err) {
    throw new InvalidParameterError(`Invalid JSON in file '${filePath}': ${err.message}`);
  }

  return normalizeScenarioData(rawJson);
}

/**
 * Validate a scenario without running the export pipeline.
 * @param {string} customPath
 * @returns {number} 0 on success
 */
export function validateCustomScenario(customPath) {
  console.log(`NetArchitect — Validating scenario '${customPath}'...`);
  const scenario = loadCustomScenario(customPath);
  console.log(`[PASS] Scenario validation successful!`);
  console.log(`  Profile:     ${scenario.profile}`);
  console.log(`  Root Prefix: ${scenario.rootPrefix}`);
  console.log(`  Sites:       ${scenario.sites.length}`);
  console.log(`  VLANs:       ${scenario.vlans.length}`);
  console.log(`  Links:       ${scenario.links.length}`);
  return 0;
}

/**
 * Execute the end-to-end network architecture design pipeline for a scenario.
 *
 * @param {import('../core/models.js').Scenario} scenario
 * @param {string} [outDir="out"]
 * @returns {number} 0 on success
 */
export function executePipeline(scenario, outDir = "out") {
  const decisions = [];

  // ── Phase 1: Physical Media Selection ─────────────────────────────────────
  const mediaResults = [];
  for (const link of scenario.links) {
    const { selection, decisions: linkDecs } = selectMedia(
      link.a,
      link.b,
      link.distanceM,
      { mediaRequest: link.mediaRequest, profile: scenario.profile }
    );
    mediaResults.push(selection);
    decisions.push(...linkDecs);
  }

  // ── Phase 2: IPv4 VLSM Subnet Allocation ──────────────────────────────────
  const vlanReqs = scenario.vlans.map(v => ({
    name: v.name,
    hosts: v.hosts,
    site: v.site,
    isPtp: false,
    isLoopback: false
  }));

  const ptpReqs = scenario.links.map(l => ({
    name: `P2P-${l.a}-${l.b}`,
    hosts: 2,
    site: l.a,
    isPtp: true,
    isLoopback: false
  }));

  const loopbackReqs = [];
  for (const site of scenario.sites) {
    for (const dev of site.devices) {
      loopbackReqs.push({
        name: `Lo0-${dev.name}`,
        hosts: 1,
        site: site.name,
        isLoopback: true,
        isPtp: false
      });
    }
  }

  const allowSlash31 = Boolean(scenario.extras && scenario.extras.allow_slash31);
  let allocations;
  let vlsmDecisions;

  if (
    scenario.profile === "wan" ||
    (scenario.sites.length > 1 && scenario.sites.some(s => s.area !== null && s.area !== 0))
  ) {
    // Hierarchical multi-site allocation mode
    const sitesVlans = {};
    for (const req of vlanReqs) {
      if (!sitesVlans[req.site]) sitesVlans[req.site] = [];
      sitesVlans[req.site].push(req);
    }
    const res = allocateHierarchical(
      scenario.rootPrefix,
      sitesVlans,
      ptpReqs,
      loopbackReqs,
      { allowSlash31 }
    );
    allocations = res.allocations;
    vlsmDecisions = res.decisions;
  } else {
    // Flat VLSM allocation mode
    const allReqs = [...vlanReqs, ...ptpReqs, ...loopbackReqs];
    const res = allocateVlsm(scenario.rootPrefix, allReqs, { allowSlash31 });
    allocations = res.allocations;
    vlsmDecisions = res.decisions;
  }
  decisions.push(...vlsmDecisions);

  // ── Phase 3: Routing Architecture Selection ───────────────────────────────
  const { routingConfig, decisions: routingDecs } = selectRouting(scenario, allocations);
  decisions.push(...routingDecs);

  // ── Phase 4: Cisco IOS Configuration Generation ───────────────────────────
  const { configs, decisions: configDecs } = generateAllConfigs(
    scenario,
    allocations,
    mediaResults,
    routingConfig
  );
  decisions.push(...configDecs);

  // ── Phase 5: Exporting Deliverables to Disk ────────────────────────────────
  const profileDir = exportAll(
    outDir,
    scenario,
    configs,
    decisions,
    allocations,
    mediaResults
  );

  // ── Console Summary Display ───────────────────────────────────────────────
  console.log(`NetArchitect v2.0 — ${scenario.profile.toUpperCase()} Network Architecture`);
  console.log("=".repeat(70));
  console.log(`Root Prefix:    ${scenario.rootPrefix}`);
  console.log(`Topology:       ${scenario.sites.length} site(s), ${Object.keys(configs).length} device(s), ${scenario.links.length} physical link(s)`);
  console.log(`Routing:        ${routingConfig.protocol.toUpperCase()}${routingConfig.isMultiArea ? " (Multi-Area Hierarchical)" : " (Area 0 Backbone)"}${routingConfig.hasBgp ? " + eBGP Cloud Peering" : ""}`);
  console.log(`Decisions Made: ${decisions.length} explainable engineering decisions`);

  const totalHostsRequested = allocations.reduce((sum, a) => sum + a.hostsRequested, 0);
  const totalUsable = allocations.reduce((sum, a) => sum + a.usableCount, 0);
  const efficiency = totalUsable > 0 ? ((totalHostsRequested / totalUsable) * 100).toFixed(1) : 0;
  console.log(`Subnet Capacity: ${allocations.length} subnets, ${totalHostsRequested} requested hosts in ${totalUsable} usable capacity (${efficiency}% utilization)`);
  console.log("");

  console.log("Subnet Allocation Summary:");
  console.log("  " + "Name".padEnd(24) + "Network".padEnd(18) + "Prefix".padEnd(8) + "Capacity".padEnd(10) + "Gateway");
  console.log("  " + "-".repeat(24) + "-".repeat(18) + "-".repeat(8) + "-".repeat(10) + "-".repeat(16));
  for (const a of allocations) {
    console.log(
      "  " +
      a.name.padEnd(24) +
      a.network.padEnd(18) +
      `/${a.prefixLen}`.padEnd(8) +
      `${a.hostsRequested}/${a.usableCount}`.padEnd(10) +
      a.gateway
    );
  }
  console.log("");

  console.log("Generated Cisco IOS Devices:");
  for (const devName of Object.keys(configs)) {
    console.log(`  - [Device] ${devName} (${configs[devName].split("\n").length} configuration lines)`);
  }
  console.log("");
  console.log(`Exports Location: ${profileDir}`);
  console.log(`  - Combined Config:   ${path.join(profileDir, "full_config.txt")}`);
  console.log(`  - Decision Rationale: ${path.join(profileDir, "rationale.md")}`);
  console.log(`  - Subnet Table CSV:  ${path.join(profileDir, "allocation.csv")}`);
  console.log(`  - Metrics Summary:   ${path.join(profileDir, "summary.json")}`);
  console.log(`  - Security Audit:    ${path.join(profileDir, "verification.json")}`);
  console.log("=".repeat(70));

  return 0;
}

