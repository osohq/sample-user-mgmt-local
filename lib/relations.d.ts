// Typescript types reflecting db_init_template.sql
export interface User {
  username: string;
  org: string;
  role: string;
  manager: string | undefined;
}

export interface Org {
  name: string;
}

export interface Role {
  name: string;
}

export interface Document {
  id: number;
  org: string;
  title: string;
  public: boolean;
}

export interface DocumentUserRole {
  id: number;
  username: string;
  role: string;
}

export interface Appointment {
  id: number;
  org: string;
  medical_staff: string;
  patient: string;
  scheduled_at: Date;
  status: string;
}

export interface Record {
  id: number | null;
  appointment_id: number;
  internal_text: string | null;
  public_text: string;
}

export interface Territory {
  name: string;
}

export interface QualifiedTerritory extends Territory {
  ancestors: string[];
}

export interface Opportunity {
  organization: string;
  name: string;
  territory: string[];
  amount: number;
  assignee?: string;
  stage:
    | "research"
    | "qualifying"
    | "poc"
    | "negotiating"
    | "closed-won"
    | "closed-lost";
}
