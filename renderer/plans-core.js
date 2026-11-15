(function(root){
  'use strict';
  const plans=Object.freeze([
    Object.freeze({id:'free',name:'Free',monthlyCents:0,position:'Learn anything.',features:Object.freeze(['Basic Coach and Brain','3 LiveLabs / month','1 StudyShow preview / month','Local learning progress'])}),
    Object.freeze({id:'pro',name:'Pro',monthlyCents:999,position:'Master anything.',features:Object.freeze(['Advanced Coach and Brain','30 LiveLabs / month','5 StudyShows / month','Adaptive learning paths'])}),
    Object.freeze({id:'max',name:'Max',monthlyCents:2999,position:'Learn and create.',features:Object.freeze(['100 LiveLabs / month','20 StudyShows / month','20 AI PowerPoints / month','15 narrated video minutes / month'])}),
    Object.freeze({id:'ultra',name:'Ultra',monthlyCents:11999,position:'Learn, create, and explore.',features:Object.freeze(['Experimental FORGE Worlds','Priority world-generation queue','Higher allowances to be determined','Shared world learning sessions'])})
  ]);
  function price(plan){if(!plan||!Number.isInteger(plan.monthlyCents))throw Error('Invalid plan');return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:plan.monthlyCents?2:0}).format(plan.monthlyCents/100);}
  root.ForgePlans={plans,price};if(typeof module!=='undefined')module.exports=root.ForgePlans;
})(typeof window!=='undefined'?window:globalThis);
