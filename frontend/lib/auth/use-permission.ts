"use client";

import { useEffect, useState } from "react";

import { getAuthMe } from "@/lib/auth";

export function usePermission(permission: string) {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;
    void getAuthMe()
      .then((identity) => {
        if (active) {
          setAllowed(identity.permissions.includes(permission));
        }
      })
      .catch(() => {
        if (active) {
          setAllowed(false);
        }
      });
    return () => {
      active = false;
    };
  }, [permission]);

  return allowed;
}
