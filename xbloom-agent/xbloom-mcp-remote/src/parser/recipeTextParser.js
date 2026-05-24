import { BadRequestError } from "../errors.js";

const ARABIC_DIGITS = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9"
};

const TIME_UNIT_RE = "(?:ثانية|ثواني|second(?:s)?|sec(?:onds)?|s|دقيقة|دقائق|minute(?:s)?|min)";
const END_MARKER_RE = /(?:ينتهي|الانتهاء|نهاية|drawdown|ending|end(?:\s+at)?)/i;

function normalizeDigits(text) {
  return text.replace(/[٠-٩]/g, (digit) => ARABIC_DIGITS[digit] || digit);
}

function normalizeText(input) {
  return normalizeDigits(input || "")
    .replace(/\u0640/g, "")
    .replace(/[،؛]/g, ",")
    .replace(/[–—]/g, "-")
    .replace(/[^\S\r\n]+/g, " ")
    .trim();
}

function parseTimeToSeconds(valueText, unitText) {
  const value = Number(String(valueText).replace(",", "."));
  if (!Number.isFinite(value)) return null;
  const unit = String(unitText || "").toLowerCase();
  if (unit.includes("دقيق") || unit.startsWith("min") || unit.includes("minute")) {
    return Math.round(value * 60);
  }
  return Math.round(value);
}

function parseMmSsToSeconds(value) {
  const match = String(value || "").match(/^(\d{1,2})\s*[:٫.]\s*(\d{1,2})$/);
  if (!match) return null;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  return minutes * 60 + seconds;
}

function parseRangeMmSsToSeconds(text) {
  const match = String(text || "").match(/(\d{1,2}\s*[:٫.]\s*\d{1,2})\s*-\s*(\d{1,2}\s*[:٫.]\s*\d{1,2})/);
  if (!match) return null;
  const left = parseMmSsToSeconds(match[1]);
  const right = parseMmSsToSeconds(match[2]);
  if (left === null || right === null) return null;
  return { fromSec: left, toSec: right };
}

function parseDrawdownSeconds(text) {
  const range = parseRangeMmSsToSeconds(text);
  if (range && END_MARKER_RE.test(text)) {
    return range.toSec;
  }

  if (END_MARKER_RE.test(text)) {
    const mmss = text.match(/(\d{1,2}\s*[:٫.]\s*\d{1,2})/);
    if (mmss) {
      const parsed = parseMmSsToSeconds(mmss[1]);
      if (parsed !== null) return parsed;
    }
  }

  const mmssPattern =
    /(?:ينتهي(?:\s*الاستخلاص)?\s*عند|نهاية\s*الاستخلاص(?:\s*عند)?|drawdown(?:\s*at)?|end(?:ing)?\s*(?:at)?)\s*(\d{1,2})\s*[:٫.]\s*(\d{1,2})/i;
  const mmssMatch = text.match(mmssPattern);
  if (mmssMatch) {
    return Number(mmssMatch[1]) * 60 + Number(mmssMatch[2]);
  }

  const minutePattern = new RegExp(
    `(?:ينتهي(?:\\s*الاستخلاص)?\\s*عند|drawdown(?:\\s*at)?|end(?:ing)?\\s*(?:at)?)\\s*(\\d+(?:[.,]\\d+)?)\\s*(?:دقيقة|دقائق|minute(?:s)?)(?:\\s*(?:و)?\\s*(\\d+(?:[.,]\\d+)?)\\s*(?:ثانية|ثواني|second(?:s)?|sec(?:onds)?))?`,
    "i"
  );
  const minuteMatch = text.match(minutePattern);
  if (!minuteMatch) return null;

  const minutes = Number(minuteMatch[1].replace(",", "."));
  const seconds = minuteMatch[2] ? Number(minuteMatch[2].replace(",", ".")) : 0;
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  return Math.round(minutes * 60 + seconds);
}

