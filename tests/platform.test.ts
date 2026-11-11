import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { formatBytes, formatDuration, formatTimecode, timeAgo } from "@/lib/format";
import { contentTypeFor, isInlineType, sanitizeFilename } from "@/lib/storage/files";
import { parseRangeHeader } from "@/lib/range";
import { safeNextPath, slugify } from "@/lib/utils";

describe("passwords", () => {
  it("verifies the right password and rejects others", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("salts every hash and tolerates garbage", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
  });
});

describe("range requests", () => {
  it("parses the forms browsers send", () => {
    expect(parseRangeHeader("bytes=0-99", 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRangeHeader("bytes=500-", 1000)).toEqual({ start: 500, end: 999 });
    expect(parseRangeHeader("bytes=-200", 1000)).toEqual({ start: 800, end: 999 });
    expect(parseRangeHeader("bytes=900-5000", 1000)).toEqual({ start: 900, end: 999 });
  });

  it("flags impossible ranges and ignores unsupported ones", () => {
    expect(parseRangeHeader("bytes=1000-", 1000)).toBe("unsatisfiable");
    expect(parseRangeHeader("bytes=50-10", 1000)).toBe("unsatisfiable");
    expect(parseRangeHeader(null, 1000)).toBeNull();
    expect(parseRangeHeader("bytes=0-1,5-9", 1000)).toBeNull();
    expect(parseRangeHeader("items=0-1", 1000)).toBeNull();
  });
});

describe("uploads", () => {
  it("only allows known types and derives the content type itself", () => {
    expect(contentTypeFor("VIDEO", "intro.MP4")).toBe("video/mp4");
    expect(contentTypeFor("IMAGE", "cover.png")).toBe("image/png");
    expect(contentTypeFor("FILE", "slides.pdf")).toBe("application/pdf");
    expect(contentTypeFor("IMAGE", "logo.svg")).toBeNull();
    expect(contentTypeFor("FILE", "page.html")).toBeNull();
    expect(contentTypeFor("VIDEO", "virus.exe")).toBeNull();
    expect(contentTypeFor("FILE", "noextension")).toBeNull();
  });

  it("serves only safe types inline", () => {
    expect(isInlineType("application/pdf")).toBe(true);
    expect(isInlineType("video/mp4")).toBe(true);
    expect(isInlineType("application/zip")).toBe(false);
    expect(isInlineType("text/plain; charset=utf-8")).toBe(false);
  });

  it("cleans file names", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename('C:\\Users\\me\\my "file".pdf')).toBe("my file.pdf");
    expect(sanitizeFilename("")).toBe("file");
  });
});

describe("helpers", () => {
  it("makes URL slugs", () => {
    expect(slugify("Web Development: HTML, CSS & JS!")).toBe("web-development-html-css-js");
    expect(slugify("Café déjà vu")).toBe("cafe-deja-vu");
    expect(slugify("???")).toBe("");
  });

  it("only allows same-site redirect targets", () => {
    expect(safeNextPath("/courses?q=a")).toBe("/courses?q=a");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath(undefined, "/home")).toBe("/home");
  });

  it("formats durations, sizes and relative times", () => {
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(3900)).toBe("1h 5m");
    expect(formatTimecode(65)).toBe("1:05");
    expect(formatTimecode(3725)).toBe("1:02:05");
    expect(formatBytes(1536)).toBe("1.5 KB");
    const now = new Date("2026-01-10T12:00:00Z");
    expect(timeAgo(new Date("2026-01-10T11:59:40Z"), now)).toBe("just now");
    expect(timeAgo(new Date("2026-01-08T12:00:00Z"), now)).toBe("2 days ago");
  });
});
