import React, { useEffect, useState } from 'react';

const AuditLogsPage = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch('/admin/audit-logs');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setLogs(json.results || json);
      } catch (e: any) {
        setError(e.message || 'Failed to fetch');
      }
    };
    fetchLogs();
  }, []);

  if (error) return <div>Failed to load audit logs: {error}</div>;

  return (
    <div>
      <h1>Audit Logs (preview)</h1>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Action</th>
            <th>Content Type</th>
            <th>Record ID</th>
            <th>User</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l: any, i: number) => (
            <tr key={i}>
              <td>{l.date}</td>
              <td>{l.action}</td>
              <td>{l.contentType}</td>
              <td>{l.recordId}</td>
              <td>{l.userId}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AuditLogsPage;
