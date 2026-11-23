function readMessage(error: unknown) {
  if (error instanceof Error) return error.message.trim();
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const { message } = error as { message: unknown };
    if (typeof message === 'string') return message.trim();
  }
  return '';
}

export function getErrorMessage(error: unknown, fallback: string) {
  const message = readMessage(error);
  if (!message) return fallback;
  if (/failed to fetch|network request failed|networkerror|load failed/i.test(message)) {
    return 'Network error. Check your connection and try again.';
  }
  return message;
}

// PostgREST puts the RAISE ... USING DETAIL text in `details`.
export function getErrorDetails(error: unknown) {
  if (typeof error === 'object' && error !== null && 'details' in error) {
    const { details } = error as { details: unknown };
    if (typeof details === 'string') return details;
  }
  return '';
}
