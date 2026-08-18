export type ResponseSetLike = {
  status?: number | string;
};

export function successResponse<T>(data: T): { data: T } {
  return { data };
}

const errorCodeFromClassName = (className: string): string => {
  const withoutSuffix = className.endsWith("Error")
    ? className.slice(0, -"Error".length)
    : className;
  return withoutSuffix
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toUpperCase();
};

const deriveErrorCode = (error: Error): string => {
  const className = error.constructor?.name || error.name || "Error";
  return errorCodeFromClassName(className);
};

export function errorResponse(
  set: ResponseSetLike,
  status: number,
  error: Error
): { error: { code: string; message: string; [key: string]: unknown } } {
  set.status = status;
  const errorObj: { code: string; message: string; [key: string]: unknown } = {
    code: deriveErrorCode(error),
    message: error.message,
  };

  if ("missingFields" in error && error.missingFields !== undefined) {
    errorObj.missingFields = (error as { missingFields: unknown }).missingFields;
  }

  return {
    error: errorObj,
  };
}
