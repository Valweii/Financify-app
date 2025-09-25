import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Plus, PieChart, Settings, Users } from "lucide-react";
import { useState } from "react";

export type NavigationTab = "dashboard" | "import" | "split" | "reports" | "settings";

interface NavigationProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
}

export const Navigation = ({ activeTab, onTabChange }: NavigationProps) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="max-w-md mx-auto px-4 py-2">
        <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as NavigationTab)}>
          <TabsList className="grid w-full grid-cols-5 bg-secondary h-14">
            <TabsTrigger 
              value="dashboard" 
              className="flex-col gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <BarChart3 className="w-5 h-5" />
              <span className="text-xs">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger 
              value="split" 
              className="flex-col gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Users className="w-5 h-5" />
              <span className="text-xs">Split</span>
            </TabsTrigger>
            <TabsTrigger 
              value="import" 
              className="flex-col gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Plus className="w-5 h-5" />
              <span className="text-xs">Add</span>
            </TabsTrigger>
            <TabsTrigger 
              value="reports" 
              className="flex-col gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <PieChart className="w-5 h-5" />
              <span className="text-xs">Reports</span>
            </TabsTrigger>
            <TabsTrigger 
              value="settings" 
              className="flex-col gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Settings className="w-5 h-5" />
              <span className="text-xs">Settings</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
};