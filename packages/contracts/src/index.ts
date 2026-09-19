export * from "./auth";
export * from "./genres";
export * from "./media";
export * from "./media-management";
export * from "./media-openapi";
export * from "./storage";

export type Dummy = {
  message: string;
};

export const DUMMY_VALUE: Dummy = {
  message: "hello from @repo/contracts",
};
