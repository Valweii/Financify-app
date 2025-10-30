import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, ArrowRight, Plus, Trash2 } from "lucide-react";
import { Person } from "@/types/split-bill";

interface AddPeopleScreenProps {
  people: Person[];
  myPersonId: string | null;
  onAddPerson: (name: string) => void;
  onRemovePerson: (id: string) => void;
  onBack: () => void;
  onContinue: () => void;
  progressAnimation: 'forward' | 'backward' | null;
  progressFrom: number;
  progressTo: number;
}

export const AddPeopleScreen = ({
  people,
  myPersonId,
  onAddPerson,
  onRemovePerson,
  onBack,
  onContinue,
  progressAnimation,
  progressFrom,
  progressTo,
}: AddPeopleScreenProps) => {
  const [isAddPersonOpen, setIsAddPersonOpen] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");

  const handleAddPerson = () => {
    const trimmed = newPersonName.trim();
    if (!trimmed) return;
    onAddPerson(trimmed);
    setNewPersonName("");
    setIsAddPersonOpen(false);
  };

  return (
    <div className="flex flex-col space-y-6">
      <div className="space-y-2">
        <h1 className="text-responsive-2xl font-bold">Split Bill</h1>
        <p className="text-muted-foreground">Step 2 of 4</p>
      </div>

      <div className="space-y-6">
        {/* Header with back button and progress */}
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-all duration-200 active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex-1 mx-4">
            <div className="w-full bg-secondary rounded-full h-2">
              <div 
                className={`bg-primary h-2 rounded-full progress-bar-fill ${
                  progressAnimation === 'forward' ? 'progress-bar-fill-forward' : 
                  progressAnimation === 'backward' ? 'progress-bar-fill-backward' : ''
                }`}
                style={{ 
                  width: progressAnimation ? 'var(--progress-to)' : '50%',
                  '--progress-from': `${progressFrom}%`,
                  '--progress-to': `${progressTo}%`
                } as React.CSSProperties}
              ></div>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-1">Step 2 of 4</p>
          </div>
          <div className="w-16"></div>
        </div>

        {/* Main content */}
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold">Add People</h2>
            <p className="text-muted-foreground">Who's splitting this bill?</p>
          </div>

          <Card className="financial-card p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">People</h3>
              <Dialog open={isAddPersonOpen} onOpenChange={setIsAddPersonOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="btn-primary transition-transform duration-150 active:scale-95">
                    <Plus className="w-4 h-4 mr-1" /> Add Person
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Person</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3 py-2">
                    <div>
                      <label className="text-sm text-muted-foreground">Name</label>
                      <Input 
                        value={newPersonName} 
                        onChange={(e) => setNewPersonName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddPerson();
                          }
                        }}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleAddPerson} className="btn-primary transition-transform duration-150 active:scale-95">Save</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {people.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No people added yet</p>
              )}
              {people.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="font-medium truncate">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.id !== myPersonId && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => onRemovePerson(p.id)} 
                        className="text-destructive hover:text-destructive transition-transform duration-150 active:scale-95"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Continue button */}
          <Button 
            onClick={onContinue}
            className="w-full btn-primary transition-transform duration-150 hover:scale-[.98] active:scale-95"
            disabled={people.length === 0}
          >
            Continue to Items
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
};

