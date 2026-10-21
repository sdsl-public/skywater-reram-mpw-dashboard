/* Regression: Pages-hosted reports must survive an uncached report-feed refresh. */
'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('site/app.js', 'utf8');
const start = source.indexOf('function renderReports() {');
const end = source.indexOf('function renderWorkspace() {', start);
assert.ok(start >= 0 && end > start, 'Cannot locate report rendering and refresh functions');

const base = 'https://sdsl-public.github.io/skywater-reram-mpw-dashboard/';
const valid = {
  title: 'Weekly Report · Sample',
  url: base + 'reports/weekly/2026-10/sample.html',
  updated_at: '2026-10-21T14:12:00+09:00'
};
const tenValid = Array.from({length:10}, (_,i) => ({
  ...valid,
  title: 'Weekly Report ' + String(i+1),
  url: base + 'reports/weekly/2026-10/report-' + String(i+1) + '.html'
}));
const invalid = {
  title: 'Untrusted page',
  url: 'https://untrusted.example/reports/weekly/fake.html',
  updated_at: valid.updated_at
};
const legacy = {
  title: 'Old GitHub file view',
  url: 'https://github.com/sdsl-public/skywater-reram-mpw-dashboard/blob/main/reports/weekly/sample.html',
  updated_at: valid.updated_at
};
const element = {innerHTML:''};
const sandbox = {
  reportSource:{reports:[]},
  document:{baseURI:base},
  repositoryUrl:'https://github.com/sdsl-public/skywater-reram-mpw-dashboard',
  URL, Date,
  $: selector => selector === '#recent-reports' ? element : null,
  escape: value => String(value).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]),
  timestampLabel: () => '10.21 KST',
  fetch: async (url, options) => {
    assert.match(url, /^\.\/report-data\.json\?refresh=\d+$/);
    assert.equal(options.cache, 'no-store');
    return {ok:true,json:async ()=>({reports:[valid,...tenValid,invalid,legacy]})};
  },
};
vm.createContext(sandbox);
vm.runInContext('let reportSource = globalThis.reportSource; ' + source.slice(start,end),sandbox);

(async ()=>{
  await vm.runInContext('refreshReports()', sandbox);
  assert.match(element.innerHTML, /Weekly Report · Sample/);
  assert.match(element.innerHTML, /reports\/weekly\/2026-10\/sample\.html/);
  assert.doesNotMatch(element.innerHTML, /Untrusted page/);
  assert.doesNotMatch(element.innerHTML, /Old GitHub file view/);
  assert.doesNotMatch(element.innerHTML, /등록된 리포트가 없습니다/);
  assert.equal((element.innerHTML.match(/class="activity-item report-activity"/g)||[]).length,8);
  assert.match(element.innerHTML, /Weekly Report 7/);
  assert.doesNotMatch(element.innerHTML, /Weekly Report 8/);
  // The activity section must independently show eight newest task entries.
  const recentStart = source.indexOf('function renderRecent() {');
  assert.ok(recentStart >= 0 && recentStart < start);
  const tasksElement = {innerHTML:''};
  sandbox.$ = selector => selector === '#recent-updates' ? tasksElement : element;
  sandbox.tasks = () => Array.from({length:10}, (_,i) => ({
    id:String(i+1), title:'Task '+String(i+1),
    phase:'01', updated_at:'2026-10-'+String(i+1).padStart(2,'0')+'T10:00:00+09:00'
  }));
  sandbox.phaseById = () => ({});
  sandbox.phaseStyle = () => '';
  vm.runInContext(source.slice(recentStart,start)+'\nrenderRecent();', sandbox);
  assert.equal((tasksElement.innerHTML.match(/class="activity-item"/g)||[]).length,8);
  assert.match(tasksElement.innerHTML, /Task 10/);
  assert.match(tasksElement.innerHTML, /Task 3/);
  assert.doesNotMatch(tasksElement.innerHTML, /Task 2/);
  process.stdout.write('REPORT_FEED_AND_ACTIVITY_LATEST_EIGHT_PASS\n');
})().catch(err=>{console.error(err); process.exitCode=1;});
