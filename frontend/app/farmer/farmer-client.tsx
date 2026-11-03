"use client";

import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Droplets,
  HelpCircle,
  History,
  Info,
  MapPin,
  Send,
  Sparkles,
  Sprout,
  Thermometer,
  Volume2,
} from "lucide-react";
import { useEffect, useState } from "react";

import { SpeakButton } from "@/components/speak-button";
import {
  getFarmerAdvisory,
  getFarmerPrediction,
  submitFarmerReport,
  type District,
  type FarmerPredictionResult,
  type FarmerReport,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Props = {
  districts: District[];
  initialReports: FarmerReport[];
};

export function FarmerClient({ districts, initialReports }: Props) {
  const { language, setLanguage, t } = useI18n();

  // District state
  const [selectedDistrict, setSelectedDistrict] = useState("beed");

  // Advisory state (live backend query)
  const [advisoryLoading, setAdvisoryLoading] = useState(true);
  const [advisory, setAdvisory] = useState<{
    warning_level: string;
    advisory_text: string;
    drivers: string[];
  } | null>(null);

  // Farmer Prediction Form state
  const [crop, setCrop] = useState("Soybean (सोयाबीन)");
  const [taluka, setTaluka] = useState("");
  const [village, setVillage] = useState("");
  const [growthStage, setGrowthStage] = useState("flowering");
  const [sowingDate, setSowingDate] = useState("2024-06-25");
  const [irrigationType, setIrrigationType] = useState("rainfed");
  const [soilCondition, setSoilCondition] = useState("dry");
  const [recentRainfall, setRecentRainfall] = useState("no_rain_15d");
  const [cropStress, setCropStress] = useState("leaf_wilting");
  const [horizon, setHorizon] = useState("30d");

  // Prediction Result State
  const [predicting, setPredicting] = useState(false);
  const [predictionResult, setPredictionResult] = useState<FarmerPredictionResult | null>(null);
  const [predictError, setPredictError] = useState<string | null>(null);

  // Field Report Form State
  const [concern, setConcern] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reports, setReports] = useState<FarmerReport[]>(initialReports);

  // Load district advisory dynamically on district or language change
  useEffect(() => {
    let active = true;
    getFarmerAdvisory(selectedDistrict, language)
      .then((res) => {
        if (active) {
          setAdvisory({
            warning_level: res.warning_level,
            advisory_text: res.advisory_text,
            drivers: res.drivers,
          });
        }
      })
      .catch((err) => {
        console.warn("Failed to load advisory:", err);
      })
      .finally(() => {
        if (active) setAdvisoryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedDistrict, language]);

  // Handle Farmer Prediction Form submission
  const handlePredict = async (e: React.FormEvent) => {
    e.preventDefault();
    setPredicting(true);
    setPredictError(null);
    try {
      const res = await getFarmerPrediction({
        district_id: selectedDistrict,
        crop,
        growth_stage: growthStage,
        sowing_date: sowingDate,
        irrigation_type: irrigationType,
        soil_condition: soilCondition,
        recent_rainfall: recentRainfall,
        crop_stress: cropStress,
        horizon,
      });
      setPredictionResult(res);
    } catch (err: unknown) {
      setPredictError(err instanceof Error ? err.message : "Failed to generate prediction.");
    } finally {
      setPredicting(false);
    }
  };

  // Handle Field Report Submission
  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!concern.trim()) return;
    setSubmitting(true);
    setSubmitSuccess(null);
    setSubmitError(null);

    try {
      const res = await submitFarmerReport({
        district_id: selectedDistrict,
        taluka: taluka || undefined,
        village: village || undefined,
        crop,
        concern,
        description: description || "Ground-truthed field report submitted via Farmer Portal.",
      });

      setSubmitSuccess(
        language === "mr"
          ? "आपला क्षेत्रीय अहवाल यशस्वीरित्या नोंदवला गेला आहे! उपग्रह निरीक्षणांची पडताळणी केल्याबद्दल धन्यवाद."
          : "Report submitted successfully! Thank you for ground-truthing satellite observations."
      );
      setReports((prev) => [res.report, ...prev]);
      setConcern("");
      setDescription("");
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit field report.");
    } finally {
      setSubmitting(false);
    }
  };

  const currentDistrictObj = districts.find((d) => d.id === selectedDistrict);

  // Severity styling map
  const getSeverityBadge = (level: string) => {
    switch (level.toLowerCase()) {
      case "extreme":
        return { bg: "bg-red-950 text-red-400 border-red-800", label: t("severity.extreme") };
      case "severe":
        return { bg: "bg-rose-950 text-rose-400 border-rose-800", label: t("severity.severe") };
      case "moderate":
        return { bg: "bg-amber-950 text-amber-400 border-amber-800", label: t("severity.moderate") };
      case "watch":
        return { bg: "bg-yellow-950 text-yellow-400 border-yellow-800", label: t("severity.watch") };
      default:
        return { bg: "bg-emerald-950 text-emerald-400 border-emerald-800", label: t("severity.normal") };
    }
  };

  const activeBadge = getSeverityBadge(advisory?.warning_level || "normal");

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* 1. Portal Header & Welcome Banner */}
      <section className="bg-[var(--surface)] border border-[var(--border)] rounded p-5 sm:p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[var(--aqua)]">
              <Sprout size={20} />
              <span className="text-xs font-mono font-semibold tracking-wider uppercase">
                {language === "mr" ? "शेतकरी निर्णय सहाय्य प्रणाली" : "Farmer Decision Support"}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text)]">
              {t("farmer.title")}
            </h1>
            <p className="text-sm text-[var(--secondary)] max-w-2xl leading-relaxed">
              {t("farmer.subtitle")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* District dropdown */}
            <div className="flex items-center gap-2 bg-[var(--ground)] border border-[var(--border)] rounded px-3 py-1.5 text-xs">
              <MapPin size={15} className="text-[var(--aqua)]" />
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="bg-transparent border-none text-[var(--text)] font-medium focus:outline-none cursor-pointer"
                aria-label={t("farmer.selectDistrict")}
              >
                {districts.map((d) => (
                  <option key={d.id} value={d.id} className="bg-[var(--surface)] text-[var(--text)]">
                    {d.name} ({d.region})
                  </option>
                ))}
              </select>
            </div>

            {/* Read Aloud Overview */}
            {advisory?.advisory_text && (
              <SpeakButton
                textToSpeak={`${currentDistrictObj?.name || selectedDistrict}: ${advisory.advisory_text}`}
                title={t("farmer.listen")}
              />
            )}
          </div>
        </div>
      </section>

      {/* 2. District Moisture & Agricultural Advisory Panel */}
      <section className="bg-[var(--surface)] border border-[var(--border)] rounded p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
          <div className="flex items-center gap-2.5">
            <Thermometer size={18} className="text-[var(--aqua)]" />
            <h2 className="text-lg font-semibold text-[var(--text)]">
              {currentDistrictObj?.name || selectedDistrict} — {t("farmer.advisoryTitle")}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded text-xs font-mono font-medium border ${activeBadge.bg}`}>
              {activeBadge.label}
            </span>
          </div>
        </div>

        {advisoryLoading ? (
          <div className="py-6 text-center text-xs text-[var(--subtle)] animate-pulse">
            {t("common.loading")}
          </div>
        ) : advisory ? (
          <div className="space-y-4">
            <div className="bg-[var(--ground)] border border-[var(--border)] rounded p-4 text-sm leading-relaxed text-[var(--text)]">
              <p className="font-normal">{advisory.advisory_text}</p>
            </div>

            {advisory.drivers && advisory.drivers.length > 0 && (
              <div className="text-xs space-y-1.5">
                <span className="font-mono text-[var(--subtle)] uppercase tracking-wider block">
                  {language === "mr" ? "उपग्रह निरीक्षण घटक:" : "Contributing Environmental Drivers:"}
                </span>
                <ul className="grid sm:grid-cols-2 gap-2 text-[var(--secondary)]">
                  {advisory.drivers.map((drv, idx) => (
                    <li key={idx} className="flex items-center gap-2 bg-[var(--ground)] px-2.5 py-1.5 rounded border border-[var(--border)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--aqua)]" />
                      <span>{drv}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}
      </section>

      {/* 3. Interactive Farmer Drought Prediction & Scenario Simulation */}
      <section className="bg-[var(--surface)] border border-[var(--border)] rounded p-5 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border)] pb-4">
          <div className="flex items-center gap-2.5">
            <Sparkles size={18} className="text-[var(--aqua)]" />
            <div>
              <h2 className="text-lg font-semibold text-[var(--text)]">
                {language === "mr" ? "स्थानिक पीक दुष्काळ जोखीम अंदाज" : "Localized Crop Drought Risk Forecast"}
              </h2>
              <p className="text-xs text-[var(--secondary)]">
                {language === "mr"
                  ? "आपल्या शेतातील पिकाची माहिती निवडा आणि पुढील ३० दिवसांतील दुष्काळ जोखीम तपासा"
                  : "Provide local field inputs to evaluate forecast risk and receive tailored advice"}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handlePredict} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {/* Crop */}
          <div>
            <label className="block text-[var(--secondary)] mb-1 font-medium">{t("farmer.crop")}</label>
            <select
              value={crop}
              onChange={(e) => setCrop(e.target.value)}
              className="w-full bg-[var(--ground)] border border-[var(--border)] rounded p-2 text-[var(--text)] focus:outline-none focus:border-[var(--aqua)]"
            >
              <option value="Soybean (सोयाबीन)">{t("crops.soybean")}</option>
              <option value="Cotton (कापूस)">{t("crops.cotton")}</option>
              <option value="Tur (तूर)">{t("crops.pigeonpea")}</option>
              <option value="Bajra (बाजरी)">{t("crops.pearlmillet")}</option>
              <option value="Jowar (ज्वारी)">{t("crops.sorghum")}</option>
              <option value="Sugarcane (ऊस)">{t("crops.sugarcane")}</option>
              <option value="Gram (हरभरा)">{t("crops.gram")}</option>
              <option value="General Crop">{t("crops.general")}</option>
            </select>
          </div>

          {/* Growth Stage */}
          <div>
            <label className="block text-[var(--secondary)] mb-1 font-medium">{t("farmer.growthStage")}</label>
            <select
              value={growthStage}
              onChange={(e) => setGrowthStage(e.target.value)}
              className="w-full bg-[var(--ground)] border border-[var(--border)] rounded p-2 text-[var(--text)] focus:outline-none focus:border-[var(--aqua)]"
            >
              <option value="sowing">{t("stages.sowing")}</option>
              <option value="vegetative">{t("stages.vegetative")}</option>
              <option value="flowering">{t("stages.flowering")}</option>
              <option value="podding">{t("stages.podding")}</option>
              <option value="maturity">{t("stages.maturity")}</option>
            </select>
          </div>

          {/* Irrigation Type */}
          <div>
            <label className="block text-[var(--secondary)] mb-1 font-medium">{t("farmer.irrigation")}</label>
            <select
              value={irrigationType}
              onChange={(e) => setIrrigationType(e.target.value)}
              className="w-full bg-[var(--ground)] border border-[var(--border)] rounded p-2 text-[var(--text)] focus:outline-none focus:border-[var(--aqua)]"
            >
              <option value="rainfed">{t("irrigationTypes.rainfed")}</option>
              <option value="irrigated_well">{t("irrigationTypes.irrigated_well")}</option>
              <option value="irrigated_canal">{t("irrigationTypes.irrigated_canal")}</option>
              <option value="drip">{t("irrigationTypes.drip")}</option>
            </select>
          </div>

          {/* Recent Rainfall */}
          <div>
            <label className="block text-[var(--secondary)] mb-1 font-medium">{t("farmer.rainCondition")}</label>
            <select
              value={recentRainfall}
              onChange={(e) => setRecentRainfall(e.target.value)}
              className="w-full bg-[var(--ground)] border border-[var(--border)] rounded p-2 text-[var(--text)] focus:outline-none focus:border-[var(--aqua)]"
            >
              <option value="normal">{language === "mr" ? "वेळेवर समाधानकारक पाऊस (Normal)" : "Satisfactory rain"}</option>
              <option value="no_rain_15d">{language === "mr" ? "१५ दिवसांचा खंड (15-day dry spell)" : "15-day dry spell"}</option>
              <option value="no_rain_20d">{language === "mr" ? "२०+ दिवसांचा तीव्र खंड (20+ days dry spell)" : "20+ days dry spell"}</option>
            </select>
          </div>

          {/* Soil Moisture */}
          <div>
            <label className="block text-[var(--secondary)] mb-1 font-medium">{t("farmer.soilMoisture")}</label>
            <select
              value={soilCondition}
              onChange={(e) => setSoilCondition(e.target.value)}
              className="w-full bg-[var(--ground)] border border-[var(--border)] rounded p-2 text-[var(--text)] focus:outline-none focus:border-[var(--aqua)]"
            >
              <option value="adequate">{language === "mr" ? "ओलावा पुरेसा (Adequate moisture)" : "Adequate moisture"}</option>
              <option value="dry">{language === "mr" ? "माती कोरडी (Dry soil)" : "Dry topsoil"}</option>
              <option value="very_dry">{language === "mr" ? "जमिनीला भेगा / तीव्र कोरडी (Cracked soil)" : "Cracked / Dry"}</option>
            </select>
          </div>

          {/* Crop Stress */}
          <div>
            <label className="block text-[var(--secondary)] mb-1 font-medium">{t("farmer.cropStress")}</label>
            <select
              value={cropStress}
              onChange={(e) => setCropStress(e.target.value)}
              className="w-full bg-[var(--ground)] border border-[var(--border)] rounded p-2 text-[var(--text)] focus:outline-none focus:border-[var(--aqua)]"
            >
              <option value="none">{language === "mr" ? "कोणताही ताण नाही (Healthy)" : "No stress"}</option>
              <option value="leaf_wilting">{language === "mr" ? "दुपारी पाने सुकणे (Leaf wilting)" : "Leaf wilting"}</option>
              <option value="stunted_growth">{language === "mr" ? "वाढ खुंटणे / पिवळेपणा (Stunted/Yellowing)" : "Stunted / Yellowing"}</option>
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-3 pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-[var(--subtle)]">
              <Info size={14} className="text-[var(--aqua)]" />
              <span>
                {language === "mr"
                  ? "अंदाज मॉडेल: mdis-crop-advisory-v1.0 (३० दिवसांचा अंदाज)"
                  : "Inference model: mdis-crop-advisory-v1.0 (30-day forecast horizon)"}
              </span>
            </div>

            <button
              type="submit"
              disabled={predicting}
              className="w-full sm:w-auto px-5 py-2.5 rounded bg-[var(--aqua)] text-[var(--ground)] font-semibold text-xs hover:bg-[#45caa0] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {predicting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-[var(--ground)] border-t-transparent rounded-full animate-spin" />
                  <span>{t("common.loading")}</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>{t("farmer.getPrediction")}</span>
                </>
              )}
            </button>
          </div>
        </form>

        {predictError && (
          <div className="p-3 bg-red-950/40 border border-red-800 text-red-300 text-xs rounded">
            {predictError}
          </div>
        )}

        {/* Prediction Results Banner */}
        {predictionResult && (
          <div className="bg-[var(--ground)] border border-[var(--border)] rounded p-5 space-y-4 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1 rounded text-xs font-mono font-bold border ${getSeverityBadge(predictionResult.risk_level).bg}`}>
                  {language === "mr" ? predictionResult.severity_label_mr : predictionResult.severity_label_en}
                </span>
                <span className="text-sm font-mono text-[var(--text)]">
                  {language === "mr" ? "संभाव्यता:" : "Probability:"}{" "}
                  <strong className="text-[var(--aqua)]">
                    {Math.round(predictionResult.probability * 100)}%
                  </strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--secondary)] font-mono">
                  Horizon: {predictionResult.horizon}
                </span>
                <SpeakButton
                  textToSpeak={
                    language === "mr"
                      ? `${predictionResult.severity_label_mr}, संभाव्यता ${Math.round(predictionResult.probability * 100)} टक्के. ${predictionResult.advisory_mr}`
                      : `${predictionResult.severity_label_en}, probability ${Math.round(predictionResult.probability * 100)} percent. ${predictionResult.advisory_en}`
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-mono font-medium text-[var(--aqua)] uppercase tracking-wider block">
                {language === "mr" ? "पिकासाठी शास्त्रोक्त कृषी सल्ला:" : "Crop Agronomic Advisory:"}
              </span>
              <p className="text-sm leading-relaxed text-[var(--text)]">
                {language === "mr" ? predictionResult.advisory_mr : predictionResult.advisory_en}
              </p>
            </div>

            {/* Contributing factors */}
            <div className="pt-2 border-t border-[var(--border)]">
              <span className="text-[11px] font-mono text-[var(--subtle)] block mb-1.5 uppercase">
                {language === "mr" ? "जोखीम ठरवणारे प्रमुख घटक:" : "Top Contributing Factors:"}
              </span>
              <div className="flex flex-wrap gap-2 text-xs">
                {(language === "mr" ? predictionResult.drivers_mr : predictionResult.drivers_en).map((drv, i) => (
                  <span key={i} className="px-2 py-1 rounded bg-[var(--surface)] border border-[var(--border)] text-[var(--secondary)]">
                    {drv}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 4. Ground-Truth Field Report Submission */}
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-[var(--surface)] border border-[var(--border)] rounded p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <MapPin size={18} className="text-[var(--aqua)]" />
            <div>
              <h2 className="text-lg font-semibold text-[var(--text)]">{t("farmer.submitReport")}</h2>
              <p className="text-xs text-[var(--secondary)]">
                {language === "mr"
                  ? "आपल्या शेतातील प्रत्यक्ष निरीक्षण नोंदवा, ज्यामुळे शास्त्रोक्त उपग्रह मॉडेल अचूक होईल"
                  : "Submit ground observations to calibrate and ground-truth remote-sensing models"}
              </p>
            </div>
          </div>

          {submitSuccess && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs rounded flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{submitSuccess}</span>
            </div>
          )}

          {submitError && (
            <div className="p-3 bg-red-950/40 border border-red-800 text-red-300 text-xs rounded flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>{submitError}</span>
            </div>
          )}

          <form onSubmit={handleReportSubmit} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[var(--secondary)] mb-1 font-medium">{t("farmer.selectTaluka")}</label>
                <input
                  type="text"
                  placeholder="उदा. आष्टी / Ashti"
                  value={taluka}
                  onChange={(e) => setTaluka(e.target.value)}
                  className="w-full bg-[var(--ground)] border border-[var(--border)] rounded p-2 text-[var(--text)] focus:outline-none focus:border-[var(--aqua)]"
                />
              </div>
              <div>
                <label className="block text-[var(--secondary)] mb-1 font-medium">{t("farmer.village")}</label>
                <input
                  type="text"
                  placeholder="उदा. डोईठाण / Doithan"
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  className="w-full bg-[var(--ground)] border border-[var(--border)] rounded p-2 text-[var(--text)] focus:outline-none focus:border-[var(--aqua)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[var(--secondary)] mb-1 font-medium">{t("farmer.concernLabel")} *</label>
              <input
                type="text"
                required
                placeholder={t("farmer.concernPlaceholder")}
                value={concern}
                onChange={(e) => setConcern(e.target.value)}
                className="w-full bg-[var(--ground)] border border-[var(--border)] rounded p-2 text-[var(--text)] focus:outline-none focus:border-[var(--aqua)]"
              />
            </div>

            <div>
              <label className="block text-[var(--secondary)] mb-1 font-medium">
                {language === "mr" ? "सविस्तर माहिती (ऐच्छिक)" : "Detailed Field Note (Optional)"}
              </label>
              <textarea
                rows={3}
                placeholder={
                  language === "mr"
                    ? "उदा. विहिरीचे पाणी १० फूट खालावले आहे, कपाशीची पाने पिवळी पडत आहेत..."
                    : "e.g., Well water depth declined, leaves yellowing, soil cracked..."
                }
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-[var(--ground)] border border-[var(--border)] rounded p-2 text-[var(--text)] focus:outline-none focus:border-[var(--aqua)]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded bg-[var(--surface)] hover:bg-[var(--raised)] border border-[var(--aqua)] text-[var(--aqua)] font-semibold text-xs transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-[var(--aqua)] border-t-transparent rounded-full animate-spin" />
                  <span>{t("common.loading")}</span>
                </>
              ) : (
                <>
                  <Send size={13} />
                  <span>{t("farmer.submitButton")}</span>
                </>
              )}
            </button>
          </form>
        </section>

        {/* 5. Field Observation History */}
        <section className="bg-[var(--surface)] border border-[var(--border)] rounded p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <History size={18} className="text-[var(--aqua)]" />
            <div>
              <h2 className="text-lg font-semibold text-[var(--text)]">{t("farmer.historyTitle")}</h2>
              <p className="text-xs text-[var(--secondary)]">
                {language === "mr"
                  ? "नोंदवलेले क्षेत्रीय अहवाल आणि पडताळणी स्थिती"
                  : "Verified field submissions and ground-truthing status"}
              </p>
            </div>
          </div>

          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {reports.length === 0 ? (
              <div className="text-center py-8 text-xs text-[var(--subtle)]">
                {language === "mr" ? "अद्याप कोणताही अहवाल नोंदवला नाही." : "No reports logged yet."}
              </div>
            ) : (
              reports.map((r) => (
                <div key={r.id} className="bg-[var(--ground)] border border-[var(--border)] rounded p-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[var(--text)]">
                      {r.district_id.toUpperCase()} {r.taluka ? `· ${r.taluka}` : ""}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold border ${
                        r.status === "verified"
                          ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                          : "bg-amber-950 text-amber-400 border-amber-800"
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <p className="text-[var(--secondary)] line-clamp-2">{r.concern}</p>
                  {r.verification_notes && (
                    <div className="text-[11px] text-[var(--subtle)] border-t border-[var(--border)] pt-1 mt-1">
                      <span className="text-[var(--aqua)]">Verified: </span>
                      {r.verification_notes}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
