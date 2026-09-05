/**
 * AI Fruit Ripeness Recognizer — A1 conference poster.
 *
 *   node build_poster.js   ->   fruit_ripeness_poster.pptx
 *
 * Visual-first: every panel is carried by a graphic (waffle, ruler, matrix,
 * pipeline, dot plot, native stacked bar, photographs). Prose is capped at one
 * caption line per panel — a poster is read from two metres away.
 */
const pptxgen = require('pptxgenjs');
const path = require('path');

const A = (f) => path.join(__dirname, 'assets', f);

// ---------------------------------------------------------------- palette
// Validated for CVD separation with scripts/validate_palette.js (all checks
// pass; the amber's low contrast is relieved by direct labels on every mark).
const INK = '1C2419';
const FOREST = '2C5F2D';
const FOREST_D = '1E4420';
const MOSS = '97BC62';
const PAPER = 'FFFFFF';
const WASH = 'F4F6F1';
const LINE = 'DFE4D8';
const MUTED = '6A7364';
const UNRIPE = '4F9D4A';
const RIPE = 'E2A325';
const OVER = 'CF4B3D';
const STAGE_COLOR = { unripe: UNRIPE, ripe: RIPE, overripe: OVER };
const STAGE_TINT = { unripe: 'E7F2E5', ripe: 'FBF0DA', overripe: 'FAE3E0' };

const HEAD = 'Cambria';
const BODY = 'Calibri';

// ------------------------------------------------------------------ canvas
const W = 23.4, H = 33.1;
const M = 0.85, GAP = 0.55;
const COLW = (W - 2 * M - 2 * GAP) / 3;
const C1 = M, C2 = M + COLW + GAP, C3 = M + 2 * (COLW + GAP);

const pres = new pptxgen();
pres.defineLayout({ name: 'A1P', width: W, height: H });
pres.layout = 'A1P';
pres.author = 'Nawaf Ajab Almutairi';
pres.title = 'From Recognition to Ripeness';
const s = pres.addSlide();
s.background = { color: WASH };

// --------------------------------------------------------------- helpers
function card(x, y, w, h, title, opts = {}) {
  s.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.1,
    fill: { color: opts.fill || PAPER }, line: { color: LINE, width: 1 },
    shadow: { type: 'outer', angle: 90, offset: 0.05, blur: 8, color: '9AA592', opacity: 0.25 },
  });
  s.addShape(pres.ShapeType.ellipse, {
    x: x + 0.35, y: y + 0.44, w: 0.32, h: 0.32, fill: { color: opts.dot || FOREST },
  });
  s.addText(title, {
    x: x + 0.8, y: y + 0.3, w: w - 1.05, h: 0.62, isTextBox: true, margin: 0, valign: 'middle',
    fontFace: HEAD, fontSize: 27, bold: true, color: FOREST_D,
  });
  return { cx: x + 0.5, cy: y + 1.1, cw: w - 1.0 };
}

function line(text, x, y, w, size = 17, color = INK, h = 1.2, opts = {}) {
  s.addText(text, {
    x, y, w, h, isTextBox: true, margin: 0, valign: 'top',
    fontFace: BODY, fontSize: size, color, lineSpacing: size * 1.32, ...opts,
  });
}

function caption(text, x, y, w) {
  line(text, x, y, w, 13.5, MUTED, 0.9, { italic: true });
}

function stat(x, y, w, h, n, label, color, size = 36) {
  s.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.09, fill: { color: WASH }, line: { color: LINE, width: 1 },
  });
  s.addText(n, {
    x, y: y + 0.13, w, h: 0.72, isTextBox: true, margin: 0, align: 'center', valign: 'middle',
    fontFace: HEAD, fontSize: size, bold: true, color,
  });
  s.addText(label, {
    x: x + 0.1, y: y + 0.88, w: w - 0.2, h: 0.55, isTextBox: true, margin: 0,
    align: 'center', valign: 'top', fontFace: BODY, fontSize: 13, color: MUTED,
  });
}

