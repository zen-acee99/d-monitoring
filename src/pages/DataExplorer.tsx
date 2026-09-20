import React, { useState } from "react";
import { Search, Download, Code, Table as TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PROJECTS } from "@/config/projects";

const RAW_DATA = [
  { id: "log-1", project: "Free WiFi 4 All", region: "Bicol", metric: "connected_users", value: 1284, timestamp: "2026-08-18T10:30:00Z", status: "operational", source: "node-bcl-01" },
  { id: "log-2", project: "GovNet", region: "NCR", metric: "bandwidth_utilization", value: 85.2, timestamp: "2026-08-18T10:29:45Z", status: "warning", source: "core-ncr-main" },
  { id: "log-3", project: "eGOVPH", region: "Central Visayas", metric: "response_time_ms", value: 142, timestamp: "2026-08-18T10:29:10Z", status: "operational", source: "api-gw-cv" },
  { id: "log-4", project: "Cybersecurity", region: "National", metric: "threats_blocked", value: 12, timestamp: "2026-08-18T10:28:55Z", status: "operational", source: "ids-core" },
  { id: "log-5", project: "Emergency Communication", region: "CAR", metric: "node_availability", value: 0, timestamp: "2026-08-18T10:25:00Z", status: "critical", source: "relay-car-03" },
];

export function DataExplorer() {
  const [viewMode, setViewMode] = useState<"table" | "json">("table");
  const [selectedProject, setSelectedProject] = useState("all");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Data Explorer</h2>
          <p className="text-text-muted">Inspect, filter, and export raw monitoring telemetry</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><Download className="mr-2 h-4 w-4" /> Export Data</Button>
        </div>
      </div>

      <Card>
        <div className="border-b border-border-primary p-4 flex flex-col md:flex-row gap-4 justify-between items-center bg-background-secondary rounded-t-xl">
          <div className="flex gap-2 w-full md:w-auto">
            <select 
              className="bg-background-tertiary border border-border-primary rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
            >
              <option value="all">All Projects</option>
              {PROJECTS.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-text-muted" />
              <input
                type="search"
                placeholder="Search raw data..."
                className="w-full rounded-md border border-border-primary bg-background-tertiary pl-9 pr-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 placeholder:text-text-muted"
              />
            </div>
          </div>
          
          <div className="flex bg-background-tertiary border border-border-primary rounded-md p-1">
            <button 
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${viewMode === 'table' ? 'bg-background-secondary text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
            >
              <TableIcon className="h-4 w-4" /> Table
            </button>
            <button 
              onClick={() => setViewMode("json")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${viewMode === 'json' ? 'bg-background-secondary text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
            >
              <Code className="h-4 w-4" /> JSON
            </button>
          </div>
        </div>

        <CardContent className="p-0">
          {viewMode === "table" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-text-muted uppercase bg-background-tertiary border-b border-border-primary">
                  <tr>
                    <th className="px-6 py-4">Timestamp</th>
                    <th className="px-6 py-4">Project</th>
                    <th className="px-6 py-4">Region</th>
                    <th className="px-6 py-4">Metric</th>
                    <th className="px-6 py-4 text-right">Value</th>
                    <th className="px-6 py-4">Source</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {RAW_DATA.map((row) => (
                    <tr key={row.id} className="border-b border-border-secondary hover:bg-background-tertiary/50">
                      <td className="px-6 py-4 font-mono text-text-muted whitespace-nowrap">{row.timestamp}</td>
                      <td className="px-6 py-4 font-medium text-text-primary">{row.project}</td>
                      <td className="px-6 py-4">{row.region}</td>
                      <td className="px-6 py-4 font-mono text-xs text-brand-300">{row.metric}</td>
                      <td className="px-6 py-4 text-right font-mono">{row.value}</td>
                      <td className="px-6 py-4 text-text-muted">{row.source}</td>
                      <td className="px-6 py-4">
                        <Badge variant={row.status === 'operational' ? 'success' : row.status === 'warning' ? 'warning' : 'danger'}>
                          {row.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 bg-background-primary rounded-b-xl overflow-x-auto">
              <pre className="text-sm font-mono text-text-secondary">
                <code dangerouslySetInnerHTML={{ __html: syntaxHighlight(JSON.stringify(RAW_DATA, null, 2)) }} />
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Simple JSON syntax highlighter
function syntaxHighlight(json: string) {
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
    let cls = 'text-brand-400';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'text-text-primary font-semibold';
      } else {
        cls = 'text-status-green';
      }
    } else if (/true|false/.test(match)) {
      cls = 'text-status-yellow';
    } else if (/null/.test(match)) {
      cls = 'text-status-red';
    }
    return '<span class="' + cls + '">' + match + '</span>';
  });
}
