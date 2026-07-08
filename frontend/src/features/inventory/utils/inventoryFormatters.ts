const chileanNumberFormatter = new Intl.NumberFormat("es-CL");

const chileanDateTimeFormatter = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short",
});

export function formatNumber(value: number) {
  return chileanNumberFormatter.format(value);
}

export function formatDateTime(value: string) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return chileanDateTimeFormatter.format(date);
}

export function parseInteger(value: string, fallback = 0) {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return parsed;
}

export function parseOptionalBoolean(value: string) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
}
