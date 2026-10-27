/* LU Update motion layer — lightweight, landing-page-only enhancements.
   Avoids MutationObservers, count-up effects, pointer tracking and continuous loops
   so dashboard statistics and exam controls stay stable. */
(function(){
  'use strict';
  var doc=document;
  var reduce=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var landing=doc.body && doc.body.classList.contains('lp2');
  if(!landing || reduce) return;
  var items=doc.querySelectorAll('.lp2-item,.lp2-step,.lp2-card,.lp2-cta,.lp2-steps,.lp2-split>div,.omr-stage');
  if('IntersectionObserver' in window){
    var observer=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){if(entry.isIntersecting){entry.target.classList.add('in');observer.unobserve(entry.target)}});
    },{threshold:0.08,rootMargin:'0px 0px -3% 0px'});
    items.forEach(function(el){observer.observe(el)});
  }else{items.forEach(function(el){el.classList.add('in')})}
  var tabs=doc.querySelector('.lp2-tabs');
  if(tabs){
    var buttons=Array.prototype.slice.call(tabs.querySelectorAll('button'));
    var pill=tabs.querySelector('.pill');
    var panels=doc.querySelectorAll('.lp2-panel');
    function select(button,index){
      buttons.forEach(function(b,i){var active=i===index;b.setAttribute('aria-selected',active?'true':'false');if(panels[i])panels[i].classList.toggle('on',active)});
      if(pill){pill.style.setProperty('--w',button.offsetWidth+'px');pill.style.setProperty('--x',(button.offsetLeft-5)+'px')}
    }
    buttons.forEach(function(button,index){button.addEventListener('click',function(){select(button,index)})});
    var activeIndex=buttons.findIndex(function(b){return b.getAttribute('aria-selected')==='true'});
    if(buttons[activeIndex])select(buttons[activeIndex],activeIndex);
  }
})();