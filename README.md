# NetArchitect
**Deterministic Network Design Engine & Cisco IOS Configuration Generator**  
*Version:* 2.0.0 (Node.js ES Modules)  
*License:* MIT  

---

## 1. Project Overview

**NetArchitect** is an automated, standards-driven network design compiler and verification engine. It translates high-level enterprise scenario specifications (formatted as structured JSON topologies) into mathematically verified IPv4 Variable Length Subnet Masking (VLSM) plans, physical transmission media selections with optical power loss calculations, topology-driven routing hierarchies (Single-Area OSPF, Multi-Area OSPF, and eBGP), and fully security-hardened Cisco IOS / IOS-XE device configurations.

Every design choice produced by NetArchitect is backed by governing IEEE standards (802.3an, 802.3ae, 802.1Q, 802.1w), IETF RFCs (RFC 1918, RFC 2328, RFC 3021, RFC 4271, RFC 4301, RFC 4632, RFC 6996), and optical attenuation physics (ITU-T G.652).

---

## 2. Problem Statement

Enterprise network infrastructure design often suffers from several critical failure modes:

1. **Subnetting Calculation Errors:** Manual or naive 32-bit integer VLSM arithmetic frequently introduces subnet overlaps, unaligned network boundaries, and wasted address capacity.
2. **Physical Layer Mismatches:** Selecting copper cabling beyond channel limits (causing alien crosstalk and excessive bit error rates) or deploying optical transceivers without calculating power budgets and splice attenuation leads to signal starvation.
3. **AI Syntax Hallucinations:** Generative AI tools frequently emit fatal syntax errors—such as outputting standard subnet masks into Cisco OSPF `network` statements instead of bitwise inverted wildcard masks, omitting access port PortFast/BPDU Guard hardening, or leaving trunk links on default Native VLAN 1.
4. **Configuration Drift:** Disconnected IP spreadsheets and manual CLI scripts create divergences between documented architecture and deployed device states.

NetArchitect resolves these issues by serving as an independent, deterministic compiler that cross-validates the entire network topology end-to-end.

---

## 3. Key Capabilities

- **64-bit BigInt IPv4 Mathematics:** Built on native JavaScript `BigInt` bitwise operations for all subnet, mask, wildcard, gateway, broadcast, containment, and overlap calculations, eliminating 32-bit signed integer overflow.
- **Deterministic Physical Media Selection:**
  - **Cat6a UTP Copper:** Selected for links $\le 100\text{ m}$ per IEEE 802.3an (10GBASE-T). Explicit copper requests $> 100\text{ m}$ immediately throw `PhysicalDistanceViolationError`.
  - **OM4 Multimode Fiber (MMF):** Selected for distances $101\text{ m} - 400\text{ m}$ per IEEE 802.3ae (10GBASE-SR, $850\text{ nm}$ VCSEL).
  - **OS2 Single-Mode Fiber (SMF):** Selected for distances $401\text{ m} - 80\text{ km}$ per ITU-T G.652. Automatically evaluates optical power loss budgets across 10GBASE-LR ($1310\text{ nm}$), 10GBASE-ER ($1550\text{ nm}$), and 10GBASE-ZR ($1550\text{ nm}$) optics.
  - **Carrier WAN Transit:** Links exceeding $80\text{ km}$ dark fiber limits are compiled as Carrier Ethernet / IPsec VPN circuits per RFC 4301.
- **Topology-Aware Routing Architecture:**
  - Evaluates site counts, autonomous domains, subnet scales, and external cloud VPC links.
  - Generates Single-Area OSPF (Area 0 Backbone) for single-domain enterprise environments ($< 50$ subnets).
  - Generates Hierarchical Multi-Area OSPF (RFC 2328) with Area Border Router (ABR) route summarization via `area range`.
  - Generates eBGP (RFC 4271, RFC 6996) for peering between on-premises private ASNs (e.g. 65001) and cloud provider ASNs (e.g. 65010).
- **Security-Hardened Cisco IOS Generation:**
  - Generates per-device configuration files with zero duplicate IP collisions.
  - Layer 2 Security: Isolated Native VLAN 999, explicit trunk allowed lists (pruning), access port `spanning-tree portfast`, `spanning-tree bpduguard enable`, and PoE (`power inline auto`) on supported access ports.
  - Layer 3 Security: Client-facing SVIs and EVPL subinterfaces enforced with `passive-interface` in OSPF to prevent control-plane adjacency hijacking.
  - Security ACLs: Extended ACLs denying student/lab segments access to administrative and server infrastructure.
  - Metro MAN QoS: Strict priority queuing (`priority percent 30`) on egress interfaces for DSCP EF traffic.
  - IPsec VPN: Crypto ISAKMP policies, transform sets, and crypto maps for inter-city links.
- **Automated Configuration Validation & Security Audit:**
  - Built-in Cisco IOS parser validates generated lines against strict command allowlists.
  - Audits configurations for leaked secrets and plain-text passwords.
  - Detects duplicate IP address collisions across all devices and interfaces.

