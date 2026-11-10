/**
 * src/core/errors.js
 * Domain-specific error hierarchy for NetArchitect.
 * When caught by the CLI, these output clean messages and exit with code 2 without stack dumps.
 */

export class NetArchitectError extends Error {
  constructor(message, exitCode = 2) {
    super(message);
    this.name = this.constructor.name;
    this.exitCode = exitCode;
  }
}

export class InvalidParameterError extends NetArchitectError {
  constructor(message) {
    super(message, 2);
  }
}

export class PhysicalDistanceViolationError extends NetArchitectError {
  constructor(linkName, distanceM) {
    super(
      `Physical distance violation on link '${linkName}': ${distanceM} m exceeds the 100 m ` +
      `maximum channel length for Cat6a copper cabling (IEEE 802.3an). Beyond 100 m, insertion ` +
      `loss and alien crosstalk severely degrade 10GBASE-T bit error rates (BER). ` +
      `Use fiber optic media (OM4 MMF or OS2 SMF) instead.`,
      2
    );
    this.linkName = linkName;
    this.distanceM = distanceM;
  }
}

export class AddressSpaceExhaustedError extends NetArchitectError {
  constructor(requested, available, rootPrefix) {
    super(
      `Address space exhausted in ${rootPrefix}: requested block size of ${requested} addresses, ` +
      `but only ${available} addresses remain unallocated. ` +
      `Consider expanding the root prefix or optimizing host allocations.`,
      2
    );
    this.requested = requested;
    this.available = available;
    this.rootPrefix = rootPrefix;
  }
}

export class OpticalBudgetError extends NetArchitectError {
  constructor(linkName, distanceKm, bestMarginDb) {
    const formattedMargin = Number.isFinite(bestMarginDb) ? bestMarginDb.toFixed(2) : "N/A";
    super(
      `Optical budget exceeded on link '${linkName}' (${distanceKm.toFixed(2)} km): ` +
      `best available transceiver margin is ${formattedMargin} dB (negative margin indicates signal starvation). ` +
      `Optical amplification (EDFA), signal regeneration, or Carrier WAN circuit required.`,
      2
    );
    this.linkName = linkName;
    this.distanceKm = distanceKm;
    this.bestMarginDb = bestMarginDb;
  }
}

export class ConfigurationValidationError extends NetArchitectError {
  constructor(message, details = []) {
    super(message, 2);
    this.details = details;
  }
}

