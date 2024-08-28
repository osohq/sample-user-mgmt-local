// Generic error handling inspired by Rust.
export type Result<T> = Success<T> | Failure;

interface Success<T> {
  success: true;
  value: T;
}

interface Failure {
  success: false;
  error: string;
}

// Function to handle errors
export function handleError<T>(error: unknown): Result<T> {
  console.error("Database operation failed:", error);

  if (typeof error === "string") {
    return { success: false, error };
  } else if (error instanceof Error) {
    return { success: false, error: error.message };
  } else {
    return { success: false, error: "Unknown error" };
  }
}