function parseTimeWithUnit(text) {
  const match = String(text || "").match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${TIME_UNIT_RE})`, "i"));
  if (!match) return null;
  return parseTimeToSeconds(match[1], match[2]);
}

function parseMmSs(text) {
  const match = String(text || "").match(/(\d{1,2}\s*[:٫.]\s*\d{1,2})/);
  if (!match) return null;
  return parseMmSsToSeconds(match[1]);
}

function parseSegment(segment, index, warnings) {
  const volumeMatch = segment.match(/(\d+(?:[.,]\d+)?)\s*(?:ml|مل|مليلتر)/i);
  if (!volumeMatch) return null;

  const targetMl = Number(volumeMatch[1].replace(",", "."));
  if (!Number.isFinite(targetMl) || targetMl <= 0) return null;

  const waitKeyword = /(?:وننتظر|ننتظر|انتظر|ثم\s*انتظر|wait|pause)/i;
  const durationKeyword = /(?:خلال|لمدة|in|over|during|for)/i;
  const hasEndMarker = END_MARKER_RE.test(segment);

  let waitSec = null;
  let durationSec = null;

  const waitChunkMatch = segment.match(new RegExp(`(?:وننتظر|ننتظر|انتظر|ثم\\s*انتظر|wait|pause)\\s*(.*)$`, "i"));
  if (waitChunkMatch) {
    waitSec = parseMmSs(waitChunkMatch[1]) ?? parseTimeWithUnit(waitChunkMatch[1]);
  }

  const durationChunkMatch = segment.match(new RegExp(`(?:خلال|لمدة|in|over|during|for)\\s*(.*)$`, "i"));
  if (durationChunkMatch) {
    durationSec = parseMmSs(durationChunkMatch[1]) ?? parseTimeWithUnit(durationChunkMatch[1]);
  }

  if (durationSec === null && durationKeyword.test(segment) && !waitKeyword.test(segment)) {
    durationSec = parseMmSs(segment) ?? parseTimeWithUnit(segment);
  }

  if (waitSec === null && waitKeyword.test(segment)) {
    waitSec = parseMmSs(segment) ?? parseTimeWithUnit(segment);
  }

  if (hasEndMarker && durationSec !== null && durationSec > 90) {
    warnings.push(`Step ${index + 1} seems to contain drawdown timing; duration reset to default.`);
    durationSec = null;
  }

  if (durationSec === null) {
    durationSec = index === 0 ? 0 : 30;
    warnings.push(`No pour duration found for step ${index + 1}; defaulted to ${durationSec}s.`);
  }
  if (waitSec === null) {
    waitSec = 0;
  }

  return {
    targetMl: Math.round(targetMl),
    durationSec: Math.max(0, Math.round(durationSec)),
    waitSec: Math.max(0, Math.round(waitSec))
  };
}

export function parseRecipeText(recipeText) {
  if (!recipeText || !String(recipeText).trim()) {
    throw new BadRequestError("Recipe text is required.");
  }

  const warnings = [];
  const normalized = normalizeText(recipeText);
  const drawdownTargetSec = parseDrawdownSeconds(normalized);

  const splitText = normalized
    .replace(/\bثم\b/gi, ",")
    .replace(/\r?\n/g, ",")
    .replace(/[:：]/g, ":");
  const segments = splitText
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);

  const parsedPours = [];
  for (let i = 0; i < segments.length; i += 1) {
    const parsed = parseSegment(segments[i], parsedPours.length, warnings);
    if (parsed) parsedPours.push(parsed);
  }

  if (parsedPours.length === 0) {
    throw new BadRequestError("Could not parse any pours from recipe text.");
  }

  const targets = parsedPours.map((pour) => pour.targetMl);
  let treatAsCumulative = true;
  for (let i = 1; i < targets.length; i += 1) {
    if (targets[i] <= targets[i - 1]) {
      treatAsCumulative = false;
      warnings.push(
        "Detected non-increasing volume targets. Assuming values are per-step pours, not cumulative targets."
      );
      break;
    }
  }

  const incrementalPours = [];
  if (treatAsCumulative) {
    let previous = 0;
    for (const pour of parsedPours) {
      const stepVolume = pour.targetMl - previous;
      if (stepVolume <= 0) {
        warnings.push("Found invalid cumulative target. Falling back to per-step volume for this pour.");
        incrementalPours.push({ ...pour, volumeMl: pour.targetMl });
      } else {
        incrementalPours.push({ ...pour, volumeMl: stepVolume });
        previous = pour.targetMl;
      }
    }
  } else {
    for (const pour of parsedPours) {
      incrementalPours.push({ ...pour, volumeMl: pour.targetMl });
    }
  }

  const totalWaterMl = treatAsCumulative
    ? parsedPours[parsedPours.length - 1].targetMl
    : incrementalPours.reduce((sum, pour) => sum + pour.volumeMl, 0);

  return {
    totalWaterMl,
    pours: parsedPours,
    incrementalPours,
    drawdownTargetSec: drawdownTargetSec ?? null,
    warnings
  };
}
