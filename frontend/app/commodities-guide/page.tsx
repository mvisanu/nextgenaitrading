"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  ChevronDown,
  HelpCircle,
  BookOpen,
  TrendingUp,
  BarChart3,
  Flame,
  Shield,
  Zap,
  Globe,
  Bell,
  AlertTriangle,
  Info,
  Layers,
  DollarSign,
  Activity,
  Languages,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type Lang, tr } from "./translations";

// ─── Language Toggle ──────────────────────────────────────────────────────────

function LanguageToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-sm border border-border/10 bg-surface-low p-1">
      <Languages className="h-3 w-3 text-muted-foreground mx-1" />
      {(["en", "th"] as Lang[]).map((l) => (
        <Button
          key={l}
          size="sm"
          variant={lang === l ? "default" : "ghost"}
          onClick={() => onChange(l)}
          className={cn(
            "h-6 px-2.5 text-[10px] font-bold uppercase tracking-widest rounded-sm",
            lang === l ? "bg-primary text-primary-foreground" : "hover:bg-surface-high/50 text-muted-foreground"
          )}
        >
          {l === "en" ? "EN" : "ไทย"}
        </Button>
      ))}
    </div>
  );
}

// ─── Collapsible Section ──────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  accentColor = "text-primary",
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  accentColor?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn("bg-surface-low border rounded-sm transition-all", open ? "border-primary/20" : "border-border/10")}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-3 w-full px-4 sm:px-5 py-4 text-left hover:bg-surface-high/30 transition-colors"
      >
        <Icon className={cn("h-4 w-4 shrink-0", accentColor)} />
        <span className="flex-1 font-bold text-sm text-foreground">{title}</span>
        {open
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-4 sm:px-5 pb-5 pt-0 text-sm text-muted-foreground leading-relaxed space-y-4 border-t border-border/10">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── FAQ Item ─────────────────────────────────────────────────────────────────

function FAQ({ q, children }: { q: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/10 last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-start gap-2 w-full py-3 text-left hover:bg-surface-high/20 transition-colors rounded-sm px-1"
      >
        <HelpCircle className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
        <span className="flex-1 text-xs font-bold text-foreground">{q}</span>
        {open
          ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
          : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />}
      </button>
      {open && (
        <div className="pl-6 pb-3 text-xs text-muted-foreground leading-relaxed space-y-1">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Term Definition ──────────────────────────────────────────────────────────

function Term({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 py-2 border-b border-border/10 last:border-0">
      <code className="shrink-0 text-xs font-mono bg-surface-lowest px-2 py-0.5 rounded-sm text-primary sm:min-w-[160px]">
        {term}
      </code>
      <span className="text-xs text-muted-foreground">{children}</span>
    </div>
  );
}

// ─── Step ─────────────────────────────────────────────────────────────────────

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary mt-0.5">
        {n}
      </div>
      <div>
        <p className="text-xs font-bold text-foreground mb-1">{title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

// ─── Callout ──────────────────────────────────────────────────────────────────

function Callout({ type, children }: { type: "info" | "warning" | "tip"; children: React.ReactNode }) {
  const styles = {
    info:    { icon: Info,          bg: "bg-blue-500/5 border-blue-500/20",     text: "text-blue-400" },
    warning: { icon: AlertTriangle, bg: "bg-yellow-500/5 border-yellow-500/20", text: "text-yellow-400" },
    tip:     { icon: Zap,           bg: "bg-primary/5 border-primary/20",       text: "text-primary" },
  };
  const { icon: Icon, bg, text } = styles[type];
  return (
    <div className={cn("flex gap-2 p-3 rounded-sm border text-xs", bg)}>
      <Icon className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", text)} />
      <span className="text-muted-foreground leading-relaxed">{children}</span>
    </div>
  );
}

// ─── Symbols table data (static — labels translated via tr()) ─────────────────

const SYMBOLS = [
  { input: "XAU-USD or XAUUSD", asset: { en: "Gold (front month)",      th: "ทองคำ (เดือนใกล้หมดอายุ)" }, note: { en: "Resolves to GC=F automatically",    th: "แปลงเป็น GC=F อัตโนมัติ" } },
  { input: "GCM26",              asset: { en: "Gold June 2026",           th: "ทองคำ มิถุนายน 2026" },     note: { en: "Resolves to GCM26.CMX",             th: "แปลงเป็น GCM26.CMX" } },
  { input: "XAG-USD or XAGUSD",  asset: { en: "Silver (front month)",     th: "เงิน (เดือนใกล้หมดอายุ)" }, note: { en: "Resolves to SI=F automatically",    th: "แปลงเป็น SI=F อัตโนมัติ" } },
  { input: "SIM26",              asset: { en: "Silver June 2026",          th: "เงิน มิถุนายน 2026" },      note: { en: "Resolves to SIM26.CMX",             th: "แปลงเป็น SIM26.CMX" } },
  { input: "USOIL",              asset: { en: "WTI Crude Oil",             th: "น้ำมันดิบ WTI" },           note: { en: "Resolves to CL=F",                  th: "แปลงเป็น CL=F" } },
  { input: "CLN26",              asset: { en: "Crude Oil July 2026",       th: "น้ำมันดิบ กรกฎาคม 2026" }, note: { en: "Resolves to CLN26.NYM",             th: "แปลงเป็น CLN26.NYM" } },
  { input: "NATGAS",             asset: { en: "Natural Gas",               th: "ก๊าซธรรมชาติ" },            note: { en: "Resolves to NG=F",                  th: "แปลงเป็น NG=F" } },
  { input: "EURUSD",             asset: { en: "Euro / US Dollar",          th: "ยูโร / ดอลลาร์สหรัฐ" },    note: { en: "Resolves to EURUSD=X",              th: "แปลงเป็น EURUSD=X" } },
  { input: "BTC-USD",            asset: { en: "Bitcoin",                   th: "บิตคอยน์" },                note: { en: "Direct yfinance ticker",            th: "ticker yfinance โดยตรง" } },
  { input: "GC=F",               asset: { en: "Gold continuous",           th: "ทองคำต่อเนื่อง" },          note: { en: "Direct yfinance ticker",            th: "ticker yfinance โดยตรง" } },
];

const GATES = [
  { gate: "EMA-8 > EMA-21",           meaning: "gate1Meaning" as const },
  { gate: "Price > EMA-50",           meaning: "gate2Meaning" as const },
  { gate: "RSI-14 < 70",              meaning: "gate3Meaning" as const },
  { gate: "Volume ≥ 105% of 20d avg", meaning: "gate4Meaning" as const },
];

const RISK_TIPS = ["risk1", "risk2", "risk3", "risk4", "risk5", "risk6"] as const;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CommoditiesGuidePage() {
  const [lang, setLang] = useState<Lang>("en");

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-2 sm:p-4 lg:p-6 space-y-3">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-black tracking-tight text-foreground">{tr("pageTitle", lang)}</h1>
            </div>
            <p className="text-xs text-muted-foreground max-w-xl">{tr("pageDesc", lang)}</p>
          </div>
          <LanguageToggle lang={lang} onChange={setLang} />
        </div>

        {/* What are Commodities */}
        <Section title={tr("sectionWhat", lang)} icon={BookOpen} defaultOpen accentColor="text-primary">
          <p>{tr("whatP1", lang)}</p>
          <p>{tr("whatP2", lang)}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            {[
              { labelKey: "catMetals",  exKey: "catMetalsEx",  color: "text-yellow-400" },
              { labelKey: "catEnergy",  exKey: "catEnergyEx",  color: "text-orange-400" },
              { labelKey: "catForex",   exKey: "catForexEx",   color: "text-blue-400" },
              { labelKey: "catCrypto",  exKey: "catCryptoEx",  color: "text-primary" },
            ].map(({ labelKey, exKey, color }) => (
              <div key={labelKey} className="bg-surface-lowest rounded-sm p-3 border border-border/10">
                <p className={cn("text-xs font-bold mb-1", color)}>{tr(labelKey as never, lang)}</p>
                <p className="text-xs text-muted-foreground">{tr(exKey as never, lang)}</p>
              </div>
            ))}
          </div>
          <Callout type="info">{tr("whatCallout", lang)}</Callout>
        </Section>

        {/* Key Terms */}
        <Section title={tr("sectionTerms", lang)} icon={Layers} accentColor="text-blue-400">
          <p className="pb-1">{tr("termsIntro", lang)}</p>
          <Term term={tr("termFuturesName", lang)}>{tr("termFuturesDef", lang)}</Term>
          <Term term={tr("termSpotName", lang)}>{tr("termSpotDef", lang)}</Term>
          <Term term={tr("termFrontName", lang)}>{tr("termFrontDef", lang)}</Term>
          <Term term={tr("termMonthName", lang)}>{tr("termMonthDef", lang)}</Term>
          <Term term={tr("termEmaName", lang)}>{tr("termEmaDef", lang)}</Term>
          <Term term={tr("termRsiName", lang)}>{tr("termRsiDef", lang)}</Term>
          <Term term={tr("termVolName", lang)}>{tr("termVolDef", lang)}</Term>
          <Term term={tr("termConfName", lang)}>{tr("termConfDef", lang)}</Term>
          <Term term={tr("termBuyZoneName", lang)}>{tr("termBuyZoneDef", lang)}</Term>
          <Term term={tr("termContangoName", lang)}>{tr("termContangoDef", lang)}</Term>
          <Term term={tr("termBackName", lang)}>{tr("termBackDef", lang)}</Term>
          <Term term={tr("termLevName", lang)}>{tr("termLevDef", lang)}</Term>
          <Term term={tr("termDDName", lang)}>{tr("termDDDef", lang)}</Term>
          <Term term={tr("termSignalName", lang)}>{tr("termSignalDef", lang)}</Term>
        </Section>

        {/* How to Use */}
        <Section title={tr("sectionHowTo", lang)} icon={Activity} accentColor="text-primary">
          <div className="space-y-3 pt-1">
            <Step n={1} title={tr("step1Title", lang)}>{tr("step1Body", lang)}</Step>
            <Step n={2} title={tr("step2Title", lang)}>{tr("step2Body", lang)}</Step>
            <Step n={3} title={tr("step3Title", lang)}>{tr("step3Body", lang)}</Step>
            <Step n={4} title={tr("step4Title", lang)}>{tr("step4Body", lang)}</Step>
            <Step n={5} title={tr("step5Title", lang)}>{tr("step5Body", lang)}</Step>
            <Step n={6} title={tr("step6Title", lang)}>{tr("step6Body", lang)}</Step>
          </div>
          <Callout type="tip">{tr("howToCallout", lang)}</Callout>
        </Section>

        {/* Signal Engine */}
        <Section title={tr("sectionSignal", lang)} icon={Zap} accentColor="text-yellow-400">
          <p>{tr("signalIntro", lang)}</p>
          <div className="space-y-2 mt-2">
            {GATES.map(({ gate, meaning }) => (
              <div key={gate} className="flex gap-3 items-start">
                <code className="shrink-0 text-[10px] font-mono bg-surface-lowest px-2 py-0.5 rounded-sm text-primary mt-0.5 whitespace-nowrap">
                  {gate}
                </code>
                <p className="text-xs text-muted-foreground">{tr(meaning, lang)}</p>
              </div>
            ))}
          </div>
          <Callout type="warning">{tr("signalWarning", lang)}</Callout>
        </Section>

        {/* Supported Symbols */}
        <Section title={tr("sectionSymbols", lang)} icon={Globe} accentColor="text-blue-400">
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-xs border-collapse min-w-[380px]">
              <thead>
                <tr className="border-b border-border/20">
                  <th className="text-left py-2 pr-4 text-muted-foreground font-semibold">{tr("symColInput", lang)}</th>
                  <th className="text-left py-2 pr-4 text-muted-foreground font-semibold">{tr("symColAsset", lang)}</th>
                  <th className="text-left py-2 text-muted-foreground font-semibold">{tr("symColNote", lang)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                {SYMBOLS.map(({ input, asset, note }) => (
                  <tr key={input}>
                    <td className="py-2 pr-4"><code className="text-primary text-[10px] font-mono">{input}</code></td>
                    <td className="py-2 pr-4 text-foreground">{asset[lang]}</td>
                    <td className="py-2 text-muted-foreground/70">{note[lang]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Callout type="info">{tr("symCallout", lang)}</Callout>
        </Section>

        {/* Risk Management */}
        <Section title={tr("sectionRisk", lang)} icon={Shield} accentColor="text-red-400">
          <p>{tr("riskIntro", lang)}</p>
          <div className="space-y-2 mt-1">
            {RISK_TIPS.map((key) => (
              <div key={key} className="flex gap-2 text-xs">
                <span className="text-primary shrink-0 mt-0.5">›</span>
                <span>{tr(key, lang)}</span>
              </div>
            ))}
          </div>
          <Callout type="warning">{tr("riskDisclaimerBody", lang)}</Callout>
        </Section>

        {/* FAQ */}
        <Section title={tr("sectionFaq", lang)} icon={HelpCircle} accentColor="text-primary">
          <div className="mt-1">
            {([1,2,3,4,5,6,7,8,9] as const).map((n) => (
              <FAQ key={n} q={tr(`faq${n}q` as never, lang)}>
                <p>{tr(`faq${n}a` as never, lang)}</p>
              </FAQ>
            ))}
          </div>
        </Section>

        {/* Alert Setup */}
        <Section title={tr("sectionAlerts", lang)} icon={Bell} accentColor="text-yellow-400">
          <div className="space-y-3 pt-1">
            {([1,2,3,4,5,6] as const).map((n) => (
              <Step key={n} n={n} title={tr(`alertStep${n}Title` as never, lang)}>
                {tr(`alertStep${n}Body` as never, lang)}
              </Step>
            ))}
          </div>
          <Callout type="tip">{tr("alertCallout", lang)}</Callout>
        </Section>

        {/* Disclaimer footer */}
        <div className="flex items-start gap-2 p-3 bg-surface-low border border-border/10 rounded-sm">
          <DollarSign className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">{tr("disclaimerLabel", lang)}</strong>{" "}
            {tr("disclaimerBody", lang)}
          </p>
        </div>

      </div>
    </AppShell>
  );
}
