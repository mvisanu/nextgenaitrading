"use client";

import dynamic from "next/dynamic";
import type { VariantBacktestResult } from "@/types";

// Must be dynamically imported — Plotly uses browser APIs not available on the server
const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
  loading: () => (
    <div className="flex h-80 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground text-sm">
      Loading chart...
    </div>
  ),
});

interface OptimizationScatterProps {
  variants: VariantBacktestResult[];
}

export function OptimizationScatter({ variants }: OptimizationScatterProps) {
  if (variants.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground text-sm">
        No variant data
      </div>
    );
  }

  const hoverTexts = variants.map((v) => {
    const params = Object.entries(v.parameter_json)
      .map(([k, val]) => `${k}: ${String(val)}`)
      .join("<br>");
    return `${v.variant_name}<br>${params}<br>Score: ${v.validation_score.toFixed(3)}`;
  });

  return (
    <Plot
      data={[
        {
          type: "scatter",
          mode: "markers",
          x: variants.map((v) => v.max_drawdown),
          y: variants.map((v) => v.validation_return),
          text: hoverTexts,
          hovertemplate: "%{text}<extra></extra>",
          marker: {
            color: variants.map((v) =>
              v.selected_winner ? "#22c55e" : "#378ADD"
            ),
            size: variants.map((v) => (v.selected_winner ? 14 : 8)),
            line: {
              color: variants.map((v) =>
                v.selected_winner ? "#16a34a" : "#1d4ed8"
              ),
              width: 1,
            },
          },
        },
      ]}
      layout={{
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        font: { color: "#888888", size: 11 },
        xaxis: {
          title: { text: "Max Drawdown (%)", font: { color: "#888" } },
          color: "#888",
          gridcolor: "#1f1f1f",
          zerolinecolor: "#1f1f1f",
        },
        yaxis: {
          title: { text: "Validation Return (%)", font: { color: "#888" } },
          color: "#888",
          gridcolor: "#1f1f1f",
          zerolinecolor: "#1f1f1f",
        },
        margin: { t: 20, r: 20, b: 50, l: 60 },
        showlegend: false,
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: "100%", height: 320 }}
    />
  );
}
