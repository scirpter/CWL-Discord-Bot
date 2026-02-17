import { describe, expect, it } from "vitest";

import { isValidClanTag, normalizeClanTag } from "@/utils/clash.js";

describe("clash utils", () => {
  it("normalizes clan tags to #UPPER", () => {
    expect(normalizeClanTag(" abc-123 ")).toBe("#ABC123");
    expect(normalizeClanTag("#q9p2qjc")).toBe("#Q9P2QJC");
  });

  it("validates normalized clan tags", () => {
    expect(isValidClanTag("#Q9P2QJC")).toBe(true);
    expect(isValidClanTag("##")).toBe(false);
  });
});
