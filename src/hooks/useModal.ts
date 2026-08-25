import { useCallback, useState } from 'react';

/** Simple modal open/close + optional payload helper. */
export function useModal<T = undefined>(initialOpen = false) {
  const [open, setOpen] = useState(initialOpen);
  const [data, setData] = useState<T | null>(null);

  const show = useCallback((payload?: T) => {
    if (payload !== undefined) setData(payload);
    setOpen(true);
  }, []);

  const hide = useCallback(() => {
    setOpen(false);
    setData(null);
  }, []);

  return { open, data, show, hide, setOpen, setData };
}
