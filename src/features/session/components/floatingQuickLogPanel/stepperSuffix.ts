type LetterCase = 'lower' | 'upper';

function getTrailingWhitespace(input: string) {
  const m = input.match(/(\s*)$/);
  const ws = m?.[1] ?? '';
  return { core: input.slice(0, input.length - ws.length), ws };
}

function getLetterCase(token: string): LetterCase {
  return token === token.toUpperCase() ? 'upper' : 'lower';
}

function incrementLetters(token: string): string {
  const letterCase = getLetterCase(token);
  const base = letterCase === 'upper' ? 65 : 97; // A / a
  const normalized = letterCase === 'upper' ? token.toUpperCase() : token.toLowerCase();

  let carry = 1;
  const out: number[] = [];
  for (let i = normalized.length - 1; i >= 0; i--) {
    const c = normalized.charCodeAt(i);
    const v = c - base;
    if (v < 0 || v > 25) return token; // not a pure letter token
    const next = v + carry;
    out.push((next % 26) + base);
    carry = next >= 26 ? 1 : 0;
  }
  if (carry) out.push(base);
  out.reverse();
  return String.fromCharCode(...out);
}

function decrementLetters(token: string): string {
  const letterCase = getLetterCase(token);
  const base = letterCase === 'upper' ? 65 : 97; // A / a
  const normalized = letterCase === 'upper' ? token.toUpperCase() : token.toLowerCase();

  // No predecessor for a single "a"/"A"
  if (normalized.length === 1 && normalized === String.fromCharCode(base)) return token;

  let carry = -1;
  const out: number[] = [];
  for (let i = normalized.length - 1; i >= 0; i--) {
    const c = normalized.charCodeAt(i);
    const v = c - base;
    if (v < 0 || v > 25) return token; // not a pure letter token
    const next = v + carry;
    if (next < 0) {
      out.push(25 + base);
      carry = -1;
    } else {
      out.push(next + base);
      carry = 0;
    }
  }

  // Underflow (token was all 'a's): shorten by 1 and fill with 'z'
  if (carry === -1) {
    const len = Math.max(0, normalized.length - 1);
    if (len === 0) return token;
    const z = String.fromCharCode(base + 25);
    return z.repeat(len);
  }

  out.reverse();
  return String.fromCharCode(...out);
}

function incrementNumberToken(token: string): string {
  const n = Number.parseInt(token, 10);
  if (!Number.isFinite(n)) return token;
  const next = n + 1;
  if (token.length > 1 && token.startsWith('0')) {
    return String(next).padStart(token.length, '0');
  }
  return String(next);
}

function decrementNumberToken(token: string): string {
  const n = Number.parseInt(token, 10);
  if (!Number.isFinite(n)) return token;
  if (n <= 0) return token;
  const next = n - 1;
  if (token.length > 1 && token.startsWith('0')) {
    return String(next).padStart(token.length, '0');
  }
  return String(next);
}

function splitSuffixToken(input: string): { start: string; token: string } | null {
  const m = input.match(/([A-Za-z]+|\d+)$/);
  if (!m) return null;
  const token = m[1];
  return { start: input.slice(0, input.length - token.length), token };
}

export function canIncrementSuffix(input: string): boolean {
  const { core } = getTrailingWhitespace(input);
  return Boolean(splitSuffixToken(core));
}

export function canDecrementSuffix(input: string): boolean {
  const { core } = getTrailingWhitespace(input);
  const parts = splitSuffixToken(core);
  if (!parts) return false;

  const { token } = parts;
  if (/^\d+$/.test(token)) {
    const n = Number.parseInt(token, 10);
    return Number.isFinite(n) && n > 0;
  }

  const letterCase = getLetterCase(token);
  const base = letterCase === 'upper' ? 65 : 97;
  const a = String.fromCharCode(base);
  const normalized = letterCase === 'upper' ? token.toUpperCase() : token.toLowerCase();
  return !(normalized.length === 1 && normalized === a);
}

export function incrementSuffix(input: string): string {
  const { core, ws } = getTrailingWhitespace(input);
  const parts = splitSuffixToken(core);
  if (!parts) return input;

  const { start, token } = parts;
  if (/^\d+$/.test(token)) return `${start}${incrementNumberToken(token)}${ws}`;
  return `${start}${incrementLetters(token)}${ws}`;
}

export function decrementSuffix(input: string): string {
  const { core, ws } = getTrailingWhitespace(input);
  const parts = splitSuffixToken(core);
  if (!parts) return input;

  const { start, token } = parts;
  if (/^\d+$/.test(token)) return `${start}${decrementNumberToken(token)}${ws}`;
  return `${start}${decrementLetters(token)}${ws}`;
}
