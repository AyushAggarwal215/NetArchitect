# NetArchitect Design Rationale — METRO Profile

**Course:** CIC-307 Computer Networks Mini-Project  
**Architecture:** Independent Node.js Deterministic Network Engineering Engine  
**Timestamp:** 2026-11-10T09:33:46.758Z

---

## 1. Executive Summary Table

| # | Domain | Subject | Decision / Choice | Governing Standards |
|---|---|---|---|---|
| 1 | `MEDIA` | Link FinTech-HQ-Branch-East (18.50 km) | **OS2 SMF, 10GBASE-ER (1550 nm, 40 km reach)** | IEEE 802.3ae, ITU-T G.652 |
| 2 | `QOS` | Link FinTech-HQ-Branch-East Metro Latency SLA | **FEASIBLE: 1.09 ms one-way delay** | IEEE 802.3ae |
| 3 | `MEDIA` | Link FinTech-HQ-Branch-West (32.00 km) | **OS2 SMF, 10GBASE-ZR (1550 nm, 80 km reach)** | Vendor-specific typical / SFF-8431, ITU-T G.652 |
| 4 | `QOS` | Link FinTech-HQ-Branch-West Metro Latency SLA | **FEASIBLE: 1.16 ms one-way delay** | IEEE 802.3ae |
| 5 | `MEDIA` | Link Branch-East-Branch-West (24.00 km) | **OS2 SMF, 10GBASE-ZR (1550 nm, 80 km reach)** | Vendor-specific typical / SFF-8431, ITU-T G.652 |
| 6 | `QOS` | Link Branch-East-Branch-West Metro Latency SLA | **FEASIBLE: 1.12 ms one-way delay** | IEEE 802.3ae |
| 7 | `VLSM` | Subnet allocation ordering | **Descending order by block size (RFC 4632)** | RFC 4632 |
| 8 | `VLSM` | HQ-Trading-Users (FinTech-HQ) | **172.16.0.0/24** | RFC 4632 |
| 9 | `VLSM` | Colo-Trading-Servers (FinTech-HQ) | **172.16.1.0/25** | RFC 4632 |
| 10 | `VLSM` | East-Branch-Users (Branch-East) | **172.16.1.128/25** | RFC 4632 |
| 11 | `VLSM` | West-Branch-Users (Branch-West) | **172.16.2.0/25** | RFC 4632 |
| 12 | `VLSM` | P2P-Branch-East-Branch-West (Branch-East) | **172.16.2.128/30** | RFC 4632 |
| 13 | `VLSM` | P2P-FinTech-HQ-Branch-East (FinTech-HQ) | **172.16.2.132/30** | RFC 4632 |
| 14 | `VLSM` | P2P-FinTech-HQ-Branch-West (FinTech-HQ) | **172.16.2.136/30** | RFC 4632 |
| 15 | `VLSM` | Lo0-RTR-BRANCH-EAST (Branch-East) | **172.16.2.140/32** | RFC 4632 |
| 16 | `VLSM` | Lo0-RTR-BRANCH-WEST (Branch-West) | **172.16.2.141/32** | RFC 4632 |
| 17 | `VLSM` | Lo0-RTR-FINTECH-HQ (FinTech-HQ) | **172.16.2.142/32** | RFC 4632 |
| 18 | `VLSM` | VLSM allocation summary | **10 subnets, 87.2% address space efficiency** | RFC 4632 |
| 19 | `ROUTING` | Intra-Domain Interior Gateway Protocol | **Single-Area OSPF (Area 0 Backbone)** | RFC 2328 |
| 20 | `SECURITY` | Device RTR-FINTECH-HQ | **Generated Cisco IOS Configuration (93 lines)** | IEEE 802.1Q, IEEE 802.1w, RFC 2328 |
| 21 | `SECURITY` | Device RTR-BRANCH-EAST | **Generated Cisco IOS Configuration (73 lines)** | IEEE 802.1Q, IEEE 802.1w, RFC 2328 |
| 22 | `SECURITY` | Device RTR-BRANCH-WEST | **Generated Cisco IOS Configuration (73 lines)** | IEEE 802.1Q, IEEE 802.1w, RFC 2328 |

---

## 2. Technical Engineering Decisions by Domain

### MEDIA Domain Decisions

