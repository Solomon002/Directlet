import { isAxiosError } from "axios";

export type ApiErrorInfo = {
  message: string;
  fieldErrors: Record<string, string[]>;
};

// Reads the error shape our API returns: { error: { code, message, details } }.
export function parseApiError(error: unknown): ApiErrorInfo {
  if (isAxiosError(error)) {
    if (!error.response) {
      return {
        message: "Cannot reach the server. Check your connection and try again.",
        fieldErrors: {},
      };
    }

    const body = error.response.data as
      | { error?: { message?: string; details?: unknown } }
      | undefined;
    const details = body?.error?.details;

    return {
      message: body?.error?.message ?? "Something went wrong. Please try again.",
      fieldErrors:
        details && typeof details === "object" ? (details as Record<string, string[]>) : {},
    };
  }

  return { message: "Something went wrong. Please try again.", fieldErrors: {} };
}