// ------------------------------------------------------------------ header
s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: W, h: 3.55, fill: { color: FOREST_D } });
s.addText('FROM RECOGNITION TO RIPENESS', {
  x: M, y: 0.42, w: W - 2 * M - 6.5, h: 1.15, isTextBox: true, margin: 0,
  fontFace: HEAD, fontSize: 66, bold: true, color: 'FFFFFF', charSpacing: -1,
});
s.addText('Not “which fruit?” — “how ripe, and what do I do with it?”', {
  x: M, y: 1.64, w: W - 2 * M - 6.6, h: 0.7, isTextBox: true, margin: 0, valign: 'top',
  fontFace: BODY, fontSize: 27, color: 'D8E4CE',
});
[['YOLOv8-L', 0], ['colour-cue refinement', 1], ['grounded assistant', 2], ['عربي / English', 3]]
  .forEach(([label, i]) => {
    const cw = 3.55, cx = M + i * (cw + 0.2);
    s.addShape(pres.ShapeType.roundRect, {
      x: cx, y: 2.45, w: cw, h: 0.62, rectRadius: 0.31,
      fill: { color: 'FFFFFF', transparency: 88 }, line: { color: MOSS, width: 1 },
    });
    s.addText(label, {
      x: cx, y: 2.45, w: cw, h: 0.62, isTextBox: true, margin: 0, align: 'center',
      valign: 'middle', fontFace: BODY, fontSize: 17, bold: true, color: MOSS,
    });
  });

s.addShape(pres.ShapeType.roundRect, {
  x: W - M - 6.1, y: 0.5, w: 6.1, h: 2.55, rectRadius: 0.12,
  fill: { color: 'FFFFFF', transparency: 88 }, line: { color: MOSS, width: 1 },
});
s.addText([
  { text: 'Nawaf Ajab Almutairi\n', options: { fontSize: 24, bold: true, color: 'FFFFFF' } },
  { text: 'B.S. Computer Science — Graduation Project\n', options: { fontSize: 17, color: 'D8E4CE' } },
  { text: 'Taibah University\n', options: { fontSize: 17, color: 'D8E4CE' } },
  { text: 'Supervisor: ______________________', options: { fontSize: 16, color: MOSS } },
], {
  x: W - M - 5.85, y: 0.72, w: 5.6, h: 2.1, isTextBox: true, margin: 0, valign: 'top',
  fontFace: BODY, lineSpacing: 26,
});

// ===================================================================== COL 1
let y = 3.95;

// --- 1 problem: waffle
let c = card(C1, y, COLW, 6.8, 'The problem');
s.addText([
  { text: '1 in 3', options: { fontSize: 54, bold: true, color: OVER, fontFace: HEAD } },
], { x: c.cx, y: c.cy, w: 2.6, h: 1.0, isTextBox: true, margin: 0, valign: 'middle' });
line('pieces of fruit a household buys are thrown away — most of them spoil unnoticed.',
  c.cx + 2.7, c.cy - 0.02, c.cw - 2.7, 16, INK, 1.1);

const cell = 0.72, gapc = 0.14;
for (let i = 0; i < 12; i++) {
  const col = i % 6, row = Math.floor(i / 6);
  const wasted = i >= 8;                       // 4 of 12 ≈ 1 in 3
  s.addShape(pres.ShapeType.roundRect, {
    x: c.cx + col * (cell + gapc), y: c.cy + 1.25 + row * (cell + gapc),
    w: cell, h: cell, rectRadius: 0.16,
    fill: { color: wasted ? OVER : MOSS },
    line: { color: wasted ? OVER : MOSS, width: 1 },
  });
}
caption('Each square is one fruit; red is the share that never gets eaten.',
  c.cx, c.cy + 2.92, c.cw);

stat(c.cx, c.cy + 3.6, (c.cw - 0.6) / 3, 1.5, '24', 'detector classes', FOREST);
stat(c.cx + (c.cw - 0.6) / 3 + 0.3, c.cy + 3.6, (c.cw - 0.6) / 3, 1.5, '3', 'ripeness stages', RIPE);
stat(c.cx + 2 * ((c.cw - 0.6) / 3 + 0.3), c.cy + 3.6, (c.cw - 0.6) / 3, 1.5, '2', 'languages', FOREST);
y += 6.8 + GAP;

