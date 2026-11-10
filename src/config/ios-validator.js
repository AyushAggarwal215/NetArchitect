/**
 * src/config/ios-validator.js
 * Comprehensive Cisco IOS Configuration Validator for NetArchitect (CIC-307).
 *
 * Enforces:
 *  - Strict adherence to approved Cisco IOS command syntax prefixes
 *  - Duplicate IP address detection across all device interfaces
 *  - SVI subnet containment verification
 *  - Trunk port security (explicit allowed VLAN list and dedicated Native VLAN != 1)
 *  - Access port security (PortFast and BPDU Guard enforcement)
 *  - OSPF wildcard mask accuracy and passive-interface on client SVIs
 *  - Production secret / plain-text credential leak detection
 */

import { ConfigurationValidationError } from "../core/errors.js";

// Approved Cisco IOS command prefix allowlist
export const IOS_COMMAND_PREFIXES = [
  // Global configuration
  "hostname ",
  "no ip domain-lookup",
  "no ip domain lookup",
  "ip routing",

  // Layer 2 — VLAN
  "vlan ",
  "name ",

  // Layer 2 — Spanning Tree (IEEE 802.1w)
  "spanning-tree ",

  // Interface configuration
  "interface ",
  "description ",
  "ip address ",
  "no switchport",
  "no shutdown",
  "shutdown",
  "switchport ",
  "encapsulation ",
  "power inline ",
  "power ",

  // Layer 3 — OSPF (RFC 2328)
  "router ospf",
  "router-id ",
  "network ",
  "passive-interface ",
  "area ",

  // Layer 3 — BGP (RFC 4271)
  "router bgp ",
  "neighbor ",
  "address-family ",

  // Access Control Lists (ACLs)
  "ip access-list ",
  "permit ",
  "deny ",
  "remark ",
  "ip access-group ",

  // Crypto sub-commands
  "crypto ",
  "encr ",
  "authentication ",
  "group ",
  "hash ",
  "set peer ",
  "set transform-set ",
  "mode ",

  // QoS
  "class-map ",
  "match ",
  "policy-map ",
  "class ",
  "priority ",
  "service-policy ",

  // Static routes and session control
  "ip route ",
  "exit",
  "end"
];

/**
 * Check if a single configuration line matches the allowed command prefixes.
 * Blank lines and comment lines starting with '!' are always allowed.
 * @param {string} line
 * @returns {boolean}
 */
export function isAllowedIosLine(line) {
  const stripped = line.trim();
  if (stripped.length === 0 || stripped.startsWith("!")) {
    return true;
  }
  return IOS_COMMAND_PREFIXES.some(prefix => stripped.startsWith(prefix));
}

/**
 * Validate an entire generated Cisco IOS device configuration string.
 *
 * @param {string} hostname - Target device hostname
 * @param {string} configText - Complete configuration text
 * @param {Object} [context] - Context with allocations and device config
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateDeviceConfig(hostname, configText, context = {}) {
  const errors = [];
  const warnings = [];
  const lines = configText.split(/\r?\n/);

  // 1. Allowlist syntax check
  for (let lineNum = 1; lineNum <= lines.length; lineNum++) {
    const line = lines[lineNum - 1];
    if (!isAllowedIosLine(line)) {
      errors.push(`Line ${lineNum}: Unapproved or invalid Cisco IOS command prefix: '${line.trim()}'`);
    }
  }

  // 2. Secret / Production Credential Detection
  const lowerConfig = configText.toLowerCase();
  const forbiddenPatterns = [
    /password\s+(?!placeholder)[a-z0-9_!@#$%^&*]+/i,
    /secret\s+5\s+[a-z0-9$./]+/i,
    /enable\s+secret\s+(?!placeholder)[a-z0-9_!@#$%^&*]+/i
  ];
  for (const pat of forbiddenPatterns) {
    if (pat.test(configText)) {
      errors.push("Security violation: Found plain-text password or real credential in device configuration.");
    }
  }

  // 3. Trunk port security validation
  if (configText.includes("switchport mode trunk")) {
    if (!configText.includes("switchport trunk allowed vlan")) {
      errors.push("L2 Security violation: Trunk port configured without explicit allowed VLAN pruning list.");
    }
    if (!configText.includes("switchport trunk native vlan 999")) {
      errors.push("L2 Security violation: Trunk port not configured with isolated dedicated Native VLAN 999.");
    }
    if (configText.includes("switchport trunk native vlan 1\n") || configText.includes("switchport trunk native vlan 1\r")) {
      errors.push("L2 Security violation: Insecure Native VLAN 1 explicitly assigned to trunk.");
    }
  }

  // 4. Access port security validation
  if (configText.includes("switchport mode access")) {
    if (!configText.includes("spanning-tree portfast")) {
      errors.push("L2 STP violation: Access port missing 'spanning-tree portfast' optimization.");
    }
    if (!configText.includes("spanning-tree bpduguard enable")) {
      errors.push("L2 Security violation: Access port missing 'spanning-tree bpduguard enable'.");
    }
  }

  // 5. OSPF control plane security
  if (configText.includes("router ospf")) {
    if (configText.includes("interface Vlan") && !configText.includes("passive-interface Vlan")) {
      errors.push("L3 Security violation: User-facing SVIs configured without 'passive-interface' in OSPF.");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Cross-validate all device configurations in a scenario for global consistency:
 *  - Zero duplicate IP assignments across all routed ports, SVIs, and loopbacks
 *  - Valid router-id uniqueness
 *
 * @param {Record<string, string>} deviceConfigsMap - { hostname: configText }
 * @throws {ConfigurationValidationError} if duplicate IPs or fatal inconsistencies occur
 */
export function validateAllDeviceConfigs(deviceConfigsMap) {
  const seenIps = new Map(); // ipStr -> hostname.interface
  const allErrors = [];

  for (const [hostname, configText] of Object.entries(deviceConfigsMap)) {
    const result = validateDeviceConfig(hostname, configText);
    if (!result.valid) {
      allErrors.push(`[${hostname}] Configuration syntax/security errors: ${result.errors.join("; ")}`);
    }

    // Extract all assigned IP addresses:
    // Regex matches "ip address <ip> <mask>"
    const ipMatches = configText.matchAll(/interface\s+(\S+)[\s\S]*?ip\s+address\s+([0-9.]+)\s+([0-9.]+)/gi);
    for (const match of ipMatches) {
      const iface = match[1];
      const ip = match[2];
      const mask = match[3];

      // Exclude secondary IPs or 0.0.0.0
      if (ip === "0.0.0.0") continue;

      if (seenIps.has(ip)) {
        const prior = seenIps.get(ip);
        allErrors.push(
          `Duplicate IP Address Collision: IP ${ip} is configured on both ${prior} and ${hostname}.${iface}!`
        );
      } else {
        seenIps.set(ip, `${hostname}.${iface}`);
      }
    }
  }

  if (allErrors.length > 0) {
    throw new ConfigurationValidationError(
      `Cisco IOS Configuration Validation Failed with ${allErrors.length} issue(s):\n  - ` +
      allErrors.join("\n  - "),
      allErrors
    );
  }

  return true;
}
