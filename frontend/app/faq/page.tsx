"use client";

import { useState, useCallback } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  ChevronDown,
  Shield,
  Flame,
  Brain,
  Activity,
  BarChart3,
  Zap,
  Clock,
  Layers,
  FileCode,
  HelpCircle,
  ArrowUpDown,
  Globe,
  Radar,
  Sparkles,
  Bell,
  ShoppingCart,
  BarChart4,
  KeyRound,
  TrendingDown,
  Users,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type Lang, tr } from "./translations";

// ─── Collapsible Section ─────────────────────────────────────────────────────

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
        className="flex items-center gap-3 w-full px-5 py-4 text-left hover:bg-surface-high/30 transition-colors"
      >
        <Icon className={cn("h-4 w-4 shrink-0", accentColor)} />
        <span className="flex-1 font-bold text-sm text-foreground">
          {title}
        </span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-0 text-sm text-muted-foreground leading-relaxed space-y-4 border-t border-border/10">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Indicator Row ───────────────────────────────────────────────────────────

function Indicator({
  name,
  window,
  purpose,
}: {
  name: string;
  window: string;
  purpose: string;
}) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <code className="shrink-0 text-xs font-mono bg-surface-lowest px-2 py-0.5 rounded-sm text-primary min-w-[80px]">
        {name}
      </code>
      <span className="text-xs text-muted-foreground/60 shrink-0 w-[70px] tabular-nums">
        {window}
      </span>
      <span className="text-xs text-muted-foreground">{purpose}</span>
    </div>
  );
}

// ─── FAQ Item ────────────────────────────────────────────────────────────────

