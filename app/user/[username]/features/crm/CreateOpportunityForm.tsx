import React, { useState, useEffect } from "react";
import { useFormState } from "react-dom";

import { createOpportunity, TerritoryWPermissions } from "@/actions/crm";
import { CrmDbEvents } from "./CrmOverview";

interface CreateOpportunityFormProps {
  requestor: string;
  org: string;
  territories: TerritoryWPermissions[];
}

export const CreateOpportunityForm: React.FC<CreateOpportunityFormProps> = ({
  requestor,
  org,
  territories,
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createOpportunityWRequestor = createOpportunity.bind(null, {
    requestor,
    org,
  });

  const [createOpportunityState, createOpportunityAction] = useFormState(
    createOpportunityWRequestor,
    null
  );

  useEffect(() => {
    // Narrow from null
    if (!createOpportunityState) {
      return;
    }

    if (createOpportunityState.success) {
      setErrorMessage(null);
      CrmDbEvents.emit();
    } else if (!createOpportunityState.success) {
      setErrorMessage(createOpportunityState.error);
    }
  }, [createOpportunityState]);

  const getFullTerritoryName = (territory: (typeof territories)[0]) => {
    return territory.ancestors.length > 0
      ? `${territory.ancestors.join(" > ")} > ${territory.name}`
      : territory.name;
  };

  return (
    <div>
      <h2>Create New Opportunity</h2>
      {errorMessage && <div role="alert">{errorMessage}</div>}
      <form action={createOpportunityAction}>
        <div>
          <label htmlFor="opportunity_name">Opportunity Name:</label>
          <input
            type="text"
            id="opportunity_name"
            name="opportunity_name"
            required
          />
        </div>

        <div>
          <label htmlFor="territory">Territory:</label>
          <select name="territory">
            <option value="">Select territory</option>
            {territories
              .filter((terr) => terr.createOpportunity)
              .map((terr) => (
                <option key={terr.name} value={terr.name}>
                  {getFullTerritoryName(terr)}
                </option>
              ))}
          </select>
        </div>

        <button type="submit">Create Opportunity</button>
      </form>
    </div>
  );
};

export default CreateOpportunityForm;
