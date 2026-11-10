# NetArchitect Design Rationale — WAN Profile

**Course:** CIC-307 Computer Networks Mini-Project  
**Architecture:** Independent Node.js Deterministic Network Engineering Engine  
**Timestamp:** 2026-11-10T09:33:46.870Z

---

## 1. Executive Summary Table

| # | Domain | Subject | Decision / Choice | Governing Standards |
|---|---|---|---|---|
| 1 | `MEDIA` | Link Delhi-Hub-Mumbai-Logistics (1150.0 km) | **Carrier WAN circuit (IPsec VPN secured)** | RFC 4301 |
| 2 | `MEDIA` | Link Delhi-Hub-Bengaluru-TechCenter (1750.0 km) | **Carrier WAN circuit (IPsec VPN secured)** | RFC 4301 |
| 3 | `MEDIA` | Link Delhi-Hub-Chennai-Terminal (1760.0 km) | **Carrier WAN circuit (IPsec VPN secured)** | RFC 4301 |
| 4 | `VLSM` | Site aggregate: Delhi-Hub | **10.100.0.0/21** | RFC 4632, RFC 2328 |
| 5 | `VLSM` | Site aggregate: Chennai-Terminal | **10.100.8.0/22** | RFC 4632, RFC 2328 |
| 6 | `VLSM` | Site aggregate: Bengaluru-TechCenter | **10.100.12.0/22** | RFC 4632, RFC 2328 |
| 7 | `VLSM` | Site aggregate: Mumbai-Logistics | **10.100.16.0/22** | RFC 4632, RFC 2328 |
| 8 | `VLSM` | Subnet allocation ordering | **Descending order by block size (RFC 4632)** | RFC 4632 |
| 9 | `VLSM` | Delhi-IoT-Scanners (Delhi-Hub) | **10.100.0.0/22** | RFC 4632 |
| 10 | `VLSM` | Delhi-Mgmt (Delhi-Hub) | **10.100.4.0/27** | RFC 4632 |
| 11 | `VLSM` | Delhi-Servers (Delhi-Hub) | **10.100.4.32/27** | RFC 4632 |
| 12 | `VLSM` | VLSM allocation summary | **3 subnets, 78.6% address space efficiency** | RFC 4632 |
| 13 | `VLSM` | Subnet allocation ordering | **Descending order by block size (RFC 4632)** | RFC 4632 |
| 14 | `VLSM` | Chennai-IoT-Scanners (Chennai-Terminal) | **10.100.8.0/23** | RFC 4632 |
| 15 | `VLSM` | Chennai-Mgmt (Chennai-Terminal) | **10.100.10.0/27** | RFC 4632 |
| 16 | `VLSM` | Chennai-Servers (Chennai-Terminal) | **10.100.10.32/27** | RFC 4632 |
| 17 | `VLSM` | VLSM allocation summary | **3 subnets, 61.4% address space efficiency** | RFC 4632 |
| 18 | `VLSM` | Subnet allocation ordering | **Descending order by block size (RFC 4632)** | RFC 4632 |
| 19 | `VLSM` | Bengaluru-IoT-Scanners (Bengaluru-TechCenter) | **10.100.12.0/23** | RFC 4632 |
| 20 | `VLSM` | Bengaluru-Mgmt (Bengaluru-TechCenter) | **10.100.14.0/27** | RFC 4632 |
| 21 | `VLSM` | Bengaluru-Servers (Bengaluru-TechCenter) | **10.100.14.32/27** | RFC 4632 |
| 22 | `VLSM` | VLSM allocation summary | **3 subnets, 78.9% address space efficiency** | RFC 4632 |
| 23 | `VLSM` | Subnet allocation ordering | **Descending order by block size (RFC 4632)** | RFC 4632 |
| 24 | `VLSM` | Mumbai-IoT-Scanners (Mumbai-Logistics) | **10.100.16.0/23** | RFC 4632 |
| 25 | `VLSM` | Mumbai-Mgmt (Mumbai-Logistics) | **10.100.18.0/27** | RFC 4632 |
| 26 | `VLSM` | Mumbai-Servers (Mumbai-Logistics) | **10.100.18.32/27** | RFC 4632 |
| 27 | `VLSM` | VLSM allocation summary | **3 subnets, 96.5% address space efficiency** | RFC 4632 |
| 28 | `VLSM` | Subnet allocation ordering | **Descending order by block size (RFC 4632)** | RFC 4632 |
| 29 | `VLSM` | P2P-Delhi-Hub-Bengaluru-TechCenter (Delhi-Hub) | **10.100.20.0/31** | RFC 4632, RFC 3021 |
| 30 | `VLSM` | P2P-Delhi-Hub-Chennai-Terminal (Delhi-Hub) | **10.100.20.2/31** | RFC 4632, RFC 3021 |
| 31 | `VLSM` | P2P-Delhi-Hub-Mumbai-Logistics (Delhi-Hub) | **10.100.20.4/31** | RFC 4632, RFC 3021 |
| 32 | `VLSM` | Lo0-RTR-BENGALURU (Bengaluru-TechCenter) | **10.100.20.6/32** | RFC 4632 |
| 33 | `VLSM` | Lo0-RTR-CHENNAI (Chennai-Terminal) | **10.100.20.7/32** | RFC 4632 |
| 34 | `VLSM` | Lo0-RTR-DELHI (Delhi-Hub) | **10.100.20.8/32** | RFC 4632 |
| 35 | `VLSM` | Lo0-RTR-MUMBAI (Mumbai-Logistics) | **10.100.20.9/32** | RFC 4632 |
| 36 | `VLSM` | VLSM allocation summary | **7 subnets, 100% address space efficiency** | RFC 4632 |
| 37 | `ROUTING` | Global WAN Routing Architecture | **Hierarchical Multi-Area OSPF + eBGP (ASN 65001 <-> 65010)** | RFC 2328, RFC 4271, RFC 6996 |
| 38 | `SECURITY` | Device RTR-DELHI | **Generated Cisco IOS Configuration (136 lines)** | IEEE 802.1Q, IEEE 802.1w, RFC 2328 |
| 39 | `SECURITY` | Device RTR-MUMBAI | **Generated Cisco IOS Configuration (88 lines)** | IEEE 802.1Q, IEEE 802.1w, RFC 2328 |
| 40 | `SECURITY` | Device RTR-BENGALURU | **Generated Cisco IOS Configuration (88 lines)** | IEEE 802.1Q, IEEE 802.1w, RFC 2328 |
| 41 | `SECURITY` | Device RTR-CHENNAI | **Generated Cisco IOS Configuration (88 lines)** | IEEE 802.1Q, IEEE 802.1w, RFC 2328 |

