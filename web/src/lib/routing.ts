import { analyse } from "./lang";

export interface RouteDecision {
  model: "english" | "multilingual";
  repo: string;
  reason: string;
  detected: ReturnType<typeof analyse>;
}

/** Pure-TypeScript port of the decision the Python Router makes before any forward pass. */
export function route(state: unknown, opts: { default?: "english" | "multilingual" } = {}): RouteDecision {
  const det = analyse(state);
  const def = opts.default ?? "english";
  const pick = (model: "english" | "multilingual", reason: string): RouteDecision => ({
    model,
    repo: model === "english" ? "convaiinnovations/laya" : "convaiinnovations/laya/multilingual",
    reason,
    detected: det,
  });
  if (det.script === "unknown") return pick(def, "no letters found; falling back to the default checkpoint");
  if (det.script !== "latin") {
    const pct = Math.round(det.nonLatinFraction * 100);
    return pick("multilingual", `non-Latin script (${det.script}, ${pct}% of letters); the English checkpoint cannot read it`);
  }
  if (det.language === "en") return pick("english", "Latin script and English function words");
  if (det.language) return pick("multilingual", `Latin script but language looks like '${det.language}', not English`);
  if (det.diacriticRate >= 0.02) return pick("multilingual", "Latin script with non-English diacritics");
  return pick(def, "short Latin-script text with no language signal; using the default checkpoint");
}
