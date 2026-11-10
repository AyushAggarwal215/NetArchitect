/**
 * src/engines/media.js
 * Physical Media & Optical Power Budget Selection Engine for NetArchitect (CIC-307).
 *
 * Implements deterministic physical layer standards compliance:
 *  - IEEE 802.3an (10GBASE-T) 100 m channel limit for Cat6a UTP
 *  - IEEE 802.3ae (10GBASE-SR) 400 m modal bandwidth limit for OM4 MMF
 *  - IEEE 802.3ae / ITU-T G.652 for OS2 SMF (10GBASE-LR, 10GBASE-ER, 10GBASE-ZR)
 *  - Physics-based optical loss budget and link margin calculations
 *  - RFC 4301 Carrier WAN circuit recommendation beyond 80 km
 */

import { MediaSelection, Decision } from "../core/models.js";
import {
  PhysicalDistanceViolationError,
  OpticalBudgetError,
  InvalidParameterError
} from "../core/errors.js";
import {
  COPPER_MAX_DISTANCE_M,
  MMF_OM4_MAX_DISTANCE_M,
  MAX_OWNED_FIBER_KM,
  ATTENUATION_1310_DB_PER_KM,
  ATTENUATION_1550_DB_PER_KM,
  CONNECTOR_LOSS_DB,
  NUM_CONNECTORS,
  SPLICE_LOSS_DB,
  SAFETY_MARGIN_DB,
  PROPAGATION_DELAY_US_PER_KM,
  TRANSCEIVERS,
  TRANSCEIVER_COST_ORDER,
  METRO_MAX_ONE_WAY_DELAY_MS,
  EQUIPMENT_DELAY_ALLOWANCE_MS
} from "../core/constants.js";

/**
 * Computes optical loss budget, total attenuation, and link margin.
 *
 * Formula:
 *  Budget = Tx_min - Rx_sens
 *  Fiber_Loss = distance_km * attenuation_per_km
 *  Connector_Loss = NUM_CONNECTORS * CONNECTOR_LOSS_DB (4 * 0.5 = 2.0 dB)
 *  Splice_Loss = floor(distance_km / 2) * SPLICE_LOSS_DB (0.1 dB every 2 km reel)
 *  Total_Loss = Fiber_Loss + Connector_Loss + Splice_Loss + SAFETY_MARGIN_DB (2.0 dB)
 *  Margin = Budget - Total_Loss
 *
 * @param {string} transceiverKey - "LR" | "ER" | "ZR"
 * @param {number} distanceKm
 * @returns {Object}
 */
export function computeOpticalBudget(transceiverKey, distanceKm) {
  const spec = TRANSCEIVERS[transceiverKey];
  if (!spec) {
    throw new InvalidParameterError(`Unknown optical transceiver key '${transceiverKey}'`);
  }

  const budget = spec.txMinDbm - spec.rxSensDbm;
  const attenuation = spec.wavelengthNm === 1310
    ? ATTENUATION_1310_DB_PER_KM
    : ATTENUATION_1550_DB_PER_KM;

  const fiberLoss = distanceKm * attenuation;
  const connectorLoss = NUM_CONNECTORS * CONNECTOR_LOSS_DB;
  const spliceCount = Math.floor(distanceKm / 2);
  const spliceLoss = spliceCount * SPLICE_LOSS_DB;
  const totalLoss = fiberLoss + connectorLoss + spliceLoss + SAFETY_MARGIN_DB;
  const margin = budget - totalLoss;

  return {
    budgetDb: Number(budget.toFixed(2)),
    fiberLossDb: Number(fiberLoss.toFixed(2)),
    connectorLossDb: Number(connectorLoss.toFixed(2)),
    spliceCount,
    spliceLossDb: Number(spliceLoss.toFixed(2)),
    safetyDb: SAFETY_MARGIN_DB,
    totalLossDb: Number(totalLoss.toFixed(2)),
    marginDb: Number(margin.toFixed(2))
  };
}

/**
 * Select physical transmission media for a link.
 *
 * @param {string} linkA
 * @param {string} linkB
 * @param {number} distanceM
 * @param {Object} [options]
 * @param {'copper'|'fiber'|'auto'|null} [options.mediaRequest=null]
 * @param {string} [options.profile="campus"]
 * @returns {{ selection: MediaSelection, decisions: Decision[] }}
 */
