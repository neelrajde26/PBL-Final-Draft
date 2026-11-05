"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import en from "@/locales/en.json";
import mr from "@/locales/mr.json";

export type Language = "en" | "mr";

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string, fallback?: string) => string;
}

const dictionaries: Record<Language, Record<string, unknown>> = { en, mr };

const I18nContext = createContext<I18nContextType>({
  language: "en",
  setLanguage: () => {},
  t: (path: string, fallback?: string) => fallback || path,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("mdis_language") as Language | null;
        if (saved === "en" || saved === "mr") return saved;
      } catch {
        // Ignore storage errors
      }
    }
    return "en";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem("mdis_language", lang);
    } catch {
      // Ignore
    }
  };

  const t = (path: string, fallback?: string): string => {
    const keys = path.split(".");
    let current: unknown = dictionaries[language];
    for (const key of keys) {
      if (current && typeof current === "object" && key in current) {
        current = (current as Record<string, unknown>)[key];
      } else {
        // Fallback to English if missing in Marathi
        let fallbackVal: unknown = dictionaries["en"];
        for (const k of keys) {
          if (fallbackVal && typeof fallbackVal === "object" && k in fallbackVal) {
            fallbackVal = (fallbackVal as Record<string, unknown>)[k];
          } else {
            return fallback || path;
          }
        }
        return typeof fallbackVal === "string" ? fallbackVal : fallback || path;
      }
    }
    return typeof current === "string" ? current : fallback || path;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

