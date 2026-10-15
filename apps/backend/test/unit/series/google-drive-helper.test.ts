import { describe, expect, it } from "vitest";
import { buildGoogleDriveConfirmRequest, buildGoogleDriveDirectDownloadUrl, collectGoogleDriveCookies, extractGoogleDriveConfirmForm, extractGoogleDriveFileId, isGoogleDriveFileId, isGoogleDriveInterstitial, isGoogleDriveUrl, parseGoogleDriveSource } from "../../../src/modules/series";

const FILE_ID = "1a2B3c4D5e6F7g8H9i0J";

const INTERSTITIAL_HTML = `<!doctype html>
<html><head><title>Google Drive - Virus scan warning</title></head>
<body>
  <p>Google Drive can't scan this file for viruses.</p>
  <form id="download-form" action="https://drive.usercontent.google.com/download" method="get">
    <input type="hidden" name="id" value="${FILE_ID}">
    <input type="hidden" name="export" value="download">
    <input type="hidden" name="confirm" value="t">
    <input type="hidden" name="uuid" value="9f8e7d6c-5b4a-3210-fedc-ba9876543210">
    <button type="submit">Download anyway</button>
  </form>
</body></html>`;

describe("isGoogleDriveFileId", () => {
  it("validates file id shape", () => {
    expect(isGoogleDriveFileId(FILE_ID)).toBe(true);
    expect(isGoogleDriveFileId("  " + FILE_ID + "  ")).toBe(true);
    expect(isGoogleDriveFileId("short")).toBe(false);
    expect(isGoogleDriveFileId("not a url")).toBe(false);
  });
});

describe("buildGoogleDriveDirectDownloadUrl", () => {
  it("builds the canonical direct download URL", () => {
    expect(buildGoogleDriveDirectDownloadUrl(FILE_ID)).toBe(
      `https://drive.usercontent.google.com/download?id=${FILE_ID}&export=download`
    );
  });
});

describe("extractGoogleDriveFileId", () => {
  it("extracts the file id from share, open, and uc links", () => {
    expect(
      extractGoogleDriveFileId(
        `https://drive.google.com/file/d/${FILE_ID}/view?usp=sharing`
      )
    ).toBe(FILE_ID);
    expect(
      extractGoogleDriveFileId(`https://drive.google.com/open?id=${FILE_ID}`)
    ).toBe(FILE_ID);
    expect(
      extractGoogleDriveFileId(`https://drive.google.com/uc?export=download&id=${FILE_ID}`)
    ).toBe(FILE_ID);
    expect(
      extractGoogleDriveFileId(
        `https://drive.usercontent.google.com/download?id=${FILE_ID}&export=download&confirm=t`
      )
    ).toBe(FILE_ID);
    expect(
      extractGoogleDriveFileId(`https://docs.google.com/uc?id=${FILE_ID}&export=download`)
    ).toBe(FILE_ID);
  });

  it("returns null for folder links, non-Drive hosts, and malformed URLs", () => {
    expect(
      extractGoogleDriveFileId("https://drive.google.com/drive/folders/abcDEF12345")
    ).toBeNull();
    expect(
      extractGoogleDriveFileId(`https://example.com/file/d/${FILE_ID}/view`)
    ).toBeNull();
    expect(extractGoogleDriveFileId("not a url")).toBeNull();
    expect(extractGoogleDriveFileId("https://drive.google.com/file/d/short/view")).toBeNull();
  });
});

describe("parseGoogleDriveSource", () => {
  it("normalizes every share link shape to the same direct download URL", () => {
    const expected = {
      fileId: FILE_ID,
      downloadUrl: `https://drive.usercontent.google.com/download?id=${FILE_ID}&export=download`,
    };

    expect(
      parseGoogleDriveSource(
        `https://drive.google.com/file/d/${FILE_ID}/view?usp=sharing`
      )
    ).toEqual(expected);
    expect(
      parseGoogleDriveSource(`https://drive.google.com/uc?id=${FILE_ID}&export=download`)
    ).toEqual(expected);
    expect(
      parseGoogleDriveSource(
        `https://drive.usercontent.google.com/download?id=${FILE_ID}&confirm=t`
      )
    ).toEqual(expected);
  });

  it("returns null for URLs that are not Drive files", () => {
    expect(parseGoogleDriveSource("https://example.com/pack.7z")).toBeNull();
    expect(
      parseGoogleDriveSource("https://drive.google.com/drive/folders/abcDEF12345")
    ).toBeNull();
  });
});

