// Types window.__applyEngine for code running inside page.evaluate.
import type { detectFields } from "./detect-fields";
import type { buildFillPlan } from "./fill-plan";
import type { executeFillPlan } from "./execute-fill";

declare global {
  interface Window {
    __applyEngine: {
      detectFields: typeof detectFields;
      buildFillPlan: typeof buildFillPlan;
      executeFillPlan: typeof executeFillPlan;
    };
  }
}

export {};
