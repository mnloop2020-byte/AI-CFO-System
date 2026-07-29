export type MoneyString = string;

const MONEY_PATTERN = /^([+-]?)(\d+)(?:\.(\d*))?$/;
const MINOR_UNIT_FACTOR = 100n;

export function parseMoneyToMinorUnits(
  value: MoneyString,
): bigint {
  const normalized = value.trim();
  const match = MONEY_PATTERN.exec(normalized);
  if (!match) {
    throw new Error("Invalid money value.");
  }

  const [, sign, integerDigits, fraction = ""] = match;
  const centsDigits = fraction.slice(0, 2).padEnd(2, "0");
  const roundingDigit = fraction[2] ?? "0";
  let minorUnits =
    BigInt(integerDigits) * MINOR_UNIT_FACTOR +
    BigInt(centsDigits);

  if (roundingDigit >= "5") {
    minorUnits += 1n;
  }

  return sign === "-" ? -minorUnits : minorUnits;
}

export function moneyFromMinorUnits(
  minorUnits: bigint,
): MoneyString {
  const negative = minorUnits < 0n;
  const magnitude = negative
    ? -minorUnits
    : minorUnits;
  const whole = magnitude / MINOR_UNIT_FACTOR;
  const fraction = String(
    magnitude % MINOR_UNIT_FACTOR,
  ).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

export function normalizeMoney(
  value: MoneyString,
): MoneyString {
  return moneyFromMinorUnits(
    parseMoneyToMinorUnits(value),
  );
}

export function addMoney(
  values: readonly MoneyString[],
): MoneyString {
  return moneyFromMinorUnits(
    values.reduce(
      (total, value) =>
        total + parseMoneyToMinorUnits(value),
      0n,
    ),
  );
}

export function subtractMoney(
  minuend: MoneyString,
  subtrahend: MoneyString,
): MoneyString {
  return moneyFromMinorUnits(
    parseMoneyToMinorUnits(minuend) -
      parseMoneyToMinorUnits(subtrahend),
  );
}

export function multiplyMoneyByInteger(
  amount: MoneyString,
  multiplier: number,
): MoneyString {
  if (
    !Number.isSafeInteger(multiplier)
  ) {
    throw new Error(
      "Money multiplier must be a safe integer.",
    );
  }
  return moneyFromMinorUnits(
    parseMoneyToMinorUnits(amount) *
      BigInt(multiplier),
  );
}

export function compareMoney(
  first: MoneyString,
  second: MoneyString,
): number {
  const firstMinor =
    parseMoneyToMinorUnits(first);
  const secondMinor =
    parseMoneyToMinorUnits(second);
  return firstMinor === secondMinor
    ? 0
    : firstMinor > secondMinor
      ? 1
      : -1;
}

export function percentageOfMoney(
  part: MoneyString,
  whole: MoneyString,
): MoneyString {
  const partMinor = parseMoneyToMinorUnits(part);
  const wholeMinor = parseMoneyToMinorUnits(whole);
  if (wholeMinor === 0n) {
    return "0.00";
  }

  const negative =
    (partMinor < 0n) !== (wholeMinor < 0n);
  const numerator =
    (partMinor < 0n ? -partMinor : partMinor) *
    10000n;
  const denominator =
    wholeMinor < 0n ? -wholeMinor : wholeMinor;
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const rounded =
    remainder * 2n >= denominator
      ? quotient + 1n
      : quotient;

  return moneyFromMinorUnits(
    negative ? -rounded : rounded,
  );
}

export function isNonNegativeMoney(
  value: MoneyString,
): boolean {
  try {
    return parseMoneyToMinorUnits(value) >= 0n;
  } catch {
    return false;
  }
}

export function isPositiveMoney(
  value: MoneyString,
): boolean {
  try {
    return parseMoneyToMinorUnits(value) > 0n;
  } catch {
    return false;
  }
}

function localizeDigits(
  value: string,
  locale: string,
): string {
  const formatter = new Intl.NumberFormat(
    locale,
    { useGrouping: false },
  );
  const digits = Array.from(
    { length: 10 },
    (_, digit) => formatter.format(digit),
  );
  return value.replace(
    /\d/g,
    (digit) => digits[Number(digit)],
  );
}

export function formatMoney(
  value: MoneyString,
  locale: string,
): string {
  const minorUnits =
    parseMoneyToMinorUnits(value);
  const negative = minorUnits < 0n;
  const magnitude = negative
    ? -minorUnits
    : minorUnits;
  const whole = magnitude / MINOR_UNIT_FACTOR;
  const fraction = String(
    magnitude % MINOR_UNIT_FACTOR,
  ).padStart(2, "0");
  const formatter = new Intl.NumberFormat(
    locale,
    { maximumFractionDigits: 0 },
  );
  const decimalSeparator =
    new Intl.NumberFormat(locale)
      .formatToParts(1.1)
      .find((part) => part.type === "decimal")
      ?.value ?? ".";
  const minusSign =
    new Intl.NumberFormat(locale)
      .formatToParts(-1)
      .find((part) => part.type === "minusSign")
      ?.value ?? "-";

  return `${
    negative ? minusSign : ""
  }${formatter.format(whole)}${decimalSeparator}${localizeDigits(
    fraction,
    locale,
  )}`;
}
