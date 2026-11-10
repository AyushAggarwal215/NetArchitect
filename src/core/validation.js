/**
 * src/core/validation.js
 * Comprehensive scenario and parameter validator for NetArchitect.
 */

import { InvalidParameterError } from "./errors.js";
import { parseCidr, isRfc1918 } from "../utils/ip-address.js";
import {
  VLAN_MIN,
  VLAN_MAX,
  VLAN_RESERVED_START,
  VLAN_RESERVED_END
} from "./constants.js";
import { Scenario } from "./models.js";

/**
 * Validate a Scenario object against CIC-307 networking rules.
 * @param {Scenario} scenario
 * @returns {boolean}
 */
export function validateScenario(scenario) {
  if (!scenario || typeof scenario !== "object") {
    throw new InvalidParameterError("Scenario definition must be a valid non-null object.");
  }

  // 1. Profile check
  if (!scenario.profile || typeof scenario.profile !== "string") {
    throw new InvalidParameterError("Scenario missing required 'profile' string identifier.");
  }

  // 2. Root Prefix RFC 1918 validation
  if (!scenario.rootPrefix || typeof scenario.rootPrefix !== "string") {
    throw new InvalidParameterError("Scenario missing required 'root_prefix' CIDR string.");
  }
  const { ip, prefixLen } = parseCidr(scenario.rootPrefix);
  if (!isRfc1918(ip)) {
    throw new InvalidParameterError(
      `Root prefix '${scenario.rootPrefix}' is not within RFC 1918 private address space ` +
      `(10.0.0.0/8, 172.16.0.0/12, or 192.168.0.0/16).`
    );
  }
  if (prefixLen > 30) {
    throw new InvalidParameterError(
      `Root prefix '${scenario.rootPrefix}' (/ ${prefixLen}) is too small to host a multi-subnet architecture.`
    );
  }

  // 3. Sites and Devices validation
  if (!Array.isArray(scenario.sites) || scenario.sites.length === 0) {
    throw new InvalidParameterError("Scenario must define at least one site in 'sites'.");
  }
  const seenSiteNames = new Set();
  const seenDeviceNames = new Set();

  for (const site of scenario.sites) {
    if (!site.name || typeof site.name !== "string") {
      throw new InvalidParameterError("Every site must have a valid non-empty 'name'.");
    }
    const trimmedSiteName = site.name.trim();
    if (seenSiteNames.has(trimmedSiteName)) {
      throw new InvalidParameterError(`Duplicate site name detected: '${trimmedSiteName}'`);
    }
    seenSiteNames.add(trimmedSiteName);

    if (Array.isArray(site.devices)) {
      for (const dev of site.devices) {
        if (!dev.name || typeof dev.name !== "string") {
          throw new InvalidParameterError(`Device at site '${trimmedSiteName}' must have a valid 'name'.`);
        }
        const trimmedDevName = dev.name.trim();
        if (seenDeviceNames.has(trimmedDevName)) {
          throw new InvalidParameterError(`Duplicate device name detected: '${trimmedDevName}'`);
        }
        seenDeviceNames.add(trimmedDevName);
      }
    }
  }

  // 4. Links validation
  if (!Array.isArray(scenario.links)) {
    throw new InvalidParameterError("Scenario 'links' must be an array.");
  }
  for (const link of scenario.links) {
    if (!link.a || !link.b) {
      throw new InvalidParameterError("Every link must define valid endpoints 'a' and 'b'.");
    }
    if (link.a === link.b) {
      throw new InvalidParameterError(`Self-loop link detected on '${link.a}'`);
    }
    if (!seenSiteNames.has(link.a) && !seenDeviceNames.has(link.a)) {
      throw new InvalidParameterError(`Link endpoint 'a' references unknown site/device '${link.a}'`);
    }
    if (!seenSiteNames.has(link.b) && !seenDeviceNames.has(link.b)) {
      throw new InvalidParameterError(`Link endpoint 'b' references unknown site/device '${link.b}'`);
    }
    if (typeof link.distanceM !== "number" || isNaN(link.distanceM) || link.distanceM <= 0) {
      throw new InvalidParameterError(
        `Link '${link.a}-${link.b}' distance must be a positive number (> 0 m), got ${link.distanceM}`
      );
    }
    if (link.mediaRequest && !["copper", "fiber", "auto"].includes(link.mediaRequest.toLowerCase())) {
      throw new InvalidParameterError(
        `Link '${link.a}-${link.b}' invalid media_request '${link.mediaRequest}'. Must be 'copper', 'fiber', or 'auto'.`
      );
    }
  }

  // 5. VLANs validation
  if (!Array.isArray(scenario.vlans) || scenario.vlans.length === 0) {
    throw new InvalidParameterError("Scenario must define at least one VLAN in 'vlans'.");
  }
  const seenVlanIds = new Set();
  for (const vlan of scenario.vlans) {
    if (typeof vlan.id !== "number" || !Number.isInteger(vlan.id)) {
      throw new InvalidParameterError(`VLAN ID must be an integer, got '${vlan.id}'`);
    }
    if (vlan.id < VLAN_MIN || vlan.id > VLAN_MAX) {
      throw new InvalidParameterError(
        `VLAN ${vlan.id} ('${vlan.name}'): ID out of standard 802.1Q range [${VLAN_MIN}, ${VLAN_MAX}]`
      );
    }
    if (vlan.id >= VLAN_RESERVED_START && vlan.id <= VLAN_RESERVED_END) {
      throw new InvalidParameterError(
        `VLAN ${vlan.id} ('${vlan.name}'): falls in reserved legacy Token Ring/FDDI range [${VLAN_RESERVED_START}, ${VLAN_RESERVED_END}]`
      );
    }
    if (seenVlanIds.has(vlan.id)) {
      throw new InvalidParameterError(`Duplicate VLAN ID ${vlan.id} detected ('${vlan.name}')`);
    }
    seenVlanIds.add(vlan.id);

    if (!vlan.name || typeof vlan.name !== "string") {
      throw new InvalidParameterError(`VLAN ${vlan.id} missing a valid 'name' string`);
    }
    if (typeof vlan.hosts !== "number" || vlan.hosts < 1) {
      throw new InvalidParameterError(
        `VLAN ${vlan.id} ('${vlan.name}'): hosts demand must be an integer >= 1, got ${vlan.hosts}`
      );
    }
    if (!vlan.site || !seenSiteNames.has(vlan.site)) {
      throw new InvalidParameterError(
        `VLAN ${vlan.id} ('${vlan.name}') references unknown site '${vlan.site}'`
      );
    }
  }

  // 6. Resiliency Topology Validation
  if (scenario.resiliency && scenario.sites.length > 1) {
    for (const site of scenario.sites) {
      let degree = 0;
      for (const link of scenario.links) {
        if (link.a === site.name || link.b === site.name) {
          degree++;
        }
      }
      if (degree < 2) {
        throw new InvalidParameterError(
          `Resiliency constraint failed: site '${site.name}' requires at least 2 disjoint physical links ` +
          `for dual-homed redundancy, but only ${degree} link(s) were specified.`
        );
      }
    }
  }

  // 7. Cloud Prefix validation (if present)
  if (scenario.extras && scenario.extras.cloud_prefix) {
    const cp = scenario.extras.cloud_prefix;
    const { ip: cpIp } = parseCidr(cp);
    if (!isRfc1918(cpIp)) {
      throw new InvalidParameterError(
        `Cloud VPC prefix '${cp}' is not within RFC 1918 private address space.`
      );
    }
  }

  return true;
}

