(function (root) {
  'use strict';
  // A deliberately small expression language: generated data is never evaluated as JavaScript.
  const arity = Object.freeze({add:2, sub:2, mul:2, div:2, pow:2, min:2, max:2, sin:1, cos:1, exp:1, abs:1, sqrt:1, neg:1});
  const funcs = Object.freeze({add:(a,b)=>a+b, sub:(a,b)=>a-b, mul:(a,b)=>a*b, div:(a,b)=>a/b, pow:(a,b)=>a**b, min:Math.min, max:Math.max, sin:Math.sin, cos:Math.cos, exp:Math.exp, abs:Math.abs, sqrt:Math.sqrt, neg:a=>-a});
  function evaluate(node, vars, depth=0, budget={nodes:0}) {
    if (++budget.nodes > 200 || depth > 16) throw Error('Expression too complex');
    if (typeof node === 'number') { if (!Number.isFinite(node) || Math.abs(node)>1e6) throw Error('Invalid constant'); return node; }
    if (typeof node === 'string') { if (!Object.hasOwn(vars,node)) throw Error('Unknown variable'); return vars[node]; }
    if (!Array.isArray(node) || !Object.hasOwn(arity,node[0]) || node.length !== arity[node[0]]+1) throw Error('Invalid expression');
    const value=funcs[node[0]](...node.slice(1).map(x=>evaluate(x,vars,depth+1,budget)));
    if (!Number.isFinite(value) || Math.abs(value)>1e12) throw Error('Model produced an invalid value');
    return value;
  }
  function validate(lab) {
    if (!lab || typeof lab !== 'object') throw Error('Invalid LiveLab');
    if (JSON.stringify(lab).length>16000) throw Error('LiveLab is too large');
    for (const [key, limit] of Object.entries({title:120,description:800,assumptions:1200,question:500,xLabel:80,yLabel:80})) if (typeof lab[key] !== 'string' || !lab[key].trim() || lab[key].length>limit) throw Error('Invalid '+key);
    if (!Array.isArray(lab.controls) || !lab.controls.length || lab.controls.length>5) throw Error('A LiveLab needs at least one adjustable control');
    const vars=Object.create(null); vars.x=0;
    for (const c of lab.controls) {
      if (!c || !/^[a-z][a-z0-9_]{0,19}$/.test(c.id) || Object.hasOwn(vars,c.id) || typeof c.label!=='string' || !c.label.trim() || c.label.length>80 || ![c.min,c.max,c.step,c.value].every(Number.isFinite) || c.min < -1e6 || c.max > 1e6 || c.min>=c.max || c.step<=0 || c.step>c.max-c.min || (c.max-c.min)/c.step>10000 || c.value<c.min || c.value>c.max) throw Error('Invalid control');
      vars[c.id]=c.value;
    }
    if (![lab.xMin,lab.xMax].every(Number.isFinite) || lab.xMin>=lab.xMax || Math.abs(lab.xMin)>1e6 || Math.abs(lab.xMax)>1e6) throw Error('Invalid graph domain');
    if (!Array.isArray(lab.curves) || !lab.curves.length || lab.curves.length>3) throw Error('Invalid curves');
    for (const c of lab.curves) {
      if (!c || typeof c.label!=='string' || !c.label.trim() || c.label.length>80) throw Error('Invalid curve');
      const check=()=>{for (let i=0;i<=80;i++) { vars.x=lab.xMin+(lab.xMax-lab.xMin)*i/80; evaluate(c.expression,vars); }};
      check();
      for (const control of lab.controls) {
        vars[control.id]=control.min; check();
        vars[control.id]=control.max; check();
        vars[control.id]=control.value;
      }
    }
    return lab;
  }
  function verifyChecks(lab, checks) {
    validate(lab);
    if (!Array.isArray(checks) || checks.length<1 || checks.length>6) throw Error('The checker must provide one to six independent calculations');
    const covered=new Set();
    for (const check of checks) {
      if (!check || !Number.isInteger(check.curve) || check.curve<0 || check.curve>=lab.curves.length || !Number.isFinite(check.x) || check.x<lab.xMin || check.x>lab.xMax || !Number.isFinite(check.expected) || Math.abs(check.expected)>1e12 || !Number.isFinite(check.tolerance) || check.tolerance<1e-9 || check.tolerance>0.01 || typeof check.reason!=='string' || !check.reason.trim() || check.reason.length>300 || !check.controls || typeof check.controls!=='object' || Array.isArray(check.controls)) throw Error('The checker supplied an invalid calculation');
      const ids=lab.controls.map(c=>c.id);
      if (Object.keys(check.controls).length!==ids.length || !ids.every(id=>Object.hasOwn(check.controls,id))) throw Error('The checker did not provide every control value');
      const vars=Object.create(null); vars.x=check.x;
      for (const control of lab.controls) {
        const value=check.controls[control.id];
        if (!Number.isFinite(value) || value<control.min || value>control.max) throw Error('The checker used a control outside its range');
        vars[control.id]=value;
      }
      const actual=evaluate(lab.curves[check.curve].expression,vars);
      if (Math.abs(actual-check.expected)>check.tolerance*Math.max(1,Math.abs(check.expected))) throw Error(`Independent calculation failed for ${lab.curves[check.curve].label}: ${check.reason}`);
      covered.add(check.curve);
    }
    if (covered.size!==lab.curves.length) throw Error('The checker did not test every curve');
    return checks.length;
  }
  function preserveControls(lab, previous) {
    validate(lab);
    if (!previous) return lab;
    validate(previous);
    const result=JSON.parse(JSON.stringify(lab));
    for (const control of result.controls) {
      const old=previous.controls.find(item=>item.id===control.id && item.label===control.label);
      if (!old || old.value<control.min || old.value>control.max) continue;
      const steps=(old.value-control.min)/control.step;
      if (Math.abs(steps-Math.round(steps))>1e-7) continue;
      const fallback=control.value; control.value=old.value;
      try { validate(result); } catch { control.value=fallback; }
    }
    return result;
  }
  root.LiveLabCore={validate,evaluate,verifyChecks,preserveControls};
  if (typeof module!=='undefined') module.exports=root.LiveLabCore;
})(typeof window!=='undefined'?window:globalThis);
