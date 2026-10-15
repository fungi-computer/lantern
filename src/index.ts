import process from "node:process";
import type { Readable, Writable } from "node:stream";
import { ReadStream, WriteStream } from "node:tty";
import * as prompts from "@clack/prompts";
import { colorizeBanner, renderBanner, type CliBrand } from "./banner.js";
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
   * Write one line exactly as given, outside clack's log box. `info()`/`step()`
   * prefix every line after the first with a "│ " continuation gutter, which a
   * terminal selection can pull into a copy; text a caller needs copied whole
   * (a URL) goes through here instead, never through the box.
   */
  raw(message: string): void {
    this.output.write(`${message}\n`);
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

  /** Stop animation on both success and failure, without exposing error payloads. */
  async task<T>(
    message: string,
    work: (update: (message: string) => void) => Promise<T>,
  ): Promise<T> {
    const spinner =
      this.interactive && !this.noColor
        ? prompts.spinner({ output: this.output, styleFrame: colorizeBanner })
        : undefined;
    if (spinner) spinner.start(message);
    else this.step(message);
    try {
      let last = message;
      const result = await work((next) => {
        if (next === last) return;
        last = next;
        if (spinner) spinner.message(next);
        else this.step(next);
      });
      if (spinner) spinner.stop(last);
      return result;
    } catch (cause) {
      if (spinner) spinner.error(`${message}: failed`);
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
