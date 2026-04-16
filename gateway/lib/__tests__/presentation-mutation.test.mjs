/**
 * Tests for presentation (slide deck) mutation semantics (6.3E)
 * Run: node --test gateway/lib/__tests__/presentation-mutation.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// ── Pure mutation helpers ──

function makeSlide(id, title = '') {
  return {
    id,
    elements: [
      { type: 'textbox', left: 60, top: 40, width: 840, height: 60, text: title, fontSize: 36 },
    ],
    background: '#ffffff',
    notes: '',
  };
}

function makeDeck(...slides) {
  return { slides };
}

function findSlideIdx(deck, slideId) {
  return deck.slides.findIndex(s => s.id === slideId);
}

function reorderSlides(deck, slideIdOrder) {
  const slideMap = new Map(deck.slides.map(s => [s.id, s]));
  const reordered = slideIdOrder.map(sid => slideMap.get(sid)).filter(Boolean);
  const mentioned = new Set(slideIdOrder);
  for (const s of deck.slides) {
    if (!mentioned.has(s.id)) reordered.push(s);
  }
  return { ...deck, slides: reordered };
}

function deleteSlideById(deck, slideId) {
  const idx = findSlideIdx(deck, slideId);
  if (idx === -1) throw Object.assign(new Error(`SLIDE_NOT_FOUND: ${slideId}`), { code: 'SLIDE_NOT_FOUND' });
  const slides = [...deck.slides];
  slides.splice(idx, 1);
  return { deck: { ...deck, slides }, deletedIdx: idx };
}

function updateSlideById(deck, slideId, patch) {
  const idx = findSlideIdx(deck, slideId);
  if (idx === -1) throw Object.assign(new Error(`SLIDE_NOT_FOUND: ${slideId}`), { code: 'SLIDE_NOT_FOUND' });
  const slides = [...deck.slides];
  slides[idx] = { ...slides[idx], ...patch, id: slideId };
  return { ...deck, slides };
}

function insertSlideElement(deck, slideId, element, afterIndex = null) {
  const idx = findSlideIdx(deck, slideId);
  if (idx === -1) throw Object.assign(new Error(`SLIDE_NOT_FOUND: ${slideId}`), { code: 'SLIDE_NOT_FOUND' });
  const slides = [...deck.slides];
  const slide = { ...slides[idx] };
  const elements = [...(slide.elements || [])];
  const insertAt = afterIndex !== null ? Math.min(afterIndex + 1, elements.length) : elements.length;
  elements.splice(insertAt, 0, element);
  slides[idx] = { ...slide, elements };
  return { deck: { ...deck, slides }, elementIndex: insertAt };
}

function deleteSlideElement(deck, slideId, elementIndex) {
  const idx = findSlideIdx(deck, slideId);
  if (idx === -1) throw Object.assign(new Error(`SLIDE_NOT_FOUND: ${slideId}`), { code: 'SLIDE_NOT_FOUND' });
  const slides = [...deck.slides];
  const slide = { ...slides[idx] };
  const elements = [...(slide.elements || [])];
  if (elementIndex < 0 || elementIndex >= elements.length) {
    throw Object.assign(new Error('ELEMENT_NOT_FOUND'), { code: 'ELEMENT_NOT_FOUND' });
  }
  elements.splice(elementIndex, 1);
  slides[idx] = { ...slide, elements };
  return { ...deck, slides };
}

// ── list_slides / read_slide ──

test('list_slides: returns slide_id and metadata for each slide', () => {
  const deck = makeDeck(makeSlide('slide-1', 'Intro'), makeSlide('slide-2', 'Body'));
  const listed = deck.slides.map((s, idx) => ({ index: idx, slide_id: s.id, element_count: s.elements.length }));
  assert.equal(listed.length, 2);
  assert.equal(listed[0].slide_id, 'slide-1');
  assert.equal(listed[1].slide_id, 'slide-2');
});

test('read_slide: finds slide by stable slide_id', () => {
  const deck = makeDeck(makeSlide('s-a'), makeSlide('s-b'), makeSlide('s-c'));
  const idx = findSlideIdx(deck, 's-b');
  assert.equal(idx, 1);
  assert.equal(deck.slides[idx].id, 's-b');
});

test('read_slide: returns -1 for unknown slide_id', () => {
  const deck = makeDeck(makeSlide('s-1'));
  assert.equal(findSlideIdx(deck, 'ghost'), -1);
});

// ── add_slide / delete_slide ──

test('add_slide: appends new slide to deck', () => {
  const deck = makeDeck(makeSlide('s-1'));
  const newSlide = makeSlide('s-2', 'New Slide');
  const updated = { ...deck, slides: [...deck.slides, newSlide] };
  assert.equal(updated.slides.length, 2);
  assert.equal(updated.slides[1].id, 's-2');
});

test('delete_slide: removes correct slide, others intact', () => {
  const deck = makeDeck(makeSlide('s-1', 'A'), makeSlide('s-2', 'B'), makeSlide('s-3', 'C'));
  const { deck: result, deletedIdx } = deleteSlideById(deck, 's-2');
  assert.equal(result.slides.length, 2);
  assert.equal(result.slides[0].id, 's-1');
  assert.equal(result.slides[1].id, 's-3');
  assert.equal(deletedIdx, 1);
});

test('delete_slide: throws SLIDE_NOT_FOUND for unknown id', () => {
  const deck = makeDeck(makeSlide('s-1'));
  assert.throws(() => deleteSlideById(deck, 'ghost'), { code: 'SLIDE_NOT_FOUND' });
});

test('delete_slide: slide_ids on remaining slides are stable', () => {
  const deck = makeDeck(makeSlide('s-1'), makeSlide('s-2'), makeSlide('s-3'));
  const { deck: result } = deleteSlideById(deck, 's-1');
  assert.equal(result.slides[0].id, 's-2');
  assert.equal(result.slides[1].id, 's-3');
});

// ── reorder_slides ──

test('reorder_slides: reorders slides by slide_id_order', () => {
  const deck = makeDeck(makeSlide('s-1'), makeSlide('s-2'), makeSlide('s-3'));
  const result = reorderSlides(deck, ['s-3', 's-1', 's-2']);
  assert.equal(result.slides[0].id, 's-3');
  assert.equal(result.slides[1].id, 's-1');
  assert.equal(result.slides[2].id, 's-2');
});

test('reorder_slides: slides not in order list are appended at end', () => {
  const deck = makeDeck(makeSlide('s-1'), makeSlide('s-2'), makeSlide('s-3'));
  const result = reorderSlides(deck, ['s-2']);
  assert.equal(result.slides[0].id, 's-2');
  assert.equal(result.slides.length, 3);
});

test('reorder_slides: count unchanged', () => {
  const deck = makeDeck(makeSlide('a'), makeSlide('b'), makeSlide('c'));
  const result = reorderSlides(deck, ['c', 'b', 'a']);
  assert.equal(result.slides.length, 3);
});

// ── element ops ──

test('update_slide_element: patches element text without affecting other elements', () => {
  const deck = makeDeck({
    id: 's-1',
    elements: [{ type: 'textbox', text: 'Title', fontSize: 36 }, { type: 'textbox', text: 'Body', fontSize: 20 }],
    background: '#fff',
    notes: '',
  });
  const idx = findSlideIdx(deck, 's-1');
  const slides = [...deck.slides];
  const slide = { ...slides[idx] };
  const elements = [...slide.elements];
  elements[0] = { ...elements[0], text: 'Updated Title' };
  slides[idx] = { ...slide, elements };
  const result = { ...deck, slides };
  assert.equal(result.slides[0].elements[0].text, 'Updated Title');
  assert.equal(result.slides[0].elements[1].text, 'Body');
  assert.equal(result.slides[0].elements[0].fontSize, 36);
});

test('insert_slide_element: appends element to slide', () => {
  const deck = makeDeck({ id: 's-1', elements: [{ type: 'textbox', text: 'A' }], background: '#fff', notes: '' });
  const { deck: result, elementIndex } = insertSlideElement(deck, 's-1', { type: 'shape', shapeType: 'circle' });
  assert.equal(result.slides[0].elements.length, 2);
  assert.equal(result.slides[0].elements[1].type, 'shape');
  assert.equal(elementIndex, 1);
});

test('insert_slide_element: inserts at after_index position', () => {
  const deck = makeDeck({
    id: 's-1',
    elements: [{ type: 'textbox', text: 'First' }, { type: 'textbox', text: 'Third' }],
    background: '#fff',
    notes: '',
  });
  const { deck: result } = insertSlideElement(deck, 's-1', { type: 'textbox', text: 'Second' }, 0);
  assert.equal(result.slides[0].elements[0].text, 'First');
  assert.equal(result.slides[0].elements[1].text, 'Second');
  assert.equal(result.slides[0].elements[2].text, 'Third');
});

test('delete_slide_element: removes element, others intact', () => {
  const deck = makeDeck({
    id: 's-1',
    elements: [{ type: 'textbox', text: 'Keep' }, { type: 'textbox', text: 'Delete' }, { type: 'shape', shapeType: 'circle' }],
    background: '#fff',
    notes: '',
  });
  const result = deleteSlideElement(deck, 's-1', 1);
  assert.equal(result.slides[0].elements.length, 2);
  assert.equal(result.slides[0].elements[0].text, 'Keep');
  assert.equal(result.slides[0].elements[1].shapeType, 'circle');
});

test('delete_slide_element: throws ELEMENT_NOT_FOUND for out-of-range index', () => {
  const deck = makeDeck({ id: 's-1', elements: [{ type: 'textbox', text: 'Only' }], background: '#fff', notes: '' });
  assert.throws(() => deleteSlideElement(deck, 's-1', 5), { code: 'ELEMENT_NOT_FOUND' });
});

// ── Cross-slide isolation ──

test('isolation: agent edit of slide B does not affect slide A (human-edited)', () => {
  const originalSlideA = makeSlide('s-A', 'Human slide A');
  const deck = makeDeck(originalSlideA, makeSlide('s-B', 'Agent slide B'));
  const agentResult = updateSlideById(deck, 's-B', { notes: 'Added by agent' });
  assert.deepEqual(agentResult.slides[0], originalSlideA, 'slide A unchanged after agent edit of slide B');
  assert.equal(agentResult.slides[1].notes, 'Added by agent');
});
