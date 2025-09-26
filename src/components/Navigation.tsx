import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Plus, PieChart, Settings, Users } from "lucide-react";
import { useState, useEffect, useRef } from "react";

export type NavigationTab = "dashboard" | "import" | "split" | "reports" | "settings";

interface NavigationProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
}

export const Navigation = ({ activeTab, onTabChange }: NavigationProps) => {
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({});
  const tabsListRef = useRef<HTMLDivElement>(null);
  const tabs = ["dashboard", "split", "import", "reports", "settings"] as const;

  useEffect(() => {
    const updateHighlightPosition = () => {
      if (!tabsListRef.current) return;

      const activeIndex = tabs.indexOf(activeTab);
      const tabWidth = tabsListRef.current.offsetWidth / tabs.length;
      const translateX = activeIndex * tabWidth;

      setHighlightStyle({
        transform: `translateX(${translateX}px)`,
        width: `${tabWidth}px`,
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        backgroundColor: 'hsl(var(--primary))',
        borderRadius: 'calc(var(--radius) - 2px)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 1,
      });
    };

    // Update position immediately
    updateHighlightPosition();

    // Update position on window resize
    const handleResize = () => updateHighlightPosition();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, [activeTab]);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="max-w-md mx-auto px-4 py-2">
        <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as NavigationTab)}>
          <TabsList 
            ref={tabsListRef}
            className="grid w-full grid-cols-5 bg-secondary h-14 relative"
          >
            {/* Animated highlight background */}
            <div style={highlightStyle} />
            
            <TabsTrigger 
              value="dashboard" 
              className="flex-col gap-1 relative z-10 data-[state=active]:text-primary-foreground data-[state=inactive]:text-muted-foreground data-[state=active]:bg-transparent data-[state=inactive]:bg-transparent"
            >
              <BarChart3 className="w-5 h-5" />
              <span className="text-xs">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger 
              value="split" 
              className="flex-col gap-1 relative z-10 data-[state=active]:text-primary-foreground data-[state=inactive]:text-muted-foreground data-[state=active]:bg-transparent data-[state=inactive]:bg-transparent"
            >
              <Users className="w-5 h-5" />
              <span className="text-xs">Split</span>
            </TabsTrigger>
            <TabsTrigger 
              value="import" 
              className="flex-col gap-1 relative z-10 data-[state=active]:text-primary-foreground data-[state=inactive]:text-muted-foreground data-[state=active]:bg-transparent data-[state=inactive]:bg-transparent"
            >
              <Plus className="w-5 h-5" />
              <span className="text-xs">Add</span>
            </TabsTrigger>
            <TabsTrigger 
              value="reports" 
              className="flex-col gap-1 relative z-10 data-[state=active]:text-primary-foreground data-[state=inactive]:text-muted-foreground data-[state=active]:bg-transparent data-[state=inactive]:bg-transparent"
            >
              <PieChart className="w-5 h-5" />
              <span className="text-xs">Reports</span>
            </TabsTrigger>
            <TabsTrigger 
              value="settings" 
              className="flex-col gap-1 relative z-10 data-[state=active]:text-primary-foreground data-[state=inactive]:text-muted-foreground data-[state=active]:bg-transparent data-[state=inactive]:bg-transparent"
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