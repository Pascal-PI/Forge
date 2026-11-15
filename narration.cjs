'use strict';
const {spawn}=require('node:child_process');
const SCRIPT=`$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$inputText = [Console]::In.ReadToEnd()
$data = $inputText | ConvertFrom-Json
$voice = [System.Speech.Synthesis.SpeechSynthesizer]::new()
$stream = [System.IO.MemoryStream]::new()
try { $voice.SetOutputToWaveStream($stream); $voice.Speak([string]$data.text); $voice.SetOutputToNull(); [Console]::Out.Write([Convert]::ToBase64String($stream.ToArray())) } finally { $voice.Dispose(); $stream.Dispose() }`;
function narrate(text){
  if(process.platform!=='win32')return Promise.reject(Error('Windows narration is unavailable on this device.'));
  if(typeof text!=='string'||!text.trim()||text.length>250)return Promise.reject(Error('Invalid narration text.'));
  return new Promise((resolve,reject)=>{
    const child=spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(SCRIPT,'utf16le').toString('base64')],{windowsHide:true,stdio:['pipe','pipe','ignore']});
    let settled=false,size=0,chunks=[];const timer=setTimeout(()=>finish(Error('Local narration timed out.')),20000);
    function finish(error,result){if(settled)return;settled=true;clearTimeout(timer);if(error){child.kill();reject(error);}else resolve(result);}
    child.on('error',()=>finish(Error('Local narration is unavailable.')));
    child.stdout.on('data',chunk=>{size+=chunk.length;if(size>6*1024*1024){finish(Error('Local narration is too large.'));return;}chunks.push(chunk);});
    child.on('close',code=>{if(settled)return;if(code!==0)return finish(Error('Local narration could not be created.'));const encoded=Buffer.concat(chunks).toString('ascii').trim();if(!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))return finish(Error('Local narration returned invalid audio.'));const audio=Buffer.from(encoded,'base64');if(audio.length<44||audio.length>4*1024*1024||audio.toString('ascii',0,4)!=='RIFF'||audio.toString('ascii',8,12)!=='WAVE')return finish(Error('Local narration returned invalid audio.'));finish(null,{audio:encoded});});
    child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({text}));
  });
}
module.exports={narrate};