---

## 4. Technology Stack

- **Runtime:** Node.js $\ge 20.0.0$ (ES Modules)
- **Language:** Modern JavaScript (Node.js native built-ins: `node:fs`, `node:path`, `node:url`, `node:util`, `node:process`, `node:os`)
- **Arithmetic:** Native `BigInt` bitwise operations for 32-bit IPv4 address space
- **Testing:** Native Node.js test runner (`node:test`, `node:assert/strict`)
- **Dependencies:** **Zero external runtime or testing dependencies** (no npm packages required)

---

## 5. Repository Structure

```text
NetArchitect/
├── LICENSE                         # MIT License
├── package.json                    # Project metadata and npm scripts
├── README.md                       # Project entry point and documentation
├── presets/                        # Built-in network scenario definitions
│   ├── campus.json                 # Campus LAN scenario (1,600 endpoints)
│   ├── metro.json                  # Metro MAN scenario (450 users + 100 colo)
│   └── wan.json                    # Global WAN scenario (2,000 IoT + Cloud VPC)
├── exports/                        # Generated network deliverables
│   ├── campus/                     # Campus LAN configs and audit reports
│   ├── metro/                      # Metro MAN configs and audit reports
│   └── wan/                        # Global WAN configs and audit reports
├── src/                            # Core implementation modules
│   ├── cli/
│   │   ├── commands.js             # CLI handlers and pipeline orchestrator
│   │   └── index.js                # CLI router and direct invocation entry
│   ├── config/
│   │   ├── generator.js            # Cisco IOS configuration generator
│   │   └── ios-validator.js        # Cisco IOS command allowlist & security auditor
│   ├── core/
│   │   ├── constants.js            # Physical constants, IEEE/RFC limits, optics
│   │   ├── errors.js               # Custom error hierarchy
│   │   ├── models.js               # Domain data models (Scenario, Device, Link, etc.)
│   │   └── validation.js           # Scenario schema and topology validator
│   ├── engines/
│   │   ├── media.js                # Physical media & optical budget engine
│   │   ├── routing.js              # Topology-aware routing engine (OSPF/eBGP)
│   │   └── vlsm.js                 # Flat & hierarchical BigInt VLSM allocator
│   ├── output/
│   │   ├── explainer.js            # Markdown rationale & CSV allocation builder
│   │   └── exporter.js             # Disk exporter and artifact manager
│   └── utils/
│       └── ip-address.js           # IPv4 mathematical utilities (BigInt CIDR)
├── tests/                          # Test suites (54 tests, 10 suites)
│   ├── config/
│   │   ├── generator.test.js       # Cisco IOS config generation tests
│   │   └── validator.test.js       # Allowlist & security audit tests
│   ├── core/
│   │   ├── ip-address.test.js      # BigInt math & 33 prefixes oracle tests
│   │   └── validation.test.js      # Scenario validation logic tests
│   ├── engines/
│   │   ├── media.test.js           # Media selection & optical budget tests
│   │   ├── routing.test.js         # Topology routing engine tests
│   │   └── vlsm.test.js            # VLSM unit & 1,000 randomized Monte Carlo tests
│   ├── helpers/ 
│   │   └── ip-oracle.js            # Independent mathematical reference model
│   ├── integration/
│   │   ├── cli.test.js             # CLI integration tests
│   │   └── presets.test.js         # End-to-end preset pipelines verification
│   └── output/
│       └── exporter.test.js        # Disk deliverable generator tests
└── docs/                           # Comprehensive technical documentation
│   ├── technical_documentation.md  # In-depth architectural & engine specifications
│   ├── testing_and_verification.md # Test methodology, coverage & verification audit
└── ai_audit_log.md                 # Mandatory academic AI code audit and defense
```

---

## 6. Installation & Setup

### Prerequisites
- Node.js $\ge 20.0.0$ installed.
- No external packages or package managers beyond Node.js are needed.

### Clone and Run
```bash
# Run full test suite
npm test

# Run CLI presets list
npm start presets
```

---

## 7. CLI Usage & Examples

NetArchitect provides a unified command-line interface.

### Display Help
```bash
node src/cli/index.js --help
```
Output:
```text
NetArchitect v2.0 — Automated Network Design & Cisco IOS Configuration Generator
Course: CIC-307 Computer Networks Mini-Project

Usage:
  netarchitect presets
  netarchitect run --preset <campus|metro|wan> [--out <dir>]
  netarchitect run --custom <scenario.json> [--out <dir>]
  netarchitect validate --custom <scenario.json>

Commands:
  presets                  List all built-in network design presets
  run                      Execute complete physical media, VLSM, routing & config pipeline
  validate                 Validate scenario constraints and RFC compliance without export

Options:
  --preset <name>          Use a built-in scenario (campus, metro, wan)
  --custom <path>          Path to a custom JSON scenario file
  --out <dir>              Output directory for generated deliverables (default: out)
  -h, --help               Display this help guide
  -v, --version            Display version information
```

