// Açılır pencerelerin (ekle / ayrıntı) tek yönetim noktası.
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AnimatePresence } from 'motion/react';
import type { AgendaItem } from '../../domain/agenda';
import type { PlainDateStr } from '../../domain/types';
import { AddFlow } from './AddFlow';
import { ItemSheet } from './ItemSheet';

export interface AddInit {
  date: PlainDateStr;
  start?: string;
  end?: string;
  kind?: 'event' | 'task';
  /** Düzenleme */
  eventId?: string;
  taskId?: string;
}

type Open = { kind: 'add'; init: AddInit; n: number } | { kind: 'item'; item: AgendaItem; n: number } | null;

interface Sheets {
  openAdd: (init: AddInit) => void;
  openItem: (item: AgendaItem) => void;
  close: () => void;
  goDay?: (d: PlainDateStr) => void;
}

const Ctx = createContext<Sheets>({ openAdd: () => {}, openItem: () => {}, close: () => {} });
export const useSheets = () => useContext(Ctx);

export function SheetHost({ children, goDay }: { children: ReactNode; goDay: (d: PlainDateStr) => void }) {
  const [open, setOpen] = useState<Open>(null);
  const close = useCallback(() => setOpen(null), []);
  const value: Sheets = {
    openAdd: (init) => setOpen({ kind: 'add', init, n: Date.now() }),
    openItem: (item) => setOpen({ kind: 'item', item, n: Date.now() }),
    close,
    goDay,
  };
  return (
    <Ctx.Provider value={value}>
      {children}
      <AnimatePresence>
        {open?.kind === 'add' && <AddFlow key={open.n} init={open.init} onClose={close} />}
        {open?.kind === 'item' && <ItemSheet key={open.n} item={open.item} onClose={close} />}
      </AnimatePresence>
    </Ctx.Provider>
  );
}
