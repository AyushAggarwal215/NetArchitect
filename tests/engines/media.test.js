import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { selectMedia, computeOpticalBudget } from "../../src/engines/media.js";
import {
  PhysicalDistanceViolationError,
  OpticalBudgetError,
  InvalidParameterError
} from "../../src/core/errors.js";

describe("Physical Media Selection Engine", () => {
  test("Cat6a copper selected at boundary conditions: 1 m and 100 m", () => {
    const sel1 = selectMedia("SW1", "SW2", 1).selection;
    assert.equal(sel1.mediaType, "Cat6a UTP");
    assert.equal(sel1.standard, "10GBASE-T");

    const sel100 = selectMedia("SW1", "SW2", 100).selection;
    assert.equal(sel100.mediaType, "Cat6a UTP");
    assert.equal(sel100.standard, "10GBASE-T");
    assert.equal(sel100.propagationDelayUs, 0.5);
  });

  test("OM4 Multimode Fiber selected at 101 m and 400 m", () => {
    const sel101 = selectMedia("SW1", "SW2", 101).selection;
    assert.equal(sel101.mediaType, "OM4 MMF");
    assert.equal(sel101.standard, "10GBASE-SR");
    assert.equal(sel101.wavelengthNm, 850);

    const sel400 = selectMedia("SW1", "SW2", 400).selection;
    assert.equal(sel400.mediaType, "OM4 MMF");
    assert.equal(sel400.standard, "10GBASE-SR");
  });

  test("OS2 Single-Mode Fiber selected at 401 m", () => {
    const sel401 = selectMedia("SW1", "SW2", 401).selection;
    assert.equal(sel401.mediaType, "OS2 SMF");
    assert.ok(["LR", "ER", "ZR"].includes(sel401.transceiver));
    assert.ok(sel401.marginDb >= 0);
  });

  test("Explicit copper request beyond 100 m throws PhysicalDistanceViolationError", () => {
    assert.throws(
      () => selectMedia("SW1", "SW2", 101, { mediaRequest: "copper" }),
      PhysicalDistanceViolationError
    );

    assert.throws(
      () => selectMedia("SW1", "SW2", 150, { mediaRequest: "copper" }),
      (err) => {
        assert.ok(err instanceof PhysicalDistanceViolationError);
        assert.ok(err.message.includes("100 m maximum channel length"));
        assert.ok(err.message.includes("IEEE 802.3an"));
        return true;
      }
    );
  });

  test("Invalid zero or negative distance throws InvalidParameterError", () => {
    assert.throws(() => selectMedia("SW1", "SW2", 0), InvalidParameterError);
    assert.throws(() => selectMedia("SW1", "SW2", -50), InvalidParameterError);
    assert.throws(() => selectMedia("SW1", "SW2", "not_a_number"), InvalidParameterError);
  });

  test("Optical power budget calculations: 10 km selects ER because LR margin is negative", () => {
    // LR calculation at 10 km:
    // Budget = -8.2 - (-14.4) = 6.2 dB
    // Loss = 10 * 0.35 + 2.0 + 0.5 + 2.0 = 8.0 dB
    // Margin = 6.2 - 8.0 = -1.8 dB (< 0, so LR rejected)
    const lrBudget = computeOpticalBudget("LR", 10.0);
    assert.equal(lrBudget.budgetDb, 6.2);
    assert.equal(lrBudget.totalLossDb, 8.0);
    assert.equal(lrBudget.marginDb, -1.8);

    // ER calculation at 10 km:
    // Budget = -4.7 - (-15.8) = 11.1 dB
    // Loss = 10 * 0.25 + 2.0 + 0.5 + 2.0 = 7.0 dB
    // Margin = 11.1 - 7.0 = +4.1 dB (>= 0, so ER accepted)
    const erBudget = computeOpticalBudget("ER", 10.0);
    assert.equal(erBudget.budgetDb, 11.1);
    assert.equal(erBudget.totalLossDb, 7.0);
    assert.equal(erBudget.marginDb, 4.1);

    const sel10k = selectMedia("HQ", "R1", 10000).selection;
    assert.equal(sel10k.transceiver, "ER");
    assert.equal(sel10k.marginDb, 4.1);
  });

  test("Optical power budget calculations: 35 km selects ZR with positive margin", () => {
    const sel35k = selectMedia("HQ", "R2", 35000).selection;
    assert.equal(sel35k.mediaType, "OS2 SMF");
    assert.equal(sel35k.transceiver, "ZR");
    assert.equal(sel35k.marginDb, 9.55);
  });

  test("Optical budget failure at 80 km throws OpticalBudgetError", () => {
    // At 80 km, ZR loss: 80 * 0.25 (20 dB) + 2.0 (conn) + 40 * 0.1 (4 dB splices) + 2.0 (safety) = 28 dB
    // ZR budget = 24 dB. Margin = -4.0 dB
    assert.throws(
      () => selectMedia("SiteA", "SiteB", 80000),
      OpticalBudgetError
    );
  });

  test("Links beyond 80 km recommend Carrier WAN circuit with IPsec", () => {
    const { selection, decisions } = selectMedia("CityA", "CityB", 85000);
    assert.equal(selection.mediaType, "Carrier WAN Circuit");
    assert.equal(selection.wanCircuit, true);
    assert.ok(decisions.some(d => d.references.includes("RFC 4301")));
  });

  test("Metro latency verification checks physical propagation delay + equipment allowance", () => {
    const { selection, decisions } = selectMedia("HQ", "R1", 15000, { profile: "metro" });
    // 15 km * 5 us/km = 75 us = 0.075 ms + 1.0 ms = 1.075 ms < 5 ms
    assert.equal(selection.propagationDelayUs, 75);
    const delayDec = decisions.find(d => d.domain === "qos");
    assert.ok(delayDec);
    assert.ok(delayDec.choice.includes("FEASIBLE"));
    assert.ok(delayDec.choice.includes("1.07") || delayDec.choice.includes("1.08"));
  });
});
