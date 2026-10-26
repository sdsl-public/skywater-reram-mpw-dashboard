/* Public project team dialog. Configure members in config.js (projectTeam). */
(() => {
  'use strict';
  const button=document.getElementById('project-team-button');
  const dialog=document.getElementById('project-team-dialog');
  const list=document.getElementById('project-team-list');
  if(!button||!dialog||!list)return;
  const members=Array.isArray(window.DASHBOARD_CONFIG?.projectTeam)?window.DASHBOARD_CONFIG.projectTeam:[];
  if(!members.length){
    const empty=document.createElement('p');
    empty.className='project-team-empty';
    empty.textContent='참여 연구원 정보가 등록되지 않았습니다.';
    list.append(empty);
  }else{
    const ul=document.createElement('ul');
    ul.className='project-team-members';
    for(const member of members){
      if(!member||typeof member.name!=='string'||!member.name.trim())continue;
      const li=document.createElement('li');
      const nameGroup=document.createElement('span');
      nameGroup.className='project-team-member-name';
      // Static SVG markup; member-provided text is inserted via textContent.
      nameGroup.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="7.5" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg>';
      const name=document.createElement('strong');
      name.textContent=member.name;
      nameGroup.append(name);
      li.append(nameGroup);
      if(typeof member.role==='string'&&member.role.trim()){
        const role=document.createElement('span');
        role.className='project-team-member-role';
        role.textContent=member.role;
        li.append(role);
      }
      ul.append(li);
    }
    if(ul.children.length)list.append(ul);
    else list.textContent='참여 연구원 정보가 등록되지 않았습니다.';
  }
  button.addEventListener('click',()=>{if(!dialog.open)dialog.showModal();});
  dialog.querySelector('.project-team-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const r=dialog.getBoundingClientRect();
    if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();
  });
})();