// --- 2 the ruler
c = card(C1, y, COLW, 5.6, 'One verdict, one action', { dot: RIPE });
const bands = [
  ['unripe', 'Unripe', 'Let it ripen', '3–6 days to go'],
  ['ripe', 'Ripe', 'Eat now', '2–5 days left'],
  ['overripe', 'Overripe', 'Cook, blend or discard', 'today'],
];
bands.forEach(([key, name, action, when], i) => {
  const by = c.cy + i * 1.32;
  s.addShape(pres.ShapeType.roundRect, {
    x: c.cx, y: by, w: c.cw, h: 1.12, rectRadius: 0.1, fill: { color: STAGE_TINT[key] },
  });
  s.addShape(pres.ShapeType.roundRect, {
    x: c.cx, y: by, w: 1.75, h: 1.12, rectRadius: 0.1, fill: { color: STAGE_COLOR[key] },
  });
  s.addText(name, {
    x: c.cx, y: by, w: 1.75, h: 1.12, isTextBox: true, margin: 0, align: 'center',
    valign: 'middle', fontFace: BODY, fontSize: 17, bold: true, color: 'FFFFFF',
  });
  s.addText([
    { text: action, options: { fontSize: 19, bold: true, color: INK } },
  ], { x: c.cx + 1.95, y: by, w: c.cw - 3.35, h: 1.12, isTextBox: true, margin: 0, valign: 'middle', fontFace: BODY });
  s.addText(when, {
    x: c.cx + c.cw - 1.75, y: by, w: 1.6, h: 1.12, isTextBox: true, margin: 0, align: 'right',
    valign: 'middle', fontFace: BODY, fontSize: 14, color: MUTED,
  });
});
caption('Typical windows for household storage — not a food-safety guarantee.',
  c.cx, c.cy + 4.05, c.cw);
y += 5.6 + GAP;

// --- 3 taxonomy matrix
c = card(C1, y, COLW, 6.95, '8 fruits × 3 stages');
const fruits = ['Banana', 'Lemon', 'Red apple', 'Green apple', 'Blueberry', 'Kiwi', 'Pear', 'Orange'];
const stages = ['unripe', 'ripe', 'overripe'];
const nameW = 1.85, cellW = (c.cw - nameW) / 3, rowH = 0.60;
stages.forEach((st, j) => {
  s.addText(st[0].toUpperCase() + st.slice(1), {
    x: c.cx + nameW + j * cellW, y: c.cy, w: cellW, h: 0.4, isTextBox: true, margin: 0,
    align: 'center', valign: 'middle', fontFace: BODY, fontSize: 13, bold: true, color: MUTED,
  });
});
fruits.forEach((f, i) => {
  const ry = c.cy + 0.45 + i * rowH;
  s.addText(f, {
    x: c.cx, y: ry, w: nameW - 0.1, h: rowH - 0.06, isTextBox: true, margin: 0,
    valign: 'middle', fontFace: BODY, fontSize: 15, color: INK,
  });
  stages.forEach((st, j) => {
    s.addShape(pres.ShapeType.roundRect, {
      x: c.cx + nameW + j * cellW + 0.05, y: ry, w: cellW - 0.1, h: rowH - 0.08,
      rectRadius: 0.06, fill: { color: STAGE_TINT[st] }, line: { color: STAGE_COLOR[st], width: 1 },
    });
  });
});
caption('Every cell is one YOLO class, so a single forward pass returns the fruit and its stage together.',
  c.cx, c.cy + 5.35, c.cw);
y += 6.95 + GAP;

// --- 4 use case
c = card(C1, y, COLW, 6.9, 'What the user can do');
s.addImage({ path: A('usecase.png'), x: c.cx, y: c.cy, w: c.cw, h: c.cw / 1.066 });
y += 6.9;

// ===================================================================== COL 2
y = 3.95;

