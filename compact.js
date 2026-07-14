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

const isArray = x => Array.isArray(x) || x instanceof Array;
const isString = x => typeof x === 'string' || x instanceof String;
const unique = (x) => [...new Set(x)];

const tecodeComponent = (x) => {
  try {
    return decodeURIComponent(x);
  } catch {
    return String(x);
  }
};

const recodeComponent = (x) => String(x).replace(/%[A-F0-9]{2}/ig, tecodeComponent);

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

const arr2str = x => isArray(x) ? x.flat().join(' ') : x;

const sentenceSegment = Intl.Segmenter.prototype.segment.bind(
  new Intl.Segmenter("en", { granularity: "sentence" }),
);
const sentences = (x) => [...sentenceSegment(arr2str(x))].map((s) => s.segment);

const uniqueSentences = x => unique(sentences(x));

const wordSegment = Intl.Segmenter.prototype.segment.bind(
  new Intl.Segmenter("en", { granularity: "word" }),
);
const words = (x) => [...wordSegment(arr2str(x))].map((s) => s.segment);

// Truncate the last character off word-like tokens only; leaves
// whitespace/punctuation segments untouched so spacing is preserved.
const trunc = (x) =>
  words(arr2str(x))
    .map((y) => (/^[\p{L}\p{N}_]+$/u.test(y) ? [...y].slice(0, -1).join("") : y))
    .join("");

const runeSegment = Intl.Segmenter.prototype.segment.bind(
  new Intl.Segmenter("en", { granularity: "grapheme" }),
);
const runes = (x) => [...runeSegment(arr2str(x))].map((s) => s.segment);

const uniqueRunes = x =>unique(runes(x));

const codes = (x) => [...x]; // codepoint-level iteration
const chars = (x) => x.split(""); // UTF-16 code-unit level
const bits = (x) => String.fromCharCode(...encode(x)); // raw UTF-8 bytes as char codes



const pieces = x => decodeComponent(arr2str(x))
    .split(/[_+\-\s]+/s)
    .map(sentences).flat()
    .map((x) => x.trim())
    .filter(Boolean);

const uniquePieces = x=>unique(pieces(x));

/**
 * @param {string} txt
 * @param {{ length?: number }} [options] target length; defaults to 80% of input length
 * @returns {string}
 */
export const edgeCompact = (txt, options) => {
  txt = pieces(txt).join(" ");

  txt = uniqueSentences(txt).join(' ');
  
  const target = options?.length || txt.length * 0.8;

  let comp = txt;

  comp = uniqueSentences(sentences(comp).map(uniquePieces).flat().join(' ')).join(' ');

  if (comp.length < target) return comp;
  
  comp = uniquePieces(comp).join(" ");

  if (comp.length < target) return comp;

  comp = comp.normalize("NFKD").toLowerCase();
  comp = uniquePieces(comp).join(" ");
  if (comp.length < target) return comp;

  comp = uniqueSentences(uniquePieces(words(comp).map(uniqueRunes).join('')).join(' ')).join(' ');

  if (comp.length < target) return comp;

  while (/[\p{L}\p{N}_]/u.test(comp)) {
    comp = trunc(comp);
    comp = uniqueSentences(uniquePieces(comp).join(" ")).join(' ');
    if (comp.length < target) return comp;
  }
    
  for (const shorten of [runes, codes, chars, bits]) {
    comp = unique(shorten(comp)).join("");
    if (comp.length < target) return comp;
  }

  return comp.slice(0, target);
};


export const compactMessages = (messages,options)=>{
  const target = options?.length || JSON.stringify(messages).length * 0.8;
  const msgs = messages.filter(x=>x?.role !== 'system');
  for(const _ of JSON.stringify(messages)){
  if(JSON.stringify(messages).length < target) break;
    const sizes = msgs.map(x=>(x?.content?.length||0));
    const max = Math.max(...sizes)||0;
    const maxMessages = msgs.filter(x=>(x?.content?.length === max));
    for(const msg of maxMessages){
      (msg??{}).content = edgeCompact(String(msg?.content||''),options);
    }
  }
  return messages;
};