export function selectMedia(linkA, linkB, distanceM, { mediaRequest = null, profile = "campus" } = {}) {
  const distance = Number(distanceM);
  if (isNaN(distance) || distance <= 0) {
    throw new InvalidParameterError(
      `Link distance must be a positive number (> 0 m), got '${distanceM}'`
    );
  }

  const linkName = `${linkA}-${linkB}`;
  const distanceKm = distance / 1000.0;
  const decisions = [];

  // 1. Mandatory check: copper explicitly requested beyond 100m channel limit
  if (mediaRequest && mediaRequest.toLowerCase() === "copper" && distance > COPPER_MAX_DISTANCE_M) {
    throw new PhysicalDistanceViolationError(linkName, distance);
  }

  // 2. Distance <= 100 m: Cat6a UTP copper
  if (distance <= COPPER_MAX_DISTANCE_M) {
    const propDelayUs = Number((distanceKm * PROPAGATION_DELAY_US_PER_KM).toFixed(2));
    const selection = new MediaSelection({
      linkA,
      linkB,
      distanceM: distance,
      mediaType: "Cat6a UTP",
      standard: "10GBASE-T",
      propagationDelayUs: propDelayUs,
      wanCircuit: false
    });

    decisions.push(new Decision({
      ruleId: "MEDIA-001",
      domain: "media",
      subject: `Link ${linkName} (${distance} m)`,
      choice: "Cat6a UTP, 10GBASE-T",
      reason: `Selected Cat6a UTP (10GBASE-T) because link distance (${distance} m) is within the ` +
        `${COPPER_MAX_DISTANCE_M} m maximum channel length specified by IEEE 802.3an. ` +
        `Copper twisted-pair provides cost-effective 10 Gbps transmission without optical transceivers.`,
      references: ["IEEE 802.3an"],
      alternative: "OM4 MMF (10GBASE-SR)",
      rejectionReason: "Unnecessary transceiver and fiber termination expense for sub-100 m run."
    }));

    return { selection, decisions };
  }

  // 3. 101 m to 400 m: OM4 Multimode Fiber
  if (distance <= MMF_OM4_MAX_DISTANCE_M) {
    const propDelayUs = Number((distanceKm * PROPAGATION_DELAY_US_PER_KM).toFixed(2));
    const selection = new MediaSelection({
      linkA,
      linkB,
      distanceM: distance,
      mediaType: "OM4 MMF",
      standard: "10GBASE-SR",
      wavelengthNm: 850,
      propagationDelayUs: propDelayUs,
      wanCircuit: false
    });

    decisions.push(new Decision({
      ruleId: "MEDIA-002",
      domain: "media",
      subject: `Link ${linkName} (${distance} m)`,
      choice: "OM4 MMF, 10GBASE-SR (850 nm VCSEL)",
      reason: `Selected OM4 Multi-Mode Fiber (10GBASE-SR) because link distance (${distance} m) ` +
        `exceeds the 100 m electrical reach of Cat6a copper (IEEE 802.3an) but remains within the ` +
        `${MMF_OM4_MAX_DISTANCE_M} m modal bandwidth limit (4700 MHz·km) of OM4 MMF per IEEE 802.3ae.`,
      references: ["IEEE 802.3ae", "IEEE 802.3an"],
      alternative: "Cat6a UTP",
      rejectionReason: `Exceeds 100 m channel limit; high-frequency attenuation causes excessive BER.`
    }));

    return { selection, decisions };
  }

  // 4. > 80 km: Exceeds maximum dark fiber reach -> Carrier WAN circuit (IPsec)
  if (distanceKm > MAX_OWNED_FIBER_KM) {
    const propDelayUs = Number((distanceKm * PROPAGATION_DELAY_US_PER_KM).toFixed(2));
    const selection = new MediaSelection({
      linkA,
      linkB,
      distanceM: distance,
      mediaType: "Carrier WAN Circuit",
      standard: "Carrier Ethernet / IPsec",
      propagationDelayUs: propDelayUs,
      wanCircuit: true
    });

    decisions.push(new Decision({
      ruleId: "MEDIA-003",
      domain: "media",
      subject: `Link ${linkName} (${distanceKm.toFixed(1)} km)`,
      choice: "Carrier WAN circuit (IPsec VPN secured)",
      reason: `Selected Carrier WAN circuit because link distance (${distanceKm.toFixed(1)} km) ` +
        `exceeds the ${MAX_OWNED_FIBER_KM} km limit for enterprise-owned unamplified dark fiber. ` +
        `Recommended solution leverages commercial leased-line / EVPL transit secured via IPsec tunnel encryption (RFC 4301).`,
      references: ["RFC 4301"],
      alternative: "Owned OS2 SMF with repeaters",
      rejectionReason: `Right-of-way cost and maintenance of intermediate optical repeaters over ${distanceKm.toFixed(1)} km is commercially prohibitive.`
    }));

    return { selection, decisions };
  }

  // 5. 401 m to 80 km: OS2 Single-Mode Fiber with optical transceiver selection
  const propDelayUs = Number((distanceKm * PROPAGATION_DELAY_US_PER_KM).toFixed(2));
  let bestXcvrKey = null;
  let bestBudget = null;
  let maxMarginFound = -Infinity;

  for (const xcvrKey of TRANSCEIVER_COST_ORDER) {
    const spec = TRANSCEIVERS[xcvrKey];
    if (spec.reachKm < distanceKm) {
      const bInfo = computeOpticalBudget(xcvrKey, distanceKm);
      if (bInfo.marginDb > maxMarginFound) maxMarginFound = bInfo.marginDb;
      continue;
    }
    const bInfo = computeOpticalBudget(xcvrKey, distanceKm);
    if (bInfo.marginDb >= 0) {
      bestXcvrKey = xcvrKey;
      bestBudget = bInfo;
      break;
    }
    if (bInfo.marginDb > maxMarginFound) {
      maxMarginFound = bInfo.marginDb;
      bestXcvrKey = xcvrKey;
      bestBudget = bInfo;
    }
  }

  if (!bestXcvrKey || !bestBudget || bestBudget.marginDb < 0) {
    throw new OpticalBudgetError(linkName, distanceKm, maxMarginFound);
  }

  const spec = TRANSCEIVERS[bestXcvrKey];
  const selection = new MediaSelection({
    linkA,
    linkB,
    distanceM: distance,
    mediaType: "OS2 SMF",
    standard: spec.name,
    transceiver: bestXcvrKey,
    wavelengthNm: spec.wavelengthNm,
    budgetDb: bestBudget.budgetDb,
    lossDb: bestBudget.totalLossDb,
    marginDb: bestBudget.marginDb,
    propagationDelayUs: propDelayUs,
    wanCircuit: false
  });

  decisions.push(new Decision({
    ruleId: "MEDIA-003",
    domain: "media",
    subject: `Link ${linkName} (${distanceKm.toFixed(2)} km)`,
    choice: `OS2 SMF, ${spec.description}`,
    reason: `Selected OS2 Single-Mode Fiber (${spec.name}, ${spec.wavelengthNm} nm) because distance ` +
      `(${distance} m = ${distanceKm.toFixed(2)} km) exceeds the 400 m modal bandwidth limit of OM4 MMF. ` +
      `Optical Power Budget: ${bestBudget.budgetDb} dB (Tx_min ${spec.txMinDbm} dBm - Rx_sens ${spec.rxSensDbm} dBm). ` +
      `Total Channel Loss: ${bestBudget.totalLossDb} dB (fiber attenuation ${bestBudget.fiberLossDb} dB + ` +
      `connectors ${bestBudget.connectorLossDb} dB + splices ${bestBudget.spliceLossDb} dB + safety margin ${bestBudget.safetyDb} dB). ` +
      `Net Link Margin: +${bestBudget.marginDb} dB (positive margin guarantees error-free reception).`,
    references: [spec.standard, "ITU-T G.652"],
    alternative: bestXcvrKey === "ZR" ? "10GBASE-ER" : "10GBASE-LR",
    rejectionReason: "Insufficient optical power budget / negative margin for the required link distance."
  }));

  // 6. Metro Profile latency check
  if (profile === "metro") {
    const oneWayDelayMs = (propDelayUs / 1000.0) + EQUIPMENT_DELAY_ALLOWANCE_MS;
    const meetsTarget = oneWayDelayMs < METRO_MAX_ONE_WAY_DELAY_MS;

    decisions.push(new Decision({
      ruleId: "MEDIA-004",
      domain: "qos",
      subject: `Link ${linkName} Metro Latency SLA`,
      choice: `${meetsTarget ? "FEASIBLE" : "AT_RISK"}: ${oneWayDelayMs.toFixed(2)} ms one-way delay`,
      reason: `Calculated physical one-way transport delay for link ${linkName} (${distanceKm.toFixed(1)} km): ` +
        `propagation time in silica glass fiber (${distanceKm.toFixed(1)} km * ${PROPAGATION_DELAY_US_PER_KM} µs/km = ` +
        `${propDelayUs} µs = ${(propDelayUs / 1000).toFixed(2)} ms) + equipment serialization/queuing buffer ` +
        `(${EQUIPMENT_DELAY_ALLOWANCE_MS} ms) = ${oneWayDelayMs.toFixed(2)} ms. ` +
        `Target SLA < ${METRO_MAX_ONE_WAY_DELAY_MS} ms is ${meetsTarget ? "SATISFIED" : "EXCEEDED"}.`,
      references: ["IEEE 802.3ae"]
    }));
  }

  return { selection, decisions };
}

