/* One-file project settings. Edit labels and dates; never put secrets here. */
(() => {
  'use strict';
  // Repositories created from this kit self-identify on GitHub Pages.
  // Set the fallback for local previews or custom-domain deployments.
  const host=window.location?.hostname || '';
  const slug=window.location?.pathname?.split('/').filter(Boolean)[0] || '';
  const owner=host.endsWith('.github.io') ? host.slice(0,-'.github.io'.length) : '';
  window.DASHBOARD_CONFIG=Object.freeze({
    repository: owner && slug ? `${owner}/${slug}` : 'YOUR-OWNER/YOUR-PROJECT-REPO',
    title: 'Research Project Dashboard',
    titlePrimary: 'Research',
    titleAccent: 'Project Dashboard',
    subtitle: '연구 기획부터 성과 정리까지. 프로젝트의 모든 단계를 한눈에.',
    kicker: 'FROM IDEA TO IMPACT',
    organization: 'Research Project Team',
    organizationShort: 'RESEARCH',
    copyrightYear: '2026',
    timezone: 'Asia/Seoul',
    projectStart: '2026-10-01',
    projectEnd: '2027-09-30',
    targetDate: null,
    projectUrl: null,
    phases: [
      {id:'01',title:'기획·목표 설정',en:'Planning & goals',deliverable:'목표·기획 문서',color:'#c8e9a3',color2:'#86c3a1'},
      {id:'02',title:'자료조사·요구사항',en:'Research & requirements',deliverable:'자료조사·요구사항',color:'#a9ddae',color2:'#70bfb5'},
      {id:'03',title:'개발·실험 설계',en:'Development & design',deliverable:'설계·실험 계획',color:'#84d2ba',color2:'#669cac'},
      {id:'04',title:'구현·검증',en:'Implementation & validation',deliverable:'검증 결과',color:'#89c7bb',color2:'#7e9bb0'},
      {id:'05',title:'평가·분석',en:'Evaluation & analysis',deliverable:'평가·분석 자료',color:'#a4c0b6',color2:'#8399ae'},
      {id:'06',title:'성과·마무리',en:'Outcomes & reporting',deliverable:'최종 결과 보고서',color:'#b8ccb1',color2:'#91abb4'},
      {id:'00',title:'미분류',en:'Uncategorized',color:'#a8b1b8',color2:'#697986'}
    ]
  });
})();
