import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  allocateVlsm,
  allocateHierarchical,
  computeBlockSize,
  blockToPrefix
} from "../../src/engines/vlsm.js";
import {
  prefixToMaskBigInt,
  maskToWildcardBigInt,
  bigIntToIp
} from "../../src/utils/ip-address.js";
import { AddressSpaceExhaustedError } from "../../src/core/errors.js";
import { IPv4NetworkOracle, DeterministicPRNG } from "../helpers/ip-oracle.js";

describe("IPv4 & VLSM Engine Unit & Stress Tests", () => {
  test("All 33 prefixes (/0 through /32) match independent mathematical oracle", () => {
    for (let p = 0; p <= 32; p++) {
      const mask = prefixToMaskBigInt(p);
      const wildcard = maskToWildcardBigInt(mask);
      const maskStr = bigIntToIp(mask);
      const wildcardStr = bigIntToIp(wildcard);

      const oracle = new IPv4NetworkOracle(`0.0.0.0/${p}`);
      assert.equal(maskStr, oracle.netmaskString, `Netmask mismatch at /${p}`);
      assert.equal(wildcardStr, oracle.wildcardString, `Wildcard mismatch at /${p}`);
    }
  });

  test("Host boundary block sizes and prefix calculations", () => {
    const cases = [
      { hosts: 1, expectedBlock: 4n, expectedPrefix: 30, expectedUsable: 2 },
      { hosts: 2, expectedBlock: 4n, expectedPrefix: 30, expectedUsable: 2 },
      { hosts: 254, expectedBlock: 256n, expectedPrefix: 24, expectedUsable: 254 },
      { hosts: 255, expectedBlock: 512n, expectedPrefix: 23, expectedUsable: 510 },
      { hosts: 256, expectedBlock: 512n, expectedPrefix: 23, expectedUsable: 510 },
      { hosts: 500, expectedBlock: 512n, expectedPrefix: 23, expectedUsable: 510 },
      { hosts: 510, expectedBlock: 512n, expectedPrefix: 23, expectedUsable: 510 },
      { hosts: 511, expectedBlock: 1024n, expectedPrefix: 22, expectedUsable: 1022 }
    ];

    for (const c of cases) {
      const blk = computeBlockSize(c.hosts);
      const prefix = blockToPrefix(blk);
      const usable = Number(blk - 2n);
      assert.equal(blk, c.expectedBlock, `Block size mismatch for ${c.hosts} hosts`);
      assert.equal(prefix, c.expectedPrefix, `Prefix mismatch for ${c.hosts} hosts`);
      assert.equal(usable, c.expectedUsable, `Usable count mismatch for ${c.hosts} hosts`);
    }
  });

  test("RFC 3021 /31 point-to-point links and /32 loopbacks", () => {
    // /31 PTP
    const ptp31 = computeBlockSize(2, { isPtp: true, allowSlash31: true });
    assert.equal(ptp31, 2n);
    assert.equal(blockToPrefix(ptp31), 31);

    // /30 PTP (legacy)
    const ptp30 = computeBlockSize(2, { isPtp: true, allowSlash31: false });
    assert.equal(ptp30, 4n);
    assert.equal(blockToPrefix(ptp30), 30);

    // /32 Loopback
    const lb32 = computeBlockSize(1, { isLoopback: true });
    assert.equal(lb32, 1n);
    assert.equal(blockToPrefix(lb32), 32);

    // Allocation test for /31 and /32
    const requests = [
      { name: "PTP_Link", hosts: 2, isPtp: true },
      { name: "Lo0_Core", hosts: 1, isLoopback: true }
    ];
    const { allocations } = allocateVlsm("192.168.10.0/29", requests, { allowSlash31: true });

    const ptpAlloc = allocations.find(a => a.name === "PTP_Link");
    assert.equal(ptpAlloc.prefixLen, 31);
    assert.equal(ptpAlloc.usableCount, 2);
    assert.equal(ptpAlloc.mask, "255.255.255.254");
    assert.equal(ptpAlloc.wildcard, "0.0.0.1");

    const lbAlloc = allocations.find(a => a.name === "Lo0_Core");
    assert.equal(lbAlloc.prefixLen, 32);
    assert.equal(lbAlloc.usableCount, 1);
    assert.equal(lbAlloc.mask, "255.255.255.255");
    assert.equal(lbAlloc.wildcard, "0.0.0.0");
  });

  test("Address space exhaustion detection", () => {
    const rootCidr = "192.168.1.0/24"; // 256 addresses
    const requests = [
      { name: "LargeSubnet1", hosts: 150 },
      { name: "LargeSubnet2", hosts: 150 }
    ];
    assert.throws(
      () => allocateVlsm(rootCidr, requests),
      AddressSpaceExhaustedError
    );
  });

  test("Hierarchical multi-site allocation creates non-overlapping site aggregate supernets", () => {
    const sitesRequests = {
      SiteA: [{ name: "A_Users", hosts: 100, site: "SiteA" }],
      SiteB: [{ name: "B_Users", hosts: 200, site: "SiteB" }]
    };
    const ptpReqs = [{ name: "P2P-A-B", hosts: 2, site: "SiteA", isPtp: true }];
    const loopbacks = [{ name: "Lo0-R1", hosts: 1, site: "SiteA", isLoopback: true }];

    const { allocations, decisions } = allocateHierarchical(
      "10.10.0.0/16",
      sitesRequests,
      ptpReqs,
      loopbacks,
      { allowSlash31: true }
    );

    const rootOracle = new IPv4NetworkOracle("10.10.0.0/16");
    const oracles = allocations.map(a => new IPv4NetworkOracle(`${a.network}/${a.prefixLen}`));

    for (const oracle of oracles) {
      assert.equal(rootOracle.contains(oracle), true, `Subnet ${oracle.networkAddressString} outside root`);
      assert.equal(oracle.isAligned(), true, `Subnet ${oracle.networkAddressString} unaligned`);
    }

    // Check pairwise overlap
    for (let i = 0; i < oracles.length; i++) {
      for (let j = i + 1; j < oracles.length; j++) {
        assert.equal(
          oracles[i].overlaps(oracles[j]),
          false,
          `Overlap between ${oracles[i].networkAddressString} and ${oracles[j].networkAddressString}`
        );
      }
    }
  });

  test("1,000 deterministic seeded randomized VLSM scenarios with zero overlaps", () => {
    const prng = new DeterministicPRNG(42);
    const rootCidr = "10.0.0.0/20"; // 4,096 addresses
    const rootOracle = new IPv4NetworkOracle(rootCidr);

    let totalSubnetsTested = 0;

    for (let trial = 0; trial < 1000; trial++) {
      const numReqs = prng.nextInt(3, 10);
      const requests = [];
      for (let i = 0; i < numReqs; i++) {
        requests.push({
          name: `Subnet_${i}`,
          hosts: prng.nextInt(2, 200),
          site: "SiteA"
        });
      }

      const { allocations } = allocateVlsm(rootCidr, requests);
      totalSubnetsTested += allocations.length;

      const oracles = allocations.map(a => new IPv4NetworkOracle(`${a.network}/${a.prefixLen}`));

      for (let i = 0; i < allocations.length; i++) {
        const alloc = allocations[i];
        const oracle = oracles[i];

        // 1. Inside root network
        assert.equal(rootOracle.contains(oracle), true, `Trial ${trial}: Subnet ${alloc.network} outside root`);

        // 2. Power-of-two alignment
        assert.equal(oracle.isAligned(), true, `Trial ${trial}: Subnet ${alloc.network} unaligned`);

        // 3. Usable host capacity check
        assert.ok(alloc.usableCount >= alloc.hostsRequested, `Trial ${trial}: Capacity insufficient`);
      }

      // 4. Pairwise non-overlap check
      for (let i = 0; i < oracles.length; i++) {
        for (let j = i + 1; j < oracles.length; j++) {
          assert.equal(
            oracles[i].overlaps(oracles[j]),
            false,
            `Trial ${trial}: Overlap between ${allocations[i].network}/${allocations[i].prefixLen} and ${allocations[j].network}/${allocations[j].prefixLen}`
          );
        }
      }
    }

    assert.ok(totalSubnetsTested >= 3000, `Expected at least 3,000 subnets tested, got ${totalSubnetsTested}`);
  });
});

