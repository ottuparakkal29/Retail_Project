import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterShopUpdates, joinShopUpdates } from '../src/lib/shop-updates.ts';

const shop = { id: 'a', business_name: 'Shop A', district: 'Kollam', taluk: 'Kollam', village: 'Town' };
const post = {
  id: '1', business_id: 'a', title: 'Fresh', description: null, update_type: 'offer',
  festival_tag: null, image_url: null, valid_until: null, is_active: true, created_at: '2026-01-01',
};
const defaults = { district: '', taluk: '', village: '', followed: null, now: Date.parse('2026-01-01T00:00:00Z') };

test('joins only updates belonging to visible shops', () => {
  assert.deepEqual(joinShopUpdates([post, { ...post, id: '2', business_id: 'hidden' }], [shop]), [{ update: post, shop }]);
});

test('filters by all selected location levels and followed shops', () => {
  const items = joinShopUpdates([post], [shop]);
  assert.equal(filterShopUpdates(items, { ...defaults, district: 'Kollam', taluk: 'Kollam', village: 'Town', followed: new Set(['a']) }).length, 1);
  assert.equal(filterShopUpdates(items, { ...defaults, district: 'Kollam', taluk: 'Kollam', village: 'Other' }).length, 0);
  assert.equal(filterShopUpdates(items, { ...defaults, followed: new Set() }).length, 0);
});

test('excludes inactive and expired updates', () => {
  const items = joinShopUpdates([
    post, { ...post, id: '2', is_active: false },
    { ...post, id: '3', valid_until: '2025-12-31T23:59:59Z' },
    { ...post, id: '4', valid_until: '2026-01-01T00:00:00Z' },
  ], [shop]);
  assert.deepEqual(filterShopUpdates(items, defaults).map(({ update }) => update.id), ['1', '4']);
});
