import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { Cli, isCancel } from "../src/index.js";

function terminal() {
  const input = new PassThrough();
  const output = new PassThrough();
  let text = "";
  output.on("data", (chunk: Buffer) => {
    text += chunk.toString();
  });
  return {
    input,
    text: () => text,
    cli: new Cli({ brand: "fungi", input, output, interactive: true }),
  };
}
const choices = [
  {
    value: "signed",
    label: "Signed account",
    description: "Subscription",
    group: "Signed in",
  },
  {
    value: "popular",
    label: "Popular account",
    description: "API key",
    group: "Popular",
  },
  {
    value: "other",
    label: "Other account",
    description: "API key",
    group: "More providers",
  },
];

describe("searchable grouped terminal choices", () => {
  it("honors Escape without choosing an account", async () => {
    const t = terminal();
    const answer = t.cli.search({ message: "Choose", choices });
    t.input.write("\u001b");
    expect(isCancel(await answer)).toBe(true);
    expect(t.input.listenerCount("keypress")).toBe(0);
  });

  it("starts collapsed, searches hidden choices and returns their original value", async () => {
    const t = terminal();
    const answer = t.cli.search({
      message: "Choose",
      choices,
      collapsedGroup: "More providers",
    });
    expect(t.text()).toContain("SIGNED IN");
    expect(t.text()).toContain("POPULAR");
    expect(t.text()).toContain("More providers (1)…");
    expect(t.text()).not.toContain("Other account");
    t.input.write("other");
    expect(t.text()).toContain("Other account");
    t.input.write("\r");
    expect(await answer).toBe("other");
    expect(t.input.listenerCount("keypress")).toBe(0);
  });

  it("expands in place, skips headings and keeps the cursor on the first revealed choice", async () => {
    const t = terminal();
    let settled = false;
    const answer = t.cli
      .search({ message: "Choose", choices, collapsedGroup: "More providers" })
      .then((value) => {
        settled = true;
        return value;
      });
    t.input.write("\u001b[B\u001b[B\r");
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(t.text()).toContain("MORE PROVIDERS");
    expect(t.text()).toContain("Other account");
    t.input.write("\r");
    expect(await answer).toBe("other");
  });

  it("does not submit stale selections for an empty search and restores the terminal on cancellation", async () => {
    const t = terminal();
    const controller = new AbortController();
    let settled = false;
    const answer = t.cli
      .search({ message: "Choose", choices, signal: controller.signal })
      .then((value) => {
        settled = true;
        return value;
      });
    t.input.write("no-such-account\r");
    await Promise.resolve();
    expect(t.text()).toContain("No matches");
    expect(settled).toBe(false);
    controller.abort();
    expect(isCancel(await answer)).toBe(true);
    expect(t.input.listenerCount("keypress")).toBe(0);
  });
});
