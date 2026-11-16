#!/usr/bin/env node
// Sends the newest finished preview APK to the family's testers with Firebase App Distribution.
// No Firebase SDK goes into the app: this only hands the APK to the testers (no Analytics).
//
// Usage (from apps/mobile):
//   npm run distribute                 newest finished preview build from EAS
//   npm run distribute -- ./app.apk    a local APK instead
//   npm run distribute -- --dry-run    print what would be sent, send nothing
//
// Testers: ARTEMIS_TESTERS="a@example.com,b@example.com", or the file .firebase-testers next to package.json
// (one address per line, gitignored). Sending needs a Firebase login: npx firebase-tools login.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FIREBASE_APP_ID = "1:853637432481:android:c3ab479246394ef1ed5ce0";
const FIREBASE_PROJECT = "artemis-5498f";
const TESTERS_FILE = new URL("../.firebase-testers", import.meta.url);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const localApk = args.find((arg) => !arg.startsWith("--"));

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { encoding: "utf8", shell: true });
  if (result.status !== 0) {
    throw new Error(`${command} ${commandArgs.join(" ")} failed:\n${result.stdout ?? ""}${result.stderr ?? ""}`);
  }
  return result.stdout;
}

/** The newest finished preview APK on EAS, with the commit it was built from. */
async function latestPreviewApk() {
  const builds = JSON.parse(run("npx", ["eas-cli", "build:list", "--platform", "android", "--limit", "10", "--json", "--non-interactive"]));
  const build = builds.find((b) => b.buildProfile === "preview" && b.status === "FINISHED" && b.artifacts?.buildUrl);
  if (!build) throw new Error("No finished preview Android build. Start one with: npx eas-cli build --platform android --profile preview");
  const response = await fetch(build.artifacts.buildUrl);
  if (!response.ok) throw new Error(`Downloading the APK failed: HTTP ${response.status}`);
  const apk = join(mkdtempSync(join(tmpdir(), "artemis-apk-")), `artemis-${build.appBuildVersion}.apk`);
  writeFileSync(apk, Buffer.from(await response.arrayBuffer()));
  return { apk, commit: build.gitCommitHash, subject: (build.gitCommitMessage ?? "").split("\n")[0] };
}

function testers() {
  const fromEnv = process.env.ARTEMIS_TESTERS;
  const fromFile = existsSync(TESTERS_FILE) ? readFileSync(TESTERS_FILE, "utf8") : "";
  const list = (fromEnv ?? fromFile).split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) throw new Error("No testers: set ARTEMIS_TESTERS or create apps/mobile/.firebase-testers");
  return list;
}

const { apk, commit, subject } = localApk
  ? { apk: localApk, commit: "local", subject: "local APK" }
  : await latestPreviewApk();
const notes = `${commit.slice(0, 7)}: ${subject}`.replace(/"/g, "'");
const distributeArgs = [
  "--yes",
  "firebase-tools",
  "appdistribution:distribute",
  apk,
  "--app",
  FIREBASE_APP_ID,
  "--project",
  FIREBASE_PROJECT,
  "--testers",
  testers().join(","),
  "--release-notes",
  `"${notes}"`,
];

if (dryRun) {
  console.log(`would run: npx ${distributeArgs.join(" ")}`);
  process.exit(0);
}
console.log(`sending ${apk} (${notes}) to ${testers().length} tester(s)`);
console.log(run("npx", distributeArgs));
