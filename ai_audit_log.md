# NetArchitect — AI Code Audit & Defense Log
**Implementation:** JavaScript / Node.js (Current Codebase)  

---

## 1. Audit Case 1 — Flawed Bitwise Subnet Wildcard Mask Inversion in Cisco OSPF Configuration

### 1.1 Original Generative Prompt
> *"Generate dynamic Cisco IOS XE OSPF router configuration statements for a list of allocated VLSM subnets, calculating the network address and mask for each."*

### 1.2 Flawed AI-Generated Code Snippet
```javascript
// Flawed AI Code: Injected standard subnet mask instead of bitwise inverted wildcard
function generateOspfNetworkStatement(subnetIp, prefixLength) {
  const netmask = cidrToNetmask(prefixLength);
  
  // Bug: Direct injection of dotted-decimal subnet mask into OSPF network command
  return `network ${subnetIp} ${netmask} area 0`;
}

// Example emitted for a /23 subnet (10.10.4.0/23):
// "network 10.10.4.0 255.255.254.0 area 0"
```

### 1.3 The Technical Defect
In Cisco IOS / IOS-XE syntax:
$$\text{Syntax:} \quad \texttt{network <network-ip> <wildcard-mask> area <area-id>}$$
The parameter following the network IP address is an **inverted wildcard mask** (host mask), **never** a standard dotted-decimal subnet mask. Subnet masks are only accepted in interface definitions (`ip address <ip> <mask>`) or BGP network statements (`network <ip> mask <mask>`).

### 1.4 Why the Defect Is Dangerous (Packet-Flow & Protocol Analysis)
When `network 10.10.4.0 255.255.254.0 area 0` is applied to a Cisco router:
1. **Bitwise Match Inversion:** In Cisco wildcard mask evaluation, binary `0` means *"must match interface bit"* while binary `1` means *"do not care"*.
2. **Catastrophic Wildcard Match:** In binary, `255.255.254.0` is:
   $$\texttt{11111111 . 11111111 . 11111110 . 00000000}$$
   Because the first two octets are all `1`s, the router treats octets 1 and 2 as *"do not care"*. The statement matches any interface whose fourth octet is `0` and third octet has an even value in bit 0, across **any IPv4 network**.
3. **Control-Plane Topology Leak:** Interfaces intended to remain isolated (such as public WAN perimeter interfaces or isolated DMZ links) inadvertently match the wildcard, participate in OSPF hello multicasts (`224.0.0.5`), form unauthorized adjacencies, and leak interior routing topologies to untrusted transit networks.
4. **JavaScript Signed Integer Bug:** Standard JavaScript bitwise NOT `~` operates on 32-bit signed two's complement integers. Inverting `0xFFFFFF00` produces `-4294967041` unless native `BigInt` or unsigned zero- l shifts are used.

### 1.5 Corrected Implementation in NetArchitect
In [`src/utils/ip-address.js`]:
```javascript
export function maskToWildcardBigInt(maskBigInt) {
  // Invert mask and constrain to 32-bit unsigned boundaries
  return (~maskBigInt) & 0xFFFFFFFFn;
}
```
And in [`src/config/generator.js`]:
```javascript
// Generates: network 10.10.4.0 0.0.1.255 area 0
lines.push(` network ${net.network} ${net.wildcard} area ${net.area}`);
```

### 1.6 Test Bench Validation & Mutation Defense
In [`tests/core/ip-address.test.js`]:
```javascript
test("Mutation test: failing to invert mask breaks wildcard detection", () => {
  // Simulates AI defect: omitted bitwise inversion ~
  const mutatedMaskToWildcard = (maskBigInt) => maskBigInt & 0xFFFFFFFFn;
  const mask24 = prefixToMaskBigInt(24);
  const mutatedWildcard = mutatedMaskToWildcard(mask24);
  const mutatedWildcardStr = bigIntToIp(mutatedWildcard);

  // Expected valid wildcard for /24 is 0.0.0.255
  assert.notEqual(mutatedWildcardStr, "0.0.0.255");
  assert.equal(mutatedWildcardStr, "255.255.255.0");
});
```

---

## 2. Audit Case 2 — Optical Dispersion & Modal Reach Hallucination Beyond Physical Limits

### 2.1 Original Generative Prompt
> *"Recommend the most cost-effective physical media and transceiver for an inter-site link of 1,800 m running at 10 Gbps."*

### 2.2 Flawed AI-Generated Code Snippet
```javascript
// Flawed AI Code: Recommended OM4 Multimode Fiber for an 1,800 m 10G link
function selectPhysicalMedia(distanceMeters) {
  if (distanceMeters <= 100) {
    return { medium: "Cat6a UTP", standard: "10GBASE-T" };
  } else if (distanceMeters <= 2000) {
    // Hallucination: Claimed OM4 MMF can transmit 10 Gbps over 2 km with 1310 nm optics
    return { medium: "OM4 MMF", standard: "10GBASE-LR", wavelength: "1310nm" };
  } else {
    return { medium: "OS2 SMF", standard: "10GBASE-ER" };
  }
}
```

