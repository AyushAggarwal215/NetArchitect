# NetArchitect Design Rationale — CAMPUS Profile

**Course:** CIC-307 Computer Networks Mini-Project  
**Architecture:** Independent Node.js Deterministic Network Engineering Engine  
**Timestamp:** 2026-11-10T09:33:46.666Z

---

## 1. Executive Summary Table

| # | Domain | Subject | Decision / Choice | Governing Standards |
|---|---|---|---|---|
| 1 | `MEDIA` | Link Admin-Hall-Science-Complex (180 m) | **OM4 MMF, 10GBASE-SR (850 nm VCSEL)** | IEEE 802.3ae, IEEE 802.3an |
| 2 | `MEDIA` | Link Admin-Hall-Residential-Quad (360 m) | **OM4 MMF, 10GBASE-SR (850 nm VCSEL)** | IEEE 802.3ae, IEEE 802.3an |
| 3 | `MEDIA` | Link Science-Complex-Residential-Quad (250 m) | **OM4 MMF, 10GBASE-SR (850 nm VCSEL)** | IEEE 802.3ae, IEEE 802.3an |
| 4 | `VLSM` | Subnet allocation ordering | **Descending order by block size (RFC 4632)** | RFC 4632 |
| 5 | `VLSM` | Student-Dorms (Residential-Quad) | **10.10.0.0/22** | RFC 4632 |
| 6 | `VLSM` | Research-Labs (Science-Complex) | **10.10.4.0/23** | RFC 4632 |
| 7 | `VLSM` | Admin-Staff (Admin-Hall) | **10.10.6.0/24** | RFC 4632 |
| 8 | `VLSM` | Faculty-Offices (Science-Complex) | **10.10.7.0/24** | RFC 4632 |
| 9 | `VLSM` | Campus-Wi-Fi-APs (Science-Complex) | **10.10.8.0/25** | RFC 4632 |
| 10 | `VLSM` | DataCenter-Servers (Admin-Hall) | **10.10.8.128/26** | RFC 4632 |
| 11 | `VLSM` | Network-Mgmt (Admin-Hall) | **10.10.8.192/26** | RFC 4632 |
| 12 | `VLSM` | CCTV-Security (Admin-Hall) | **10.10.9.0/27** | RFC 4632 |
| 13 | `VLSM` | P2P-Admin-Hall-Residential-Quad (Admin-Hall) | **10.10.9.32/30** | RFC 4632 |
| 14 | `VLSM` | P2P-Admin-Hall-Science-Complex (Admin-Hall) | **10.10.9.36/30** | RFC 4632 |
| 15 | `VLSM` | P2P-Science-Complex-Residential-Quad (Science-Complex) | **10.10.9.40/30** | RFC 4632 |
| 16 | `VLSM` | Lo0-CORE-ADMIN (Admin-Hall) | **10.10.9.44/32** | RFC 4632 |
| 17 | `VLSM` | Lo0-DIST-RESI (Residential-Quad) | **10.10.9.45/32** | RFC 4632 |
| 18 | `VLSM` | Lo0-DIST-SCIENCE (Science-Complex) | **10.10.9.46/32** | RFC 4632 |
| 19 | `VLSM` | VLSM allocation summary | **14 subnets, 69.1% address space efficiency** | RFC 4632 |
| 20 | `ROUTING` | Intra-Domain Interior Gateway Protocol | **Single-Area OSPF (Area 0 Backbone)** | RFC 2328 |
| 21 | `SECURITY` | Device CORE-ADMIN | **Generated Cisco IOS Configuration (116 lines)** | IEEE 802.1Q, IEEE 802.1w, RFC 2328 |
| 22 | `SECURITY` | Device DIST-SCIENCE | **Generated Cisco IOS Configuration (96 lines)** | IEEE 802.1Q, IEEE 802.1w, RFC 2328 |
| 23 | `SECURITY` | Device DIST-RESI | **Generated Cisco IOS Configuration (61 lines)** | IEEE 802.1Q, IEEE 802.1w, RFC 2328 |

---

## 2. Technical Engineering Decisions by Domain

### MEDIA Domain Decisions

#### [MEDIA-002] Link Admin-Hall-Science-Complex (180 m)
- **Selected Choice:** `OM4 MMF, 10GBASE-SR (850 nm VCSEL)`
- **Technical Justification:** Selected OM4 Multi-Mode Fiber (10GBASE-SR) because link distance (180 m) exceeds the 100 m electrical reach of Cat6a copper (IEEE 802.3an) but remains within the 400 m modal bandwidth limit (4700 MHz·km) of OM4 MMF per IEEE 802.3ae.
- **Applicable Standards:** IEEE 802.3ae, IEEE 802.3an
- **Alternative Considered:** Cat6a UTP
- **Reason for Rejection:** Exceeds 100 m channel limit; high-frequency attenuation causes excessive BER.

