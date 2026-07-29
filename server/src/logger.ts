export function logInfo(event: string, details: Record<string, unknown> = {}): void {
  console.info(JSON.stringify({ level: "info", event, ...details }));
}

export function logWarn(event: string, details: Record<string, unknown> = {}): void {
  console.warn(JSON.stringify({ level: "warn", event, ...details }));
}

export function logError(event: string, details: Record<string, unknown> = {}): void {
  console.error(JSON.stringify({ level: "error", event, ...details }));
}

export function tokenFingerprint(token: string): string {
  if (token.length <= 12) {
    return `${token.length}:short`;
  }

  return `${token.slice(0, 6)}...${token.slice(-6)}:${token.length}`;
}
