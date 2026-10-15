import { AutocompletePrompt, type AutocompleteOptions } from "@clack/core";
import { isCancel, limitOptions, symbol } from "@clack/prompts";
import type { Readable, Writable } from "node:stream";
import { styleText } from "node:util";

/** Already ordered choices; the caller owns group membership and labels. */
export type SearchChoice = Readonly<{
  value: string;
  label: string;
  description?: string | undefined;
  group?: string | undefined;
}>;
export type SearchOptions = Readonly<{
  message: string;
  choices: readonly SearchChoice[];
  collapsedGroup?: string;
  signal?: AbortSignal;
}>;
type Row = {
  value: number;
  label: string;
  description?: string | undefined;
  group?: string | undefined;
};

/** Clack owns editing, cursor navigation, cancellation and terminal restoration. */
class SearchPrompt extends AutocompletePrompt<Row> {
  override _shouldSubmit(): boolean {
    if (this.focusedValue !== -1) return this.focusedValue !== undefined;
    this.expand();
    // Expansion replaces one disclosure row with that group's first choice.
    // The native cursor therefore stays at the same position in the list.
    this.filteredOptions = this.options;
    this.focusedValue = this.filteredOptions[this.cursor]?.value;
    this.selectedValues =
      this.focusedValue === undefined ? [] : [this.focusedValue];
    return false;
  }

  constructor(
    options: AutocompleteOptions<Row>,
    private readonly expand: () => void,
  ) {
    super(options);
  }
}

export async function searchChoices(
  options: SearchOptions,
  input: Readable,
  output: Writable,
): Promise<string | symbol> {
  let expanded = false;
  const rows: Row[] = options.choices.map((choice, value) => ({
    ...choice,
    value,
  }));
  const configuration: AutocompleteOptions<Row> = {
    input,
    output,
    options() {
      const collapsedGroup = options.collapsedGroup;
      const query = this.userInput.trim().toLocaleLowerCase();
      const matches = rows.filter(
        (row) =>
          row.label.toLocaleLowerCase().includes(query) ||
          (row.description ?? "").toLocaleLowerCase().includes(query),
      );
      if (expanded || query || collapsedGroup === undefined) return matches;
      const hidden = matches.filter((row) => row.group === collapsedGroup);
      if (hidden.length === 0) return matches;
      const first = hidden[0];
      return matches.flatMap((row): Row[] =>
        row.group !== collapsedGroup
          ? [row]
          : row === first
            ? [
                {
                  value: -1,
                  label: `${collapsedGroup} (${String(hidden.length)})…`,
                },
              ]
            : [],
      );
    },
    render() {
      const heading = `${symbol(this.state)}  ${options.message}`;
      if (this.state === "cancel") return `${heading}\n   Cancelled`;
      if (this.state === "submit") {
        const selected = rows.find((row) => row.value === this.focusedValue);
        return `${heading}\n   ${selected?.label ?? ""}`;
      }
      const query = this.userInput
        ? this.userInputWithCursor
        : styleText("dim", "type to filter");
      const visible = limitOptions({
        options: this.filteredOptions,
        cursor: this.cursor,
        output,
        rowPadding: 7,
        columnPadding: 3,
        maxItems: 16,
        style: (row, active) => {
          const index = this.filteredOptions.indexOf(row);
          const previous = this.filteredOptions[index - 1];
          const separation =
            index > 0 && row.group !== previous?.group ? "\n" : "";
          const group =
            row.group !== undefined && row.group !== previous?.group
              ? `${styleText("dim", row.group.toLocaleUpperCase())}\n`
              : "";
          const hint = row.description
            ? `  ${styleText("dim", row.description)}`
            : "";
          return `${separation}${group}${active ? styleText("cyan", "▶") : " "} ${row.label}${hint}`;
        },
      });
      return [
        heading,
        `│  / ${query}`,
        "│",
        ...(visible.length ? visible : ["No matches"])
          .flatMap((line) => line.split("\n"))
          .map((line) => `│  ${line}`),
        "│",
        `│  ${styleText("dim", "↑↓ choose · Enter select · Esc cancel")}`,
        "└",
      ].join("\n");
    },
  };
  if (options.signal !== undefined) configuration.signal = options.signal;
  const prompt = new SearchPrompt(configuration, () => {
    expanded = true;
  });
  const answer = await prompt.prompt();
  if (isCancel(answer)) return answer;
  const choice = options.choices.find((_choice, index) => index === answer);
  if (choice === undefined) throw new Error("Search returned no choice");
  return choice.value;
}
