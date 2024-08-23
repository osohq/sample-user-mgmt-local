// app/layout.tsx
import { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>
          <h1>User management base</h1>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
