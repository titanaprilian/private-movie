import { describe, expect, it } from "vitest";
import {
  checkFileLinks,
  extractMarkdownAnchors,
  extractMarkdownLinks,
  githubSlug,
} from "../../../scripts/internal/doc-link-checker";

describe("doc-link-checker", () => {
  describe("githubSlug", () => {
    it("converts simple headings to lowercase hyphenated slugs", () => {
      expect(githubSlug("Commits")).toBe("commits");
      expect(githubSlug("Tech Stack")).toBe("tech-stack");
    });

    it("handles numbers and periods in headings", () => {
      expect(githubSlug("1. Domain Context Map")).toBe("1-domain-context-map");
      expect(githubSlug("4. Media Ingestion State Machine")).toBe(
        "4-media-ingestion-state-machine",
      );
    });

    it("strips code spans and inline markdown links", () => {
      expect(githubSlug("Testing with `vitest`")).toBe("testing-with-vitest");
      expect(githubSlug("See [Architecture](ARCHITECTURE.md)")).toBe(
        "see-architecture",
      );
    });

    it("strips punctuation and special characters correctly", () => {
      expect(
        githubSlug("Local Git Hooks (pre-commit / commit-msg / pre-push)"),
      ).toBe("local-git-hooks-pre-commit--commit-msg--pre-push");
      expect(githubSlug("S3 / Backblaze B2 / MinIO")).toBe(
        "s3--backblaze-b2--minio",
      );
    });
  });

  describe("extractMarkdownAnchors", () => {
    it("extracts anchors from markdown headings", () => {
      const content = `
# Title
## Section One
### Subsection
## Section One
`;
      const anchors = extractMarkdownAnchors(content);
      expect(anchors.has("title")).toBe(true);
      expect(anchors.has("section-one")).toBe(true);
      expect(anchors.has("subsection")).toBe(true);
      expect(anchors.has("section-one-1")).toBe(true);
    });

    it("ignores headings inside fenced code blocks", () => {
      const content = `
## Real Heading
\`\`\`bash
# Fake Heading in Code
## Another Fake
\`\`\`
### Valid Subsection
`;
      const anchors = extractMarkdownAnchors(content);
      expect(anchors.has("real-heading")).toBe(true);
      expect(anchors.has("valid-subsection")).toBe(true);
      expect(anchors.has("fake-heading-in-code")).toBe(false);
      expect(anchors.has("another-fake")).toBe(false);
    });

    it("extracts explicit HTML anchors", () => {
      const content = `
<a id="custom-anchor"></a>
<span name="another-anchor"></span>
`;
      const anchors = extractMarkdownAnchors(content);
      expect(anchors.has("custom-anchor")).toBe(true);
      expect(anchors.has("another-anchor")).toBe(true);
    });
  });

  describe("extractMarkdownLinks", () => {
    it("extracts relative and local anchor links", () => {
      const content = `
Refer to [Commits](./AGENTS.md#commits) for rules.
See [Architecture](ARCHITECTURE.md) and [Section](#tech-stack).
Image: ![Diagram](docs/diagram.png)
`;
      const links = extractMarkdownLinks(content);
      expect(links).toHaveLength(4);
      expect(links[0]).toEqual({
        text: "Commits",
        target: "./AGENTS.md#commits",
        line: 2,
      });
      expect(links[1].target).toBe("ARCHITECTURE.md");
      expect(links[2].target).toBe("#tech-stack");
      expect(links[3].target).toBe("docs/diagram.png");
    });

    it("skips external HTTP/HTTPS and mailto URLs", () => {
      const content = `
Visit [Bun](https://bun.sh) or [Vite](http://vite.dev).
Contact [Team](mailto:team@example.com).
`;
      const links = extractMarkdownLinks(content);
      expect(links).toHaveLength(0);
    });

    it("ignores links inside fenced code blocks", () => {
      const content = `
[Active Link](./AGENTS.md)
\`\`\`markdown
[Ignored Link](./AGENTS.md#foo)
\`\`\`
`;
      const links = extractMarkdownLinks(content);
      expect(links).toHaveLength(1);
      expect(links[0].target).toBe("./AGENTS.md");
    });
  });

  describe("checkFileLinks", () => {
    const mockFiles: Record<string, string> = {
      "/repo/README.md": `
# Main
See [Architecture](./ARCHITECTURE.md#overview).
See [Broken File](./NONEXISTENT.md).
See [Broken Anchor](./ARCHITECTURE.md#missing-heading).
Self [Local Anchor](#main).
Self [Broken Local Anchor](#nonexistent-anchor).
`,
      "/repo/ARCHITECTURE.md": `
# Architecture
## Overview
Welcome!
`,
    };

    const fileExistsFn = (p: string) => p in mockFiles;
    const readFileFn = (p: string) => {
      if (p in mockFiles) return mockFiles[p];
      throw new Error(`File not found: ${p}`);
    };

    it("detects nonexistent target files and broken anchors", () => {
      const violations = checkFileLinks(
        "/repo/README.md",
        mockFiles["/repo/README.md"],
        fileExistsFn,
        readFileFn,
      );

      expect(violations).toHaveLength(3);

      // 1. Broken File
      expect(violations[0].target).toBe("./NONEXISTENT.md");
      expect(violations[0].reason).toBe("file_not_found");

      // 2. Broken Anchor in external file
      expect(violations[1].target).toBe("./ARCHITECTURE.md#missing-heading");
      expect(violations[1].reason).toBe("anchor_not_found");

      // 3. Broken Local Anchor
      expect(violations[2].target).toBe("#nonexistent-anchor");
      expect(violations[2].reason).toBe("anchor_not_found");
    });

    it("passes cleanly when all files and anchors exist", () => {
      const validContent = `
# Valid
Link to [Overview](./ARCHITECTURE.md#overview).
Link to [Architecture](./ARCHITECTURE.md).
Self [Valid](#valid).
`;
      const violations = checkFileLinks(
        "/repo/README.md",
        validContent,
        fileExistsFn,
        readFileFn,
      );

      expect(violations).toHaveLength(0);
    });
  });
});
