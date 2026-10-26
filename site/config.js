/* Public configuration only. Never place tokens, PDK files or internal URLs here. */
window.DASHBOARD_CONFIG = Object.freeze({
  repository: 'sdsl-public/skywater-reram-mpw-dashboard',
  title: 'SkyWater ReRAM MPW',
  timezone: 'Asia/Seoul',
  // Public team members: {name: 'Name', role: 'Role'}. Leave empty until confirmed.
  projectTeam: [
  { name: 'Min-Hwi Kim', role: 'Project Lead' },
  { name: 'Wonki Hong', role: 'Circuit Design' },
  { name: 'Junha Jang', role: 'Device Modeling' },
    { name: 'Seung Hwan Jeong', role: 'Layout & verification' },
    { name: 'Hyeon Seong Cho', role: 'Characterization & analysis' },
  ],
  // Fixed public project window. Individual Issue dates are not rewritten.
  projectStart: '2026-10-01',
  projectEnd: '2027-09-30',
  targetDate: null,
  projectUrl: null,
  phases: [
    {id: '01', title: '자료조사∙기획', en: 'Research & planning', color: '#c8e9a3', color2: '#86c3a1'},
    {id: '02', title: 'PDK·설계 환경', en: 'PDK & design environment', color: '#a9ddae', color2: '#70bfb5'},
    {id: '03', title: '회로·어레이 설계', en: 'Circuit & array design', color: '#84d2ba', color2: '#669cac'},
    {id: '04', title: '레이아웃·검증', en: 'Layout & verification', color: '#89c7bb', color2: '#7e9bb0'},
    {id: '05', title: '테이프아웃·제작', en: 'Tape-out & fabrication', color: '#a4c0b6', color2: '#8399ae'},
    {id: '06', title: '측정·결과 분석', en: 'Characterization & analysis', color: '#b8ccb1', color2: '#91abb4'},
    {id: '00', title: '미분류', en: 'Uncategorized', color: '#a8b1b8', color2: '#697986'}
  ]
});
