// Typescript types reflecting db_init_template.sql
export interface User {
  username: string;
  org: string;
  role: string;
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
