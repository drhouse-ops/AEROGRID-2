import { Hotspot } from "../types/api";

/**
 * Generates structured, deterministic explanation statements for why a signal was promoted.
 */
export function generatePromotionExplanations(hotspot: Hotspot | null | undefined): string[] {
  const explanations: string[] = [];
  if (!hotspot) return explanations;

  // 1. Citizen Observations
  const fusionAny = hotspot.fusion as any;
  if (fusionAny && fusionAny.correlationExplanation) {
    explanations.push(fusionAny.correlationExplanation);
  } else {
    const count = hotspot.citizenReports?.length || hotspot.reportsCount || 0;
    if (count > 1) {
      explanations.push(`${count} nearby citizen observations were correlated.`);
    } else if (count === 1) {
      explanations.push("Nearby citizen observations were correlated.");
    }
  }

  // 2. Gemini Category / Fallback Analysis Category
  const latestReport = hotspot.citizenReports?.[0];
  const analysis = latestReport?.analysis;
  const analysisSource = analysis?.analysisSource;
  const isGemini = analysisSource === "GEMINI_MULTIMODAL";
  const categoryAgreement = latestReport?.categoryAgreement || analysis?.categoryAgreement;
  const aiDetectedCategory = latestReport?.aiDetectedCategory || analysis?.aiDetectedCategory || analysis?.eventType;

  const displayAiCat = aiDetectedCategory || "UNKNOWN";
  if (isGemini) {
    if (categoryAgreement === "AGREES") {
      explanations.push(`Gemini evidence agrees with the citizen-selected incident category.`);
    } else if (categoryAgreement === "CONFLICT") {
      explanations.push(`Gemini evidence conflicts with the citizen-selected category and identified ${displayAiCat}.`);
    }
  } else {
    if (categoryAgreement === "AGREES") {
      explanations.push(`Evidence analysis agrees with the citizen-selected category.`);
    } else if (categoryAgreement === "CONFLICT") {
      explanations.push(`Evidence analysis indicates a category conflict and identified ${displayAiCat}.`);
    } else if (analysisSource) {
      explanations.push("Citizen evidence analysis supports the correlated signal.");
    }
  }

  // 3. NASA FIRMS
  const tc = hotspot.context?.thermalContext;
  if (tc) {
    if (tc.available && tc.detectionFound) {
      explanations.push("NASA FIRMS detected nearby thermal anomaly context.");
    } else if (tc.available && !tc.detectionFound) {
      explanations.push("No recent nearby FIRMS thermal anomaly was detected.");
    }
  }

  // 4. Government AQ Context
  const gm = hotspot.context?.groundMonitoring;
  if (gm && gm.available) {
    if (gm.pollutant && gm.stationName) {
      explanations.push(`Government ${gm.pollutant} context is available from ${gm.stationName}.`);
    }
    if (gm.anomalyAvailable) {
      explanations.push("Government AQ anomaly context is available.");
    }
  }

  // 5. Google Weather
  const wc = hotspot.context?.weatherContext;
  if (wc && wc.available) {
    if (wc.dispersionCondition) {
      explanations.push(`Weather conditions indicate ${wc.dispersionCondition} dispersion.`);
    }
    if (wc.persistenceScore !== null && wc.persistenceScore !== undefined) {
      explanations.push(`Current atmospheric persistence score is ${wc.persistenceScore.toFixed(2)}.`);
    }
  }

  return explanations;
}
