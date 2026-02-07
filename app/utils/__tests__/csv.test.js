/**
 * Unit tests for CSV export utils
 * Run: node --test app/utils/__tests__/csv.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { escapeCsv, buildCsv } from "../csv.js";

describe("escapeCsv", () => {
    it("returns value as-is when no special chars", () => {
        assert.strictEqual(escapeCsv("abc"), "abc");
        assert.strictEqual(escapeCsv("123"), "123");
    });

    it("wraps in quotes and escapes internal quotes when comma or newline", () => {
        assert.strictEqual(escapeCsv("a,b"), '"a,b"');
        assert.strictEqual(escapeCsv('say "hi"'), '"say ""hi"""');
        assert.ok(escapeCsv("line1\nline2").startsWith('"'));
    });

    it("handles null and undefined as empty string", () => {
        assert.strictEqual(escapeCsv(null), "");
        assert.strictEqual(escapeCsv(undefined), "");
    });
});

describe("buildCsv", () => {
    it("returns header row only when no rows", () => {
        const out = buildCsv(["A", "B"], []);
        assert.strictEqual(out, "A,B");
    });

    it("returns header and one data row", () => {
        const out = buildCsv(["Kod", "Wartość"], [["WELCOME10", "10"]]);
        assert.strictEqual(out, "Kod,Wartość\nWELCOME10,10");
    });

    it("escapes values with commas in rows", () => {
        const out = buildCsv(["Tytuł"], [["Rabat 20%, ważny"]]);
        assert.strictEqual(out, 'Tytuł\n"Rabat 20%, ważny"');
    });
});
