// ✏️ Personalise here.
export const HER_NAME = ""; // e.g. "Priya" — shown on the first screen. Leave empty for "સાંભળ ને…"
export const FROM_NAME = ""; // your name, signed at the end (optional)

// split: 1 = heart fully broken, 0 = whole. warmth: 0 = cold blue, 1 = warm pink.
export type Step = { line: string; sub?: string; split: number; warmth: number };

export const intro = {
  line: HER_NAME ? `${HER_NAME}…` : "સાંભળ ને…",
  sub: "એક મિનિટ આપીશ?",
  cta: "હા, બોલ",
};

export const steps: Step[] = [
  {
    line: "મેં તને પૂછ્યા વગર ફોન કરી દીધો.",
    sub: "અને એ મારી ભૂલ હતી.",
    split: 1,
    warmth: 0,
  },
  {
    line: "તારો સમય, તારી સ્પેસ, તારી ‘હા’…",
    sub: "આ બધું મારી ઉતાવળ કરતાં ઘણું વધારે મહત્ત્વનું છે.",
    split: 0.85,
    warmth: 0.15,
  },
  {
    line: "કોઈ બહાનું નથી.",
    sub: "બસ… સૉરી. દિલથી.",
    split: 0.7,
    warmth: 0.3,
  },
  {
    line: "પ્રોમિસ —",
    sub: "હવેથી પહેલાં મેસેજ કરીશ, અને તારા ‘ઓકે’ની રાહ જોઈશ.",
    split: 0.55,
    warmth: 0.45,
  },
];

export const ask = {
  line: "મને માફ કરીશ?",
  yes: "હા 💗",
  notYet: "હજી નહીં",
};

export const forgiven = {
  line: "થેન્ક યુ.",
  sub: "હવે ફક્ત બોલીશ નહીં — કરીને બતાવીશ.",
  ps: "પછી ફોન કરું? (જો, આ વખતે પૂછું છું 😅)",
};

// "Not yet" is respected — no running-away buttons. That's the whole point of the apology.
export const waiting = {
  line: "બિલકુલ બરાબર.",
  sub: "જેટલો સમય જોઈએ, એટલો લે. જ્યાં સુધી તું નહીં કહે, ત્યાં સુધી ફોન નહીં કરું. 🤍",
  changeMind: "ઓકે ઓકે, હા 💗",
};

export const nextLabel = "આગળ →";
