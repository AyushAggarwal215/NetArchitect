/**
 * src/engines/vlsm.js
 * Variable Length Subnet Masking (VLSM) Allocation Engine for NetArchitect.
 *
 * Implements deterministic integer bit arithmetic using BigInt to prevent 32-bit
 * signed-integer overflow pitfalls.
 * Guarantees:
 *  - 100% boundary alignment (network address is a multiple of block size)
 *  - Zero address overlap between any pair of allocated subnets
 *  - Complete containment within the assigned root prefix
 *  - Proper handling of RFC 3021 /31 point-to-point subnets and /32 loopbacks
 *  - Address exhaustion detection with clear diagnostic errors
 */

import { SubnetAllocation, Decision } from "../core/models.js";
import { AddressSpaceExhaustedError } from "../core/errors.js";
import {
  parseCidr,
  bigIntToIp,
  prefixToMaskBigInt,
  maskToWildcardBigInt
} from "../utils/ip-address.js";

/**
 * Return the smallest power of 2 >= n as BigInt.
 * @param {bigint|number} n
 * @returns {bigint}
 */
export function nextPowerOf2(n) {
  let val = BigInt(n);
  if (val <= 1n) return 1n;
  val -= 1n;
  let shift = 1n;
  while (shift < 64n) {
    val |= val >> shift;
    shift <<= 1n;
  }
  return val + 1n;
}

/**
 * Convert block size (power of 2) to prefix length (0-32).
 * @param {bigint} blockSize
 * @returns {number}
 */
export function blockToPrefix(blockSize) {
  if (blockSize <= 1n) return 32;
  // Compute log2(blockSize)
  let size = blockSize;
  let power = 0;
  while (size > 1n) {
    size >>= 1n;
    power++;
  }
  return 32 - power;
}

/**
 * Calculate the required block size (number of IP addresses) for a request.
 * @param {number} hosts - Number of requested host interfaces
 * @param {Object} [options]
 * @param {boolean} [options.isPtp=false] - Is this a point-to-point link?
 * @param {boolean} [options.isLoopback=false] - Is this a /32 loopback?
 * @param {boolean} [options.allowSlash31=false] - RFC 3021 support for PTP links
 * @returns {bigint}
 */
export function computeBlockSize(hosts, { isPtp = false, isLoopback = false, allowSlash31 = false } = {}) {
  if (isLoopback) {
    return 1n; // /32 host route
  }
  if (isPtp) {
    return allowSlash31 ? 2n : 4n; // /31 (RFC 3021) or /30
  }

  const requested = Number(hosts);
  // Default IPv4 subnet requires +2 for Network ID and Broadcast Address
  const needed = BigInt(Math.max(2, requested + 2));
  return nextPowerOf2(needed);
}

/**
 * Flat VLSM Allocator.
 * Allocates all subnets from a root prefix, sorted descending by block size.
 *
 * @param {string} rootPrefixStr - e.g. "10.10.0.0/16"
 * @param {Array<Object>} requests - [{ name, hosts, site, isPtp, isLoopback }]
 * @param {Object} [options]
 * @param {boolean} [options.allowSlash31=false]
 * @returns {{ allocations: SubnetAllocation[], decisions: Decision[] }}
 */
