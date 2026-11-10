/**
 * src/core/constants.js
 * Centralized networking constants and physical parameters for NetArchitect (CIC-307).
 * Every constant is annotated with the governing IEEE standard, RFC, or physical specification.
 */

// ── Physical Layer (L1) Distance Thresholds ──────────────────────────────────
export const COPPER_MAX_DISTANCE_M = 100; // IEEE 802.3an (10GBASE-T) 100m channel limit
export const MMF_OM4_MAX_DISTANCE_M = 400; // IEEE 802.3ae (10GBASE-SR) 400m modal limit
export const MAX_OWNED_FIBER_KM = 80;     // Beyond 80 km, enterprise dark fiber becomes infeasible; Carrier WAN required

// ── Optical Fiber Parameters (ITU-T G.652 OS2 SMF) ───────────────────────────
export const ATTENUATION_1310_DB_PER_KM = 0.35; // ITU-T G.652 OS2 SMF at 1310 nm
export const ATTENUATION_1550_DB_PER_KM = 0.25; // ITU-T G.652 OS2 SMF at 1550 nm
export const CONNECTOR_LOSS_DB = 0.5;           // Typical patch panel connector loss (dB per connector)
export const NUM_CONNECTORS = 4;                // 2 patch panels * 2 connectors per end = 4 total
export const SPLICE_LOSS_DB = 0.1;              // Fusion splice loss per splice point (dB)
export const SAFETY_MARGIN_DB = 2.0;            // Engineering design safety margin (aging, bend loss)
export const PROPAGATION_DELAY_US_PER_KM = 5;   // ~5 µs/km propagation velocity in silica glass fiber

// ── Optical Transceiver Catalog ──────────────────────────────────────────────
export const TRANSCEIVERS = {
  LR: {
    name: "10GBASE-LR",
    wavelengthNm: 1310,
    reachKm: 10,
    txMinDbm: -8.2,
    rxSensDbm: -14.4,
    standard: "IEEE 802.3ae",
    description: "10GBASE-LR (1310 nm, 10 km reach)"
  },
  ER: {
    name: "10GBASE-ER",
    wavelengthNm: 1550,
    reachKm: 40,
    txMinDbm: -4.7,
    rxSensDbm: -15.8,
    standard: "IEEE 802.3ae",
    description: "10GBASE-ER (1550 nm, 40 km reach)"
  },
  ZR: {
    name: "10GBASE-ZR",
    wavelengthNm: 1550,
    reachKm: 80,
    txMinDbm: 0.0,
    rxSensDbm: -24.0,
    standard: "Vendor-specific typical / SFF-8431",
    description: "10GBASE-ZR (1550 nm, 80 km reach)"
  }
};

// Selection order: cheapest transceiver that meets reach and margin >= 0 dB
export const TRANSCEIVER_COST_ORDER = ["LR", "ER", "ZR"];

// ── Layer 2 — IEEE 802.1Q & IEEE 802.1w ──────────────────────────────────────
export const VLAN_MIN = 1;                  // Minimum 802.1Q VLAN ID
export const VLAN_MAX = 4094;               // Maximum 802.1Q VLAN ID
export const VLAN_RESERVED_START = 1002;    // Cisco legacy FDDI/Token Ring reserved start
export const VLAN_RESERVED_END = 1005;      // Cisco legacy FDDI/Token Ring reserved end
export const NATIVE_VLAN_ID = 999;          // Dedicated, isolated VLAN for untagged 802.1Q trunk traffic
export const STP_ROOT_PRIORITY = 4096;      // IEEE 802.1w lowest configurable non-zero bridge priority

// ── Layer 3 — Routing Protocols ──────────────────────────────────────────────
export const OSPF_PROCESS_ID = 1;
export const OSPF_MAX_SUBNETS_SINGLE_AREA = 50; // Threshold above which multi-area partitioning is advised
export const ONPREM_ASN = 65001;            // RFC 6996 Private ASN for enterprise on-premises
export const CLOUD_ASN = 65010;             // RFC 6996 Private ASN for cloud provider peering

// ── QoS — Metro MAN Profile ──────────────────────────────────────────────────
export const METRO_MAX_ONE_WAY_DELAY_MS = 5.0; // SLA latency target for voice/realtime metro transport
export const EQUIPMENT_DELAY_ALLOWANCE_MS = 1.0; // Queuing/serialization buffer allowance
export const QOS_VOICE_PRIORITY_PERCENT = 30;    // Cisco IOS priority percent for DSCP EF traffic

// ── IPsec VPN — WAN Profile (RFC 4301) ───────────────────────────────────────
export const IPSEC_ISAKMP_POLICY_NUM = 10;
export const IPSEC_ENCRYPTION = "aes 256";
export const IPSEC_AUTH_METHOD = "pre-share";
export const IPSEC_DH_GROUP = 14;           // MODP 2048-bit Diffie-Hellman (RFC 3526)
export const IPSEC_TRANSFORM_SET_NAME = "IPSEC-TS";
export const IPSEC_PRESHARED_KEY_PLACEHOLDER = "CHANGE_ME_BEFORE_DEPLOYMENT";