---

## 2. Technical Engineering Decisions by Domain

### MEDIA Domain Decisions

#### [MEDIA-003] Link Delhi-Hub-Mumbai-Logistics (1150.0 km)
- **Selected Choice:** `Carrier WAN circuit (IPsec VPN secured)`
- **Technical Justification:** Selected Carrier WAN circuit because link distance (1150.0 km) exceeds the 80 km limit for enterprise-owned unamplified dark fiber. Recommended solution leverages commercial leased-line / EVPL transit secured via IPsec tunnel encryption (RFC 4301).
- **Applicable Standards:** RFC 4301
- **Alternative Considered:** Owned OS2 SMF with repeaters
- **Reason for Rejection:** Right-of-way cost and maintenance of intermediate optical repeaters over 1150.0 km is commercially prohibitive.

#### [MEDIA-003] Link Delhi-Hub-Bengaluru-TechCenter (1750.0 km)
- **Selected Choice:** `Carrier WAN circuit (IPsec VPN secured)`
- **Technical Justification:** Selected Carrier WAN circuit because link distance (1750.0 km) exceeds the 80 km limit for enterprise-owned unamplified dark fiber. Recommended solution leverages commercial leased-line / EVPL transit secured via IPsec tunnel encryption (RFC 4301).
- **Applicable Standards:** RFC 4301
- **Alternative Considered:** Owned OS2 SMF with repeaters
- **Reason for Rejection:** Right-of-way cost and maintenance of intermediate optical repeaters over 1750.0 km is commercially prohibitive.

#### [MEDIA-003] Link Delhi-Hub-Chennai-Terminal (1760.0 km)
- **Selected Choice:** `Carrier WAN circuit (IPsec VPN secured)`
- **Technical Justification:** Selected Carrier WAN circuit because link distance (1760.0 km) exceeds the 80 km limit for enterprise-owned unamplified dark fiber. Recommended solution leverages commercial leased-line / EVPL transit secured via IPsec tunnel encryption (RFC 4301).
- **Applicable Standards:** RFC 4301
- **Alternative Considered:** Owned OS2 SMF with repeaters
- **Reason for Rejection:** Right-of-way cost and maintenance of intermediate optical repeaters over 1760.0 km is commercially prohibitive.

