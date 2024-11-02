"use client";

import React, { useEffect, useState, CSSProperties } from "react";

import { DatabaseEvents } from "@/lib/dbEvents";
import { stringifyError } from "@/lib/result";

import { UserWOrgPermissions } from "@/actions/user";

import TerritoryAssigner from "./TerritoryAssigner";
import OpportunitiesTable from "./OpportunitiesTable";
import CreateOpportunityForm from "./CreateOpportunityForm";
import {
  getOpportunities,
  getTerritories,
  OpportunityWPermissions,
  TerritoryWPermissions,
} from "@/actions/crm";
import SalesTable from "./SalesTable";

const styles: Record<string, CSSProperties> = {
  tabContainer: {
    borderBottom: "1px solid #e2e8f0",
    marginBottom: "1rem",
  },
  tabList: {
    display: "flex",
    gap: "4px",
    marginBottom: "-1px",
  },
  tab: {
    padding: "0.75rem 1.5rem",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "transparent",
    borderBottom: "none",
    borderRadius: "6px 6px 0 0",
    cursor: "pointer",
    background: "#f8fafc",
    position: "relative",
    transition: "all 0.2s",
  },
  activeTab: {
    background: "white",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "#e2e8f0",
    borderBottom: "1px solid white",
    fontWeight: 600,
    zIndex: 1,
  },
};

interface CrmOverviewProps {
  user: UserWOrgPermissions;
}

type Tab = "opportunities" | "territories";

export const CrmDbEvents = new DatabaseEvents();

const CrmOverview: React.FC<CrmOverviewProps> = ({ user }) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [territories, setTerritories] = useState<TerritoryWPermissions[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityWPermissions[]>(
    []
  );
  const [activeTab, setActiveTab] = useState<Tab>("opportunities");

  const fetchTerritories = async () => {
    const territories = await getTerritories(user.username);
    setTerritories(territories);
  };

  const fetchOpportunities = async () => {
    const opportunities = await getOpportunities(user.username);
    setOpportunities(opportunities);
  };

  useEffect(() => {
    const initUserManager = async () => {
      const unsubscribe = CrmDbEvents.subscribe([
        fetchTerritories,
        fetchOpportunities,
      ]);
      try {
        await Promise.all([fetchTerritories(), fetchOpportunities()]);
      } catch (e) {
        setErrorMessage(stringifyError(e));
      }
      return unsubscribe;
    };

    initUserManager();
  }, [user]);

  const getTabStyle = (isActive: boolean): CSSProperties => ({
    ...styles.tab,
    ...(isActive ? styles.activeTab : {}),
  });

  return (
    <div>
      <h1>{user.username} Opportunities + Territories</h1>
      {errorMessage && (
        <div className="error" role="alert">
          {errorMessage}
        </div>
      )}

      <div style={styles.tabContainer}>
        <div style={styles.tabList}>
          <button
            style={getTabStyle(activeTab === "opportunities")}
            onClick={() => setActiveTab("opportunities")}
            role="tab"
            aria-selected={activeTab === "opportunities"}
            className="tab-button"
          >
            Opportunities
          </button>
          <button
            style={getTabStyle(activeTab === "territories")}
            onClick={() => setActiveTab("territories")}
            role="tab"
            aria-selected={activeTab === "territories"}
            className="tab-button"
          >
            Territories
          </button>
        </div>
      </div>

      {activeTab === "territories" && (
        <TerritoryAssigner
          requestor={user.username}
          territories={territories}
        />
      )}

      {activeTab === "opportunities" && (
        <>
          {user.createOpportunity && (
            <CreateOpportunityForm
              org={user.org}
              requestor={user.username}
              territories={territories}
            />
          )}

          <OpportunitiesTable
            requestor={user.username}
            opportunities={opportunities}
          />

          <SalesTable requestor={user.username} />
        </>
      )}
    </div>
  );
};

export default CrmOverview;
