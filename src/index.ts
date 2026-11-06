import process from "node:process";
import type { Readable, Writable } from "node:stream";
import { ReadStream, WriteStream } from "node:tty";
import * as prompts from "@clack/prompts";
import { renderBanner, type CliBrand } from "./banner.js";
import { searchChoices, type SearchOptions } from "./search.js";
export type { SearchChoice, SearchOptions } from "./search.js";

export { isCancel } from "@clack/prompts";
export type { Option, PasswordOptions, TextOptions } from "@clack/prompts";
export { renderBanner } from "./banner.js";

export type CliOptions = {
  brand: CliBrand;
  input?: Readable;
  output?: Writable;
  interactive?: boolean;
  columns?: number;
};

/** Own terminal presentation; callers retain commands, credentials and state. */
export class Cli {
  readonly interactive: boolean;
  private readonly input: Readable;
  private readonly output: Writable;
  private readonly noColor: boolean;
  private readonly brand: CliBrand;
  private readonly columns: number;

  constructor(options: CliOptions) {
    this.input = options.input ?? process.stdin;
    this.output = options.output ?? process.stdout;
    this.interactive =
      options.interactive ??
      (this.input instanceof ReadStream &&
        this.input.isTTY &&
        this.output instanceof WriteStream &&
        this.output.isTTY);
    this.noColor =
      process.env.NO_COLOR !== undefined || process.env.TERM === "dumb";
    this.brand = options.brand;
    this.columns =
      options.columns ??
      (this.output instanceof WriteStream ? this.output.columns : 80);
  }

  welcome(message: string): void {
    this.output.write(
      renderBanner({
        brand: this.brand,
        columns: this.columns,
        interactive: this.interactive,
        noColor: this.noColor,
      }),
    );
    if (this.interactive) prompts.intro(message, { output: this.output });
    else this.output.write(`${message}\n`);
  }

  select<Value>(
    options: prompts.SelectOptions<Value>,
  ): Promise<Value | symbol> {
    this.requireTerminal();
    return prompts.select({
      ...options,
      input: this.input,
      output: this.output,
    });
  }

  text(options: prompts.TextOptions): Promise<string | symbol> {
    this.requireTerminal();
    return prompts.text({ ...options, input: this.input, output: this.output });
  }

  search(options: SearchOptions): Promise<string | symbol> {
    this.requireTerminal();
    return searchChoices(options, this.input, this.output);
  }

  password(options: prompts.PasswordOptions): Promise<string | symbol> {
    this.requireTerminal();
    return prompts.password({
      ...options,
      input: this.input,
      output: this.output,
    });
  }

  confirm(options: prompts.ConfirmOptions): Promise<boolean | symbol> {
    if (!this.interactive) return Promise.resolve(false);
    return prompts.confirm({
      ...options,
      input: this.input,
      output: this.output,
    });
  }

  info(message: string): void {
    if (this.interactive) prompts.log.info(message, { output: this.output });
    else this.output.write(`${message}\n`);
  }

  /**
   * Show a URL inside the prompt frame as one unbroken line. `info()` and
   * `step()` add a status symbol; this keeps only the frame's "│" bar before
   * the URL and never inserts a line break, so the terminal soft-wraps it and
   * a selection from its first character copies the whole URL.
   */
  url(url: string): void {
    if (this.interactive)
      prompts.log.message(url, { output: this.output, spacing: 0 });
    else this.output.write(`${url}\n`);
  }

  /**
   * An OSC 8 hyperlink around a short label, for terminals that render it.
   * Falls back to the plain label when output is non-interactive, piped, or
   * NO_COLOR/dumb — the same signal `info()` already uses to decide whether
   * to use clack's styling at all.
   */
  link(label: string, url: string): string {
    if (!this.interactive || this.noColor) return label;
    return `\u001B]8;;${url}\u0007${label}\u001B]8;;\u0007`;
  }

  /**
   * A boxed summary such as "Oyster is running": a titled Clack note in a
   * terminal, a title line followed by indented lines when piped.
   */
  note(title: string, lines: readonly string[]): void {
    if (this.interactive)
      prompts.note(lines.join("\n"), title, { output: this.output });
    else
      this.output.write(
        `${title}\n${lines.map((line) => `  ${line}`).join("\n")}\n`,
      );
  }

  /** A non-fatal problem and the exact step that works around it. */
  warn(title: string, next: string): void {
    if (this.interactive) {
      prompts.log.warn(title, { output: this.output });
      prompts.log.message(next, { output: this.output, spacing: 0 });
    } else this.output.write(`warning: ${title}\n  next: ${next}\n`);
  }

  /** A failure and the exact next step, for the end of a failed command. */
  problem(title: string, next: string): void {
    if (this.interactive) {
      prompts.cancel(title, { output: this.output });
      prompts.note(next, "Next step", { output: this.output });
    } else this.output.write(`error: ${title}\n  next: ${next}\n`);
  }

  step(message: string): void {
    if (this.interactive) prompts.log.step(message, { output: this.output });
    else this.output.write(`${message}\n`);
  }

  outro(message: string): void {
    if (this.interactive) prompts.outro(message, { output: this.output });
    else this.output.write(`${message}\n`);
  }

  cancel(message: string): void {
    if (this.interactive) prompts.cancel(message, { output: this.output });
    else this.output.write(`${message}\n`);
  }

  /** Report work without taking input or cancellation ownership from its caller. */
  async task<T>(
    message: string,
    work: (update: (message: string) => void) => Promise<T>,
  ): Promise<T> {
    const progress =
      this.interactive && !this.noColor && this.columns > 0
        ? prompts.taskLog({ title: message, output: this.output, limit: 1 })
        : undefined;
    if (!progress) this.step(message);
    try {
      let last = message;
      const result = await work((next) => {
        if (next === last) return;
        last = next;
        if (progress) progress.message(next);
        else this.step(next);
      });
      if (progress) progress.success(last);
      return result;
    } catch (cause) {
      if (progress)
        progress.error(
          `${message}: ${cause instanceof Error && cause.name === "AbortError" ? "stopped" : "failed"}`,
          { showLog: false },
        );
      throw cause;
    }
  }

  /** Shared doctor checklist; the caller owns what constitutes a pass. */
  checklist(): (label: string, ok: boolean, detail: string) => void {
    return (label, ok, detail) => {
      const message = `${ok ? "PASS" : "FAIL"} ${label}: ${detail}`;
      if (this.interactive) {
        const report = ok ? prompts.log.success : prompts.log.error;
        report(message, { output: this.output });
      } else this.output.write(`${message}\n`);
    };
  }

  private requireTerminal(): void {
    if (!this.interactive)
      throw new Error(
        `${this.brand}: this prompt needs a terminal; use explicit command options for automation.`,
      );
  }
}
