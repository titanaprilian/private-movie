export * from "./auth";
export * from "./media";
export * from "./media-openapi";
export * from "./storage";

export type Dummy = {
  message: string;
};

export const DUMMY_VALUE: Dummy = {
  message: "hello from @repo/contracts",
};
