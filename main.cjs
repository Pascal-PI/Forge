'use strict';

const { app, BrowserWindow, dialog, ipcMain, Menu, protocol, session, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createCoach } = require('./coach.cjs');
const { createCodeforces } = require('./codeforces.cjs');
const { createRunner } = require('./runner.cjs');
const { normalizeLessonExport, createLessonPresentation, lessonFilename } = require('./lesson-pptx.cjs');

const APP_URL = 'forge://app/index.html';
const exams = require('./amc-catalog.json');
const CSP = "default-src 'none'; script-src 'self'; worker-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' blob:; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const files = new Map([
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/amc.js', ['amc.js', 'text/javascript; charset=utf-8']],
  ['/amc-core.js', ['amc-core.js', 'text/javascript; charset=utf-8']],
  ['/coach-core.js', ['coach-core.js', 'text/javascript; charset=utf-8']],
  ['/project-core.js', ['project-core.js', 'text/javascript; charset=utf-8']],
  ['/project-planner.js', ['project-planner.js', 'text/javascript; charset=utf-8']],
  ['/dashboard.js', ['dashboard.js', 'text/javascript; charset=utf-8']],
  ['/learning-experience.js', ['learning-experience.js', 'text/javascript; charset=utf-8']],
  ['/learning-experience.css', ['learning-experience.css', 'text/css; charset=utf-8']],
  ['/onboarding.js', ['onboarding.js', 'text/javascript; charset=utf-8']],
  ['/onboarding-core.js', ['onboarding-core.js', 'text/javascript; charset=utf-8']],
  ['/onboarding.css', ['onboarding.css', 'text/css; charset=utf-8']],
  ['/school.js', ['school.js', 'text/javascript; charset=utf-8']],
  ['/school-core.js', ['school-core.js', 'text/javascript; charset=utf-8']],
  ['/school.css', ['school.css', 'text/css; charset=utf-8']],
  ['/summit.css', ['summit.css', 'text/css; charset=utf-8']],
  ['/assets/summit-hero.png', ['assets/summit-hero.png', 'image/png']],
  ['/aoc-core.js', ['aoc-core.js', 'text/javascript; charset=utf-8']],
  ['/focus-core.js', ['focus-core.js', 'text/javascript; charset=utf-8']],
  ['/training-core.js', ['training-core.js', 'text/javascript; charset=utf-8']],
  ['/competition-core.js', ['competition-core.js', 'text/javascript; charset=utf-8']],
  ['/progression-core.js', ['progression-core.js', 'text/javascript; charset=utf-8']],
  ['/language-guide.js', ['language-guide.js', 'text/javascript; charset=utf-8']],
  ['/coach.js', ['coach.js', 'text/javascript; charset=utf-8']],
  ['/lesson.js', ['lesson.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']]
]);

