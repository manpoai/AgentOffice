/**
 * Tests for doc-block-ops.js (3.3E)
 * Covers: replace, insert, append, delete, blockId migration, comment anchor preservation
 * Run: node --test gateway/lib/__tests__/doc-block-ops.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureTopLevelBlockIds,
  listTopLevelBlocks,
  replaceTopLevelBlock,
  insertBlocksAfter,
  appendBlocks,
  deleteTopLevelBlock,
} from '../doc-block-ops.js';

// ── Fixtures ──

function makeDoc(...blocks) {
  return {
    type: 'doc',
    content: blocks.map((b, i) => ({
      type: 'paragraph',
      attrs: { blockId: `block-${i + 1}` },
      content: [{ type: 'text', text: b }],
    })),
  };
}

function makeDocNoIds(...blocks) {
  return {
    type: 'doc',
    content: blocks.map(b => ({
      type: 'paragraph',
      content: [{ type: 'text', text: b }],
    })),
  };
}

function paragraphNode(text) {
  return { type: 'paragraph', content: [{ type: 'text', text }] };
}

// ── ensureTopLevelBlockIds ──

test('ensureTopLevelBlockIds: assigns blockIds to nodes that lack them', () => {
  const doc = makeDocNoIds('Hello', 'World');
  const { doc: result, changed } = ensureTopLevelBlockIds(doc);
  assert.ok(changed, 'should report changed=true');
  for (const node of result.content) {
    assert.ok(node.attrs?.blockId, 'every node should have a blockId after migration');
  }
});

test('ensureTopLevelBlockIds: preserves existing blockIds', () => {
  const doc = makeDoc('A', 'B');
  const { doc: result, changed } = ensureTopLevelBlockIds(doc);
  assert.ok(!changed, 'should report changed=false when all ids present');
  assert.equal(result.content[0].attrs.blockId, 'block-1');
  assert.equal(result.content[1].attrs.blockId, 'block-2');
});

test('ensureTopLevelBlockIds: handles null/empty doc gracefully', () => {
  const { doc } = ensureTopLevelBlockIds(null);
  assert.equal(doc.type, 'doc');
  assert.deepEqual(doc.content, []);
});

test('ensureTopLevelBlockIds: assigned IDs are unique', () => {
  const doc = makeDocNoIds('A', 'B', 'C', 'D', 'E');
  const { doc: result } = ensureTopLevelBlockIds(doc);
  const ids = result.content.map(n => n.attrs?.blockId);
  const unique = new Set(ids);
  assert.equal(unique.size, ids.length, 'all blockIds must be unique');
});

// ── listTopLevelBlocks ──

test('listTopLevelBlocks: returns correct block metadata', () => {
  const doc = makeDoc('Alpha', 'Beta');
  const blocks = listTopLevelBlocks(doc);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].block_id, 'block-1');
  assert.equal(blocks[0].type, 'paragraph');
  assert.equal(blocks[0].index, 0);
  assert.ok(blocks[0].text_preview.includes('Alpha'));
});

test('listTopLevelBlocks: heading_level populated for heading nodes', () => {
  const doc = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { blockId: 'h1', level: 2 }, content: [{ type: 'text', text: 'Title' }] },
    ],
  };
  const blocks = listTopLevelBlocks(doc);
  assert.equal(blocks[0].heading_level, 2);
});

// ── replaceTopLevelBlock ──

test('replaceTopLevelBlock: replaces correct block, preserves others', () => {
  const doc = makeDoc('A', 'B', 'C');
  const replacement = paragraphNode('B-updated');
  const { doc: result } = replaceTopLevelBlock(doc, 'block-2', replacement);
  assert.equal(result.content.length, 3);
  assert.equal(result.content[0].attrs.blockId, 'block-1');
  assert.equal(result.content[2].attrs.blockId, 'block-3');
  assert.equal(result.content[1].attrs.blockId, 'block-2', 'blockId preserved on replacement');
  assert.equal(result.content[1].content[0].text, 'B-updated');
});

test('replaceTopLevelBlock: other blocks retain their blockIds (comment anchor preservation)', () => {
  const doc = makeDoc('A', 'B', 'C');
  const { doc: result } = replaceTopLevelBlock(doc, 'block-2', paragraphNode('X'));
  assert.equal(result.content[0].attrs.blockId, 'block-1');
  assert.equal(result.content[2].attrs.blockId, 'block-3');
});

test('replaceTopLevelBlock: throws BLOCK_NOT_FOUND for unknown blockId', () => {
  const doc = makeDoc('A', 'B');
  assert.throws(() => replaceTopLevelBlock(doc, 'no-such-block', paragraphNode('X')), { code: 'BLOCK_NOT_FOUND' });
});

test('replaceTopLevelBlock: throws if blockId is empty', () => {
  const doc = makeDoc('A');
  assert.throws(() => replaceTopLevelBlock(doc, '', paragraphNode('X')), /blockId required/);
});

// ── insertBlocksAfter ──

test('insertBlocksAfter: inserts after specified block', () => {
  const doc = makeDoc('A', 'B');
  const { doc: result, inserted } = insertBlocksAfter(doc, 'block-1', [paragraphNode('A2')]);
  assert.equal(result.content.length, 3);
  assert.equal(result.content[0].attrs.blockId, 'block-1');
  assert.equal(result.content[1].content[0].text, 'A2');
  assert.equal(result.content[2].attrs.blockId, 'block-2');
  assert.ok(inserted[0].attrs.blockId);
});

test('insertBlocksAfter: null afterBlockId inserts at beginning', () => {
  const doc = makeDoc('A', 'B');
  const { doc: result } = insertBlocksAfter(doc, null, [paragraphNode('Start')]);
  assert.equal(result.content[0].content[0].text, 'Start');
  assert.equal(result.content[1].attrs.blockId, 'block-1');
});

test('insertBlocksAfter: inserts multiple nodes in order', () => {
  const doc = makeDoc('A', 'B');
  const { doc: result } = insertBlocksAfter(doc, 'block-1', [paragraphNode('X'), paragraphNode('Y')]);
  assert.equal(result.content.length, 4);
  assert.equal(result.content[1].content[0].text, 'X');
  assert.equal(result.content[2].content[0].text, 'Y');
});

test('insertBlocksAfter: stamps fresh unique blockIds on new nodes', () => {
  const doc = makeDoc('A');
  const { inserted } = insertBlocksAfter(doc, 'block-1', [paragraphNode('X'), paragraphNode('Y')]);
  assert.notEqual(inserted[0].attrs.blockId, inserted[1].attrs.blockId);
});

test('insertBlocksAfter: throws BLOCK_NOT_FOUND for unknown afterBlockId', () => {
  const doc = makeDoc('A');
  assert.throws(() => insertBlocksAfter(doc, 'no-such', [paragraphNode('X')]), { code: 'BLOCK_NOT_FOUND' });
});

test('insertBlocksAfter: throws if newNodes is empty', () => {
  const doc = makeDoc('A');
  assert.throws(() => insertBlocksAfter(doc, 'block-1', []), /non-empty array/);
});

// ── appendBlocks ──

test('appendBlocks: appends at end of document', () => {
  const doc = makeDoc('A', 'B');
  const { doc: result, at_index } = appendBlocks(doc, [paragraphNode('C')]);
  assert.equal(result.content.length, 3);
  assert.equal(result.content[2].content[0].text, 'C');
  assert.equal(at_index, 2);
});

test('appendBlocks: preserves existing blockIds', () => {
  const doc = makeDoc('A', 'B');
  const { doc: result } = appendBlocks(doc, [paragraphNode('C')]);
  assert.equal(result.content[0].attrs.blockId, 'block-1');
  assert.equal(result.content[1].attrs.blockId, 'block-2');
});

test('appendBlocks: assigns blockId to appended node', () => {
  const doc = makeDoc('A');
  const { inserted } = appendBlocks(doc, [paragraphNode('B')]);
  assert.ok(inserted[0].attrs.blockId);
});

// ── deleteTopLevelBlock ──

test('deleteTopLevelBlock: removes correct block', () => {
  const doc = makeDoc('A', 'B', 'C');
  const { doc: result, deleted_block_id } = deleteTopLevelBlock(doc, 'block-2');
  assert.equal(result.content.length, 2);
  assert.equal(result.content[0].attrs.blockId, 'block-1');
  assert.equal(result.content[1].attrs.blockId, 'block-3');
  assert.equal(deleted_block_id, 'block-2');
});

test('deleteTopLevelBlock: comment anchors on other blocks survive deletion', () => {
  const doc = makeDoc('A', 'B', 'C');
  const { doc: result } = deleteTopLevelBlock(doc, 'block-2');
  assert.equal(result.content[0].attrs.blockId, 'block-1');
  assert.equal(result.content[1].attrs.blockId, 'block-3');
});

test('deleteTopLevelBlock: throws BLOCK_NOT_FOUND for unknown blockId', () => {
  const doc = makeDoc('A', 'B');
  assert.throws(() => deleteTopLevelBlock(doc, 'ghost'), { code: 'BLOCK_NOT_FOUND' });
});

test('deleteTopLevelBlock: throws if blockId is empty', () => {
  const doc = makeDoc('A');
  assert.throws(() => deleteTopLevelBlock(doc, ''), /blockId required/);
});

// ── Migration integration ──

test('Migration: doc without blockIds can be listed after ensureTopLevelBlockIds', () => {
  const doc = makeDocNoIds('Intro', 'Body', 'Conclusion');
  const { doc: migrated } = ensureTopLevelBlockIds(doc);
  const blocks = listTopLevelBlocks(migrated);
  assert.equal(blocks.length, 3);
  for (const b of blocks) {
    assert.ok(b.block_id, 'every block has an id after migration');
  }
});

test('Migration: can replace a block after migrating a no-id doc', () => {
  const doc = makeDocNoIds('A', 'B');
  const { doc: migrated } = ensureTopLevelBlockIds(doc);
  const blocks = listTopLevelBlocks(migrated);
  const { doc: result } = replaceTopLevelBlock(migrated, blocks[1].block_id, paragraphNode('B-new'));
  assert.equal(result.content[1].content[0].text, 'B-new');
});
