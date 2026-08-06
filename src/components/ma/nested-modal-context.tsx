import { createContext, useContext, useEffect } from "react";

/**
 * Lets a nested Radix Dialog (rendered inside the project Sheet) ask the Sheet
 * to drop its focus trap while the dialog is open. Without this, the Sheet's
 * focus scope steals focus and blocks pointer events on the dialog inputs.
 */
export const NestedModalContext = createContext<
  ((delta: number) => void) | null
>(null);

export function useSuspendParentModal(open: boolean) {
  const register = useContext(NestedModalContext);
  useEffect(() => {
    if (!open || !register) return;
    register(1);
    return () => register(-1);
  }, [open, register]);
}
