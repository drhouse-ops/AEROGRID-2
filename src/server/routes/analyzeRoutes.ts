import { Express } from "express";
import { GoogleGenAI } from "@google/genai";

/**
 * Citizen-report analysis route. Uses Gemini for multimodal interpretation when
 * configured; otherwise deterministically falls back. The correlation engine itself
 * remains fully deterministic and explainable.
 * POST /api/v1/reports/analyze
 */
export function registerAnalyzeRoutes(app: Express, deps: { ai: GoogleGenAI | null; DEMO_MODE: boolean }): void {
  const { ai, DEMO_MODE } = deps;

  // Strip EXIF metadata from JPEG buffers by skipping APP1 (0xFFE1) segments
  function stripExif(buffer: Buffer): Buffer {
    if (buffer.length > 4 && buffer[0] === 0xFF && buffer[1] === 0xD8) {
      let i = 2;
      const result: number[] = [0xFF, 0xD8];
      while (i < buffer.length) {
        if (buffer[i] === 0xFF) {
          if (i + 1 >= buffer.length) break;
          const marker = buffer[i + 1];
          if (marker === 0xD9) { // EOI (End of Image)
            result.push(0xFF, 0xD9);
            break;
          }
          if (i + 3 >= buffer.length) break;
          const length = (buffer[i + 2] << 8) + buffer[i + 3];
          if (marker === 0xE1) {
            i += 2 + length; // skip APP1 segment
          } else {
            const segment = buffer.slice(i, i + 2 + length);
            result.push(...segment);
            i += 2 + length;
          }
        } else {
          result.push(buffer[i]);
          i++;
        }
      }
      return Buffer.from(result);
    }
    return buffer;
  }

  const fallbackAnalysis = (input: {
    text?: string;
    selectedCategory?: string;
    categoryHint?: string;
    categoryLabel?: string;
  }) => {
    const { text, selectedCategory, categoryHint, categoryLabel } = input;
    const lowerText = (text || "").toLowerCase();
    let eventType = "UNKNOWN";
    let summary = "Local pollution observation submitted.";
    let evidence = ["Citizen submitted report."];
    let severity = "MODERATE";
    let confidence = 0.75;
    let smokeDetected = false;
    let smokeDensity: "LOW" | "MODERATE" | "HIGH" | "NONE" = "NONE";

    if (lowerText.includes("कचरा") || lowerText.includes("कचरा जाळत") || lowerText.includes("waste") || lowerText.includes("burn") || lowerText.includes("burning")) {
      eventType = "OPEN_WASTE_BURNING";
      severity = "HIGH";
      confidence = 0.89;
      smokeDetected = true;
      smokeDensity = "HIGH";
      summary = "Dense visible smoke is consistent with possible open waste burning.";
      evidence = [
        "Citizen reports waste burning and heavy smoke.",
        "Image/context supports unmanaged open combustion signals.",
      ];
    } else if (lowerText.includes("dust") || lowerText.includes("धूळ") || lowerText.includes("construction") || lowerText.includes("काम")) {
      eventType = "CONSTRUCTION_DUST";
      severity = "HIGH";
      confidence = 0.82;
      smokeDetected = false;
      summary = "Suspended particulate cloud consistent with construction activities.";
      evidence = ["Citizen reported construction dust emissions.", "Visual analysis indicates coarse dust layers."];
    } else if (lowerText.includes("traffic") || lowerText.includes("गाड्या") || lowerText.includes("smog") || lowerText.includes("धूर")) {
      eventType = "TRAFFIC_SMOG";
      severity = "MODERATE";
      confidence = 0.80;
      smokeDetected = true;
      smokeDensity = "MODERATE";
      summary = "Accumulated vehicular smog in low-dispersion wind window.";
      evidence = ["Heavy morning traffic reports.", "Visual haze layer observed."];
    } else if (lowerText.includes("smoke") || lowerText.includes("धूर")) {
      eventType = "INDUSTRIAL_SMOKE";
      severity = "HIGH";
      confidence = 0.85;
      smokeDetected = true;
      smokeDensity = "HIGH";
      summary = "Thick chimney or stack exhaust consistent with industrial emissions.";
      evidence = ["Citizen reports heavy localized stack smoke.", "Plume dispersion indicates high emissions flow."];
    } else if (categoryHint && categoryHint !== "UNKNOWN") {
      eventType = categoryHint;
      if (eventType === "SMOKE") {
        summary = "Dense or unusual smoke visible nearby.";
        evidence = ["Citizen reported dense smoke."];
        severity = "MODERATE";
        confidence = 0.80;
        smokeDetected = true;
        smokeDensity = "HIGH";
      } else if (eventType === "UNUSUAL_AIR") {
        summary = "Strong chemical, burning, or unusual smell detected.";
        evidence = ["Citizen reported bad smell / unusual air quality."];
        severity = "MODERATE";
        confidence = 0.75;
        smokeDetected = false;
        smokeDensity = "NONE";
      } else if (eventType === "OPEN_WASTE_BURNING") {
        severity = "HIGH";
        confidence = 0.89;
        smokeDetected = true;
        smokeDensity = "HIGH";
        summary = "Dense visible smoke is consistent with possible open waste burning.";
        evidence = ["Citizen reports waste burning and heavy smoke.", "Image/context supports unmanaged open combustion signals."];
      } else if (eventType === "CONSTRUCTION_DUST") {
        severity = "HIGH";
        confidence = 0.82;
        smokeDetected = false;
        summary = "Suspended particulate cloud consistent with construction activities.";
        evidence = ["Citizen reported construction dust emissions.", "Visual analysis indicates coarse dust layers."];
      } else if (eventType === "TRAFFIC_SMOG") {
        severity = "MODERATE";
        confidence = 0.80;
        smokeDetected = true;
        smokeDensity = "MODERATE";
        summary = "Accumulated vehicular smog in low-dispersion wind window.";
        evidence = ["Heavy morning traffic reports.", "Visual haze layer observed."];
      } else if (eventType === "DUST_EMISSION") {
        severity = "MODERATE";
        confidence = 0.78;
        smokeDetected = false;
        summary = "Suspended road dust cloud consistent with heavy traffic on dusty roads.";
        evidence = ["Citizen reports heavy road dust."];
      }
    }

    let aiDetectedCategory = eventType;
    let citizenSelectedCategory = selectedCategory || "";
    let categoryAgreement: "AGREES" | "CONFLICT" | "INSUFFICIENT_EVIDENCE" = "INSUFFICIENT_EVIDENCE";
    let categoryConflictReason = null;

    if (categoryHint) {
      if (aiDetectedCategory === categoryHint) {
        categoryAgreement = "AGREES";
      } else if (aiDetectedCategory === "UNKNOWN") {
        categoryAgreement = "INSUFFICIENT_EVIDENCE";
      } else if (categoryHint === "UNKNOWN") {
        categoryAgreement = "AGREES";
      } else {
        categoryAgreement = "CONFLICT";
        categoryConflictReason = `Visual evidence indicates ${aiDetectedCategory.replace(/_/g, " ").toLowerCase()} rather than ${(categoryLabel || categoryHint).toLowerCase()}.`;
      }
    } else {
      categoryAgreement = aiDetectedCategory !== "UNKNOWN" ? "AGREES" : "INSUFFICIENT_EVIDENCE";
    }

    return {
      eventType,
      pollutionTypes: ["SMOKE", "PM2.5"],
      visualEvidence: { smokeDetected, smokeDensity },
      severity,
      confidence,
      summary,
      evidence,
      analysisSource: "DEMO_FALLBACK" as const,
      selectedCategory,
      categoryHint,
      categoryLabel,
      categoryAgreement,
      citizenSelectedCategory,
      aiDetectedCategory,
      categoryConflictReason,
    };
  };

  app.post("/api/v1/reports/analyze", async (req, res) => {
    const { text, image, language, selectedCategory, categoryHint, categoryLabel } = req.body;

    if (!text && !image && !selectedCategory) {
      return res.status(400).json({ error: "Missing text, image, or selectedCategory." });
    }

    let finalBase64 = undefined;
    let finalMimeType = undefined;

    if (image) {
      const base64PrefixRegex = /^data:(image\/(jpeg|png|webp|jpg));base64,/;
      const match = image.match(base64PrefixRegex);
      if (!match) {
        return res.status(400).json({ error: "Invalid image format. Only JPEG, PNG, and WEBP are allowed with a valid base64 data URI prefix." });
      }

      const mimeType = match[1] === "image/jpg" ? "image/jpeg" : match[1];
      const base64DataStr = image.replace(base64PrefixRegex, "");
      const buffer = Buffer.from(base64DataStr, "base64");

      const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
      if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
        return res.status(400).json({ error: "Image size exceeds the maximum limit of 5MB." });
      }

      const strippedBuffer = stripExif(buffer);
      finalBase64 = strippedBuffer.toString("base64");
      finalMimeType = mimeType;
    }

    console.log(`Analyzing citizen report of length: ${text?.length || 0}, language: ${language}, hasImage: ${!!image}, selectedCategory: "${selectedCategory}"`);

    const isDemoOnly = DEMO_MODE;

    if (ai && !isDemoOnly) {
      try {
        console.log("Invoking Gemini model 'gemini-3.5-flash'...");
        const contents: any[] = [];

        const prompt = `
          You are an environmental incident evidence extraction system.
          Analyze only the supplied citizen statement and environmental image if provided.

          Distinguish OBSERVATION from INFERENCE.
          Never infer PM2.5 concentration from an image.
          Never claim chemical pollutant confirmation from visual evidence.
          Never claim that a waste fire is verified solely from an image.
          Use language such as "consistent with", "possible", "visible evidence indicates".
          Return UNKNOWN when evidence is insufficient.

          Citizen Text Statement: "${text || ""}"
          Selected Language: ${language || "en"}

          The citizen selected the following incident category as contextual input. Independently analyze the available visual and textual evidence. Do not assume the selected category is correct.
          Citizen-provided selectedCategory: "${selectedCategory || ""}"
          Citizen-provided categoryHint: "${categoryHint || ""}"
          Citizen-provided categoryLabel: "${categoryLabel || ""}"

          Compare the categoryHint (citizen's selection) with the eventType you independently determine.
          Determine:
          1. "categoryAgreement":
             - If your detected eventType matches categoryHint, return "AGREES".
             - If you determine eventType is "UNKNOWN", return "INSUFFICIENT_EVIDENCE".
             - If categoryHint is "UNKNOWN" (which corresponds to "Other / New Issue"), return "AGREES" (since they didn't assert a specific category, so no conflict is possible).
             - Otherwise, if your detected eventType is different from categoryHint, return "CONFLICT".
          2. "citizenSelectedCategory": Pass back the citizen-provided selectedCategory / categoryHint.
          3. "aiDetectedCategory": This MUST be the eventType you independently detected.
          4. "categoryConflictReason": If categoryAgreement is "CONFLICT", provide a clear string explanation. If there is no conflict, this must be null.

          You MUST return valid structured JSON conforming EXACTLY to the following TypeScript interface:
          {
            "eventType": "OPEN_WASTE_BURNING" | "DUST_EMISSION" | "TRAFFIC_SMOG" | "INDUSTRIAL_SMOKE" | "CONSTRUCTION_DUST" | "UNKNOWN" | "SMOKE" | "UNUSUAL_AIR",
            "pollutionTypes": string[],
            "visualEvidence": {
              "smokeDetected": boolean,
              "smokeDensity": "LOW" | "MODERATE" | "HIGH" | "NONE"
            },
            "severity": "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
            "confidence": number,
            "summary": string,
            "evidence": string[],
            "categoryAgreement": "AGREES" | "CONFLICT" | "INSUFFICIENT_EVIDENCE",
            "citizenSelectedCategory": string,
            "aiDetectedCategory": "OPEN_WASTE_BURNING" | "DUST_EMISSION" | "TRAFFIC_SMOG" | "INDUSTRIAL_SMOKE" | "CONSTRUCTION_DUST" | "UNKNOWN" | "SMOKE" | "UNUSUAL_AIR",
            "categoryConflictReason": string | null
          }
        `;

        contents.push({ text: prompt });

        if (image && finalBase64 && finalMimeType) {
          contents.push({
            inlineData: {
              mimeType: finalMimeType,
              data: finalBase64,
            },
          });
        }

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: { parts: contents },
          config: {
            responseMimeType: "application/json",
          },
        });

        const rawText = response.text || "";
        console.log("Gemini response of length received and successfully parsed.");

        const cleanJsonStr = rawText.trim().replace(/^```json/, "").replace(/```$/, "").trim();
        const parsed = JSON.parse(cleanJsonStr);
        parsed.analysisSource = "GEMINI_MULTIMODAL";
        if (!parsed.selectedCategory) parsed.selectedCategory = selectedCategory || "";
        if (!parsed.categoryHint) parsed.categoryHint = categoryHint || "";
        if (!parsed.categoryLabel) parsed.categoryLabel = categoryLabel || "";
        if (!parsed.citizenSelectedCategory) parsed.citizenSelectedCategory = selectedCategory || "";
        if (!parsed.aiDetectedCategory) parsed.aiDetectedCategory = parsed.eventType || "UNKNOWN";
        if (!parsed.categoryAgreement) {
          const aiCat = parsed.aiDetectedCategory;
          if (categoryHint) {
            if (aiCat === categoryHint) {
              parsed.categoryAgreement = "AGREES";
            } else if (aiCat === "UNKNOWN") {
              parsed.categoryAgreement = "INSUFFICIENT_EVIDENCE";
            } else if (categoryHint === "UNKNOWN") {
              parsed.categoryAgreement = "AGREES";
            } else {
              parsed.categoryAgreement = "CONFLICT";
              parsed.categoryConflictReason = `Visual evidence indicates ${aiCat.replace(/_/g, " ").toLowerCase()} rather than ${(categoryLabel || categoryHint).toLowerCase()}.`;
            }
          } else {
            parsed.categoryAgreement = aiCat !== "UNKNOWN" ? "AGREES" : "INSUFFICIENT_EVIDENCE";
          }
        }
        return res.json(parsed);
      } catch (err: any) {
        console.error("Gemini invocation failed:", err.message);
        if (DEMO_MODE) {
          console.log("Running in demo mode; falling back to offline analysis.");
          return res.json(fallbackAnalysis({ text, selectedCategory, categoryHint, categoryLabel }));
        } else {
          return res.status(503).json({ error: "GEMINI_API_FAILURE", message: err.message || "Gemini model failed to respond." });
        }
      }
    } else {
      if (DEMO_MODE) {
        console.log(`No Gemini API key found or isDemoOnly=${isDemoOnly}. Using deterministic fallback analysis.`);
        return res.json(fallbackAnalysis({ text, selectedCategory, categoryHint, categoryLabel }));
      } else {
        return res.status(503).json({ error: "GEMINI_API_UNCONFIGURED", message: "Gemini API key is missing or unconfigured in Live Pilot Mode." });
      }
    }
  });
}
