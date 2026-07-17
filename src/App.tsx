import React, { useState, useEffect } from "react";

// Safely encode a binary ArrayBuffer to base64 (handles bytes > 255 and avoids
// call-stack overflow for large buffers). The naive btoa(String.fromCharCode(...))
// approach crashes on real audio payloads.
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
};

import {
  Globe, 
  Languages, 
  Mic, 
  Upload, 
  MapPin, 
  AlertCircle, 
  Sparkles, 
  TrendingUp, 
  Plus, 
  RotateCcw, 
  FileText, 
  ChevronRight, 
  ShieldAlert, 
  CheckCircle2, 
  Wind, 
  Navigation, 
  Eye, 
  ShieldCheck, 
  RefreshCw, 
  Server, 
  Flame, 
  Info,
  Layers,
  Activity,
  User,
  LayoutDashboard
} from "lucide-react";

// Components
import SeverityBadge from "./components/SeverityBadge";
import ConfidenceGauge from "./components/ConfidenceGauge";
import EnvironmentalContext from "./components/EnvironmentalContext";
import ForecastChart from "./components/ForecastChart";
import EvidenceTimeline from "./components/EvidenceTimeline";
import ActionRecommendation from "./components/ActionRecommendation";
import PuneMap from "./components/PuneMap";
import SignalCorrelation from "./components/SignalCorrelation";

// Voice Input Utilities
import {
  mapLanguageToLocale,
  appendTranscript,
  mapSpeechError,
} from "./utils/voiceUtils";

// Services and config
import { 
  getEnvironmentalContext, 
  analyzeCitizenReport, 
  evaluateFusion, 
  getHotspots, 
  getHotspotById, 
  dispatchIncidentResponse, 
  resetDemo,
  isDemoMode,
  transcribeAudio
} from "./services/api";
import { 
  DEMO_LOCATION, 
  isWithinPuneBoundary, 
  FALLBACK_ENVIRONMENTAL_CONTEXT 
} from "./config/demo";
import { 
  CitizenReport, 
  EventType, 
  Severity, 
  Hotspot, 
  DispatchStatus 
} from "./types/api";