### 2.3 The Technical Defect
This recommendation violates fundamental optical fiber physics and international telecommunications standards (IEEE 802.3ae and ISO/IEC 11801):
1. **Modal Dispersion Limit of OM4 MMF:** OM4 is a 50/125 $\mu\text{m}$ graded-index multimode fiber engineered specifically for $850\text{ nm}$ VCSEL optics (`10GBASE-SR`). Its standardized Effective Modal Bandwidth is $4,700\,\text{MHz}\cdot\text{km}$. At 10 Gbps, Differential Mode Delay (DMD) strictly limits OM4 reach to **400 meters**. Beyond 400 m, pulse spreading causes severe Inter-Symbol Interference (ISI), resulting in total physical layer signal collapse.
2. **Wavelength and Fiber Core Mismatch:** The AI hallucinated pairing `10GBASE-LR` ($1310\text{ nm}$) with OM4 multimode fiber. `10GBASE-LR` is engineered exclusively for $9/125\,\mu\text{m}$ single-mode glass. Launching a single-mode laser into a $50\,\mu\text{m}$ multimode core induces catastrophic modal noise, Differential Mode Delay, and excessive coupling loss, violating IEEE 802.3 Clause 52.

### 2.4 Why the Defect Is Dangerous & Physics Proof
To transmit over 1,800 m (1.8 km) at 10 Gbps, **OS2 Single-Mode Fiber (SMF)** is physically mandatory. OS2 confines optical propagation to the fundamental $HE_{11}$ spatial mode, completely eliminating modal dispersion.

Furthermore, an optical power budget calculation is required:
- `10GBASE-LR` at $1310\text{ nm}$ on OS2:
  - Budget: $\text{Tx}_{\min} (-8.2\text{ dBm}) - \text{Rx}_{\text{sens}} (-14.4\text{ dBm}) = 6.20\text{ dB}$.
  - Channel Loss at 1.8 km: $(1.8 \times 0.35) + 2.0\text{ dB (connectors)} + 2.0\text{ dB (safety)} = 4.63\text{ dB}$.
  - Net Margin: $6.20 - 4.63 = \mathbf{+1.57\text{ dB}}$ (Positive margin guarantees signal integrity).

### 2.5 Corrected Implementation in NetArchitect
In [`src/engines/media.js`]
// 1. Cat6a Copper boundary: <= 100 m (IEEE 802.3an)
if (distance <= COPPER_MAX_DISTANCE_M) {
  return selectCat6a(linkA, linkB, distance);
}

// 2. OM4 MMF boundary: 101 m to 400 m (IEEE 802.3ae)
if (distance <= MMF_OM4_MAX_DISTANCE_M) {
  return selectOm4Mmf(linkA, linkB, distance);
}

// 3. Beyond 400 m: OS2 SMF mandatory with calculated loss budget
return selectOs2SmfWithBudget(linkA, linkB, distance);
```

### 2.6 Test Bench Validation
In [`tests/engines/media.test.js`]
- Asserts OM4 Multimode Fiber is selected at boundary conditions 101 m and 400 m.
- Asserts OS2 Single-Mode Fiber is selected at 401 m.
- Asserts explicit copper requests beyond 100 m throw `PhysicalDistanceViolationError`.

---

## 3. Audit Case 3 — Unconstrained 802.1Q Switchport Trunking Security Vulnerability

### 3.1 Original Generative Prompt
> *"Generate Cisco IOS switchport configuration for interconnecting distribution switches."*

### 3.2 Flawed AI-Generated Code Snippet
```text
! Flawed AI-generated trunk port configuration
interface GigabitEthernet0/1
 switchport mode trunk
 no shutdown
```

### 3.3 The Technical Defect & Security Vulnerabilities
While accepted syntactically by Cisco IOS, omitting explicit trunk filtering creates two severe enterprise security vulnerabilities:

1. **VLAN Hopping (CVE-2001-0860 & Double Tagging):**
   By default in Cisco IOS, a bare `switchport mode trunk` assigns untagged frames to **Native VLAN 1** and allows **all VLANs (1–4094)** across the link. An attacker on an access port in VLAN 1 can craft double-tagged 802.1Q frames (outer tag VLAN 1, inner tag VLAN 30 Management). When the first switch strips the outer tag because it matches Native VLAN 1, the frame traverses the trunk and the second switch forwards the payload into the sensitive management VLAN, bypassing Layer 3 firewall inspection.
2. **Broadcast / Multicast / Unknown Unicast (BUM) Storm Propagation:**
   Without explicit VLAN allowlist pruning (`switchport trunk allowed vlan`), broadcast and multicast traffic from high-chatter subnets (such as student residence halls or CCTV streams) flood across core trunk links into academic server farms, saturating switch backplanes and TCAM buffers.

### 3.4 Corrected Implementation in NetArchitect
In [`src/config/generator.js`]:
```
! Hardened NetArchitect Cisco IOS configuration
interface GigabitEthernet0/1
 description Trunk to DIST-SCIENCE
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30,40,50,60,70,80
 switchport trunk native vlan 999
 no shutdown
```
Enforces:
1. **Explicit VLAN Pruning:** Restricting trunk transport strictly to VLANs active on connected switches.
2. **Dedicated Native VLAN 999:** Moving native untagged frames away from VLAN 1 to an isolated, unrouted native VLAN.
3. **Static Trunking:** Disabling DTP dynamic negotiation.

### 3.5 Test Bench Validation & Security Audit
In [`tests/config/validator.test.js`]
```javascript
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
```

---