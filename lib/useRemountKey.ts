import { useEffect, useRef, useState } from "react";

/**
 * Returns a key that changes every time `value` changes after the first
 * render. Useful for forcing a child with its own uncontrolled/native form
 * state (e.g. a <select>) to remount and re-read fresh props after a
 * useActionState action completes — native form-reset behavior after an
 * action can desync a <select>'s DOM value from React state without firing
 * onChange, since resetting doesn't dispatch a change event.
 */
export function useRemountKey(value: unknown): number {
  const [remountKey, setRemountKey] = useState(0);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setRemountKey((k) => k + 1);
  }, [value]);

  return remountKey;
}
