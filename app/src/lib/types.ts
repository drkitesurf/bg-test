export type Identifier = string;
export type IsoDate = string;
export type CurrencyCode = 'BGN' | 'EUR' | 'USD' | (string & {});

export interface Account {
  id: Identifier;
  mode: 'home' | 'business';
  name: string;
}

export interface Property {
  id: Identifier;
  account_id: Identifier;
  name: string;
  synthetic?: boolean;
}

export interface Space {
  id: Identifier;
  property_id: Identifier;
  name: string;
}

export interface Container {
  id: Identifier;
  parent_id: Identifier;
  name: string;
}

export interface Item {
  id: Identifier;
  parent_id: Identifier;
  name: string;
  brand?: string | null;
  model?: string | null;
  category?: string | null;
  quantity?: number | null;
  ai?: {
    extracted_attrs: Record<string, unknown>;
    confidence: number;
    confirmed: boolean;
  };
}

export interface Trip {
  id: Identifier;
  destination: string;
  starts_at: IsoDate;
  ends_at: IsoDate;
  purpose: string[];
}

export interface PackList {
  id: Identifier;
  trip_id: Identifier;
}

export interface PackItem {
  id: Identifier;
  pack_list_id: Identifier;
  item_ref: Identifier;
  status: 'suggested' | 'confirmed' | 'packed' | 'returned' | 'lost';
}

export interface Bill {
  id: Identifier;
  property_ref?: Identifier;
  payee: string;
  currency: CurrencyCode;
  cadence: string;
}

export interface BillInstance {
  id: Identifier;
  bill_id: Identifier;
  period: string;
  amount: number;
  due: IsoDate;
  status: 'upcoming' | 'due' | 'paid' | 'overdue';
}

export interface Budget {
  id: Identifier;
  scope: 'account' | 'property';
  category: string;
  period: string;
  planned: number;
}

export interface Expense {
  id: Identifier;
  amount: number;
  currency: CurrencyCode;
  category: string;
  property_ref?: Identifier;
  item_ref?: Identifier;
  booking_ref?: Identifier;
}

export interface FxRate {
  currency: CurrencyCode;
  date: IsoDate;
  rate: number;
}

export interface Booking {
  id: Identifier;
  property_ref: Identifier;
  source: 'manual' | 'ical' | 'direct';
  starts_at: IsoDate;
  ends_at: IsoDate;
  status: string;
}

export interface Guest {
  id: Identifier;
  language: string;
  retention_policy: string;
}

export interface GuestLink {
  id: Identifier;
  booking_ref: Identifier;
  expires_at: IsoDate;
}

export interface TurnoverTask {
  id: Identifier;
  booking_ref: Identifier;
  checklist: string[];
}

export interface GuestRequest {
  id: Identifier;
  booking_ref: Identifier;
  text: string;
  status: string;
}

export interface PropertyGuide {
  id: Identifier;
  property_ref: Identifier;
  sections: Array<{ title: string; content: string }>;
}

export interface EventEnvelope<T extends Record<string, unknown> = Record<string, unknown>> {
  verb: string;
  entity_id: Identifier;
  payload: T;
}
