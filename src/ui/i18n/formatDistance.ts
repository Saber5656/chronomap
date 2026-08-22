import type { Locale } from "./index";

const formatters = new Map<Locale, Intl.NumberFormat>();

function getFormatter(locale: Locale): Intl.NumberFormat {
  const cached = formatters.get(locale);
  if (cached !== undefined) return cached;

  const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 1, useGrouping: false });
  formatters.set(locale, formatter);
  return formatter;
}

export function formatDistance(meters: number, locale: Locale): string {
  const value = Number.isFinite(meters) ? Math.max(0, meters) : 0;
  if (value < 1000) return `${Math.round(value)} m`;

  const kilometers = value / 1000;
  const formatter = getFormatter(locale);
  if (kilometers >= 10) return `${formatter.format(Math.round(kilometers))} km`;

  const formatted = formatter.format(kilometers);
  const decimalSeparator =
    formatter.formatToParts(1.1).find((part) => part.type === "decimal")?.value ?? ".";
  return `${formatted}${formatted.includes(decimalSeparator) ? "" : `${decimalSeparator}0`} km`;
}