### VLSM Domain Decisions

#### [VLSM-AGG-Delhi-Hub] Site aggregate: Delhi-Hub
- **Selected Choice:** `10.100.0.0/21`
- **Technical Justification:** Site Delhi-Hub requires 1088 total addresses for its VLANs. Allocated hierarchical aggregate supernet of size 2048 (/21). This summary block facilitates clean OSPF area-range route summarization at ABRs (RFC 2328).
- **Applicable Standards:** RFC 4632, RFC 2328

#### [VLSM-AGG-Chennai-Terminal] Site aggregate: Chennai-Terminal
- **Selected Choice:** `10.100.8.0/22`
- **Technical Justification:** Site Chennai-Terminal requires 576 total addresses for its VLANs. Allocated hierarchical aggregate supernet of size 1024 (/22). This summary block facilitates clean OSPF area-range route summarization at ABRs (RFC 2328).
- **Applicable Standards:** RFC 4632, RFC 2328

#### [VLSM-AGG-Bengaluru-TechCenter] Site aggregate: Bengaluru-TechCenter
- **Selected Choice:** `10.100.12.0/22`
- **Technical Justification:** Site Bengaluru-TechCenter requires 576 total addresses for its VLANs. Allocated hierarchical aggregate supernet of size 1024 (/22). This summary block facilitates clean OSPF area-range route summarization at ABRs (RFC 2328).
- **Applicable Standards:** RFC 4632, RFC 2328

#### [VLSM-AGG-Mumbai-Logistics] Site aggregate: Mumbai-Logistics
- **Selected Choice:** `10.100.16.0/22`
- **Technical Justification:** Site Mumbai-Logistics requires 576 total addresses for its VLANs. Allocated hierarchical aggregate supernet of size 1024 (/22). This summary block facilitates clean OSPF area-range route summarization at ABRs (RFC 2328).
- **Applicable Standards:** RFC 4632, RFC 2328

#### [VLSM-001] Subnet allocation ordering
- **Selected Choice:** `Descending order by block size (RFC 4632)`
- **Technical Justification:** Sorted 3 subnet requests in descending order of required block size. Allocating larger blocks first ensures natural CIDR power-of-two alignment, completely eliminating internal address space fragmentation.
- **Applicable Standards:** RFC 4632

#### [VLSM-002] Delhi-IoT-Scanners (Delhi-Hub)
- **Selected Choice:** `10.100.0.0/22`
- **Technical Justification:** Subnet Delhi-IoT-Scanners: requested 800 hosts. Required block with overhead: 800 + 2 = 802 addresses. Sized to 2^10 = 1024 addresses (/22). Usable capacity: 1022 hosts. Space efficiency: 78.3%. Gateway assigned to first usable address (10.100.0.1).
- **Applicable Standards:** RFC 4632

#### [VLSM-003] Delhi-Mgmt (Delhi-Hub)
- **Selected Choice:** `10.100.4.0/27`
- **Technical Justification:** Subnet Delhi-Mgmt: requested 30 hosts. Required block with overhead: 30 + 2 = 32 addresses. Sized to 2^5 = 32 addresses (/27). Usable capacity: 30 hosts. Space efficiency: 100%. Gateway assigned to first usable address (10.100.4.1).
- **Applicable Standards:** RFC 4632

#### [VLSM-004] Delhi-Servers (Delhi-Hub)
- **Selected Choice:** `10.100.4.32/27`
- **Technical Justification:** Subnet Delhi-Servers: requested 20 hosts. Required block with overhead: 20 + 2 = 22 addresses. Sized to 2^5 = 32 addresses (/27). Usable capacity: 30 hosts. Space efficiency: 66.7%. Gateway assigned to first usable address (10.100.4.33).
- **Applicable Standards:** RFC 4632

#### [VLSM-SUMMARY] VLSM allocation summary
- **Selected Choice:** `3 subnets, 78.6% address space efficiency`
- **Technical Justification:** Allocated 3 subnets containing 850 requested hosts across 1082 total usable IP addresses. Overhead/reserved buffer: 232 addresses. Net address space utilization efficiency: 78.6%.
- **Applicable Standards:** RFC 4632

