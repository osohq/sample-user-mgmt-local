"use client";

import React, { useState, useEffect } from "react";
import { useFormState } from "react-dom";

import { SubmitButton } from "@/lib/components";
import { canCreateOrg, createOrg, getCreateUserOrgs } from "@/actions/org";

import UserCreator from "../users/UserCreator";
import { stringifyError } from "@/lib/result";

import { OrgDbEvents } from "./UserOverview";

interface OrgCreatorProps {
  requestor: string;
}

/**
 * Provides a component to create new organizations, and users, as well as
 * manage permitted users.
 *
 * When rendering components, this is the root.
 *
 * This component creates organizations, which it passes to `UserCreator`.
 */
const OrgCreator: React.FC<OrgCreatorProps> = ({ requestor }) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [createOrgsPerm, setCreateOrgsPerm] = useState<boolean>(false);

  // We need to provide the username of the user creating the new org to ensure
  // they're permitted to do so.
  const createOrgWithCreator = createOrg.bind(null, { requestor });
  const [formState, formAction] = useFormState(createOrgWithCreator, null);

  // Determine if user can create organizations.
  useEffect(() => {
    const initializeCreateOrgFormState = async () => {
      try {
        const canCreateOrgs = await canCreateOrg(requestor);
        setCreateOrgsPerm(canCreateOrgs);
      } catch (e) {
        setErrorMessage(stringifyError(e));
      }
    };
    initializeCreateOrgFormState();
  }, []);

  // Whenever creating new orgs, update the orgs.
  useEffect(() => {
    if (!formState) {
      return;
    }
    if (formState.success) {
      OrgDbEvents.emit();
      // Re-render form after successful submission.
      setFormKey((prevKey) => prevKey + 1);
    } else {
      setErrorMessage(formState.error);
    }
  }, [formState]);

  // Triggers re-build of form to reset fields.
  const [formKey, setFormKey] = useState<number>(0);

  return (
    <div>
      {createOrgsPerm && <h3>Create orgs</h3>}
      {errorMessage && (
        <div className="error" role="alert">
          {errorMessage}
        </div>
      )}

      {createOrgsPerm && (
        <>
          {errorMessage && (
            <div className="error" role="alert">
              {errorMessage}
            </div>
          )}
          <form action={formAction} key={formKey}>
            <div>
              <label htmlFor="orgName">Name:</label>
              <input id="orgName" type="text" name="orgName" required />
            </div>
            <SubmitButton action="Add org" />
          </form>
        </>
      )}
    </div>
  );
};

export default OrgCreator;
