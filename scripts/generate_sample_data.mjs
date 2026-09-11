import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(scriptDir, '..', 'data');
const asOf = new Date('2026-09-11T09:00:00+09:00');

let seed = 20260911;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
function integer(min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}
function pick(values) {
  return values[Math.floor(random() * values.length)];
}
function csv(rows, headers) {
  const escape = (value) => `"${String(value).replaceAll('"', '""')}"`;
  return [headers.join(','), ...rows.map((row) => headers.map((key) => escape(row[key] ?? '')).join(','))].join('\n') + '\n';
}
function iso(date) {
  return new Date(date).toISOString();
}

const modules = [
  ['WET', 'Wet Clean'], ['PHOTO', 'Photolithography'], ['ETCH', 'Etch'],
  ['STRIP', 'Strip & Ash'], ['CVD', 'CVD Deposition'], ['PVD', 'PVD Deposition'],
  ['DIFF', 'Diffusion'], ['IMPL', 'Ion Implant'], ['CMP', 'CMP'], ['MET', 'Metrology'],
];
const action = ['Pre Clean', 'Coat', 'Expose', 'Develop', 'Main', 'Post Clean', 'Deposition', 'Anneal', 'Measure', 'Inspect'];
const basePlan = Array.from({ length: 100 }, (_, index) => {
  const step = index + 1;
  const [moduleCode, moduleName] = modules[index % modules.length];
  return {
    oper_desc: `${moduleName} - ${action[index % action.length]} ${String(Math.ceil(step / 10)).padStart(2, '0')}`,
    oper_id: `${moduleCode}-${String(step).padStart(3, '0')}`,
    oper_seq: step,
    lot_code: 'DEMO-ROUTE-01',
  };
});

const lots = Array.from({ length: 100 }, (_, index) => {
  const fab = index < 50 ? 'FAB-A' : 'FAB-B';
  const product = ['DRAM', 'NAND', 'LOGIC', 'CIS'][index % 4];
  const prefix = fab === 'FAB-A' ? 'A' : 'B';
  return {
    lot_id: `LOT-${prefix}-${String(index + 1).padStart(4, '0')}`,
    lot_code: `${product}-${prefix}-${String(index + 1).padStart(4, '0')}`,
    fab,
    product,
  };
});

const history = [];
const current = [];
for (const [lotIndex, lot] of lots.entries()) {
  const progress = Math.min(99, Math.max(1, Math.round((lotIndex / 99) * 92 + integer(-4, 4))));
  let time = new Date(asOf.getTime() - integer(2, 11) * 24 * 60 * 60 * 1000);
  const lotEvents = [];
  for (let step = Math.max(1, progress - 13); step <= progress; step += 1) {
    const operation = basePlan[step - 1];
    const waitHours = integer(1, 10);
    time = new Date(time.getTime() + waitHours * 60 * 60 * 1000);
    lotEvents.push({ lot_id: lot.lot_id, lot_code: lot.lot_code, event_time: iso(time), oper_desc: operation.oper_desc, event_code: 'wait' });
    if ((step + lotIndex) % 23 === 0) {
      time = new Date(time.getTime() + integer(2, 8) * 60 * 60 * 1000);
      lotEvents.push({ lot_id: lot.lot_id, lot_code: lot.lot_code, event_time: iso(time), oper_desc: operation.oper_desc, event_code: 'hold' });
    }
    time = new Date(time.getTime() + integer(1, 3) * 60 * 60 * 1000);
    lotEvents.push({ lot_id: lot.lot_id, lot_code: lot.lot_code, event_time: iso(time), oper_desc: operation.oper_desc, event_code: 'job start' });
    time = new Date(time.getTime() + integer(1, 5) * 60 * 60 * 1000);
    lotEvents.push({ lot_id: lot.lot_id, lot_code: lot.lot_code, event_time: iso(time), oper_desc: operation.oper_desc, event_code: 'proc' });
    if (step < progress) {
      time = new Date(time.getTime() + integer(1, 3) * 60 * 60 * 1000);
      lotEvents.push({ lot_id: lot.lot_id, lot_code: lot.lot_code, event_time: iso(time), oper_desc: operation.oper_desc, event_code: 'job end' });
    }
  }
  const shiftMs = asOf.getTime() - time.getTime() - integer(1, 12) * 60 * 60 * 1000;
  history.push(...lotEvents.map((event) => ({ ...event, event_time: iso(new Date(Date.parse(event.event_time) + shiftMs)) })));
  const operation = basePlan[progress - 1];
  const eventCode = lotIndex % 17 === 0 ? 'hold' : pick(['wait', 'job start', 'proc']);
  current.push({
    lot_id: lot.lot_id,
    lot_code: lot.lot_code,
    event_time: iso(asOf),
    oper_desc: operation.oper_desc,
    event_code: eventCode,
  });
}

history.sort((a, b) => a.event_time.localeCompare(b.event_time) || a.lot_id.localeCompare(b.lot_id));
await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, 'base_plan.csv'), csv(basePlan, ['oper_desc', 'oper_id', 'oper_seq', 'lot_code']), 'utf8');
await writeFile(resolve(outputDir, 'lot_history.csv'), csv(history, ['lot_id', 'lot_code', 'event_time', 'oper_desc', 'event_code']), 'utf8');
await writeFile(resolve(outputDir, 'lot_current.csv'), csv(current, ['lot_id', 'lot_code', 'event_time', 'oper_desc', 'event_code']), 'utf8');

console.log(`Created ${basePlan.length} route steps, ${history.length} history events, and ${current.length} current lot states.`);
