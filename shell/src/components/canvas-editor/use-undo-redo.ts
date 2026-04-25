import { useCallback, useRef, useState } from 'react';

interface UndoRedoState<T> {
  current: T;
  canUndo: boolean;
  canRedo: boolean;
  push: (value: T) => void;
  undo: () => T | null;
  redo: () => T | null;
  reset: (value: T) => void;
  beginBatch: () => void;
  endBatch: (value: T) => void;
}

export function useUndoRedo<T>(initial: T, maxSize = 50): UndoRedoState<T> {
  const [current, setCurrent] = useState(initial);
  const undoStack = useRef<T[]>([]);
  const redoStack = useRef<T[]>([]);
  const batchStart = useRef<T | null>(null);

  const push = useCallback((value: T) => {
    setCurrent(prev => {
      if (batchStart.current === null) {
        undoStack.current.push(prev);
        if (undoStack.current.length > maxSize) undoStack.current.shift();
        redoStack.current = [];
      }
      return value;
    });
  }, [maxSize]);

  const beginBatch = useCallback(() => {
    setCurrent(curr => { batchStart.current = curr; return curr; });
  }, []);

  const endBatch = useCallback((value: T) => {
    const start = batchStart.current;
    batchStart.current = null;
    setCurrent(() => {
      if (start !== null) {
        undoStack.current.push(start);
        if (undoStack.current.length > maxSize) undoStack.current.shift();
        redoStack.current = [];
      }
      return value;
    });
  }, [maxSize]);

  const undo = useCallback((): T | null => {
    const prev = undoStack.current.pop();
    if (prev === undefined) return null;
    setCurrent(curr => {
      redoStack.current.push(curr);
      return prev;
    });
    return prev;
  }, []);

  const redo = useCallback((): T | null => {
    const next = redoStack.current.pop();
    if (next === undefined) return null;
    setCurrent(curr => {
      undoStack.current.push(curr);
      return next;
    });
    return next;
  }, []);

  const reset = useCallback((value: T) => {
    undoStack.current = [];
    redoStack.current = [];
    setCurrent(value);
  }, []);

  return {
    current,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
    push,
    undo,
    redo,
    reset,
    beginBatch,
    endBatch,
  };
}
