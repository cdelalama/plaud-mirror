#!/usr/bin/env node

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { inspect } from "node:util";

import {
  getDefaultRecordingsDir,
  getDefaultReportPath,
  loadSpikeEnvironment,
  runDetail,
  runDownload,
  runList,
  runProbe,
  runValidate,
  type ProbeOptions,
} from "../phase1/spike.js";

type CommandName = "validate" | "list" | "detail" | "download" | "probe";

export interface ParsedArguments {
  command: CommandName;
  json: boolean;
  options: ProbeOptions;
  recordingId?: string;
}

async function main(): Promise<void> {
  const parsed = parseArguments(process.argv.slice(2));
  const environment = loadSpikeEnvironment();

  switch (parsed.command) {
    case "validate": {
      const result = await runValidate(environment);
      printResult(result, parsed.json);
      return;
    }
    case "list": {
      const result = await runList(environment, parsed.options);
      printResult(result, parsed.json);
      return;
    }
    case "detail": {
      if (!parsed.recordingId) {
        throw new Error("detail requires --id <recording-id>");
      }

      const result = await runDetail(environment, parsed.recordingId);
      printResult(result, parsed.json);
      return;
    }
    case "download": {
      if (!parsed.recordingId) {
        throw new Error("download requires --id <recording-id>");
      }

      const result = await runDownload(
        environment,
        parsed.recordingId,
        parsed.options.recordingsDir,
        parsed.options.opus ?? false,
      );
      printResult(result, parsed.json);
      return;
    }
    case "probe": {
      const result = await runProbe(environment, parsed.options);
      printResult(result.report, parsed.json);
      return;
    }
  }
}

export function parseArguments(argv: string[]): ParsedArguments {
  if (argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  let command: CommandName = "probe";
  if (argv[0] && !argv[0].startsWith("-")) {
    const candidate = argv.shift();
    if (isCommandName(candidate)) {
      command = candidate;
    } else {
      throw new Error(`unknown command: ${candidate}`);
    }
  }

  const options: ProbeOptions = {
    limit: 200,
    recordingsDir: getDefaultRecordingsDir(),
    reportPath: getDefaultReportPath(),
  };
  let json = false;
  let recordingId: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    switch (argument) {
      case "--json":
        json = true;
        break;
      case "--limit":
        options.limit = parsePositiveInteger(readNext(argv, index, argument));
        index += 1;
        break;
      case "--from":
        options.from = parseDateBoundary(readNext(argv, index, argument), "start");
        index += 1;
        break;
      case "--to":
        options.to = parseDateBoundary(readNext(argv, index, argument), "end");
        index += 1;
        break;
      case "--serial-number":
        options.serialNumber = readNext(argv, index, argument);
        index += 1;
        break;
      case "--scene":
        options.scene = Number(readNext(argv, index, argument));
        index += 1;
        break;
      case "--detail-id":
        options.detailId = readNext(argv, index, argument);
        index += 1;
        break;
      case "--download-id":
        options.downloadId = readNext(argv, index, argument);
        index += 1;
        break;
      case "--download-first":
        options.downloadFirst = true;
        break;
      case "--opus":
        options.opus = true;
        break;
      case "--report-path":
        options.reportPath = resolve(readNext(argv, index, argument));
        index += 1;
        break;
      case "--recordings-dir":
        options.recordingsDir = resolve(readNext(argv, index, argument));
        index += 1;
        break;
      case "--id":
        recordingId = readNext(argv, index, argument);
        index += 1;
        break;
      default:
        throw new Error(`unknown argument: ${argument}`);
    }
  }

  return recordingId ? {
    command,
    json,
    options,
    recordingId,
  } : {
    command,
    json,
    options,
  };
}

function printResult(value: unknown, json: boolean): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${inspect(value, { depth: null, colors: false, compact: false })}\n`);
}

function printUsage(): void {
  process.stdout.write(`Plaud Mirror Phase 1 spike

Usage:
  npm run spike -- <command> [options]

Commands:
  validate                  Validate the bearer token with /user/me
  list                      List recordings and apply local filters
  detail --id <id>          Fetch /file/detail/<id>
  download --id <id>        Fetch /file/temp-url/<id> and mirror the audio locally
  probe                     Validate, list, inspect, and optionally download one recording

Environment:
  PLAUD_MIRROR_ACCESS_TOKEN   Required bearer token
  PLAUD_MIRROR_API_BASE       Optional Plaud API base override

Common options:
  --json
  --limit <n>
  --from <YYYY-MM-DD>
  --to <YYYY-MM-DD>
  --serial-number <value>
  --scene <number>
  --recordings-dir <path>
  --report-path <path>
  --detail-id <recording-id>
  --download-id <recording-id>
  --download-first
  --opus
`);
}

function readNext(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function parsePositiveInteger(input: string): number {
  const value = Number(input);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`expected a positive integer, received: ${input}`);
  }
  return value;
}

function parseDateBoundary(input: string, mode: "start" | "end"): number {
  const date = mode === "start"
    ? new Date(`${input}T00:00:00.000Z`)
    : new Date(`${input}T23:59:59.999Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`invalid date value: ${input}`);
  }
  return date.getTime();
}

function isCommandName(input: string | undefined): input is CommandName {
  return input === "validate" || input === "list" || input === "detail" || input === "download" || input === "probe";
}

if (isEntrypoint(import.meta.url, process.argv[1])) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}

function isEntrypoint(moduleUrl: string, entryPath: string | undefined): boolean {
  if (!entryPath) {
    return false;
  }

  return moduleUrl === pathToFileURL(entryPath).href;
}
