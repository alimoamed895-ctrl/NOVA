/* Education GPT enhancements v1.3 — browser-local archives; PDF via print dialog */
(() => {
  const $ = id => document.getElementById(id);
  const get = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const set = (k,v) => { try { localStorage.setItem(k,v); } catch(e) { alert('مساحة التخزين ممتلئة؛ صدّر محادثاتك.'); } };
  const del = k => { try { localStorage.removeItem(k); } catch {} };
  const KEY='education_gpt_history', PREV='education_gpt_prev', ARCH='education_gpt_archives', ACTIVE='education_gpt_active';
  const read = k => { try { const v=JSON.parse(get(k)||'[]'); return Array.isArray(v)?v:[]; } catch {return [];} };
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  let active=get(ACTIVE)||uid(); set(ACTIVE,active);
  const style=document.createElement('style');style.textContent=`
  .edu-tool{padding:8px;border:1px solid var(--line);border-radius:9px;background:var(--panel-2);color:var(--text);cursor:pointer}
  .edu-tools{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.edu-archive{display:flex;gap:5px;align-items:center;margin:5px 0}.edu-archive button:first-child{flex:1;text-align:right}
  .edu-panel{border:1px solid var(--line);padding:10px;border-radius:12px;background:var(--panel);max-height:40vh;overflow:auto}
  .edu-bottom{position:absolute;bottom:125px;left:20px;z-index:4}.chat{position:relative}
  .edu-drop{outline:3px dashed var(--purple);outline-offset:-7px}.edu-highlight{outline:2px solid var(--purple)}
  @media(max-width:800px){.edu-bottom{bottom:115px;left:10px}.edu-archive-panel{position:fixed;inset:80px 12px 95px;z-index:20;max-height:none;overflow:auto;box-shadow:0 10px 35px #0008}}
  @media print{body{overflow:visible!important;background:white!important;color:black!important}.sidebar,.topbar,.composer-area,.edu-tools,.edu-bottom,.actions,.edu-panel,.typing,.call,.toast{display:none!important}.app,.main,.chat{display:block!important;height:auto!important;overflow:visible!important}.message{break-inside:avoid}.bubble{color:#111!important;background:#fff!important;border:1px solid #bbb!important}.message-body{max-width:100%!important}}
  `;document.head.append(style);
  const tools=document.createElement('div');tools.className='edu-tools';
  const mk=(label,fn,parent=tools)=>{const b=document.createElement('button');b.type='button';b.className='edu-tool';b.textContent=label;b.onclick=fn;parent.append(b);return b;};
  const history=()=>read(KEY);
  const archives=()=>read(ARCH);
  function saveCurrent(){const h=history();if(!h.length)return;const a=archives();let item=a.find(x=>x.id===active);if(!item){item={id:active,pinned:false};a.unshift(item);}item.messages=h;item.prev=get(PREV)||'';item.title=(h.find(x=>x.role==='user')?.text||'محادثة').slice(0,55);item.updated=Date.now();set(ARCH,JSON.stringify(a));}
  function switchTo(id){if(window.eduActions?.busy)return alert('أوقف الرد أولاً');saveCurrent();const a=archives(),item=a.find(x=>x.id===id);if(!item)return;set(KEY,JSON.stringify(item.messages));set(PREV,item.prev||'');active=id;set(ACTIVE,id);location.reload();}
  const panel=document.createElement('div');panel.className='edu-panel edu-archive-panel';panel.hidden=true;
  const search=document.createElement('input');search.placeholder='ابحث في المحادثات القديمة';search.className='edu-tool';search.style.width='100%';panel.append(search);
  const results=document.createElement('div');panel.append(results);
  function drawArchives(){saveCurrent();const q=search.value.trim().toLocaleLowerCase();results.replaceChildren();const a=archives().sort((x,y)=>Number(y.pinned)-Number(x.pinned)||y.updated-x.updated);for(const item of a){if(q && !(item.title+' '+item.messages.map(m=>m.text).join(' ')).toLocaleLowerCase().includes(q))continue;const row=document.createElement('div');row.className='edu-archive';mk((item.pinned?'📌 ':'')+item.title,()=>switchTo(item.id),row);mk(item.pinned?'إلغاء التثبيت':'📌',()=>{item.pinned=!item.pinned;set(ARCH,JSON.stringify(a));drawArchives();},row);mk('×',()=>{if(!confirm('حذف المحادثة المؤرشفة؟'))return;set(ARCH,JSON.stringify(a.filter(x=>x.id!==item.id)));drawArchives();},row);results.append(row);}if(!results.children.length)results.textContent='لا توجد نتائج';}
  search.oninput=drawArchives;
  mk('🗂️ المحادثات والبحث',()=>{panel.hidden=!panel.hidden;if(!panel.hidden)drawArchives();});
  mk('📄 PDF',()=>{panel.hidden=true;window.print();});
  mk('⬇️ Markdown',()=>{const h=history();if(!h.length)return alert('لا توجد محادثة');const md='# Education GPT\n\n'+h.map(m=>'### '+(m.role==='user'?'أنت':'Education GPT')+'\n'+m.text).join('\n\n---\n\n');const u=URL.createObjectURL(new Blob([md],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download='education-gpt-chat.md';a.click();setTimeout(()=>URL.revokeObjectURL(u),3000);});
  let font=Number(get('education_gpt_font')||16);function applyFont(){document.querySelectorAll('#chat .bubble').forEach(b=>b.style.fontSize=font+'px');set('education_gpt_font',String(font));}
  mk('A−',()=>{font=Math.max(12,font-1);applyFont();});mk('A+',()=>{font=Math.min(24,font+1);applyFont();});
  const host=document.querySelector('.sidebar .spacer')||document.querySelector('.composer-area');if(host){host.before(tools,panel);}else document.body.append(tools,panel);
  const bottom=mk('↓ آخر رسالة',()=>{$('chat')?.scrollTo({top:$('chat').scrollHeight,behavior:'smooth'});},document.body);bottom.classList.add('edu-bottom');
  // Correct branch/edit: core removes all later turns and rebuilds prior context.
  function enhanceMessages(){const nodes=[...document.querySelectorAll('#chat .message')];const h=history();for(const [j,node] of nodes.entries()){if(node.dataset.eduEnhanced)continue;const m=h[j];if(!m)continue;node.dataset.eduEnhanced='1';const bubble=node.querySelector('.bubble');if(bubble)bubble.style.fontSize=font+'px';const body=node.querySelector('.message-body');if(!body)continue;let actions=body.querySelector('.actions');if(!actions){actions=document.createElement('div');actions.className='actions';body.append(actions);}if(m.role==='user')mk('✏️ تعديل',()=>{const idx=[...document.querySelectorAll('#chat .message')].indexOf(node);const h=history();const old=h[idx]?.text||'';if(old.startsWith('🖼️ [صورة] '))return alert('أعد إرسال الصورة لتعديل هذه الرسالة.');const value=prompt('تعديل الرسالة (سيتم حذف الردود التالية وإعادة توليدها):',old);if(value!==null)window.eduActions?.resend(idx,value);},actions);else mk('نسخ الإجابة',async()=>{try{await navigator.clipboard.writeText(bubble?.dataset.raw||m.text);}catch{alert('تعذر النسخ');}},actions);}
    const last=nodes[nodes.length-1];if(last&&!last.classList.contains('user')&&!last.querySelector('.edu-regen')){const actions=last.querySelector('.actions');if(actions){const b=mk('🔄 إعادة توليد',()=>{const h=history();let i=h.length-1;while(i>=0&&h[i].role!=='user')i--;if(i>=0)window.eduActions?.resend(i,h[i].text);},actions);b.classList.add('edu-regen');}}}
  const chat=$('chat');if(chat){let queued=false;new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;enhanceMessages();applyFont();});}}).observe(chat,{childList:true,subtree:true});enhanceMessages();chat.addEventListener('dragover',e=>{if([...e.dataTransfer.items].some(x=>x.kind==='file')){e.preventDefault();chat.classList.add('edu-drop');}});chat.addEventListener('dragleave',()=>chat.classList.remove('edu-drop'));chat.addEventListener('drop',e=>{chat.classList.remove('edu-drop');const file=[...e.dataTransfer.files].find(f=>f.type.startsWith('image/'));if(!file)return;e.preventDefault();const target=$('imageInput');if(!target)return;const dt=new DataTransfer();dt.items.add(file);target.files=dt.files;target.dispatchEvent(new Event('change',{bubbles:true}));});}
  // Existing new-chat listeners reload the page; capture current transcript before them.
  for(const id of ['newChat','newChatTop'])$(id)?.addEventListener('click',()=>{saveCurrent();active=uid();set(ACTIVE,active);},{capture:true});
  // Save before page unload, but do not overwrite archive on a new-chat reload.

  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('input')?.focus();}});
})();
