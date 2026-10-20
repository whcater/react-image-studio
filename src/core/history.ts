import type { EditorDoc } from '../types.js';

/** One point in the undo stack: committed pixels + the overlay document. */
export interface HistorySlot {
  base: HTMLCanvasElement;
  doc: EditorDoc;
}

export interface HistoryState {
  slots: HistorySlot[];
  index: number;
}

/** Upper bound on retained snapshots (bitmaps are shared when unchanged). */
export const HISTORY_LIMIT = 60;

export function createHistory(slot: HistorySlot): HistoryState {
  return { slots: [slot], index: 0 };
}

export function currentSlot(history: HistoryState): HistorySlot {
  return history.slots[history.index];
}

/**
 * Push a snapshot. `merge` replaces the current entry instead of adding one,
 * which is what slider drags and text edits use to stay a single undo step.
 */
export function commit(history: HistoryState, slot: HistorySlot, merge = false): HistoryState {
  if (merge && history.slots.length > 0) {
    const slots = history.slots.slice();
    slots[history.index] = slot;
    return { slots, index: history.index };
  }
  const slots = [...history.slots.slice(0, history.index + 1), slot];
  if (slots.length > HISTORY_LIMIT) {
    slots.splice(0, slots.length - HISTORY_LIMIT);
  }
  return { slots, index: slots.length - 1 };
}

export function undo(history: HistoryState): HistoryState {
  if (history.index <= 0) return history;
  return { slots: history.slots, index: history.index - 1 };
}

export function redo(history: HistoryState): HistoryState {
  if (history.index >= history.slots.length - 1) return history;
  return { slots: history.slots, index: history.index + 1 };
}

export function canUndo(history: HistoryState): boolean {
  return history.index > 0;
}

export function canRedo(history: HistoryState): boolean {
  return history.index < history.slots.length - 1;
}

export function historySize(history: HistoryState): number {
  return history.slots.length;
}
