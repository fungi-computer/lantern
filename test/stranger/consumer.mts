import { Cli } from "@fungi.computer/lantern";
import {
  renderBanner,
  type BannerOptions,
} from "@fungi.computer/lantern/banner";
const options: BannerOptions = {
  brand: "fungi",
  columns: 80,
  interactive: true,
  noColor: false,
};
const banner: string = renderBanner(options);
const cli = new Cli({ brand: "vishnu", interactive: false });
const accepted: Promise<boolean | symbol> = cli.confirm({
  message: "Continue?",
});
void banner;
void accepted;
