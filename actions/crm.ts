"use server";

import { crmPool as pool } from "@/lib/db";
import { authorizeUser, osoCrmMgmt as oso } from "@/lib/oso";
import { Opportunity, QualifiedTerritory } from "@/lib/relations";
import { Result, stringifyError } from "@/lib/result";
import { typedVar } from "oso-cloud";

interface TerritoryActionsAgg extends QualifiedTerritory {
  actions: string[];
}

export interface TerritoryWPermissions extends QualifiedTerritory {
  manageResponsibility: boolean;
  createOpportunity: boolean;
}

/**
 * Retrieves territories and their associated permissions for a given user.
 *
 * This function queries the database to get all territories that a user has
 * access to, along with specific permissions for each territory. The
 * permissions include the ability to manage responsibilities and create
 * opportunities within the territory.
 *
 * @param requestor - The ID of the user requesting territory information
 * @returns Promise resolving to an array of territories with associated
 * permissions
 * @throws {Error} If there is a database connection or query error
 *
 * ## Oso documentation
 * Uses an "enrichment" pattern to get territories, as well as permissions on
 * those territories.
 */
export async function getTerritories(
  requestor: string
): Promise<TerritoryWPermissions[]> {
  const client = await pool.connect();
  try {
    const user = { type: "User", id: requestor };
    const actionVar = typedVar("String");
    const apptVar = typedVar("Territory");

    let query = oso.buildQuery(["allow", user, actionVar, apptVar]);

    const territoryActions = await query.evaluateLocalSelect({
      actions: actionVar,
      name: apptVar,
    });

    const territoryActionsQ = `SELECT
          actions_per_territory.name AS name,
          get_ancestors(actions_per_territory.name) AS ancestors,
          actions_per_territory.actions
        FROM (
          -- Get all actions for each user
          SELECT name, array_agg(actions) AS actions
          FROM (
            ${territoryActions}
          ) AS territory_actions
          GROUP BY territory_actions.name
        ) AS actions_per_territory`;

    const territoryWActions = await client.query<TerritoryActionsAgg>(
      territoryActionsQ
    );

    return territoryWActions.rows.map((terr) => ({
      name: terr.name,
      ancestors: terr.ancestors,
      manageResponsibility: terr.actions.includes("manage_responsibility"),
      createOpportunity: terr.actions.includes("create_opportunity"),
    }));
  } catch (error) {
    console.error("Error in getTerritories:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Assigns a territory to a user by inserting/updating the sales_territory_manager table.
 *
 * This function is designed to be used as a form action handler, taking FormData input
 * and returning a Result type.
 *
 * @param p - Bound parameter containing requestor ID
 * @param _prevState - Previous state (unused)
 * @param formData - Form data containing user and territory information
 * @returns Promise<Result<string>> - Success with requestor ID or error message
 *
 * ## Oso documentation
 * Uses Oso's authorizeUser helper to check if the requestor has "manage_responsibility"
 * permission on the target territory.
 *
 * ## Error handling
 * - Returns Result.error if authorization fails
 * - Returns Result.error with stringified error for other failures
 * - Always releases DB client connection via finally block
 * - Assumes FormData fields "user" and "territory" are present (uses ! assertion)
 */
export async function assignTerritory(
  // Bound parameter because `assignTerritory` is used as a form action.
  p: { requestor: string },
  _prevState: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  const data = {
    user: formData.get("user")! as string,
    territory: formData.get("territory")! as string,
  };

  const { username, org } = JSON.parse(data.user);

  const client = await pool.connect();

  try {
    const territory = {
      type: "Territory",
      id: data.territory,
    };
    const auth = await authorizeUser(
      oso,
      client,
      p.requestor,
      "manage_responsibility",
      territory
    );

    if (!auth) {
      return {
        success: false,
        error: `not permitted to assign territory ${data.territory}`,
      };
    }

    client.query(
      `INSERT INTO sales_territory_manager (org, territory, username)
      VALUES ($1, $2, $3)
      ON CONFLICT (org, territory)
      DO
        UPDATE SET username = $3;`,
      [org, data.territory, username]
    );

    return { success: true, value: p.requestor };
  } catch (error) {
    return { success: false, error: stringifyError(error) };
  } finally {
    client.release();
  }
}

export interface CreateOpportunityParams {
  requestor: string;
  org: string;
}

interface OpportunityFormData {
  opportunityName: string;
  territory: string;
  assignee: string | null;
  amount: number;
}

/**
 * Creates a new sales opportunity in the CRM system.
 *
 * This server action handles form submissions to create opportunities, including authorization
 * checks and database insertion. It's designed to work with React Server Components and
 * form actions.
 *
 * @param params - Basic parameters required for opportunity creation
 * @param params.requestor - Username of the user creating the opportunity
 * @param params.org - Organization ID where the opportunity will be created
 * @param _prevState - Previous state from form submission (unused)
 * @param formData - Form data containing opportunity details
 * @returns Promise resolving to a Result indicating success/failure
 *
 * @throws Will not throw exceptions, all errors are returned in Result object
 *
 * ## Form Fields
 * - opportunity_name: string - Name of the opportunity
 * - territory: string - Territory ID where opportunity will be created
 * - assignee: string? - Optional username to assign the opportunity to
 * - amount: number - Monetary value of the opportunity
 *
 * ## Oso Documentation
 * Demonstrates a local authorization check before a write.
 *
 * ## Error Handling
 * - Authorization failures return {success: false, error: string}
 * - Database errors are caught and converted to user-friendly messages
 * - Connection is always released via finally block
 */
export async function createOpportunity(
  params: CreateOpportunityParams,
  _prevState: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  const data: OpportunityFormData = {
    opportunityName: formData.get("opportunity_name") as string,
    territory: formData.get("territory") as string,
    assignee: formData.get("assignee") as string | null,
    amount: parseFloat(formData.get("amount") as string) || 0,
  };

  const client = await pool.connect();

  try {
    const territory = {
      type: "Territory" as const,
      id: data.territory,
    };

    const authQuery = await oso.authorizeLocal(
      { type: "User" as const, id: params.requestor },
      "create_opportunity",
      territory
    );

    const isAuthorized = await client.query(authQuery);

    if (!isAuthorized) {
      return {
        success: false,
        error: `Not permitted to create opportunity in ${data.territory}`,
      };
    }

    await client.query(
      `INSERT INTO opportunities (
        organization, 
        name, 
        territory, 
        amount, 
        assignee, 
        stage
      ) VALUES ($1, $2, $3, $4, $5, 'research'::opportunity_stage)`,
      [
        params.org,
        data.opportunityName,
        data.territory,
        data.amount,
        data.assignee,
      ]
    );

    return { success: true, value: params.requestor };
  } catch (error) {
    return { success: false, error: stringifyError(error) };
  } finally {
    client.release();
  }
}

interface OpportunityActionsAgg extends Opportunity {
  actions: string[];
}

export interface OpportunityWPermissions extends Opportunity {
  assign: boolean;
  viewAmount: boolean;
  changeDetails: boolean;
  potentialAssignees: string[];
}
/**
 * Retrieves opportunities with their associated permissions for a given requestor.
 *
 * @param requestor - The ID of the user requesting the opportunities
 * @returns Promise resolving to an array of opportunities with permissions
 * @throws {Error} If there is a database connection or query error
 *
 * ## Oso documentation
 * Uses an "enrichment" pattern to get territories, as well as permissions on
 * those territories.
 *
 * ## Error Handling
 * - Database errors are caught, logged, and re-thrown to be handled by caller
 * - Ensures database client is always released via finally block
 * - Returns empty potential assignees array if no assignable opportunities exist
 */
export async function getOpportunities(
  requestor: string
): Promise<OpportunityWPermissions[]> {
  const client = await pool.connect();

  try {
    // Build query to get opportunity actions for requesting user
    const requestingUser = { type: "User", id: requestor };
    const actionVar = typedVar("String");
    const oppVar = typedVar("Opportunity");

    const oppActionsQuery = await oso
      .buildQuery(["allow", requestingUser, actionVar, oppVar])
      .evaluateLocalSelect({
        actions: actionVar,
        name: oppVar,
      });

    // Get opportunities with their allowed actions
    const { rows: opportunitiesWithActions } =
      await client.query<OpportunityActionsAgg>(
        `SELECT
        opportunities.name,
        territory,
        amount,
        assignee,
        organization, 
        stage::TEXT,
        actions_per_opp.actions
      FROM (
        SELECT name, array_agg(actions) AS actions
        FROM (
          ${oppActionsQuery}
        ) AS opp_actions
        GROUP BY opp_actions.name
      ) AS actions_per_opp
      JOIN opportunities ON actions_per_opp.name = opportunities.name`
      );

    // Map opportunities to include permission flags
    const opportunitiesWithPermissions = opportunitiesWithActions.map(
      (opp) => ({
        ...opp,
        assign: opp.actions.includes("assign"),
        viewAmount: opp.actions.includes("view_amount"),
        changeDetails: opp.actions.includes("change_details"),
        potentialAssignees: [] as string[],
      })
    );

    // Get assignable opportunities
    const assignableOpportunities = opportunitiesWithPermissions
      .filter((opp) => opp.assign)
      .map((opp) => opp.name);

    if (assignableOpportunities.length === 0) {
      return opportunitiesWithPermissions;
    }

    // Get potential assignees for assignable opportunities
    const userVar = typedVar("User");
    const potentialAssigneesQuery = await oso
      .buildQuery(["has_role", userVar, "potential_assignee", oppVar])
      .in(oppVar, assignableOpportunities)
      .and(["allow", requestingUser, "read", userVar])
      .evaluateLocalSelect({
        name: oppVar,
        potential: userVar,
      });

    const { rows: potentialAssignees } = await client.query<{
      name: string;
      potential: string[];
    }>(
      `SELECT 
        name, 
        array_agg(potential) AS potential 
      FROM (${potentialAssigneesQuery}) AS role_agg 
      GROUP BY name`
    );

    // Create map of opportunity names to potential assignees
    const opportunityAssignees = new Map(
      potentialAssignees.map(({ name, potential }) => [name, potential])
    );

    // Return opportunities with permissions and potential assignees
    return opportunitiesWithPermissions.map((opp) => ({
      ...opp,
      potentialAssignees: opportunityAssignees.get(opp.name) ?? [],
    }));
  } catch (error) {
    console.error("Error in getOpportunities:", error);
    throw error;
  } finally {
    client.release();
  }
}
interface ChangeOpportunityAssigneeParams {
  requestor: string;
  org: string;
  opportunityName: string;
}

/**
 * Changes the assignee of an opportunity after checking permissions.
 *
 * This function verifies that the requesting user has permission to assign the
 * opportunity, then updates the assignee in the database if authorized.
 *
 * @param params - Object containing requestor ID, organization, and opportunity name
 * @param _prevState - Previous form state (unused)
 * @param formData - Form data containing the new assignee
 * @returns Promise resolving to a Result indicating success/failure
 *
 *  @throws Will not throw exceptions, all errors are returned in Result object
 *
 * ## Oso documentation
 * Performs a local authorization check before a write.
 *
 * Error handling:
 * - Returns Result with success=false if authorization fails
 * - Catches and stringifies any database or authorization errors
 * - Always releases database connection in finally block
 */
export async function changeOpportunityAssignee(
  params: ChangeOpportunityAssigneeParams,
  _prevState: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  const { requestor, org, opportunityName } = params;
  const assignee = formData.get("assignee")!;

  const client = await pool.connect();
  try {
    const opportunity = {
      type: "Opportunity" as const,
      id: opportunityName,
    };

    const authQ = await oso.authorizeLocal(
      { type: "User", id: requestor },
      "assign",
      opportunity
    );

    const hasPermission = await client.query(authQ);

    if (!hasPermission) {
      return {
        success: false,
        error: `Not permitted to assign opportunity to ${assignee}`,
      };
    }

    await client.query(
      `UPDATE opportunities 
       SET assignee = $1 
       WHERE organization = $2 AND name = $3`,
      [assignee, org, opportunityName]
    );

    return {
      success: true,
      value: requestor,
    };
  } catch (error) {
    return {
      success: false,
      error: stringifyError(error),
    };
  } finally {
    client.release();
  }
}

interface UpdateOpportunityParams {
  requestor: string;
  org: string;
  opportunityName: string;
}

/**
 * Updates the details of an existing opportunity
 *
 * This server action handles form submissions to update opportunity details, including
 * authorization checks and database updates. It's designed to work with React Server
 * Components and form actions.
 *
 * @param params - Parameters identifying the opportunity and requestor
 * @param params.requestor - Username of the user updating the opportunity
 * @param params.org - Organization ID where the opportunity exists
 * @param params.opportunityName - Name of the opportunity to update
 * @param _prevState - Previous form state (unused)
 * @param formData - Form data containing updated opportunity details
 * @returns Promise resolving to Result indicating success/failure
 *
 * @throws Will not throw exceptions, all errors are returned in Result object
 *
 * ## Form Fields
 * - stage: string - New stage for the opportunity (must be valid stage)
 * - amount: number - Updated monetary value of the opportunity
 *
 * ## Oso Documentation
 * Uses a local authorization check before allowing updates.
 *
 * ## Error Handling
 * - Invalid stages return {success: false, error: string} with validation message
 * - Authorization failures return {success: false, error: string}
 * - Database errors are caught and converted to user-friendly messages
 * - Connection is always released via finally block
 */
export async function updateOpportunityDetails(
  params: UpdateOpportunityParams,
  _prevState: Result<string> | null,
  formData: FormData
): Promise<Result<string>> {
  const client = await pool.connect();

  try {
    const stage = formData.get("stage")! as string;
    const amount = parseFloat(formData.get("amount")! as string) || 0;

    // Validate stage
    if (
      ![
        "research",
        "qualifying",
        "poc",
        "negotiating",
        "closed-won",
        "closed-lost",
      ].includes(stage)
    ) {
      return {
        success: false,
        error: `Invalid stage: ${stage}`,
      };
    }

    // Check authorization
    const authQuery = await oso.authorizeLocal(
      { type: "User", id: params.requestor },
      "change_details",
      { type: "Opportunity", id: params.opportunityName }
    );

    const { rows } = await client.query(authQuery);
    const isAuthorized = rows.length > 0;

    if (!isAuthorized) {
      return {
        success: false,
        error: `Cannot update status of opportunity ${params.opportunityName}`,
      };
    }

    // Update opportunity
    await client.query(
      `UPDATE opportunities 
       SET stage = $1, amount = $2 
       WHERE organization = $3 AND name = $4`,
      [stage, amount, params.org, params.opportunityName]
    );

    return {
      success: true,
      value: params.requestor,
    };
  } catch (error) {
    return {
      success: false,
      error: stringifyError(error),
    };
  } finally {
    client.release();
  }
}

interface SalesReport {
  territory: string;
  revenue: number;
  pipeline: number;
  coverage: number;
}

/**
 * Represents a row in the sales report with key metrics.
 *
 * @property revenue - Total closed/won revenue for the territory
 * @property pipeline - Total value of open opportunities in the pipeline
 * @property coverage - Combined value of revenue and pipeline (revenue + pipeline)
 */
export interface SalesReportRow {
  revenue: number;
  pipeline: number;
  coverage: number;
}

/**
 * Retrieves a sales report showing revenue, pipeline and coverage metrics by
 * territory.
 *
 * This function queries opportunities that the requesting user has permission
 * to view and aggregates their amounts into revenue and pipeline metrics for
 * each territory. The results include the full territory hierarchy path and
 * roll up metrics from child territories to their parents.
 *
 * @param requestor - The ID of the user requesting the sales report
 * @returns Promise resolving to a Map of territory paths to their sales metrics
 * @throws {Error} If there is a database connection or query error
 *
 * ## Oso documentation
 * Leverages a filter to ensure the result contains only opportunities on which
 * the requestor has the `view_amount` permission.
 *
 * ## Error Handling
 * - Database errors are caught, logged to console, and re-thrown to be handled
 *   by caller
 * - Ensures database client is always released via finally block
 * - Returns empty metrics (0) for territories with no viewable opportunities
 * - Only includes territories that have non-zero revenue or pipeline values
 */
export async function getSalesReport(
  requestor: string
): Promise<Map<string, SalesReportRow>> {
  const client = await pool.connect();
  try {
    const oppVar = typedVar("Opportunity");
    const viewableOpps = await oso
      .buildQuery([
        "allow",
        { type: "User", id: requestor },
        "view_amount",
        oppVar,
      ])
      .evaluateLocalFilter("name", oppVar);

    // Query the database
    const result = await pool.query<SalesReport>(`
      SELECT territory, pipeline, revenue, revenue + pipeline AS coverage
      FROM (
          WITH RECURSIVE territory_paths AS (
              SELECT
                  ancestor_id,
                  descendant_id,
                  1 as depth,
                  ARRAY[ancestor_id] as ancestors
              FROM territory_hierarchy
              UNION ALL
              SELECT
                  t.ancestor_id,
                  h.descendant_id,
                  t.depth + 1,
                  t.ancestors || h.ancestor_id
              FROM territory_paths t
              JOIN territory_hierarchy h ON t.descendant_id = h.ancestor_id
          )
          SELECT
              array_to_string(get_ancestors(t.ancestor_id) || ARRAY[t.ancestor_id], ' > ') as territory,
              COALESCE(SUM(CASE WHEN o.stage = 'closed-won' THEN o.amount ELSE 0 END), 0) as revenue,
              COALESCE(SUM(CASE WHEN o.stage NOT IN ('closed-won', 'closed-lost') THEN o.amount ELSE 0 END), 0) as pipeline
          FROM (
              SELECT DISTINCT ancestor_id, descendant_id FROM territory_paths
              UNION
              SELECT name, name FROM territories
          ) t
          LEFT JOIN opportunities o
              ON t.descendant_id = o.territory
              AND ${viewableOpps}
          GROUP BY t.ancestor_id, get_ancestors(t.ancestor_id)
          ORDER BY revenue DESC, territory ASC
      ) AS report WHERE revenue > 0 OR pipeline > 0;`);

    // Convert the results to a Map
    const territoryMap = new Map<string, SalesReportRow>();
    result.rows.forEach((row) => {
      territoryMap.set(row.territory, {
        revenue: row.revenue,
        pipeline: row.pipeline,
        coverage: row.coverage,
      });
    });

    return territoryMap;
  } catch (error) {
    console.error("Error in getSalesReport:", error);
    throw error;
  } finally {
    client.release();
  }
}
