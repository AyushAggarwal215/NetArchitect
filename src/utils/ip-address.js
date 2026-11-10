/**
 * src/utils/ip-address.js
 * High-precision IPv4 math and CIDR boundary utilities using BigInt arithmetic.
 *
 * Avoids all JavaScript 32-bit signed bitwise integer pitfalls (where bitwise operators
 * treat operands as signed 32-bit two's complement integers, e.g. 0xFFFFFFFF being treated as -1).
 */

import { InvalidParameterError } from "../core/errors.js";

export const IPV4_MAX = 0xFFFFFFFFn; // 4294967295n (255.255.255.255)
export const IPV4_MIN = 0n;

/**
 * Convert a dotted-quad IPv4 string to an unsigned BigInt.
 * @param {string} ipStr
 * @returns {bigint}
 */
export function ipToBigInt(ipStr) {
  if (typeof ipStr !== "string") {
    throw new InvalidParameterError(`IP address must be a string, got ${typeof ipStr}`);
  }
  const parts = ipStr.trim().split(".");
  if (parts.length !== 4) {
    throw new InvalidParameterError(`Invalid IPv4 address format '${ipStr}'`);
  }

  let result = 0n;
  for (let i = 0; i < 4; i++) {
    const octetStr = parts[i];
    if (!/^\d+$/.test(octetStr)) {
      throw new InvalidParameterError(`Invalid character in octet '${octetStr}' of IP '${ipStr}'`);
    }
    const val = Number(octetStr);
    if (val < 0 || val > 255) {
      throw new InvalidParameterError(`Octet '${octetStr}' out of range [0, 255] in IP '${ipStr}'`);
    }
    result = (result << 8n) | BigInt(val);
  }
  return result;
}

/**
 * Convert an unsigned BigInt to a dotted-quad IPv4 string.
 * @param {bigint} val
 * @returns {string}
 */
export function bigIntToIp(val) {
  if (typeof val !== "bigint") {
    val = BigInt(val);
  }
  if (val < IPV4_MIN || val > IPV4_MAX) {
    throw new RangeError(`BigInt ${val} out of IPv4 bounds [0, 4294967295]`);
  }
  const o1 = (val >> 24n) & 0xFFn;
  const o2 = (val >> 16n) & 0xFFn;
  const o3 = (val >> 8n) & 0xFFn;
  const o4 = val & 0xFFn;
  return `${o1}.${o2}.${o3}.${o4}`;
}

/**
 * Convert a CIDR prefix length (0-32) to subnet mask BigInt.
 * @param {number} prefixLen
 * @returns {bigint}
 */
export function prefixToMaskBigInt(prefixLen) {
  const p = Number(prefixLen);
  if (!Number.isInteger(p) || p < 0 || p > 32) {
    throw new InvalidParameterError(`Prefix length ${prefixLen} out of range [0, 32]`);
  }
  if (p === 0) return 0n;
  return (IPV4_MAX << BigInt(32 - p)) & IPV4_MAX;
}

/**
 * Compute wildcard mask BigInt from subnet mask BigInt.
 * @param {bigint} maskBigInt
 * @returns {bigint}
 */
export function maskToWildcardBigInt(maskBigInt) {
  return (~maskBigInt) & IPV4_MAX;
}

/**
 * Parse and validate a CIDR string (e.g. "10.10.0.0/16").
 * @param {string} cidrStr
 * @returns {{ ip: string, prefixLen: number, ipBigInt: bigint, maskBigInt: bigint, networkBigInt: bigint }}
 */
export function parseCidr(cidrStr) {
  if (typeof cidrStr !== "string" || !cidrStr.includes("/")) {
    throw new InvalidParameterError(`Invalid CIDR format '${cidrStr}': expected 'A.B.C.D/N'`);
  }
  const [ipPart, prefixPart] = cidrStr.trim().split("/");
  if (!/^\d+$/.test(prefixPart)) {
    throw new InvalidParameterError(`Invalid prefix length in '${cidrStr}'`);
  }
  const prefixLen = Number(prefixPart);
  if (prefixLen < 0 || prefixLen > 32) {
    throw new InvalidParameterError(`Prefix length ${prefixLen} out of range [0, 32] in '${cidrStr}'`);
  }
  const ipBigInt = ipToBigInt(ipPart);
  const maskBigInt = prefixToMaskBigInt(prefixLen);
  const networkBigInt = ipBigInt & maskBigInt;

  return {
    ip: ipPart,
    prefixLen,
    ipBigInt,
    maskBigInt,
    networkBigInt
  };
}

/**
 * Check if an IP address belongs to RFC 1918 private address space:
 * - 10.0.0.0/8 (10.0.0.0 - 10.255.255.255)
 * - 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
 * - 192.168.0.0/16 (192.168.0.0 - 192.168.255.255)
 * @param {string|bigint} ip
 * @returns {boolean}
 */
export function isRfc1918(ip) {
  const ipInt = typeof ip === "bigint" ? ip : ipToBigInt(ip);

  // 10.0.0.0/8: 0x0A000000n to 0x0AFFFFFFn
  if ((ipInt >> 24n) === 10n) return true;

  // 172.16.0.0/12: 0xAC100000n to 0xAC1FFFFFn
  if ((ipInt >> 20n) === 0xAC1n) return true;

  // 192.168.0.0/16: 0xC0A80000n to 0xC0A8FFFFn
  if ((ipInt >> 16n) === 0xC0A8n) return true;

  return false;
}

/**
 * Check if child subnet is completely contained within parent subnet.
 * @param {bigint} childNet
 * @param {bigint} childBroadcast
 * @param {bigint} parentNet
 * @param {bigint} parentBroadcast
 * @returns {boolean}
 */
export function isSubnetContained(childNet, childBroadcast, parentNet, parentBroadcast) {
  return childNet >= parentNet && childBroadcast <= parentBroadcast;
}

/**
 * Check if two subnets overlap.
 * @param {bigint} netA
 * @param {bigint} bcastA
 * @param {bigint} netB
 * @param {bigint} bcastB
 * @returns {boolean}
 */
export function subnetsOverlap(netA, bcastA, netB, bcastB) {
  return !(bcastA < netB || bcastB < netA);
}

