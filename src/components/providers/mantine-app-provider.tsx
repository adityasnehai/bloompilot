"use client";

import { MantineProvider, createTheme } from "@mantine/core";

const theme = createTheme({
  primaryColor: "green",
  defaultRadius: "md",
  fontFamily: "var(--font-accent-ui)",
  headings: {
    fontFamily: "var(--font-display-ui)",
  },
});

export function MantineAppProvider({ children }: { children: React.ReactNode }) {
  return <MantineProvider theme={theme}>{children}</MantineProvider>;
}
