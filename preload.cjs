'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('forgeDesktop', {
  runtimeInfo: Object.freeze({qaProfile:Boolean(process.env.FORGE_QA_PROFILE),forceOnboarding:process.env.FORGE_QA_ONBOARDING==='1'}),
  exportBackup: data => ipcRenderer.invoke('forge:export-backup', data),
  exportRecovery: data => ipcRenderer.invoke('forge:export-recovery', data),
  getAmcCatalog: () => ipcRenderer.invoke('forge:amc-catalog'),
  getAmcPdf: (id,kind) => ipcRenderer.invoke('forge:amc-pdf',id,kind),
  openAmcSource: (id,kind) => ipcRenderer.invoke('forge:amc-source',id,kind),
  coachStatus:()=>ipcRenderer.invoke('forge:coach-status'),
  coachConnect:()=>ipcRenderer.invoke('forge:coach-connect'),
  coachDisconnect:()=>ipcRenderer.invoke('forge:coach-disconnect'),
  coachCheck:()=>ipcRenderer.invoke('forge:coach-check'),
  coachTopics:()=>ipcRenderer.invoke('forge:coach-topics'),
  coachRequest:payload=>ipcRenderer.invoke('forge:coach-request',payload),
  liveLab:payload=>ipcRenderer.invoke('forge:livelab',payload),
  liveLabStep:payload=>ipcRenderer.invoke('forge:livelab-step',payload),
  coachConversation:payload=>ipcRenderer.invoke('forge:coach-conversation',payload),
  onCoachStream:callback=>{
    if(typeof callback!=='function')throw Error('A stream callback is required.');
    const listener=(_event,message)=>callback(message);
    ipcRenderer.on('forge:coach-stream',listener);
    return ()=>ipcRenderer.removeListener('forge:coach-stream',listener);
  },
  coachCancel:()=>ipcRenderer.invoke('forge:coach-cancel'),
  codeforcesContests:()=>ipcRenderer.invoke('forge:codeforces-contests'),
  runnerStatus:force=>ipcRenderer.invoke('forge:runner-status',force===true),
  runnerRun:payload=>ipcRenderer.invoke('forge:runner-run',payload),
  runnerCancel:()=>ipcRenderer.invoke('forge:runner-cancel'),
  runnerPrivacy:()=>ipcRenderer.invoke('forge:runner-privacy'),
  exportLessonPptx:payload=>ipcRenderer.invoke('forge:lesson-export-pptx',payload),
  coachOpenSource:url=>ipcRenderer.invoke('forge:coach-source',url),
  copyText:text=>ipcRenderer.invoke('forge:copy-text',text),
  openLearningLink:url=>ipcRenderer.invoke('forge:open-learning-link',url)
});
ipcRenderer.on('forge:request-export', () => window.dispatchEvent(new Event('forge-export')));