#### [MEDIA-002] Link Admin-Hall-Residential-Quad (360 m)
- **Selected Choice:** `OM4 MMF, 10GBASE-SR (850 nm VCSEL)`
- **Technical Justification:** Selected OM4 Multi-Mode Fiber (10GBASE-SR) because link distance (360 m) exceeds the 100 m electrical reach of Cat6a copper (IEEE 802.3an) but remains within the 400 m modal bandwidth limit (4700 MHz·km) of OM4 MMF per IEEE 802.3ae.
- **Applicable Standards:** IEEE 802.3ae, IEEE 802.3an
- **Alternative Considered:** Cat6a UTP
- **Reason for Rejection:** Exceeds 100 m channel limit; high-frequency attenuation causes excessive BER.

#### [MEDIA-002] Link Science-Complex-Residential-Quad (250 m)
- **Selected Choice:** `OM4 MMF, 10GBASE-SR (850 nm VCSEL)`
- **Technical Justification:** Selected OM4 Multi-Mode Fiber (10GBASE-SR) because link distance (250 m) exceeds the 100 m electrical reach of Cat6a copper (IEEE 802.3an) but remains within the 400 m modal bandwidth limit (4700 MHz·km) of OM4 MMF per IEEE 802.3ae.
- **Applicable Standards:** IEEE 802.3ae, IEEE 802.3an
- **Alternative Considered:** Cat6a UTP
- **Reason for Rejection:** Exceeds 100 m channel limit; high-frequency attenuation causes excessive BER.

### VLSM Domain Decisions

#### [VLSM-001] Subnet allocation ordering
- **Selected Choice:** `Descending order by block size (RFC 4632)`
- **Technical Justification:** Sorted 14 subnet requests in descending order of required block size. Allocating larger blocks first ensures natural CIDR power-of-two alignment, completely eliminating internal address space fragmentation.
- **Applicable Standards:** RFC 4632

#### [VLSM-002] Student-Dorms (Residential-Quad)
- **Selected Choice:** `10.10.0.0/22`
- **Technical Justification:** Subnet Student-Dorms: requested 600 hosts. Required block with overhead: 600 + 2 = 602 addresses. Sized to 2^10 = 1024 addresses (/22). Usable capacity: 1022 hosts. Space efficiency: 58.7%. Gateway assigned to first usable address (10.10.0.1).
- **Applicable Standards:** RFC 4632

#### [VLSM-003] Research-Labs (Science-Complex)
- **Selected Choice:** `10.10.4.0/23`
- **Technical Justification:** Subnet Research-Labs: requested 300 hosts. Required block with overhead: 300 + 2 = 302 addresses. Sized to 2^9 = 512 addresses (/23). Usable capacity: 510 hosts. Space efficiency: 58.8%. Gateway assigned to first usable address (10.10.4.1).
- **Applicable Standards:** RFC 4632

#### [VLSM-004] Admin-Staff (Admin-Hall)
- **Selected Choice:** `10.10.6.0/24`
- **Technical Justification:** Subnet Admin-Staff: requested 200 hosts. Required block with overhead: 200 + 2 = 202 addresses. Sized to 2^8 = 256 addresses (/24). Usable capacity: 254 hosts. Space efficiency: 78.7%. Gateway assigned to first usable address (10.10.6.1).
- **Applicable Standards:** RFC 4632

#### [VLSM-005] Faculty-Offices (Science-Complex)
- **Selected Choice:** `10.10.7.0/24`
- **Technical Justification:** Subnet Faculty-Offices: requested 250 hosts. Required block with overhead: 250 + 2 = 252 addresses. Sized to 2^8 = 256 addresses (/24). Usable capacity: 254 hosts. Space efficiency: 98.4%. Gateway assigned to first usable address (10.10.7.1).
- **Applicable Standards:** RFC 4632

#### [VLSM-006] Campus-Wi-Fi-APs (Science-Complex)
- **Selected Choice:** `10.10.8.0/25`
- **Technical Justification:** Subnet Campus-Wi-Fi-APs: requested 120 hosts. Required block with overhead: 120 + 2 = 122 addresses. Sized to 2^7 = 128 addresses (/25). Usable capacity: 126 hosts. Space efficiency: 95.2%. Gateway assigned to first usable address (10.10.8.1).
- **Applicable Standards:** RFC 4632

