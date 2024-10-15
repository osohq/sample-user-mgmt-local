"use server";

import { docsPool as pool } from "@/lib/db";
import { osoDocMgmt as oso } from "@/lib/oso";
import { User, Document } from "@/lib/relations";
import { Result, stringifyError } from "@/lib/result";

import {
  assignDocUserRole,
  auth as docAuth,
  list as docList,
  actions as docActions,
} from "./doc_perms";
import { authorizeUser } from "@/lib/oso";

/**
 * Get all documents on which the `user` has the `read` permission.
 *
 * ## Oso documentation
 * This function demonstrates a standard read path with local authorization,
 * relying on `listLocal` to generate a condition for a query.
 *
 * @throws {Error} If there is a problem with the database connection.
 */
export async function getReadableDocuments(user: User): Promise<Document[]> {
  const client = await pool.connect();
  try {
    const ids = await docList(client, user.username, "read");
    if (ids.length === 0) {
      return [];
    }

    // Inline the condition generated from `listLocal` into a query the get the
    // organization's names.
    const readableDocs = `SELECT id, org, title, public FROM documents WHERE id = ANY($1::int[])`;
    const docs = await client.query<Document>(readableDocs, [ids]);
    return docs.rows;
  } catch (error) {
    console.error("Error in getReadableDocuments:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Create a document.
 *
 * Requires the `requestor` have `create_document` permission on their own
 * organization. (Users can only create documents in their own organizations.)
 *
 * ## Oso documentation
 * Demonstrates a standard authorized endpoint––ensuring the user has a specific
 * permission, and permitting it to occur only if they do.
 */
export async function createDocument(
  // Bound parameter because `createDocument` is used as a form action.
  p: { requestor: User },
  _prevState: Result<number> | null,
  formData: FormData
): Promise<Result<number>> {
  const { requestor } = p;

  const data = {
    title: formData.get("title")! as string,
  };

  const client = await pool.connect();
  try {
    const auth = await authorizeUser(
      oso,
      client,
      requestor.username,
      "create_doc",
      { type: "Organization", id: requestor.org }
    );

    if (!auth) {
      return {
        success: false,
        error: `not permitted to create documents in Organization ${requestor.org}`,
      };
    }

    client.query("BEGIN");

    const docIdRes = await client.query<{ id: number }>(
      `INSERT INTO documents (org, title, public) VALUES ($1, $2, false) RETURNING id`,
      [requestor.org, data.title]
    );
    const docId = docIdRes.rows[0].id;

    await assignDocUserRole(
      client,
      requestor.username,
      requestor.username,
      "owner",
      docId
    );

    client.query("COMMIT");

    return { success: true, value: docId };
  } catch (error) {
    client.query("ROLLBACK");
    return {
      success: false,
      error: stringifyError(error),
    };
  } finally {
    client.release();
  }
}

/**
 * Identifies a `User` the requestor is permitted to read, as well fields
 * describing other permissions.
 */
export interface ReadableDocument {
  id: number;
  org: string;
  title: string;
  public: boolean;
  // Permissions
  delete: boolean;
  assignOwner: boolean;
  manageShare: boolean;
  edit: boolean;
  setPublic: boolean;
}

/**
 * Gets a specific document (`id`), with the permissions that `requestor` has on
 * it.
 *
 * Requires the `requestor` have `read` permission on the document.
 *
 * ## Oso documentation
 * Demonstrates an advanced form of local authorization, which relies on
 * evaluating many properties of a resource in a single query. This design
 * reduces the number of roundtrips to the database your application needs to
 * perform.
 *
 * @throws {Error} If there is a problem with the database connection or the
 * user does not have the `read` permission on the identified document.
 */
export async function getDocumentWPermissions(
  requestor: string,
  id: number
): Promise<ReadableDocument> {
  const client = await pool.connect();
  try {
    // Determine actions available on document.
    const actions = await docActions(client, requestor, id);
    if (!actions.includes("read")) {
      throw new Error(`cannot find Document ${id}`);
    }

    const getDoc = `SELECT id, org, title, public FROM documents WHERE id = $1`;
    const docRows = await client.query<Document>(getDoc, [id]);
    if (docRows.rowCount != 1) {
      throw new Error(`cannot find Document ${id}`);
    }
    const doc: Document = docRows.rows[0];

    return {
      ...doc,
      assignOwner: actions.includes("assign_owner"),
      delete: actions.includes("delete"),
      edit: actions.includes("edit"),
      manageShare: actions.includes("manage_share"),
      setPublic: actions.includes("set_public"),
    };
  } catch (error) {
    console.error("Error in getDocumentWPermissions:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Updates the specified document's title.
 *
 * Requires `requestor` to have the `edit` permission on the document.
 *
 * ## Oso documentation
 * Demonstrates a standard authorized endpoint––ensuring the user has a specific
 * permission, and permitting it to occur only if they do.
 *
 * @throws {Error} If there is a problem with the database connection,
 * authorization fails, or another request concurrently deletes the document.
 */
export async function updateDocumentTitle(
  // Bound parameter because `updateDocumentTitle` is used as a form action.
  p: { username: string; id: number },
  _prevState: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  const { username, id } = p;

  const data = {
    title: formData.get("title")! as string,
  };

  const client = await pool.connect();
  try {
    const auth = await docAuth(client, username, "edit", id);
    if (!auth) {
      throw new Error(`not permitted to write to Document ${id}`);
    }

    const title = await client.query<String>(
      `UPDATE documents SET title = $2 WHERE id = $1 RETURNING title;`,
      [id, data.title]
    );

    if (title.rowCount != 1) {
      throw new Error(`cannot find Document ${id}`);
    }

    return { success: true, value: title.rows[0].valueOf() };
  } catch (error) {
    console.error("Error in updateDocumentTitle:", error);
    return { success: false, error: stringifyError(error) };
  } finally {
    client.release();
  }
}

/**
 * Set the document's public setting to the specified value.
 *
 * Requires `requestor` to have the `set_public` permission on the document.
 *
 * ## Oso documentation
 * Demonstrates a standard authorized endpoint––ensuring the user has a specific
 * permission, and permitting it to occur only if they do.
 *
 * @throws {Error} If there is a problem with the database connection,
 * authorization fails, or another request concurrently deletes the document.
 */
export async function setPublic(
  requestor: string,
  id: number,
  publicSetting: boolean
): Promise<boolean> {
  const client = await pool.connect();
  try {
    const auth = await docAuth(client, requestor, "set_public", id);
    if (!auth) {
      throw new Error(
        `not permitted to change public setting of Document ${id}`
      );
    }

    const publicSettingRes = await client.query<{ public: boolean }>(
      `UPDATE documents SET public = $2 WHERE id = $1 RETURNING public;`,
      [id, publicSetting]
    );
    if (publicSettingRes.rowCount != 1) {
      throw new Error(`failed to change public setting for Document ${id}`);
    }
    return publicSettingRes.rows[0].public;
  } catch (error) {
    console.error("Error in setPublic:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete the specified document.
 *
 * Requires `requestor` to have the `delete` permission on the document.
 *
 * ## Oso documentation
 * Demonstrates a standard authorized endpoint––ensuring the user has a specific
 * permission, and permitting it to occur only if they do.
 *
 * @throws {Error} If there is a problem with the database connection or
 * authorization fails.
 */
export async function deleteDoc(
  requestor: string,
  id: number
): Promise<undefined> {
  const client = await pool.connect();
  try {
    const auth = await docAuth(client, requestor, "delete", id);
    if (!auth) {
      throw new Error(`not permitted to delete Document ${id}`);
    }

    await client.query(`DELETE FROM documents WHERE id = $1;`, [id]);
    return;
  } catch (error) {
    console.error("Error in deleteDoc:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Gets the organization to which a document belongs.
 *
 * Requires the `requestor` to have the `read` permission on the document.
 *
 * ## Oso documentation
 * This function demonstrates a standard access pattern––checking that the user
 * is permitted to perform the action.
 *
 * @throws {Error} If there is a problem with the database connection,
 * authorization fails, or the specified document cannot be found.
 */
export async function getDocumentOrg(
  requestor: string,
  id: number
): Promise<string> {
  const client = await pool.connect();
  try {
    // We infer that if the user has `"read"` permissions on the document, they
    // must also have `"read"` permissions on the organization to which the
    // document belongs.
    const auth = await docAuth(client, requestor, "read", id);
    if (!auth) {
      throw new Error(`not permitted to read Document ${id}`);
    }

    const org = await client.query<{ org: string }>(
      `SELECT org FROM documents WHERE id = $1;`,
      [id]
    );
    if (org.rowCount != 1) {
      throw new Error(`cannot find Document ${id}`);
    }

    return org.rows[0].org;
  } catch (error) {
    console.error("Error in getDocumentOrg:", error);
    throw error;
  } finally {
    client.release();
  }
}