// --- 5 pipeline
c = card(C2, y, COLW, 9.3, 'How one photo becomes a verdict', { dot: RIPE });
const bw = c.cw;
function flowBox(yy, hh, label, sub, fill, fg) {
  s.addShape(pres.ShapeType.roundRect, {
    x: c.cx, y: yy, w: bw, h: hh, rectRadius: 0.08,
    fill: { color: fill }, line: { color: LINE, width: 1 },
  });
  s.addText([
    { text: label, options: { bold: true, fontSize: 18, color: fg || INK } },
    { text: '   ' + sub, options: { fontSize: 14.5, color: MUTED } },
  ], { x: c.cx + 0.24, y: yy, w: bw - 0.48, h: hh, isTextBox: true, margin: 0, fontFace: BODY, valign: 'middle' });
}
function arrow(yy) {
  s.addShape(pres.ShapeType.downArrow, {
    x: c.cx + bw / 2 - 0.13, y: yy, w: 0.26, h: 0.3, fill: { color: MOSS },
  });
}
const fy = c.cy + 0.15;
flowBox(fy, 0.8, 'Photo', 'any phone, any lighting', WASH);
arrow(fy + 0.88);
flowBox(fy + 1.22, 0.8, 'YOLOv8-L', 'box + 24-class score', 'EDF3E9', FOREST_D);
arrow(fy + 2.10);
flowBox(fy + 2.44, 0.85, 'Sure?', 'top-2 stage gap ≥ 0.20', 'FFFFFF');
s.addText('YES  keep it', {
  x: c.cx + 0.24, y: fy + 3.36, w: bw / 2 - 0.3, h: 0.36, isTextBox: true, margin: 0,
  valign: 'top', fontFace: BODY, fontSize: 15, bold: true, color: FOREST,
});
s.addText('NO  ask the colours', {
  x: c.cx + bw / 2 + 0.06, y: fy + 3.36, w: bw / 2 - 0.3, h: 0.36, isTextBox: true, margin: 0,
  valign: 'top', align: 'right', fontFace: BODY, fontSize: 15, bold: true, color: OVER,
});
flowBox(fy + 3.82, 0.85, 'Colour cues', 'brown · dark spots · texture', 'FDF3E2', 'A0761A');
arrow(fy + 4.75);
flowBox(fy + 5.09, 0.8, 'Knowledge base', 'action + shelf life', 'EDF3E9', FOREST_D);
arrow(fy + 5.97);
flowBox(fy + 6.31, 0.8, 'Assistant', 'rephrases the facts, invents none', WASH);
caption('The colour rule may overrule the network only where the network is undecided.',
  c.cx, fy + 7.25, c.cw);
y += 9.3 + GAP;

// --- 6 colour signature (native stacked bar)
c = card(C2, y, COLW, 6.1, 'What the colours say');
s.addChart(pres.ChartType.bar, [
  { name: 'green', labels: ['Unripe', 'Ripe', 'Overripe'], values: [70, 15, 5] },
  { name: 'yellow / orange', labels: ['Unripe', 'Ripe', 'Overripe'], values: [25, 75, 55] },
  { name: 'brown + dark spots', labels: ['Unripe', 'Ripe', 'Overripe'], values: [5, 10, 40] },
], {
  x: c.cx, y: c.cy, w: c.cw, h: 3.15,
  barDir: 'bar', barGrouping: 'stacked', barGapWidthPct: 60,
  chartColors: [UNRIPE, RIPE, OVER],
  showValue: true, dataLabelPosition: 'ctr', dataLabelColor: 'FFFFFF',
  dataLabelFontSize: 12, dataLabelFontBold: true, dataLabelFormatCode: '0"%"',
  showLegend: true, legendPos: 'b', legendFontSize: 13, legendColor: MUTED,
  catAxisLabelColor: INK, catAxisLabelFontSize: 15,
  valAxisLabelColor: MUTED, valAxisLabelFontSize: 12, valAxisMaxVal: 100,
  valGridLine: { color: 'ECEFE8', size: 1 }, catGridLine: { style: 'none' },
  valAxisLineShow: false, catAxisLineShow: false,
});
caption('Share of the fruit’s surface in each colour band. Schematic — these are the cues the refiner measures, not measured results.',
  c.cx, c.cy + 3.3, c.cw);
line('Cheap to compute, impossible to misread: a fruit that is 40% brown is not ripe, whatever the network scored.',
  c.cx, c.cy + 4.05, c.cw, 15.5, INK, 0.9);
y += 6.1 + GAP;

// --- 7 architecture
c = card(C2, y, COLW, 6.3, 'System architecture');
s.addImage({ path: A('architecture.png'), x: c.cx, y: c.cy, w: c.cw, h: c.cw / 1.337 });
caption('Three processes, one job each — the detector never touches the database.',
  c.cx, c.cy + c.cw / 1.337 + 0.12, c.cw);
