// Shared types for split bill feature

export type Person = { 
  id: string; 
  name: string;
};

export type Item = {
  id: string;
  name: string;
  price_cents: number;
  participants: string[]; // person ids
};

export type PersonTotal = {
  subtotal_cents: number;
  tax_cents: number;
  service_cents: number;
  total_cents: number;
  shares: {
    itemId: string;
    name: string;
    share_cents: number;
  }[];
};

export type PersonTotals = Record<string, PersonTotal>;

export type SplitBillStep = -1 | 0 | 1 | 2 | 3;