app.setName('FORGE');
app.setAppUserModelId('local.forge.commandcenter');
// The same profile is used by the installer and portable app, including upgrades.
// QA can use a separate profile without touching the user's real progress.
const qaProfile = process.env.FORGE_QA_PROFILE;
app.setPath('userData', qaProfile ? path.resolve(qaProfile) : path.join(app.getPath('appData'), 'FORGE'));
const runner=createRunner({dataDir:app.getPath('userData')});
protocol.registerSchemesAsPrivileged([{ scheme: 'forge', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

let mainWindow;
const coach=createCoach({app,dialog,getWindow:()=>mainWindow});
const codeforces=createCodeforces();
function checkSender(event){
  if(!mainWindow||event.sender!==mainWindow.webContents||event.senderFrame!==event.sender.mainFrame||event.senderFrame.url!==APP_URL)throw Error('Invalid sender');
}
const pendingPdfs=new Map();
async function getPdf(exam,kind){
  const cacheDir=path.join(app.getPath('userData'),'AMC Papers');
  const filename=path.join(cacheDir,`${exam.id}-${kind}.pdf`);
  const valid=buffer=>buffer.length>=100&&buffer.length<=25*1024*1024&&buffer.subarray(0,5).toString()==='%PDF-';
  try{const cached=await fs.readFile(filename);if(valid(cached))return {bytes:new Uint8Array(cached),cached:true};}catch{}
  const key=exam.id+'-'+kind;
  if(pendingPdfs.has(key))return pendingPdfs.get(key);
  const request=(async()=>{
    try{
      const response=await fetch(kind==='problems'?exam.problemsUrl:exam.solutionsUrl,{signal:AbortSignal.timeout(30000),redirect:'error'});
      if(!response.ok)throw Error('The archive returned '+response.status);
      const declared=Number(response.headers.get('content-length'));
      if(declared>25*1024*1024)throw Error('PDF is too large');
      const reader=response.body.getReader();let total=0;const chunks=[];
      while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>25*1024*1024){await reader.cancel();throw Error('PDF is too large');}chunks.push(Buffer.from(value));}
      const buffer=Buffer.concat(chunks);
      if(!valid(buffer))throw Error('The archive did not return a valid PDF');
      await fs.mkdir(cacheDir,{recursive:true});
      const temp=filename+'.download';await fs.writeFile(temp,buffer);await fs.rename(temp,filename);
      return {bytes:new Uint8Array(buffer),cached:false};
    }catch(error){throw Error('Could not load this paper. Connect to the internet and try again. '+error.message);}
    finally{pendingPdfs.delete(key);}
  })();
  pendingPdfs.set(key,request);return request;
}
// QA profiles are isolated from the user's active FORGE instance and may run beside it.
if (!qaProfile && !app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    protocol.handle('forge', async request => {
      const url = new URL(request.url);
      let entry = url.hostname === 'app' && request.method === 'GET' && files.get(url.pathname);
      if(!entry&&url.hostname==='app'&&request.method==='GET'&&url.pathname.startsWith('/vendor/')){
        const relative=url.pathname.slice(1);
        if(/^vendor\/[a-zA-Z0-9_./-]+$/.test(relative)&&!relative.split('/').includes('..')){
          const ext=path.extname(relative);
          const types={'.mjs':'text/javascript; charset=utf-8','.wasm':'application/wasm','.bcmap':'application/octet-stream','.pfb':'application/octet-stream','.ttf':'font/ttf','.icc':'application/octet-stream'};
          if(types[ext])entry=[relative,types[ext]];
        }
      }
      if (!entry) return new Response('Not found', { status: 404 });
      let body;try{body=await fs.readFile(path.join(__dirname,'renderer',entry[0]));}catch{return new Response('Not found',{status:404});}
      return new Response(body, { headers: { 'Content-Type': entry[1], 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff' } });
    });
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);

    for(const [channel,handler] of Object.entries({
      'forge:coach-status':()=>coach.status(),
      'forge:coach-connect':()=>coach.connect(),
      'forge:coach-disconnect':()=>coach.disconnect(),
      'forge:coach-check':()=>coach.check(),
      'forge:coach-topics':()=>coach.topics(),
      'forge:coach-request':payload=>coach.request(payload),
      'forge:coach-cancel':()=>{coach.cancel();return true;},
      'forge:codeforces-contests':()=>codeforces.getUpcoming(),
      'forge:runner-status':()=>runner.status(),
      'forge:runner-run':payload=>runner.run(payload),
      'forge:runner-cancel':()=>runner.cancel(),
      'forge:runner-privacy':()=>shell.openExternal(runner.privacyUrl),
      'forge:lesson-export-pptx':async payload=>{
        const data=normalizeLessonExport(payload);
        const suggested=path.join(app.getPath('documents'),lessonFilename(data.lesson.topic,new Date(data.createdAt)));
        const result=await dialog.showSaveDialog(mainWindow,{title:'Export lesson as PowerPoint',defaultPath:suggested,filters:[{name:'PowerPoint presentation',extensions:['pptx']}]});
        if(result.canceled||!result.filePath)return {saved:false};
        const target=result.filePath.toLowerCase().endsWith('.pptx')?result.filePath:result.filePath+'.pptx';
        const bytes=await createLessonPresentation(data).write({outputType:'nodebuffer',compression:true});
        if(!Buffer.isBuffer(bytes)||bytes.length<1000||bytes.length>8*1024*1024)throw Error('The PowerPoint export did not pass its size check.');
        await fs.writeFile(target,bytes);
        return {saved:true,fileName:path.basename(target)};
      },
      'forge:coach-source':async url=>shell.openExternal(await coach.openSource(url))
    }))ipcMain.handle(channel,(event,payload)=>{checkSender(event);return handler(payload);});

    ipcMain.handle('forge:amc-catalog',async event=>{
      checkSender(event);
      return Promise.all(exams.map(async exam=>{
        const dir=path.join(app.getPath('userData'),'AMC Papers');
        const cached=await fs.access(path.join(dir,exam.id+'-problems.pdf')).then(()=>true,()=>false);
        const solutionsCached=await fs.access(path.join(dir,exam.id+'-solutions.pdf')).then(()=>true,()=>false);
        return {...exam,cached,solutionsCached};
      }));
    });
    ipcMain.handle('forge:amc-pdf',async(event,id,kind)=>{
      checkSender(event);
      const exam=exams.find(x=>x.id===id);
      if(!exam||!['problems','solutions'].includes(kind))throw Error('Unknown paper');
      return getPdf(exam,kind);
    });
    ipcMain.handle('forge:amc-source',async(event,id,kind)=>{
      checkSender(event);
      const exam=exams.find(x=>x.id===id);
      if(!exam)throw Error('Unknown paper');
      await shell.openExternal(kind==='answers'?exam.answerSourceUrl:exam.sourceUrl);
    });

    ipcMain.handle('forge:export-backup', async (event, data) => {
      checkSender(event);
      if (typeof data !== 'string' || Buffer.byteLength(data, 'utf8') > 5 * 1024 * 1024) throw new Error('Backup is too large');
      const parsed = JSON.parse(data);
      if (parsed.version !== 1 || !Array.isArray(parsed.tasks)) throw new Error('Invalid backup');
      const date = new Date().toLocaleDateString('en-CA');
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Export FORGE backup',
        defaultPath: path.join(app.getPath('documents'), `forge-backup-${date}.json`),
        filters: [{ name: 'FORGE JSON backup', extensions: ['json'] }]
      });
      if (result.canceled || !result.filePath) return false;
      await fs.writeFile(result.filePath, data, 'utf8');
      return true;
    });

    mainWindow = new BrowserWindow({
      width: 1380,
      height: 940,
      minWidth: 780,
      minHeight: 600,
      title: 'FORGE',
      backgroundColor: '#080e1d',
      icon: path.join(__dirname, 'build', 'icon.png'),
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        backgroundThrottling: false,
        spellcheck: false
      }
    });
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    mainWindow.webContents.on('will-navigate', (event, url) => {
      if (url !== APP_URL) event.preventDefault();
    });
    mainWindow.webContents.on('will-attach-webview', event => event.preventDefault());
    mainWindow.once('ready-to-show', () => mainWindow.show());
    mainWindow.on('closed', () => { mainWindow = null; });
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'File', submenu: [
        { label: 'Export backup…', accelerator: 'CmdOrCtrl+Shift+S', click: () => mainWindow?.webContents.send('forge:request-export') },
        { type: 'separator' }, { role: 'quit' }
      ] },
      { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
      { label: 'View', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
      { label: 'Help', submenu: [{ label: 'About FORGE', click: () => dialog.showMessageBox(mainWindow, {
        type: 'info', title: 'About FORGE', message: `FORGE ${app.getVersion()}`,
        detail: 'Personal developer & competition command center.\n\n22 real AMC 10 past papers (2016–2025). Download a paper once to practice offline. Progress is saved on this Windows account.\n\nAMC problems © MAA. Papers and solutions served by LIVE by Po-Shen Loh.\n\nCoding runs use the opt-in Judge0 Community Edition service, not a local interpreter. The provider stores submissions; do not send private code, secrets, or personal information. HTML/CSS previews stay local.'
      }) }] }
    ]));
    await mainWindow.loadURL(APP_URL);
  }).catch(error => {
    dialog.showErrorBox('FORGE could not start', error.message);
    app.quit();
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => {coach.cancel();runner.cancel();session.defaultSession?.flushStorageData();});
}
