import {catalog} from './catalog.mjs';
import {fit} from './calibration.mjs';

const get = id => document.getElementById(id);
const manufacturer = catalog[0];
const model = get('model');
const body = get('points');
const query = new URLSearchParams(location.search);
const number = new Intl.NumberFormat('de-CH', {maximumSignificantDigits: 10});
let report;

function invalidate() {
  report = undefined;
  get('status').textContent = 'Berechne zuerst Gain und Offset.';
  get('result').hidden = true;
  get('check').hidden = true;
  get('export').disabled = true;
}

function appendPoint(raw = '', reference = '') {
  const row = body.insertRow();
  const index = body.rows.length;
  const heading = document.createElement('th');
  heading.scope = 'row';
  heading.textContent = index;
  row.append(heading);
  for (const [label, value] of [['Rohwert', raw], ['Referenz', reference]]) {
    const field = document.createElement('input');
    field.type = 'number';
    field.step = 'any';
    field.required = true;
    field.value = value;
    field.setAttribute('aria-label', `${label} Punkt ${index}`);
    row.insertCell().append(field);
  }
  get('remove').disabled = index <= 2;
}

function updateModel() {
  get('modelStatus').textContent = `${model.selectedOptions[0].text} · Simulation verfügbar. Hardwaretreiber in Vorbereitung.`;
  const url = new URL(location.href);
  url.searchParams.set('model', model.value);
  history.replaceState(null, '', url);
  body.replaceChildren();
  appendPoint();
  appendPoint();
  get('checkRaw').value = '';
  invalidate();
}

function selectModels(group, requested) {
  model.replaceChildren();
  for (const item of group.models) model.add(new Option(item.name, item.id));
  if (group.models.some(item => item.id === requested)) model.value = requested;
  updateModel();
}

model.addEventListener('change', () => { if(model.value==='pga300'){const u=new URL(location.href);u.searchParams.set('model','pga300');location.href=u.href;}else updateModel(); });
get('add').addEventListener('click', () => { appendPoint(); invalidate(); });
get('remove').addEventListener('click', () => {
  if (body.rows.length > 2) body.deleteRow(-1);
  get('remove').disabled = body.rows.length <= 2;
  invalidate();
});
get('example').addEventListener('click', () => {
  body.replaceChildren();
  appendPoint(1200, 0);
  appendPoint(5202, 50);
  appendPoint(9200, 100);
  invalidate();
});
body.addEventListener('input', invalidate);

function updateCheck() {
  const raw = get('checkRaw').valueAsNumber;
  const estimate = report ? raw * report.fit.gain + report.fit.offset : NaN;
  get('checkResult').textContent = Number.isFinite(estimate) ? number.format(estimate) : '—';
}

get('calibration').addEventListener('submit', event => {
  event.preventDefault();
  invalidate();
  const points = Array.from(body.rows, row => {
    const [raw, reference] = row.querySelectorAll('input');
    return {raw: raw.valueAsNumber, reference: reference.valueAsNumber};
  });
  try {
    const result = fit(points);
    report = {mode: 'simulation', manufacturer: manufacturer.id, model: model.value, points, fit: result};
    get('gain').textContent = number.format(result.gain);
    get('offset').textContent = number.format(result.offset);
    get('error').textContent = number.format(result.residuals.reduce((max, error) => Math.max(max, Math.abs(error)), 0));
    get('status').textContent = 'Lineares Modell berechnet: Referenz = Gain × Rohwert + Offset.';
    get('result').hidden = false;
    get('check').hidden = false;
    get('export').disabled = false;
    updateCheck();
  } catch (error) {
    get('status').textContent = error.message;
  }
});

get('checkRaw').addEventListener('input', updateCheck);
get('export').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], {type: 'application/json'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'ssc-simulation.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
selectModels(manufacturer, query.get('model'));