y += 6.3 + GAP;

// --- 8 dataset
c = card(C2, y, COLW, 4.7, 'Dataset');
[['6,000', 'images', 36], ['250+', 'per class', 36], ['70/20/10', 'split by fruit', 24]]
  .forEach(([n, l, sz], i) => {
    const sw = (c.cw - 0.6) / 3;
    stat(c.cx + i * (sw + 0.3), c.cy, sw, 1.45, n, l, FOREST, sz);
  });
s.addShape(pres.ShapeType.roundRect, {
  x: c.cx, y: c.cy + 1.7, w: c.cw, h: 1.55, rectRadius: 0.09,
  fill: { color: 'FDF3E2' }, line: { color: 'E9D9B4', width: 1 },
});
s.addText([
  { text: 'Hue jitter stays at 0.010. ', options: { bold: true, color: 'A0761A' } },
  { text: 'Hue is the ripeness signal — the usual 0.015–0.03 augmentation trains the model to ignore it.', options: { color: INK } },
], { x: c.cx + 0.26, y: c.cy + 1.85, w: c.cw - 0.52, h: 1.25, isTextBox: true, margin: 0,
  valign: 'top', fontFace: BODY, fontSize: 16, lineSpacing: 21 });

// ===================================================================== COL 3
y = 3.95;

// --- 9 examples
c = card(C3, y, COLW, 7.6, 'Detection examples');
const sw2 = 3.35;
s.addImage({ path: A('samples.png'), x: c.cx, y: c.cy, w: sw2, h: sw2 / 0.65 });
const rw = c.cw - sw2 - 0.3;
s.addImage({ path: A('single.png'), x: c.cx + sw2 + 0.3, y: c.cy, w: rw, h: rw / 1.167 });
['unripe', 'ripe', 'overripe'].forEach((st, i) => {
  const ky = c.cy + rw / 1.167 + 0.35 + i * 0.62;
  s.addShape(pres.ShapeType.roundRect, {
    x: c.cx + sw2 + 0.3, y: ky, w: 0.5, h: 0.42, rectRadius: 0.07,
    fill: { color: STAGE_COLOR[st] },
  });
  s.addText(st[0].toUpperCase() + st.slice(1), {
    x: c.cx + sw2 + 0.95, y: ky, w: rw - 0.7, h: 0.42, isTextBox: true, margin: 0,
    valign: 'middle', fontFace: BODY, fontSize: 15, color: INK,
  });
});
s.addText('Box colour is the verdict.', {
  x: c.cx + sw2 + 0.3, y: c.cy + rw / 1.167 + 2.28, w: rw, h: 0.5, isTextBox: true,
  margin: 0, valign: 'top', fontFace: BODY, fontSize: 14, italic: true, color: MUTED,
});
y += 7.6 + GAP;

