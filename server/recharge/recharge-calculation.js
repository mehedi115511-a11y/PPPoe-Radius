const positiveInteger = (value, label) => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new TypeError(`Invalid ${label}`);
  return parsed;
};

export const prorateMinorHalfUp = (packagePriceMinor, selectedDays, validityDays) => {
  const price = BigInt(packagePriceMinor);
  const days = BigInt(positiveInteger(selectedDays, "selected days"));
  const validity = BigInt(positiveInteger(validityDays, "validity days"));
  if (price < 0n) throw new RangeError("Package price cannot be negative");
  return (price * days * 2n + validity) / (validity * 2n);
};

export const calculateRechargeAmountMinor = ({ mode, packagePriceMinor, selectedDays, validityDays }) => {
  if (mode === "full_cycle") return BigInt(packagePriceMinor);
  if (mode === "custom_days") return prorateMinorHalfUp(packagePriceMinor, selectedDays, validityDays);
  throw new TypeError("Invalid recharge mode");
};

export const addCalendarMonthUtc = (dateText) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateText));
  if (!match) throw new TypeError("Invalid recharge date");
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay))).toISOString().slice(0, 10);
};
