"use server";

import { pool } from "@/lib/db";
import { Result, handleError } from "@/lib/result";

// Create a new organization
export async function createOrg(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const data = {
    name: formData.get("orgName"),
  };

  const client = await pool.connect();
  try {
    await client.query(`INSERT INTO organizations (name) VALUES ($1);`, [
      data.name,
    ]);
    return { success: true, value: null };
  } catch (error) {
    return handleError(error);
  } finally {
    client.release();
  }
}
