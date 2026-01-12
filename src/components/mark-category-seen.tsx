"use client";

import { useEffect } from "react";

export function MarkCategorySeen({ categoryId }: { categoryId: string }) {
  useEffect(() => {
    try {
      localStorage.setItem(
        `jump:lastSeenCategory:${categoryId}`,
        new Date().toISOString()
      );
    } catch {
      // ignore (private mode, disabled storage, etc.)
    }
  }, [categoryId]);

  return null;
}


