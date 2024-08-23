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