#### [MEDIA-003] Link FinTech-HQ-Branch-East (18.50 km)
- **Selected Choice:** `OS2 SMF, 10GBASE-ER (1550 nm, 40 km reach)`
- **Technical Justification:** Selected OS2 Single-Mode Fiber (10GBASE-ER, 1550 nm) because distance (18500 m = 18.50 km) exceeds the 400 m modal bandwidth limit of OM4 MMF. Optical Power Budget: 11.1 dB (Tx_min -4.7 dBm - Rx_sens -15.8 dBm). Total Channel Loss: 9.53 dB (fiber attenuation 4.63 dB + connectors 2 dB + splices 0.9 dB + safety margin 2 dB). Net Link Margin: +1.58 dB (positive margin guarantees error-free reception).
- **Applicable Standards:** IEEE 802.3ae, ITU-T G.652
- **Alternative Considered:** 10GBASE-LR
- **Reason for Rejection:** Insufficient optical power budget / negative margin for the required link distance.

#### [MEDIA-003] Link FinTech-HQ-Branch-West (32.00 km)
- **Selected Choice:** `OS2 SMF, 10GBASE-ZR (1550 nm, 80 km reach)`
- **Technical Justification:** Selected OS2 Single-Mode Fiber (10GBASE-ZR, 1550 nm) because distance (32000 m = 32.00 km) exceeds the 400 m modal bandwidth limit of OM4 MMF. Optical Power Budget: 24 dB (Tx_min 0 dBm - Rx_sens -24 dBm). Total Channel Loss: 13.6 dB (fiber attenuation 8 dB + connectors 2 dB + splices 1.6 dB + safety margin 2 dB). Net Link Margin: +10.4 dB (positive margin guarantees error-free reception).
- **Applicable Standards:** Vendor-specific typical / SFF-8431, ITU-T G.652
- **Alternative Considered:** 10GBASE-ER
- **Reason for Rejection:** Insufficient optical power budget / negative margin for the required link distance.

#### [MEDIA-003] Link Branch-East-Branch-West (24.00 km)
- **Selected Choice:** `OS2 SMF, 10GBASE-ZR (1550 nm, 80 km reach)`
- **Technical Justification:** Selected OS2 Single-Mode Fiber (10GBASE-ZR, 1550 nm) because distance (24000 m = 24.00 km) exceeds the 400 m modal bandwidth limit of OM4 MMF. Optical Power Budget: 24 dB (Tx_min 0 dBm - Rx_sens -24 dBm). Total Channel Loss: 11.2 dB (fiber attenuation 6 dB + connectors 2 dB + splices 1.2 dB + safety margin 2 dB). Net Link Margin: +12.8 dB (positive margin guarantees error-free reception).
- **Applicable Standards:** Vendor-specific typical / SFF-8431, ITU-T G.652
- **Alternative Considered:** 10GBASE-ER
- **Reason for Rejection:** Insufficient optical power budget / negative margin for the required link distance.

### QOS Domain Decisions

#### [MEDIA-004] Link FinTech-HQ-Branch-East Metro Latency SLA
- **Selected Choice:** `FEASIBLE: 1.09 ms one-way delay`
- **Technical Justification:** Calculated physical one-way transport delay for link FinTech-HQ-Branch-East (18.5 km): propagation time in silica glass fiber (18.5 km * 5 µs/km = 92.5 µs = 0.09 ms) + equipment serialization/queuing buffer (1 ms) = 1.09 ms. Target SLA < 5 ms is SATISFIED.
- **Applicable Standards:** IEEE 802.3ae

#### [MEDIA-004] Link FinTech-HQ-Branch-West Metro Latency SLA
- **Selected Choice:** `FEASIBLE: 1.16 ms one-way delay`
- **Technical Justification:** Calculated physical one-way transport delay for link FinTech-HQ-Branch-West (32.0 km): propagation time in silica glass fiber (32.0 km * 5 µs/km = 160 µs = 0.16 ms) + equipment serialization/queuing buffer (1 ms) = 1.16 ms. Target SLA < 5 ms is SATISFIED.
- **Applicable Standards:** IEEE 802.3ae

#### [MEDIA-004] Link Branch-East-Branch-West Metro Latency SLA
- **Selected Choice:** `FEASIBLE: 1.12 ms one-way delay`
- **Technical Justification:** Calculated physical one-way transport delay for link Branch-East-Branch-West (24.0 km): propagation time in silica glass fiber (24.0 km * 5 µs/km = 120 µs = 0.12 ms) + equipment serialization/queuing buffer (1 ms) = 1.12 ms. Target SLA < 5 ms is SATISFIED.
- **Applicable Standards:** IEEE 802.3ae

### VLSM Domain Decisions

#### [VLSM-001] Subnet allocation ordering
- **Selected Choice:** `Descending order by block size (RFC 4632)`
- **Technical Justification:** Sorted 10 subnet requests in descending order of required block size. Allocating larger blocks first ensures natural CIDR power-of-two alignment, completely eliminating internal address space fragmentation.
- **Applicable Standards:** RFC 4632

