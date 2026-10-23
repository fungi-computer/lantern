# Lantern (`@fungi.computer/lantern`)

Lantern provides terminal wordmarks, prompts and progress. Most people want
[Oyster](https://docs.fungi.computer/oyster/) to run Apps or
[Shiitake](https://docs.fungi.computer/shiitake/) to run Agents.

Lantern gives Fungi command-line tools shared wordmarks, prompts, and progress
messages, so every command looks and feels the same without rebuilding terminal
presentation from scratch. It handles terminal presentation. Each command owns
its own work, credentials, persistence, and conversation state.

## Install or set up

Use Node 24 or newer.

```sh
npm install @fungi.computer/lantern
```

The package ships ESM only and depends on `@clack/core`, `@clack/prompts`, and
[Stipe](https://docs.fungi.computer/stipe/) for terminal colors, all installed
automatically. Import `@fungi.computer/lantern` for Node command-line tools, or
`@fungi.computer/lantern/banner` to render a banner without importing Clack
prompts or Node streams.

## Quick start

This illustrative example uses a noninteractive CLI so progress and checklist
messages go to the supplied output stream:

```ts
import { Cli } from "@fungi.computer/lantern";

const cli = new Cli({ brand: "vishnu", interactive: false });
cli.welcome("Build a game");
await cli.task("Building", async (update) => {
  update("Checking the project");
  return "ready";
});
cli.checklist()("project", true, "ready");
```

The terminal tests exercise banner rendering, piped input behavior, and
noninteractive task output in [`test/terminal.test.ts`](test/terminal.test.ts).

## Core concepts

`Cli` detects interactivity from TTY input and output unless the caller passes
`interactive`. It accepts optional input, output, and terminal width so a host
can control where prompts and messages go. `welcome`, `info`, `step`, `outro`,
`cancel`, `task`, and `checklist` provide shared presentation. A task stops its
spinner on success. A failed task rethrows the original error. When a spinner is
active, it displays a generic failure message without error details.

In noninteractive mode, ordinary messages are written as text and `confirm`
returns `false`. `text`, `password`, `select`, and `search` throw because they
require an interactive terminal. `task` reports progress as plain lines instead
of animating a spinner.

`search` accepts ordered choices with labels, descriptions and optional group
names. It displays group headings and can collapse one group behind a counted
disclosure row. Typing searches every choice, including collapsed choices. Enter
expands the disclosure or selects a choice. Callers own the catalog and group
membership. Clack owns input, navigation and cancellation.

`renderBanner` is the browser-safe rendering entrypoint. It chooses a brand's
wide or compact art for interactive terminals, and a plain brand label for piped
or no-color output. Widths below 60 columns use compact art where available;
Computer omits its art at narrow widths. Set `rawPty: true` when writing
directly to a raw pseudo-terminal to receive CRLF line endings.

## API reference

See the generated [Lantern API reference](docs/api/index.md) and the
[banner reference](docs/api/banner.md). The `./banner` entrypoint exports
`renderBanner` and the art strings.

## Examples and checks

The existing terminal tests cover banner width and color behavior, raw PTY line
endings, prompt refusal for piped input, and noninteractive task/checklist
messages. Run them with:

```sh
pnpm --filter @fungi.computer/lantern test
```

## Limits and errors

Lantern does not run commands or decide whether work succeeds. The caller
provides the task and owns its result. A noninteractive task prints no failure
line when it throws. Noninteractive confirmation always declines, and prompt
methods that could consume piped input refuse to run. Use explicit command
options for automation.

The banner renderer selects existing art and wraps it with Stipe's semantic
palette. It does not start a shell or own terminal greeting timing or
reconnection behavior.

## Contribute and license

Lantern is MIT licensed. See [`LICENSE`](LICENSE).
