(function(){
  'use strict';
  const opened=new Set();let pending=null;
  const plans=()=>state.projects.plans||[];
  const projectFor=plan=>ProjectCore.catalog.find(project=>project.id===plan.projectId);
  const stageLabel=stage=>stage==='start'?'Start':stage==='review'?'Check':'Build';
  function render(){
    const list=byId('projectPlanList');if(!list)return;
    for(const detail of list.querySelectorAll('[data-project-plan-details]')){
      const id=detail.dataset.projectPlanDetails;if(detail.open&&plans().some(plan=>plan.id===id))opened.add(id);else opened.delete(id);
    }
    byId('projectPlanCount').textContent=`${plans().length} linked`;
    list.innerHTML=plans().length?plans().map(plan=>{
      const project=projectFor(plan),progress=ProjectCore.planProgress(plan,state.tasks),percent=Math.round(progress.done/progress.total*100);
      const milestones=plan.milestones.map(step=>{
        const task=state.tasks.find(item=>item.id===step.taskId);
        return task?`<li class="project-plan-step"><div class="row wrap"><span class="small-badge">${stageLabel(step.stage)}</span><button class="linkish tiny" data-project-focus="${esc(task.id)}" ${task.done?'disabled':''}>Select for focus →</button></div>${taskHTML(task)}</li>`:`<li class="project-plan-step project-plan-missing"><strong>${esc(step.name)}</strong><p class="tiny muted">${esc(fmtDate(step.date))} · ${step.minutes} min · Mission removed from Plan. It still counts as incomplete.</p><button class="btn sm" data-project-restore="${esc(step.taskId)}" data-project-plan-id="${esc(plan.id)}">Restore original mission</button></li>`;
      }).join('');
      return `<article class="project-plan-card" id="project-plan-${esc(plan.id)}"><div class="section-head wrap"><h3 id="project-plan-title-${esc(plan.id)}" tabindex="-1">${esc(project.title)}</h3><span class="small-badge" data-project-plan-progress="${esc(plan.id)}">${progress.done}/${progress.total} marked complete</span></div><p class="tiny muted">${esc(project.track)} · ${esc(project.level)} · Original start ${esc(fmtDate(plan.milestones[0].date,{month:"short",day:"numeric",year:"numeric"}))} · ${plan.workdays==='weekdays'?'Weekdays':'Every day'}</p><div class="progress"><div class="fill" style="width:${percent}%"></div></div><p class="tiny muted">${progress.complete?'All milestones are marked complete. Review the result against the project’s quality check.':`${progress.missing?`${progress.missing} missing mission${progress.missing===1?'':'s'}. `:''}Mark completed missions here or in your daily plan. Focus time alone does not complete a mission.`}</p><details data-project-plan-details="${esc(plan.id)}" ${opened.has(plan.id)?'open':''}><summary>Milestones (${progress.total})</summary><ol class="project-plan-milestones">${milestones}</ol></details><div class="row wrap extra-space"><button class="btn sm" data-go="plan">Open daily plan</button><button class="btn sm danger" data-project-unlink="${esc(plan.id)}">Unlink project</button></div></article>`;
    }).join(''):'<div class="empty">Choose Plan project on a recommendation to preview a schedule before adding missions.</div>';
  }
  function reveal(id){
    const card=byId('project-plan-'+id);if(!card)return;
    const details=card.querySelector('details');details.open=true;opened.add(id);
    card.scrollIntoView({block:'start',behavior:'instant'});byId('project-plan-title-'+id).focus({preventScroll:true});
  }
  function updatePreview(){
    if(!pending)return;
    const status=byId('projectPlanStatus'),submit=byId('projectPlanCreate');
    try{
      const startDate=byId('projectPlanStart').value,workdays=byId('projectPlanPattern').value;
      if(startDate<todayKey())throw Error('Choose today or a later start date.');
      pending.result=ProjectCore.makePlan(pending.projectId,{id:pending.id,startDate,workdays});
      const {plan,tasks}=pending.result,total=tasks.reduce((sum,task)=>sum+task.minutes,0);
      byId('projectPlanPreview').innerHTML=`<p><strong>${tasks.length} work blocks · about ${total} minutes total</strong></p><ol>${plan.milestones.map(step=>`<li><div class="row wrap"><strong>${esc(fmtDate(step.date,{weekday:'short',month:'short',day:'numeric',year:'numeric'}))}</strong><span class="small-badge">${stageLabel(step.stage)} · ${step.minutes} min</span></div><p>${esc(step.name)}</p></li>`).join('')}</ol>`;
      status.textContent='One block per selected workday. You can edit each mission’s date, duration and name after creating the plan.';
      submit.disabled=false;submit.textContent=`Add ${tasks.length} missions`;
    }catch(error){pending.result=null;byId('projectPlanPreview').innerHTML='';status.textContent=error.message||'Choose a valid date and work pattern.';submit.disabled=true;}
  }
  function open(projectId){
    const existing=plans().find(plan=>plan.projectId===projectId);if(existing){reveal(existing.id);return;}
    const project=ProjectCore.catalog.find(item=>item.id===projectId);if(!project)return;
    pending={projectId,id:`plan-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,result:null};
    openModal('Plan '+project.title,`<form id="projectPlanForm"><p class="muted">${esc(project.summary)}</p><div class="form-grid"><div class="field"><label for="projectPlanStart">Start date</label><input id="projectPlanStart" type="date" min="${todayKey()}" value="${todayKey()}" required></div><div class="field"><label for="projectPlanPattern">Study days</label><select id="projectPlanPattern"><option value="daily">Every day</option><option value="weekdays">Weekdays only</option></select></div></div><div id="projectPlanPreview" class="project-plan-preview" tabindex="0" role="region" aria-label="Project schedule preview"></div><p id="projectPlanStatus" class="tiny muted" role="status" aria-live="polite"></p><p class="tiny muted">These are time estimates and a suggested sequence. No timer starts and no mission is added until you choose Add missions.</p><button class="btn primary" id="projectPlanCreate" type="submit">Add missions</button></form>`);
    byId('projectPlanStart').oninput=updatePreview;byId('projectPlanPattern').onchange=updatePreview;
    byId('projectPlanForm').onsubmit=event=>{
      event.preventDefault();updatePreview();if(!pending?.result)return;
      if(plans().some(plan=>plan.projectId===projectId)){closeModal();return;}
      const {plan,tasks}=pending.result;
      if(tasks.some(task=>state.tasks.some(saved=>saved.id===task.id))){byId('projectPlanStatus').textContent='These mission IDs already exist. Close this preview and try again.';return;}
      state.projects.plans||=[];state.projects.plans.push(plan);state.tasks.push(...tasks);save();
      closeModal(()=>{renderAll();reveal(plan.id);toast(`Added ${tasks.length} project missions.`)});
    };
    updatePreview();
  }
  function announceTask(taskId){
    const plan=plans().find(plan=>plan.milestones.some(step=>step.taskId===taskId));if(!plan)return;
    const progress=ProjectCore.planProgress(plan,state.tasks);
    byId('projectPlanLiveStatus').textContent=`${projectFor(plan).title}: ${progress.done} of ${progress.total} milestones marked complete${progress.missing?`, ${progress.missing} missing`:''}.`;
  }
  function selectForFocus(taskId){
    const task=state.tasks.find(item=>item.id===taskId);if(!task||task.done)return;
    go('today');
    if(state.focus.active){if(state.focus.active.taskId===taskId)openFocusMode();else toast('A different focus session is active. End it before choosing another mission.');return;}
    renderFocusTaskOptions();byId('focusTaskSelect').value=taskId;selectPlannedFocusDuration();
    byId('timerReadout').scrollIntoView({block:'center',behavior:'instant'});byId('timerToggle').focus({preventScroll:true});toast('Mission selected. Start the timer when ready.');
  }
  document.addEventListener('click',event=>{
    const planButton=event.target.closest('[data-project-plan]');if(planButton){open(planButton.dataset.projectPlan);return;}
    const focus=event.target.closest('[data-project-focus]');if(focus){selectForFocus(focus.dataset.projectFocus);return;}
    const unlink=event.target.closest('[data-project-unlink]');if(unlink){if(!confirm('Remove this project’s tracking link? Its missions will stay in your daily plan.'))return;state.projects.plans=plans().filter(plan=>plan.id!==unlink.dataset.projectUnlink);save();renderAll();byId('projectPlansHeading').focus();toast('Project unlinked. Its missions remain in Plan.');return;}
    const restore=event.target.closest('[data-project-restore]');if(restore){
      const plan=plans().find(plan=>plan.id===restore.dataset.projectPlanId),step=plan?.milestones.find(step=>step.taskId===restore.dataset.projectRestore);if(!step||state.tasks.some(task=>task.id===step.taskId))return;
      state.tasks.push({id:step.taskId,name:step.name,category:projectFor(plan).track,date:step.date,minutes:step.minutes,done:false});save();renderAll();focusTaskControl(step.taskId,'view-projects','taskCheck');announceTask(step.taskId);toast('Original mission restored.');
    }
  });
  byId('modalCover').addEventListener('close',()=>{pending=null});
  window.ProjectPlannerUI={render,announceTask};render();
})();
