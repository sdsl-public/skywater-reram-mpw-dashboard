/* Read-only dashboard. No access token, remote code, backend or analytics. Fonts are loaded separately by the page. */
(() => {
  'use strict';
  const config = window.DASHBOARD_CONFIG;
  if (!config || !/^[\w.-]+\/[\w.-]+$/.test(config.repository)) throw new Error('Invalid repository configuration.');
  const repositoryUrl = `https://github.com/${config.repository}`;
  const source = window.DASHBOARD_DATA || {tasks: [], generated_at: null, source: 'not-synced', warnings: []};
  // Never show the potentially stale preloaded report list after an upload or deletion.
  let reportSource = {reports: []};
  let reportLoadState = 'loading';
  let reportRequestId = 0;
  const DAY = 86400000;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const paths = {
    'github':'<path d="M9 19c-4 1-4-2-6-2m12 5v-4a3.5 3.5 0 0 0-1-2.7c3.3-.4 6.7-1.6 6.7-7.3A5.7 5.7 0 0 0 19 4a5.3 5.3 0 0 0-.1-4S17.6-.4 15 1.5a14 14 0 0 0-6 0C6.4-.4 5.1 0 5.1 0A5.3 5.3 0 0 0 5 4a5.7 5.7 0 0 0-1.7 4c0 5.7 3.4 6.9 6.7 7.3A3.5 3.5 0 0 1 9 18v4" transform="translate(0 1) scale(.95)"/>',
    'arrow-up-right':'<path d="M6 18 18 6M6 6h12v12"/>',
    'arrow-right':'<path d="M4 12h16m-6-6 6 6-6 6"/>',
    'chevron-right':'<path d="m9 5 7 7-7 7"/>',
    'chevron-left':'<path d="m15 5-7 7 7 7"/>',
    'plus':'<path d="M12 5v14M5 12h14"/>',
    'x':'<path d="m6 6 12 12M6 18 18 6"/>',
    'refresh':'<path d="M20 7v5h-5M4 17v-5h5M5.5 7A8 8 0 0 1 20 12M18.5 17A8 8 0 0 1 4 12"/>',
    'search':'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    'layers':'<path d="m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 16l10 5 10-5"/>',
    'lock':'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/>',
    'gantt':'<path d="M5 5h9M9 10h10M6 15h11M14 20h7"/><path d="M2 3v19" opacity=".5"/>',
    'list':'<path d="M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1"/>',
    'columns':'<rect x="3" y="3" width="5" height="18" rx="1"/><rect x="11" y="3" width="4" height="11" rx="1"/><rect x="18" y="3" width="3" height="15" rx="1"/>',
    'unfold':'<path d="m8 7 4-4 4 4M4 12h16m-12 5 4 4 4-4"/>',
    'info':'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/>',
    'globe':'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
    'circle':'<circle cx="12" cy="12" r="8"/>',
    'check-circle':'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    'progress':'<path d="M12 3a9 9 0 1 1-9 9"/><path d="M12 7v5l3 2M4 5v.1M8 3v.1M3 8v.1"/>',
    'review':'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    'alert':'<path d="m12 3 10 18H2Z"/><path d="M12 9v5m0 3v.1"/>',
    'pause':'<circle cx="12" cy="12" r="9"/><path d="M9 8v8m6-8v8"/>',
    'calendar':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18M7 14h2m5 0h2"/>',
    'check':'<path d="m5 12 4 4L19 6"/>',
    'square':'<rect x="4" y="4" width="16" height="16" rx="3"/>',
    'copy':'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.circle}</svg>`;
  function renderIcons(root = document) { $$('[data-icon]', root).forEach(el => {el.innerHTML = icon(el.dataset.icon);}); }
  const statuses = {
    planned:{label:'대기',icon:'circle'},
    'in-progress':{label:'진행 중',icon:'progress'},
    review:{label:'검토 중',icon:'review'},
    blocked:{label:'보류',icon:'pause'},
    done:{label:'완료',icon:'check-circle'},
    cancelled:{label:'취소',icon:'x'}
  };
  function parseDay(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [y,m,d] = value.split('-').map(Number);
    const date = new Date(Date.UTC(y,m-1,d,12));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m-1 && date.getUTCDate() === d ? date : null;
  }
  const dayKey = date => date.toISOString().slice(0,10);
  const addDays = (date, n) => new Date(+date+n*DAY);
  const monthStart = (date, offset=0) => new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+offset,1,12));
  function todayDate() {
    const parts = new Intl.DateTimeFormat('en-US',{timeZone:config.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const get = type => parts.find(p => p.type === type).value;
    return parseDay(`${get('year')}-${get('month')}-${get('day')}`);
  }
  const today = todayDate();
  const projectStart = parseDay(config.projectStart);
  const projectEnd = parseDay(config.projectEnd);
  if (!projectStart || !projectEnd || projectEnd < projectStart) {
    throw new Error('Project dates must be valid and the end must not precede the start.');
  }
  const projectFirstMonth = monthStart(projectStart);
  const projectEndExclusive = monthStart(projectEnd, 1);
  const projectMonths = (projectEnd.getUTCFullYear()-projectStart.getUTCFullYear())*12 + projectEnd.getUTCMonth()-projectStart.getUTCMonth()+1;
  const projectDays = (projectEnd-projectStart)/DAY+1;
  const monthLabel = date => `${date.getUTCFullYear()}.${String(date.getUTCMonth()+1).padStart(2,'0')}`;
  const visibleMonths = () => state.scale === 'full' ? projectMonths : Math.min(projectMonths, state.scale === 'month' ? 6 : 3);
  function clampStart(date) {
    const latest = monthStart(projectEndExclusive, -visibleMonths());
    return new Date(Math.max(+projectFirstMonth, Math.min(+latest, +monthStart(date))));
  }
  const phaseById = id => config.phases.find(p => p.id === id) || config.phases.find(p => p.id === '00');
  const dateLabel = (value, short=false) => {const d=parseDay(value); return d ? (short ? `${String(d.getUTCMonth()+1).padStart(2,'0')}.${String(d.getUTCDate()).padStart(2,'0')}` : value.replaceAll('-','.')) : '미정';};
  function timestampLabel(value) {
    if (!value || !Number.isFinite(Date.parse(value))) return '미기록';
    return new Intl.DateTimeFormat('ko-KR',{timeZone:config.timezone,month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value))+' KST';
  }
  function normalizeTask(raw) {
    const status = Object.hasOwn(statuses,raw.status) ? raw.status : 'planned';
    const end = parseDay(raw.end) ? raw.end : null;
    const start = parseDay(raw.start) ? raw.start : null;
    const valid = !(start && end && start>end);
    const number = Number.isSafeInteger(raw.number) && raw.number>0 ? raw.number : null;
    return {
      id:String(raw.id || `issue-${number}`).slice(0,100),number,title:String(raw.title || '제목 없음').slice(0,300),
      phase:phaseById(raw.phase).id,status,kind:raw.kind==='milestone'?'milestone':'task',
      start:valid?start:null,end:valid?end:null,progress:status==='done'?100:status==='cancelled'?0:Math.max(0,Math.min(99,Number(raw.progress)||0)),
      assignees:Array.isArray(raw.assignees)?raw.assignees.map(String).slice(0,20):[],
      summary:String(raw.summary || '').slice(0,1600),
      checklist:Array.isArray(raw.checklist)?raw.checklist.slice(0,100).map(v=>({text:String(v.text).slice(0,300),done:v.done===true})):[],
      updated_at:raw.updated_at || null,progress_source:raw.progress_source || 'manual',
      url:number ? `${repositoryUrl}/issues/${number}`:null
    };
  }
  const realTasks = Array.isArray(source.tasks) ? source.tasks.map(normalizeTask) : [];
  function makeDemo() {
    const base=projectStart;
    // Scale only the explicitly labelled fictional examples across the project window.
    const demoOffset = day => Math.round(day/181*(projectDays-1));
    const rows=[
      ['01','프로젝트 목적·범위 설정',0,7,'done',100],
      ['01','성과 지표·일정 초안',4,14,'done',100],
      ['01','참여 인력·역할 검토',10,23,'in-progress',60],
      ['02','선행연구 조사',8,23,'in-progress',40],
      ['02','자료 수집·요구사항 작성',17,36,'planned',0],
      ['02','요구사항 검토 완료',37,37,'planned',0,'milestone'],
      ['03','방법론·시스템 구성 설계',28,55,'planned',0],
      ['03','개발·실험 계획 구체화',40,72,'planned',0],
      ['03','설계 검토',60,82,'planned',0],
      ['04','프로토타입 구현',75,102,'planned',0],
      ['04','기능·성능 검증',90,114,'planned',0],
      ['04','구현 검토 완료',115,115,'planned',0,'milestone'],
      ['05','실험 및 정량 평가',111,124,'planned',0],
      ['05','데이터 분석',123,155,'planned',0],
      ['05','추가 검증',135,164,'planned',0],
      ['06','성과 정리',158,173,'planned',0],
      ['06','보고서 작성',166,179,'planned',0],
      ['06','최종 결과 공유',177,181,'planned',0,'milestone']
    ];
    return rows.map((r,i)=>normalizeTask({id:`demo-${i}`,title:r[1],phase:r[0],start:dayKey(addDays(base,demoOffset(r[2]))),end:dayKey(addDays(base,demoOffset(r[3]))),status:r[4],progress:r[5],kind:r[6]||'task',assignees:[`sample-${['a','b','c'][i%3]}`],summary:'화면 구성 확인을 위한 예시 업무입니다. 담당자·날짜·진행률은 가상 값이며, 실제 프로젝트의 확정 일정이 아닙니다.',checklist:[{text:'요구사항 및 입력 자료 정리',done:r[5]>=40},{text:'연구·업무 수행',done:r[5]>=80},{text:'결과 검토 및 다음 단계 공유',done:r[5]===100}],updated_at:new Date(+today-(i+1)*3600000).toISOString()}));
  }
  const demoTasks=makeDemo();
  const state={demo:new URLSearchParams(location.search).get('demo')==='1'||window.DASHBOARD_PREVIEW===true,view:'timeline',scale:'full',start:projectFirstMonth,expanded:new Set(),query:'',status:'all',owner:'all',sort:'phase'};
  const tasks=()=>state.demo?demoTasks:realTasks;
  const isActive = task => task.status!=='cancelled';
  const isOverdue = task => isActive(task) && task.status!=='done' && task.end && parseDay(task.end)<today;
  const progressOf = list => {const active=list.filter(isActive);return active.length?Math.round(active.reduce((n,t)=>n+t.progress,0)/active.length):null;};
  const statusChip = status => `<span class="status-chip ${status}">${icon(statuses[status].icon)}${statuses[status].label}</span>`;
  const phaseStyle = phase => `--phase-color:${phase.color};--phase-color2:${phase.color2}`;
  function filteredTasks() {
    return tasks().filter(t => (state.status==='all' || (state.status==='overdue'?isOverdue(t):t.status===state.status)) && (state.owner==='all' || (state.owner==='unassigned'?t.assignees.length===0:t.assignees.includes(state.owner))) && `${t.title} ${t.summary} ${t.number||''} ${phaseById(t.phase).title}`.toLocaleLowerCase().includes(state.query.toLocaleLowerCase()));
  }
  const hasFilters=()=>Boolean(state.query || state.status!=='all' || state.owner!=='all');
  function renderMetrics() {
    const all=tasks(),active=all.filter(isActive),done=active.filter(t=>t.status==='done').length,overdue=active.filter(isOverdue).length;
    const inProgress=active.filter(t=>t.status==='in-progress').length,review=active.filter(t=>t.status==='review').length,blocked=active.filter(t=>t.status==='blocked').length;
    const cards=[
      {name:'전체 업무',icon:'layers',value:active.length,unit:'개',sub:all.length===0?'첫 업무를 등록해 주세요':`완료 ${done} · 남은 업무 ${active.length-done}${all.length>active.length?` · 취소 ${all.length-active.length} 제외`:''}`},
      {name:'진행 중',icon:'progress',value:inProgress,unit:'개',sub:`검토 중 ${review} · 보류 ${blocked}`},
      {name:'기한 초과',icon:'calendar',value:overdue,unit:'개',sub:active.length===0?'업무 일정 등록 대기':overdue?`미완료 업무 ${overdue}개 확인 필요`:'기한을 넘긴 업무가 없습니다',warn:overdue>0}
    ];
    $('#metrics').innerHTML=cards.map(c=>`<div class="summary-stat"><span class="summary-stat-label">${c.name}${state.demo?' · 예시':''}</span><strong class="summary-stat-value${c.warn?' summary-stat-warning':''}">${c.value}<small>${c.unit}</small></strong><span class="summary-stat-note" title="${escape(c.sub)}">${escape(c.sub)}</span><span class="summary-stat-icon" aria-hidden="true">${icon(c.icon)}</span></div>`).join('');
  }
  function renderDataStatus() {
    $('#demo-banner').hidden=!state.demo;
    const synced=Boolean(source.generated_at && source.source==='github-issues');
    $('#data-status').innerHTML=state.demo?'<span class="status-light"></span><span>EXAMPLE DATA · 실제 현황과 분리된 화면 예시</span>':`<span class="status-light ${synced?'synced':''}"></span><span>${synced?`마지막 동기화 ${escape(timestampLabel(source.generated_at))}`:'등록된 실제 업무 없음 · 첫 데이터 동기화 대기'}</span>${source.warnings?.length?`<span title="입력 양식이 잘못된 일부 날짜는 미정으로 표시됩니다.">· 입력 확인 ${source.warnings.length}건</span>`:''}`;
  }
  function renderOwners() {
    const owners=[...new Set(tasks().flatMap(t=>t.assignees))].sort();
    if (state.owner!=='all'&&state.owner!=='unassigned'&&!owners.includes(state.owner)) state.owner='all';
    $('#owner-filter').innerHTML='<option value="all">모든 담당자</option><option value="unassigned">미지정</option>'+owners.map(owner=>`<option value="${escape(owner)}">${escape(owner)}</option>`).join('');
    $('#owner-filter').value=state.owner;
  }
  function timeGeometry() {
    const count=visibleMonths(),end=monthStart(state.start,count),days=(end-state.start)/DAY;
    const position=value=>100*(parseDay(value)-state.start)/DAY/days;
    const months=[];
    for(let n=0;n<count;n++){const d=monthStart(state.start,n),next=monthStart(state.start,n+1);months.push({date:d,left:100*(d-state.start)/DAY/days,width:100*(next-d)/DAY/days});}
    const ticks=[];
    if(state.scale==='full'){
      // Two legible date ticks per month, rather than 53 crowded weekly labels.
      for(const m of months){
        const length=(monthStart(m.date,1)-m.date)/DAY;
        for(const day of [0,14])ticks.push({left:m.left+day/days*100,width:(day===0?14:length-14)/days*100,label:day===0?'01':'15'});
      }
    } else {
      for(let day=0;day<days;day+=7){const d=addDays(state.start,day);ticks.push({left:day/days*100,width:Math.min(7,days-day)/days*100,label:state.scale==='week'?`${d.getUTCMonth()+1}/${d.getUTCDate()}`:String(d.getUTCDate()).padStart(2,'0')});}
    }
    const todayPosition=position(dayKey(today));
    return {end,days,position,months,ticks,todayPosition};
  }
  function gridMarkup(geo) {
    // Use each month's actual width, including 28-, 29-, 30- and 31-day months.
    const midMonth = geo.months.map(m=>`<i class="grid-line mid-month" style="left:${m.left+m.width/2}%" aria-hidden="true"></i>`).join('');
    return `<div class="gantt-grid">${geo.ticks.map(t=>`<i class="grid-line minor" style="left:${t.left}%"></i>`).join('')}${geo.months.map(m=>`<i class="grid-line" style="left:${m.left}%"></i>`).join('')}${midMonth}</div>${geo.todayPosition>=0&&geo.todayPosition<100?`<i class="today-line" style="left:${geo.todayPosition}%"></i>`:''}`;
  }
  function spanGeometry(start,end,geo) {
    if (!start&&!end) return null;
    const s=geo.position(start||end),e=geo.position(end||start)+100/geo.days;
    if(s>=100||e<=0)return {off:true};
    return {left:Math.max(0,s),width:Math.min(100,e)-Math.max(0,s),off:false};
  }
  function phaseRange(list) {
    const dates=list.filter(isActive).flatMap(t=>[t.start,t.end]).filter(Boolean).sort();
    return dates.length?{start:dates[0],end:dates.at(-1)}:null;
  }
  function phaseBar(phase,list,geo) {
    const range=phaseRange(list),span=range?spanGeometry(range.start,range.end,geo):null;
    if(!span)return `<div class="gantt-unscheduled">${list.length?'일정 미정':'업무 등록 대기'}</div>`;
    if(span.off)return '<div class="gantt-unscheduled">표시 기간 밖의 일정</div>';
    const progress=progressOf(list)??0;
    return `<button type="button" class="phase-bar mixed-progress" data-phase="${phase.id}" style="left:${span.left}%;width:${span.width}%;--progress:${progress}%" title="${escape(phase.title)} · ${range.start} ~ ${range.end} · ${progress}%"><span>${escape(phase.en)}</span><strong>${progress}%</strong></button>`;
  }
  function taskBar(task,geo) {
    const span=spanGeometry(task.start,task.end,geo);
    if(!span)return '<span class="gantt-unscheduled">일정 미정</span>';
    if(span.off)return '<span class="gantt-unscheduled">표시 기간 밖</span>';
    const milestone=task.kind==='milestone'||!(task.start&&task.end);
    return `<button type="button" class="task-bar${milestone?' milestone':''}" data-task="${escape(task.id)}" style="left:${span.left}%;width:${span.width}%" title="${escape(task.title)} · ${dateLabel(task.start)} ~ ${dateLabel(task.end)}" aria-label="${escape(task.title)} 상세 보기"><i style="width:${task.progress}%"></i><span>${escape(task.title)}</span></button>`;
  }
  function renderTimeline(list) {
    const geo=timeGeometry();
    const end=addDays(geo.end,-1);
    $('#range-label').textContent=`${monthLabel(state.start)} — ${monthLabel(end)}`;
    $('#previous-range').disabled=+state.start<=+projectFirstMonth;
    $('#next-range').disabled=+geo.end>=+projectEndExclusive;
    const phases=config.phases.filter(p => list.some(t=>t.phase===p.id) || (!hasFilters()&&p.id!=='00'));
    const todayHead=geo.todayPosition>=0&&geo.todayPosition<100?`<div class="today-head" style="left:${geo.todayPosition}%"><b>TODAY</b></div>`:'';
    const header=`<div class="gantt-head"><div class="gantt-label-header"><span>연구 단계 / 세부 업무</span><span>WORKSTREAM</span></div><div class="gantt-dates"><div class="gantt-months">${geo.months.map(m=>`<span class="gantt-month" style="left:${m.left}%;width:${m.width}%">${m.date.getUTCFullYear()}.${String(m.date.getUTCMonth()+1).padStart(2,'0')}</span>`).join('')}</div><div class="gantt-ticks">${geo.ticks.map(t=>`<span class="gantt-tick" style="left:${t.left}%;width:${t.width}%">${t.label}</span>`).join('')}</div>${todayHead}</div></div>`;
    const grid=gridMarkup(geo);
    const rows=phases.map(phase=>{
      const group=list.filter(t=>t.phase===phase.id),expanded=state.expanded.has(phase.id),progress=progressOf(group),scheduled=group.filter(t=>t.start||t.end).length;
      const range=phaseRange(group);
      const caption=group.length?`${group.length} TASKS · ${range?dateLabel(range.start,true)+'–'+dateLabel(range.end,true):'DATE TBD'}${group.length>scheduled?` · 미정 ${group.length-scheduled}`:''}`:'NO TASKS YET · DATE TBD';
      let html=`<div class="gantt-row" style="${phaseStyle(phase)}"><button type="button" class="phase-cell" data-phase="${phase.id}" aria-expanded="${expanded}" aria-label="${escape(phase.title)} ${expanded?'접기':'펼치기'}"><span class="phase-number">${phase.id}</span><span class="phase-cell-title"><strong>${escape(phase.title)}</strong><small>${caption}</small></span><svg class="phase-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button><div class="gantt-track">${grid}${phaseBar(phase,group,geo)}</div></div>`;
      if(expanded){
        if(!group.length) html+=`<div class="task-empty-row">이 단계에 등록된 업무가 없습니다.<a href="${repositoryUrl}/issues/new?template=task.yml" target="_blank" rel="noopener noreferrer">GitHub에서 등록 ↗</a></div>`;
        html+=group.map(t=>`<div class="gantt-row gantt-task-row" style="${phaseStyle(phase)}"><button type="button" class="task-cell" data-task="${escape(t.id)}"><span class="status-symbol ${t.status}">${icon(statuses[t.status].icon)}</span><strong>${escape(t.title)}</strong><span class="task-number">${t.number?'#'+t.number:'예시'}</span></button><div class="gantt-track">${grid}${taskBar(t,geo)}</div></div>`).join('');
      }
      return html;
    }).join('');
    $('#timeline-view').innerHTML=`<div class="gantt-scroll" tabindex="0" aria-label="일정표. 좌우로 스크롤하여 전체 기간을 볼 수 있습니다."><div class="gantt" data-scale="${state.scale}">${header}${rows}</div></div>${tasks().length===0?'<div class="gantt-bottom-note">아직 등록된 업무가 없습니다. 날짜와 진행률은 업무 등록 후 표시됩니다.</div>':''}`;
    const allExpanded=phases.length>0&&phases.every(p=>state.expanded.has(p.id));
    $('#expand-all').innerHTML=icon('unfold')+`<span>${allExpanded?'전체 접기':'전체 펼치기'}</span>`;
    $('#expand-all').dataset.expanded=String(allExpanded);
  }
  function emptyMarkup() {return `<div class="empty-state"><h3>첫 번째 업무를 기다리고 있습니다.</h3><p>GitHub에서 업무를 작성하고 dashboard 라벨을 추가하세요.</p><a class="button button-primary" href="${repositoryUrl}/issues/new?template=task.yml" target="_blank" rel="noopener noreferrer">${icon('plus')}업무 등록</a></div>`;}
  function renderList(list) {
    if(!list.length){$('#list-view').innerHTML=hasFilters()?'':emptyMarkup();return;}
    const sorted=[...list].sort((a,b)=>a.phase.localeCompare(b.phase)||(a.start||'9999').localeCompare(b.start||'9999')||a.title.localeCompare(b.title));
    $('#list-view').innerHTML=`<div class="list-wrap"><table class="task-table"><thead><tr><th scope="col">업무</th><th scope="col">연구 단계</th><th scope="col">상태</th><th scope="col">담당자</th><th scope="col">종료일</th><th scope="col">진행률</th></tr></thead><tbody>${sorted.map(t=>`<tr><td><button class="table-task-link" type="button" data-task="${escape(t.id)}">${escape(t.title)}<span class="table-task-id">${t.number?'#'+t.number:'예시 업무'}${t.kind==='milestone'?' · MILESTONE':''}</span></button></td><td>${escape(phaseById(t.phase).title)}</td><td>${statusChip(t.status)}</td><td>${escape(t.assignees.join(', ')||'미지정')}</td><td${isOverdue(t)?' class="overdue-text"':''}>${dateLabel(t.end)}${isOverdue(t)?' · 초과':''}</td><td><div class="table-progress"><i><b style="width:${t.progress}%"></b></i>${t.status==='cancelled'?'—':t.progress+'%'}</div></td></tr>`).join('')}</tbody></table></div>`;
  }
  function renderBoard(list) {
    if(!list.length&&!hasFilters()){$('#board-view').innerHTML=emptyMarkup();return;}
    const keys=['planned','in-progress','review','blocked','done'];if(list.some(t=>t.status==='cancelled'))keys.push('cancelled');
    $('#board-view').innerHTML=`<div class="board-scroll"><div class="board" style="--columns:${keys.length}">${keys.map(key=>{const items=list.filter(t=>t.status===key);return `<section class="board-column" aria-label="${statuses[key].label}"><div class="board-title"><span class="${key}">${statuses[key].label}</span><b>${items.length}</b></div>${items.length?items.map(t=>`<button type="button" class="task-card" data-task="${escape(t.id)}" style="${phaseStyle(phaseById(t.phase))}"><div class="card-phase">${escape(phaseById(t.phase).title)}</div><strong>${escape(t.title)}</strong><div class="card-foot"><span${isOverdue(t)?' class="overdue-text"':''}>${t.end?dateLabel(t.end,true)+' 마감':'일정 미정'}</span><span class="avatar" title="${escape(t.assignees.join(', ')||'담당자 미지정')}">${escape(t.assignees[0]?.slice(0,2).toUpperCase()||'—')}</span></div></button>`).join(''):'<div class="board-empty">등록된 업무 없음</div>'}</section>`;}).join('')}</div></div>`;
  }
  function renderRecent() {
    const recent=[...tasks()].sort((a,b)=>(Date.parse(b.updated_at)||0)-(Date.parse(a.updated_at)||0)).slice(0,8);
    $('#recent-updates').innerHTML=recent.length?recent.map(t=>`<button class="activity-item" type="button" data-task="${escape(t.id)}" style="${phaseStyle(phaseById(t.phase))}"><i class="activity-dot"></i><strong>${escape(t.title)}</strong><span>${escape(timestampLabel(t.updated_at))}</span></button>`).join(''):'<div class="activity-empty">실제 업무가 등록되면 최근 수정한 내용이 여기에 표시됩니다.</div>';
  }
  function renderReports() {
    const recent = Array.isArray(reportSource.reports) ? reportSource.reports.slice(0,8) : [];
    const destination = $('#recent-reports');
    if (!destination) return;
    if (reportLoadState === 'loading') {
      destination.innerHTML = '<div class="activity-empty">최근 리포트 목록을 확인하는 중입니다.</div>';
      return;
    }
    if (reportLoadState === 'error') {
      destination.innerHTML = '<div class="activity-empty">리포트 목록을 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요.</div>';
      return;
    }
    destination.innerHTML = recent.length ? recent.map(report => `<a class="activity-item report-activity" href="${escape(report.url)}" target="_blank" rel="noopener noreferrer"><i class="activity-dot"></i><strong>${escape(report.title)}</strong><span>${escape(timestampLabel(report.updated_at))}</span></a>`).join('') : '<div class="activity-empty">등록된 리포트가 없습니다. 작성한 HTML 파일을 GitHub의 reports/weekly/ 폴더에 업로드하세요.</div>';
  }
  // JSON is fetched with a unique URL. Unlike a preloaded JS feed, deletions
  // cannot leave outdated entries visible when the network is unavailable.
  async function refreshReports() {
    const requestId = ++reportRequestId;
    try {
      const response = await fetch(`./report-data.json?refresh=${Date.now()}`, {
        cache:'no-store', credentials:'omit'
      });
      if (!response.ok) throw new Error('Report feed HTTP ' + response.status);
      const payload = await response.json();
      if (!payload || !Array.isArray(payload.reports)) throw new Error('Invalid report feed');
      if (requestId !== reportRequestId) return;
      const trustedPrefix = new URL('./reports/weekly/', document.baseURI).href;
      reportSource = {reports:payload.reports.filter(report =>
        report && typeof report.title==='string' &&
        typeof report.url==='string' && report.url.startsWith(trustedPrefix) &&
        Number.isFinite(Date.parse(report.updated_at))
      ).slice(0,8)};
      reportLoadState = 'ready';
      renderReports();
    } catch {
      if (requestId !== reportRequestId) return;
      reportSource = {reports: []};
      reportLoadState = 'error';
      renderReports();
    }
  }
  function startReportUpdates() {
    refreshReports();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) return refreshReports();
    });
    window.addEventListener('focus', () => {
      if (!document.hidden) return refreshReports();
    });
    window.setInterval(() => {
      if (!document.hidden) return refreshReports();
    }, 60_000);
  }
  function renderWorkspace() {
    const list=filteredTasks();
    $('#filtered-count').textContent=`${list.length}개 업무${state.demo?' · 예시':''}`;
    $('#no-results').hidden=!(hasFilters()&&list.length===0);
    ['timeline','list','board'].forEach(view => { $(`#${view}-view`).hidden=state.view!==view || (hasFilters()&&!list.length);});
    $$('#workspace [data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===state.view)));
    $$('#workspace [data-scale]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scale===state.scale)));
    $('#timeline-controls').hidden=state.view!=='timeline';
    renderTimeline(list);renderList(list);renderBoard(list);
  }
  function renderAll() {renderDataStatus();renderMetrics();renderOwners();renderWorkspace();renderRecent();renderReports();}
  function setDemo(value) {
    $('#task-dialog').close();state.demo=value;state.expanded.clear();state.query='';state.status='all';state.owner='all';state.scale='full';state.start=projectFirstMonth;
    $('#search').value='';$('#status-filter').value='all';
    try{const url=new URL(location.href);if(value)url.searchParams.set('demo','1');else url.searchParams.delete('demo');history.replaceState(null,'',url);}catch{}
    renderAll();
  }
  function openTask(id) {
    const task=tasks().find(t=>t.id===id);if(!task)return;
    const phase=phaseById(task.phase);
    $('#dialog-kicker').textContent=task.number?`ISSUE #${task.number} / TASK DETAIL`:'EXAMPLE / TASK DETAIL';
    const summary=task.summary || '공개 요약이 등록되지 않았습니다. 자세한 내용은 GitHub Issue에서 확인하세요.';
    $('#dialog-content').innerHTML=`${state.demo?'<div class="detail-demo-notice">이 업무는 가상 예시입니다. 실제 프로젝트 데이터가 아닙니다.</div>':''}<div class="dialog-tags"><span class="phase-chip" style="${phaseStyle(phase)}">${phase.id} · ${escape(phase.title)}</span>${statusChip(task.status)}</div><h2 id="dialog-title">${escape(task.title)}</h2><p class="dialog-summary">${escape(summary)}</p><dl class="detail-grid"><div><dt>시작일</dt><dd>${dateLabel(task.start)}</dd></div><div><dt>종료일</dt><dd${isOverdue(task)?' class="overdue-text"':''}>${dateLabel(task.end)}${isOverdue(task)?' · 기한 초과':''}</dd></div><div><dt>담당자</dt><dd>${escape(task.assignees.join(', ')||'미지정')}</dd></div><div><dt>업무 유형</dt><dd>${task.kind==='milestone'?'마일스톤':'일반 업무'}</dd></div></dl><div class="detail-progress"><div><span>진행률</span><strong>${task.status==='cancelled'?'취소 · 집계 제외':task.progress+'%'}</strong></div><div class="detail-progress-track"><i style="width:${task.progress}%"></i></div><small>${task.status==='done'?'Completed 상태로 종료된 업무입니다.':task.progress_source==='checklist'?'체크리스트 완료 비율로 계산합니다.':'등록한 진행률을 사용합니다. 날짜 경과율이 아닙니다.'}</small></div>${task.checklist.length?`<div class="detail-checklist"><h3>체크리스트 · ${task.checklist.filter(t=>t.done).length}/${task.checklist.length}</h3>${task.checklist.map(t=>`<div class="check-item${t.done?' checked':''}">${icon(t.done?'check-circle':'square')}<span>${escape(t.text)}</span></div>`).join('')}</div>`:''}<div class="dialog-actions"><a class="button button-primary" href="${task.url||repositoryUrl+'/issues/new?template=task.yml'}" target="_blank" rel="noopener noreferrer">${icon('github')}${task.url?'GitHub에서 보기·수정':'이 형식으로 실제 업무 등록'}${icon('arrow-up-right')}</a>${task.url?`<button class="button button-outline" type="button" data-copy-issue="${task.number}">${icon('copy')}링크 복사</button>`:''}</div><div class="dialog-updated">최근 수정 ${escape(timestampLabel(task.updated_at))}</div>`;
    $('#task-dialog').showModal();
  }
  function toast(message) {$('#toast').textContent=message;$('#toast').hidden=false;setTimeout(()=>{$('#toast').hidden=true;},3500);}
  document.addEventListener('click',async event=>{
    const target=event.target.closest('button');if(!target)return;
    if(target.dataset.phase){const id=target.dataset.phase;state.expanded.has(id)?state.expanded.delete(id):state.expanded.add(id);const scroll=$('.gantt-scroll')?.scrollLeft||0;renderWorkspace();$('.gantt-scroll').scrollLeft=scroll;const replacement=$(`.phase-cell[data-phase="${id}"]`);replacement?.focus({preventScroll:true});}
    else if(target.dataset.task)openTask(target.dataset.task);
    else if(target.dataset.view){state.view=target.dataset.view;renderWorkspace();}
    else if(target.dataset.scale){state.scale=target.dataset.scale;state.start=state.scale==='full'?projectFirstMonth:clampStart(state.start);renderWorkspace();}
    else if(target.classList.contains('dialog-close'))target.closest('dialog').close();
    else if(target.dataset.copyIssue){const link=`${repositoryUrl}/issues/${Number(target.dataset.copyIssue)}`;try{await navigator.clipboard.writeText(link);toast('Issue 링크를 복사했습니다.');}catch{toast('복사 권한이 없습니다. GitHub에서 링크를 복사해 주세요.');}}
  });
  $('#search').addEventListener('input',event=>{state.query=event.target.value;renderWorkspace();});
  $('#status-filter').addEventListener('change',event=>{state.status=event.target.value;renderWorkspace();});
  $('#owner-filter').addEventListener('change',event=>{state.owner=event.target.value;renderWorkspace();});
  $('#reset-filters').addEventListener('click',()=>{state.query='';state.status='all';state.owner='all';$('#search').value='';$('#status-filter').value='all';$('#owner-filter').value='all';renderWorkspace();});
  $('#exit-demo').addEventListener('click',()=>setDemo(false));
  $('#previous-range').addEventListener('click',()=>{state.start=clampStart(monthStart(state.start,state.scale==='month'?-3:-1));renderWorkspace();});
  $('#next-range').addEventListener('click',()=>{state.start=clampStart(monthStart(state.start,state.scale==='month'?3:1));renderWorkspace();});
  $('#today-button').addEventListener('click',()=>{
    if(today<projectStart||today>projectEnd){toast('오늘은 설정된 프로젝트 기간 밖입니다.');return;}
    state.start=state.scale==='full'?projectFirstMonth:clampStart(today);
    renderWorkspace();
    const scroller=$('.gantt-scroll'),track=$('.gantt-dates');
    if(scroller&&track){
      const labelWidth=$('.gantt-label-header').offsetWidth;
      const target=labelWidth+track.offsetWidth*timeGeometry().todayPosition/100;
      scroller.scrollLeft=Math.max(0,target-labelWidth-(scroller.clientWidth-labelWidth)/2);
    }
  });
  $('#expand-all').addEventListener('click',()=>{if($('#expand-all').dataset.expanded==='true')state.expanded.clear();else config.phases.forEach(p=>state.expanded.add(p.id));renderWorkspace();});
  $('#refresh').addEventListener('click',()=>location.reload());
  $$('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}}));
  document.addEventListener('keydown',event=>{if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!$('dialog[open]')&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){event.preventDefault();$('#search').focus();}});
  $$('[data-repo-link]').forEach(link=>link.href=repositoryUrl);
  $('#new-issue').href=`${repositoryUrl}/issues/new?template=task.yml`;
  // Brand the page from the reusable project configuration.
  const h=$('#project-title');
  if (h) {
    if ($('#hero-primary')) $('#hero-primary').textContent=config.titlePrimary||'Research';
    if ($('#hero-accent')) $('#hero-accent').textContent=config.titleAccent||'Project Dashboard';
  }
  document.title=(config.title||'Research Project')+' · Project dashboard';
  if ($('.hero-subtitle')) $('.hero-subtitle').textContent=config.subtitle||'';
  if ($('#hero-kicker-text')) $('#hero-kicker-text').textContent=config.kicker||'FROM IDEA TO IMPACT';
  for(const [selector,value] of [
    ['#brand-organization',config.organizationShort],
    ['#footer-organization',config.organization],
    ['#footer-project',config.title],
    ['#footer-year',config.copyrightYear],
    ['#footer-copyright-organization',config.organization]
  ]){const el=$(selector);if(el)el.textContent=value||'';}
  const period=document.createElement('p');
  period.id='project-period';period.className='project-period';
  period.textContent=`프로젝트 전체 기간  ${monthLabel(projectStart)} ~ ${monthLabel(projectEnd)} · ${projectMonths}개월`;
  $('.hero-subtitle').after(period);
  const fullButton=document.createElement('button');
  fullButton.type='button';fullButton.dataset.scale='full';fullButton.textContent='전체';
  fullButton.setAttribute('aria-label','프로젝트 전체 기간 보기');
  $('.scale-switch').prepend(fullButton);
  renderIcons();renderAll();startReportUpdates();
})();