#### [VLSM-001] Subnet allocation ordering
- **Selected Choice:** `Descending order by block size (RFC 4632)`
- **Technical Justification:** Sorted 3 subnet requests in descending order of required block size. Allocating larger blocks first ensures natural CIDR power-of-two alignment, completely eliminating internal address space fragmentation.
- **Applicable Standards:** RFC 4632

#### [VLSM-002] Chennai-IoT-Scanners (Chennai-Terminal)
- **Selected Choice:** `10.100.8.0/23`
- **Technical Justification:** Subnet Chennai-IoT-Scanners: requested 300 hosts. Required block with overhead: 300 + 2 = 302 addresses. Sized to 2^9 = 512 addresses (/23). Usable capacity: 510 hosts. Space efficiency: 58.8%. Gateway assigned to first usable address (10.100.8.1).
- **Applicable Standards:** RFC 4632

#### [VLSM-003] Chennai-Mgmt (Chennai-Terminal)
- **Selected Choice:** `10.100.10.0/27`
- **Technical Justification:** Subnet Chennai-Mgmt: requested 30 hosts. Required block with overhead: 30 + 2 = 32 addresses. Sized to 2^5 = 32 addresses (/27). Usable capacity: 30 hosts. Space efficiency: 100%. Gateway assigned to first usable address (10.100.10.1).
- **Applicable Standards:** RFC 4632

#### [VLSM-004] Chennai-Servers (Chennai-Terminal)
- **Selected Choice:** `10.100.10.32/27`
- **Technical Justification:** Subnet Chennai-Servers: requested 20 hosts. Required block with overhead: 20 + 2 = 22 addresses. Sized to 2^5 = 32 addresses (/27). Usable capacity: 30 hosts. Space efficiency: 66.7%. Gateway assigned to first usable address (10.100.10.33).
- **Applicable Standards:** RFC 4632

#### [VLSM-SUMMARY] VLSM allocation summary
- **Selected Choice:** `3 subnets, 61.4% address space efficiency`
- **Technical Justification:** Allocated 3 subnets containing 350 requested hosts across 570 total usable IP addresses. Overhead/reserved buffer: 220 addresses. Net address space utilization efficiency: 61.4%.
- **Applicable Standards:** RFC 4632

#### [VLSM-001] Subnet allocation ordering
- **Selected Choice:** `Descending order by block size (RFC 4632)`
- **Technical Justification:** Sorted 3 subnet requests in descending order of required block size. Allocating larger blocks first ensures natural CIDR power-of-two alignment, completely eliminating internal address space fragmentation.
- **Applicable Standards:** RFC 4632

#### [VLSM-002] Bengaluru-IoT-Scanners (Bengaluru-TechCenter)
- **Selected Choice:** `10.100.12.0/23`
- **Technical Justification:** Subnet Bengaluru-IoT-Scanners: requested 400 hosts. Required block with overhead: 400 + 2 = 402 addresses. Sized to 2^9 = 512 addresses (/23). Usable capacity: 510 hosts. Space efficiency: 78.4%. Gateway assigned to first usable address (10.100.12.1).
- **Applicable Standards:** RFC 4632

#### [VLSM-003] Bengaluru-Mgmt (Bengaluru-TechCenter)
- **Selected Choice:** `10.100.14.0/27`
- **Technical Justification:** Subnet Bengaluru-Mgmt: requested 30 hosts. Required block with overhead: 30 + 2 = 32 addresses. Sized to 2^5 = 32 addresses (/27). Usable capacity: 30 hosts. Space efficiency: 100%. Gateway assigned to first usable address (10.100.14.1).
- **Applicable Standards:** RFC 4632

#### [VLSM-004] Bengaluru-Servers (Bengaluru-TechCenter)
- **Selected Choice:** `10.100.14.32/27`
- **Technical Justification:** Subnet Bengaluru-Servers: requested 20 hosts. Required block with overhead: 20 + 2 = 22 addresses. Sized to 2^5 = 32 addresses (/27). Usable capacity: 30 hosts. Space efficiency: 66.7%. Gateway assigned to first usable address (10.100.14.33).
- **Applicable Standards:** RFC 4632

#### [VLSM-SUMMARY] VLSM allocation summary
- **Selected Choice:** `3 subnets, 78.9% address space efficiency`
- **Technical Justification:** Allocated 3 subnets containing 450 requested hosts across 570 total usable IP addresses. Overhead/reserved buffer: 120 addresses. Net address space utilization efficiency: 78.9%.
- **Applicable Standards:** RFC 4632

