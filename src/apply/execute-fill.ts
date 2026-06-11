// 2H apply engine — executes a fill plan against the live DOM.
// PURE browser-context module. Resume upload is NOT handled here —
// file inputs need Playwright/extension APIs, so the harness owns them.

import { elementRegistry } from "./detect-fields";
import type { FillResult, PlannedAction } from "./types";

/** Set value the React-compatible way: native setter + events. */
function setNativeValue(el: HTMLElement, value: string): void {
  const proto =
    el.tagName.toLowerCase() === "textarea"
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

const DEFER_STYLE = "2px solid #ff9f0a"; // amber: needs human
const FILLED_STYLE = "2px solid #0a84ff"; // accent: engine filled

export function executeFillPlan(plan: PlannedAction[]): FillResult {
  const result: FillResult = { filled: 0, skippedPrefilled: 0, deferred: [] };
  for (const action of plan) {
    const el = elementRegistry[action.ref];
    if (!el) continue;
    if (action.action === "fill") {
      setNativeValue(el, action.value);
      el.style.outline = FILLED_STYLE;
      result.filled += 1;
    } else if (action.action === "skip_prefilled") {
      result.skippedPrefilled += 1;
    } else if (action.action === "defer_to_human") {
      el.style.outline = DEFER_STYLE;
      result.deferred.push({
        label: el.getAttribute("id") || el.getAttribute("name") || "(unnamed)",
        reason: action.reason,
      });
    }
    // upload_resume: intentionally untouched — harness handles it.
  }
  return result;
}