### List Available Presets
```bash
node src/cli/index.js presets
```

### Run a Built-In Preset Pipeline
```bash
# Execute Campus LAN pipeline and export deliverables into exports/
node src/cli/index.js run --preset campus --out exports

# Execute Metro MAN pipeline
node src/cli/index.js run --preset metro --out exports

# Execute Global WAN pipeline
node src/cli/index.js run --preset wan --out exports
```

### Validate a Custom Scenario
```bash
node src/cli/index.js validate --custom presets/campus.json
```

---

## 8. Available Built-In Presets

| Preset Name | Description | Key Infrastructure | Routing | Endpoints |
| :--- | :--- | :--- | :--- | :--- |
| **`campus`** | St. Jude University Campus LAN across 3 buildings | 3 Layer 3 Switches (`CORE-ADMIN`, `DIST-SCIENCE`, `DIST-RESI`), OM4 MMF (180 m, 250 m, 360 m) | Single-Area OSPF (Area 0 Backbone) | **1,600 endpoints** across 8 VLANs + PoE + Rapid-PVST Root |
| **`metro`** | Apex Financial Metro MAN across 3 city sites | 3 Routers (`RTR-FINTECH-HQ`, `RTR-BRANCH-EAST`, `RTR-BRANCH-WEST`), OS2 SMF (18.5 km, 24 km, 32 km), 10GBASE-ER/ZR | Single-Area OSPF (Area 0) | **450 user endpoints** + 100 colo servers + EVPL subinterfaces + QoS Voice EF |
| **`wan`** | TransGlobal Logistics Global WAN across 4 cities | 4 Routers (`RTR-DELHI`, `RTR-MUMBAI`, `RTR-BENGALURU`, `RTR-CHENNAI`), Carrier WAN circuits ($> 1,000\text{ km}$) with IPsec | Multi-Area OSPF (Areas 0–3) + eBGP (AS 65001 $\leftrightarrow$ 65010) | **2,000 IoT endpoints** + 200 srv/mgmt + AWS Cloud VPC (`10.200.0.0/16`) |

---

## 9. Generated Output Artifacts

Running `node src/cli/index.js run --preset <name> --out exports` produces a directory under `exports/<name>/` containing:

1. `full_config.txt`: Merged, deployment-ready Cisco IOS configuration script for all devices.
2. `<name>_full_config.txt`: Identical named copy for archiving and script compatibility.
3. `configs/<device>.txt`: Individual configuration files partitioned per device (e.g., `CORE-ADMIN.txt`).
4. `rationale.md`: Comprehensive engineering design rationale documenting every physical media, VLSM, routing, and security decision with RFC/IEEE citations and alternatives considered.
5. `allocation.csv`: Machine-readable IP allocation table listing network addresses, CIDR prefix lengths, subnet masks, wildcards, usable host ranges, gateways, broadcast addresses, and space efficiency percentages.
6. `summary.json`: High-level metrics JSON capturing topology, subnet counts, efficiency, and link loss budgets.
7. `verification.json`: Security audit record documenting automated syntax allowlist validation, duplicate IP checks, and compliance status (`status: "PASS"`).

---

## 10. Test Execution

NetArchitect utilizes Node.js's native test runner without third-party frameworks:

```bash
npm test
```

Expected output:
```text
> netarchitect@2.0.0 test
> node --test

▶ Cisco IOS Configuration Generator & Compliance (3 tests)
✔ Cisco IOS Configuration Generator & Compliance
▶ Cisco IOS Validator & Security Audit (5 tests)
✔ Cisco IOS Validator & Security Audit
▶ IPv4 BigInt Address Utilities (6 tests)
✔ IPv4 BigInt Address Utilities
▶ Scenario Validation Logic (9 tests)
✔ Scenario Validation Logic
▶ Physical Media Selection Engine (10 tests)
✔ Physical Media Selection Engine
▶ Topology-Aware Routing Engine (4 tests)
✔ Topology-Aware Routing Engine
▶ IPv4 & VLSM Engine Unit & Stress Tests (6 tests, including 1,000 Monte Carlo trials)
✔ IPv4 & VLSM Engine Unit & Stress Tests
▶ Command-Line Interface Integration Tests (7 tests)
✔ Command-Line Interface Integration Tests
▶ End-to-End Presets Integration Verification (3 tests)
✔ End-to-End Presets Integration Verification
▶ Exporter & Deliverables Generator (1 test)
✔ Exporter & Deliverables Generator

ℹ tests 54
ℹ suites 10
ℹ pass 54
ℹ fail 0
```
---

## 12. License & Attribution

- **License:** MIT License (see [LICENSE](LICENSE)).
- **Coursework:** Developed for **CIC-307 Computer Networks** at Maharaja Agrasen Institute of Technology.
- **Authors:** Yojit Jindal, Ayush Aggarwal

