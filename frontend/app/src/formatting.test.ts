import { fmtnum } from "@/src/formatting";
import * as dn from "dnum";
import { expect, test } from "vitest";

test("fmtnum() works", () => {
  // null/undefined handling
  expect(fmtnum(null)).toBe("");
  expect(fmtnum(undefined)).toBe("");

  // number input conversion
  expect(fmtnum(123.456)).toBe("123.46");
  expect(fmtnum(0)).toBe("0.00");

  // dnum input conversion
  expect(fmtnum(dn.from(123.456))).toBe("123.46");
  expect(fmtnum(dn.from(0))).toBe("0.00");

  // shorthand for presets
  expect(fmtnum(dn.from(123.456), "1z")).toBe("123.5");
  expect(fmtnum(dn.from(123.456), "2z")).toBe("123.46");
  expect(fmtnum(dn.from(123.456), "12z")).toBe("123.456000000000");
  expect(fmtnum(dn.from(0.123), "2diff")).toBe("+0.12");
  expect(fmtnum(dn.from(-0.123), "2diff")).toBe("-0.12");
  expect(fmtnum(dn.from(0), "2diff")).toBe("0");
  expect(fmtnum(dn.from(1234567), "compact")).toBe("1.2M");
  expect(fmtnum(dn.from(1234), "compact")).toBe("1.2K");
  expect(fmtnum(dn.from(123.456789), "full")).toBe("123.456789");
  expect(fmtnum(dn.from(0.123456789), "pct2")).toBe("12.35");
  expect(fmtnum(dn.from(0.12), "pct2")).toBe("12");
  expect(fmtnum(dn.from(0.12), "pct2z")).toBe("12.00");

  // scaling
  expect(fmtnum(dn.from(0.123), { scale: 100 })).toBe("12.3");
  expect(fmtnum(dn.from(0.123), { scale: 100, digits: 0 })).toBe("12");

  // custom digits
  expect(fmtnum(dn.from(123.456), { digits: 1 })).toBe("123.5");
  expect(fmtnum(dn.from(123.456), { digits: 3 })).toBe("123.456");
  expect(fmtnum(dn.from(123.456), 1)).toBe("123.5");
  expect(fmtnum(dn.from(123.456), 3)).toBe("123.456");

  // prefix / suffix
  expect(fmtnum(dn.from(123.456), { prefix: "$" })).toBe("$123.456");
  expect(fmtnum(dn.from(123.456), { suffix: " BOLD" })).toBe("123.456 BOLD");

  // dust
  expect(fmtnum(dn.from(0.0000001), "2z")).toBe("<0.01");
  expect(fmtnum(dn.from(0.0000001), 4)).toBe("<0.0001");
  expect(fmtnum(dn.from(0.0000001), "full")).toBe("0.0000001");
  // override preset
  expect(fmtnum(dn.from(0.0000001), { preset: "2z", dust: false })).toBe("0.00");
  // with prefix
  expect(fmtnum(dn.from(0.0000001), { preset: "2z", prefix: "$" })).toBe("<$0.01");

  // preset & dnum options combined
  expect(fmtnum(dn.from(123.456), { preset: "2z", digits: 3 })).toBe("123.456");

  // number shorthand for digits
  expect(fmtnum(dn.from(123.456), 1)).toBe("123.5");
  expect(fmtnum(dn.from(123.456), 3)).toBe("123.456");
});