/**
 * Normalizes raw JSON input into a Scenario instance.
 * @param {Object} rawData
 * @returns {Scenario}
 */
export function normalizeScenarioData(rawData) {
  if (!rawData || typeof rawData !== "object") {
    throw new InvalidParameterError("Input data must be a JSON object.");
  }

  const profile = rawData.profile;
  const rootPrefix = rawData.root_prefix || rawData.rootPrefix;

  const sites = Array.isArray(rawData.sites)
    ? rawData.sites.map(s => ({
        name: s.name,
        devices: (s.devices || []).map(d => ({
          name: d.name,
          type: d.type || "l3_switch",
          supportsIsl: d.supports_isl || d.supportsIsl || false
        })),
        area: s.area !== undefined ? s.area : null
      }))
    : [];

  const links = Array.isArray(rawData.links)
    ? rawData.links.map(l => ({
        a: l.a,
        b: l.b,
        distanceM: Number(l.distance_m !== undefined ? l.distance_m : l.distanceM),
        mediaRequest: l.media_request || l.mediaRequest || null
      }))
    : [];

  const vlans = Array.isArray(rawData.vlans)
    ? rawData.vlans.map(v => ({
        id: Number(v.id),
        name: v.name,
        hosts: Number(v.hosts),
        site: v.site,
        poe: Boolean(v.poe)
      }))
    : [];

  const scenario = new Scenario({
    profile,
    rootPrefix,
    sites,
    links,
    vlans,
    resiliency: rawData.resiliency || false,
    extras: rawData.extras || {}
  });

  validateScenario(scenario);
  return scenario;
}

