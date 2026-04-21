const LOCALE = "da-DK";

export const DANISH_POPULATION = 6_000_000;

export function fmtMia(mio: number, digits = 1): string {
  const abs = Math.abs(mio);
  if (abs >= 1000) {
    return `${(mio / 1000).toLocaleString(LOCALE, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })} mia.`;
  }
  if (abs >= 1 || mio === 0) {
    return `${Math.round(mio).toLocaleString(LOCALE)} mio.`;
  }
  return `${mio.toLocaleString(LOCALE, { maximumFractionDigits: 1 })} mio.`;
}

export function fmtMiaKr(mio: number, digits = 1): string {
  return `${fmtMia(mio, digits)} kr.`;
}

export function fmtAxisMia(mio: number): string {
  if (Math.abs(mio) >= 1000) {
    return `${(mio / 1000).toLocaleString(LOCALE, {
      maximumFractionDigits: 0,
    })} mia.`;
  }
  return mio.toLocaleString(LOCALE, { maximumFractionDigits: 0 });
}

export function fmtDKK(kr: number): string {
  return `${Math.round(kr).toLocaleString(LOCALE)} kr.`;
}

export function fmtAxisKr(kr: number): string {
  const abs = Math.abs(kr);
  if (abs >= 1_000_000) {
    return `${(kr / 1_000_000).toLocaleString(LOCALE, {
      maximumFractionDigits: 0,
    })} mio.`;
  }
  if (abs >= 1000) {
    return `${(kr / 1000).toLocaleString(LOCALE, {
      maximumFractionDigits: 0,
    })}k`;
  }
  return kr.toLocaleString(LOCALE, { maximumFractionDigits: 0 });
}

export function fmtPct(pct: number, digits = 1): string {
  return `${pct.toLocaleString(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

export function fmtPromille(v: number, digits = 1): string {
  return `${v.toLocaleString(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}‰`;
}

export function fmtShare(ratio: number, digits = 1): string {
  return fmtPct(ratio * 100, digits);
}

export function fmtNumber(n: number, digits = 0): string {
  return n.toLocaleString(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function perPerson(mio: number, pop = DANISH_POPULATION): string {
  const kr = (mio * 1_000_000) / pop;
  return fmtDKK(kr);
}
