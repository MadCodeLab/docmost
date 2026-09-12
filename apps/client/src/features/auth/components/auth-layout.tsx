import React from "react";
import { Group } from "@mantine/core";
import classes from "./auth.module.css";

type AuthLayoutProps = {
  children: React.ReactNode;
};

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <>
      <Group justify="center" gap={8} className={classes.logo}>
        <img
          src="/icons/hql-global-logo.png?v=3"
          alt="HQL Global"
          style={{ height: "54px", maxWidth: "260px", objectFit: "contain", userSelect: "none" }}
        />
      </Group>
      <main>{children}</main>
    </>
  );
}
