import * as React from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Input } from "./input";

interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  options: Array<{
    value: string;
    label: string;
    icon?: string;
  }>;
  className?: string;
  triggerClassName?: string;
}

export const SearchableSelect = React.forwardRef<
  HTMLButtonElement,
  SearchableSelectProps
>(({ value, onValueChange, placeholder = "Select option", options, className, triggerClassName }, ref) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(-1);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Filter options based on search query
  const filteredOptions = React.useMemo(() => {
    if (!searchQuery.trim()) return options;
    return options.filter(option =>
      option.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      option.value.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [options, searchQuery]);

  // Get selected option
  const selectedOption = options.find(option => option.value === value);

  // Handle keyboard navigation
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && filteredOptions[selectedIndex]) {
          onValueChange(filteredOptions[selectedIndex].value);
          setIsOpen(false);
          setSearchQuery("");
          setSelectedIndex(-1);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchQuery("");
        setSelectedIndex(-1);
        triggerRef.current?.focus();
        break;
    }
  }, [isOpen, filteredOptions, selectedIndex, onValueChange]);

  // Handle option click
  const handleOptionClick = (optionValue: string) => {
    onValueChange(optionValue);
    setIsOpen(false);
    setSearchQuery("");
    setSelectedIndex(-1);
  };

  // Reset selected index when search changes
  React.useEffect(() => {
    setSelectedIndex(-1);
  }, [searchQuery]);

  // Scroll selected item into view
  React.useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Focus search input when dropdown opens
  React.useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  return (
    <div className={cn("relative", className)}>
      {/* Trigger Button */}
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        className={cn(
          "w-full justify-between h-12 rounded-2xl text-left font-normal",
          triggerClassName
        )}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="flex items-center gap-2 truncate">
          {selectedOption?.icon && <span>{selectedOption.icon}</span>}
          <span className="truncate">
            {selectedOption?.label || placeholder}
          </span>
        </span>
        <ChevronDown className={cn(
          "h-4 w-4 opacity-50 transition-transform",
          isOpen && "rotate-180"
        )} />
      </Button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-background/95 border border-border rounded-md shadow-lg backdrop-blur-sm">
          {/* Search Input */}
          <div className="p-2 border-b border-border bg-muted/30">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search categories..."
                className="pl-10 h-8 text-sm bg-background/50 border-primary/20 focus:border-primary/40"
                onKeyDown={handleKeyDown}
              />
            </div>
          </div>

          {/* Options List */}
          <div
            ref={listRef}
            className="max-h-60 overflow-y-auto p-1"
            role="listbox"
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => (
                <div
                  key={option.value}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm rounded-sm cursor-pointer transition-colors",
                    "hover:bg-primary/10 hover:text-primary",
                    index === selectedIndex && "bg-primary/10 text-primary",
                    option.value === value && "bg-primary/20 text-primary font-medium"
                  )}
                  onClick={() => handleOptionClick(option.value)}
                  role="option"
                  aria-selected={option.value === value}
                >
                  {option.icon && <span>{option.icon}</span>}
                  <span className="truncate">{option.label}</span>
                  {option.value === value && (
                    <Check className="ml-auto h-4 w-4 text-primary" />
                  )}
                </div>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                No categories found
              </div>
            )}
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setIsOpen(false);
            setSearchQuery("");
            setSelectedIndex(-1);
          }}
        />
      )}
    </div>
  );
});

SearchableSelect.displayName = "SearchableSelect";
