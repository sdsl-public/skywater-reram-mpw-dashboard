/* Dashboard summary: the three compact counts replace the four-card progress row. */
'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const html=fs.readFileSync('site/index.html','utf8');
const css=fs.readFileSync('site/styles.css','utf8');
const source=fs.readFileSync('site/app.js','utf8');
const from=source.indexOf('function renderMetrics() {');
const to=source.indexOf('function renderDataStatus() {',from);
assert.ok(from>=0 && to>from,'summary renderer not found');

const panel=html.indexOf('class="updates-panel summary-panel"');
const tasksPanel=html.indexOf('id="recent-updates"');
const reportsPanel=html.indexOf('id="recent-reports"');
assert.ok(panel>=0 && panel<tasksPanel && tasksPanel<reportsPanel,'three panels in correct order');
assert.ok(!html.includes('<section class="metrics"'),'legacy metric row removed');
assert.match(css,/\.lower-grid\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
assert.match(css,/max-width:760px/);

const tasks=[
  {status:'done'},
  {status:'in-progress'},
  {status:'planned'},
  {status:'blocked'},
  {status:'cancelled'}
];
const box={innerHTML:''};
const sandbox={
  tasks:()=>tasks,
  isActive:task=>task.status!=='cancelled',
  isOverdue:task=>task.status==='blocked',
  state:{demo:false},
  icon:icon=>'<svg data-icon="'+icon+'"></svg>',
  escape:value=>String(value).replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])),
  $:selector=>selector==='#metrics'?box:null,
};
vm.createContext(sandbox);
vm.runInContext(source.slice(from,to)+'\nrenderMetrics();',sandbox);
const content=box.innerHTML;
assert.equal((content.match(/class="summary-stat"/g)||[]).length,3);
assert.match(content,/전체 업무/);
assert.match(content,/진행 중/);
assert.match(content,/기한 초과/);
assert.match(content,/완료 1 · 남은 업무 3/);
assert.match(content,/미완료 업무 1개 확인 필요/);
assert.doesNotMatch(content,/전체 진행률/);
assert.doesNotMatch(content,/metric-track/);
assert.doesNotMatch(content,/summary-stat-heading|summary-stat-content/);
assert.equal((content.match(/class="summary-stat-label"/g)||[]).length,3);
assert.equal((content.match(/class="summary-stat-note"/g)||[]).length,3);
assert.equal((content.match(/class="summary-stat-icon"/g)||[]).length,3);
assert.match(css,/\.summary-stat\{[\s\S]*?display:grid;[\s\S]*?grid-template-columns:78px max-content minmax\(0,1fr\) 16px/);
assert.match(css,/\.summary-stat-note\{[^}]*white-space:nowrap/);
assert.match(css,/max-width:480px/);
assert.doesNotMatch(css,/\.summary-stat-content\{/);
process.stdout.write('THREE_COLUMN_SUMMARY_AND_THREE_METRICS_PASS\n');