export function allocateVlsm(rootPrefixStr, requests, { allowSlash31 = false } = {}) {
  const { prefixLen: rootPrefixLen, networkBigInt: rootNetwork } = parseCidr(rootPrefixStr);
  const rootSize = 1n << BigInt(32 - rootPrefixLen);
  const rootEnd = rootNetwork + rootSize; // Exclusive upper bound

  // Compute block size for each request
  const items = requests.map(req => {
    const isPtp = Boolean(req.isPtp || req.is_ptp);
    const isLoopback = Boolean(req.isLoopback || req.is_loopback);
    const hosts = Number(req.hosts || 0);
    const block = computeBlockSize(hosts, { isPtp, isLoopback, allowSlash31 });
    return {
      ...req,
      isPtp,
      isLoopback,
      hosts,
      _block: block
    };
  });

  // Sort descending by block size (stable tie-breaker by name)
  items.sort((a, b) => {
    if (b._block !== a._block) {
      return b._block > a._block ? 1 : -1;
    }
    return (a.name || "").localeCompare(b.name || "");
  });

  const decisions = [];
  decisions.push(new Decision({
    ruleId: "VLSM-001",
    domain: "vlsm",
    subject: "Subnet allocation ordering",
    choice: "Descending order by block size (RFC 4632)",
    reason: `Sorted ${items.length} subnet requests in descending order of required block size. ` +
      `Allocating larger blocks first ensures natural CIDR power-of-two alignment, completely ` +
      `eliminating internal address space fragmentation.`,
    references: ["RFC 4632"]
  }));

  let cursor = rootNetwork;
  const allocations = [];

  for (const item of items) {
    const size = item._block;

    // Align cursor up to the current block boundary:
    // cursor = (cursor + size - 1n) & ~(size - 1n)
    const remainder = cursor % size;
    if (remainder !== 0n) {
      cursor += size - remainder;
    }

    if (cursor + size > rootEnd) {
      const remaining = rootEnd > cursor ? Number(rootEnd - cursor) : 0;
      throw new AddressSpaceExhaustedError(Number(size), remaining, rootPrefixStr);
    }

    const networkBigInt = cursor;
    const prefixLen = blockToPrefix(size);
    const maskBigInt = prefixToMaskBigInt(prefixLen);
    const wildcardBigInt = maskToWildcardBigInt(maskBigInt);
    const broadcastBigInt = networkBigInt | wildcardBigInt;

    let gatewayBigInt;
    let firstUsableBigInt;
    let lastUsableBigInt;
    let usableCount;

    if (item.isLoopback) {
      gatewayBigInt = networkBigInt;
      firstUsableBigInt = networkBigInt;
      lastUsableBigInt = networkBigInt;
      usableCount = 1;
    } else if (item.isPtp && allowSlash31) {
      // RFC 3021: /31 link has 2 usable addresses, no dedicated network or broadcast
      gatewayBigInt = networkBigInt;
      firstUsableBigInt = networkBigInt;
      lastUsableBigInt = networkBigInt + 1n;
      usableCount = 2;
    } else {
      // Standard subnet: first usable is network + 1, last usable is broadcast - 1
      gatewayBigInt = networkBigInt + 1n;
      firstUsableBigInt = networkBigInt + 1n;
      if (size > 2n) {
        lastUsableBigInt = broadcastBigInt - 1n;
        usableCount = Number(size - 2n);
      } else {
        lastUsableBigInt = firstUsableBigInt;
        usableCount = 0;
      }
    }

    const hostsReq = item.hosts;
    const utilization = usableCount > 0 ? Number(((hostsReq / usableCount) * 100).toFixed(1)) : 0.0;

    const alloc = new SubnetAllocation({
      name: item.name,
      site: item.site || "",
      hostsRequested: hostsReq,
      network: bigIntToIp(networkBigInt),
      prefixLen,
      mask: bigIntToIp(maskBigInt),
      wildcard: bigIntToIp(wildcardBigInt),
      broadcast: bigIntToIp(broadcastBigInt),
      gateway: bigIntToIp(gatewayBigInt),
      firstUsable: bigIntToIp(firstUsableBigInt),
      lastUsable: bigIntToIp(lastUsableBigInt),
      usableCount,
      utilization,
      isPtp: item.isPtp,
      isLoopback: item.isLoopback,
      aggregatePrefix: item.aggregatePrefix || null
    });
    allocations.push(alloc);

    // Decision record for this subnet
    let reasonText;
    const refs = ["RFC 4632"];
    if (item.isLoopback) {
      reasonText = `Loopback ${item.name}: /32 host route assigned exactly 1 IP address.`;
    } else if (item.isPtp) {
      if (allowSlash31) {
        refs.push("RFC 3021");
        reasonText = `Point-to-point link ${item.name}: /31 prefix per RFC 3021. ` +
          `Saves IPv4 address space by omitting dedicated network and broadcast addresses (2 usable IPs).`;
      } else {
        reasonText = `Point-to-point link ${item.name}: standard /30 prefix with 4 total addresses ` +
          `(1 network, 1 broadcast, 2 usable IPs for serial/inter-router transit).`;
      }
    } else {
      const hostBits = 32 - prefixLen;
      reasonText = `Subnet ${item.name}: requested ${hostsReq} hosts. Required block with overhead: ` +
        `${hostsReq} + 2 = ${hostsReq + 2} addresses. Sized to 2^${hostBits} = ${Number(size)} addresses (/${prefixLen}). ` +
        `Usable capacity: ${usableCount} hosts. Space efficiency: ${utilization}%. Gateway assigned to first usable address (${alloc.gateway}).`;
    }

    decisions.push(new Decision({
      ruleId: `VLSM-${String(decisions.length + 1).padStart(3, "0")}`,
      domain: "vlsm",
      subject: `${item.name} (${item.site || "Global"})`,
      choice: `${alloc.network}/${alloc.prefixLen}`,
      reason: reasonText,
      references: refs
    }));

    cursor = networkBigInt + size;
  }

  // Summary statistics
  const totalAllocatedUsable = allocations.reduce((sum, a) => sum + a.usableCount, 0);
  const totalHostsRequested = allocations.reduce((sum, a) => sum + a.hostsRequested, 0);
  const wasted = totalAllocatedUsable - totalHostsRequested;
  const overallEfficiency = totalAllocatedUsable > 0
    ? Number(((totalHostsRequested / totalAllocatedUsable) * 100).toFixed(1))
    : 0;

  decisions.push(new Decision({
    ruleId: "VLSM-SUMMARY",
    domain: "vlsm",
    subject: "VLSM allocation summary",
    choice: `${allocations.length} subnets, ${overallEfficiency}% address space efficiency`,
    reason: `Allocated ${allocations.length} subnets containing ${totalHostsRequested} requested hosts ` +
      `across ${totalAllocatedUsable} total usable IP addresses. Overhead/reserved buffer: ${wasted} addresses. ` +
      `Net address space utilization efficiency: ${overallEfficiency}%.`,
    references: ["RFC 4632"]
  }));

  return { allocations, decisions };
}

