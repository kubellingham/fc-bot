import { describe, expect, it } from "vitest";
import { isProtectedPath, safeRedirectPath } from "./redirect";

describe("safeRedirectPath", () => {
  it.each([
    ["/portfolio", "/portfolio"],
    ["/players/abc?tab=prices#chart", "/players/abc?tab=prices#chart"],
  ])("allows same-origin path %s", (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });

  it.each([
    null,
    "",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "/foo\nbar",
    "dashboard",
    `/${"a".repeat(600)}`,
  ])("rejects unsafe target %s", (input) => {
    expect(safeRedirectPath(input)).toBe("/dashboard");
  });
});

describe("isProtectedPath", () => {
  it("protects app routes and their children only", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/players/123")).toBe(true);
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/login")).toBe(false);
    expect(isProtectedPath("/dashboardx")).toBe(false);
  });
});
