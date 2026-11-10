/**
 * tests/helpers/ip-oracle.js
 * Independent Ground-Truth Verification Oracle for IPv4 Subnet Mathematics.
 *
 * This module implements pure mathematical definitions independently of the
 * VLSM engine code to cross-verify all prefixes, alignments, and boundaries.
 */

export class IPv4NetworkOracle {
  constructor(cidrStr) {
    const [ipStr, prefixStr] = cidrStr.trim().split("/");
    this.prefixLen = parseInt(prefixStr, 10);
    this.octets = ipStr.split(".").map(o => parseInt(o, 10));

    // Calculate raw 32-bit unsigned number via powers of 256
    this.numericIp = (
      BigInt(this.octets[0]) * 16777216n +
      BigInt(this.octets[1]) * 65536n +
      BigInt(this.octets[2]) * 256n +
      BigInt(this.octets[3])
    );

    // Number of host bits
    this.hostBits = 32 - this.prefixLen;
    this.blockSize = 1n << BigInt(this.hostBits);

    // Mathematical netmask: (2^32 - 1) - (2^hostBits - 1)
    this.numericMask = this.prefixLen === 0
      ? 0n
      : (4294967295n - ((1n << BigInt(this.hostBits)) - 1n));

    // Mathematical hostmask (wildcard): 2^hostBits - 1
    this.numericWildcard = (1n << BigInt(this.hostBits)) - 1n;

    // Network and Broadcast
    this.numericNetwork = this.numericIp - (this.numericIp % this.blockSize);
    this.numericBroadcast = this.numericNetwork + this.blockSize - 1n;
  }

  get netmaskString() {
    return this._format(this.numericMask);
  }

  get wildcardString() {
    return this._format(this.numericWildcard);
  }

  get networkAddressString() {
    return this._format(this.numericNetwork);
  }

  get broadcastAddressString() {
    return this._format(this.numericBroadcast);
  }

  contains(otherOracle) {
    return (
      this.numericNetwork <= otherOracle.numericNetwork &&
      this.numericBroadcast >= otherOracle.numericBroadcast
    );
  }

  overlaps(otherOracle) {
    return !(
      this.numericBroadcast < otherOracle.numericNetwork ||
      otherOracle.numericBroadcast < this.numericNetwork
    );
  }

  isAligned() {
    return (this.numericNetwork % this.blockSize) === 0n;
  }

  _format(n) {
    const b0 = (n / 16777216n) % 256n;
    const b1 = (n / 65536n) % 256n;
    const b2 = (n / 256n) % 256n;
    const b3 = n % 256n;
    return `${b0}.${b1}.${b2}.${b3}`;
  }
}

/**
 * Deterministic Linear Congruential Generator (LCG) PRNG for fixed-seed random tests.
 */
export class DeterministicPRNG {
  constructor(seed = 42) {
    this.state = BigInt(seed);
  }

  next() {
    // Numerical Recipes parameters: a = 1664525, c = 1013904223, m = 2^32
    this.state = (1664525n * this.state + 1013904223n) % 4294967296n;
    return Number(this.state) / 4294967296;
  }

  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

