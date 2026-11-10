import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  isAllowedIosLine,
  validateDeviceConfig,
  validateAllDeviceConfigs
} from "../../src/config/ios-validator.js";
import { ConfigurationValidationError } from "../../src/core/errors.js";

describe("Cisco IOS Validator & Security Audit", () => {
  test("Detects unauthorized and hallucinated command lines", () => {
    assert.equal(isAllowedIosLine("hostname R1"), true);
    assert.equal(isAllowedIosLine("vlan 10"), true);
    assert.equal(isAllowedIosLine("! comment line"), true);
    assert.equal(isAllowedIosLine(""), true);

    // Forbidden / hallucinated / unknown commands
    assert.equal(isAllowedIosLine("configure terminal"), false);
    assert.equal(isAllowedIosLine("system-view"), false); // Huawei command
    assert.equal(isAllowedIosLine("set interfaces ge-0/0/0 unit 0"), false); // Junos command
    assert.equal(isAllowedIosLine("apt-get install nginx"), false); // Linux command
  });

  test("Catches trunk security violations (missing allowed list or native vlan 1)", () => {
    const badTrunkConfig = `
hostname SW1
interface GigabitEthernet0/1
 switchport mode trunk
 no shutdown
end
`;
    const res = validateDeviceConfig("SW1", badTrunkConfig);
    assert.equal(res.valid, false);
    assert.ok(res.errors.some(e => e.includes("Trunk port configured without explicit allowed VLAN")));
    assert.ok(res.errors.some(e => e.includes("dedicated Native VLAN 999")));
  });

  test("Catches access port security violations (missing PortFast or BPDU Guard)", () => {
    const badAccessConfig = `
hostname SW1
interface GigabitEthernet1/0/1
 switchport mode access
 switchport access vlan 10
 no shutdown
end
`;
    const res = validateDeviceConfig("SW1", badAccessConfig);
    assert.equal(res.valid, false);
    assert.ok(res.errors.some(e => e.includes("spanning-tree portfast")));
    assert.ok(res.errors.some(e => e.includes("spanning-tree bpduguard enable")));
  });

  test("Catches plain-text password or leaked secret in configuration", () => {
    const secretLeakConfig = `
hostname SW1
enable secret cisco123
end
`;
    const res = validateDeviceConfig("SW1", secretLeakConfig);
    assert.equal(res.valid, false);
    assert.ok(res.errors.some(e => e.includes("Security violation: Found plain-text password")));
  });

  test("Catches duplicate IP address collision across devices", () => {
    const devConfigs = {
      "RTR-1": `
hostname RTR-1
interface GigabitEthernet0/1
 ip address 10.10.1.1 255.255.255.0
 no shutdown
end
`,
      "RTR-2": `
hostname RTR-2
interface GigabitEthernet0/1
 ip address 10.10.1.1 255.255.255.0
 no shutdown
end
`
    };

    assert.throws(
      () => validateAllDeviceConfigs(devConfigs),
      ConfigurationValidationError
    );
  });
});

