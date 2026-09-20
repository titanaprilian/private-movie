export function getClientIp(
  request: Request,
  server?: { requestIP?: (req: Request) => { address: string } | null | undefined } | null
): string {
  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  const xRealIp = request.headers.get("x-real-ip")?.trim();
  if (xRealIp) {
    return xRealIp;
  }

  const serverIp = server?.requestIP?.(request)?.address;
  if (serverIp) {
    return serverIp;
  }

  return "127.0.0.1";
}