#### [VLSM-002] HQ-Trading-Users (FinTech-HQ)
- **Selected Choice:** `172.16.0.0/24`
- **Technical Justification:** Subnet HQ-Trading-Users: requested 250 hosts. Required block with overhead: 250 + 2 = 252 addresses. Sized to 2^8 = 256 addresses (/24). Usable capacity: 254 hosts. Space efficiency: 98.4%. Gateway assigned to first usable address (172.16.0.1).
- **Applicable Standards:** RFC 4632

#### [VLSM-003] Colo-Trading-Servers (FinTech-HQ)
- **Selected Choice:** `172.16.1.0/25`
- **Technical Justification:** Subnet Colo-Trading-Servers: requested 100 hosts. Required block with overhead: 100 + 2 = 102 addresses. Sized to 2^7 = 128 addresses (/25). Usable capacity: 126 hosts. Space efficiency: 79.4%. Gateway assigned to first usable address (172.16.1.1).
- **Applicable Standards:** RFC 4632

#### [VLSM-004] East-Branch-Users (Branch-East)
- **Selected Choice:** `172.16.1.128/25`
- **Technical Justification:** Subnet East-Branch-Users: requested 120 hosts. Required block with overhead: 120 + 2 = 122 addresses. Sized to 2^7 = 128 addresses (/25). Usable capacity: 126 hosts. Space efficiency: 95.2%. Gateway assigned to first usable address (172.16.1.129).
- **Applicable Standards:** RFC 4632

#### [VLSM-005] West-Branch-Users (Branch-West)
- **Selected Choice:** `172.16.2.0/25`
- **Technical Justification:** Subnet West-Branch-Users: requested 80 hosts. Required block with overhead: 80 + 2 = 82 addresses. Sized to 2^7 = 128 addresses (/25). Usable capacity: 126 hosts. Space efficiency: 63.5%. Gateway assigned to first usable address (172.16.2.1).
- **Applicable Standards:** RFC 4632

#### [VLSM-006] P2P-Branch-East-Branch-West (Branch-East)
- **Selected Choice:** `172.16.2.128/30`
- **Technical Justification:** Point-to-point link P2P-Branch-East-Branch-West: standard /30 prefix with 4 total addresses (1 network, 1 broadcast, 2 usable IPs for serial/inter-router transit).
- **Applicable Standards:** RFC 4632

#### [VLSM-007] P2P-FinTech-HQ-Branch-East (FinTech-HQ)
- **Selected Choice:** `172.16.2.132/30`
- **Technical Justification:** Point-to-point link P2P-FinTech-HQ-Branch-East: standard /30 prefix with 4 total addresses (1 network, 1 broadcast, 2 usable IPs for serial/inter-router transit).
- **Applicable Standards:** RFC 4632

#### [VLSM-008] P2P-FinTech-HQ-Branch-West (FinTech-HQ)
- **Selected Choice:** `172.16.2.136/30`
- **Technical Justification:** Point-to-point link P2P-FinTech-HQ-Branch-West: standard /30 prefix with 4 total addresses (1 network, 1 broadcast, 2 usable IPs for serial/inter-router transit).
- **Applicable Standards:** RFC 4632

#### [VLSM-009] Lo0-RTR-BRANCH-EAST (Branch-East)
- **Selected Choice:** `172.16.2.140/32`
- **Technical Justification:** Loopback Lo0-RTR-BRANCH-EAST: /32 host route assigned exactly 1 IP address.
- **Applicable Standards:** RFC 4632

#### [VLSM-010] Lo0-RTR-BRANCH-WEST (Branch-West)
- **Selected Choice:** `172.16.2.141/32`
- **Technical Justification:** Loopback Lo0-RTR-BRANCH-WEST: /32 host route assigned exactly 1 IP address.
- **Applicable Standards:** RFC 4632

#### [VLSM-011] Lo0-RTR-FINTECH-HQ (FinTech-HQ)
- **Selected Choice:** `172.16.2.142/32`
- **Technical Justification:** Loopback Lo0-RTR-FINTECH-HQ: /32 host route assigned exactly 1 IP address.
- **Applicable Standards:** RFC 4632

#### [VLSM-SUMMARY] VLSM allocation summary
- **Selected Choice:** `10 subnets, 87.2% address space efficiency`
- **Technical Justification:** Allocated 10 subnets containing 559 requested hosts across 641 total usable IP addresses. Overhead/reserved buffer: 82 addresses. Net address space utilization efficiency: 87.2%.
- **Applicable Standards:** RFC 4632

### ROUTING Domain Decisions

