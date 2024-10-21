export function getEnvVar(key: string): string {
  const value = process.env[key];
  if (typeof value !== "string") {
    throw new Error(
      `Environment variable ${key} is not a string or is undefined`
    );
  }
  return value;
}
