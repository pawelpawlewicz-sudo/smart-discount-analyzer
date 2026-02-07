/**
 * CSV helpers for export (testable)
 */
export function escapeCsv(value) {
    const s = String(value ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

/**
 * Build CSV string from headers and rows (each row is array of values)
 */
export function buildCsv(headers, rows) {
    const line = (arr) => arr.map(escapeCsv).join(",");
    return [line(headers), ...rows.map((r) => line(r))].join("\n");
}