#### [ROUTE-003] Intra-Domain Interior Gateway Protocol
- **Selected Choice:** `Single-Area OSPF (Area 0 Backbone)`
- **Technical Justification:** Selected Single-Area OSPF (Area 0) for the Metro MAN EVPL triangle connecting HQ and remote branches. With 3 site(s) and 10 total subnets (strictly below the 50 subnet threshold), a single backbone area provides sub-second Dijkstra SPF convergence without the administrative complexity of ABR route summarization or virtual links (RFC 2328). Link-state advertisements ensure loop-free shortest-path forwarding over redundant links.
- **Applicable Standards:** RFC 2328
- **Alternative Considered:** EIGRP or RIPv2
- **Reason for Rejection:** RIPv2 suffers from slow 15-hop limit and periodic broadcast overhead; EIGRP is proprietary-derived whereas OSPF is open IETF standard.

### SECURITY Domain Decisions

#### [CONFIG-RTR-FINTECH-HQ] Device RTR-FINTECH-HQ
- **Selected Choice:** `Generated Cisco IOS Configuration (93 lines)`
- **Technical Justification:** Assembled configuration for RTR-FINTECH-HQ (router) at site FinTech-HQ. Enforced: 0 SVIs, 0 trunks with explicit VLAN lists and Native VLAN 999, 2 access ports with BPDU Guard, 2 routed PTP ports, OSPF with passive interfaces on access SVIs, DSCP EF QoS priority queuing.
- **Applicable Standards:** IEEE 802.1Q, IEEE 802.1w, RFC 2328

#### [CONFIG-RTR-BRANCH-EAST] Device RTR-BRANCH-EAST
- **Selected Choice:** `Generated Cisco IOS Configuration (73 lines)`
- **Technical Justification:** Assembled configuration for RTR-BRANCH-EAST (router) at site Branch-East. Enforced: 0 SVIs, 0 trunks with explicit VLAN lists and Native VLAN 999, 1 access ports with BPDU Guard, 2 routed PTP ports, OSPF with passive interfaces on access SVIs, DSCP EF QoS priority queuing.
- **Applicable Standards:** IEEE 802.1Q, IEEE 802.1w, RFC 2328

#### [CONFIG-RTR-BRANCH-WEST] Device RTR-BRANCH-WEST
- **Selected Choice:** `Generated Cisco IOS Configuration (73 lines)`
- **Technical Justification:** Assembled configuration for RTR-BRANCH-WEST (router) at site Branch-West. Enforced: 0 SVIs, 0 trunks with explicit VLAN lists and Native VLAN 999, 1 access ports with BPDU Guard, 2 routed PTP ports, OSPF with passive interfaces on access SVIs, DSCP EF QoS priority queuing.
- **Applicable Standards:** IEEE 802.1Q, IEEE 802.1w, RFC 2328

---

## 3. IPv4 VLSM Subnet Allocation Table

| Subnet Name | Site | Network ID | Prefix | Requested | Usable Capacity | Utilization | Default Gateway |
|---|---|---|---|---|---|---|---|
| **HQ-Trading-Users** | FinTech-HQ | `172.16.0.0` | `/24` | 250 | 254 | 98.4% | `172.16.0.1` |
| **Colo-Trading-Servers** | FinTech-HQ | `172.16.1.0` | `/25` | 100 | 126 | 79.4% | `172.16.1.1` |
| **East-Branch-Users** | Branch-East | `172.16.1.128` | `/25` | 120 | 126 | 95.2% | `172.16.1.129` |
| **West-Branch-Users** | Branch-West | `172.16.2.0` | `/25` | 80 | 126 | 63.5% | `172.16.2.1` |
| **P2P-Branch-East-Branch-West** | Branch-East | `172.16.2.128` | `/30` | 2 | 2 | 100% | `172.16.2.129` |
| **P2P-FinTech-HQ-Branch-East** | FinTech-HQ | `172.16.2.132` | `/30` | 2 | 2 | 100% | `172.16.2.133` |
| **P2P-FinTech-HQ-Branch-West** | FinTech-HQ | `172.16.2.136` | `/30` | 2 | 2 | 100% | `172.16.2.137` |
| **Lo0-RTR-BRANCH-EAST** | Branch-East | `172.16.2.140` | `/32` | 1 | 1 | 100% | `172.16.2.140` |
| **Lo0-RTR-BRANCH-WEST** | Branch-West | `172.16.2.141` | `/32` | 1 | 1 | 100% | `172.16.2.141` |
| **Lo0-RTR-FINTECH-HQ** | FinTech-HQ | `172.16.2.142` | `/32` | 1 | 1 | 100% | `172.16.2.142` |
| **TOTAL** | **All Sites** | - | - | **559** | **641** | **87.2%** | - |

> **Address Space Efficiency Metric:** 87.2% of allocated address capacity is active. Reserved expansion buffer: 82 addresses.