#### [VLSM-007] DataCenter-Servers (Admin-Hall)
- **Selected Choice:** `10.10.8.128/26`
- **Technical Justification:** Subnet DataCenter-Servers: requested 60 hosts. Required block with overhead: 60 + 2 = 62 addresses. Sized to 2^6 = 64 addresses (/26). Usable capacity: 62 hosts. Space efficiency: 96.8%. Gateway assigned to first usable address (10.10.8.129).
- **Applicable Standards:** RFC 4632

#### [VLSM-008] Network-Mgmt (Admin-Hall)
- **Selected Choice:** `10.10.8.192/26`
- **Technical Justification:** Subnet Network-Mgmt: requested 40 hosts. Required block with overhead: 40 + 2 = 42 addresses. Sized to 2^6 = 64 addresses (/26). Usable capacity: 62 hosts. Space efficiency: 64.5%. Gateway assigned to first usable address (10.10.8.193).
- **Applicable Standards:** RFC 4632

#### [VLSM-009] CCTV-Security (Admin-Hall)
- **Selected Choice:** `10.10.9.0/27`
- **Technical Justification:** Subnet CCTV-Security: requested 30 hosts. Required block with overhead: 30 + 2 = 32 addresses. Sized to 2^5 = 32 addresses (/27). Usable capacity: 30 hosts. Space efficiency: 100%. Gateway assigned to first usable address (10.10.9.1).
- **Applicable Standards:** RFC 4632

#### [VLSM-010] P2P-Admin-Hall-Residential-Quad (Admin-Hall)
- **Selected Choice:** `10.10.9.32/30`
- **Technical Justification:** Point-to-point link P2P-Admin-Hall-Residential-Quad: standard /30 prefix with 4 total addresses (1 network, 1 broadcast, 2 usable IPs for serial/inter-router transit).
- **Applicable Standards:** RFC 4632

#### [VLSM-011] P2P-Admin-Hall-Science-Complex (Admin-Hall)
- **Selected Choice:** `10.10.9.36/30`
- **Technical Justification:** Point-to-point link P2P-Admin-Hall-Science-Complex: standard /30 prefix with 4 total addresses (1 network, 1 broadcast, 2 usable IPs for serial/inter-router transit).
- **Applicable Standards:** RFC 4632

#### [VLSM-012] P2P-Science-Complex-Residential-Quad (Science-Complex)
- **Selected Choice:** `10.10.9.40/30`
- **Technical Justification:** Point-to-point link P2P-Science-Complex-Residential-Quad: standard /30 prefix with 4 total addresses (1 network, 1 broadcast, 2 usable IPs for serial/inter-router transit).
- **Applicable Standards:** RFC 4632

#### [VLSM-013] Lo0-CORE-ADMIN (Admin-Hall)
- **Selected Choice:** `10.10.9.44/32`
- **Technical Justification:** Loopback Lo0-CORE-ADMIN: /32 host route assigned exactly 1 IP address.
- **Applicable Standards:** RFC 4632

#### [VLSM-014] Lo0-DIST-RESI (Residential-Quad)
- **Selected Choice:** `10.10.9.45/32`
- **Technical Justification:** Loopback Lo0-DIST-RESI: /32 host route assigned exactly 1 IP address.
- **Applicable Standards:** RFC 4632

#### [VLSM-015] Lo0-DIST-SCIENCE (Science-Complex)
- **Selected Choice:** `10.10.9.46/32`
- **Technical Justification:** Loopback Lo0-DIST-SCIENCE: /32 host route assigned exactly 1 IP address.
- **Applicable Standards:** RFC 4632

#### [VLSM-SUMMARY] VLSM allocation summary
- **Selected Choice:** `14 subnets, 69.1% address space efficiency`
- **Technical Justification:** Allocated 14 subnets containing 1609 requested hosts across 2329 total usable IP addresses. Overhead/reserved buffer: 720 addresses. Net address space utilization efficiency: 69.1%.
- **Applicable Standards:** RFC 4632

### ROUTING Domain Decisions

#### [ROUTE-003] Intra-Domain Interior Gateway Protocol
- **Selected Choice:** `Single-Area OSPF (Area 0 Backbone)`
- **Technical Justification:** Selected Single-Area OSPF (Area 0) for the Enterprise Campus LAN across 3 site(s). With 3 site(s) and 14 total subnets (strictly below the 50 subnet threshold), a single backbone area provides sub-second Dijkstra SPF convergence without the administrative complexity of ABR route summarization or virtual links (RFC 2328). Link-state advertisements ensure loop-free shortest-path forwarding over redundant links.
- **Applicable Standards:** RFC 2328
- **Alternative Considered:** EIGRP or RIPv2
- **Reason for Rejection:** RIPv2 suffers from slow 15-hop limit and periodic broadcast overhead; EIGRP is proprietary-derived whereas OSPF is open IETF standard.

