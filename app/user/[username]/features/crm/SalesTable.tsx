import { getSalesReport, SalesReportRow } from "@/actions/crm";
import { stringifyError } from "@/lib/result";
import React, { useEffect, useState } from "react";
import { CrmDbEvents } from "./CrmOverview";

interface SalesTableProps {
  requestor: string;
}

export const SalesTable: React.FC<SalesTableProps> = ({ requestor }) => {
  const [error, setErrorMessage] = useState<string | null>(null);

  const [salesData, setSalesData] = useState<[string, SalesReportRow][]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSalesData = async () => {
    const territoryMap = await getSalesReport(requestor);
    const dataArray = Array.from(territoryMap.entries());
    setSalesData(dataArray);
  };

  useEffect(() => {
    const unsubscribe = CrmDbEvents.subscribe([fetchSalesData]);
    try {
      fetchSalesData();
    } catch (e) {
      setErrorMessage(stringifyError(e));
    }
    setLoading(false);
    return unsubscribe;
  }, [requestor]);

  if (loading) {
    return <div>Loading sales data...</div>;
  }

  if (salesData.length === 0) {
    return <div />;
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Territory Sales Report</h2>
      {error && <div role="alert">{error}</div>}
      <table>
        <thead>
          <tr>
            <th>Territory</th>
            <th>Pipeline</th>
            <th>Revenue</th>
            <th>Coverage</th>
          </tr>
        </thead>
        <tbody>
          {salesData.map(([territory, row]) => (
            <tr key={territory}>
              <td>{territory}</td>
              <td>
                {row.pipeline.toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                })}
              </td>
              <td>
                {row.revenue.toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                })}
              </td>
              <td>
                {row.coverage.toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SalesTable;