#### [VLSM-001] Subnet allocation ordering
- **Selected Choice:** `Descending order by block size (RFC 4632)`
- **Technical Justification:** Sorted 3 subnet requests in descending order of required block size. Allocating larger blocks first ensures natural CIDR power-of-two alignment, completely eliminating internal address space fragmentation.
- **Applicable Standards:** RFC 4632

#### [VLSM-002] Mumbai-IoT-Scanners (Mumbai-Logistics)
- **Selected Choice:** `10.100.16.0/23`
- **Technical Justification:** Subnet Mumbai-IoT-Scanners: requested 500 hosts. Required block with overhead: 500 + 2 = 502 addresses. Sized to 2^9 = 512 addresses (/23). Usable capacity: 510 hosts. Space efficiency: 98%. Gateway assigned to first usable address (10.100.16.1).
- **Applicable Standards:** RFC 4632

#### [VLSM-003] Mumbai-Mgmt (Mumbai-Logistics)
- **Selected Choice:** `10.100.18.0/27`
- **Technical Justification:** Subnet Mumbai-Mgmt: requested 30 hosts. Required block with overhead: 30 + 2 = 32 addresses. Sized to 2^5 = 32 addresses (/27). Usable capacity: 30 hosts. Space efficiency: 100%. Gateway assigned to first usable address (10.100.18.1).
- **Applicable Standards:** RFC 4632

#### [VLSM-004] Mumbai-Servers (Mumbai-Logistics)
- **Selected Choice:** `10.100.18.32/27`
- **Technical Justification:** Subnet Mumbai-Servers: requested 20 hosts. Required block with overhead: 20 + 2 = 22 addresses. Sized to 2^5 = 32 addresses (/27). Usable capacity: 30 hosts. Space efficiency: 66.7%. Gateway assigned to first usable address (10.100.18.33).
- **Applicable Standards:** RFC 4632

#### [VLSM-SUMMARY] VLSM allocation summary
- **Selected Choice:** `3 subnets, 96.5% address space efficiency`
- **Technical Justification:** Allocated 3 subnets containing 550 requested hosts across 570 total usable IP addresses. Overhead/reserved buffer: 20 addresses. Net address space utilization efficiency: 96.5%.
- **Applicable Standards:** RFC 4632

#### [VLSM-001] Subnet allocation ordering
- **Selected Choice:** `Descending order by block size (RFC 4632)`
- **Technical Justification:** Sorted 7 subnet requests in descending order of required block size. Allocating larger blocks first ensures natural CIDR power-of-two alignment, completely eliminating internal address space fragmentation.
- **Applicable Standards:** RFC 4632

#### [VLSM-002] P2P-Delhi-Hub-Bengaluru-TechCenter (Delhi-Hub)
- **Selected Choice:** `10.100.20.0/31`
- **Technical Justification:** Point-to-point link P2P-Delhi-Hub-Bengaluru-TechCenter: /31 prefix per RFC 3021. Saves IPv4 address space by omitting dedicated network and broadcast addresses (2 usable IPs).
- **Applicable Standards:** RFC 4632, RFC 3021

#### [VLSM-003] P2P-Delhi-Hub-Chennai-Terminal (Delhi-Hub)
- **Selected Choice:** `10.100.20.2/31`
- **Technical Justification:** Point-to-point link P2P-Delhi-Hub-Chennai-Terminal: /31 prefix per RFC 3021. Saves IPv4 address space by omitting dedicated network and broadcast addresses (2 usable IPs).
- **Applicable Standards:** RFC 4632, RFC 3021

#### [VLSM-004] P2P-Delhi-Hub-Mumbai-Logistics (Delhi-Hub)
- **Selected Choice:** `10.100.20.4/31`
- **Technical Justification:** Point-to-point link P2P-Delhi-Hub-Mumbai-Logistics: /31 prefix per RFC 3021. Saves IPv4 address space by omitting dedicated network and broadcast addresses (2 usable IPs).
- **Applicable Standards:** RFC 4632, RFC 3021

#### [VLSM-005] Lo0-RTR-BENGALURU (Bengaluru-TechCenter)
- **Selected Choice:** `10.100.20.6/32`
- **Technical Justification:** Loopback Lo0-RTR-BENGALURU: /32 host route assigned exactly 1 IP address.
- **Applicable Standards:** RFC 4632

