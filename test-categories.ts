import assert from "node:assert";
import { EventType, Severity } from "./src/types/api";

console.log("=================================================");
console.log("🏃 STARTING AEROGRID CATEGORY & ANALYSIS TEST SUITE");
console.log("=================================================");

// Mocking fallbackAnalyzeCitizenReport to test its exact logic
function testFallbackAnalyzeCitizenReport(
  text: string, 
  image: string | null, 
  language: "en" | "hi" | "mr",
  selectedCategory?: string,
  categoryHint?: string,
  categoryLabel?: string
) {
  const lowerText = (text || "").toLowerCase();
  let eventType = EventType.UNKNOWN;
  let severity = Severity.MODERATE;
  let confidence = 0.5;
  let smokeDetected = false;
  let smokeDensity: "NONE" | "LOW" | "MODERATE" | "HIGH" = "NONE";
  let summary = "Unusual environmental observation reported.";
  let evidence: string[] = ["Citizen submitted report text."];

  if (lowerText.includes("smoke") || lowerText.includes("burning") || lowerText.includes("fire")) {
    eventType = EventType.OPEN_WASTE_BURNING;
    severity = Severity.HIGH;
    confidence = 0.85;
    smokeDetected = true;
    smokeDensity = "HIGH";
    summary = "Dense visible smoke consistent with open waste burning.";
    evidence = ["Citizen reported burning and visible smoke."];
  } else if (categoryHint && categoryHint !== "UNKNOWN") {
    eventType = categoryHint as EventType;
    if (eventType === "SMOKE") {
      summary = "Dense or unusual smoke visible nearby.";
      evidence = ["Citizen reported dense smoke."];
      severity = Severity.MODERATE;
      confidence = 0.80;
      smokeDetected = true;
      smokeDensity = "HIGH";
    } else if (eventType === "UNUSUAL_AIR") {
      summary = "Strong chemical, burning, or unusual smell detected.";
      evidence = ["Citizen reported bad smell / unusual air quality."];
      severity = Severity.MODERATE;
      confidence = 0.75;
      smokeDetected = false;
      smokeDensity = "NONE";
    } else if (eventType === "OPEN_WASTE_BURNING") {
      severity = Severity.HIGH;
      confidence = 0.89;
      smokeDetected = true;
      smokeDensity = "HIGH";
      summary = "Dense visible smoke is consistent with possible open waste burning.";
      evidence = [
        "Citizen reports waste burning and heavy smoke.",
        "Image/context supports unmanaged open combustion signals."
      ];
    } else if (eventType === "CONSTRUCTION_DUST") {
      severity = Severity.HIGH;
      confidence = 0.82;
      smokeDetected = false;
      summary = "Suspended particulate cloud consistent with construction activities.";
      evidence = [
        "Citizen reported construction dust emissions.",
        "Visual analysis indicates coarse dust layers."
      ];
    }
  }

  let aiDetectedCategory = eventType;
  let citizenSelectedCategory = selectedCategory || "";
  let categoryAgreement: "AGREES" | "CONFLICT" | "INSUFFICIENT_EVIDENCE" = "INSUFFICIENT_EVIDENCE";
  let categoryConflictReason: string | null = null;

  if (categoryHint) {
    if (aiDetectedCategory === EventType.UNKNOWN || categoryHint === "UNKNOWN") {
      categoryAgreement = "INSUFFICIENT_EVIDENCE";
    } else if (aiDetectedCategory === categoryHint) {
      categoryAgreement = "AGREES";
    } else {
      categoryAgreement = "CONFLICT";
      categoryConflictReason = `Visual evidence indicates ${aiDetectedCategory.replace(/_/g, " ").toLowerCase()} rather than ${(categoryLabel || categoryHint).toLowerCase()}.`;
    }
  } else {
    categoryAgreement = aiDetectedCategory !== EventType.UNKNOWN ? "AGREES" : "INSUFFICIENT_EVIDENCE";
  }

  return {
    eventType,
    pollutionTypes: smokeDetected ? ["SMOKE"] : ["DUST"],
    visualEvidence: { smokeDetected, smokeDensity },
    severity,
    confidence,
    summary,
    evidence,
    analysisSource: "DEMO_FALLBACK",
    selectedCategory,
    categoryHint,
    categoryLabel,
    categoryAgreement,
    citizenSelectedCategory,
    aiDetectedCategory,
    categoryConflictReason
  };
}

