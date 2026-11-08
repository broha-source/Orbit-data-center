/* One deliberate desktop wheel gesture moves to the next readable page stop. */
(() => {
  const desktop=matchMedia('(min-width: 1100px) and (pointer: fine)');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let gesture=false,resetTimer,busyUntil=0;
  function stops(){
    const header=document.querySelector('.topbar')?.getBoundingClientRect().height||78;
    const max=Math.max(0,document.documentElement.scrollHeight-innerHeight);
    const selectors=['#demo','#results .results-intro','#method .section-heading','#method .workflow-gallery>article','#progress .section-heading','#progress .research-stages','#progress .stage-table','#progress .parity-note','footer'];
    const anchors=[0];
    document.querySelectorAll(selectors.join(',')).forEach(el=>anchors.push(Math.max(0,Math.min(max,scrollY+el.getBoundingClientRect().top-header-8))));
    anchors.push(max);anchors.sort((a,b)=>a-b);
    const result=[0],page=Math.max(300,innerHeight-header-32);
    for(const target of anchors){let last=result[result.length-1];while(target-last>page*1.2){last+=page;result.push(last);}if(target-last>24)result.push(target);}
    return result;
  }
  addEventListener('wheel',event=>{
    if(!desktop.matches||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||Math.abs(event.deltaX)>Math.abs(event.deltaY)||Math.abs(event.deltaY)<2)return;
    if(event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
    const scroller=event.target.closest('.stage-table,#cadViewer');
    if(scroller&&scroller.scrollHeight>scroller.clientHeight+2){const down=event.deltaY>0;if(down?scroller.scrollTop+scroller.clientHeight<scroller.scrollHeight-2:scroller.scrollTop>2)return;}
    const wasGesture=gesture;gesture=true;clearTimeout(resetTimer);resetTimer=setTimeout(()=>gesture=false,180);
    event.preventDefault();
    if(wasGesture||performance.now()<busyUntil)return;
    const positions=stops(),down=event.deltaY>0;
    const target=down?positions.find(y=>y>scrollY+24):positions.slice().reverse().find(y=>y<scrollY-24);
    if(target===undefined)return;
    busyUntil=performance.now()+850;
    scrollTo({top:target,behavior:reduced.matches?'instant':'smooth'});
  },{passive:false});
})();