describe("isGoogleDriveUrl", () => {
  it("recognizes Drive hosts only", () => {
    expect(isGoogleDriveUrl("https://drive.google.com/x")).toBe(true);
    expect(isGoogleDriveUrl("https://docs.google.com/x")).toBe(true);
    expect(isGoogleDriveUrl("https://drive.usercontent.google.com/x")).toBe(true);
    expect(isGoogleDriveUrl("https://notdrive.google.com.evil.com/x")).toBe(false);
    expect(isGoogleDriveUrl("https://example.com/x")).toBe(false);
  });
});

describe("isGoogleDriveInterstitial", () => {
  it("treats an HTML 200 response as the virus-scan interstitial", () => {
    expect(
      isGoogleDriveInterstitial({
        status: 200,
        headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
      })
    ).toBe(true);
  });

  it("treats archive bytes and error responses as real downloads", () => {
    expect(
      isGoogleDriveInterstitial({
        status: 200,
        headers: new Headers({ "content-type": "application/x-7z-compressed" }),
      })
    ).toBe(false);
    expect(
      isGoogleDriveInterstitial({
        status: 404,
        headers: new Headers({ "content-type": "text/html" }),
      })
    ).toBe(false);
  });
});

describe("extractGoogleDriveConfirmForm", () => {
  it("extracts the action and every hidden field from the interstitial", () => {
    const form = extractGoogleDriveConfirmForm(INTERSTITIAL_HTML);

    expect(form).toEqual({
      action: "https://drive.usercontent.google.com/download",
      fields: {
        id: FILE_ID,
        export: "download",
        confirm: "t",
        uuid: "9f8e7d6c-5b4a-3210-fedc-ba9876543210",
      },
    });
  });

  it("returns null when the page carries no form", () => {
    expect(
      extractGoogleDriveConfirmForm("<html><body>Google Drive - Quota exceeded</body></html>")
    ).toBeNull();
  });

  it("decodes HTML entities inside attribute values", () => {
    const form = extractGoogleDriveConfirmForm(
      `<form action="https://drive.usercontent.google.com/download?a=1&amp;b=2"><input name="n" value="x&amp;y"></form>`
    );

    expect(form).toEqual({
      action: "https://drive.usercontent.google.com/download?a=1&b=2",
      fields: { n: "x&y" },
    });
  });
});

describe("buildGoogleDriveConfirmRequest", () => {
  it("merges the hidden fields into the form action", () => {
    const form = extractGoogleDriveConfirmForm(INTERSTITIAL_HTML)!;

    const request = buildGoogleDriveConfirmRequest(form);

    const url = new URL(request.url);
    expect(url.origin + url.pathname).toBe("https://drive.usercontent.google.com/download");
    expect(url.searchParams.get("id")).toBe(FILE_ID);
    expect(url.searchParams.get("export")).toBe("download");
    expect(url.searchParams.get("confirm")).toBe("t");
    expect(url.searchParams.get("uuid")).toBe("9f8e7d6c-5b4a-3210-fedc-ba9876543210");
  });

  it("adds confirm=t when the interstitial omits it", () => {
    const request = buildGoogleDriveConfirmRequest({
      action: "https://drive.usercontent.google.com/download",
      fields: { id: FILE_ID },
    });

    expect(new URL(request.url).searchParams.get("confirm")).toBe("t");
  });

  it("replays collected cookies", () => {
    const headers = new Headers();
    headers.append("set-cookie", "DRIVE_STREAM=abc; Path=/; HttpOnly; SameSite=None");
    headers.append("set-cookie", "NID=xyz; Path=/");

    const cookie = collectGoogleDriveCookies(headers);
    const request = buildGoogleDriveConfirmRequest(
      {
        action: "https://drive.usercontent.google.com/download",
        fields: { id: FILE_ID, confirm: "t" },
      },
      cookie
    );

    expect(cookie).toBe("DRIVE_STREAM=abc; NID=xyz");
    expect(request.headers.Cookie).toBe("DRIVE_STREAM=abc; NID=xyz");
  });

  it("omits the Cookie header when no cookies were set", () => {
    const request = buildGoogleDriveConfirmRequest({
      action: "https://drive.usercontent.google.com/download",
      fields: { id: FILE_ID, confirm: "t" },
    });

    expect(request.headers).toEqual({});
  });
});