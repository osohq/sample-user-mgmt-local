import type { FC, ReactNode } from "react";

import "./globals.css";

type LayoutProps = {
  children?: ReactNode;
};

const Layout: FC<LayoutProps> = ({ children }) => (
  <html lang="en">
    <body>
      <header>
        <h1>User management base</h1>
      </header>
      <main>{children}</main>
    </body>
  </html>
);

export default Layout;
