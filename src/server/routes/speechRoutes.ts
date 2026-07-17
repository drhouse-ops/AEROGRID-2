import { Express } from "express";
import { SpeechClient } from "@google-cloud/speech";

/**
 * Cloud Speech-to-Text route. Provides a server-side, multilingual (en/hi/mr)
 * transcription endpoint so the app is not dependent on the browser's Web Speech API.
 *
 * The frontend attempts this endpoint first and falls back to the Web Speech API when
 * the GOOGLE_CLOUD_STT is not configured or the request fails — keeping the demo robust.
 * POST /api/v1/speech-to-text
 */
const LANGUAGE_CODES: Record<string, string[]> = {
  en: ["en-IN"],
  hi: ["hi-IN"],
  mr: ["mr-IN"],
};

function getClient(): SpeechClient | null {
  const key = process.env.GOOGLE_CLOUD_STT_KEY;
  try {
    if (key) {
      const parsed = key.trim().startsWith("{") ? JSON.parse(key) : JSON.parse(require("fs").readFileSync(key, "utf8"));
      return new SpeechClient({ credentials: parsed });
    }
    // Fall back to ADC (GOOGLE_APPLICATION_CREDENTIALS) when no explicit key
    return new SpeechClient();
  } catch (e) {
    console.warn("[speech] Cloud Speech-to-Text client unavailable:", (e as Error).message);
    return null;
  }
}

export function registerSpeechRoutes(app: Express, _deps: { DEMO_MODE: boolean }): void {
  app.post("/api/v1/speech-to-text", async (req, res) => {
    const client = getClient();
    if (!client) {
      return res.status(503).json({
        success: false,
        error: "SPEECH_TO_TEXT_UNAVAILABLE",
        message: "Cloud Speech-to-Text is not configured. Frontend will use Web Speech API.",
      });
    }

    const { audioBase64, language } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ success: false, error: "MISSING_AUDIO" });
    }

    const lang = typeof language === "string" ? language : "en";
    const codes = LANGUAGE_CODES[lang] || LANGUAGE_CODES.en;

    try {
      const [response] = await client.recognize({
        audio: { content: audioBase64 },
        config: {
          encoding: "WEBM_OPUS",
          sampleRateHertz: 48000,
          languageCode: codes[0],
          alternativeLanguageCodes: codes.slice(1),
          model: "latest_long",
          enableAutomaticPunctuation: true,
        },
      });

      const transcript = (response.results || [])
        .map((r) => r.alternatives?.[0]?.transcript || "")
        .join(" ")
        .trim();

      return res.json({ success: true, transcript });
    } catch (err: any) {
      console.error("[speech] recognition failed:", err.message);
      return res.status(503).json({
        success: false,
        error: "SPEECH_RECOGNITION_FAILED",
        message: err.message || "Cloud Speech-to-Text request failed.",
      });
    }
  });
}
