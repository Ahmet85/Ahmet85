// Açılır pencerelerin (ekle / ayrıntı) tek yönetim noktası.
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AnimatePresence } from 'motion/react';
import type { AgendaItem } from '../../domain/agenda';
import type { PlainDateStr } from '../../domain/types';
import { AddFlow } from './AddFlow';
import { ItemSheet } from './ItemSheet';
import { MoveFlow, type MoveTo } from './MoveFlow';
import { RoutineForm } from './RoutineForm';
import { ReplanFlow } from './ReplanFlow';
import { Sheet } from '../Sheet';
import { useT } from '../../i18n/i18n';
import { useStore } from '../store';

export interface AddInit {
  date: PlainDateStr;
  start?: string;
  end?: string;
  kind?: 'event' | 'task';
  /** Düzenleme */
  eventId?: string;
  taskId?: string;
}

type Open =
  | { kind: 'add'; init: AddInit; n: number }
  | { kind: 'item'; item: AgendaItem; n: number }
  | { kind: 'move'; item: AgendaItem; to?: MoveTo; n: number }
  | { kind: 'routine'; routineId: string; n: number }
  | { kind: 'replan'; n: number }
  | null;

interface Sheets {
  openAdd: (init: AddInit) => void;
  openItem: (item: AgendaItem) => void;
  openMove: (item: AgendaItem, to?: MoveTo) => void;
  openRoutine: (routineId: string) => void;
  openReplan: () => void;
  close: () => void;
  goDay?: (d: PlainDateStr) => void;
}

const noop = () => {};
const Ctx = createContext<Sheets>({ openAdd: noop, openItem: noop, openMove: noop, openRoutine: noop, openReplan: noop, close: noop });
export const useSheets = () => useContext(Ctx);

export function SheetHost({ children, goDay }: { children: ReactNode; goDay: (d: PlainDateStr) => void }) {
  const [open, setOpen] = useState<Open>(null);
  const close = useCallback(() => setOpen(null), []);
  const value: Sheets = {
    openAdd: (init) => setOpen({ kind: 'add', init, n: Date.now() }),
    openItem: (item) => setOpen({ kind: 'item', item, n: Date.now() }),
    openMove: (item, to) => setOpen({ kind: 'move', item, to, n: Date.now() }),
    openRoutine: (routineId) => setOpen({ kind: 'routine', routineId, n: Date.now() }),
    openReplan: () => setOpen({ kind: 'replan', n: Date.now() }),
    close,
    goDay,
  };
  return (
    <Ctx.Provider value={value}>
      {children}
      <AnimatePresence>
        {open?.kind === 'add' && <AddFlow key={open.n} init={open.init} onClose={close} />}
        {open?.kind === 'item' && <ItemSheet key={open.n} item={open.item} onClose={close} />}
        {open?.kind === 'move' && <MoveFlow key={open.n} item={open.item} to={open.to} onClose={close} />}
        {open?.kind === 'replan' && <ReplanFlow key={open.n} onClose={close} />}
        {open?.kind === 'routine' && <RoutineSheet key={open.n} routineId={open.routineId} onClose={close} />}
      </AnimatePresence>
    </Ctx.Provider>
  );
}

function RoutineSheet({ routineId, onClose }: { routineId: string; onClose: () => void }) {
  const { t } = useT();
  const { data } = useStore();
  const r = data.routines.find((x) => x.id === routineId);
  return (
    <Sheet title={t('routine.editTitle')} onClose={onClose}>
      {r ? <RoutineForm routine={r} onDone={onClose} /> : null}
    </Sheet>
  );
}
