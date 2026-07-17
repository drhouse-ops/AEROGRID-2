import { FusionEvaluation } from "../src/types/api";
import { FUSION_CONFIG, resolveBandedScore } from "../src/config/fusionConfig";

export interface FusionInputs {
  citizenCorrelation: number;       // C: Correlation with other citizen reports
  visualEvidenceConfidence: number;  // V: Multi-modal AI visual evidence confidence
  groundMonitoringAnomaly: number | null;   // S: Local air quality ground monitoring anomaly index (nullable)
  geospatialCorrelation: number;     // G: Spatial proximity index (e.g. within 500m)
  temporalCorrelation: number;       // T: Time correlation index (e.g. within 30m)
  atmosphericPersistence: number | null;    // M: Atmospheric wind dispersion index (LOW speed = high persistence)
  thermalContextScore?: number;      // Optional: NASA FIRMS thermal context score
}

export class SignalFusionService {
  /**
   * Evaluates and fuses multi-source environmental signals into a unified threat classification.
   * 
   * PROTOTYPE FORMULA (weights externalised in FUSION_CONFIG):
   * H = wC*C + wV*V + wS*S + wG*G + wT*T + wM*M
   * 
   * Contextual Modifier:
   * For combustion-related incidents, a nearby NASA FIRMS thermal anomaly 
   * can act as a supporting contextual modifier, adding up to +maxBonus (TCS * maxBonus) 
   * to the final fusion score (capped at 1.00).
   * 
   * If any of the core dimensions are null/unavailable, we exclude their weights and
   * normalize the remaining active dimensions (sum of remaining weights as the denominator).
   */
  static evaluate(inputs: FusionInputs): FusionEvaluation {
    const w = FUSION_CONFIG.fusionWeights;
    const C = inputs.citizenCorrelation;
    const V = inputs.visualEvidenceConfidence;
    const S = inputs.groundMonitoringAnomaly;
    const G = inputs.geospatialCorrelation;
    const T = inputs.temporalCorrelation;
    const M = inputs.atmosphericPersistence;
    const TCS = inputs.thermalContextScore !== undefined ? inputs.thermalContextScore : 0;

    const dimensions = [
      { name: "citizenReportCorrelation", value: C, weight: w.citizenReportCorrelation, label: "Citizen Report Correlation" },
      { name: "visualEvidenceConfidence", value: V, weight: w.visualEvidenceConfidence, label: "Visual Evidence Confidence" },
      { name: "groundMonitoringAnomaly", value: S, weight: w.groundMonitoringAnomaly, label: "Ground Monitoring Anomaly" },
      { name: "geospatialCorrelation", value: G, weight: w.geospatialCorrelation, label: "Geospatial Correlation" },
      { name: "temporalCorrelation", value: T, weight: w.temporalCorrelation, label: "Temporal Correlation" },
      { name: "atmosphericPersistence", value: M, weight: w.atmosphericPersistence, label: "Atmospheric Persistence" }
    ];

    const availableDims = dimensions.filter(d => d.value !== null && d.value !== undefined);
    const unavailableDims = dimensions.filter(d => d.value === null || d.value === undefined);

    let weightedSum = 0;
    let weightTotal = 0;

    for (const d of availableDims) {
      weightedSum += (d.value as number) * d.weight;
      weightTotal += d.weight;
    }

    let finalScore = weightTotal > 0 ? (weightedSum / weightTotal) : 0;

    // Apply thermal modifier (up to maxBonus) if provided
    if (inputs.thermalContextScore !== undefined && FUSION_CONFIG.thermalContextModifier.enabled) {
      finalScore += (TCS * FUSION_CONFIG.thermalContextModifier.maxBonus);
    }

    // Cap score at 1.00 and bound it between 0.0 and 1.0
    finalScore = Math.max(0.0, Math.min(1.0, finalScore));
    const roundedScore = parseFloat(finalScore.toFixed(2));

    let classification: "OBSERVATION" | "WATCH" | "PROBABLE HOTSPOT" | "HIGH-CONFIDENCE SIGNAL" = "OBSERVATION";
    if (roundedScore > FUSION_CONFIG.classificationThresholds.highConfidenceSignal) {
      classification = "HIGH-CONFIDENCE SIGNAL";
    } else if (roundedScore > FUSION_CONFIG.classificationThresholds.probableHotspot) {
      classification = "PROBABLE HOTSPOT";
    } else if (roundedScore > FUSION_CONFIG.classificationThresholds.watch) {
      classification = "WATCH";
    }

    return {
      citizenReportCorrelation: C,
      visualEvidenceConfidence: V,
      groundMonitoringAnomaly: S,
      geospatialCorrelation: G,
      temporalCorrelation: T,
      atmosphericPersistence: M,
      finalScore: roundedScore,
      classification,
      availableEvidenceDimensions: availableDims.map(d => d.label),
      unavailableEvidenceDimensions: unavailableDims.map(d => d.label),
    };
  }
}
