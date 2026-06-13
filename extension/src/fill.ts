// 2H.2 fill execution — the lab's host-side interactions rebuilt on
// native DOM. Content scripts dispatch trusted-enough events for
// react-select (the 2H.0.5b decision: decisions are computed
// server-side; execution lives in the host). NEVER submits.

type Decision =
  | { kind: "fill"; fieldName: string; value: string; sourceKey: string }
  | { kind: "select"; fieldName: string; optionLabel: string; sourceKey: string }
  | { kind: "defer"; fieldName: string; label: string; reason: string };

export interface Payload {
  identity: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    country: string | null;
  };
  decisions: Decision[];
  education: { schoolName: string | null; degreeLevel: string | null };
  pdfUrl: string;
}

export interface FillReport {
  filled: string[];
  deferred: { fieldName: string; label: string }[];
  failed: string[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** react-select opens on mousedown, not click — dispatch the real
 *  pointer sequence (the trusted-events fix from the first live run). */
function realClick(el: HTMLElement): void {
  const opts = { bubbles: true, cancelable: true, view: window };
  el.dispatchEvent(new MouseEvent("mousedown", opts));
  el.dispatchEvent(new MouseEvent("mouseup", opts));
  el.dispatchEvent(new MouseEvent("click", opts));
}

/** Set a React-controlled input's value the way the engine does. */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  // Some typeaheads (GH school lookup) trigger search on key events.
  el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "a" }));
  el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "a" }));
}

function outline(el: HTMLElement, color: string): void {
  el.style.outline = `2px solid ${color}`;
  el.style.outlineOffset = "1px";
}

const ACCENT = "#0a84ff";
const AMBER = "#ff9f0a";

/** Wait for at least one [role=option] to exist (typeahead latency
 *  varies — presence-wait, never fixed sleeps; the school-flake fix). */
async function waitForOptions(timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (document.querySelector('[role="option"]')) return true;
    await sleep(120);
  }
  return false;
}

/** Normalize typographic apostrophes/spacing for option matching. */
function norm(s: string): string {
  return s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Dismiss any open react-select/typeahead menu before the next field,
 *  so option matching never reads a stale, still-open listbox. */
async function closeMenus(): Promise<void> {
  document.activeElement instanceof HTMLElement && document.activeElement.blur();
  document.body.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
  document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  await sleep(250);
}

function visibleOptionTexts(): string[] {
  return Array.from(document.querySelectorAll('[role="option"]'))
    .map((o) => (o.textContent ?? "").trim())
    .slice(0, 8);
}

function findOption(match: (text: string) => boolean): HTMLElement | null {
  for (const o of Array.from(document.querySelectorAll('[role="option"]'))) {
    const text = (o.textContent ?? "").trim();
    if (match(text)) return o as HTMLElement;
  }
  return null;
}

/** Click a react-select combobox open, type, click the matching option. */
async function selectByLabel(
  fieldName: string,
  typeText: string,
  match: (text: string) => boolean,
): Promise<boolean> {
  const hidden = document.getElementById(fieldName);
  if (!hidden) return false;
  // Lab's container walk: nearest 'select'-classed ancestor's parent,
  // then the combobox input inside it.
  const selectAncestor = hidden.closest('[class*="select"]');
  const container = selectAncestor?.parentElement ?? hidden.parentElement;
  const combo = container?.querySelector<HTMLInputElement>('input[role="combobox"]');
  if (!combo) return false;

  combo.focus();
  realClick(combo);
  setNativeValue(combo, typeText.slice(0, 30));
  if (!(await waitForOptions(8000))) return false;
  await sleep(150);
  const option = findOption(match);
  if (!option) return false;
  realClick(option);
  await sleep(250);
  await closeMenus();
  outline(combo, ACCENT);
  return true;
}

export async function executeFills(payload: Payload): Promise<FillReport> {
  const report: FillReport = { filled: [], deferred: [], failed: [] };

  // Phase A — identity basics by well-known GH ids (engine-equivalent
  // for the standard application fields).
  const identityMap: [string, string | null][] = [
    ["first_name", payload.identity.firstName],
    ["last_name", payload.identity.lastName],
    ["email", payload.identity.email],
    ["phone", payload.identity.phone],
  ];
  for (const [id, value] of identityMap) {
    const el = document.getElementById(id);
    if (el instanceof HTMLInputElement && value) {
      setNativeValue(el, value);
      outline(el, ACCENT);
      report.filled.push(id);
    }
  }

  // Phase B — API decisions: text fills, then selects (lab order).
  for (const d of payload.decisions) {
    if (d.kind === "fill") {
      const el = document.getElementById(d.fieldName);
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        setNativeValue(el, d.value);
        outline(el, ACCENT);
        report.filled.push(d.fieldName);
      } else {
        report.failed.push(d.fieldName);
      }
    }
  }
  for (const d of payload.decisions) {
    if (d.kind !== "select") continue;
    const ok = await selectByLabel(d.fieldName, d.optionLabel, (t) => t === d.optionLabel);
    if (ok) report.filled.push(d.fieldName);
    else report.failed.push(d.fieldName);
    await sleep(250);
  }

  // Phase C — education (exact-only school; degree via label table).
  const DEGREE_LABEL: Record<string, string> = {
    high_school: "High School",
    associate: "Associate's Degree",
    bachelors: "Bachelor's Degree",
    masters: "Master's Degree",
    doctorate: "Doctorate",
  };
  const edu: { id: string; text: string | null; exact: boolean }[] = [
    { id: "school--0", text: payload.education.schoolName, exact: true },
    {
      id: "degree--0",
      text: payload.education.degreeLevel
        ? (DEGREE_LABEL[payload.education.degreeLevel] ?? null)
        : null,
      exact: false,
    },
  ];
  for (const t of edu) {
    if (!t.text) continue;
    const text = t.text;
    const input = document.getElementById(t.id);
    if (!(input instanceof HTMLInputElement)) continue;
    await closeMenus();
    input.focus();
    realClick(input);
    setNativeValue(input, text);
    if (!(await waitForOptions(8000))) {
      report.failed.push(t.id);
      continue;
    }
    await sleep(150);
    const option = t.exact
      ? findOption((x) => norm(x) === norm(text))
      : findOption((x) => norm(x).startsWith(norm(text)));
    if (option) {
      realClick(option);
      outline(input, ACCENT);
      report.filled.push(t.id);
    } else {
      console.log(
        `[aijos] no option match for [${t.id}] "${text}" — visible:`,
        visibleOptionTexts(),
      );
      report.failed.push(t.id);
    }
    await sleep(250);
  }

  // Defers — amber the API's defer list for visibility.
  for (const d of payload.decisions) {
    if (d.kind !== "defer") continue;
    if (report.filled.includes(d.fieldName)) continue; // identity defers Phase A handled
    const el = document.getElementById(d.fieldName);
    if (el instanceof HTMLElement) outline(el, AMBER);
    report.deferred.push({ fieldName: d.fieldName, label: d.label });
  }

  return report;
}
