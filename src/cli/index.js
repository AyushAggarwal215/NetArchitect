#!/usr/bin/env node
/**
 * src/cli/index.js
 * Command-Line Interface router for NetArchitect (CIC-307).
 */

import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  listPresets,
  loadPresetScenario,
  loadCustomScenario,
  validateCustomScenario,
  executePipeline
} from "./commands.js";
import { NetArchitectError } from "../core/errors.js";

export function printHelp() {
  console.log(`
NetArchitect v2.0 — Automated Network Design & Cisco IOS Configuration Generator
Course: CIC-307 Computer Networks Mini-Project

Usage:
  netarchitect presets
  netarchitect run --preset <campus|metro|wan> [--out <dir>]
  netarchitect run --custom <scenario.json> [--out <dir>]
  netarchitect validate --custom <scenario.json>

Commands:
  presets                  List all built-in network design presets
  run                      Execute complete physical media, VLSM, routing & config pipeline
  validate                 Validate scenario constraints and RFC compliance without export

Options:
  --preset <name>          Use a built-in scenario (campus, metro, wan)
  --custom <path>          Path to a custom JSON scenario file
  --out <dir>              Output directory for generated deliverables (default: out)
  -h, --help               Display this help guide
  -v, --version            Display version information
`);
}

export function main(args = process.argv.slice(2)) {
  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    printHelp();
    return args.length === 0 ? 1 : 0;
  }

  if (args.includes("-v") || args.includes("--version")) {
    console.log("netarchitect 2.0.0 (Node.js ES Modules, CIC-307)");
    return 0;
  }

  const command = args[0];
  const commandArgs = args.slice(1);

  if (command === "presets") {
    return listPresets();
  }

  if (command === "validate") {
    try {
      const options = {
        custom: { type: "string" }
      };
      const { values } = parseArgs({ args: commandArgs, options, allowPositionals: true });
      if (!values.custom) {
        console.error("ERROR: 'validate' requires --custom <path/to/scenario.json>");
        return 1;
      }
      return validateCustomScenario(values.custom);
    } catch (err) {
      if (err instanceof NetArchitectError) {
        console.error(`ERROR: ${err.message}`);
        return err.exitCode;
      }
      console.error(`ERROR: ${err.message}`);
      return 1;
    }
  }

  if (command === "run") {
    try {
      const options = {
        preset: { type: "string" },
        custom: { type: "string" },
        out: { type: "string", default: "out" }
      };
      const { values } = parseArgs({ args: commandArgs, options, allowPositionals: true });

      if (!values.preset && !values.custom) {
        console.error("ERROR: 'run' requires either --preset <name> or --custom <file>");
        return 1;
      }
      if (values.preset && values.custom) {
        console.error("ERROR: Cannot specify both --preset and --custom simultaneously.");
        return 1;
      }

      let scenario;
      if (values.preset) {
        scenario = loadPresetScenario(values.preset);
      } else {
        scenario = loadCustomScenario(values.custom);
      }

      const outDir = values.out || "out";
      return executePipeline(scenario, outDir);
    } catch (err) {
      if (err instanceof NetArchitectError) {
        console.error(`ERROR: ${err.message}`);
        return err.exitCode;
      }
      console.error(`UNEXPECTED ERROR: ${err.message}`);
      return 1;
    }
  }

  console.error(`ERROR: Unknown command '${command}'. Run 'netarchitect --help' for usage.`);
  return 1;
}

// Direct invocation check
const __filename = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const isDirectCall = Boolean(
  invokedPath && (
    invokedPath === __filename ||
    path.basename(invokedPath, path.extname(invokedPath)) === "netarchitect"
  )
);

if (isDirectCall) {
  const exitCode = main(process.argv.slice(2));
  process.exit(exitCode);
}

