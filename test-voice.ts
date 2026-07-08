import assert from "node:assert";
import { 
  mapLanguageToLocale, 
  appendTranscript, 
  mapSpeechError, 
  canSubmitReport 
} from "./src/utils/voiceUtils";

console.log("=================================================");
console.log("🏃 STARTING AEROGRID CITIZEN VOICE INPUT TEST SUITE");
console.log("=================================================");

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
  } catch (err: any) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// 1. language-to-locale mapping
test("language-to-locale mapping matches en, hi, mr correctly", () => {
  assert.strictEqual(mapLanguageToLocale("en"), "en-IN");
  assert.strictEqual(mapLanguageToLocale("hi"), "hi-IN");
  assert.strictEqual(mapLanguageToLocale("mr"), "mr-IN");
});

// 2. existing text + transcript append behavior
test("existing text + transcript append behavior appends correctly with newline", () => {
  assert.strictEqual(appendTranscript("", "First sentence"), "First sentence");
  assert.strictEqual(appendTranscript("Already some text", "Second sentence"), "Already some text\nSecond sentence");
  assert.strictEqual(appendTranscript("  Space padded text  ", "Second sentence"), "Space padded text\nSecond sentence");
});

// 3. voice transcript satisfies OTHER / NEW ISSUE evidence requirement
test("voice transcript satisfies OTHER / NEW ISSUE evidence requirement without typed text", () => {
  // Scenario: OTHER/NEW ISSUE, has location, has transcript (in reportText), no image
  const canSubmit = canSubmitReport("other", "This is spoken transcript", null, 18.5204, 73.8567);
  assert.strictEqual(canSubmit, true, "Should allow submission when other category has transcript evidence and location");

  // Scenario: OTHER/NEW ISSUE, has location, empty transcript, no image
  const cannotSubmit = canSubmitReport("other", "", null, 18.5204, 73.8567);
  assert.strictEqual(cannotSubmit, false, "Should not allow submission when other category has no evidence");
});

// 4. recognition error state mapping
test("recognition error state mapping works for all expected errors", () => {
  const deniedError = mapSpeechError("not-allowed");
  assert.strictEqual(deniedError.title, "MICROPHONE ACCESS DENIED");
  assert.strictEqual(deniedError.subtitle, "Enable microphone permission in your browser and try again.");

  const serviceDeniedError = mapSpeechError("service-not-allowed");
  assert.strictEqual(serviceDeniedError.title, "MICROPHONE ACCESS DENIED");

  const noSpeechError = mapSpeechError("no-speech");
  assert.strictEqual(noSpeechError.title, "NO SPEECH DETECTED");
  assert.strictEqual(noSpeechError.subtitle, "Try speaking again.");

  const networkError = mapSpeechError("network");
  assert.strictEqual(networkError.title, "NETWORK ERROR");

  const abortedError = mapSpeechError("aborted");
  assert.strictEqual(abortedError.title, "VOICE INPUT ABORTED");
});

console.log("-------------------------------------------------");
console.log("📊 VOICE TEST SUITE SUMMARY: ALL PASSED");
console.log("-------------------------------------------------");
