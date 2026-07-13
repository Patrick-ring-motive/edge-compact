// edge-compact.js
//
// Progressive lossy compaction. Tries the cheapest, least-destructive
// reduction first (unique word dedup) and only falls through to more
// aggressive strategies if the target length isn't met yet:
//
//   1. unique words, original casing/diacritics
//   2. + NFKD normalize + lowercase, re-dedup
//   3. + strip trailing char off word-like tokens ("running" -> "runnin"),
//      re-dedup — cheap stemming-adjacent compression
//   4. unique graphemes -> unique codepoints -> unique chars -> unique bytes
//   5. hard slice to target as last resort
//  
// Each rung dedups *after* transforming, so collisions introduced by the
// transform (e.g. "Run"/"run" collapsing after lowercasing) are exploited
// for extra compression, not wasted.

const tecodeComponent = (x) => {
  try {
    return decodeURIComponent(x);
  } catch {
    return String(x);
  }
};

const recodeComponent = (x) => String(x).replace(/%[A-F0-9]{2}/g, tecodeComponent);

const decodeComponent = (x) => {
  try {
    return decodeURIComponent(x);
  } catch {
    return recodeComponent(x);
  }
};

const encoder = new TextEncoder();
const encode = encoder.encode.bind(encoder);
const decoder = new TextDecoder();
const decode = decoder.decode.bind(decoder);

const sentenceSegment = Intl.Segmenter.prototype.segment.bind(
  new Intl.Segmenter("en", { granularity: "sentence" }),
);
const sentences = (x) => [...sentenceSegment(x)].map((s) => s.segment);

const wordSegment = Intl.Segmenter.prototype.segment.bind(
  new Intl.Segmenter("en", { granularity: "word" }),
);
const words = (x) => [...wordSegment(x)].map((s) => s.segment);

// Truncate the last character off word-like tokens only; leaves
// whitespace/punctuation segments untouched so spacing is preserved.
const trunc = (x) =>
  words(x)
    .map((y) => (/^\w+$/.test(y) ? y.slice(0, -1) : y))
    .join("");

const runeSegment = Intl.Segmenter.prototype.segment.bind(
  new Intl.Segmenter("en", { granularity: "grapheme" }),
);
const runes = (x) => [...runeSegment(x)].map((s) => s.segment);

const codes = (x) => [...x]; // codepoint-level iteration
const chars = (x) => x.split(""); // UTF-16 code-unit level
const bits = (x) => String.fromCharCode(...encode(x)); // raw UTF-8 bytes as char codes

const unique = (x) => [...new Set(x)];

/**
 * @param {string} txt
 * @param {{ length?: number }} [options] target length; defaults to 80% of input length
 * @returns {string}
 */
export const edgeCompact = (txt, options) => {
  txt = decodeComponent(txt)
    .split(/[_+\-\s]+/)
    .map(sentences).flat()
    .map((x) => x.trim())
    .filter(Boolean)
    .join(" ");

  txt = unique(sentences(txt)).join('');

  const target = options?.length || txt.length * 0.8;

  let comp = txt;
  comp = unique(comp.split(" ")).join(" ");
  if (comp.length < target) return comp;

  comp = comp.normalize("NFKD").toLowerCase();
  comp = unique(comp.split(" ")).join(" ");
  if (comp.length < target) return comp;

  while(/\w/.test(comp)){
    comp = trunc(comp);
    comp = unique(comp.split(" ")).join(" ");
    if (comp.length < target) return comp;
  }
    
  for (const shorten of [runes, codes, chars, bits]) {
    comp = unique(shorten(comp)).join("");
    if (comp.length < target) return comp;
  }

  return comp.slice(0, target);
};
