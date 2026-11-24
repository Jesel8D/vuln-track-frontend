import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";

/** Keyboard behavior for the two existing inventory dialogs. */
export function useDialogFocus(
  open: boolean,
  setOpen: Dispatch<SetStateAction<boolean>>,
) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const previous = document.activeElement;
    const controls = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
        ),
      ).filter((element) => !element.hidden);
    (dialog.querySelector<HTMLElement>("input") ?? controls()[0])?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key === "Tab") {
        const items = controls();
        const first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    dialog.addEventListener("keydown", keydown);
    return () => {
      dialog.removeEventListener("keydown", keydown);
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, [open, setOpen]);
  return ref;
}
