export * from "./auth";
export * from "./media";
export * from "./media-openapi";

export type Dummy = {
  message: string;
};

export const DUMMY_VALUE: Dummy = {
  message: "hello from @repo/contracts",
};
