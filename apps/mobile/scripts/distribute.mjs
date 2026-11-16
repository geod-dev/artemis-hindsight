#!/usr/bin/env node
// Sends the newest finished preview APK to the family's testers with Firebase App Distribution.
// No Firebase SDK goes into the app: this only hands the APK to the testers (no Analytics).
//
// Usage (from apps/mobile):
//   npm run distribute                 newest finished preview build from EAS
//   npm run distribute -- ./app.apk    a local APK instead
//   npm run distribute -- --dry-run    print what would be sent, send nothing
//
// Testers are every tester of the Firebase project (App Distribution > Testers & groups), managed in the console.
// Sending needs a Firebase login: npx firebase-tools login.
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FIREBASE_APP_ID = "1:853637432481:android:c3ab479246394ef1ed5ce0";
const FIREBASE_PROJECT = "artemis-5498f";

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

/** Every tester of the Firebase project, read from the CLI's table (one row per tester). */
function testers() {
  const output = run("npx", ["--yes", "firebase-tools", "appdistribution:testers:list", "--project", FIREBASE_PROJECT]);
  const emails = [...new Set(output.match(/[\w.+-]+@[\w.-]+\.\w+/g) ?? [])];
  if (emails.length === 0) throw new Error("No testers in the Firebase project: add them in App Distribution > Testers & groups");
  return emails;
}

const { apk, commit, subject } = localApk
  ? { apk: localApk, commit: "local", subject: "local APK" }
  : await latestPreviewApk();
const notes = `${commit.slice(0, 7)}: ${subject}`.replace(/"/g, "'");
const emails = testers();
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
  emails.join(","),
  "--release-notes",
  `"${notes}"`,
];

if (dryRun) {
  console.log(`would run: npx ${distributeArgs.join(" ")}`);
  process.exit(0);
}
console.log(`sending ${apk} (${notes}) to ${emails.length} tester(s)`);
console.log(run("npx", distributeArgs));
