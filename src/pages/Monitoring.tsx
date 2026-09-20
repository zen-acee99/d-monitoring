import React from "react";
import { Link } from "react-router-dom";
import { Search, Filter, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PROJECTS } from "@/config/projects";

export function Monitoring() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Project Monitoring</h2>
          <p className="text-text-muted">Detailed view of all active government projects</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-text-muted" />
            <input
              type="search"
              placeholder="Search projects..."
              className="w-full rounded-md border border-border-primary bg-background-secondary pl-9 pr-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 placeholder:text-text-muted"
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {PROJECTS.map((project) => (
          <Card key={project.id} className="flex flex-col hover:border-brand-500/50 transition-colors">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <Badge variant="outline" className="mb-2">{project.category}</Badge>
                <Badge 
                  variant={project.status === 'operational' ? 'success' : project.status === 'warning' ? 'warning' : 'danger'}
                >
                  {project.status}
                </Badge>
              </div>
              <CardTitle className="text-lg">{project.name}</CardTitle>
              <p className="text-sm text-text-muted line-clamp-2 mt-1">{project.description}</p>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border-secondary">
                <div className="flex flex-col">
                  <span className="text-xs text-text-muted mb-1">Health Score</span>
                  <span className="text-lg font-semibold font-mono">
                    {project.status === 'operational' ? '98.5' : project.status === 'warning' ? '87.2' : '45.0'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-text-muted mb-1">Open Alerts</span>
                  <span className="text-lg font-semibold font-mono">
                    {project.status === 'operational' ? '0' : project.status === 'warning' ? '3' : '12'}
                  </span>
                </div>
              </div>
            </CardContent>
            <div className="p-4 border-t border-border-primary bg-background-secondary rounded-b-xl flex justify-end">
              <Link to={`/monitoring/${project.id}`}>
                <Button variant="ghost" size="sm" className="gap-2">
                  View Dashboard <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
