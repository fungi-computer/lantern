import { Cli } from "@fungi.computer/lantern";
import { fungiWordmark, renderBanner } from "@fungi.computer/lantern/banner";
const cli = new Cli({ brand: "vishnu", interactive: false });
if (cli.interactive || !fungiWordmark.startsWith("\n\n"))
  throw new Error("Missing retained CLI contract");
if (
  renderBanner({
    brand: "vishnu",
    columns: 80,
    interactive: false,
    noColor: false,
  }) !== "vishnu\n"
)
  throw new Error("Piped banner is not plain");
