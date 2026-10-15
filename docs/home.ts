import { Cli } from "@fungi.computer/lantern";

const cli = new Cli({ brand: "vishnu", interactive: false });
cli.welcome("Build a game");
const status = await cli.task("Building", async () => "ready");
console.log(status); // "ready"
cli.checklist()("project", status === "ready", status);
