// 2H apply engine — field detection.
// PURE browser-context module: document/DOM only. No Node imports.

import type { DetectedField, FieldKind } from "./types";

/** Elements registered during the last scan, addressed by DetectedField.ref. */
export const elementRegistry: HTMLElement[] = [];

function textOf(el: Element | null): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Best-effort label for an input: label[for] > wrapping label >
 *  aria-label > aria-labelledby > placeholder > name attribute. */
function labelFor(el: HTMLElement): string {
  const id = el.getAttribute("id");
  if (id) {
    const esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(id) : id;
    const byFor = document.querySelector(`label[for="${esc}"]`);
    if (byFor && textOf(byFor)) return textOf(byFor);
  }
  const wrapping = el.closest("label");
  if (wrapping && textOf(wrapping)) return textOf(wrapping);
  const aria = el.getAttribute("aria-label");
  if (aria?.trim()) return aria.trim();
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const parts = labelledBy
      .split(/\s+/)
      .map((i) => textOf(document.getElementById(i)))
      .filter(Boolean);
    if (parts.length) return parts.join(" ");
  }
  const placeholder = el.getAttribute("placeholder");
  if (placeholder?.trim()) return placeholder.trim();
  const name = el.getAttribute("name");
  if (name?.trim()) return name;
  // Greenhouse uses id as the field identifier (e.g. "candidate-location",
  // "school--0"). Humanize: strip index suffix, separators to spaces.
  const elId = el.getAttribute("id") ?? "";
  return elId
    .replace(/--\d+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

function kindOf(el: HTMLElement): FieldKind {
  const tag = el.tagName.toLowerCase();
  if (tag === "textarea") return "textarea";
  if (tag === "select") return "select";
  if (tag === "input") {
    const t = (el.getAttribute("type") ?? "text").toLowerCase();
    if (t === "email") return "email";
    if (t === "tel") return "tel";
    if (t === "file") return "file";
    if (t === "checkbox") return "checkbox";
    if (t === "radio") return "radio";
    if (["text", "search", "url", "number"].includes(t)) return "text";
    return "unknown";
  }
  return "unknown";
}

function isVisible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  const s = getComputedStyle(el);
  return s.display !== "none" && s.visibility !== "hidden";
}

function optionsOf(el: HTMLElement): string[] | undefined {
  if (el.tagName.toLowerCase() !== "select") return undefined;
  return Array.from((el as HTMLSelectElement).options)
    .map((o) => o.label.trim())
    .filter((l) => l && !/^select|^choose|^--/i.test(l));
}

/** Scan the page for fillable form fields. Resets the registry. */
export function detectFields(root: ParentNode = document): DetectedField[] {
  elementRegistry.length = 0;
  const nodes = root.querySelectorAll<HTMLElement>("input, textarea, select");
  const out: DetectedField[] = [];
  for (const el of Array.from(nodes)) {
    const type = (el.getAttribute("type") ?? "").toLowerCase();
    if (["hidden", "submit", "button", "reset"].includes(type)) continue;
    const elId = el.getAttribute("id") ?? "";
    const elName = el.getAttribute("name") ?? "";
    // Noise: captcha + intl-tel-input country search widget.
    if (/recaptcha/i.test(elName) || /^iti-/.test(elId)) continue;
    const kind = kindOf(el);
    // File inputs are often display:none behind styled buttons — keep them.
    if (kind !== "file" && !isVisible(el)) continue;
    const ref = elementRegistry.push(el) - 1;
    out.push({
      ref,
      kind,
      label: labelFor(el),
      name: el.getAttribute("name") ?? "",
      id: elId,
      required: el.hasAttribute("required") || el.getAttribute("aria-required") === "true",
      currentValue: (el as HTMLInputElement).value ?? "",
      options: optionsOf(el),
    });
  }
  return out;
}
