'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('forgeDesktop', {
  runtimeInfo: Object.freeze({qaProfile:Boolean(process.env.FORGE_QA_PROFILE),forceOnboarding:process.env.FORGE_QA_ONBOARDING==='1'}),
  exportBackup: data => ipcRenderer.invoke('forge:export-backup', data),
  getAmcCatalog: () => ipcRenderer.invoke('forge:amc-catalog'),
  getAmcPdf: (id,kind) => ipcRenderer.invoke('forge:amc-pdf',id,kind),
  openAmcSource: (id,kind) => ipcRenderer.invoke('forge:amc-source',id,kind),
  coachStatus:()=>ipcRenderer.invoke('forge:coach-status'),
  coachConnect:()=>ipcRenderer.invoke('forge:coach-connect'),
  coachDisconnect:()=>ipcRenderer.invoke('forge:coach-disconnect'),
  coachCheck:()=>ipcRenderer.invoke('forge:coach-check'),
  coachTopics:()=>ipcRenderer.invoke('forge:coach-topics'),
  coachRequest:payload=>ipcRenderer.invoke('forge:coach-request',payload),
  coachConversation:payload=>ipcRenderer.invoke('forge:coach-conversation',payload),
  coachCancel:()=>ipcRenderer.invoke('forge:coach-cancel'),
  codeforcesContests:()=>ipcRenderer.invoke('forge:codeforces-contests'),
  runnerStatus:force=>ipcRenderer.invoke('forge:runner-status',force===true),
  runnerRun:payload=>ipcRenderer.invoke('forge:runner-run',payload),
  runnerCancel:()=>ipcRenderer.invoke('forge:runner-cancel'),
  runnerPrivacy:()=>ipcRenderer.invoke('forge:runner-privacy'),
  exportLessonPptx:payload=>ipcRenderer.invoke('forge:lesson-export-pptx',payload),
  coachOpenSource:url=>ipcRenderer.invoke('forge:coach-source',url)
});
ipcRenderer.on('forge:request-export', () => window.dispatchEvent(new Event('forge-export')));
