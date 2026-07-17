/**
 * AEROGRID Fusion Engine Configuration
 * ------------------------------------
 * Centralised, externalised configuration for the deterministic evidence-convergence
 * (signal correlation) model. Values here reflect the calibrated prototype heuristics
 * described in the AEROGRID 20-point design spec for the Pune Central Pilot Zone.
 *
 * IMPORTANT: This engine is deterministic and explainable. It does NOT use AI to
 * decide whether an incident is real — Gemini only contributes the visual evidence
 * confidence (V). The final Signal Strength is a transparent weighted fusion of the
 * dimensions below.
 */

export interface ThresholdBand {
  /** Inclusive upper bound for this band (value <= max yields `score`). */
  max: number;
  /** Fusion score assigned when the measured value falls within this band. */
  score: number;
}

export interface FusionConfig {
  /** Weighted fusion formula: H = Σ(weight_i * dimension_i), normalised over active dims. */
  fusionWeights: {
    citizenReportCorrelation: number; // C
    visualEvidenceConfidence: number; // V (Gemini multimodal interpretation)
    groundMonitoringAnomaly: number; // S (government AQ anomaly)
    geospatialCorrelation: number; // G (spatial proximity)
    temporalCorrelation: number; // T (temporal proximity)
    atmosphericPersistence: number; // M (weather dispersion/persistence)
  };

  /** Optional supporting contextual modifier from NASA FIRMS thermal anomaly context. */
  thermalContextModifier: {
    enabled: boolean;
    maxBonus: number; // capped additive bonus to finalScore
  };

  /** Classification thresholds applied to the final (0.0–1.0) fusion score. */
  classificationThresholds: {
    highConfidenceSignal: number; // >= this => HIGH-CONFIDENCE SIGNAL
    probableHotspot: number; // >= this => PROBABLE HOTSPOT
    watch: number; // >= this => WATCH
    // below `watch` => OBSERVATION
  };

  /**
   * Citizen correlation (C): contribution of N compatible prior supporting observations.
   * The current report is excluded. 0 priors => 0.0 (isolated observation).
   */
  citizenCorrelationByPriorCount: {
    onePrior: number; // 1 prior  => 0.6
    twoPriors: number; // 2 priors => 0.8
    threeOrMorePriors: number; // >=3     => 1.0
  };

  /**
   * Geospatial correlation (G): bands by distance (metres) between observations.
   * Canonical Pune scenario: 300m => 1.0 (within 250m band).
   */
  geospatialBands: ThresholdBand[]; // ascending by `max`, evaluated top-down

  /**
   * Temporal correlation (T): bands by time difference (minutes) between observations.
   * Canonical Pune scenario: 9min => 1.0 (within 15min band).
   */
  temporalBands: ThresholdBand[]; // ascending by `max`, evaluated top-down

  /** Maximum spatial (metres) and temporal (minutes) window for live correlation matching. */
  correlationWindow: {
    maxDistanceMeters: number; // 1000m
    maxTimeMinutes: number; // 60min
  };

  /** Minimum Gemini visual-evidence confidence for AI category to override citizen category. */
  aiCategoryConfidenceThreshold: number; // 0.75
}

export const FUSION_CONFIG: FusionConfig = {
  fusionWeights: {
    citizenReportCorrelation: 0.20,
    visualEvidenceConfidence: 0.20,
    groundMonitoringAnomaly: 0.25,
    geospatialCorrelation: 0.15,
    temporalCorrelation: 0.10,
    atmosphericPersistence: 0.10,
  },

  thermalContextModifier: {
    enabled: true,
    maxBonus: 0.05,
  },

  classificationThresholds: {
    highConfidenceSignal: 0.75,
    probableHotspot: 0.55,
    watch: 0.35,
  },

  citizenCorrelationByPriorCount: {
    onePrior: 0.6,
    twoPriors: 0.8,
    threeOrMorePriors: 1.0,
  },

  geospatialBands: [
    { max: 250, score: 1.0 },
    { max: 500, score: 0.8 },
    { max: 750, score: 0.6 },
    { max: 1000, score: 0.4 },
    { max: Infinity, score: 0.0 },
  ],

  temporalBands: [
    { max: 15, score: 1.0 },
    { max: 30, score: 0.8 },
    { max: 45, score: 0.6 },
    { max: 60, score: 0.4 },
    { max: Infinity, score: 0.0 },
  ],

  correlationWindow: {
    maxDistanceMeters: 1000,
    maxTimeMinutes: 60,
  },

  aiCategoryConfidenceThreshold: 0.75,
};

/**
 * Resolve a banded score from a measured value using ascending bands.
 * Bands are evaluated in order; the first whose `max` is >= value wins.
 */
export function resolveBandedScore(value: number, bands: ThresholdBand[]): number {
  for (const band of bands) {
    if (value <= band.max) return band.score;
  }
  return bands.length > 0 ? bands[bands.length - 1].score : 0.0;
}

/**
 * Resolve citizen correlation (C) from count of compatible prior supporting observations.
 */
export function resolveCitizenCorrelation(priorCount: number): number {
  if (priorCount <= 0) return 0.0;
  if (priorCount === 1) return FUSION_CONFIG.citizenCorrelationByPriorCount.onePrior;
  if (priorCount === 2) return FUSION_CONFIG.citizenCorrelationByPriorCount.twoPriors;
  return FUSION_CONFIG.citizenCorrelationByPriorCount.threeOrMorePriors;
}
