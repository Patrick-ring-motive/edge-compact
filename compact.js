const wordSegment = Intl.Segmenter.prototype.segment.bind(new Intl.Segmenter("en", {
  granularity: "word"
}));
const words = x => [...wordSegment(x)].map(x => x.segment);

const trunc = x => words(x).map(y=>/^\w+$/.test(y)?y.slice(0,-1):y)
