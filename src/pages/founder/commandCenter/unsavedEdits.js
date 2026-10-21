// Unsaved edits inside the salesperson pop-up (founder 2026-10-21): a click outside the pop-up must never discard them.
// Each editable section reports whether it holds an unsaved edit; the pop-up ignores outside clicks while any does.
// The explicit × keeps closing. Outside the pop-up (no provider) this is a no-op.
import { createContext, useContext, useEffect } from "react";

export const UnsavedEditsContext = createContext(null);

export function useUnsavedEdit(key, dirty) {
  const report = useContext(UnsavedEditsContext);
  useEffect(() => {
    if (!report) return undefined;
    report(key, Boolean(dirty));
    return () => report(key, false);
  }, [report, key, dirty]);
}
