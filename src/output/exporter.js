/**
 * src/output/exporter.js
 * Disk Exporter for NetArchitect outputs (CIC-307).
 *
 * Safely creates structured directories and writes all deliverables:
 *  - full_config.txt
 *  - configs/<device>.txt
 *  - rationale.md
 *  - allocation.csv
 *  - summary.json
 *  - verification.json
 */

import fs from "node:fs";
import path from "node:path";
import {
  buildRationaleMarkdown,
  buildAllocationCsv,
  buildSummaryJsonData,
  buildVerificationJsonData
} from "./explainer.js";
import { validateAllDeviceConfigs } from "../config/ios-validator.js";

/**
 * Export all generated files to the target output directory.
 *
 * @param {string} outBaseDir - e.g. "out" or "./exports"
 * @param {import('../core/models.js').Scenario} scenario
 * @param {Record<string, string>} deviceConfigsMap - { hostname: configText }
 * @param {import('../core/models.js').Decision[]} decisions
 * @param {import('../core/models.js').SubnetAllocation[]} allocations
 * @param {import('../core/models.js').MediaSelection[]} mediaResults
 * @returns {string} - Absolute path to the created profile directory
 */
export function exportAll(
  outBaseDir,
  scenario,
  deviceConfigsMap,
  decisions,
  allocations,
  mediaResults
) {
  const profile = scenario.profile || "custom";
  const profileDir = path.resolve(outBaseDir, profile);
  const configsDir = path.join(profileDir, "configs");

  // Ensure directories exist
  fs.mkdirSync(configsDir, { recursive: true });

  // Clean obsolete device configuration files from previous runs
  for (const file of fs.readdirSync(configsDir)) {
    if (file.endsWith(".txt")) {
      fs.unlinkSync(path.join(configsDir, file));
    }
  }

  // 1. Per-device configurations: configs/<hostname>.txt
  for (const [hostname, configText] of Object.entries(deviceConfigsMap)) {
    const devPath = path.join(configsDir, `${hostname}.txt`);
    fs.writeFileSync(devPath, configText, "utf-8");
  }

  // 2. Full merged configuration (both full_config.txt and <profile>_full_config.txt)
  const fullConfigLines = [];
  for (const [hostname, configText] of Object.entries(deviceConfigsMap)) {
    fullConfigLines.push(configText);
    fullConfigLines.push("\n");
  }
  const mergedConfig = fullConfigLines.join("\n");
  fs.writeFileSync(path.join(profileDir, "full_config.txt"), mergedConfig, "utf-8");
  fs.writeFileSync(path.join(profileDir, `${profile}_full_config.txt`), mergedConfig, "utf-8");

  // 3. Technical Design Rationale: rationale.md
  const rationaleMd = buildRationaleMarkdown(decisions, allocations, profile);
  fs.writeFileSync(path.join(profileDir, "rationale.md"), rationaleMd, "utf-8");

  // 4. IP Allocation Table: allocation.csv
  const allocCsv = buildAllocationCsv(allocations);
  fs.writeFileSync(path.join(profileDir, "allocation.csv"), allocCsv, "utf-8");

  // 5. Machine-Readable Summary: summary.json
  const summaryData = buildSummaryJsonData(scenario, decisions, allocations, mediaResults);
  fs.writeFileSync(
    path.join(profileDir, "summary.json"),
    JSON.stringify(summaryData, null, 2),
    "utf-8"
  );

  // 6. Verification Report: verification.json
  let validationResult = { valid: true, errors: [], warnings: [] };
  try {
    validateAllDeviceConfigs(deviceConfigsMap);
  } catch (err) {
    validationResult = { valid: false, errors: [err.message], warnings: [] };
  }
  const verificationData = buildVerificationJsonData(profile, deviceConfigsMap, validationResult);
  fs.writeFileSync(
    path.join(profileDir, "verification.json"),
    JSON.stringify(verificationData, null, 2),
    "utf-8"
  );

  return profileDir;
}

