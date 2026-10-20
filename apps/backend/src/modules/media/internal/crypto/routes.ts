import { Elysia } from "elysia";
import { CryptoSubtleError, executeCryptoSubtleOperation } from "./service";
import type { MediaRoutesOptions } from "../../schemas";

export const cryptoRoutes = (_options: MediaRoutesOptions) => {
  return new Elysia({ name: "media-crypto-routes" }).post(
    "/media/crypto-subtle",
    async ({ body, set }) => {
      try {
        const result = await executeCryptoSubtleOperation(
          body as {
            op: string;
            algorithm: Record<string, unknown>;
            keyRaw?: string;
            keyAlgorithm?: Record<string, unknown>;
            data: string;
          }
        );
        return { result };
      } catch (e) {
        if (e instanceof CryptoSubtleError) {
          set.status = e.status;
          return { error: e.message };
        }
        set.status = 500;
        return { error: e instanceof Error ? e.message : "Crypto operation failed" };
      }
    },
    {
      detail: { hide: true },
    }
  );
};
