/* Regression: Pages-hosted reports must survive an uncached report-feed refresh. */
'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('site/app.js', 'utf8');
const start = source.indexOf('function renderReports() {');
const end = source.indexOf('function renderWorkspace() {', start);
assert.ok(start >= 0 && end > start, 'Cannot locate report rendering and refresh functions');

const base = 'https://example.github.io/new-research-dashboard/';
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
  url: 'https://github.com/YOUR-OWNER/YOUR-PROJECT-REPO/blob/main/reports/weekly/sample.html',
  updated_at: valid.updated_at
};
const element = {innerHTML:''};
const handlers = {};
let fetchCalls=0;
let reportsPayload;
let failFetch=false;
const sandbox = {
  reportSource:{reports:[]},
  reportLoadState:'loading',
  document:{baseURI:base, hidden:false, addEventListener:(event,fn)=>{handlers[event]=fn;}},
  window:{addEventListener:(event,fn)=>{handlers[event]=fn;},setInterval:(fn,ms)=>{assert.equal(ms,60000);handlers.periodic=fn;return 1;}},
  repositoryUrl:'https://github.com/example/new-research-dashboard',
  URL, Date,
  $: selector => selector === '#recent-reports' ? element : null,
  escape: value => String(value).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]),
  timestampLabel: () => '10.21 KST',
  fetch: async (url, options) => {
    fetchCalls += 1;
    assert.match(url, /^\.\/report-data\.json\?refresh=\d+$/);
    assert.equal(options.cache, 'no-store');
    if (failFetch) throw new Error('Network unavailable');
    return {ok:true,json:async ()=>({reports:reportsPayload})};
  },
};
vm.createContext(sandbox);
vm.runInContext(
  'let reportSource = globalThis.reportSource; let reportLoadState = "loading"; let reportRequestId = 0; '
  + source.slice(start,end),sandbox
);

(async ()=>{
  vm.runInContext('renderReports()', sandbox);
  assert.match(element.innerHTML, /목록을 확인하는 중입니다/);
  reportsPayload = [valid,...tenValid,invalid,legacy];
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
  // A tab left open while a report is uploaded must refresh when revisited
  // and once per minute while visible, without flooding background tabs.
  await vm.runInContext('startReportUpdates()', sandbox);
  assert.equal(fetchCalls, 2);
  sandbox.document.hidden = true;
  handlers.visibilitychange();
  handlers.focus();
  handlers.periodic();
  assert.equal(fetchCalls, 2);
  sandbox.document.hidden = false;
  await handlers.visibilitychange();
  await handlers.focus();
  await handlers.periodic();
  assert.equal(fetchCalls, 5);

  // Removal must immediately erase a previously displayed report.
  reportsPayload = [];
  await vm.runInContext('refreshReports()', sandbox);
  assert.match(element.innerHTML, /등록된 리포트가 없습니다/);
  assert.doesNotMatch(element.innerHTML, /Weekly Report · Sample/);

  // When offline, show an error instead of falsely retaining a deleted report.
  reportsPayload = [valid];
  await vm.runInContext('refreshReports()', sandbox);
  assert.match(element.innerHTML, /Weekly Report · Sample/);
  failFetch = true;
  await vm.runInContext('refreshReports()', sandbox);
  assert.match(element.innerHTML, /리포트 목록을 불러오지 못했습니다/);
  assert.doesNotMatch(element.innerHTML, /Weekly Report · Sample/);
  process.stdout.write('REPORT_DELETION_AND_CACHE_FALLBACK_PASS\n');
  process.stdout.write('REPORT_FEED_AND_ACTIVITY_LATEST_EIGHT_PASS\n');
})().catch(err=>{console.error(err); process.exitCode=1;});