export default function App() {
  // Application Roles
  const [role, setRole] = useState<"citizen" | "municipal">("citizen");
  
  // Citizen View Flow State
  const [citizenView, setCitizenView] = useState<"home" | "categories" | "report" | "analyzing" | "result" | "correlation">("home");
  const [language, setLanguage] = useState<"en" | "hi" | "mr">("en");

  // Predefined Categories state
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [categoryHint, setCategoryHint] = useState<string>("");
  const [categoryLabel, setCategoryLabel] = useState<string>("");

  // Report Form Inputs
  const [reportText, setReportText] = useState("");
  const [reportImage, setReportImage] = useState<string | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  // Microphone States
  const [micState, setMicState] = useState<"IDLE" | "LISTENING" | "PROCESSING" | "SUCCESS" | "ERROR">("IDLE");
  const [micError, setMicError] = useState<{ title: string; subtitle: string } | null>(null);
  
  // Geolocation states
  const [locStatus, setLocStatus] = useState<"idle" | "requesting" | "granted" | "denied" | "demo">("idle");
  const [isOutsidePune, setIsOutsidePune] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Gemini API Loading State
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisText, setAnalysisText] = useState("Analyzing environmental evidence...");
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  
  // Fusion & Hotspot correlation results
  const [isEvaluatingFusion, setIsEvaluatingFusion] = useState(false);
  const [fusedHotspot, setFusedHotspot] = useState<Hotspot | null>(null);
  const [correlationCompleted, setCorrelationCompleted] = useState(false);

  // Command Centre List and Selection
  const [hotspotsList, setHotspotsList] = useState<Hotspot[]>([]);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);
  const [envContext, setEnvContext] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "live-signals" | "hotspots" | "response" | "analytics">("overview");

  // Load hotspots list initially & when role switching
  useEffect(() => {
    fetchHotspots();
    fetchStaticContext();
  }, [role]);

  const fetchHotspots = async () => {
    try {
      const data = await getHotspots();
      setHotspotsList(data);
      if (data.length > 0 && !selectedHotspotId) {
        setSelectedHotspotId(data[0].id);
      }
    } catch (err) {
      console.error("Failed to load hotspots.", err);
    }
  };

  const fetchStaticContext = async () => {
    try {
      const data = await getEnvironmentalContext(DEMO_LOCATION.latitude, DEMO_LOCATION.longitude);
      setEnvContext(data);
    } catch (err) {
      if (isDemoMode) {
        setEnvContext(FALLBACK_ENVIRONMENTAL_CONTEXT);
      } else {
        setEnvContext(null);
      }
    }
  };

  // Language Dictionary Helper
  const dict: Record<"en" | "hi" | "mr", Record<string, string>> = {
    en: {
      brand: "AEROGRID",
      tagline: "Pune Environmental Signal Network",
      pilot: "PUNE PILOT",
      title: "See any smoke near you?",
      desc: "Report smoke, dust, waste burning or unusual air pollution. Your observation can help identify an emerging local pollution event.",
      btnReport: "REPORT POLLUTION",
      statusHeader: "LOCAL ENVIRONMENTAL STATUS",
      worksHeader: "HOW AEROGRID WORKS",
      works1: "You report what you observe in your language.",
      works2: "AI extracts visual environmental evidence.",
      works3: "Independent signals are correlated over space & time.",
      works4: "Municipal teams deploy targeting real hotspots.",
      step1Title: "1. TELL US WHAT YOU OBSERVE",
      micLabel: "Speak in your language",
      demoMarathi: "USE DEMO MARATHI REPORT",
      demoText: "Waste is being burned here and there is heavy smoke.",
      step2Title: "2. ADD VISUAL EVIDENCE",
      step2Sub: "Upload a photo of visible smoke, dust or local pollution.",
      step3Title: "3. CONFIRM LOCATION",
      locRequest: "Detect Current GPS Location",
      useDemoLoc: "USE PUNE DEMO LOCATION",
      submitBtn: "ANALYZE ENVIRONMENTAL EVIDENCE",
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
      brand: "AEROGRID",
      tagline: "पुणे पर्यावरण सिग्नल नेटवर्क",
      pilot: "पुणे पायलट",
      title: "क्या आपको आस-पास धुआं दिख रहा है?",
      desc: "धुआं, धूल, कचरा जलाने या असामान्य वायु प्रदूषण की रिपोर्ट करें। आपका अवलोकन एक उभरते हुए स्थानीय प्रदूषण घटना की पहचान करने में मदद कर सकता है।",
      btnReport: "प्रदूषण की रिपोर्ट करें",
      statusHeader: "स्थानीय पर्यावरणीय स्थिति",
      worksHeader: "एरोग्रिड कैसे काम करता है",
      works1: "आप जो देखते हैं उसे अपनी भाषा में रिपोर्ट करते हैं।",
      works2: "एआई दृश्य पर्यावरणीय साक्ष्य निकालता है।",
      works3: "स्वतंत्र संकेतों को स्थान और समय के साथ सह-संबंधित किया जाता है।",
      works4: "नगर पालिका टीमें वास्तविक हॉटस्पॉट को लक्षित करती हैं।",
      step1Title: "1. हमें बताएं कि आप क्या देखते हैं",
      micLabel: "अपनी भाषा में बोलें",
      demoMarathi: "मराठी डेमो रिपोर्ट का उपयोग करें",
      demoText: "यहाँ कचरा जलाया जा रहा है और बहुत धुआँ है।",
      step2Title: "2. दृश्य साक्ष्य जोड़ें",
      step2Sub: "दिखने वाले धुएं, धूल या स्थानीय प्रदूषण की तस्वीर अपलोड करें।",
      step3Title: "3. स्थान की पुष्टि करें",
      locRequest: "वर्तमान जीपीएस स्थान का पता लगाएं",
      useDemoLoc: "पुणे डेमो स्थान का उपयोग करें",
      submitBtn: "पर्यावरण साक्ष्य का विश्लेषण करें",
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
      brand: "AEROGRID",
      tagline: "पुणे पर्यावरण सिग्नल नेटवर्क",
      pilot: "पुणे पायलट",
      title: "तुम्हाला जवळच धूर दिसत आहे का?",
      desc: "धूर, धूळ, कचरा जाळणे किंवा असामान्य वायू प्रदूषणाची तक्रार करा. तुमचे निरीक्षण स्थानिक पातळीवर उद्भवणारे प्रदूषण ओळखण्यास मदत करू शकते.",
      btnReport: "प्रदूषणाची तक्रार करा",
      statusHeader: "स्थानिक पर्यावरणीय स्थिती",
      worksHeader: "एरोग्रिड कसे कार्य करते",
      works1: "तुम्ही जे पाहता ते तुमच्या भाषेत कळवता.",
      works2: "AI दृश्य पर्यावरणीय पुरावे शोधून काढते.",
      works3: "स्वतंत्र पुरावे वेळ आणि जागेनुसार जोडले जातात.",
      works4: "महानगरपालिका थेट हॉटस्पॉट शोधून कारवाई करते.",
      step1Title: "१. तुम्ही काय पाहत आहात ते सांगा",
      micLabel: "तुमच्या भाषेत बोला",
      demoMarathi: "डेमो मराठी रिपोर्ट वापरा",
      demoText: "इथे कचरा जाळत आहेत आणि खूप धूर आहे.",
      step2Title: "२. दृश्य पुरावा जोडा",
      step2Sub: "धूर, धूळ किंवा स्थानिक प्रदूषणाचा फोटो अपलोड करा.",
      step3Title: "३. अचूक जागा निश्चित करा",
      locRequest: "सध्याचे जीपीएस लोकेशन मिळवा",
      useDemoLoc: "पुणे डेमो लोकेशन वापरा",
      submitBtn: "पर्यावरणीय पुराव्याचे विश्लेषण करा",
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

  const t = dict[language];

  const QUICK_CATEGORIES = [
    { key: "smoke", hint: "SMOKE", label: "SMOKE / HEAVY SMOKE", desc: "Dense or unusual smoke visible nearby", icon: "💨" },
    { key: "burning", hint: "OPEN_WASTE_BURNING", label: "GARBAGE OR WASTE BURNING", desc: "Garbage, plastic, or waste appears to be burning", icon: "🔥" },
    { key: "const_dust", hint: "CONSTRUCTION_DUST", label: "CONSTRUCTION DUST", desc: "Heavy dust from construction activity", icon: "🏗️" },
    { key: "road_dust", hint: "DUST_EMISSION", label: "HEAVY ROAD DUST", desc: "Severe dust from roads or passing vehicles", icon: "🛣️" },
    { key: "industrial", hint: "INDUSTRIAL_SMOKE", label: "INDUSTRIAL SMOKE", desc: "Smoke or emissions near an industrial area", icon: "🏭" },
    { key: "smog", hint: "TRAFFIC_SMOG", label: "TRAFFIC SMOG", desc: "Dense pollution near a congested road or junction", icon: "🚗" },
    { key: "smell", hint: "UNUSUAL_AIR", label: "BAD SMELL / UNUSUAL AIR", desc: "Strong chemical, burning, or unusual smell", icon: "👃" },
    { key: "other", hint: "UNKNOWN", label: "OTHER / NEW ISSUE", desc: "Report a different environmental issue", icon: "❓" }
  ];

  // Language switcher helper
  const handleLanguageChange = (lang: "en" | "hi" | "mr") => {
    setLanguage(lang);
  };

  // Demo Marathi observation helper
  const handleUseDemoMarathi = () => {
    setReportText("इथे कचरा जाळत आहेत आणि खूप धूर आहे.");
  };

  // Start Browser Speech Recognition (Web Speech API)
  const startSpeechRecognition = () => {
    setMicState("PROCESSING");
    setMicError(null);

    // Primary path: server-side Cloud Speech-to-Text (en/hi/mr, robust across browsers).
    // Fallback path: browser Web Speech API when Cloud STT is unavailable.
    startCloudSpeechRecognition().catch((err) => {
      console.warn("[voice] Cloud STT unavailable, falling back to Web Speech API:", err?.message || err);
      startWebSpeechRecognition();
    });
  };

  // Server-side Cloud Speech-to-Text: capture mic audio, send to backend.
  const startCloudSpeechRecognition = async (): Promise<void> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("MEDIA_DEVICES_UNAVAILABLE");
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: BlobPart[] = [];

    setMicState("LISTENING");

    const finished = new Promise<void>((resolve, reject) => {
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        try {
          const blob = new Blob(chunks, { type: mimeType });
          const buffer = await blob.arrayBuffer();
          const audioBase64 = arrayBufferToBase64(buffer);
          const result = await transcribeAudio(audioBase64, language);
          if (result.success && result.transcript) {
            setReportText((prev) => appendTranscript(prev, result.transcript!));
            setMicState("SUCCESS");
            setTimeout(() => setMicState("IDLE"), 3000);
            resolve();
          } else {
            reject(new Error(result.error || "SPEECH_TO_TEXT_UNAVAILABLE"));
          }
        } catch (e) {
          reject(e);
        }
      };
      recorder.onerror = () => reject(new Error("RECORDER_ERROR"));
    });

    recorder.start();
    // Auto-stop after 15s
    setTimeout(() => { if (recorder.state !== "inactive") recorder.stop(); }, 15000);
    return finished;
  };

  // Browser Web Speech API fallback (Chromium-based browsers).
  const startWebSpeechRecognition = () => {
    const SpeechRecognitionConstructor = (window as Window & {
      SpeechRecognition?: any;
      webkitSpeechRecognition?: any;
    }).SpeechRecognition || (window as Window & {
      webkitSpeechRecognition?: any;
    }).webkitSpeechRecognition;

    if (!SpeechRecognitionConstructor) {
      setMicState("ERROR");
      setMicError({
        title: "VOICE INPUT NOT SUPPORTED",
        subtitle: "Use text input or open AEROGRID in a supported Chromium-based browser."
      });
      return;
    }

    try {
      const recognition = new SpeechRecognitionConstructor();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = mapLanguageToLocale(language);

      recognition.onstart = () => setMicState("LISTENING");

      recognition.onresult = (event: any) => {
        const results = event.results;
        if (results && results.length > 0) {
          const transcript = results[0][0].transcript;
          if (transcript) {
            setReportText((prev) => appendTranscript(prev, transcript));
            setMicState("SUCCESS");
            setTimeout(() => setMicState("IDLE"), 3000);
          } else {
            setMicState("ERROR");
            setMicError({ title: "NO SPEECH DETECTED", subtitle: "Try speaking again." });
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setMicState("ERROR");
        setMicError(mapSpeechError(event.error));
      };

      recognition.onend = () => {
        setMicState((prev) => (prev === "LISTENING" || prev === "PROCESSING" ? "IDLE" : prev));
      };

      recognition.start();
    } catch (err: any) {
      console.error("Failed to start speech recognition:", err);
      setMicState("ERROR");
      setMicError({
        title: "SPEECH RECOGNITION ERROR",
        subtitle: err.message || "Failed to initialize microphone service."
      });
    }
  };

  // Geolocation handling
  const handleDetectLocation = () => {
    setLocStatus("requesting");
    if (!navigator.geolocation) {
      setLocStatus("denied");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setLatitude(lat);
        setLongitude(lng);
        setLocStatus("granted");
        
        // Validate boundary
        const inPune = isWithinPuneBoundary(lat, lng);
        setIsOutsidePune(!inPune);
      },
      (err) => {
        console.error(err);
        setLocStatus("denied");
      }
    );
  };

  const handleUseDemoLocation = () => {
    setLatitude(DEMO_LOCATION.latitude);
    setLongitude(DEMO_LOCATION.longitude);
    setLocStatus("demo");
    setIsOutsidePune(false);
  };

  // Demo Visual Evidence select helper
  const handleSelectDemoEvidence = (type: "waste" | "dust" | "smog") => {
    let imgUrl = "";
    if (type === "waste") {
      imgUrl = "https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?auto=format&fit=crop&q=80&w=600";
      if (!reportText) setReportText("Large open garbage combustion in the neighborhood street.");
    } else if (type === "dust") {
      imgUrl = "https://images.unsplash.com/photo-1590069261209-f8e9b8642343?auto=format&fit=crop&q=80&w=600";
      if (!reportText) setReportText("Thick construction dust clouds blowing all over the road from the metro project.");
    } else {
      imgUrl = "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&q=80&w=600";
      if (!reportText) setReportText("Vehicular smog is extremely dense under low dispersion weather conditions.");
    }
    setReportImage(imgUrl);
  };

  // Handle local image uploads
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReportImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearImage = () => {
    setReportImage(null);
  };

  // Form Analysis Action trigger
  const handleAnalyzeEvidence = async () => {
    if (!latitude || !longitude) {
      setSubmitError("Please confirm your location first.");
      return;
    }

    setSubmitError(null);
    setCitizenView("analyzing");
    setAnalysisProgress(0);

    // Simulate animated step progresses for Gemini analysis feel
    const steps = [
      "Analyzing citizen observation...",
      "Examining visual evidence...",
      "Extracting environmental indicators...",
      "Structuring environmental evidence..."
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < 3) {
        currentStep++;
        setAnalysisText(steps[currentStep]);
        setAnalysisProgress((currentStep / 3) * 100);
      } else {
        clearInterval(interval);
      }
    }, 1000);

    try {
      // API call to Backend (Gemini or Mock fallbacks inside server.ts)
      const analysis = await analyzeCitizenReport(reportText, reportImage, language, selectedCategory, categoryHint, categoryLabel);
      
      clearInterval(interval);
      setAnalysisProgress(100);
      setAnalysisResult(analysis);
      setCitizenView("result");
    } catch (err: any) {
      console.error(err);
      clearInterval(interval);
      
      if (isDemoMode) {
        // Soft fallbacks allowed in Demo Mode
        const aiDetectedCategory = categoryHint || EventType.OPEN_WASTE_BURNING;
        const categoryAgreement = "AGREES";
        setAnalysisResult({
          eventType: aiDetectedCategory,
          pollutionTypes: ["SMOKE", "PM2.5"],
          visualEvidence: { smokeDetected: true, smokeDensity: "HIGH" },
          severity: Severity.HIGH,
          confidence: 0.89,
          summary: "Dense visible smoke consistent with selected environmental category.",
          evidence: ["Heavy local observations verified by fallback engine."],
          selectedCategory,
          categoryHint,
          categoryLabel,
          categoryAgreement,
          citizenSelectedCategory: selectedCategory,
          aiDetectedCategory,
          categoryConflictReason: null
        });
        setCitizenView("result");
      } else {
        // Live Pilot Mode: Fail honestly with no silent fallbacks
        setSubmitError(`Live Pilot API Failure: ${err.message || "Gemini analysis failed. Please verify API key configuration and network connectivity."}`);
        setCitizenView("report");
      }
    }
  };

  // Signal Correlation screen transition
  const handleGoToCorrelation = async () => {
    setCitizenView("correlation");
    setCorrelationCompleted(false);
  };

  const handleCorrelationFinish = async () => {
    // Perform Signal Fusion Evaluate call on backend
    try {
      setIsEvaluatingFusion(true);
      const reportPayload: Partial<CitizenReport> = {
        text: reportText || `${categoryLabel} reported in Pune Central.`,
        language,
        latitude: latitude || 18.5204,
        longitude: longitude || 73.8567,
        imageUrl: reportImage || undefined,
        analysis: analysisResult,
        selectedCategory,
        categoryHint,
        categoryLabel,
        categoryAgreement: analysisResult?.categoryAgreement,
        citizenSelectedCategory: analysisResult?.citizenSelectedCategory,
        aiDetectedCategory: analysisResult?.aiDetectedCategory,
        categoryConflictReason: analysisResult?.categoryConflictReason,
      };

      const res = await evaluateFusion(reportPayload);
      if (res.success) {
        setFusedHotspot(res.hotspot);
        // Refresh municipal lists
        await fetchHotspots();
      }
    } catch (err) {
      console.error("Fusion failed:", err);
    } finally {
      setIsEvaluatingFusion(false);
      setCorrelationCompleted(true);
    }
  };

  // Dispatch Team Action trigger (simulation)
  const handleDispatchTeam = async (teamName: string) => {
    if (!selectedHotspotId) return;
    try {
      setIsDispatching(true);
      const res = await dispatchIncidentResponse(selectedHotspotId, teamName);
      if (res.success) {
        // Update local hotspot details
        setHotspotsList((prevList) => 
          prevList.map((h) => h.id === selectedHotspotId ? res.hotspot : h)
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsDispatching(false);
    }
  };

  // Clear App / Reset Demo trigger
  const handleResetDemo = async () => {
    try {
      const res = await resetDemo();
      // Clear local states
      setReportText("");
      setReportImage(null);
      setLatitude(null);
      setLongitude(null);
      setLocStatus("idle");
      setIsOutsidePune(false);
      setAnalysisResult(null);
      setFusedHotspot(null);
      setCitizenView("home");
      setSelectedHotspotId(null);
      setSelectedCategory("");
      setCategoryHint("");
      setCategoryLabel("");
      
      // Re-fetch default list
      await fetchHotspots();
      alert("AEROGRID: " + res.message);
    } catch (err) {
      console.error(err);
    }
  };

  // Dynamic Selected Hotspot Reference
  const currentHotspot = hotspotsList.find((h) => h.id === selectedHotspotId) || hotspotsList[0];

  return (
    <div className="min-h-screen bg-[#080E18] text-[#F5F8FC] flex flex-col font-sans transition-colors duration-300">
      
      {/* GLOBAL SYSTEM HEADER & ROLE SWITCHER */}
      <header className="sticky top-0 z-50 bg-[#101A28]/95 backdrop-blur-md border-b border-slate-800 px-4 py-3.5 flex flex-wrap justify-between items-center gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-cyan-500/10 border border-[#00C9FF]/30">
            <Layers className="w-5 h-5 text-[#00C9FF]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 id="app-title" className="text-lg font-black tracking-wider text-white font-mono uppercase">
                {t.brand}
              </h1>
              <span className="text-[10px] bg-red-500/10 text-[#FF5369] border border-[#FF5369]/30 px-1.5 py-0.5 rounded font-mono font-bold">
                {t.pilot}
              </span>
              {isDemoMode && (
                <span className="text-[10px] bg-amber-500/10 text-[#FFB020] border border-[#FFB020]/30 px-1.5 py-0.5 rounded font-mono font-bold">
                  Pune Pilot · Prototype
                </span>
              )}
            </div>
            <p className="text-xs text-[#A2B1C4] font-mono">{t.tagline}</p>
          </div>
        </div>

        {/* Unified controls: Role Switcher & Demo Resetter */}
        <div className="flex items-center gap-3">
          
          {/* Quick Demo Reset Utility */}
          <button
            onClick={handleResetDemo}
            className="p-2 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 text-[#A2B1C4] hover:text-white transition-all text-xs font-mono flex items-center gap-1.5 cursor-pointer"
            title="Reset simulation parameters"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">RESET DEMO</span>
          </button>

          {/* Connected Experience Toggle */}
          <div className="p-1 bg-[#080E18] rounded-lg border border-slate-800 flex items-center">
            <button
              onClick={() => {
                setRole("citizen");
                setCitizenView("home");
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold tracking-wider transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
                role === "citizen"
                  ? "bg-[#00C9FF] text-[#080E18]"
                  : "text-[#A2B1C4] hover:text-white hover:bg-slate-900/40"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              CITIZEN
            </button>
            <button
              onClick={() => setRole("municipal")}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold tracking-wider transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
                role === "municipal"
                  ? "bg-[#916BFF] text-white"
                  : "text-[#A2B1C4] hover:text-white hover:bg-slate-900/40"
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              MUNICIPAL DESK
            </button>
          </div>
        </div>
      </header>

      {/* MAIN LAYOUT GATE */}
      <main className="flex-grow flex flex-col">

        {/* ========================================================
            CITIZEN ROLE EXPERIENCE
            ======================================================== */}
        {role === "citizen" && (
          <div className="w-full max-w-2xl mx-auto p-4 md:py-8 space-y-8 flex-grow flex flex-col justify-between">
            
            {/* 1. CITIZEN HOME VIEW */}
            {citizenView === "home" && (
              <div className="space-y-8 animate-fade-in">
                {/* Hero section */}
                <div className="text-center space-y-4 pt-4">
                  
                  {/* Language Selector in margins */}
                  <div className="flex items-center justify-center gap-2 text-xs text-[#A2B1C4] font-mono mb-4">
                    <Globe className="w-3.5 h-3.5 text-[#00C9FF]" />
                    <span>CHOOSE LANGUAGE:</span>
                    <button 
                      onClick={() => handleLanguageChange("en")} 
                      className={`px-2 py-0.5 rounded border ${language === "en" ? "bg-[#00C9FF]/10 text-white border-[#00C9FF]/40 font-bold" : "border-slate-800 text-slate-500"}`}
                    >
                      EN
                    </button>
                    <button 
                      onClick={() => handleLanguageChange("hi")} 
                      className={`px-2 py-0.5 rounded border ${language === "hi" ? "bg-[#00C9FF]/10 text-white border-[#00C9FF]/40 font-bold" : "border-slate-800 text-slate-500"}`}
                    >
                      हिन्दी
                    </button>
                    <button 
                      onClick={() => handleLanguageChange("mr")} 
                      className={`px-2 py-0.5 rounded border ${language === "mr" ? "bg-[#00C9FF]/10 text-white border-[#00C9FF]/40 font-bold" : "border-slate-800 text-slate-500"}`}
                    >
                      मराठी
                    </button>
                  </div>

                  <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight">
                    {t.title}
                  </h2>
                  <p className="text-sm md:text-base text-[#A2B1C4] max-w-lg mx-auto leading-relaxed">
                    {t.desc}
                  </p>
                  
                  <div className="pt-4">
                    <button
                      onClick={() => {
                        setSelectedCategory("");
                        setCategoryHint("");
                        setCategoryLabel("");
                        setReportText("");
                        setReportImage(null);
                        setLatitude(null);
                        setLongitude(null);
                        setLocStatus("idle");
                        setIsOutsidePune(false);
                        setAnalysisResult(null);
                        setFusedHotspot(null);
                        setCorrelationCompleted(false);
                        setCitizenView("categories");
                      }}
                      className="px-8 py-4 bg-[#00C9FF] hover:bg-[#00b0df] text-[#080E18] font-bold text-sm tracking-widest rounded-xl transition-all shadow-lg hover:shadow-cyan-500/20 font-mono flex items-center justify-center gap-2 mx-auto cursor-pointer"
                    >
                      <span>{t.btnReport}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Local environmental status (Ground sensors values loading etc) */}
                <div className="p-5 rounded-xl bg-[#101A28] border border-slate-800 space-y-4">
                  <h3 className="text-xs font-mono font-bold text-[#A2B1C4] tracking-widest uppercase flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#31D697]" />
                    {t.statusHeader}
                  </h3>
                  
                  {envContext ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center bg-[#162334]/50 p-3 rounded-lg border border-slate-800 text-xs">
                        <span className="text-[#A2B1C4] font-mono">CPCB MONITOR STATION:</span>
                        <span className="font-semibold text-white">{envContext.groundMonitoring?.stationName || "Station Context Unavailable"}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-[#162334]/50 p-3 rounded-lg border border-slate-800">
                          <span className="text-[10px] font-mono text-slate-500 block">CPCB PM2.5 CONTEXT</span>
                          <span className="text-xl font-mono font-bold text-[#00C9FF]">
                            {envContext.groundMonitoring?.currentValue !== null && envContext.groundMonitoring?.currentValue !== undefined
                              ? `${envContext.groundMonitoring.currentValue} µg/m³`
                              : "N/A"}
                          </span>
                        </div>
                        <div className="bg-[#162334]/50 p-3 rounded-lg border border-slate-800">
                          <span className="text-[10px] font-mono text-slate-500 block">NASA FIRMS THERMAL</span>
                          <span className="text-xl font-mono font-bold text-[#FF5369]">
                            {envContext.thermalContext?.available 
                              ? (envContext.thermalContext.detectionFound ? "ACTIVE" : "CLEAR") 
                              : "PENDING"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 px-3 rounded-lg border border-red-950/40 bg-red-950/10 space-y-1">
                      <p className="text-xs font-mono text-red-400 font-bold uppercase tracking-wider">ENVIRONMENTAL CONTEXT UNAVAILABLE</p>
                      <p className="text-[11px] text-slate-400 font-sans leading-snug">
                        Live environmental context could not be retrieved.
                      </p>
                    </div>
                  )}
                </div>

                {/* How Aerogrid works */}
                <div className="space-y-4 pt-2">
                  <h3 className="text-xs font-mono font-bold text-[#A2B1C4] tracking-widest uppercase text-center">
                    {t.worksHeader}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-[#101A28] border border-slate-800 space-y-2">
                      <div className="w-7 h-7 rounded-full bg-[#00C9FF]/10 text-[#00C9FF] border border-[#00C9FF]/30 flex items-center justify-center font-bold text-xs font-mono">
                        1
                      </div>
                      <p className="text-xs text-[#A2B1C4] leading-relaxed">{t.works1}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-[#101A28] border border-slate-800 space-y-2">
                      <div className="w-7 h-7 rounded-full bg-[#916BFF]/10 text-[#916BFF] border border-[#916BFF]/30 flex items-center justify-center font-bold text-xs font-mono">
                        2
                      </div>
                      <p className="text-xs text-[#A2B1C4] leading-relaxed">{t.works2}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-[#101A28] border border-slate-800 space-y-2">
                      <div className="w-7 h-7 rounded-full bg-[#FF8B1C]/10 text-[#FF8B1C] border border-[#FF8B1C]/30 flex items-center justify-center font-bold text-xs font-mono">
                        3
                      </div>
                      <p className="text-xs text-[#A2B1C4] leading-relaxed">{t.works3}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-[#101A28] border border-slate-800 space-y-2">
                      <div className="w-7 h-7 rounded-full bg-[#31D697]/10 text-[#31D697] border border-[#31D697]/30 flex items-center justify-center font-bold text-xs font-mono">
                        4
                      </div>
                      <p className="text-xs text-[#A2B1C4] leading-relaxed">{t.works4}</p>
                    </div>
                  </div>
                </div>

                {/* Disclosure Footer */}
                <div className="text-[10px] text-slate-500 font-mono italic leading-relaxed text-center pt-8 border-t border-slate-900">
                  Helix Orbit Pilot Sandbox. All observations and context models are simulated for prototype verification purposes.
                </div>
              </div>
            )}

            {/* 1.1 CITIZEN CATEGORIES SELECTION VIEW */}
            {citizenView === "categories" && (
              <div className="space-y-6 animate-fade-in flex-grow flex flex-col justify-between" id="categories-view">
                <div className="space-y-6">
                  {/* Back button */}
                  <button 
                    onClick={() => setCitizenView("home")}
                    className="text-xs text-[#A2B1C4] hover:text-white font-mono flex items-center gap-1.5 cursor-pointer"
                  >
                    ← BACK TO HOME
                  </button>

                  <div className="space-y-2">
                    <h3 className="text-2xl font-extrabold text-white tracking-tight">
                      {t.categories_title}
                    </h3>
                    <p className="text-xs md:text-sm text-[#A2B1C4] leading-relaxed">
                      {t.categories_sub}
                    </p>
                  </div>

                  {/* 2x4 grid of categories */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="categories-grid">
                    {QUICK_CATEGORIES.map((cat) => {
                      const isSelected = selectedCategory === cat.key;
                      return (
                        <button
                          key={cat.key}
                          id={`category-card-${cat.key}`}
                          onClick={() => {
                            setSelectedCategory(cat.key);
                            setCategoryHint(cat.hint);
                            setCategoryLabel(cat.label);
                          }}
                          className={`p-4 rounded-xl text-left border transition-all duration-300 flex items-start gap-3 cursor-pointer group hover:scale-[1.01] ${
                            isSelected
                              ? "bg-[#00C9FF]/10 border-[#00C9FF] shadow-lg shadow-cyan-500/5"
                              : "bg-[#101A28] border-slate-800 hover:border-slate-700 hover:bg-[#132032]"
                          }`}
                        >
                          <span className="text-2xl pt-0.5">{cat.icon}</span>
                          <div className="space-y-1">
                            <h4 className={`text-xs font-bold tracking-wide font-mono uppercase transition-colors ${
                              isSelected ? "text-[#00C9FF]" : "text-white group-hover:text-[#00C9FF]"
                            }`}>
                              {t[`cat_${cat.key}_title`]}
                            </h4>
                            <p className="text-[11px] text-[#A2B1C4] leading-normal font-sans">
                              {t[`cat_${cat.key}_desc`]}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-900 flex justify-end">
                  <button
                    onClick={() => setCitizenView("report")}
                    disabled={!selectedCategory}
                    className={`px-8 py-3.5 rounded-xl font-bold font-mono text-xs tracking-wider transition-all uppercase flex items-center gap-2 cursor-pointer ${
                      selectedCategory
                        ? "bg-[#00C9FF] hover:bg-[#00b0df] text-[#080E18] shadow-md shadow-cyan-500/10"
                        : "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50"
                    }`}
                  >
                    <span>{t.add_evidence}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* 2. CITIZEN FORM REPORT VIEW */}
            {citizenView === "report" && (
              <div className="space-y-6 animate-fade-in flex-grow">
                {/* Back button */}
                <button 
                  onClick={() => setCitizenView("categories")}
                  className="text-xs text-[#A2B1C4] hover:text-white font-mono flex items-center gap-1.5 cursor-pointer"
                >
                  ← BACK TO CATEGORIES
                </button>

                <h3 className="text-lg font-bold text-white tracking-tight border-b border-slate-900 pb-2">
                  Submit Local Environmental Evidence
                </h3>

                {/* Selected Category Confirmation Banner */}
                {selectedCategory && (
                  <div className="p-4 rounded-xl bg-[#162334] border border-slate-800 flex justify-between items-center animate-fade-in" id="selected-category-banner">
                    <div>
                      <span className="text-[10px] font-mono text-slate-500 block uppercase">
                        {t.you_selected}
                      </span>
                      <span className="text-xs font-bold text-[#00C9FF] font-mono uppercase">
                        {t[`cat_${selectedCategory}_title`]}
                      </span>
                    </div>
                    <button
                      onClick={() => setCitizenView("categories")}
                      className="px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-[#00C9FF] text-[10px] font-mono font-bold hover:bg-slate-800 transition-all cursor-pointer"
                    >
                      {t.change_category}
                    </button>
                  </div>
                )}

                {/* STEP 1: SPEAK OR TEXT */}
                <div className="p-5 rounded-xl bg-[#101A28] border border-slate-800 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-mono text-[#A2B1C4] tracking-wider uppercase">
                      {t.step1Title}
                    </h4>
                    <span className="text-[9px] font-mono text-slate-500 bg-[#162334] px-1.5 py-0.5 rounded uppercase">
                      Language: {language}
                    </span>
                  </div>

                  {/* Microphones Control Representation */}
                  <div className="flex items-center gap-4 p-3 bg-[#162334] rounded-lg border border-slate-800">
                    <button
                      id="voice-input-mic-button"
                      aria-label="Start voice reporting in selected language"
                      aria-pressed={micState === "LISTENING"}
                      onClick={micState === "LISTENING" ? undefined : startSpeechRecognition}
                      disabled={micState === "PROCESSING"}
                      className={`p-3 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#00C9FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#101A28] transition-all cursor-pointer ${
                        micState === "LISTENING"
                          ? "bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/20"
                          : micState === "PROCESSING"
                          ? "bg-amber-500/20 border border-amber-500/40 text-amber-500 cursor-not-allowed"
                          : micState === "SUCCESS"
                          ? "bg-green-500/20 border border-green-500/40 text-green-500"
                          : micState === "ERROR"
                          ? "bg-rose-500/20 border border-rose-500/40 text-rose-500"
                          : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                      }`}
                    >
                      <Mic className={`w-5 h-5 ${micState === "LISTENING" ? "scale-110" : ""}`} />
                    </button>
                    <div className="flex-1 min-w-0">
                      {micState === "IDLE" && (
                        <>
                          <span className="text-xs font-bold text-white block">{t.micLabel}</span>
                          <span className="text-[10px] text-slate-400 block">English, Hindi, and Marathi languages supported</span>
                        </>
                      )}
                      {micState === "PROCESSING" && (
                        <>
                          <span className="text-xs font-bold text-amber-400 block uppercase">INITIALIZING...</span>
                          <span className="text-[10px] text-slate-400 block">Requesting microphone access</span>
                        </>
                      )}
                      {micState === "LISTENING" && (
                        <>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" />
                            <span className="text-xs font-bold text-red-400 block uppercase tracking-wider">LISTENING...</span>
                          </div>
                          <span className="text-[10px] text-white block font-medium animate-pulse">Speak now</span>
                        </>
                      )}
                      {micState === "SUCCESS" && (
                        <>
                          <span className="text-xs font-bold text-green-400 block uppercase">VOICE CAPTURED</span>
                          <span className="text-[10px] text-slate-400 block">Added to description below</span>
                        </>
                      )}
                      {micState === "ERROR" && micError && (
                        <>
                          <span className="text-xs font-bold text-rose-500 block uppercase">{micError.title}</span>
                          <span className="text-[10px] text-slate-400 block">{micError.subtitle}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <textarea
                    value={reportText}
                    onChange={(e) => setReportText(e.target.value)}
                    placeholder="Describe what you see: dense garbage smoke, open waste combustion, Metro site dust emissions, toxic chemical scent..."
                    className="w-full h-24 bg-[#080E18] border border-slate-800 focus:border-[#00C9FF] focus:ring-1 focus:ring-[#00C9FF]/30 p-3 rounded-lg text-sm text-[#F5F8FC] outline-none transition-all resize-none"
                  />

                  {/* USE DEMO MARATHI REPORT Helper */}
                  <div className="pt-1 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <button
                      onClick={handleUseDemoMarathi}
                      className="px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-[#916BFF] hover:text-purple-400 font-mono text-[10px] tracking-wider rounded font-bold transition-all cursor-pointer"
                    >
                      ✨ {t.demoMarathi}
                    </button>
                    {reportText.includes("कचरा जाळत") && (
                      <span className="text-[10px] text-[#A2B1C4] italic font-semibold">
                        Interpretation: {t.demoText}
                      </span>
                    )}
                  </div>
                </div>

                {/* STEP 2: ADD VISUAL EVIDENCE */}
                <div className="p-5 rounded-xl bg-[#101A28] border border-slate-800 space-y-4">
                  <h4 className="text-xs font-mono text-[#A2B1C4] tracking-wider uppercase">
                    {t.step2Title}
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {t.step2Sub}
                  </p>

                  {/* Upload Drop Zone */}
                  {!reportImage ? (
                    <div className="border-2 border-dashed border-slate-800 hover:border-slate-700 bg-[#162334]/40 rounded-xl p-8 text-center space-y-3 relative group transition-all duration-300">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                      />
                      <Upload className="w-8 h-8 text-[#A2B1C4] mx-auto group-hover:text-white transition-all" />
                      <div className="text-xs text-white">Drag and drop file here or click to browse</div>
                      <div className="text-[10px] text-slate-500 font-mono">JPG, PNG, WebP acceptable format</div>
                    </div>
                  ) : (
                    <div className="relative rounded-xl overflow-hidden border border-slate-800">
                      <img 
                        src={reportImage} 
                        alt="Citizen Environmental Evidence" 
                        className="w-full h-48 object-cover"
                      />
                      <div className="absolute top-2 left-2 bg-[#080E18]/80 text-[#FF8B1C] px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider uppercase">
                        {reportImage.startsWith("data:") ? "Live user attachment" : "Demo environmental evidence"}
                      </div>
                      <button
                        onClick={handleClearImage}
                        className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/90 text-white rounded-full transition-all text-xs cursor-pointer"
                        title="Remove image"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Synthetic Demo Helpers */}
                  <div className="pt-2">
                    <span className="text-[10px] text-[#A2B1C4] font-mono block mb-1.5">DEMO SCENARIO EVIDENCE QUICK PRESETS:</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => handleSelectDemoEvidence("waste")}
                        className="px-2.5 py-1.5 rounded bg-[#162334] hover:bg-slate-800 border border-slate-800 text-xs text-white font-mono cursor-pointer"
                      >
                        🔥 OPEN GARBAGE COMBUSTION
                      </button>
                      <button
                        onClick={() => handleSelectDemoEvidence("dust")}
                        className="px-2.5 py-1.5 rounded bg-[#162334] hover:bg-slate-800 border border-slate-800 text-xs text-white font-mono cursor-pointer"
                      >
                        🏗️ METRO CONSTRUCTION DUST
                      </button>
                      <button
                        onClick={() => handleSelectDemoEvidence("smog")}
                        className="px-2.5 py-1.5 rounded bg-[#162334] hover:bg-slate-800 border border-slate-800 text-xs text-white font-mono cursor-pointer"
                      >
                        🚗 TRAFFIC SMOG plume
                      </button>
                    </div>
                  </div>
                </div>

                {/* STEP 3: CONFIRM LOCATION */}
                <div className="p-5 rounded-xl bg-[#101A28] border border-slate-800 space-y-4">
                  <h4 className="text-xs font-mono text-[#A2B1C4] tracking-wider uppercase">
                    {t.step3Title}
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={handleDetectLocation}
                      className={`py-3 px-4 rounded-lg font-mono text-xs font-semibold tracking-wider transition-all duration-200 border cursor-pointer ${
                        locStatus === "granted"
                          ? "bg-emerald-500/10 text-[#31D697] border-emerald-500/30"
                          : "bg-[#162334] hover:bg-slate-800 text-white border-slate-800"
                      }`}
                    >
                      🛰️ {t.locRequest}
                    </button>
                    <button
                      onClick={handleUseDemoLocation}
                      className={`py-3 px-4 rounded-lg font-mono text-xs font-semibold tracking-wider transition-all duration-200 border cursor-pointer ${
                        locStatus === "demo"
                          ? "bg-[#00C9FF]/10 text-[#00C9FF] border-[#00C9FF]/30"
                          : "bg-purple-500/10 hover:bg-purple-500/20 text-[#916BFF] border-purple-500/20"
                      }`}
                    >
                      📍 {t.useDemoLoc}
                    </button>
                  </div>

                  {/* Geolocation Status Indicators */}
                  {latitude && longitude && (
                    <div className="p-3.5 bg-[#080E18] border border-slate-900 rounded-lg space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-[#A2B1C4]">GPS COORDINATES:</span>
                        <span className="text-white font-bold">{latitude.toFixed(4)}° N, {longitude.toFixed(4)}° E</span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-[#A2B1C4]">PILOT ASSIGNMENT:</span>
                        <span className="text-[#00C9FF] font-bold">Pune Central Zone</span>
                      </div>

                      {/* Outside Pune pilot area warning */}
                      {isOutsidePune && (
                        <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded text-xs text-[#FF5369] font-semibold flex items-center gap-2">
                          <AlertCircle className="w-4.5 h-4.5" />
                          <span>AEROGRID is currently operating as a Pune pilot. Selected point is outside configured boundary!</span>
                        </div>
                      )}

                      {submitError && (
                        <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded text-xs text-[#FF5369] font-semibold flex items-center gap-2">
                          <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                          <span>{submitError}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* SUBMIT BUTTON */}
                {(() => {
                  const isPredefinedCategory = selectedCategory !== "other" && selectedCategory !== "";
                  const hasEvidence = !!reportText.trim() || !!reportImage;
                  const hasLocation = !!latitude && !!longitude;
                  const canSubmit = hasLocation && (isPredefinedCategory || hasEvidence);

                  return (
                    <button
                      onClick={handleAnalyzeEvidence}
                      disabled={!canSubmit}
                      className={`w-full py-4 px-6 font-bold font-mono text-sm tracking-widest rounded-xl transition-all duration-300 uppercase shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
                        canSubmit 
                          ? "bg-[#00C9FF] hover:bg-[#00b0df] text-[#080E18] shadow-cyan-500/10 hover:shadow-cyan-500/20" 
                          : "bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed opacity-50 shadow-none"
                      }`}
                    >
                      <Sparkles className={`w-5 h-5 ${canSubmit ? "text-[#080E18]" : "text-slate-500"}`} />
                      <span>{t.submitBtn}</span>
                    </button>
                  );
                })()}
              </div>
            )}

            {/* 3. GEMINI ANALYZING SEQUENCE VIEW */}
            {citizenView === "analyzing" && (
              <div className="py-20 text-center space-y-6 animate-pulse">
                <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                  {/* Glowing loading ring */}
                  <div className="absolute inset-0 rounded-full border-4 border-[#00C9FF]/20 border-t-[#00C9FF] animate-spin" />
                  <Sparkles className="w-8 h-8 text-[#00C9FF] animate-pulse" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white tracking-tight font-mono uppercase">
                    GEMINI ENGINE INITIATED
                  </h3>
                  <p className="text-sm text-[#A2B1C4] max-w-sm mx-auto">
                    {analysisText}
                  </p>
                </div>
                
                {/* Horizontal Progress Bar */}
                <div className="w-64 mx-auto h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div 
                    className="h-full bg-[#00C9FF] transition-all duration-300"
                    style={{ width: `${analysisProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* 4. GEMINI ANALYSIS RESULT VIEW */}
            {citizenView === "result" && analysisResult && (
              <div className="space-y-6 animate-fade-in">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center text-xs text-[#31D697] font-semibold">
                  ✓ Multimodal Analysis Complete. Environmental factors successfully parsed.
                </div>

                <div className="flex justify-between items-center border-b border-slate-900 pb-3">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-lg font-bold text-white">AI Evidence Analysis Report</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {analysisResult.analysisSource === "GEMINI_MULTIMODAL" ? (
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                          GEMINI MULTIMODAL
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                          DEMO ANALYSIS
                        </span>
                      )}
                    </div>
                  </div>
                  <SeverityBadge severity={analysisResult.severity} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Left Column: Gauge */}
                  <div className="md:col-span-1 flex flex-col justify-center">
                    <ConfidenceGauge confidence={analysisResult.confidence} title="AI EVIDENCE CONFIDENCE" />
                  </div>

                  {/* Right Column: Key indicators */}
                  <div className="md:col-span-2 p-5 rounded-xl bg-[#101A28] border border-slate-800 space-y-3.5">
                    <div>
                      <span className="text-[10px] font-mono text-slate-500 block uppercase">EXTRACTED EVENT TYPE</span>
                      <span className="text-md font-bold text-white font-mono tracking-wide">
                        {analysisResult.eventType.replace(/_/g, " ")}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono text-slate-500 block uppercase">OBSERVED EVIDENCE METRICS</span>
                      <div className="flex gap-2 mt-1">
                        <span className="text-xs bg-slate-900 border border-slate-800 text-[#00C9FF] px-2.5 py-0.5 rounded font-mono">
                          SMOKE: {analysisResult.visualEvidence?.smokeDetected ? "DETECTED" : "NONE"}
                        </span>
                        <span className="text-xs bg-slate-900 border border-slate-800 text-[#00C9FF] px-2.5 py-0.5 rounded font-mono">
                          DENSITY: {analysisResult.visualEvidence?.smokeDensity || "HIGH"}
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono text-slate-500 block uppercase">ANALYSIS EXTRACTS SUMMARY</span>
                      <p className="text-xs text-[#A2B1C4] leading-relaxed mt-1">
                        {analysisResult.summary}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Evidence points block */}
                <div className="p-5 rounded-xl bg-[#101A28] border border-slate-800 space-y-3">
                  <h4 className="text-xs font-mono text-white tracking-widest uppercase">EXTRACTED INDICATORS</h4>
                  <ul className="space-y-2">
                    {analysisResult.evidence && analysisResult.evidence.map((evPoint: string, i: number) => (
                      <li key={i} className="text-xs text-[#A2B1C4] flex items-start gap-2">
                        <span className="text-[#00C9FF] font-bold select-none">•</span>
                        <span>{evPoint}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Principle Warning Card */}
                <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/20 text-center space-y-2">
                  <div className="text-xs font-bold text-[#FF8B1C] font-mono tracking-wider">
                    ⚠️ ONE REPORT = OBSERVATION
                  </div>
                  <p className="text-[11px] text-[#A2B1C4] leading-relaxed max-w-md mx-auto">
                    AEROGRID does not trigger a public pollution hotspot or dispatch alarms from one isolated citizen report. 
                    Let's feed this into our Signal Fusion Network to search for correlated independent evidence.
                  </p>
                </div>

                {/* Primary navigation Button */}
                <button
                  onClick={handleGoToCorrelation}
                  className="w-full py-4 px-6 bg-[#916BFF] hover:bg-[#8055ff] text-white font-bold font-mono text-sm tracking-widest rounded-xl transition-all duration-300 uppercase shadow-lg shadow-purple-500/10 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-5 h-5 text-white" />
                  <span>CHECK SIGNAL NETWORK</span>
                </button>
              </div>
            )}

            {/* 5. SIGNAL CORRELATION INTERACTIVE VIEW */}
            {citizenView === "correlation" && (
              <div className="space-y-6 animate-fade-in">
                {/* Search correlation */}
                <SignalCorrelation 
                  score={fusedHotspot?.fusion?.finalScore ?? null} 
                  autoProgress={true} 
                  onComplete={handleCorrelationFinish}
                  hotspot={fusedHotspot}
                />

                {correlationCompleted && fusedHotspot && (
                  <div className="p-5 rounded-xl bg-[#FF5369]/5 border border-[#FF5369]/20 space-y-4 animate-fade-in">
                    <div className="flex items-center gap-2.5 text-[#FF5369]">
                      <ShieldAlert className="w-6 h-6 animate-bounce" />
                      <div>
                        <h4 className="font-bold text-sm tracking-wider uppercase">NEW ENVIRONMENTAL HOTSPOT SIGNALS DETECTED</h4>
                        <p className="text-[11px] text-[#A2B1C4] font-mono">Pune Central Pilot Zone Centroid</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
                      <div className="bg-[#101A28] p-3 rounded border border-slate-800">
                        <span className="text-slate-500 block text-[9px]">FUSION SCORE</span>
                        <span className="text-white font-bold text-sm">{(fusedHotspot.fusion.finalScore * 100).toFixed(0)}% Match</span>
                      </div>
                      <div className="bg-[#101A28] p-3 rounded border border-slate-800">
                        <span className="text-slate-500 block text-[9px]">LATEST OBSERVATION</span>
                        <span className="text-[#00C9FF] font-bold text-sm">JUST NOW</span>
                      </div>
                      <div className="bg-[#101A28] p-3 rounded border border-slate-800 col-span-2 sm:col-span-1">
                        <span className="text-slate-500 block text-[9px]">ALARM LEVEL</span>
                        <span className="text-[#FF5369] font-bold text-sm">{fusedHotspot.severity}</span>
                      </div>
                    </div>

                     <p className="text-xs text-[#A2B1C4] leading-relaxed">
                      {fusedHotspot.reportsCount > 1 
                        ? `${fusedHotspot.reportsCount} citizen observations were correlated, combined with `
                        : "Citizen observation combined with "}
                      {fusedHotspot.fusion.groundMonitoringAnomaly !== null 
                        ? `ground PM2.5 anomalies of +${Math.round(fusedHotspot.fusion.groundMonitoringAnomaly * 100)}%`
                        : "ground PM2.5 air metrics"} and NASA FIRMS thermal context have flagged 
                      a critical local combustion source.
                    </p>

                    <button
                      onClick={() => {
                        setRole("municipal");
                        setActiveTab("overview");
                        setSelectedHotspotId(fusedHotspot.id);
                      }}
                      className="w-full py-3 px-4 bg-[#FF5369] hover:bg-[#ff3b55] text-white font-bold font-mono text-xs tracking-widest rounded-lg transition-all uppercase cursor-pointer"
                    >
                      OPEN MUNICIPAL COMMAND CENTRE
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* ========================================================
            MUNICIPAL DESK EXPERIENCE
            ======================================================== */}
        {role === "municipal" && (
          <div className="flex-grow flex flex-col md:flex-row h-[calc(100vh-73px)] overflow-hidden">
            
            {/* LEFT COLUMN: ACTIVE SIGNALS, MAP & STATISTICS */}
            <div className="w-full md:w-3/5 p-4 flex flex-col gap-4 overflow-y-auto h-full border-r border-slate-900 bg-[#080E18]">
              
              {/* Command Metrics bar */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-[#101A28] border border-slate-800">
                  <span className="text-[10px] font-mono text-[#A2B1C4] block uppercase">Active Observations</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold text-[#00C9FF] font-mono">
                      {String(hotspotsList.reduce((sum, h) => sum + h.citizenReports.length, 0)).padStart(2, '0')}
                    </span>
                    <span className="text-[9px] bg-[#00C9FF]/10 text-[#00C9FF] px-1 rounded">Live Pune</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#101A28] border border-slate-800">
                  <span className="text-[10px] font-mono text-[#A2B1C4] block uppercase">Emerging Hotspots</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold text-[#FF8B1C] font-mono">
                      {String(hotspotsList.length).padStart(2, '0')}
                    </span>
                    <span className="text-[9px] bg-[#FF8B1C]/10 text-[#FF8B1C] px-1 rounded">Heuristic Match</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#101A28] border border-slate-800">
                  <span className="text-[10px] font-mono text-[#A2B1C4] block uppercase">High-Confidence Signals</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold text-[#FF5369] font-mono">
                      {String(hotspotsList.filter(h => h.signalStrength >= 0.75).length).padStart(2, '0')}
                    </span>
                    <span className="text-[9px] bg-red-500/10 text-red-500 px-1 rounded">Critical</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#101A28] border border-slate-800">
                  <span className="text-[10px] font-mono text-[#A2B1C4] block uppercase">Reports Today</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold text-white font-mono">
                      {String(hotspotsList.reduce((sum, h) => sum + h.citizenReports.length, 0)).padStart(2, '0')}
                    </span>
                    <span className="text-[9px] bg-[#00C9FF]/10 text-[#00C9FF] px-1 rounded">Live Count</span>
                  </div>
                </div>
              </div>

              {/* GIS Vector Map */}
              <div className="flex-grow min-h-[350px] relative rounded-xl overflow-hidden border border-slate-800">
                <PuneMap 
                  hotspots={hotspotsList}
                  selectedHotspotId={selectedHotspotId}
                  onSelectHotspot={(id) => {
                    setSelectedHotspotId(id);
                    setActiveTab("overview");
                  }}
                />
              </div>

              {/* Hotspot incident selection feed */}
              <div className="space-y-3">
                <h4 className="text-xs font-mono font-bold text-[#A2B1C4] tracking-widest uppercase">
                  HIGH-CONFIDENCE HOTSPOTS LIST
                </h4>
                
                {hotspotsList.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 font-mono bg-[#101A28] border border-slate-800 rounded-xl">
                    No active hotspots. Submit a report from the Citizen View to generate an environmental hotspot.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {hotspotsList.map((h) => {
                      const isSelected = selectedHotspotId === h.id;
                      return (
                        <div
                          key={h.id}
                          onClick={() => setSelectedHotspotId(h.id)}
                          className={`p-4 rounded-xl transition-all duration-200 cursor-pointer border ${
                            isSelected 
                              ? "bg-[#162334] border-[#FF5369]/50 shadow-md shadow-[#FF5369]/5" 
                              : "bg-[#101A28] border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2 mb-2">
                            <div>
                              <span className="text-[9px] font-mono bg-red-500/10 text-[#FF5369] px-1.5 py-0.5 rounded mr-2 font-bold uppercase">
                                {h.severity}
                              </span>
                              <span className="text-xs font-bold text-white font-mono">{h.id.toUpperCase()}</span>
                            </div>
                            <span className="text-[10px] font-mono text-[#A2B1C4]">
                              {h.citizenReports.length} Correlated Obs
                            </span>
                          </div>
                          
                          <p className="text-xs text-white font-semibold mb-1">
                            {h.eventType.replace(/_/g, " ")} spotted near centroid
                          </p>
                          <p className="text-[11px] text-[#A2B1C4] truncate">
                            {h.address}
                          </p>

                          <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-slate-500 border-t border-slate-900 pt-2">
                            <span>SIGNAL STRENGTH: {(h.signalStrength * 100).toFixed(0)}%</span>
                            <span className={isDemoMode ? "text-[#31D697]" : "text-slate-500 text-right max-w-[150px] truncate"}>
                              {isDemoMode 
                                ? (h.dispatch?.status === "EN_ROUTE" ? "★ TEAM EN ROUTE (ETA 18m)" : "● AVAILABLE FOR ACTION")
                                : "MUNICIPAL DISPATCH INTEGRATION NOT CONNECTED"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: ACTIVE INCIDENT COMMAND CENTER DETAIL */}
            <div className="w-full md:w-2/5 p-4 bg-[#101A28] border-t md:border-t-0 border-slate-900 overflow-y-auto h-full flex flex-col gap-4">
              
              {currentHotspot ? (
                <div className="space-y-6">
                  {/* Hotspot details panel */}
                  <div className="space-y-2 border-b border-slate-900 pb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono text-[#A2B1C4] tracking-widest uppercase">
                        Active environmental signal
                      </span>
                      <SeverityBadge severity={currentHotspot.severity ? currentHotspot.severity.toUpperCase() : "HIGH"} />
                    </div>
                    
                    <h3 className="text-xl font-extrabold text-white font-mono">
                      {currentHotspot.eventType.replace(/_/g, " ")}
                    </h3>
                    <p className="text-xs text-[#A2B1C4] font-semibold">
                      📍 {currentHotspot.address}
                    </p>

                    <div className="flex gap-4 pt-2">
                      <div className="px-2.5 py-1 bg-[#162334] rounded border border-slate-800 text-[10px] font-mono">
                        <span className="text-slate-500 block">FUSION LEVEL</span>
                        <span className="text-[#00C9FF] font-bold">{(currentHotspot.signalStrength * 100).toFixed(0)}% MATCH</span>
                      </div>
                      <div className="px-2.5 py-1 bg-[#162334] rounded border border-slate-800 text-[10px] font-mono">
                        <span className="text-slate-500 block">PRIORITY ACTION</span>
                        <span className="text-[#FF5369] font-bold">CRITICAL</span>
                      </div>
                    </div>
                  </div>

                  {/* Tab controllers */}
                  <div className="flex border-b border-slate-900 text-xs font-mono">
                    <button
                      onClick={() => setActiveTab("overview")}
                      className={`px-3 py-2 border-b-2 font-bold cursor-pointer transition-all ${
                        activeTab === "overview" 
                          ? "border-[#00C9FF] text-white" 
                          : "border-transparent text-slate-500 hover:text-[#A2B1C4]"
                      }`}
                    >
                      OVERVIEW
                    </button>
                    <button
                      onClick={() => setActiveTab("live-signals")}
                      className={`px-3 py-2 border-b-2 font-bold cursor-pointer transition-all ${
                        activeTab === "live-signals" 
                          ? "border-[#00C9FF] text-white" 
                          : "border-transparent text-slate-500 hover:text-[#A2B1C4]"
                      }`}
                    >
                      EVIDENCE TIMELINE
                    </button>
                    <button
                      onClick={() => setActiveTab("analytics")}
                      className={`px-3 py-2 border-b-2 font-bold cursor-pointer transition-all ${
                        activeTab === "analytics" 
                          ? "border-[#00C9FF] text-white" 
                          : "border-transparent text-slate-500 hover:text-[#A2B1C4]"
                      }`}
                    >
                      PROTOTYPE RISK FORECAST
                    </button>
                  </div>

                  {/* Dynamic Active Tab render */}
                  {activeTab === "overview" && (
                    <div className="space-y-6 animate-fade-in">
                      
                      {/* Recommendations & Simulation dispatch panel */}
                      <ActionRecommendation 
                        hotspot={currentHotspot} 
                        onDispatch={handleDispatchTeam}
                        isDispatching={isDispatching}
                      />

                      {/* Citizen Reports Category Analysis Panel */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-mono text-[#A2B1C4] tracking-widest uppercase">
                          CITIZEN EVIDENCE METADATA
                        </h4>
                        <div className="grid grid-cols-1 gap-3">
                          {currentHotspot.citizenReports.map((report, idx) => {
                            const isSeeded = report.isSeeded;
                            const hasCategoryData = !!report.selectedCategory || !!report.categoryHint || !!report.analysis?.categoryAgreement || !!report.categoryAgreement;
                            const agreement = report.categoryAgreement || report.analysis?.categoryAgreement || "INSUFFICIENT_EVIDENCE";
                            const conflictReason = report.categoryConflictReason || report.analysis?.categoryConflictReason;
                            const citizenCat = report.categoryLabel || report.analysis?.categoryLabel || report.citizenSelectedCategory || report.analysis?.citizenSelectedCategory || "UNKNOWN";
                            const aiCat = report.aiDetectedCategory || report.analysis?.aiDetectedCategory || report.analysis?.eventType || "UNKNOWN";

                            return (
                              <div key={report.id || idx} className="p-4 rounded-xl bg-[#162334] border border-slate-800 space-y-3" id={`command-report-${idx}`}>
                                <div className="flex justify-between items-center border-b border-slate-800/60 pb-2">
                                  <span className="text-[10px] font-mono text-[#00C9FF] font-bold">
                                    {isSeeded ? "SEEDED REPORT (DEMO CONTEXT)" : "LIVE CITIZEN SUBMISSION"}
                                  </span>
                                  <span className="text-[9px] font-mono text-slate-500">
                                    {report.timestamp ? new Date(report.timestamp).toLocaleTimeString() : "Just now"}
                                  </span>
                                </div>

                                <p className="text-xs text-[#A2B1C4] italic leading-relaxed">
                                  {report.text ? `"${report.text}"` : "Observation text unavailable"}
                                </p>

                                {hasCategoryData ? (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                    <div className="space-y-1">
                                      <span className="text-[9px] font-mono text-slate-500 block uppercase">CITIZEN CATEGORY</span>
                                      <span className="text-xs font-bold text-white font-mono">{citizenCat}</span>
                                    </div>
                                    <div className="space-y-1">
                                      <span className="text-[9px] font-mono text-slate-500 block uppercase">AI-DETECTED CATEGORY</span>
                                      <span className="text-xs font-bold text-[#916BFF] font-mono">{aiCat.replace(/_/g, " ")}</span>
                                    </div>
                                    
                                    <div className="sm:col-span-2 space-y-2 pt-1 border-t border-slate-800/40">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-mono text-slate-500 uppercase font-bold">AGREEMENT</span>
                                        {agreement === "AGREES" && (
                                          <span className="text-[9px] bg-emerald-500/10 text-[#31D697] border border-emerald-500/20 px-2 py-0.5 rounded font-mono font-bold uppercase" id={`agrees-badge-${idx}`}>
                                            ● AI AGREES
                                          </span>
                                        )}
                                        {agreement === "CONFLICT" && (
                                          <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-mono font-bold uppercase" id={`conflict-badge-${idx}`}>
                                            ⚠️ CONFLICT / RECLASSIFIED
                                          </span>
                                        )}
                                        {agreement === "INSUFFICIENT_EVIDENCE" && (
                                          <span className="text-[9px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded font-mono font-bold uppercase" id={`insufficient-badge-${idx}`}>
                                            ℹ INSUFFICIENT EVIDENCE
                                          </span>
                                        )}
                                      </div>

                                      {agreement === "CONFLICT" && conflictReason && (
                                        <div className="p-2.5 rounded bg-amber-500/5 border border-amber-500/10 text-[11px] text-amber-300 leading-normal font-mono" id={`conflict-reason-${idx}`}>
                                          {conflictReason}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="pt-1">
                                    <span className="text-[9px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded font-mono font-bold uppercase">
                                      Legacy Report (Pre-Categories)
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Environmental context (ground sensor + weather dispersion + satellite thermal) */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-mono text-[#A2B1C4] tracking-widest uppercase">
                          ENVIRONMENTAL DATA OVERLAYS
                        </h4>
                        <EnvironmentalContext context={currentHotspot.context} />
                      </div>
                    </div>
                  )}

                  {activeTab === "live-signals" && (
                    <div className="animate-fade-in">
                      <EvidenceTimeline hotspot={currentHotspot} />
                    </div>
                  )}

                  {activeTab === "analytics" && (
                    <div className="animate-fade-in">
                      {currentHotspot.forecast ? (
                        <ForecastChart forecast={currentHotspot.forecast} />
                      ) : (
                        <div className="p-8 rounded-xl bg-[#101A28] border border-slate-800 text-center space-y-3">
                          <p className="text-sm font-mono text-slate-400 font-bold uppercase tracking-wider">
                            FORECASTING NOT AVAILABLE IN LIVE PILOT MODE
                          </p>
                          <p className="text-xs text-slate-500 font-sans leading-normal">
                            Operational forecasting models are undergoing pilot calibration.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <Info className="w-10 h-10 text-slate-600" />
                  <p className="text-xs text-slate-500 font-mono">
                    No active hotspots generated yet. Use the citizen view to report visible pollution and test the automated heuristic correlation.
                  </p>
                </div>
              )}

            </div>

          </div>
        )}

      </main>

      {/* FIXED BASE FOOTER SYSTEM METRIC */}
      <footer className="bg-[#080E18] border-t border-slate-950 px-4 py-3 flex justify-between items-center text-[10px] font-mono text-slate-500">
        <div>HELIX ORBIT © 2026</div>
        <div className="flex items-center gap-1.5">
          <Server className="w-3 h-3 text-[#00C9FF]" />
          <span>AEROGRID SEEDED ENGINE V1.0 (PUNE PILOT)</span>
        </div>
      </footer>

    </div>
  );
}
