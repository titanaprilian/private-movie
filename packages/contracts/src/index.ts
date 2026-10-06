export * from "./auth";
export * from "./dashboard";
export * from "./genres";
export * from "./media";
export * from "./media-management";
export * from "./media-openapi";
export * from "./scraper";
export * from "./storage";
export * from "./archive-ingest-jobs";

export type Dummy = {
  message: string;
};

export const DUMMY_VALUE: Dummy = {
  message: "hello from @repo/contracts",
};
