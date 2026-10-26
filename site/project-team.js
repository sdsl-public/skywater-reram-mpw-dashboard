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
      const name=document.createElement('strong');
      name.textContent=member.name;
      li.append(name);
      if(typeof member.role==='string'&&member.role.trim()){
        const role=document.createElement('span');
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
