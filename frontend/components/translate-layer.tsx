"use client";

import { useEffect } from "react";

import part1 from "@/locales/mr-ui-1.json";
import part2 from "@/locales/mr-ui-2.json";
import part3 from "@/locales/mr-ui-3.json";
import { useI18n } from "@/lib/i18n";

/**
 * Site-wide Marathi rendering. Most screens were written with English strings inline, so instead of
 * threading t() through every component, this layer swaps visible text, placeholders, tooltips and
 * labels for their Marathi entries while Marathi is selected, and restores the English originals when
 * the user switches back. Text that changes later (API data, re-renders) is caught by a MutationObserver.
 * Mark an element with translate="no" or data-no-translate to keep it as written.
 */

const PHRASES: Record<string, string> = { ...part1, ...part2, ...part3 };

// Whole words that also appear inside composed text ("Latest month · Beed", "June 2024").
const WORDS: Record<string, string> = {
  "Mumbai City": "मुंबई शहर", "Mumbai Suburban": "मुंबई उपनगर", Thane: "ठाणे", Palghar: "पालघर", Raigad: "रायगड",
  Ratnagiri: "रत्नागिरी", Sindhudurg: "सिंधुदुर्ग", Nashik: "नाशिक", Dhule: "धुळे", Nandurbar: "नंदुरबार", Jalgaon: "जळगाव",
  Ahilyanagar: "अहिल्यानगर", Ahmednagar: "अहमदनगर", Pune: "पुणे", Satara: "सातारा", Sangli: "सांगली", Kolhapur: "कोल्हापूर",
  Solapur: "सोलापूर", "Chhatrapati Sambhajinagar": "छत्रपती संभाजीनगर", Aurangabad: "औरंगाबाद", Jalna: "जालना", Beed: "बीड",
  Latur: "लातूर", Dharashiv: "धाराशिव", Osmanabad: "उस्मानाबाद", Nanded: "नांदेड", Parbhani: "परभणी", Hingoli: "हिंगोली",
  Buldhana: "बुलढाणा", Akola: "अकोला", Washim: "वाशिम", Amravati: "अमरावती", Yavatmal: "यवतमाळ", Wardha: "वर्धा",
  Nagpur: "नागपूर", Bhandara: "भंडारा", Gondia: "गोंदिया", Chandrapur: "चंद्रपूर", Gadchiroli: "गडचिरोली",
  Konkan: "कोकण", Marathwada: "मराठवाडा", Vidarbha: "विदर्भ", "North Maharashtra": "उत्तर महाराष्ट्र",
  "Western Maharashtra": "पश्चिम महाराष्ट्र", Maharashtra: "महाराष्ट्र",
  January: "जानेवारी", February: "फेब्रुवारी", March: "मार्च", April: "एप्रिल", May: "मे", June: "जून", July: "जुलै",
  August: "ऑगस्ट", September: "सप्टेंबर", October: "ऑक्टोबर", November: "नोव्हेंबर", December: "डिसेंबर",
  Jan: "जाने", Feb: "फेब्रु", Mar: "मार्च", Apr: "एप्रि", Jun: "जून", Jul: "जुलै", Aug: "ऑग", Sept: "सप्टें", Sep: "सप्टें", Oct: "ऑक्टो", Nov: "नोव्हें", Dec: "डिसें",
  districts: "जिल्हे", district: "जिल्हा", months: "महिने", month: "महिना", days: "दिवस", ago: "पूर्वी",
  "high risk": "जास्त धोका", "severe risk": "गंभीर धोका", moderate: "मध्यम", watch: "सावधान", normal: "सामान्य",
  "increasing stress": "वाढता ताण", succeeded: "यशस्वी", failed: "अयशस्वी", accepted: "स्वीकृत", experimental: "प्रायोगिक",
  "Latest month": "नवीनतम महिना", "Last sync": "शेवटचे समक्रमण", "Last job": "शेवटचे काम", "Target month": "लक्ष्य महिना",
  Overview: "आढावा", latest: "नवीनतम", daily: "दैनिक", monthly: "मासिक", incremental: "वाढीव", sync: "समक्रमण",
  "z-score": "z-गुण", Forecasts: "अंदाज", Districts: "जिल्हे",
  "Earth Engine": "Earth Engine",
};
const WORD_RE = new RegExp(
  `\\b(${Object.keys(WORDS).sort((a, b) => b.length - a.length).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "g",
);

const ATTRS = ["placeholder", "title", "aria-label", "alt"] as const;
const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA", "KBD"]);

const originals = new WeakMap<Node, string>();
const attrOriginals = new WeakMap<Element, Map<string, string>>();

function translate(text: string): string | null {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed || !/[A-Za-z]/.test(trimmed)) return null;
  const exact = PHRASES[trimmed];
  if (exact) return text.replace(text.trim(), exact);
  const partial = text.replace(WORD_RE, (m) => WORDS[m] ?? m);
  return partial !== text ? partial : null;
}

function skipped(el: Element | null): boolean {
  for (let e = el; e; e = e.parentElement) {
    if (SKIP.has(e.tagName) || e.getAttribute("translate") === "no" || e.hasAttribute("data-no-translate")) return true;
  }
  return false;
}

function translateText(node: Text) {
  if (skipped(node.parentElement)) return;
  const current = node.nodeValue ?? "";
  const known = originals.get(node);
  // React rewrote the node with fresh English text: remember it as the new original.
  const source = known !== undefined && current === translate(known) ? known : current;
  const next = translate(source);
  originals.set(node, source);
  if (next && next !== current) node.nodeValue = next;
}

function translateAttrs(el: Element) {
  if (skipped(el)) return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (!v) continue;
    let store = attrOriginals.get(el);
    const prev = store?.get(a);
    const source = prev !== undefined && translate(prev) === v ? prev : v;
    const next = translate(source);
    if (!store) attrOriginals.set(el, (store = new Map()));
    store.set(a, source);
    if (next && next !== v) el.setAttribute(a, next);
  }
}

function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return translateText(root as Text);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  translateAttrs(root as Element);
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) translateText(n as Text);
    else translateAttrs(n as Element);
  }
}

function restore(root: Node) {
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n: Node | null = root; n; n = tw.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) {
      const o = originals.get(n);
      if (o !== undefined && n.nodeValue !== o) n.nodeValue = o;
    } else if (n.nodeType === Node.ELEMENT_NODE) {
      attrOriginals.get(n as Element)?.forEach((v, a) => (n as Element).setAttribute(a, v));
    }
  }
}

export function TranslateLayer() {
  const { language } = useI18n();

  useEffect(() => {
    document.documentElement.lang = language;
    if (language !== "mr") {
      restore(document.body);
      return;
    }
    walk(document.body);
    let queued = new Set<Node>();
    let frame = 0;
    const flush = () => {
      frame = 0;
      const batch = queued;
      queued = new Set();
      batch.forEach((n) => n.isConnected && walk(n));
    };
    const mo = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "characterData") queued.add(r.target);
        else if (r.type === "attributes") queued.add(r.target);
        else r.addedNodes.forEach((n) => queued.add(n));
      }
      if (!frame) frame = requestAnimationFrame(flush);
    });
    mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
    return () => {
      mo.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [language]);

  return null;
}
