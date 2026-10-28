import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { Cli } from "../src/index.js";
import { fungiWordmark, renderBanner, vishnuWordmark } from "../src/banner.js";

describe("family terminal presentation", () => {
  it("keeps retained wordmark spacing at the sixty-column boundary", () => {
    const banner = renderBanner({
      brand: "fungi",
      columns: 60,
      interactive: true,
      noColor: false,
    });
    expect(banner).toBe(`\u001b[38;2;249;130;132m${fungiWordmark}\u001b[0m`);
    const narrow = renderBanner({
      brand: "vishnu",
      columns: 59,
      interactive: true,
      noColor: false,
    });
    expect(narrow).toBe("vishnu\n");
  });

  it("gives Vishnu its own tint and the Fungi canvas height within sixty columns", () => {
    expect(vishnuWordmark.split("\n")).toHaveLength(
      fungiWordmark.split("\n").length,
    );
    expect(
      Math.max(...vishnuWordmark.split("\n").map((line) => line.length)),
    ).toBeLessThanOrEqual(60);
    expect(
      renderBanner({
        brand: "vishnu",
        columns: 60,
        interactive: true,
        noColor: false,
      }),
    ).toBe(`\u001b[38;2;137;180;250m${vishnuWordmark}\u001b[0m`);
  });

  it("omits Computer art on narrow terminals and keeps its wide wordmark", () => {
    expect(
      renderBanner({
        brand: "computer",
        columns: 59,
        interactive: true,
        noColor: false,
      }),
    ).toBe("");
    expect(
      renderBanner({
        brand: "computer",
        columns: 60,
        interactive: true,
        noColor: false,
      }),
    ).toBe(`\u001b[38;2;249;130;132m${fungiWordmark}\u001b[0m`);
    for (const changes of [{ noColor: true }, { interactive: false }]) {
      expect(
        renderBanner({
          brand: "computer",
          columns: 80,
          interactive: true,
          noColor: false,
          ...changes,
        }),
      ).toBe("Fungi Computer\n");
    }
  });

  it("uses plain names for pipes and NO_COLOR, and CRLF for raw PTYs", () => {
    for (const brand of ["fungi", "vishnu", "fungi-local-auth"] as const) {
      expect(
        renderBanner({
          brand,
          columns: 80,
          interactive: false,
          noColor: false,
        }),
      ).toBe(`${brand}\n`);
      expect(
        renderBanner({ brand, columns: 80, interactive: true, noColor: true }),
      ).toBe(`${brand}\n`);
      const raw = renderBanner({
        brand,
        columns: 80,
        interactive: true,
        noColor: false,
        rawPty: true,
      });
      expect(raw.replaceAll("\r\n", "")).not.toContain("\n");
      expect(raw).not.toContain("\r\r\n");
    }
  });

  it("does not consume piped credentials or silently accept confirmations", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    input.end("do-not-consume\n");
    const cli = new Cli({ brand: "fungi-local-auth", input, output });
    expect(() => cli.password({ message: "Key" })).toThrow("needs a terminal");
    expect(() => cli.search({ message: "Choose", choices: [] })).toThrow(
      "needs a terminal",
    );
    await expect(
      cli.confirm({ message: "Replace?", initialValue: true }),
    ).resolves.toBe(false);
    expect(input.readableLength).toBeGreaterThan(0);
  });

  it("reports a failed task and checklist without escapes or error secrets", async () => {
    const output = new PassThrough();
    let transcript = "";
    output.on("data", (chunk: Buffer) => {
      transcript += chunk.toString();
    });
    const cli = new Cli({ brand: "vishnu", output, interactive: false });
    await expect(
      cli.task("Build", () => Promise.reject(new Error("private payload"))),
    ).rejects.toThrow("private payload");
    cli.checklist()("kernel", false, "download required");
    expect(transcript).toBe("Build\nFAIL kernel: download required\n");
  });
  it("keeps a URL on one framed line, with the bar but no status symbol", () => {
    const output = new PassThrough();
    let transcript = "";
    output.on("data", (chunk: Buffer) => {
      transcript += chunk.toString();
    });
    const cli = new Cli({
      brand: "fungi-local-auth",
      output,
      interactive: true,
    });
    const url =
      "https://auth.openai.com/api/accounts/authorize?very=long&token=abc";
    cli.info("Sign in to OpenAI\nOpen sign-in page");
    cli.url(url);
    cli.info("Waiting for the browser…");
    const lines = transcript.split("\n");
    // One line: the frame bar, then the whole URL; no "●" status symbol.
    expect(lines.filter((line) => line.includes(url))).toHaveLength(1);
    expect(lines.find((line) => line.includes(url))?.endsWith(url)).toBe(true);
    expect(transcript).toContain(`│  ${url}`);
    expect(transcript).not.toContain(`● ${url}`);
  });

  it("wraps a link label in an OSC 8 hyperlink only when the terminal can show it", () => {
    const interactive = new Cli({
      brand: "fungi-local-auth",
      output: new PassThrough(),
      interactive: true,
    });
    const wrapped = interactive.link(
      "Open sign-in page",
      "https://example.com/a",
    );
    expect(wrapped).toBe(
      "\u001B]8;;https://example.com/a\u0007Open sign-in page\u001B]8;;\u0007",
    );
    const piped = new Cli({
      brand: "fungi-local-auth",
      output: new PassThrough(),
      interactive: false,
    });
    expect(piped.link("Open sign-in page", "https://example.com/a")).toBe(
      "Open sign-in page",
    );
    process.env.NO_COLOR = "1";
    try {
      const noColor = new Cli({
        brand: "fungi-local-auth",
        output: new PassThrough(),
        interactive: true,
      });
      expect(noColor.link("Open sign-in page", "https://example.com/a")).toBe(
        "Open sign-in page",
      );
    } finally {
      delete process.env.NO_COLOR;
    }
  });

  it("reports changed progress once in a plain transcript", async () => {
    const output = new PassThrough();
    let transcript = "";
    output.on("data", (chunk: Buffer) => {
      transcript += chunk.toString();
    });
    const cli = new Cli({ brand: "fungi", output, interactive: false });
    await cli.task("Starting cedar", (update) => {
      update("cedar: queued #2");
      update("cedar: queued #2");
      update("cedar: queued #1");
      update("cedar: running");
      return Promise.resolve();
    });
    expect(transcript).toBe(
      "Starting cedar\ncedar: queued #2\ncedar: queued #1\ncedar: running\n",
    );
  });
});
