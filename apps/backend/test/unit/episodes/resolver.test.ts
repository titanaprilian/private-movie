import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { extractVideoStream } from "@/modules/media/internal/episodes/resolver";

const sampleMp4VideoHtml = readFileSync(
  resolve(import.meta.dirname, "../../fixtures/episodes/sample-mp4-video.html"),
  "utf8"
);

describe("extractVideoStream", () => {
  it("extracts .mp4 URL from sample-mp4-video.html fixture", () => {
    const videoUrl = extractVideoStream(sampleMp4VideoHtml);
    expect(videoUrl).toBe(
      "https://archive.org/download/diri-dari-skenario-yang-telah-ia-program-sendiri.dwa/Otakudesu.io_TSTJ--01_720p.mp4"
    );
  });

  it("extracts video src from <video src='...'> tag", () => {
    const html = `<div><video src="https://example.com/video.mp4"></video></div>`;
    expect(extractVideoStream(html)).toBe("https://example.com/video.mp4");
  });

  it("extracts source src from <video><source src='...'></video> tag", () => {
    const html = `<div><video><source src="https://example.com/stream.m3u8" type="application/x-mpegURL"></video></div>`;
    expect(extractVideoStream(html)).toBe("https://example.com/stream.m3u8");
  });

  it("extracts source src from standalone <source src='...'> tag", () => {
    const html = `<div><source src="https://example.com/movie.mp4"></source></div>`;
    expect(extractVideoStream(html)).toBe("https://example.com/movie.mp4");
  });

  it("returns null when no video stream exists in HTML", () => {
    const html = `<div><p>No video here</p></div>`;
    expect(extractVideoStream(html)).toBeNull();
  });

  it("returns null when HTML is empty", () => {
    expect(extractVideoStream("")).toBeNull();
  });
});
