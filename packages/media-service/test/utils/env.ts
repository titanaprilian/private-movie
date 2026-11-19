export function resolveTestDatabaseUrl(): string {
  const envUrl =
    process.env.MEDIA_SERVICE_TEST_DATABASE_URL ??
    process.env.TEST_DATABASE_URL ??
    process.env.DATABASE_URL ??
    "postgres://postgres:root_password@localhost:5432/private_movie_test";
  try {
    const url = new URL(envUrl);
    if (!process.env.MEDIA_SERVICE_TEST_DATABASE_URL) {
      if (!url.pathname.endsWith("_media_test")) {
        const baseName = url.pathname
          .replace(/^\//, "")
          .replace(/_test$/, "")
          .replace(/_media$/, "");
        url.pathname = `/${baseName}_media_test`;
      }
    }
    return url.toString();
  } catch {
    return envUrl;
  }
}
