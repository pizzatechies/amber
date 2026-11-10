"use client";

import { useEffect } from "react";
import { markNotificationsReadAction } from "@/server/actions/learning";

/** Marks everything as read a moment after the list has been shown. */
export function MarkRead() {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void markNotificationsReadAction();
    }, 2500);
    return () => window.clearTimeout(timer);
  }, []);
  return null;
}
