/**
 * Maps application language selection to speech-recognition locale.
 */
export const mapLanguageToLocale = (lang: "en" | "hi" | "mr"): string => {
  if (lang === "hi") return "hi-IN";
  if (lang === "mr") return "mr-IN";
  return "en-IN";
};

/**
 * Appends a voice transcript to existing text safely.
 */
export const appendTranscript = (existingText: string, transcript: string): string => {
  const trimmedExisting = existingText.trim();
  const trimmedTranscript = transcript.trim();
  if (!trimmedExisting) {
    return trimmedTranscript;
  }
  return `${trimmedExisting}\n${trimmedTranscript}`;
};

/**
 * Maps Web Speech API speech recognition error types to user-friendly messages.
 */
export const mapSpeechError = (error: string): { title: string; subtitle: string } => {
  if (error === "not-allowed" || error === "service-not-allowed" || error === "audio-capture") {
    return {
      title: "MICROPHONE ACCESS DENIED",
      subtitle: "Enable microphone permission in your browser and try again.",
    };
  }
  if (error === "no-speech") {
    return {
      title: "NO SPEECH DETECTED",
      subtitle: "Try speaking again.",
    };
  }
  if (error === "network") {
    return {
      title: "NETWORK ERROR",
      subtitle: "Speech recognition requires a stable internet connection.",
    };
  }
  if (error === "aborted") {
    return {
      title: "VOICE INPUT ABORTED",
      subtitle: "Voice capture was stopped or aborted.",
    };
  }
  if (error === "language-not-supported") {
    return {
      title: "LANGUAGE NOT SUPPORTED",
      subtitle: "The selected language is not supported by your system's voice recognition.",
    };
  }
  return {
    title: "SPEECH RECOGNITION ERROR",
    subtitle: `An error occurred during voice input: ${error}`,
  };
};

/**
 * Check if the report can be submitted based on evidence rules.
 * Specifying: OTHER / NEW ISSUE category requires evidence (text or image) and location.
 */
export const canSubmitReport = (
  selectedCategory: string,
  reportText: string,
  reportImage: string | null,
  latitude: number | null,
  longitude: number | null
): boolean => {
  const isPredefinedCategory = selectedCategory !== "other" && selectedCategory !== "";
  const hasEvidence = !!reportText.trim() || !!reportImage;
  const hasLocation = !!latitude && !!longitude;
  return !!(hasLocation && (isPredefinedCategory || hasEvidence));
};
