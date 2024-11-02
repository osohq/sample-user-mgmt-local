"use client";

import React, { useState, useEffect } from "react";
import { useFormState } from "react-dom";

import { stringifyError } from "@/lib/result";
import { assignTerritory, TerritoryWPermissions } from "@/actions/crm";
import { useUsersStore } from "@/lib/users";
import { CrmDbEvents } from "./CrmOverview";

interface TerritoryAssignerProps {
  requestor: string;
  territories: TerritoryWPermissions[];
}

interface TerritoryTree {
  id: string;
  manageResponsibility: boolean;
  children: Record<string, TerritoryTree>;
}

// Helper function to build the tree structure
function buildTree(
  territories: TerritoryWPermissions[]
): Record<string, TerritoryTree> {
  let tree: Record<string, TerritoryTree> = {};
  if (
    territories == undefined ||
    territories == null ||
    territories.length === 0
  ) {
    return tree;
  }

  // Process each territory
  territories.forEach((territory) => {
    const path = [...territory.ancestors, territory.name];
    let currentLevel = tree;

    // Build the path through the tree
    path.forEach((name, index) => {
      if (!currentLevel[name]) {
        // Create new node if it doesn't exist
        currentLevel[name] = {
          id: name,
          manageResponsibility: false, // Default value
          children: {},
        };
      }

      // If this is the target territory (last in path), set its permissions
      if (index === path.length - 1) {
        currentLevel[name].manageResponsibility =
          territory.manageResponsibility;
      }

      // Move to next level
      currentLevel = currentLevel[name].children;
    });
  });

  return tree;
}

const renderTree = (
  node: Record<string, TerritoryTree>,
  selectedValue: string | null,
  setSelectedTerritory: React.Dispatch<React.SetStateAction<string | null>>,
  path: string[] = []
) => {
  return (
    <ul className="list-none pl-4">
      {Object.entries(node).map(([key, territory]) => {
        const currentPath = [...path, key];
        const manageable = territory.manageResponsibility;

        return (
          <li key={key} className="my-1">
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="territory"
                value={key}
                disabled={!manageable}
                onChange={(e) => setSelectedTerritory(e.target.value)}
                onClick={(e) => {
                  if (selectedValue === key) {
                    e.preventDefault();
                    setSelectedTerritory(null);
                  }
                }}
                checked={selectedValue === key}
                className="form-radio"
              />
              <span>{territory.id}</span>
            </label>
            {Object.keys(territory.children).length > 0 &&
              renderTree(
                territory.children,
                selectedValue,
                setSelectedTerritory,
                currentPath
              )}
          </li>
        );
      })}
    </ul>
  );
};

const TerritoryAssigner: React.FC<TerritoryAssignerProps> = ({
  requestor,
  territories,
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedTerritory, setSelectedTerritory] = useState<string | null>(
    null
  );

  const globalUsers = useUsersStore((state) => state.users);

  const [selectedUser, setSelectedUser] = useState<{
    username: string;
    org: string;
  } | null>(null);

  const assignTerritoryWRequestor = assignTerritory.bind(null, {
    requestor,
  });
  const [assignTerritoryState, assignTerritoryAction] = useFormState(
    assignTerritoryWRequestor,
    null
  );

  useEffect(() => {
    // Narrow from null
    if (!assignTerritoryState) {
      return;
    }

    if (assignTerritoryState.success) {
      setErrorMessage(null);
      CrmDbEvents.emit();
    } else if (!assignTerritoryState.success) {
      setErrorMessage(assignTerritoryState.error);
    }
  }, [assignTerritoryState]);

  const territoryTree = buildTree(territories);

  return (
    <div>
      {territories.some((terr) => terr.manageResponsibility) && (
        <>
          <h3>Territories</h3>
          {errorMessage && (
            <div className="error" role="alert">
              {errorMessage}
            </div>
          )}

          <form action={assignTerritoryAction}>
            <label htmlFor="userSelect">Select User:</label>
            <select
              id="userSelect"
              name="user"
              value={selectedUser ? JSON.stringify(selectedUser) : ""}
              onChange={(e) => {
                const data = JSON.parse(e.target.value);
                setSelectedUser(data);
              }}
            >
              <option value="" disabled>
                Select a user
              </option>
              {globalUsers
                .filter((user) => user.assignTerritory)
                .map((user) => (
                  <option
                    key={user.username}
                    value={JSON.stringify({
                      username: user.username,
                      org: user.org,
                    })}
                  >
                    {user.username}
                  </option>
                ))}
            </select>
            {renderTree(territoryTree, selectedTerritory, setSelectedTerritory)}
            <button
              type="submit"
              disabled={!selectedUser || !selectedTerritory}
            >
              Assign Territory
            </button>
          </form>
        </>
      )}
    </div>
  );
};

export default TerritoryAssigner;