#### [VLSM-006] Lo0-RTR-CHENNAI (Chennai-Terminal)
- **Selected Choice:** `10.100.20.7/32`
- **Technical Justification:** Loopback Lo0-RTR-CHENNAI: /32 host route assigned exactly 1 IP address.
- **Applicable Standards:** RFC 4632

#### [VLSM-007] Lo0-RTR-DELHI (Delhi-Hub)
- **Selected Choice:** `10.100.20.8/32`
- **Technical Justification:** Loopback Lo0-RTR-DELHI: /32 host route assigned exactly 1 IP address.
- **Applicable Standards:** RFC 4632

#### [VLSM-008] Lo0-RTR-MUMBAI (Mumbai-Logistics)
- **Selected Choice:** `10.100.20.9/32`
- **Technical Justification:** Loopback Lo0-RTR-MUMBAI: /32 host route assigned exactly 1 IP address.
- **Applicable Standards:** RFC 4632

#### [VLSM-SUMMARY] VLSM allocation summary
- **Selected Choice:** `7 subnets, 100% address space efficiency`
- **Technical Justification:** Allocated 7 subnets containing 10 requested hosts across 10 total usable IP addresses. Overhead/reserved buffer: 0 addresses. Net address space utilization efficiency: 100%.
- **Applicable Standards:** RFC 4632

### ROUTING Domain Decisions

#### [ROUTE-001] Global WAN Routing Architecture
- **Selected Choice:** `Hierarchical Multi-Area OSPF + eBGP (ASN 65001 <-> 65010)`
- **Technical Justification:** Selected Multi-Area OSPF with eBGP peering because the network spans 4 geographically dispersed sites with 19 allocated subnets and requires hybrid cloud integration with AWS-Transit-VPC (10.200.0.0/16). Each site is designated into an OSPF area hierarchy (Delhi-Hub: Area 0 backbone, Mumbai-Logistics: Area 1, Bengaluru-TechCenter: Area 2, Chennai-Terminal: Area 3) to contain link-state advertisement (LSA) flooding and enable Area Border Router (ABR) route summarization via 'area range' (RFC 2328). External routing to cloud VPC uses eBGP across Private ASNs (On-Premises ASN 65001 to Cloud Provider ASN 65010 at 10.200.0.1) ensuring administrative domain separation and route filtering (RFC 4271, RFC 6996).
- **Applicable Standards:** RFC 2328, RFC 4271, RFC 6996
- **Alternative Considered:** Static default routes to cloud
- **Reason for Rejection:** Fails to provide dynamic failover, AS path loop prevention, or automated route exchange with cloud gateway.

### SECURITY Domain Decisions

#### [CONFIG-RTR-DELHI] Device RTR-DELHI
- **Selected Choice:** `Generated Cisco IOS Configuration (136 lines)`
- **Technical Justification:** Assembled configuration for RTR-DELHI (router) at site Delhi-Hub. Enforced: 3 SVIs, 0 trunks with explicit VLAN lists and Native VLAN 999, 3 access ports with BPDU Guard, 3 routed PTP ports, OSPF with passive interfaces on access SVIs, eBGP peering, AES-256 IPsec tunnel.
- **Applicable Standards:** IEEE 802.1Q, IEEE 802.1w, RFC 2328

#### [CONFIG-RTR-MUMBAI] Device RTR-MUMBAI
- **Selected Choice:** `Generated Cisco IOS Configuration (88 lines)`
- **Technical Justification:** Assembled configuration for RTR-MUMBAI (router) at site Mumbai-Logistics. Enforced: 3 SVIs, 0 trunks with explicit VLAN lists and Native VLAN 999, 3 access ports with BPDU Guard, 1 routed PTP ports, OSPF with passive interfaces on access SVIs.
- **Applicable Standards:** IEEE 802.1Q, IEEE 802.1w, RFC 2328

#### [CONFIG-RTR-BENGALURU] Device RTR-BENGALURU
- **Selected Choice:** `Generated Cisco IOS Configuration (88 lines)`
- **Technical Justification:** Assembled configuration for RTR-BENGALURU (router) at site Bengaluru-TechCenter. Enforced: 3 SVIs, 0 trunks with explicit VLAN lists and Native VLAN 999, 3 access ports with BPDU Guard, 1 routed PTP ports, OSPF with passive interfaces on access SVIs.
- **Applicable Standards:** IEEE 802.1Q, IEEE 802.1w, RFC 2328