/**
 * Hierarchical VLSM Allocator (for Multi-Site / Multi-Area Topologies).
 * Allocates summary supernets per site, then performs VLSM within each site aggregate.
 *
 * @param {string} rootPrefixStr
 * @param {Record<string, Array<Object>>} sitesRequests - Map of siteName -> requests array
 * @param {Array<Object>} [ptpRequests=[]]
 * @param {Array<Object>} [loopbackRequests=[]]
 * @param {Object} [options]
 * @param {boolean} [options.allowSlash31=false]
 * @returns {{ allocations: SubnetAllocation[], decisions: Decision[] }}
 */
export function allocateHierarchical(
  rootPrefixStr,
  sitesRequests,
  ptpRequests = [],
  loopbackRequests = [],
  { allowSlash31 = false } = {}
) {
  const { prefixLen: rootPrefixLen, networkBigInt: rootNetwork } = parseCidr(rootPrefixStr);
  const rootSize = 1n << BigInt(32 - rootPrefixLen);
  const rootEnd = rootNetwork + rootSize;

  const decisions = [];
  const allAllocations = [];

  // Step 1: Compute total block size needed per site and round up to power of 2
  const siteAggregates = [];
  for (const [siteName, reqs] of Object.entries(sitesRequests)) {
    let siteBlocks = 0n;
    for (const r of reqs) {
      siteBlocks += computeBlockSize(r.hosts, {
        isPtp: Boolean(r.isPtp || r.is_ptp),
        isLoopback: Boolean(r.isLoopback || r.is_loopback),
        allowSlash31
      });
    }
    const aggSize = nextPowerOf2(siteBlocks);
    siteAggregates.push({ siteName, reqs, aggSize, totalNeeded: siteBlocks });
  }

  // Sort sites descending by aggregate size
  siteAggregates.sort((a, b) => (b.aggSize > a.aggSize ? 1 : -1));

  // Step 2: Allocate aggregate supernet blocks from root
  let cursor = rootNetwork;
  const siteAllocMaps = new Map();

  for (const siteInfo of siteAggregates) {
    const size = siteInfo.aggSize;
    const remainder = cursor % size;
    if (remainder !== 0n) {
      cursor += size - remainder;
    }

    if (cursor + size > rootEnd) {
      const remaining = rootEnd > cursor ? Number(rootEnd - cursor) : 0;
      throw new AddressSpaceExhaustedError(Number(size), remaining, rootPrefixStr);
    }

    const aggNet = cursor;
    const aggPrefixLen = blockToPrefix(size);
    const aggPrefixStr = `${bigIntToIp(aggNet)}/${aggPrefixLen}`;
    siteAllocMaps.set(siteInfo.siteName, { aggNet, size, aggPrefixLen, aggPrefixStr });

    decisions.push(new Decision({
      ruleId: `VLSM-AGG-${siteInfo.siteName}`,
      domain: "vlsm",
      subject: `Site aggregate: ${siteInfo.siteName}`,
      choice: aggPrefixStr,
      reason: `Site ${siteInfo.siteName} requires ${siteInfo.totalNeeded} total addresses for its VLANs. ` +
        `Allocated hierarchical aggregate supernet of size ${size} (/${aggPrefixLen}). ` +
        `This summary block facilitates clean OSPF area-range route summarization at ABRs (RFC 2328).`,
      references: ["RFC 4632", "RFC 2328"]
    }));

    cursor += size;
  }

  // Step 3: Subnet allocation within each site's aggregate prefix
  for (const siteInfo of siteAggregates) {
    const { aggPrefixStr } = siteAllocMaps.get(siteInfo.siteName);
    const { allocations: siteAllocs, decisions: siteDecs } = allocateVlsm(
      aggPrefixStr,
      siteInfo.reqs,
      { allowSlash31 }
    );
    for (const alloc of siteAllocs) {
      alloc.aggregatePrefix = aggPrefixStr;
    }
    allAllocations.push(...siteAllocs);
    decisions.push(...siteDecs);
  }

  // Step 4: Allocate Infrastructure subnets (PTP links + Loopbacks) from remaining space
  const infraRequests = [...ptpRequests, ...loopbackRequests];
  if (infraRequests.length > 0) {
    let infraBlocks = 0n;
    for (const req of infraRequests) {
      infraBlocks += computeBlockSize(req.hosts || (req.isLoopback ? 1 : 2), {
        isPtp: Boolean(req.isPtp || req.is_ptp),
        isLoopback: Boolean(req.isLoopback || req.is_loopback),
        allowSlash31
      });
    }
    const infraAggSize = nextPowerOf2(infraBlocks);

    // Align cursor to infra block
    const remainder = cursor % infraAggSize;
    if (remainder !== 0n) {
      cursor += infraAggSize - remainder;
    }

    if (cursor + infraAggSize <= rootEnd) {
      const infraPrefixStr = `${bigIntToIp(cursor)}/${blockToPrefix(infraAggSize)}`;
      const { allocations: infraAllocs, decisions: infraDecs } = allocateVlsm(
        infraPrefixStr,
        infraRequests,
        { allowSlash31 }
      );
      for (const alloc of infraAllocs) {
        alloc.aggregatePrefix = infraPrefixStr;
      }
      allAllocations.push(...infraAllocs);
      decisions.push(...infraDecs);
    } else {
      // Fallback: allocate individually if aggregate doesn't fit
      for (const req of infraRequests) {
        const blk = computeBlockSize(req.hosts || (req.isLoopback ? 1 : 2), {
          isPtp: Boolean(req.isPtp || req.is_ptp),
          isLoopback: Boolean(req.isLoopback || req.is_loopback),
          allowSlash31
        });
        const rem = cursor % blk;
        if (rem !== 0n) cursor += blk - rem;
        if (cursor + blk > rootEnd) {
          throw new AddressSpaceExhaustedError(Number(blk), Number(rootEnd - cursor), rootPrefixStr);
        }
        const plen = blockToPrefix(blk);
        const maskBigInt = prefixToMaskBigInt(plen);
        const wildcardBigInt = maskToWildcardBigInt(maskBigInt);
        const bcastBigInt = cursor | wildcardBigInt;
        const isLb = Boolean(req.isLoopback || req.is_loopback);
        const isPtp = Boolean(req.isPtp || req.is_ptp);

        let gw = cursor + 1n;
        let fu = cursor + 1n;
        let lu = bcastBigInt - 1n;
        let usable = Number(blk - 2n);
        if (isLb) {
          gw = fu = lu = cursor;
          usable = 1;
        } else if (isPtp && allowSlash31) {
          gw = fu = cursor;
          lu = cursor + 1n;
          usable = 2;
        }

        allAllocations.push(new SubnetAllocation({
          name: req.name,
          site: req.site || "Infrastructure",
          hostsRequested: req.hosts || (isLb ? 1 : 2),
          network: bigIntToIp(cursor),
          prefixLen: plen,
          mask: bigIntToIp(maskBigInt),
          wildcard: bigIntToIp(wildcardBigInt),
          broadcast: bigIntToIp(bcastBigInt),
          gateway: bigIntToIp(gw),
          firstUsable: bigIntToIp(fu),
          lastUsable: bigIntToIp(lu),
          usableCount: usable,
          utilization: usable > 0 ? Number(((req.hosts / usable) * 100).toFixed(1)) : 100,
          isPtp,
          isLoopback: isLb,
          aggregatePrefix: null
        }));
        cursor += blk;
      }
    }
  }

  return { allocations: allAllocations, decisions };
}

