const shanghaiTimeZone = "Asia/Shanghai";

export function formatShanghaiTime(value: string) {
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: shanghaiTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).reduce<Record<string, string>>((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function toShanghaiInputValue(date: Date) {
  return formatShanghaiTime(date.toISOString()).replace(" ", "T").slice(0, 16);
}

export function toShanghaiIso(value: string) {
  const date = parseDate(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function parseDate(value: string) {
  const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  return new Date(hasTimeZone ? value : `${value.length === 16 ? `${value}:00` : value}+08:00`);
}
