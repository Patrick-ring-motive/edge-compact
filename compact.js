const tecodeComponent = x => {
    try {
      return decodeURIComponent(x);
    } catch {
      return String(x);
    }
  };
  const recodeComponent = x => String(x).replace(/%[A-F0-9]{2}/g, tecodeComponent);
  const decodeComponent = x => {
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



const wordSegment = Intl.Segmenter.prototype.segment.bind(new Intl.Segmenter("en", {
  granularity: "word"
}));
const words = x => [...wordSegment(x)].map(x => x.segment);

const trunc = x => words(x).map(y=>/^\w+$/.test(y)?y.slice(0,-1):y)

const unique = x => [...new Set(x)];

export const edgeCompact = (txt,options) =>{
  txt = decodeComponent(txt).split(/[_+-\s]+/s).map(x=>x.trim()).filter(Boolean).join(' ');
  let target = options?.length || (txt.length * 0.8);
  let comp.length = txt;
  comp = unique(comp.split(' ')).join(' ');
  if(comp.length < target){
    return comp;
  }
};
