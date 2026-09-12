import{Bn as e,Dt as t,Ht as n,P as r,V as i,Vn as a,Vt as o,Wn as s,ir as c,ln as l,on as u,pn as d,sr as f,vn as p,wn as m,wt as h,xn as g,yn as _}from"./chunk-J7OUQ5F2-BUuuYMiX.js";import{t as v}from"./ordinal-hYBb2elL.js";import{t as y}from"./arc-Dr3HzV9Z.js";import{n as b}from"./mermaid-parser.core-DLGMGA-3.js";import{t as x}from"./chunk-JWPE2WC7-B1jGbjv4.js";function S(e,t){return t<e?-1:t>e?1:t>=e?0:NaN}function C(e){return e}function w(){var e=C,r=S,i=null,a=n(0),s=n(o),c=n(0);function l(n){var l,u=(n=t(n)).length,d,f,p=0,m=Array(u),h=Array(u),g=+a.apply(this,arguments),_=Math.min(o,Math.max(-o,s.apply(this,arguments)-g)),v,y=Math.min(Math.abs(_)/u,c.apply(this,arguments)),b=y*(_<0?-1:1),x;for(l=0;l<u;++l)(x=h[m[l]=l]=+e(n[l],l,n))>0&&(p+=x);for(r==null?i!=null&&m.sort(function(e,t){return i(n[e],n[t])}):m.sort(function(e,t){return r(h[e],h[t])}),l=0,f=p?(_-u*b)/p:0;l<u;++l,g=v)d=m[l],x=h[d],v=g+(x>0?x*f:0)+b,h[d]={data:n[d],index:l,value:x,startAngle:g,endAngle:v,padAngle:y};return h}return l.value=function(t){return arguments.length?(e=typeof t==`function`?t:n(+t),l):e},l.sortValues=function(e){return arguments.length?(r=e,i=null,l):r},l.sort=function(e){return arguments.length?(i=e,r=null,l):i},l.startAngle=function(e){return arguments.length?(a=typeof e==`function`?e:n(+e),l):a},l.endAngle=function(e){return arguments.length?(s=typeof e==`function`?e:n(+e),l):s},l.padAngle=function(e){return arguments.length?(c=typeof e==`function`?e:n(+e),l):c},l}var T=d.pie,E={sections:new Map,showData:!1,config:T},D=E.sections,O=E.showData,k=structuredClone(T),A={getConfig:f(()=>structuredClone(k),`getConfig`),clear:f(()=>{D=new Map,O=E.showData,u()},`clear`),setDiagramTitle:s,getDiagramTitle:m,setAccTitle:a,getAccTitle:_,setAccDescription:e,getAccDescription:p,addSection:f(({label:e,value:t})=>{if(t<0)throw Error(`"${e}" has invalid value: ${t}. Negative values are not allowed in pie charts. All slice values must be >= 0.`);D.has(e)||(D.set(e,t),c.debug(`added new section: ${e}, with value: ${t}`))},`addSection`),getSections:f(()=>D,`getSections`),setShowData:f(e=>{O=e},`setShowData`),getShowData:f(()=>O,`getShowData`)},j=f((e,t)=>{x(e,t),t.setShowData(e.showData),e.sections.map(t.addSection)},`populateDb`),M={parse:f(async e=>{let t=await b(`pie`,e);c.debug(t),j(t,A)},`parse`)},N=f(e=>`
  .pieCircle{
    stroke: ${e.pieStrokeColor};
    stroke-width : ${e.pieStrokeWidth};
    opacity : ${e.pieOpacity};
  }
  .pieCircle.highlighted{
    scale: 1.05;
    opacity: 1;
  }
  .pieCircle.highlightedOnHover:hover{
    transition-duration: 250ms;
    scale: 1.05;
    opacity: 1;
  }
  .pieOuterCircle{
    stroke: ${e.pieOuterStrokeColor};
    stroke-width: ${e.pieOuterStrokeWidth};
    fill: none;
  }
  .pieTitleText {
    text-anchor: middle;
    font-size: ${e.pieTitleTextSize};
    fill: ${e.pieTitleTextColor};
    font-family: ${e.fontFamily};
  }
  .slice {
    font-family: ${e.fontFamily};
    fill: ${e.pieSectionTextColor};
    font-size:${e.pieSectionTextSize};
    // fill: white;
  }
  .legend text {
    fill: ${e.pieLegendTextColor};
    font-family: ${e.fontFamily};
    font-size: ${e.pieLegendTextSize};
  }
`,`getStyles`),P=f(e=>{let t=[...e.values()].reduce((e,t)=>e+t,0),n=[...e.entries()].map(([e,t])=>({label:e,value:t})).filter(e=>e.value/t*100>=1);return w().value(e=>e.value).sort(null)(n)},`createPieArcs`),F={parser:M,db:A,renderer:{draw:f((e,t,n,a)=>{c.debug(`rendering pie chart
`+e);let o=a.db,s=g(),u=r(o.getConfig(),s.pie),d=h(t),f=d.append(`g`);f.attr(`transform`,`translate(225,225)`);let{themeVariables:p}=s,[m]=i(p.pieOuterStrokeWidth);m??=2;let _=u.legendPosition,b=u.textPosition,x=u.donutHole>0&&u.donutHole<=.9?u.donutHole:0,S=y().innerRadius(x*185).outerRadius(185),C=y().innerRadius(185*b).outerRadius(185*b),w=f.append(`g`);w.append(`circle`).attr(`cx`,0).attr(`cy`,0).attr(`r`,185+m/2).attr(`class`,`pieOuterCircle`);let T=o.getSections(),E=P(T),D=[p.pie1,p.pie2,p.pie3,p.pie4,p.pie5,p.pie6,p.pie7,p.pie8,p.pie9,p.pie10,p.pie11,p.pie12],O=0;T.forEach(e=>{O+=e});let k=E.filter(e=>(e.data.value/O*100).toFixed(0)!==`0`),A=v(D).domain([...T.keys()]);w.selectAll(`mySlices`).data(k).enter().append(`path`).attr(`d`,S).attr(`fill`,e=>A(e.data.label)).attr(`class`,e=>{let t=`pieCircle`;return u.highlightSlice===`hover`?t+=` highlightedOnHover`:u.highlightSlice===e.data.label&&(t+=` highlighted`),t}),w.selectAll(`mySlices`).data(k).enter().append(`text`).text(e=>(e.data.value/O*100).toFixed(0)+`%`).attr(`transform`,e=>`translate(`+C.centroid(e)+`)`).style(`text-anchor`,`middle`).attr(`class`,`slice`);let j=f.append(`text`).text(o.getDiagramTitle()).attr(`x`,0).attr(`y`,-400/2).attr(`class`,`pieTitleText`),M=[...T.entries()].map(([e,t])=>({label:e,value:t})),N=f.selectAll(`.legend`).data(M).enter().append(`g`).attr(`class`,`legend`);N.append(`rect`).attr(`width`,18).attr(`height`,18).style(`fill`,e=>A(e.label)).style(`stroke`,e=>A(e.label)),N.append(`text`).attr(`x`,22).attr(`y`,14).text(e=>o.getShowData()?`${e.label} [${e.value}]`:e.label);let F=Math.max(...N.selectAll(`text`).nodes().map(e=>e?.getBoundingClientRect().width??0)),I=450,L=490,R=M.length*22;switch(_){case`center`:N.attr(`transform`,(e,t)=>{let n=22*M.length/2,r=-F/2-22,i=t*22-n;return`translate(`+r+`,`+i+`)`});break;case`top`:I+=R,N.attr(`transform`,(e,t)=>`translate(${-F/2-22}, ${t*22-185})`),w.attr(`transform`,()=>`translate(0, ${R+22})`);break;case`bottom`:I+=R,N.attr(`transform`,(e,t)=>{let n=-F/2-22,r=t*22- -207;return`translate(`+n+`,`+r+`)`});break;case`left`:L+=22+F,N.attr(`transform`,(e,t)=>{let n=22*M.length/2;return`translate(-207,`+(t*22-n)+`)`}),w.attr(`transform`,()=>`translate(${F+18+4}, 0)`);break;default:L+=22+F,N.attr(`transform`,(e,t)=>{let n=22*M.length/2;return`translate(216,`+(t*22-n)+`)`});break}let z=j.node()?.getBoundingClientRect().width??0,B=450/2-z/2,V=450/2+z/2,H=Math.min(0,B),U=Math.max(L,V)-H;d.attr(`viewBox`,`${H} 0 ${U} ${I}`),l(d,I,U,u.useMaxWidth)},`draw`)},styles:N};export{F as diagram};