#### [CONFIG-RTR-CHENNAI] Device RTR-CHENNAI
- **Selected Choice:** `Generated Cisco IOS Configuration (88 lines)`
- **Technical Justification:** Assembled configuration for RTR-CHENNAI (router) at site Chennai-Terminal. Enforced: 3 SVIs, 0 trunks with explicit VLAN lists and Native VLAN 999, 3 access ports with BPDU Guard, 1 routed PTP ports, OSPF with passive interfaces on access SVIs.
- **Applicable Standards:** IEEE 802.1Q, IEEE 802.1w, RFC 2328

---

## 3. IPv4 VLSM Subnet Allocation Table

| Subnet Name | Site | Network ID | Prefix | Requested | Usable Capacity | Utilization | Default Gateway |
|---|---|---|---|---|---|---|---|
| **Delhi-IoT-Scanners** | Delhi-Hub | `10.100.0.0` | `/22` | 800 | 1022 | 78.3% | `10.100.0.1` |
| **Delhi-Mgmt** | Delhi-Hub | `10.100.4.0` | `/27` | 30 | 30 | 100% | `10.100.4.1` |
| **Delhi-Servers** | Delhi-Hub | `10.100.4.32` | `/27` | 20 | 30 | 66.7% | `10.100.4.33` |
| **Chennai-IoT-Scanners** | Chennai-Terminal | `10.100.8.0` | `/23` | 300 | 510 | 58.8% | `10.100.8.1` |
| **Chennai-Mgmt** | Chennai-Terminal | `10.100.10.0` | `/27` | 30 | 30 | 100% | `10.100.10.1` |
| **Chennai-Servers** | Chennai-Terminal | `10.100.10.32` | `/27` | 20 | 30 | 66.7% | `10.100.10.33` |
| **Bengaluru-IoT-Scanners** | Bengaluru-TechCenter | `10.100.12.0` | `/23` | 400 | 510 | 78.4% | `10.100.12.1` |
| **Bengaluru-Mgmt** | Bengaluru-TechCenter | `10.100.14.0` | `/27` | 30 | 30 | 100% | `10.100.14.1` |
| **Bengaluru-Servers** | Bengaluru-TechCenter | `10.100.14.32` | `/27` | 20 | 30 | 66.7% | `10.100.14.33` |
| **Mumbai-IoT-Scanners** | Mumbai-Logistics | `10.100.16.0` | `/23` | 500 | 510 | 98% | `10.100.16.1` |
| **Mumbai-Mgmt** | Mumbai-Logistics | `10.100.18.0` | `/27` | 30 | 30 | 100% | `10.100.18.1` |
| **Mumbai-Servers** | Mumbai-Logistics | `10.100.18.32` | `/27` | 20 | 30 | 66.7% | `10.100.18.33` |
| **P2P-Delhi-Hub-Bengaluru-TechCenter** | Delhi-Hub | `10.100.20.0` | `/31` | 2 | 2 | 100% | `10.100.20.0` |
| **P2P-Delhi-Hub-Chennai-Terminal** | Delhi-Hub | `10.100.20.2` | `/31` | 2 | 2 | 100% | `10.100.20.2` |
| **P2P-Delhi-Hub-Mumbai-Logistics** | Delhi-Hub | `10.100.20.4` | `/31` | 2 | 2 | 100% | `10.100.20.4` |
| **Lo0-RTR-BENGALURU** | Bengaluru-TechCenter | `10.100.20.6` | `/32` | 1 | 1 | 100% | `10.100.20.6` |
| **Lo0-RTR-CHENNAI** | Chennai-Terminal | `10.100.20.7` | `/32` | 1 | 1 | 100% | `10.100.20.7` |
| **Lo0-RTR-DELHI** | Delhi-Hub | `10.100.20.8` | `/32` | 1 | 1 | 100% | `10.100.20.8` |
| **Lo0-RTR-MUMBAI** | Mumbai-Logistics | `10.100.20.9` | `/32` | 1 | 1 | 100% | `10.100.20.9` |
| **TOTAL** | **All Sites** | - | - | **2210** | **2802** | **78.9%** | - |

> **Address Space Efficiency Metric:** 78.9% of allocated address capacity is active. Reserved expansion buffer: 592 addresses.
