'use strict';
(function(root){
  const CATALOG=Object.freeze([
    {id:'lc-two-sum',platform:'LeetCode',level:'Beginner',rating:'Easy',title:'Two Sum',topic:'Arrays · hash maps',minutes:20,url:'https://leetcode.com/problems/two-sum/'},
    {id:'lc-valid-parentheses',platform:'LeetCode',level:'Beginner',rating:'Easy',title:'Valid Parentheses',topic:'Strings · stacks',minutes:20,url:'https://leetcode.com/problems/valid-parentheses/'},
    {id:'lc-stock',platform:'LeetCode',level:'Beginner',rating:'Easy',title:'Best Time to Buy and Sell Stock',topic:'Arrays · running minimum',minutes:25,url:'https://leetcode.com/problems/best-time-to-buy-and-sell-stock/'},
    {id:'lc-longest-substring',platform:'LeetCode',level:'Intermediate',rating:'Medium',title:'Longest Substring Without Repeating Characters',topic:'Strings · sliding window',minutes:35,url:'https://leetcode.com/problems/longest-substring-without-repeating-characters/'},
    {id:'lc-group-anagrams',platform:'LeetCode',level:'Intermediate',rating:'Medium',title:'Group Anagrams',topic:'Strings · hashing',minutes:35,url:'https://leetcode.com/problems/group-anagrams/'},
    {id:'lc-number-islands',platform:'LeetCode',level:'Intermediate',rating:'Medium',title:'Number of Islands',topic:'Graphs · grid traversal',minutes:40,url:'https://leetcode.com/problems/number-of-islands/'},
    {id:'lc-trapping-rain-water',platform:'LeetCode',level:'Advanced',rating:'Hard',title:'Trapping Rain Water',topic:'Arrays · two pointers',minutes:50,url:'https://leetcode.com/problems/trapping-rain-water/'},
    {id:'lc-minimum-window',platform:'LeetCode',level:'Advanced',rating:'Hard',title:'Minimum Window Substring',topic:'Strings · sliding window',minutes:50,url:'https://leetcode.com/problems/minimum-window-substring/'},
    {id:'lc-sliding-window-maximum',platform:'LeetCode',level:'Advanced',rating:'Hard',title:'Sliding Window Maximum',topic:'Arrays · monotonic deque',minutes:50,url:'https://leetcode.com/problems/sliding-window-maximum/'},
    {id:'cf-4a',platform:'Codeforces',level:'Beginner',rating:'800',title:'Watermelon',topic:'Math · parity',minutes:20,url:'https://codeforces.com/problemset/problem/4/A'},
    {id:'cf-71a',platform:'Codeforces',level:'Beginner',rating:'800',title:'Way Too Long Words',topic:'Strings · implementation',minutes:20,url:'https://codeforces.com/problemset/problem/71/A'},
    {id:'cf-231a',platform:'Codeforces',level:'Beginner',rating:'800',title:'Team',topic:'Implementation · counting',minutes:20,url:'https://codeforces.com/problemset/problem/231/A'},
    {id:'cf-1352c',platform:'Codeforces',level:'Intermediate',rating:'1200',title:'K-th Not Divisible by n',topic:'Math · binary search',minutes:35,url:'https://codeforces.com/problemset/problem/1352/C'},
    {id:'cf-706b',platform:'Codeforces',level:'Intermediate',rating:'1100',title:'Interesting drink',topic:'Binary search · sorting',minutes:35,url:'https://codeforces.com/problemset/problem/706/B'},
    {id:'cf-977c',platform:'Codeforces',level:'Intermediate',rating:'1200',title:'Less or Equal',topic:'Sorting · boundary cases',minutes:35,url:'https://codeforces.com/problemset/problem/977/C'},
    {id:'cf-455a',platform:'Codeforces',level:'Advanced',rating:'1500',title:'Boredom',topic:'Dynamic programming',minutes:45,url:'https://codeforces.com/problemset/problem/455/A'},
    {id:'cf-580c',platform:'Codeforces',level:'Advanced',rating:'1500',title:'Kefa and Park',topic:'Trees · depth-first search',minutes:50,url:'https://codeforces.com/problemset/problem/580/C'},
    {id:'cf-20c',platform:'Codeforces',level:'Advanced',rating:'1900',title:'Dijkstra?',topic:'Graphs · shortest paths',minutes:60,url:'https://codeforces.com/problemset/problem/20/C'}
  ].map(item=>Object.freeze(item)));
  const byId=new Map(CATALOG.map(item=>[item.id,item]));
  const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  function empty(){return {completed:{}};}
  function normalize(value){
    if(!record(value)||!record(value.completed))return empty();
    const completed={};
    for(const [id,done] of Object.entries(value.completed))if(byId.has(id)&&done===true)completed[id]=true;
    return {completed};
  }
  function setDone(value,id,done){
    const progress=normalize(value);if(!byId.has(id))return progress;
    if(done===true)progress.completed[id]=true;else delete progress.completed[id];
    return progress;
  }
  function item(id){return byId.get(id)||null;}
  const api={CATALOG,LEVELS:['Beginner','Intermediate','Advanced'],PLATFORMS:['LeetCode','Codeforces'],empty,normalize,setDone,item};
  root.TrainingCore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
