(function(root){
  'use strict';
  const tags=new Set(['div','section','p','span','strong','em','h3','h4','ul','ol','li','code']);
  const properties={
    color:/^#[0-9a-f]{6}$/i,'background-color':/^#[0-9a-f]{6}$/i,
    'font-weight':/^(normal|bold|[4-8]00)$/,'text-align':/^(left|center|right)$/,
    'font-size':/^(?:1[2-9]|[2-3][0-9]|40)px$/,'border-radius':/^(?:[0-9]|[1-2][0-9]|30)px$/,
    padding:/^(?:[0-9]|[1-2][0-9]|30)px$/,gap:/^(?:[0-9]|[1-2][0-9]|30)px$/,
    display:/^(block|flex|grid)$/,'flex-wrap':/^(wrap|nowrap)$/
  };
  function parse(html,css){
    if(typeof html!=='string'||html.length>5000||typeof css!=='string'||css.length>3000)throw Error('Invalid HTML/CSS block size');
    const rules={};let offset=0;const pattern=/\s*\.([a-z][a-z0-9_-]{0,39})\s*\{([^{}]*)\}/igy;let match;
    while(offset<css.length){if(!css.slice(offset).trim())break;pattern.lastIndex=offset;match=pattern.exec(css);if(!match)throw Error('CSS must use simple class selectors');offset=pattern.lastIndex;const declarations=match[2].split(';').map(x=>x.trim()).filter(Boolean);if(!declarations.length||Object.keys(rules).length>=30)throw Error('Invalid CSS rules');const styles=rules[match[1]]||(rules[match[1]]={});for(const declaration of declarations){const parts=declaration.split(':');if(parts.length!==2)throw Error('Invalid CSS declaration');const key=parts[0].trim().toLowerCase(),value=parts[1].trim();if(!Object.hasOwn(properties,key)||!properties[key].test(value))throw Error('Unsupported CSS property or value');styles[key]=value;}}
    const tree=[],stack=[{children:tree,tag:null}],tokens=html.match(/<[^>]*>|[^<]+/g)||[];if(tokens.join('')!==html)throw Error('Invalid HTML');let nodes=0;
    for(const token of tokens){if(++nodes>150)throw Error('HTML has too many elements');if(!token.startsWith('<')){if(token.includes('>'))throw Error('Invalid HTML text');stack.at(-1).children.push({text:token});continue;}const close=token.match(/^<\/([a-z0-9]+)\s*>$/i);if(close){if(stack.length===1||stack.at(-1).tag!==close[1].toLowerCase())throw Error('HTML tags must be balanced');stack.pop();continue;}const open=token.match(/^<([a-z0-9]+)(?:\s+class="([a-z][a-z0-9_-]{0,39}(?:\s+[a-z][a-z0-9_-]{0,39}){0,3})")?\s*>$/i);if(!open||!tags.has(open[1].toLowerCase())||stack.length>16)throw Error('Unsupported HTML tag or attribute');const node={tag:open[1].toLowerCase(),classes:open[2]?open[2].split(/\s+/):[],children:[]};stack.at(-1).children.push(node);stack.push(node);}
    if(stack.length!==1)throw Error('HTML tags must be balanced');return {tree,rules};
  }
  function render(container,html,css){const {tree,rules}=parse(html,css);function add(parent,items){for(const node of items){if(Object.hasOwn(node,'text')){parent.appendChild(document.createTextNode(node.text));continue;}const el=document.createElement(node.tag);for(const cls of node.classes){el.classList.add(cls);for(const [key,value] of Object.entries(rules[cls]||{}))el.style.setProperty(key,value);}add(el,node.children);parent.appendChild(el);}}add(container,tree);}
  root.LiveLabHTML={parse,render};if(typeof module!=='undefined')module.exports=root.LiveLabHTML;
})(typeof window!=='undefined'?window:globalThis);
