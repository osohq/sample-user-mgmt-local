// Error handling for `useFormState`.
export type Result<T> = Success<T> | Failure;

interface Success<T> {
  success: true;
  value: T;
}

interface Failure {
  success: false;
  error: string;
}

// Extracts the most reasonable string value to display as an error.
export function stringifyError(error: unknown): string {
  if (typeof error === "string") {
    return error;
  } else if (error instanceof Error) {
    return error.message;
  } else {
    return "Unknown error";
  }
}
