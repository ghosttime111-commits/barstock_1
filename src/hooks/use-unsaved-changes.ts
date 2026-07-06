import { useEffect } from "react";

import { clearUnsavedChanges, setUnsavedChanges } from "@/lib/unsavedChanges";

export function useUnsavedChanges(source: string, hasChanges: boolean) {
  useEffect(() => {
    setUnsavedChanges(source, hasChanges);
    return () => clearUnsavedChanges(source);
  }, [hasChanges, source]);
}