function FAQ({
  q,
  children,
}: {
  q: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/10 last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-start gap-2 w-full py-3 text-left hover:bg-surface-high/20 transition-colors rounded-sm px-1"
      >
        <HelpCircle className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
        <span className="flex-1 text-xs font-bold text-foreground">{q}</span>
        {open ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
        )}
      </button>
      {open && (
        <div className="pl-6 pb-3 text-sm text-muted-foreground leading-relaxed space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── HTML helper (for translated strings with markup) ────────────────────────

const ALLOWED_TAGS = new Set(["strong", "span", "em", "br", "code"]);

function sanitize(dirty: string): string {
  // SSR: no DOM available — content is authored by us so safe to return as-is
  if (typeof window === "undefined") return dirty;
  // Browser: walk the parsed tree and strip disallowed tags/attrs
  const doc = new DOMParser().parseFromString(dirty, "text/html");
  function clean(node: Node): void {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as Element;
        if (!ALLOWED_TAGS.has(el.tagName.toLowerCase())) {
          // Replace disallowed element with its children (unwrap)
          el.replaceWith(...Array.from(el.childNodes));
        } else {
          // Strip any attribute that isn't "class"
          for (const attr of Array.from(el.attributes)) {
            if (attr.name !== "class") el.removeAttribute(attr.name);
          }
          clean(el);
        }
      }
    }
  }
  clean(doc.body);
  return doc.body.innerHTML;
}

function Html({ html }: { html: string }) {
  return <span dangerouslySetInnerHTML={{ __html: sanitize(html) }} />;
}

function HtmlP({ html }: { html: string }) {
  return <p dangerouslySetInnerHTML={{ __html: sanitize(html) }} />;
}

// ─── Comparison Table ────────────────────────────────────────────────────────

function ComparisonTable({ lang }: { lang: Lang }) {
  const rows = [
    { label: tr("leverage", lang), conservative: "2.5x", aggressive: "4.0x", aiPick: "2.0x", blsh: "2.0x" },
    { label: tr("logicType", lang), conservative: tr("hmmIndicators", lang), aggressive: tr("hmmIndicators", lang), aiPick: tr("macdRsiEmaOpt", lang), blsh: tr("rsiBollingerOpt", lang) },
    { label: tr("minConfirmations", lang), conservative: "7 / 8", aggressive: "5 / 8", aiPick: tr("na", lang), blsh: tr("na", lang) },
    { label: tr("trailingStop", lang), conservative: tr("none", lang), aggressive: "5%", aiPick: tr("none", lang), blsh: tr("none", lang) },
    { label: tr("variantsTested", lang), conservative: "1", aggressive: "1", aiPick: "12", blsh: "8" },
    { label: tr("cooldownBars", lang), conservative: "3", aggressive: "3", aiPick: "3", blsh: "2" },
    { label: tr("pineScriptExport", lang), conservative: tr("no", lang), aggressive: tr("no", lang), aiPick: tr("yes", lang), blsh: tr("yes", lang) },
    { label: tr("entryCondition", lang), conservative: tr("bullRegime7", lang), aggressive: tr("bullRegime5", lang), aiPick: tr("macdRsiEmaSignals", lang), blsh: tr("rsiOversoldBbLower", lang) },
    { label: tr("exitCondition", lang), conservative: tr("bearRegime", lang), aggressive: tr("bearRegimeOrTrail", lang), aiPick: tr("variantSellSignal", lang), blsh: tr("overboughtOrBbUpper", lang) },
  ];

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-border/10 bg-surface-lowest">
            <th className="text-left py-2 px-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground w-[140px]">{tr("feature", lang)}</th>
            <th className="text-center py-2 px-2 text-3xs font-bold uppercase tracking-widest text-blue-400">{tr("conservative", lang)}</th>
            <th className="text-center py-2 px-2 text-3xs font-bold uppercase tracking-widest text-orange-400">{tr("aggressive", lang)}</th>
            <th className="text-center py-2 px-2 text-3xs font-bold uppercase tracking-widest text-purple-400">{tr("aiPick", lang)}</th>
            <th className="text-center py-2 px-2 text-3xs font-bold uppercase tracking-widest text-primary">{tr("buyLowSellHigh", lang)}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-border/10 hover:bg-surface-high/20">
              <td className="py-2 px-2 text-xs font-bold text-foreground">{row.label}</td>
              <td className="py-2 px-2 text-center text-xs tabular-nums text-muted-foreground">{row.conservative}</td>
              <td className="py-2 px-2 text-center text-xs tabular-nums text-muted-foreground">{row.aggressive}</td>
              <td className="py-2 px-2 text-center text-xs tabular-nums text-muted-foreground">{row.aiPick}</td>
              <td className="py-2 px-2 text-center text-xs tabular-nums text-muted-foreground">{row.blsh}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Language Toggle ─────────────────────────────────────────────────────────

function LanguageToggle({ lang, onChange, ...props }: { lang: Lang; onChange: (l: Lang) => void; [key: string]: unknown }) {
  return (
    <div className="flex items-center gap-1 rounded-sm border border-border/10 bg-surface-low p-1" data-testid="lang-toggle" {...props}>
      <Button
        variant={lang === "en" ? "default" : "ghost"}
        size="sm"
        className={cn(
          "h-7 px-3 text-xs gap-1.5",
          lang === "en" ? "bg-primary text-primary-foreground font-bold" : "hover:bg-surface-high/50"
        )}
        onClick={() => onChange("en")}
      >
        <Globe className="h-3 w-3" />
        EN
      </Button>
      <Button
        variant={lang === "th" ? "default" : "ghost"}
        size="sm"
        className={cn(
          "h-7 px-3 text-xs gap-1.5",
          lang === "th" ? "bg-primary text-primary-foreground font-bold" : "hover:bg-surface-high/50"
        )}
        onClick={() => onChange("th")}
      >
        <span className="text-sm leading-none">🇹🇭</span>
        TH
      </Button>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function FAQPage() {
  const [lang, setLang] = useState<Lang>("en");
  const handleLangChange = useCallback((l: Lang) => setLang(l), []);

  return (
    <AppShell title={tr("pageTitle", lang)}>
      <div className="max-w-4xl mx-auto space-y-4 pb-12">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-foreground">
              {tr("heroTitle", lang)}
            </h1>
            <p className="text-sm text-muted-foreground">
              {tr("heroDesc", lang)}
            </p>
          </div>
          <LanguageToggle lang={lang} onChange={handleLangChange} data-testid="lang-toggle" />
        </div>

        {/* ── Strategy Comparison ───────────────────────────────────────── */}
        <Section
          title={tr("sectionComparison", lang)}
          icon={Layers}
          defaultOpen={true}
          accentColor="text-primary"
        >
          <ComparisonTable lang={lang} />
        </Section>

        {/* ── Conservative Strategy ────────────────────────────────────── */}
        <Section
          title={tr("sectionConservative", lang)}
          icon={Shield}
          accentColor="text-blue-400"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-blue-400 border-blue-400/30">{tr("leverage", lang)}: 2.5x</Badge>
              <Badge variant="outline" className="text-blue-400 border-blue-400/30">7/8 {tr("minConfirmations", lang)}</Badge>
              <Badge variant="outline" className="text-blue-400 border-blue-400/30">{tr("trailingStop", lang)}: {tr("none", lang)}</Badge>
              <Badge variant="outline" className="text-blue-400 border-blue-400/30">{tr("cooldownBars", lang)}: 3</Badge>
            </div>

            <HtmlP html={tr("conservativeDesc", lang)} />

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("hmmRegimeDetection", lang)}
            </h4>
            <HtmlP html={tr("hmmDesc", lang)} />

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("eightConfirmations", lang)}
            </h4>
            <div className="bg-surface-lowest rounded-sm p-3 space-y-0.5">
              <Indicator name="RSI" window="14-period" purpose={tr("rsiPurpose", lang)} />
              <Indicator name="MACD" window="12/26/9" purpose={tr("macdPurpose", lang)} />
              <Indicator name="EMA" window="20 & 50" purpose={tr("emaPurpose", lang)} />
              <Indicator name="Bollinger" window="20, 2σ" purpose={tr("bollingerPurpose", lang)} />
              <Indicator name="ADX" window="14-period" purpose={tr("adxPurpose", lang)} />
              <Indicator name="OBV" window="cumulative" purpose={tr("obvPurpose", lang)} />
              <Indicator name="ATR" window="14-period" purpose={tr("atrPurpose", lang)} />
              <Indicator name="Volume" window="20-bar avg" purpose={tr("volumePurpose", lang)} />
            </div>

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("entryExitRules", lang)}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="bg-[#26a69a]/10 border border-[#26a69a]/20 rounded-lg p-3">
                <div className="text-[10px] uppercase font-bold text-[#26a69a] mb-1">{tr("buy", lang)}</div>
                <p className="text-xs"><Html html={tr("buyConservativeRule", lang)} /></p>
              </div>
              <div className="bg-[#ef5350]/10 border border-[#ef5350]/20 rounded-lg p-3">
                <div className="text-[10px] uppercase font-bold text-[#ef5350] mb-1">{tr("sell", lang)}</div>
                <p className="text-xs">{tr("sellConservativeRule", lang)}</p>
              </div>
              <div className="bg-surface-mid border border-border/10 rounded-sm p-3">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{tr("hold", lang)}</div>
                <p className="text-xs">{tr("holdConservativeRule", lang)}</p>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Aggressive Strategy ──────────────────────────────────────── */}
        <Section
          title={tr("sectionAggressive", lang)}
          icon={Flame}
          accentColor="text-orange-400"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-orange-400 border-orange-400/30">{tr("leverage", lang)}: 4.0x</Badge>
              <Badge variant="outline" className="text-orange-400 border-orange-400/30">5/8 {tr("minConfirmations", lang)}</Badge>
              <Badge variant="outline" className="text-orange-400 border-orange-400/30">5% {tr("trailingStop", lang)}</Badge>
              <Badge variant="outline" className="text-orange-400 border-orange-400/30">{tr("cooldownBars", lang)}: 3</Badge>
            </div>

            <HtmlP html={tr("aggressiveDesc", lang)} />

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("whatsDifferent", lang)}
            </h4>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-orange-400 text-sm">1.</span>
                <p className="text-xs"><Html html={tr("aggDiff1", lang)} /></p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-orange-400 text-sm">2.</span>
                <p className="text-xs"><Html html={tr("aggDiff2", lang)} /></p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-orange-400 text-sm">3.</span>
                <p className="text-xs"><Html html={tr("aggDiff3", lang)} /></p>
              </div>
            </div>

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("trailingStopMechanics", lang)}
            </h4>
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-sm p-3">
              <p className="text-xs"><Html html={tr("trailingStopDesc", lang)} /></p>
            </div>

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("exitConditions3", lang)}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="bg-[#ef5350]/10 border border-[#ef5350]/20 rounded-lg p-3">
                <div className="text-[10px] uppercase font-bold text-[#ef5350] mb-1">{tr("signalExit", lang)}</div>
                <p className="text-xs">{tr("signalExitDesc", lang)}</p>
              </div>
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-sm p-3">
                <div className="text-[10px] uppercase font-bold text-orange-400 mb-1">{tr("trailingStopLabel", lang)}</div>
                <p className="text-xs">{tr("trailingStopExitDesc", lang)}</p>
              </div>
              <div className="bg-surface-mid border border-border/10 rounded-sm p-3">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{tr("endOfData", lang)}</div>
                <p className="text-xs">{tr("endOfDataDesc", lang)}</p>
              </div>
            </div>
          </div>
        </Section>

        {/* ── AI Pick Optimizer ────────────────────────────────────────── */}
        <Section
          title={tr("sectionAiPick", lang)}
          icon={Brain}
          accentColor="text-purple-400"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-purple-400 border-purple-400/30">{tr("leverage", lang)}: 2.0x</Badge>
              <Badge variant="outline" className="text-purple-400 border-purple-400/30">12 {tr("variantsTested", lang)}</Badge>
              <Badge variant="outline" className="text-purple-400 border-purple-400/30">{tr("trailingStop", lang)}: {tr("none", lang)}</Badge>
              <Badge variant="outline" className="text-purple-400 border-purple-400/30">{tr("cooldownBars", lang)}: 3</Badge>
              <Badge variant="outline" className="text-purple-400 border-purple-400/30">{tr("pineScriptExport", lang)}</Badge>
            </div>

            <HtmlP html={tr("aiPickDesc", lang)} />

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("parameterGrid12", lang)}
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/10 bg-surface-lowest">
                    <th className="text-left py-1.5 px-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">{tr("parameter", lang)}</th>
                    <th className="text-left py-1.5 px-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">{tr("valuesTested", lang)}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/10">
                    <td className="py-1.5 px-2">MACD Fast / Slow</td>
                    <td className="py-1.5 px-2 font-mono">(8, 21) or (12, 26)</td>
                  </tr>
                  <tr className="border-b border-border/10">
                    <td className="py-1.5 px-2">RSI Window</td>
                    <td className="py-1.5 px-2 font-mono">10 or 14</td>
                  </tr>
                  <tr className="border-b border-border/10">
                    <td className="py-1.5 px-2">EMA Short / Long</td>
                    <td className="py-1.5 px-2 font-mono">(10, 50) or (20, 100)</td>
                  </tr>
                  <tr className="border-b border-border/10">
                    <td className="py-1.5 px-2">RSI Oversold Threshold</td>
                    <td className="py-1.5 px-2 font-mono">30 or 35</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("buySellLogic", lang)}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="bg-[#26a69a]/10 border border-[#26a69a]/20 rounded-lg p-3">
                <div className="text-[10px] uppercase font-bold text-[#26a69a] mb-1">{tr("buyWhenAllTrue", lang)}</div>
                <ul className="text-xs space-y-0.5 list-disc list-inside">
                  <li>MACD &gt; Signal line</li>
                  <li>RSI &lt; oversold + 20</li>
                  <li>EMA_short &gt; EMA_long</li>
                </ul>
              </div>
              <div className="bg-[#ef5350]/10 border border-[#ef5350]/20 rounded-lg p-3">
                <div className="text-[10px] uppercase font-bold text-[#ef5350] mb-1">{tr("sellWhenAnyTrue", lang)}</div>
                <ul className="text-xs space-y-0.5 list-disc list-inside">
                  <li>MACD &lt; Signal line</li>
                  <li>RSI &gt; 70</li>
                  <li>EMA_short &lt; EMA_long</li>
                </ul>
              </div>
            </div>

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("variantSelection", lang)}
            </h4>
            <div className="space-y-1.5">
              {[
                tr("variantStep1", lang),
                tr("variantStep2", lang),
                tr("variantStep3", lang),
                tr("variantStep4", lang),
                tr("variantStep5", lang),
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-purple-400 font-mono text-xs shrink-0">{i + 1}.</span>
                  <p className="text-xs"><Html html={step} /></p>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ── Buy Low / Sell High Optimizer ────────────────────────────── */}
        <Section
          title={tr("sectionBlsh", lang)}
          icon={ArrowUpDown}
          accentColor="text-emerald-400"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">{tr("leverage", lang)}: 2.0x</Badge>
              <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">8 {tr("variantsTested", lang)}</Badge>
              <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">{tr("trailingStop", lang)}: {tr("none", lang)}</Badge>
              <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">{tr("cooldownBars", lang)}: 2</Badge>
              <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">{tr("pineScriptExport", lang)}</Badge>
            </div>

            <HtmlP html={tr("blshDesc", lang)} />

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("parameterGrid8", lang)}
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/10 bg-surface-lowest">
                    <th className="text-left py-1.5 px-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">{tr("parameter", lang)}</th>
                    <th className="text-left py-1.5 px-2 text-3xs font-bold uppercase tracking-widest text-muted-foreground">{tr("valuesTested", lang)}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/10">
                    <td className="py-1.5 px-2">RSI Oversold Threshold</td>
                    <td className="py-1.5 px-2 font-mono">25, 30, 35, or 40</td>
                  </tr>
                  <tr className="border-b border-border/10">
                    <td className="py-1.5 px-2">Bollinger Band Window</td>
                    <td className="py-1.5 px-2 font-mono">14 or 20</td>
                  </tr>
                  <tr className="border-b border-border/10">
                    <td className="py-1.5 px-2">Cycle Hold Bars</td>
                    <td className="py-1.5 px-2 font-mono">5 or 10</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("regimeStates", lang)}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="bg-[#26a69a]/10 border border-[#26a69a]/20 rounded-lg p-3">
                <div className="text-[10px] uppercase font-bold text-[#26a69a] mb-1">{tr("dipBuy", lang)}</div>
                <p className="text-xs"><Html html={tr("dipDesc", lang)} /></p>
              </div>
              <div className="bg-[#ef5350]/10 border border-[#ef5350]/20 rounded-lg p-3">
                <div className="text-[10px] uppercase font-bold text-[#ef5350] mb-1">{tr("topSell", lang)}</div>
                <p className="text-xs"><Html html={tr("topDesc", lang)} /></p>
              </div>
              <div className="bg-surface-mid border border-border/10 rounded-sm p-3">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{tr("neutral", lang)}</div>
                <p className="text-xs">{tr("neutralDesc", lang)}</p>
              </div>
            </div>

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("fixedParams", lang)}
            </h4>
            <ul className="text-xs space-y-1 list-disc list-inside">
              <li>RSI window: 14 ({lang === "th" ? "คงที่ ไม่ถูกเพิ่มประสิทธิภาพ" : "fixed, not optimized"})</li>
              <li>RSI overbought: 65 ({lang === "th" ? "คงที่" : "fixed"})</li>
              <li>Bollinger std deviation: 2.0 ({lang === "th" ? "คงที่" : "fixed"})</li>
            </ul>
          </div>
        </Section>

        {/* ── Backtesting Engine ───────────────────────────────────────── */}
        <Section
          title={tr("sectionBacktest", lang)}
          icon={BarChart3}
          accentColor="text-cyan-400"
        >
          <div className="space-y-3">
            <p>{tr("backtestDesc", lang)}</p>

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("dataSplitting", lang)}
            </h4>
            <div className="flex gap-0 rounded-sm overflow-hidden h-6">
              <div className="bg-blue-500/30 flex items-center justify-center flex-[6] text-[10px] font-mono text-blue-400">
                {tr("train", lang)} 60%
              </div>
              <div className="bg-purple-500/30 flex items-center justify-center flex-[2] text-[10px] font-mono text-purple-400">
                {tr("val", lang)} 20%
              </div>
              <div className="bg-emerald-500/30 flex items-center justify-center flex-[2] text-[10px] font-mono text-emerald-400">
                {tr("test", lang)} 20%
              </div>
            </div>

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("performanceMetrics", lang)}
            </h4>
            <div className="bg-surface-lowest rounded-sm p-3 space-y-1.5">
              <div className="flex items-start gap-2">
                <code className="text-xs font-mono bg-surface-lowest px-1.5 py-0.5 rounded-sm shrink-0 text-primary">{tr("totalReturn", lang)}</code>
                <span className="text-xs">{tr("totalReturnDesc", lang)}</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="text-xs font-mono bg-surface-lowest px-1.5 py-0.5 rounded-sm shrink-0 text-primary">{tr("maxDrawdown", lang)}</code>
                <span className="text-xs">{tr("maxDrawdownDesc", lang)}</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="text-xs font-mono bg-surface-lowest px-1.5 py-0.5 rounded-sm shrink-0 text-primary">{tr("sharpeLike", lang)}</code>
                <span className="text-xs">{tr("sharpeLikeDesc", lang)}</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="text-xs font-mono bg-surface-lowest px-1.5 py-0.5 rounded-sm shrink-0 text-primary">{tr("validationScore", lang)}</code>
                <span className="text-xs"><Html html={tr("validationScoreDesc", lang)} /></span>
              </div>
              <div className="flex items-start gap-2">
                <code className="text-xs font-mono bg-surface-lowest px-1.5 py-0.5 rounded-sm shrink-0 text-primary">{tr("winRate", lang)}</code>
                <span className="text-xs">{tr("winRateDesc", lang)}</span>
              </div>
            </div>

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("returnCalc", lang)}
            </h4>
            <div className="bg-surface-lowest rounded-sm p-3 font-mono text-xs space-y-1">
              <p><span className="text-muted-foreground">return_pct</span> = (exit_price - entry_price) / entry_price × 100</p>
              <p><span className="text-muted-foreground">leveraged_return</span> = return_pct × leverage</p>
              <p><span className="text-muted-foreground">equity</span> *= (1 + leveraged_return / 100)</p>
            </div>
          </div>
        </Section>

        {/* ── Cooldown Mechanics ───────────────────────────────────────── */}
        <Section
          title={tr("sectionCooldown", lang)}
          icon={Clock}
          accentColor="text-amber-400"
        >
          <HtmlP html={tr("cooldownDesc", lang)} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            <div className="bg-surface-lowest rounded-sm p-3">
              <div className="text-[10px] uppercase font-bold text-foreground mb-1">{tr("consAggAiCooldown", lang)}</div>
              <p className="text-xs"><Html html={tr("consAggAiCooldownDesc", lang)} /></p>
            </div>
            <div className="bg-surface-lowest rounded-sm p-3">
              <div className="text-[10px] uppercase font-bold text-foreground mb-1">{tr("blshCooldown", lang)}</div>
              <p className="text-xs"><Html html={tr("blshCooldownDesc", lang)} /></p>
            </div>
          </div>
          <div className="mt-2 text-xs">
            <Html html={tr("cooldownHowItWorks", lang)} />
          </div>
        </Section>

        {/* ── Indicator Glossary ───────────────────────────────────────── */}
        <Section
          title={tr("sectionIndicators", lang)}
          icon={Activity}
          accentColor="text-teal-400"
        >
          <div className="space-y-3">
            <div className="space-y-2">
              {([
                ["rsiTitle", "rsiDesc"],
                ["macdTitle", "macdDesc"],
                ["emaTitle", "emaDesc"],
                ["bollingerTitle", "bollingerDesc"],
                ["adxTitle", "adxDesc"],
                ["obvTitle", "obvDesc"],
                ["atrTitle", "atrDesc"],
                ["hmmTitle", "hmmGlossaryDesc"],
              ] as const).map(([titleKey, descKey], i, arr) => (
                <div key={titleKey} className={i < arr.length - 1 ? "border-b border-border/30 pb-2" : "pb-1"}>
                  <h4 className="text-xs font-semibold text-foreground">{tr(titleKey, lang)}</h4>
                  <p className="text-xs mt-1">{tr(descKey, lang)}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ── Pine Script Artifacts ────────────────────────────────────── */}
        <Section
          title={tr("sectionPineScript", lang)}
          icon={FileCode}
          accentColor="text-yellow-400"
        >
          <HtmlP html={tr("pineScriptDesc", lang)} />
          <div className="mt-2 space-y-1.5 text-xs">
            <p><strong className="text-foreground">{tr("generatedFor", lang)}</strong> {tr("generatedForVal", lang)}</p>
            <p><strong className="text-foreground">{tr("notGeneratedFor", lang)}</strong> {tr("notGeneratedForVal", lang)}</p>
            <p><strong className="text-foreground">{tr("includes", lang)}</strong> {tr("includesVal", lang)}</p>
            <p><strong className="text-foreground">{tr("whereToFind", lang)}</strong> {tr("whereToFindVal", lang)}</p>
          </div>
        </Section>

        {/* ── Opportunities & Live Scanner ──────────────────────────────── */}
        <Section
          title={tr("sectionOpportunities", lang)}
          icon={Radar}
          accentColor="text-green-400"
        >
          <div className="space-y-3">
            <HtmlP html={tr("opportunitiesDesc", lang)} />

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("tenConditionsTitle", lang)}
            </h4>
            <div className="bg-primary/10 border border-primary/15 rounded-sm p-3">
              <ol className="text-xs space-y-1 list-decimal list-inside">
                <li>{tr("condPriceInZone", lang)}</li>
                <li>{tr("condAbove50dMa", lang)}</li>
                <li>{tr("condAbove200dMa", lang)}</li>
                <li>{tr("condRsi", lang)}</li>
                <li>{tr("condVolume", lang)}</li>
                <li>{tr("condSupport", lang)}</li>
                <li>{tr("condHmm", lang)}</li>
                <li>{tr("condConfidence", lang)}</li>
                <li>{tr("condEarnings", lang)}</li>
                <li>{tr("condCooldown", lang)}</li>
              </ol>
            </div>

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("watchlistSidebarTitle", lang)}
            </h4>
            <p className="text-xs">{tr("watchlistSidebarDesc", lang)}</p>

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("scanNowTitle", lang)}
            </h4>
            <p className="text-xs">{tr("scanNowDesc", lang)}</p>
          </div>
        </Section>

        {/* ── Ideas & Market Research ─────────────────────────────────────── */}
        <Section
          title={tr("sectionIdeas", lang)}
          icon={Sparkles}
          accentColor="text-amber-400"
        >
          <div className="space-y-3">
            <HtmlP html={tr("ideasDesc", lang)} />

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("marketPulseTitle", lang)}
            </h4>
            <p className="text-xs">{tr("marketPulseDesc", lang)}</p>

            <div className="bg-surface-lowest rounded-sm p-3 space-y-2 mt-1">
              <h5 className="text-xs font-semibold text-foreground">{tr("redditTrendingTitle", lang)}</h5>
              <HtmlP html={tr("redditTrendingDesc", lang)} />

              <h5 className="text-xs font-semibold text-foreground mt-2">{tr("screenerSectionsTitle", lang)}</h5>
              <HtmlP html={tr("screenerSectionsDesc", lang)} />
            </div>

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("suggestedIdeasTitle", lang)}
            </h4>
            <HtmlP html={tr("suggestedIdeasDesc", lang)} />
            <code className="block bg-surface-lowest rounded-sm px-3 py-2 text-xs font-mono mt-1 text-foreground/80">
              {tr("ideaScoreFormula", lang)}
            </code>

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("entryPriorityTitle", lang)}
            </h4>
            <HtmlP html={tr("entryPriorityDesc", lang)} />

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("ideaCardTitle", lang)}
            </h4>
            <p className="text-xs">{tr("ideaCardDesc", lang)}</p>

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("filterTabsTitle", lang)}
            </h4>
            <p className="text-xs">{tr("filterTabsDesc", lang)}</p>

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("myIdeasTitle", lang)}
            </h4>
            <p className="text-xs">{tr("myIdeasDesc", lang)}</p>
          </div>
        </Section>

        {/* ── Price Alerts ────────────────────────────────────────────────── */}
        <Section
          title={tr("sectionAlerts", lang)}
          icon={Bell}
          accentColor="text-red-400"
        >
          <div className="space-y-3">
            <HtmlP html={tr("alertsDesc", lang)} />

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("alertTypesTitle", lang)}
            </h4>
            <div className="bg-surface-lowest rounded-sm p-3 space-y-1.5">
              <div className="flex items-start gap-2">
                <code className="text-xs font-mono bg-surface-lowest px-1.5 py-0.5 rounded-sm shrink-0 text-primary">price_above</code>
                <span className="text-xs">{tr("alertTypeAbove", lang)}</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="text-xs font-mono bg-surface-lowest px-1.5 py-0.5 rounded-sm shrink-0 text-primary">price_below</code>
                <span className="text-xs">{tr("alertTypeBelow", lang)}</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="text-xs font-mono bg-surface-lowest px-1.5 py-0.5 rounded-sm shrink-0 text-primary">entered_buy_zone</code>
                <span className="text-xs">{tr("alertTypeBuyZone", lang)}</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="text-xs font-mono bg-surface-lowest px-1.5 py-0.5 rounded-sm shrink-0 text-primary">theme_score_changed</code>
                <span className="text-xs">{tr("alertTypeTheme", lang)}</span>
              </div>
            </div>

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("alertCooldownTitle", lang)}
            </h4>
            <p className="text-xs">{tr("alertCooldownDesc", lang)}</p>

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("alertMarketHoursTitle", lang)}
            </h4>
            <p className="text-xs">{tr("alertMarketHoursDesc", lang)}</p>
          </div>
        </Section>

        {/* ── Auto-Buy Engine ─────────────────────────────────────────────── */}
        <Section
          title={tr("sectionAutoBuy", lang)}
          icon={ShoppingCart}
          accentColor="text-violet-400"
        >
          <div className="space-y-3">
            <HtmlP html={tr("autoBuyDesc", lang)} />

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("autoBuySafetyTitle", lang)}
            </h4>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-violet-400 text-sm">1.</span>
                <p className="text-xs"><Html html={tr("autoBuySafety1", lang)} /></p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-violet-400 text-sm">2.</span>
                <p className="text-xs"><Html html={tr("autoBuySafety2", lang)} /></p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-violet-400 text-sm">3.</span>
                <p className="text-xs"><Html html={tr("autoBuySafety3", lang)} /></p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-violet-400 text-sm">4.</span>
                <p className="text-xs"><Html html={tr("autoBuySafety4", lang)} /></p>
              </div>
            </div>

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("dryRunTitle", lang)}
            </h4>
            <HtmlP html={tr("dryRunDesc", lang)} />

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("decisionLogTitle", lang)}
            </h4>
            <p className="text-xs">{tr("decisionLogDesc", lang)}</p>
          </div>
        </Section>

        {/* ── Screener & Technical Analysis ────────────────────────────── */}
        <Section
          title={tr("sectionScreenerTA", lang)}
          icon={BarChart4}
          accentColor="text-blue-400"
        >
          <div className="space-y-3">
            <HtmlP html={tr("screenerTADesc", lang)} />

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("screenerWorkflowTitle", lang)}
            </h4>
            <div className="space-y-2">
              {(["screenerStep1", "screenerStep2", "screenerStep3", "screenerStep4", "screenerStep5"] as const).map((key, i) => (
                <div key={key} className="flex items-start gap-2">
                  <span className="text-blue-400 text-sm">{i + 1}.</span>
                  <p className="text-xs"><Html html={tr(key, lang)} /></p>
                </div>
              ))}
            </div>

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("screenerPresetsTitle", lang)}
            </h4>
            <HtmlP html={tr("screenerPresetsDesc", lang)} />

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("screenerTimeframesTitle", lang)}
            </h4>
            <p className="text-xs">{tr("screenerTimeframesDesc", lang)}</p>

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("screenerAnalystTitle", lang)}
            </h4>
            <p className="text-xs">{tr("screenerAnalystDesc", lang)}</p>
          </div>
        </Section>

        {/* ── Broker Setup & API Keys ──────────────────────────────────── */}
        <Section
          title={tr("sectionBrokerSetup", lang)}
          icon={KeyRound}
          accentColor="text-amber-400"
        >
          <div className="space-y-3">
            <HtmlP html={tr("brokerSetupDesc", lang)} />

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("brokerStepTitle", lang)}
            </h4>
            <div className="space-y-2">
              {(["brokerStep1", "brokerStep2", "brokerStep3", "brokerStep4"] as const).map((key, i) => (
                <div key={key} className="flex items-start gap-2">
                  <span className="text-amber-400 text-sm">{i + 1}.</span>
                  <p className="text-xs"><Html html={tr(key, lang)} /></p>
                </div>
              ))}
            </div>

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("brokerAddTitle", lang)}
            </h4>
            <div className="space-y-2">
              {(["brokerAddStep1", "brokerAddStep2", "brokerAddStep3", "brokerAddStep4"] as const).map((key, i) => (
                <div key={key} className="flex items-start gap-2">
                  <span className="text-amber-400 text-sm">{i + 1}.</span>
                  <p className="text-xs"><Html html={tr(key, lang)} /></p>
                </div>
              ))}
            </div>

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("brokerPaperVsLiveTitle", lang)}
            </h4>
            <HtmlP html={tr("brokerPaperVsLiveDesc", lang)} />

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("brokerSecurityTitle", lang)}
            </h4>
            <HtmlP html={tr("brokerSecurityDesc", lang)} />
          </div>

          <div className="mt-4 space-y-0">
            <FAQ q={tr("faqAlpacaFree", lang)}>
              <HtmlP html={tr("faqAlpacaFreeAnswer", lang)} />
            </FAQ>

            <FAQ q={tr("faqAlpacaRegion", lang)}>
              <HtmlP html={tr("faqAlpacaRegionAnswer", lang)} />
            </FAQ>
          </div>
        </Section>

        {/* ── Trailing Stop Bot ────────────────────────────────────────── */}
        <Section
          title={tr("sectionTrailBot", lang)}
          icon={TrendingDown}
          accentColor="text-cyan-400"
        >
          <div className="space-y-3">
            <HtmlP html={tr("trailBotDesc", lang)} />

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("trailBotRulesTitle", lang)}
            </h4>
            <div className="space-y-2">
              {(["trailBotRule1", "trailBotRule2", "trailBotRule3"] as const).map((key, i) => (
                <div key={key} className="flex items-start gap-2">
                  <span className="text-cyan-400 text-sm">{i + 1}.</span>
                  <p className="text-xs"><Html html={tr(key, lang)} /></p>
                </div>
              ))}
            </div>

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("trailBotSetupTitle", lang)}
            </h4>
            <div className="space-y-2">
              {(["trailBotSetup1", "trailBotSetup2", "trailBotSetup3"] as const).map((key, i) => (
                <div key={key} className="flex items-start gap-2">
                  <span className="text-cyan-400 text-sm">{i + 1}.</span>
                  <p className="text-xs"><Html html={tr(key, lang)} /></p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-0">
            <FAQ q={tr("faqTrailBotLive", lang)}>
              <HtmlP html={tr("faqTrailBotLiveAnswer", lang)} />
            </FAQ>
            <FAQ q={tr("faqTrailBotMultiple", lang)}>
              <HtmlP html={tr("faqTrailBotMultipleAnswer", lang)} />
            </FAQ>
          </div>
        </Section>

        {/* ── Copy Trading ─────────────────────────────────────────────── */}
        <Section
          title={tr("sectionCopyTrading", lang)}
          icon={Users}
          accentColor="text-emerald-400"
        >
          <div className="space-y-3">
            <HtmlP html={tr("copyTradingDesc", lang)} />

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("copyTradingRankTitle", lang)}
            </h4>
            <HtmlP html={tr("copyTradingRankDesc", lang)} />

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("copyTradingSetupTitle", lang)}
            </h4>
            <div className="space-y-2">
              {(["copyTradingSetup1", "copyTradingSetup2", "copyTradingSetup3"] as const).map((key, i) => (
                <div key={key} className="flex items-start gap-2">
                  <span className="text-emerald-400 text-sm">{i + 1}.</span>
                  <p className="text-xs"><Html html={tr(key, lang)} /></p>
                </div>
              ))}
            </div>

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("copyTradingDryRunTitle", lang)}
            </h4>
            <HtmlP html={tr("copyTradingDryRunDesc", lang)} />
          </div>

          <div className="mt-4 space-y-0">
            <FAQ q={tr("faqCopyTradingData", lang)}>
              <HtmlP html={tr("faqCopyTradingDataAnswer", lang)} />
            </FAQ>
            <FAQ q={tr("faqCopyTradingCredential", lang)}>
              <HtmlP html={tr("faqCopyTradingCredentialAnswer", lang)} />
            </FAQ>
          </div>
        </Section>

        {/* ── Wheel Strategy Bot ───────────────────────────────────────── */}
        <Section
          title={tr("sectionWheelBot", lang)}
          icon={RefreshCw}
          accentColor="text-orange-400"
        >
          <div className="space-y-3">
            <HtmlP html={tr("wheelBotDesc", lang)} />

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("wheelBotStagesTitle", lang)}
            </h4>
            <div className="space-y-2">
              {(["wheelBotStage1", "wheelBotStage2", "wheelBotStage3", "wheelBotStage4"] as const).map((key, i) => (
                <div key={key} className="flex items-start gap-2">
                  <span className="text-orange-400 text-sm">{i + 1}.</span>
                  <p className="text-xs"><Html html={tr(key, lang)} /></p>
                </div>
              ))}
            </div>

            <h4 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mt-4">
              {tr("wheelBotRulesTitle", lang)}
            </h4>
            <div className="space-y-2">
              {(["wheelBotRule1", "wheelBotRule2", "wheelBotRule3"] as const).map((key, i) => (
                <div key={key} className="flex items-start gap-2">
                  <span className="text-orange-400 text-sm">{i + 1}.</span>
                  <p className="text-xs"><Html html={tr(key, lang)} /></p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-0">
            <FAQ q={tr("faqWheelBotAccount", lang)}>
              <HtmlP html={tr("faqWheelBotAccountAnswer", lang)} />
            </FAQ>
            <FAQ q={tr("faqWheelBotDryRun", lang)}>
              <HtmlP html={tr("faqWheelBotDryRunAnswer", lang)} />
            </FAQ>
          </div>
        </Section>

        {/* ── General FAQ ──────────────────────────────────────────────── */}
        <Section
          title={tr("sectionFaq", lang)}
          icon={HelpCircle}
          defaultOpen={true}
          accentColor="text-primary"
        >
          <div className="space-y-0">
            <FAQ q={tr("faqRealOrSim", lang)}>
              <HtmlP html={tr("faqRealOrSimAnswer", lang)} />
            </FAQ>

            <FAQ q={tr("faqHistData", lang)}>
              <HtmlP html={tr("faqHistDataAnswer", lang)} />
            </FAQ>

            <FAQ q={tr("faqLeverage", lang)}>
              <HtmlP html={tr("faqLeverageAnswer", lang)} />
              <code className="block bg-surface-lowest rounded-sm px-3 py-2 text-xs font-mono mt-1 text-foreground/80">
                leveraged_return = (exit - entry) / entry × 100 × leverage
              </code>
              <p className="mt-1"><Html html={tr("faqLeverageNote", lang)} /></p>
            </FAQ>

            <FAQ q={tr("faqValidation", lang)}>
              <HtmlP html={tr("faqValidationAnswer", lang)} />
            </FAQ>

            <FAQ q={tr("faqPineScript", lang)}>
              <HtmlP html={tr("faqPineScriptAnswer", lang)} />
            </FAQ>

            <FAQ q={tr("faqSymbols", lang)}>
              <HtmlP html={tr("faqSymbolsAnswer", lang)} />
            </FAQ>

            <FAQ q={tr("faqHmm", lang)}>
              <HtmlP html={tr("faqHmmAnswer", lang)} />
            </FAQ>

            <FAQ q={tr("faqCooldown", lang)}>
              <p>{tr("faqCooldownAnswer", lang)}</p>
            </FAQ>

            <FAQ q={tr("faqSplits", lang)}>
              <HtmlP html={tr("faqSplitsAnswer", lang)} />
            </FAQ>

            <FAQ q={tr("faqTimeframes", lang)}>
              <HtmlP html={tr("faqTimeframesAnswer", lang)} />
            </FAQ>

            <FAQ q={tr("faqBrokerSafe", lang)}>
              <HtmlP html={tr("faqBrokerSafeAnswer", lang)} />
            </FAQ>

            <FAQ q={tr("faqFvg", lang)}>
              <HtmlP html={tr("faqFvgAnswer", lang)} />
            </FAQ>

            <FAQ q={tr("faqOpportunities", lang)}>
              <HtmlP html={tr("faqOpportunitiesAnswer", lang)} />
            </FAQ>

            <FAQ q={tr("faqIdeasScan", lang)}>
              <HtmlP html={tr("faqIdeasScanAnswer", lang)} />
            </FAQ>

            <FAQ q={tr("faqMarketPulse", lang)}>
              <HtmlP html={tr("faqMarketPulseAnswer", lang)} />
            </FAQ>

            <FAQ q={tr("faqRedditAccuracy", lang)}>
              <HtmlP html={tr("faqRedditAccuracyAnswer", lang)} />
            </FAQ>

            <FAQ q={tr("faqAutoBuySafe", lang)}>
              <HtmlP html={tr("faqAutoBuySafeAnswer", lang)} />
            </FAQ>

            <FAQ q={tr("faqAlertTypes", lang)}>
              <HtmlP html={tr("faqAlertTypesAnswer", lang)} />
            </FAQ>

            <FAQ q={tr("faqScreenerWhat", lang)}>
              <HtmlP html={tr("faqScreenerWhatAnswer", lang)} />
            </FAQ>

            <FAQ q={tr("faqScreenerMarkets", lang)}>
              <HtmlP html={tr("faqScreenerMarketsAnswer", lang)} />
            </FAQ>

            <FAQ q={tr("faqScreenerTA", lang)}>
              <HtmlP html={tr("faqScreenerTAAnswer", lang)} />
            </FAQ>

            <FAQ q={tr("faqBbSqueeze", lang)}>
              <HtmlP html={tr("faqBbSqueezeAnswer", lang)} />
            </FAQ>
          </div>
        </Section>

      </div>
    </AppShell>
  );
}