// --- 10 per-class dot plot
c = card(C3, y, COLW, 7.3, 'Where the detector stands', { dot: UNRIPE });
const ap = [
  ['Kiwi', 0.995], ['Lemon', 0.995], ['Blueberry', 0.995], ['Banana', 0.995],
  ['Red apple', 0.995], ['Green apple', 0.993], ['Pear', 0.990], ['Orange', 0.938],
];
const plotX = c.cx + 1.85, plotW = c.cw - 2.75, lo = 0.90, hi = 1.0;
const pos = (v) => plotX + ((v - lo) / (hi - lo)) * plotW;
[0.90, 0.95, 1.0].forEach((tick) => {
  s.addShape(pres.ShapeType.line, {
    x: pos(tick), y: c.cy + 0.3, w: 0, h: 4.35, line: { color: 'ECEFE8', width: 1 },
  });
  s.addText(tick.toFixed(2), {
    x: pos(tick) - 0.35, y: c.cy, w: 0.7, h: 0.3, isTextBox: true, margin: 0, align: 'center',
    valign: 'middle', fontFace: BODY, fontSize: 12, color: MUTED,
  });
});
ap.forEach(([name, v], i) => {
  const ry = c.cy + 0.42 + i * 0.5;
  s.addText(name, {
    x: c.cx, y: ry, w: 1.75, h: 0.42, isTextBox: true, margin: 0, valign: 'middle',
    fontFace: BODY, fontSize: 14.5, color: INK,
  });
  s.addShape(pres.ShapeType.line, {
    x: plotX, y: ry + 0.21, w: pos(v) - plotX, h: 0,
    line: { color: 'E4E8DE', width: 2.5 },
  });
  s.addShape(pres.ShapeType.ellipse, {
    x: pos(v) - 0.11, y: ry + 0.10, w: 0.22, h: 0.22,
    fill: { color: v < 0.95 ? RIPE : FOREST },
  });
  s.addText(v.toFixed(3), {
    x: c.cx + c.cw - 0.68, y: ry, w: 0.68, h: 0.42, isTextBox: true, margin: 0, align: 'right',
    valign: 'middle', fontFace: BODY, fontSize: 13, bold: v < 0.95, color: v < 0.95 ? 'A0761A' : MUTED,
  });
});
s.addText([
  { text: 'mAP@0.5 = 0.987 ', options: { bold: true, fontSize: 19, color: FOREST_D } },
  { text: 'on fruit identity (v1, 8 classes). Ripeness is the open half.', options: { fontSize: 15, color: INK } },
], { x: c.cx, y: c.cy + 4.6, w: c.cw, h: 0.9, isTextBox: true, margin: 0, valign: 'top', fontFace: BODY });
caption('Axis starts at 0.90 to separate the classes; orange is the one worth chasing.',
  c.cx, c.cy + 5.5, c.cw);
y += 7.3 + GAP;

// --- 11 PR curve
c = card(C3, y, COLW, 5.8, 'Precision–recall');
const prW = c.cw - 0.4, prH = prW / 1.479;
s.addImage({ path: A('pr_curve.png'), x: c.cx + 0.2, y: c.cy, w: prW, h: prH });
caption('Held-out test split, v1 detector.', c.cx, c.cy + prH + 0.12, c.cw);
y += 5.8 + GAP;

// --- 12 what is next
c = card(C3, y, COLW, 5.4, 'Next, and what it cannot do', { fill: 'EDF3E9' });
[
  ['✓', 'Corrections from users become training data', FOREST],
  ['→', 'White-balance normalisation for tinted light', FOREST],
  ['→', 'Per-berry scoring, native camera client', FOREST],
  ['×', 'Surface only — a pear ripens from the core out', OVER],
  ['×', 'Shelf life is typical, not a safety guarantee', OVER],
].forEach(([mark, text, color], i) => {
  const ry = c.cy + i * 0.72;
  s.addShape(pres.ShapeType.ellipse, {
    x: c.cx, y: ry + 0.06, w: 0.42, h: 0.42, fill: { color },
  });
  s.addText(mark, {
    x: c.cx, y: ry + 0.06, w: 0.42, h: 0.42, isTextBox: true, margin: 0, align: 'center',
    valign: 'middle', fontFace: BODY, fontSize: 16, bold: true, color: 'FFFFFF',
  });
  s.addText(text, {
    x: c.cx + 0.6, y: ry, w: c.cw - 0.6, h: 0.55, isTextBox: true, margin: 0, valign: 'middle',
    fontFace: BODY, fontSize: 16, color: INK,
  });
});

// ------------------------------------------------------------------ footer
s.addShape(pres.ShapeType.rect, { x: 0, y: H - 1.05, w: W, h: 1.05, fill: { color: FOREST_D } });
s.addText('YOLOv8-L (Ultralytics) · Flask · Node.js / Express · MySQL · OpenAI   |   github.com/<your-handle>/fruit-ripeness', {
  x: M, y: H - 0.84, w: W - 2 * M - 4.5, h: 0.62, isTextBox: true, margin: 0, valign: 'top',
  fontFace: BODY, fontSize: 15, color: 'D8E4CE',
});
s.addText('Taibah University · 2026', {
  x: W - M - 4.4, y: H - 0.84, w: 4.4, h: 0.62, isTextBox: true, margin: 0, align: 'right',
  valign: 'top', fontFace: BODY, fontSize: 15, color: MOSS, bold: true,
});

pres.writeFile({ fileName: path.join(__dirname, 'fruit_ripeness_poster.pptx') })
  .then((f) => console.log('wrote', f));
