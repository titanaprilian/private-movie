import { DramulaProvider } from "./src/providers/dramula";
import { createStealthBrowser } from "./src/browser";

const provider = new DramulaProvider();
const handle = await createStealthBrowser({ headless: true, timeout: 20000 });

async function test() {
  console.log("Testing stealth browser for: https://dramula.com/watch/the-early-spring-2026/s1e1");
  try {
     const sources = await provider.resolveVideoSources(
       "https://dramula.com/watch/the-early-spring-2026/s1e1",
        { get: async () => "", post: async () => "" },
        {},
        handle.browserFn
      );
      console.log("\nFound Sources:", JSON.stringify(sources, null, 2));
  } catch(e) {
     console.error(e);
  } finally {
    await handle.close();
  }
}
test();
