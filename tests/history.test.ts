import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HISTORY_LIMIT,
  canRedo,
  canUndo,
  commit,
  createHistory,
  currentSlot,
  historySize,
  redo,
  undo,
} from '../src/core/history.js';
import { initialDoc } from '../src/core/doc.js';
import type { EditorDoc } from '../src/types.js';

const base = { width: 100, height: 50 } as unknown as HTMLCanvasElement;
const slot = (name: string) => ({ base, doc: { ...initialDoc(base), preset: name } as EditorDoc });

test('a fresh history has one entry and no undo', () => {
  const history = createHistory(slot('a'));
  assert.equal(historySize(history), 1);
  assert.equal(canUndo(history), false);
  assert.equal(canRedo(history), false);
  assert.equal(currentSlot(history).doc.preset, 'a');
});

test('commit, undo and redo walk the stack', () => {
  let history = createHistory(slot('a'));
  history = commit(history, slot('b'));
  history = commit(history, slot('c'));
  assert.equal(historySize(history), 3);
  assert.equal(currentSlot(history).doc.preset, 'c');

  history = undo(history);
  assert.equal(currentSlot(history).doc.preset, 'b');
  assert.equal(canRedo(history), true);

  history = redo(history);
  assert.equal(currentSlot(history).doc.preset, 'c');
});

test('committing after an undo drops the redo branch', () => {
  let history = createHistory(slot('a'));
  history = commit(history, slot('b'));
  history = undo(history);
  history = commit(history, slot('c'));
  assert.equal(historySize(history), 2);
  assert.equal(currentSlot(history).doc.preset, 'c');
  assert.equal(canRedo(history), false);
});

test('merge replaces the current entry instead of pushing a new one', () => {
  let history = createHistory(slot('a'));
  history = commit(history, slot('b'), true);
  history = commit(history, slot('c'), true);
  assert.equal(historySize(history), 1);
  assert.equal(currentSlot(history).doc.preset, 'c');
});

test('undo and redo are no-ops at the ends', () => {
  const history = createHistory(slot('a'));
  assert.equal(undo(history), history);
  assert.equal(redo(history), history);
});

test('the stack is bounded by HISTORY_LIMIT', () => {
  let history = createHistory(slot('start'));
  for (let i = 0; i < HISTORY_LIMIT + 20; i += 1) {
    history = commit(history, slot(`step-${i}`));
  }
  assert.equal(historySize(history), HISTORY_LIMIT);
  assert.equal(currentSlot(history).doc.preset, `step-${HISTORY_LIMIT + 19}`);
});