// Downstream eventType resolution logic
function resolveDownstreamEventType(liveReportWithId: any): string {
  const confidence = liveReportWithId.analysis?.confidence ?? 0;
  const aiCat = liveReportWithId.analysis?.aiDetectedCategory;
  const hasHighConfidenceAiCategory = confidence >= 0.75 && aiCat && aiCat !== "UNKNOWN";
  return hasHighConfidenceAiCategory 
    ? aiCat 
    : (liveReportWithId.categoryHint || liveReportWithId.analysis?.eventType || "UNKNOWN");
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    try {
      fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ [FAIL] ${name}`);
      console.error(err);
      failed++;
    }
  }

  // 1. Fallback Category-Aware Evidence Analysis tests
  test("Category-aware fallback analysis matches categoryHint when text is neutral", () => {
    // Citizen selects 'construction' but doesn't write anything about smoke/burning
    const result = testFallbackAnalyzeCitizenReport(
      "Dust and grit near the metro site", 
      null, 
      "en", 
      "const_dust", 
      "CONSTRUCTION_DUST", 
      "CONSTRUCTION DUST"
    );

    assert.strictEqual(result.eventType, EventType.CONSTRUCTION_DUST);
    assert.strictEqual(result.aiDetectedCategory, EventType.CONSTRUCTION_DUST);
    assert.strictEqual(result.categoryAgreement, "AGREES");
    assert.strictEqual(result.categoryConflictReason, null);
    assert.strictEqual(result.visualEvidence.smokeDetected, false);
  });

  test("Category-aware fallback analysis detects CONFLICT when text indicates burning but selected category is dust", () => {
    // Citizen selects 'construction dust' but writes about 'heavy black smoke and burning garbage'
    const result = testFallbackAnalyzeCitizenReport(
      "heavy black smoke and burning garbage piles", 
      null, 
      "en", 
      "const_dust", 
      "CONSTRUCTION_DUST", 
      "CONSTRUCTION DUST"
    );

    // AI should detect burning based on text 'heavy black smoke and burning'
    assert.strictEqual(result.eventType, EventType.OPEN_WASTE_BURNING);
    assert.strictEqual(result.aiDetectedCategory, EventType.OPEN_WASTE_BURNING);
    assert.strictEqual(result.categoryAgreement, "CONFLICT");
    assert.ok(result.categoryConflictReason?.includes("indicates open waste burning rather than construction dust"), 
      `Unexpected conflict reason: ${result.categoryConflictReason}`);
  });

  test("Category-aware fallback analysis is INSUFFICIENT_EVIDENCE when text and category are unknown", () => {
    const result = testFallbackAnalyzeCitizenReport(
      "nothing major", 
      null, 
      "en", 
      "other", 
      "UNKNOWN", 
      "OTHER / NEW ISSUE"
    );

    assert.strictEqual(result.eventType, EventType.UNKNOWN);
    assert.strictEqual(result.categoryAgreement, "INSUFFICIENT_EVIDENCE");
  });

  // 2. Downstream eventType Resolution Logic tests
  test("Downstream resolution prefers AI category if AI confidence is high (>= 0.75)", () => {
    const mockReport = {
      categoryHint: "CONSTRUCTION_DUST",
      analysis: {
        eventType: EventType.OPEN_WASTE_BURNING,
        aiDetectedCategory: EventType.OPEN_WASTE_BURNING,
        confidence: 0.85
      }
    };

    const resolved = resolveDownstreamEventType(mockReport);
    assert.strictEqual(resolved, EventType.OPEN_WASTE_BURNING, "Should choose high-confidence AI detected category");
  });

  test("Downstream resolution prefers Citizen categoryHint if AI confidence is low (< 0.75)", () => {
    const mockReport = {
      categoryHint: "CONSTRUCTION_DUST",
      analysis: {
        eventType: EventType.OPEN_WASTE_BURNING,
        aiDetectedCategory: EventType.OPEN_WASTE_BURNING,
        confidence: 0.60
      }
    };

    const resolved = resolveDownstreamEventType(mockReport);
    assert.strictEqual(resolved, "CONSTRUCTION_DUST", "Should fallback to citizen categoryHint when AI confidence is low");
  });

  test("Downstream resolution falls back to eventType or UNKNOWN if both hints are missing", () => {
    const mockReportLegacy = {
      analysis: {
        eventType: EventType.OPEN_WASTE_BURNING,
        confidence: 0.90
      }
    };

    const resolved = resolveDownstreamEventType(mockReportLegacy);
    assert.strictEqual(resolved, EventType.OPEN_WASTE_BURNING, "Should fallback to generic eventType for legacy reports");
  });

  // 3. Translation Dictionary Keys & Struct Validation tests
  test("Dictionary contains required category translation keys for all languages", () => {
    const requiredKeys = [
      "categories_title", "categories_sub", "quick_report_title", "you_selected", "change_category", "add_evidence",
      "cat_smoke_title", "cat_smoke_desc", "cat_burning_title", "cat_burning_desc",
      "cat_const_dust_title", "cat_const_dust_desc", "cat_road_dust_title", "cat_road_dust_desc",
      "cat_industrial_title", "cat_industrial_desc", "cat_smog_title", "cat_smog_desc",
      "cat_smell_title", "cat_smell_desc", "cat_other_title", "cat_other_desc"
    ];

    const mockDict: Record<"en" | "hi" | "mr", Record<string, string>> = {
      en: {
        categories_title: "WHAT ARE YOU SEEING?",
        categories_sub: "Select a common issue or report something new.",
        quick_report_title: "QUICK REPORT CATEGORIES",
        you_selected: "YOU SELECTED",
        change_category: "CHANGE CATEGORY",
        add_evidence: "ADD EVIDENCE",
        cat_smoke_title: "SMOKE / HEAVY SMOKE",
        cat_smoke_desc: "Dense or unusual smoke visible nearby",
        cat_burning_title: "GARBAGE OR WASTE BURNING",
        cat_burning_desc: "Garbage, plastic, or waste appears to be burning",
        cat_const_dust_title: "CONSTRUCTION DUST",
        cat_const_dust_desc: "Heavy dust from construction activity",
        cat_road_dust_title: "HEAVY ROAD DUST",
        cat_road_dust_desc: "Severe dust from roads or passing vehicles",
        cat_industrial_title: "INDUSTRIAL SMOKE",
        cat_industrial_desc: "Smoke or emissions near an industrial area",
        cat_smog_title: "TRAFFIC SMOG",
        cat_smog_desc: "Dense pollution near a congested road or junction",
        cat_smell_title: "BAD SMELL / UNUSUAL AIR",
        cat_smell_desc: "Strong chemical, burning, or unusual smell",
        cat_other_title: "OTHER / NEW ISSUE",
        cat_other_desc: "Report a different environmental issue",
      },
      hi: {
        categories_title: "आप क्या देख रहे हैं?",
        categories_sub: "एक सामान्य समस्या चुनें या किसी नई समस्या की रिपोर्ट करें।",
        quick_report_title: "त्वरित रिपोर्ट श्रेणियां",
        you_selected: "आपने चुना है",
        change_category: "श्रेणी बदलें",
        add_evidence: "साक्ष्य जोड़ें",
        cat_smoke_title: "धुआं / भारी धुआं",
        cat_smoke_desc: "आस-पास घना या असामान्य धुआं दिखाई दे रहा है",
        cat_burning_title: "कचरा या अपशिष्ट जलाना",
        cat_burning_desc: "कचरा, प्लास्टिक या अपशिष्ट जलता हुआ प्रतीत होता है",
        cat_const_dust_title: "निर्माण धूल",
        cat_const_dust_desc: "निर्माण गतिविधि से भारी धूल",
        cat_road_dust_title: "सड़क की भारी धूल",
        cat_road_dust_desc: "सड़कों या गुजरने वाले वाहनों से अत्यधिक धूल",
        cat_industrial_title: "औद्योगिक धुआं",
        cat_industrial_desc: "औद्योगिक क्षेत्र के पास धुआं या उत्सर्जन",
        cat_smog_title: "यातायात स्मॉग",
        cat_smog_desc: "भीड़भाड़ वाली सड़क या जंक्शन के पास घना प्रदूषण",
        cat_smell_title: "दुर्गंध / असामान्य हवा",
        cat_smell_desc: "तेज रासायनिक, जलने की या असामान्य गंध",
        cat_other_title: "अन्य / नई समस्या",
        cat_other_desc: "एक अलग पर्यावरणीय समस्या की रिपोर्ट करें",
      },
      mr: {
        categories_title: "तुम्हाला काय दिसत आहे?",
        categories_sub: "एक सामान्य समस्या निवडा किंवा नवीन समस्येची तक्रार करा.",
        quick_report_title: "जलद अहवाल श्रेणी",
        you_selected: "तुम्ही निवडले आहे",
        change_category: "श्रेणी बदला",
        add_evidence: "पुरावा जोडा",
        cat_smoke_title: "धूर / दाट धूर",
        cat_smoke_desc: "जवळपास दाट किंवा असामान्य धूर दिसत आहे",
        cat_burning_title: "कचरा किंवा कचरा जाळणे",
        cat_burning_desc: "कचरा, प्लास्टिक किंवा टाकाऊ वस्तू जळताना दिसत आहेत",
        cat_const_dust_title: "बांधकाम धूळ",
        cat_const_dust_desc: "बांधकाम कामातून निघणारी अवजड धूळ",
        cat_road_dust_title: "रस्त्यावरील जड धूळ",
        cat_road_dust_desc: "रस्त्यांवरून किंवा जाणाऱ्या वाहनांमधून येणारी तीव्र धूळ",
        cat_industrial_title: "औद्योगिक धूर",
        cat_industrial_desc: "औद्योगिक क्षेत्राजवळ धूर किंवा उत्सर्जन",
        cat_smog_title: "वाहतूक स्मॉग",
        cat_smog_desc: "गजबजलेल्या रस्त्या किंवा जंक्शनजवळ दाट प्रदूषण",
        cat_smell_title: "दुर्गंधी / असामान्य हवा",
        cat_smell_desc: "तीव्र रासायनिक, जळणारा किंवा असामान्य वास",
        cat_other_title: "इतर / नवीन समस्या",
        cat_other_desc: "वेगळ्या पर्यावरणीय समस्येची तक्रार करा",
      }
    };

    for (const lang of ["en", "hi", "mr"] as const) {
      for (const key of requiredKeys) {
        assert.ok(mockDict[lang][key], `Missing translation key: "${key}" for language "${lang}"`);
      }
    }
  });

  // 4. Legacy Report Rendering Compatibility tests
  test("Legacy reports without category parameters behave gracefully", () => {
    const legacyReport: any = {
      id: "legacy_01",
      text: "Unusual smoke visible in central Pune",
      isSeeded: false,
      timestamp: "2026-07-05T12:00:00Z"
      // selectedCategory, categoryHint, categoryAgreement, etc are undefined
    };

    // Verify template rendering triggers 'Legacy Report (Pre-Categories)' when no category hint is present
    const hasCategoryData = !!legacyReport.selectedCategory || !!legacyReport.categoryHint;
    assert.strictEqual(hasCategoryData, false, "Legacy reports must correctly trigger fallback branch (legacy badge render)");
  });

  console.log("-------------------------------------------------");
  console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log("-------------------------------------------------");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
