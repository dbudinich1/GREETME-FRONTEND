// src/utils/senderPhoto.test.mjs — the W03 sender-photo rule shared by the send page and Home (Report 145 correction).
// Run: node --test src/utils/senderPhoto.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { senderPhotoUsable } from './senderPhoto.js';

test('usable: a real photo URL; refused: none, data: URLs and placeholder hosts (the send page rule, unchanged)', () => {
  assert.equal(senderPhotoUsable('https://media.greet-me.com/u/1.jpg'), true);
  for (const bad of [null, undefined, '', 'data:image/png;base64,AAAA', 'https://via.placeholder.com/150', 'https://placehold.co/100', 'https://placekitten.com/200', 'https://dummyimage.com/1']) {
    assert.equal(senderPhotoUsable(bad), false, String(bad));
  }
});

test('one rule in both places: the send page and Home both call senderPhotoUsable', () => {
  const send = readFileSync(new URL('../pages/SendGreeting.jsx', import.meta.url), 'utf8');
  const home = readFileSync(new URL('../pages/DashboardHome.jsx', import.meta.url), 'utf8');
  assert.match(send, /const senderPhotoMissing = !senderPhotoUsable\(user\?\.photoUrl\);/);
  assert.match(home, /const photoDone = senderPhotoUsable\(user\?\.photoUrl\);/);
});
