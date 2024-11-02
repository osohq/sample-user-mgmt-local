import React from "react";
import {
  changeOpportunityAssignee,
  OpportunityWPermissions,
  updateOpportunityDetails,
} from "@/actions/crm";
import { stringifyError } from "@/lib/result";
import { CrmDbEvents } from "./CrmOverview";

const STAGES = [
  "research",
  "qualifying",
  "poc",
  "negotiating",
  "closed-won",
  "closed-lost",
] as const;

interface OpportunityRowProps {
  opportunity: OpportunityWPermissions;
  pendingAmounts: Record<string, number>;
  pendingAssignees: Record<string, string>;
  pendingStages: Record<string, string>;
  onAmountChange: (name: string, amount: number) => void;
  onAssigneeChange: (name: string, assignee: string) => void;
  onStageChange: (name: string, stage: string) => void;
  onSaveDetails: (
    name: string,
    org: string,
    stage: string,
    amount: number
  ) => void;
  onSaveAssignee: (name: string, org: string, assignee: string) => void;
}

const OpportunityRow = ({
  opportunity: opp,
  pendingAmounts,
  pendingAssignees,
  pendingStages,
  onAmountChange,
  onAssigneeChange,
  onStageChange,
  onSaveDetails,
  onSaveAssignee,
}: OpportunityRowProps) => {
  const isClosedStage = opp.stage.includes("closed");
  const canEdit = opp.changeDetails && !isClosedStage;

  return (
    <tr key={opp.name}>
      <td>{opp.name}</td>
      <td>{opp.territory}</td>
      <td>
        {opp.assign && !isClosedStage && opp.potentialAssignees.length > 0 ? (
          <select
            value={pendingAssignees[opp.name] || opp.assignee || ""}
            onChange={(e) => onAssigneeChange(opp.name, e.target.value)}
          >
            <option>Unassigned</option>
            {opp.potentialAssignees.map((assignee) => (
              <option key={assignee} value={assignee}>
                {assignee}
              </option>
            ))}
          </select>
        ) : (
          opp.assignee
        )}
      </td>
      <td>
        {!opp.viewAmount ? (
          "-"
        ) : canEdit ? (
          <input
            type="number"
            value={pendingAmounts[opp.name] ?? opp.amount}
            onChange={(e) =>
              onAmountChange(opp.name, parseFloat(e.target.value) || 0)
            }
          />
        ) : (
          opp.amount
        )}
      </td>
      <td>
        {canEdit ? (
          <select
            value={pendingStages[opp.name] || opp.stage}
            onChange={(e) => onStageChange(opp.name, e.target.value)}
          >
            {STAGES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        ) : (
          opp.stage
        )}
      </td>
      <td>
        <div>
          {opp.assign && !isClosedStage && (
            <button
              onClick={() =>
                onSaveAssignee(
                  opp.name,
                  opp.organization,
                  pendingAssignees[opp.name] ?? opp.assignee
                )
              }
            >
              Save Assignee
            </button>
          )}
          {canEdit && (
            <button
              onClick={() =>
                onSaveDetails(
                  opp.name,
                  opp.organization,
                  pendingStages[opp.name] ?? opp.stage,
                  pendingAmounts[opp.name] ?? opp.amount
                )
              }
            >
              Save Details
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

export const OpportunitiesTable = ({
  requestor,
  opportunities,
}: {
  requestor: string;
  opportunities: OpportunityWPermissions[];
}) => {
  const [error, setError] = React.useState<string | null>(null);
  const [pendingAssignees, setPendingAssignees] = React.useState<
    Record<string, string>
  >({});
  const [pendingStages, setPendingStages] = React.useState<
    Record<string, string>
  >({});
  const [pendingAmounts, setPendingAmounts] = React.useState<
    Record<string, number>
  >({});

  const handleAssigneeChange = async (
    opportunityName: string,
    org: string,
    assignee: string
  ) => {
    const formData = new FormData();
    formData.append("assignee", assignee);

    const result = await changeOpportunityAssignee(
      { requestor, org, opportunityName },
      null,
      formData
    );

    if (result.success) {
      CrmDbEvents.emit();
      setPendingAssignees((prev) => {
        const newAssignees = { ...prev };
        delete newAssignees[opportunityName];
        return newAssignees;
      });
    } else {
      setError(stringifyError(result.error));
    }
  };

  const handleDetailsChange = async (
    opportunityName: string,
    org: string,
    stage: string,
    amount: number
  ) => {
    const formData = new FormData();
    formData.append("stage", stage);
    formData.append("amount", amount.toString());

    const result = await updateOpportunityDetails(
      { requestor, org, opportunityName },
      null,
      formData
    );

    if (result.success) {
      CrmDbEvents.emit();
      setPendingStages((prev) => {
        const newStages = { ...prev };
        delete newStages[opportunityName];
        return newStages;
      });
      setPendingAmounts((prev) => {
        const newAmounts = { ...prev };
        delete newAmounts[opportunityName];
        return newAmounts;
      });
    } else {
      setError(stringifyError(result.error));
    }
  };

  if (!opportunities.length) return null;

  return (
    <div>
      <h2>Opportunities</h2>
      {error && <div role="alert">{error}</div>}
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Territory</th>
            <th>Assignee</th>
            <th>Amount</th>
            <th>Stage</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {opportunities.map((opp) => (
            <OpportunityRow
              key={opp.name}
              opportunity={opp}
              pendingAmounts={pendingAmounts}
              pendingAssignees={pendingAssignees}
              pendingStages={pendingStages}
              onAmountChange={(name, amount) =>
                setPendingAmounts((prev) => ({ ...prev, [name]: amount }))
              }
              onAssigneeChange={(name, assignee) =>
                setPendingAssignees((prev) => ({ ...prev, [name]: assignee }))
              }
              onStageChange={(name, stage) =>
                setPendingStages((prev) => ({ ...prev, [name]: stage }))
              }
              onSaveDetails={handleDetailsChange}
              onSaveAssignee={handleAssigneeChange}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default OpportunitiesTable;
