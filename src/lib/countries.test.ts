import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  COUNTRIES, flagFromCode, countryName, isValidCountry, searchCountries, countryLabel,
} from "./countries";

describe("countries", () => {
  it("includes the expected countries with unique codes", () => {
    assert.equal(COUNTRIES.length, 245);
    const codes = new Set(COUNTRIES.map((c) => c.code));
    assert.equal(codes.size, COUNTRIES.length);
    for (const c of COUNTRIES) {
      assert.match(c.code, /^[A-Z]{2}$/);
      assert.ok(c.name.length > 0);
    }
  });

  it("derives flag emojis from ISO codes", () => {
    assert.equal(flagFromCode("KE"), "🇰🇪");
    assert.equal(flagFromCode("ke"), "🇰🇪");
    assert.equal(flagFromCode("US"), "🇺🇸");
    assert.equal(flagFromCode("XYZ"), "🏳️");
    assert.equal(flagFromCode(""), "🏳️");
  });

  it("looks up names and validates codes", () => {
    assert.equal(countryName("KE"), "Kenya");
    assert.equal(countryName("ke"), "Kenya");
    assert.equal(countryName("XX"), "");
    assert.equal(countryName(null), "");
    assert.equal(isValidCountry("KE"), true);
    assert.equal(isValidCountry("XX"), false);
  });

  it("searches by name and code, prefix matches first", () => {
    const kenya = searchCountries("kenya");
    assert.ok(kenya.some((c) => c.code === "KE"));
    const us = searchCountries("us", 5);
    assert.equal(us[0].code, "US");
    assert.ok(searchCountries("").length > 0);
    assert.equal(searchCountries("zzzzz").length, 0);
  });

  it("formats table labels", () => {
    assert.equal(countryLabel("KE"), "🇰🇪 Kenya");
    assert.equal(countryLabel(null), "");
  });
});
