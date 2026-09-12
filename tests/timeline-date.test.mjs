import test from 'node:test';
import assert from 'node:assert/strict';
import {formatTimelineDate} from '../src/timeline-date.js';
test('timeline spells out Korean date and actual weekday in KST',()=>{
 assert.equal(formatTimelineDate(Date.parse('2026-09-05T16:10:00Z')),'2026년 9월 6일 일요일 1시 10분');
 assert.equal(formatTimelineDate(Date.parse('2026-09-05T15:00:00Z')),'2026년 9월 6일 일요일 0시 0분');
});
