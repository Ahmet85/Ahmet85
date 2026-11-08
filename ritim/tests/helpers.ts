import type { Flexibility, Routine, RecurrenceRule } from '../src/domain/types';

export const FLEX: Flexibility = {
  timing: 'flexible', priority: 'medium', shortenable: true, movable: true, protected: false,
};

export function routine(partial: Omit<Partial<Routine>, 'recurrence'> & { recurrence?: Partial<RecurrenceRule> } = {}): Routine {
  const { recurrence, ...rest } = partial;
  return {
    id: 'r1',
    profileId: 'p1',
    title: 'Gitar',
    startTime: '20:00',
    durationMin: 60,
    flex: FLEX,
    shortVersions: [],
    ...rest,
    recurrence: { freq: 'daily', interval: 1, startDate: '2026-03-02', ...recurrence },
  };
}
