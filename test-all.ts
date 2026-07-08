import { execSync } from "node:child_process";

console.log("=================================================");
console.log("🚀 RUNNING ALL AEROGRID TEST SUITES");
console.log("=================================================");

const suites = [
  "test-categories.ts",
  "test-correlation.ts",
  "test-firms.ts",
  "test-voice.ts",
  "test-weather.ts",
  "test-pilot.ts"
];

let failed = false;

for (const suite of suites) {
  console.log(`\n📦 Running: ${suite}...`);
  try {
    execSync(`npx tsx ${suite}`, { stdio: "inherit" });
    console.log(`🟢 Completed: ${suite} successfully.`);
  } catch (err) {
    console.error(`🔴 Failed: ${suite} encountered an error.`);
    failed = true;
  }
}

console.log("\n=================================================");
if (failed) {
  console.error("❌ ALL TESTS: SOME TEST SUITES FAILED.");
  process.exit(1);
} else {
  console.log("💚 ALL TESTS: ALL TEST SUITES PASSED SUCCESSFULLY.");
  process.exit(0);
}
