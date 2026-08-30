import type { MediaProvider } from "./types";
import { DramulaProvider } from "./providers/dramula";
import { OtakudesuProvider } from "./providers/otakudesu";

export class MediaScraper {
  private static defaultRegistry = new MediaScraper();

  private providers: MediaProvider[] = [];

  constructor(
    providers: MediaProvider[] = [
      new OtakudesuProvider(),
      new DramulaProvider(),
    ]
  ) {
    this.providers = [...providers];
  }

  public registerProvider(provider: MediaProvider): void {
    this.providers.push(provider);
  }

  public getProviderForUrl(url: string): MediaProvider | null {
    return this.providers.find((provider) => provider.canHandle(url)) ?? null;
  }

  public static registerProvider(provider: MediaProvider): void {
    this.defaultRegistry.registerProvider(provider);
  }

  public static unregisterAll(): void {
    this.defaultRegistry = new MediaScraper([]);
  }

  public static getProviderForUrl(url: string): MediaProvider | null {
    return this.defaultRegistry.getProviderForUrl(url);
  }
}