### SECURITY Domain Decisions

#### [CONFIG-CORE-ADMIN] Device CORE-ADMIN
- **Selected Choice:** `Generated Cisco IOS Configuration (116 lines)`
- **Technical Justification:** Assembled configuration for CORE-ADMIN (l3_switch) at site Admin-Hall. Enforced: 4 SVIs, 0 trunks with explicit VLAN lists and Native VLAN 999, 4 access ports with BPDU Guard, 2 routed PTP ports, OSPF with passive interfaces on access SVIs.
- **Applicable Standards:** IEEE 802.1Q, IEEE 802.1w, RFC 2328

#### [CONFIG-DIST-SCIENCE] Device DIST-SCIENCE
- **Selected Choice:** `Generated Cisco IOS Configuration (96 lines)`
- **Technical Justification:** Assembled configuration for DIST-SCIENCE (l3_switch) at site Science-Complex. Enforced: 3 SVIs, 0 trunks with explicit VLAN lists and Native VLAN 999, 3 access ports with BPDU Guard, 2 routed PTP ports, OSPF with passive interfaces on access SVIs.
- **Applicable Standards:** IEEE 802.1Q, IEEE 802.1w, RFC 2328

#### [CONFIG-DIST-RESI] Device DIST-RESI
- **Selected Choice:** `Generated Cisco IOS Configuration (61 lines)`
- **Technical Justification:** Assembled configuration for DIST-RESI (l3_switch) at site Residential-Quad. Enforced: 1 SVIs, 0 trunks with explicit VLAN lists and Native VLAN 999, 1 access ports with BPDU Guard, 2 routed PTP ports, OSPF with passive interfaces on access SVIs.
- **Applicable Standards:** IEEE 802.1Q, IEEE 802.1w, RFC 2328

---

## 3. IPv4 VLSM Subnet Allocation Table

| Subnet Name | Site | Network ID | Prefix | Requested | Usable Capacity | Utilization | Default Gateway |
|---|---|---|---|---|---|---|---|
| **Student-Dorms** | Residential-Quad | `10.10.0.0` | `/22` | 600 | 1022 | 58.7% | `10.10.0.1` |
| **Research-Labs** | Science-Complex | `10.10.4.0` | `/23` | 300 | 510 | 58.8% | `10.10.4.1` |
| **Admin-Staff** | Admin-Hall | `10.10.6.0` | `/24` | 200 | 254 | 78.7% | `10.10.6.1` |
| **Faculty-Offices** | Science-Complex | `10.10.7.0` | `/24` | 250 | 254 | 98.4% | `10.10.7.1` |
| **Campus-Wi-Fi-APs** | Science-Complex | `10.10.8.0` | `/25` | 120 | 126 | 95.2% | `10.10.8.1` |
| **DataCenter-Servers** | Admin-Hall | `10.10.8.128` | `/26` | 60 | 62 | 96.8% | `10.10.8.129` |
| **Network-Mgmt** | Admin-Hall | `10.10.8.192` | `/26` | 40 | 62 | 64.5% | `10.10.8.193` |
| **CCTV-Security** | Admin-Hall | `10.10.9.0` | `/27` | 30 | 30 | 100% | `10.10.9.1` |
| **P2P-Admin-Hall-Residential-Quad** | Admin-Hall | `10.10.9.32` | `/30` | 2 | 2 | 100% | `10.10.9.33` |
| **P2P-Admin-Hall-Science-Complex** | Admin-Hall | `10.10.9.36` | `/30` | 2 | 2 | 100% | `10.10.9.37` |
| **P2P-Science-Complex-Residential-Quad** | Science-Complex | `10.10.9.40` | `/30` | 2 | 2 | 100% | `10.10.9.41` |
| **Lo0-CORE-ADMIN** | Admin-Hall | `10.10.9.44` | `/32` | 1 | 1 | 100% | `10.10.9.44` |
| **Lo0-DIST-RESI** | Residential-Quad | `10.10.9.45` | `/32` | 1 | 1 | 100% | `10.10.9.45` |
| **Lo0-DIST-SCIENCE** | Science-Complex | `10.10.9.46` | `/32` | 1 | 1 | 100% | `10.10.9.46` |
| **TOTAL** | **All Sites** | - | - | **1609** | **2329** | **69.1%** | - |

> **Address Space Efficiency Metric:** 69.1% of allocated address capacity is active. Reserved expansion buffer: 720 addresses.
