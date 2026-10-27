/* LU Update — motion layer. Visual only: never reads or writes app data,
   never touches IDs or handlers. Everything degrades to the static page. */
(function(){
  var doc=document,root=doc.documentElement;
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(s,c){return (c||doc).querySelector(s)}
  function $$(s,c){return Array.prototype.slice.call((c||doc).querySelectorAll(s))}

  /* ---- scroll reveal ---- */
  var io=('IntersectionObserver' in window)?new IntersectionObserver(function(es){
    es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}});
  },{threshold:.15,rootMargin:'0px 0px -6% 0px'}):null;
  function reveal(el,i){
    if(el.__rv)return;el.__rv=1;
    if(!io||reduce){el.classList.add('in');return}
    el.setAttribute('data-reveal','');
    el.style.setProperty('--i',i||0);
    io.observe(el);
  }
  function tagReveals(scope){
    $$('.lp2-item,.lp2-step,.lp2-card,.lp2-cta,.lp2-steps,.lp2-split>div,.omr-stage',scope).forEach(function(el,i){reveal(el,el.matches('.lp2-item,.lp2-step')?i%4:0)});
    $$('.student-stat,.owner-stat,.practice-hero-stats>div',scope).forEach(function(el,i){reveal(el,i)});
    $$('.student-panel,.owner-panel,.profile-hero,.profile-info-panel,.profile-side-card,.analysis-chart-card,.analysis-stat',scope).forEach(function(el,i){reveal(el,i%3)});
  }

  /* ---- count-up for numeric stats (watches text the app writes) ---- */
  var counted=new WeakMap();
  function countUp(el){
    var t=(el.textContent||'').trim();
    var m=t.match(/^(-?\d+(?:\.\d+)?)(.*)$/);
    if(!m||reduce)return;
    if(counted.get(el)===t)return;
    counted.set(el,t);
    var end=parseFloat(m[1]),suf=m[2],dec=(m[1].split('.')[1]||'').length,t0=null,dur=900;
    if(end===0)return;
    function step(ts){
      if(t0===null)t0=ts;
      var p=Math.min(1,(ts-t0)/dur),e=1-Math.pow(1-p,3);
      el.__busy=1;el.textContent=(end*e).toFixed(dec)+suf;el.__busy=0;
      if(p<1)requestAnimationFrame(step);else{el.__busy=1;el.textContent=t;el.__busy=0}
    }
    requestAnimationFrame(step);
  }
  var statSel='.student-stat>strong,.owner-stat strong,.practice-hero-stats strong,.analysis-stat strong';
  var mo=new MutationObserver(function(ms){
    var dirty=false;
    ms.forEach(function(m){
      var n=m.target.nodeType===3?m.target.parentNode:m.target;
      if(!n||!n.closest)return;
      if(n.matches&&n.matches(statSel)&&!n.__busy)countUp(n);
      if(m.addedNodes&&m.addedNodes.length)dirty=true;
    });
    if(dirty){schedule()}
  });
  var pend=0;
  function schedule(){if(pend)return;pend=1;requestAnimationFrame(function(){pend=0;sweep()})}

  /* ---- skeleton shimmer for "Loading…" placeholders ---- */
  function sweep(){
    tagReveals(doc);
    $$('.student-results-empty,.chart-empty').forEach(function(el){
      var loading=/^\s*(loading|checking|preparing)/i.test(el.textContent||'');
      el.classList.toggle('is-loading',loading);
    });
    $$(statSel).forEach(function(n){if(!n.__seen){n.__seen=1;countUp(n)}});
    bindSpot();
  }

  /* ---- cursor spotlight on cards/rows ---- */
  function bindSpot(){
    $$('.student-test-card,.overview-test-row,.overview-result-row,.test-admin-row,.student-stat,.owner-stat,.analysis-stat,.lp2-card').forEach(function(el){
      if(el.__sp)return;el.__sp=1;
      if(el.matches('.student-test-card,.test-admin-row,.lp2-card'))return;
      el.classList.add('spot');
      el.addEventListener('pointermove',function(e){
        var r=el.getBoundingClientRect();
        el.style.setProperty('--mx',(e.clientX-r.left)+'px');
        el.style.setProperty('--my',(e.clientY-r.top)+'px');
      },{passive:true});
    });
  }

  /* ---- magnetic primary buttons (desktop pointers only) ---- */
  if(!reduce&&matchMedia('(hover:hover) and (pointer:fine)').matches){
    doc.addEventListener('pointermove',function(e){
      var b=e.target.closest&&e.target.closest('.lp2-actions .btn,.lp2-cta .btn,.lp2-nav .btn');
      if(!b)return;
      var r=b.getBoundingClientRect();
      b.style.transform='translate('+((e.clientX-r.left-r.width/2)*.12)+'px,'+((e.clientY-r.top-r.height/2)*.22-2)+'px)';
    },{passive:true});
    doc.addEventListener('pointerout',function(e){
      var b=e.target.closest&&e.target.closest('.lp2-actions .btn,.lp2-cta .btn,.lp2-nav .btn');
      if(b&&!b.contains(e.relatedTarget))b.style.transform='';
    });
    /* 3D tilt on the answer sheet */
    var omr=$('.omr');
    if(omr){
      omr.addEventListener('pointermove',function(e){
        var r=omr.getBoundingClientRect();
        omr.style.setProperty('--ry',(((e.clientX-r.left)/r.width-.5)*8)+'deg');
        omr.style.setProperty('--rx',(-((e.clientY-r.top)/r.height-.5)*8)+'deg');
      },{passive:true});
      omr.addEventListener('pointerleave',function(){omr.style.setProperty('--rx','0deg');omr.style.setProperty('--ry','0deg')});
    }
  }

  /* ---- scroll: header state + progress bar ---- */
  var hdr=$('.lp2-header'),bar=null;
  if(hdr||$('.student-main,.owner-main')){
    bar=doc.createElement('div');bar.className='scroll-progress';bar.setAttribute('aria-hidden','true');doc.body.appendChild(bar);
  }
  var ticking=0;
  function onScroll(){
    if(ticking)return;ticking=1;
    requestAnimationFrame(function(){
      ticking=0;
      var y=window.scrollY,h=root.scrollHeight-innerHeight;
      if(hdr)hdr.classList.toggle('scrolled',y>10);
      if(bar)bar.style.setProperty('--scroll',h>0?Math.min(1,y/h):0);
    });
  }
  addEventListener('scroll',onScroll,{passive:true});onScroll();

  /* ---- landing: animated answer sheet ---- */
  function omrLoop(){
    var sheet=$('.omr');if(!sheet)return;
    var rows=$$('.omr-row',sheet),clock=$('.omr-clock b',sheet),count=$('.omr-count',sheet);
    var picks=[1,3,0,2,1],secs=2*3600+14*60+30;
    function render(){
      var h=Math.floor(secs/3600),m=Math.floor(secs%3600/60),s=secs%60;
      if(clock)clock.textContent=[h,m,s].map(function(n){return String(n).padStart(2,'0')}).join(':');
    }
    render();
    if(reduce){rows.forEach(function(r,i){r.children[picks[i]+1].classList.add('on')});sheet.classList.add('done');return}
    setInterval(function(){secs=Math.max(0,secs-1);render()},1000);
    function cycle(){
      sheet.classList.remove('done');
      rows.forEach(function(r){$$('i',r).forEach(function(b){b.classList.remove('on','hit')})});
      if(count)count.textContent='0';
      var i=0;
      (function next(){
        if(i>=rows.length){
          setTimeout(function(){sheet.classList.add('done')},500);
          setTimeout(cycle,5200);return;
        }
        var b=rows[i].children[picks[i]+1];
        b.classList.add('on');
        if(count)count.textContent=String(i+1);
        i++;setTimeout(next,900);
      })();
    }
    var started=false;
    var o=new IntersectionObserver(function(es){if(es[0].isIntersecting&&!started){started=true;setTimeout(cycle,900)}},{threshold:.3});
    o.observe(sheet);
  }

  /* ---- landing: live vs practice sliding tabs ---- */
  function tabs(){
    var wrap=$('.lp2-tabs');if(!wrap)return;
    var btns=$$('button',wrap),pill=$('.pill',wrap),panels=$$('.lp2-panel');
    function pick(b){
      btns.forEach(function(x,i){var on=x===b;x.setAttribute('aria-selected',on);if(panels[i])panels[i].classList.toggle('on',on)});
      pill.style.setProperty('--w',b.offsetWidth+'px');
      pill.style.setProperty('--x',(b.offsetLeft-5)+'px');
    }
    btns.forEach(function(b){b.addEventListener('click',function(){pick(b)})});
    pick(btns[0]);
    addEventListener('resize',function(){pick(btns.filter(function(x){return x.getAttribute('aria-selected')==='true'})[0]||btns[0])});
    if(doc.fonts&&doc.fonts.ready)doc.fonts.ready.then(function(){pick(btns.filter(function(x){return x.getAttribute('aria-selected')==='true'})[0]||btns[0])});
  }

  /* ---- animate bars/rings when charts are (re)rendered: restart CSS animation ---- */
  function boot(){
    sweep();tabs();omrLoop();
    mo.observe(doc.body,{childList:true,subtree:true,characterData:true});
    /* safety: never leave content hidden */
    setTimeout(function(){$$('[data-reveal]:not(.in)').forEach(function(el){var r=el.getBoundingClientRect();if(r.top<innerHeight)el.classList.add('in')})},2500);
  }
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',boot);else boot();
})();
