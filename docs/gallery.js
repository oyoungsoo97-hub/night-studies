(() => {
  const editions = {
    'last-train':{studio:'막차',title:'마지막 안내방송',desc:'종이 사이로 드러난 승강장. 열차가 지나갈 한 프레임을 골라 포스터로 인쇄하세요.',cta:'포스터 편집하기',image:'edition-train.webp',alt:'찢어진 종이 사이로 승강장이 보이는 마지막 안내방송 포스터'},
    'foley-club':{studio:'폴리 클럽',title:'복도 끝의 문',desc:'같은 복도를 다르게 걸어가는 두 테이크. 발소리와 열쇠 소리의 위치를 바꿔 장면의 긴장을 조절하세요.',cta:'사운드트랙 편집하기',image:'edition-foley.webp',alt:'복도 장면과 두 테이크에 맞춰 배치한 효과음'},
    'light-table':{studio:'라이트 테이블',title:'비가 그친 뒤',desc:'비 오는 식당을 세 컷으로 나눈 사진 이야기. 직접 찍은 사진을 더하고 인화지와 구성을 고르세요.',cta:'사진 시퀀스 편집하기',image:'edition-light.webp',alt:'비 오는 식당에서 잘라낸 세 장면을 배치한 사진 인화지'}
  };
  const $ = id => document.getElementById(id);
  const tabs = [...document.querySelectorAll('[data-studio]')];
  function choose(tab) {
    const key=tab.dataset.studio, ed=editions[key];
    for (const t of tabs) {const on=t===tab;t.setAttribute('aria-selected',String(on));t.tabIndex=on?0:-1;}
    $('edition').dataset.current=key;$('edition').setAttribute('aria-labelledby',tab.id);
    const image=(key==='foley-club'||NightI18n.lang==='ko')?ed.image:ed.image.replace('.webp','-'+NightI18n.lang+'.webp');
    $('edition-preview').src='assets/'+image;$('edition-preview').alt=ed.alt;
    $('edition-name').textContent=ed.title;$('edition-copy').textContent=ed.desc;
    $('start-edition').textContent=ed.cta;$('start-edition').href=key+'/?edition=house';
    $('start-blank').textContent=ed.studio+' 편집실 바로 열기';$('start-blank').href=key+'/';
  }
  tabs.forEach((tab,i)=>{
    tab.addEventListener('click',()=>choose(tab));
    tab.addEventListener('keydown',event=>{
      const delta={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[event.key];
      const index=event.key==='Home'?0:event.key==='End'?tabs.length-1:delta!==undefined?(i+delta+tabs.length)%tabs.length:null;
      if(index!==null){event.preventDefault();tabs[index].focus();choose(tabs[index]);}
    });
  });
  async function refresh() {
    const panel=$('recent');
    try {
      const rows=(await NightLibrary.list()).slice(0,3);
      if(!rows.length){
        const p=document.createElement('p');p.className='empty-note';p.textContent='편집실에서 프로젝트를 저장하면 여기에서 이어서 작업할 수 있습니다.';panel.replaceChildren(p);return;
      }
      const grid=document.createElement('div');grid.className='recent-grid';
      for(const row of rows) {
        const studio=NightLibrary.studios[row.studio];if(!studio)continue;
        const link=document.createElement('a');link.className='recent-link';link.href=NightLibrary.projectURL(row);
        const img=document.createElement('img');img.alt='';img.loading='lazy';img.src=row.preview||'assets/'+studio.cover;
        const text=document.createElement('span'),strong=document.createElement('strong'),small=document.createElement('small');
        strong.dataset.noI18n='';strong.textContent=row.name;small.textContent=NightI18n.text(studio.name)+' · '+NightLibrary.date(row.updated);
        text.append(strong,small);link.append(img,text);grid.append(link);
      }
      panel.replaceChildren(grid);
    }catch {panel.textContent='작업 보관함을 사용하려면 이 브라우저의 사이트 데이터 저장을 허용해 주세요.';}
  }
  function applyEdition(){choose(tabs.find(t=>t.getAttribute('aria-selected')==='true')||tabs[0]);NightI18n.apply($('edition'));}
  applyEdition();
  document.addEventListener('night-language',()=>{applyEdition();refresh();});window.addEventListener('pageshow',refresh);window.addEventListener('night-library-change',refresh);
  refresh();
})();
