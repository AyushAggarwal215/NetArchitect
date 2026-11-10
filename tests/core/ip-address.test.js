import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ipToBigInt,
  bigIntToIp,
  prefixToMaskBigInt,
  maskToWildcardBigInt,
  parseCidr,
  isRfc1918,
  isSubnetContained,
  subnetsOverlap
} from "../../src/utils/ip-address.js";
import { InvalidParameterError } from "../../src/core/errors.js";

describe("IPv4 BigInt Address Utilities", () => {
  test("Converts standard IPv4 addresses to BigInt and back", () => {
    const testCases = [
      ["0.0.0.0", 0n],
      ["10.0.0.1", 167772161n],
      ["172.16.254.1", 2886794753n],
      ["192.168.1.254", 3232236030n],
      ["255.255.255.255", 4294967295n]
    ];

    for (const [ipStr, expectedBigInt] of testCases) {
      const actualBigInt = ipToBigInt(ipStr);
      assert.equal(actualBigInt, expectedBigInt, `ipToBigInt failed for ${ipStr}`);
      const roundtripIp = bigIntToIp(actualBigInt);
      assert.equal(roundtripIp, ipStr, `bigIntToIp roundtrip failed for ${ipStr}`);
    }
  });

  test("Rejects malformed IPv4 addresses", () => {
    assert.throws(() => ipToBigInt("256.0.0.1"), InvalidParameterError);
    assert.throws(() => ipToBigInt("10.0.1"), InvalidParameterError);
    assert.throws(() => ipToBigInt("10.0.0.0.1"), InvalidParameterError);
    assert.throws(() => ipToBigInt("abc.def.ghi.jkl"), InvalidParameterError);
    assert.throws(() => ipToBigInt("-1.0.0.1"), InvalidParameterError);
  });

  test("Generates correct subnet masks and bitwise inverse wildcards for all 33 prefixes", () => {
    for (let p = 0; p <= 32; p++) {
      const mask = prefixToMaskBigInt(p);
      const wildcard = maskToWildcardBigInt(mask);

      // Bitwise properties:
      // 1. mask ^ wildcard === 0xFFFFFFFFn
      assert.equal(mask ^ wildcard, 0xFFFFFFFFn, `Prefix /${p} XOR identity failed`);
      // 2. mask & wildcard === 0n
      assert.equal(mask & wildcard, 0n, `Prefix /${p} AND identity failed`);
      // 3. mask | wildcard === 0xFFFFFFFFn
      assert.equal(mask | wildcard, 0xFFFFFFFFn, `Prefix /${p} OR identity failed`);
    }

    assert.equal(bigIntToIp(prefixToMaskBigInt(24)), "255.255.255.0");
    assert.equal(bigIntToIp(maskToWildcardBigInt(prefixToMaskBigInt(24))), "0.0.0.255");
    assert.equal(bigIntToIp(prefixToMaskBigInt(27)), "255.255.255.224");
    assert.equal(bigIntToIp(maskToWildcardBigInt(prefixToMaskBigInt(27))), "0.0.0.31");
    assert.equal(bigIntToIp(prefixToMaskBigInt(30)), "255.255.255.252");
    assert.equal(bigIntToIp(maskToWildcardBigInt(prefixToMaskBigInt(30))), "0.0.0.3");
    assert.equal(bigIntToIp(prefixToMaskBigInt(31)), "255.255.255.254");
    assert.equal(bigIntToIp(maskToWildcardBigInt(prefixToMaskBigInt(31))), "0.0.0.1");
    assert.equal(bigIntToIp(prefixToMaskBigInt(32)), "255.255.255.255");
    assert.equal(bigIntToIp(maskToWildcardBigInt(prefixToMaskBigInt(32))), "0.0.0.0");
  });

  test("Validates RFC 1918 private address classification", () => {
    // 10.0.0.0/8
    assert.equal(isRfc1918("10.0.0.1"), true);
    assert.equal(isRfc1918("10.255.255.254"), true);

    // 172.16.0.0/12
    assert.equal(isRfc1918("172.16.0.1"), true);
    assert.equal(isRfc1918("172.31.255.254"), true);
    assert.equal(isRfc1918("172.15.255.255"), false);
    assert.equal(isRfc1918("172.32.0.1"), false);

    // 192.168.0.0/16
    assert.equal(isRfc1918("192.168.1.1"), true);
    assert.equal(isRfc1918("192.168.254.254"), true);
    assert.equal(isRfc1918("192.169.1.1"), false);

    // Public addresses
    assert.equal(isRfc1918("8.8.8.8"), false);
    assert.equal(isRfc1918("1.1.1.1"), false);
  });

  test("Subnet containment and overlap detection", () => {
    // Parent: 10.10.0.0/16 (10.10.0.0 to 10.10.255.255)
    const pNet = ipToBigInt("10.10.0.0");
    const pBcast = ipToBigInt("10.10.255.255");

    // Child 1: 10.10.1.0/24 (10.10.1.0 to 10.10.1.255)
    const c1Net = ipToBigInt("10.10.1.0");
    const c1Bcast = ipToBigInt("10.10.1.255");
    assert.equal(isSubnetContained(c1Net, c1Bcast, pNet, pBcast), true);

    // Child 2: 10.10.2.0/24 (10.10.2.0 to 10.10.2.255)
    const c2Net = ipToBigInt("10.10.2.0");
    const c2Bcast = ipToBigInt("10.10.2.255");
    assert.equal(isSubnetContained(c2Net, c2Bcast, pNet, pBcast), true);

    // Child 1 and Child 2 should not overlap
    assert.equal(subnetsOverlap(c1Net, c1Bcast, c2Net, c2Bcast), false);

    // Overlapping subnet: 10.10.1.128/25 (10.10.1.128 to 10.10.1.255) inside Child 1
    const oNet = ipToBigInt("10.10.1.128");
    const oBcast = ipToBigInt("10.10.1.255");
    assert.equal(subnetsOverlap(c1Net, c1Bcast, oNet, oBcast), true);

    // Outside subnet: 10.11.0.0/24
    const outNet = ipToBigInt("10.11.0.0");
    const outBcast = ipToBigInt("10.11.0.255");
    assert.equal(isSubnetContained(outNet, outBcast, pNet, pBcast), false);
  });

  test("Mutation test: failing to invert mask breaks wildcard detection", () => {
    // Deliberate defect: forgot bitwise inversion ~
    const mutatedMaskToWildcard = (maskBigInt) => maskBigInt & 0xFFFFFFFFn;
    const mask24 = prefixToMaskBigInt(24);
    const mutatedWildcard = mutatedMaskToWildcard(mask24);
    const mutatedWildcardStr = bigIntToIp(mutatedWildcard);

    // Expected valid wildcard for /24 is 0.0.0.255
    assert.notEqual(mutatedWildcardStr, "0.0.0.255");
    assert.equal(mutatedWildcardStr, "255.255.255.0");
  });
});

