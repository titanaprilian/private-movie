import { beforeEach } from "vitest";
import { truncateAll } from "./utils/db";

beforeEach(async () => {
  await truncateAll();
});
