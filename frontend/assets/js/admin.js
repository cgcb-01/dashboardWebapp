'use strict';
/* ════════════════════════════
   ADMIN PANEL — Complete
════════════════════════════ */

let AD = { exams:[], tracks:[], stats:{}, loaded:false };

async function _uploadFetch(url, formData) {
  const tok = Auth.token();
  const res = await fetch(url, {
    method: 'POST',
    headers: tok ? {'Authorization':'Bearer '+tok} : {},
    body: formData
  });
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
  return data;
}
async function _patchFetch(url, body) {
  const tok = Auth.token();
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {'Authorization':'Bearer '+tok, 'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
  return data;
}

registerPage('admin', async function(el) {
  if (!Auth.isAdmin()) { toast('Admin access required','err'); go('home'); return; }
  el.innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';
  await _adLoad();
  _adRender(el, 'upload');
});

async function _adLoad() {
  try {
    const [exams, tracks, stats] = await Promise.all([
      GET('/api/pyq/exams'),
      GET('/api/premium/tracks'),
      GET('/api/admin/stats').catch(() => ({}))
    ]);
    AD.exams = exams || []; AD.tracks = tracks || []; AD.stats = stats || {}; AD.loaded = true;
  } catch(e) { console.error('Admin load:', e); }
}

function _adRender(el, tab) {
  const tabs = [['upload','Upload Qs'],['editqs','Edit / Delete'],['dpp','DPP'],['chap','Chapterwise'],['mock','Mock Tests'],['pyq','PYQ Structure'],['media','Media'],['news','News'],['stats','Stats'],['users','Users']];
  el.innerHTML = `<div class="fade-in">
    <div class="page-header" style="margin-bottom:14px"><div class="page-title">Admin Panel</div></div>
    <div style="display:grid;grid-template-columns:190px 1fr;gap:16px;align-items:start">
      <div style="background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--radius-lg);overflow:hidden;position:sticky;top:72px">
        ${tabs.map(([k,l])=>`<button id="abn-${k}" onclick="_adSw('${k}')" style="display:block;width:100%;padding:10px 14px;border:none;border-bottom:1px solid var(--c-border);background:${k===tab?'var(--c-blue-l)':'none'};color:${k===tab?'var(--c-blue)':'var(--c-text3)'};font-size:12px;font-weight:600;text-align:left;cursor:pointer">${l}</button>`).join('')}
      </div>
      <div id="admin-body" class="fade-in"></div>
    </div>
  </div>`;
  _adLoad$(tab);
}

function _adSw(k) {
  document.querySelectorAll('[id^="abn-"]').forEach(b=>{b.style.background=b.id==='abn-'+k?'var(--c-blue-l)':'none';b.style.color=b.id==='abn-'+k?'var(--c-blue)':'var(--c-text3)';});
  _adLoad$(k);
}
function _adLoad$(k) {
  const b=document.getElementById('admin-body');if(!b)return;b.className='fade-in';
  ({upload:_adUpload,editqs:_adEditQs,dpp:_adDpp,chap:_adChap,mock:_adMock,pyq:_adPyq,media:_adMedia,news:_adNews,stats:_adStats,users:_adUsers}[k]||_adStats)(b);
}

/* ═══ TAB 1: UPLOAD QUESTIONS ═══
   _imgs keys (MUST match payload exactly):
   'qf-qi'     → question_image_path
   'qf-oiA'    → option_a_image_path   ← each option has UNIQUE key
   'qf-oiB'    → option_b_image_path
   'qf-oiC'    → option_c_image_path
   'qf-oiD'    → option_d_image_path
   'qf-oiCOMB' → options_image_path    ← combined (rare)
   'qf-si'     → solution_image_path
*/
let _dest=null,_qNum=1,_imgs={};

function _adUpload(el) {
  el.innerHTML=`<div>
    <div class="card" style="margin-bottom:14px"><div class="card-body" style="padding:16px 18px">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--c-blue);margin-bottom:12px">Step 1 — Destination</div>
      <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap" id="dest-tabs">
        ${['PYQ','DPP','Chapterwise','Mock Test'].map((t,i)=>`<button class="pill-tab ${i===0?'active':''}" onclick="_dstClick('${t}',this)">${t}</button>`).join('')}
      </div>
      <div id="dest-sel"></div>
    </div></div>
    <div id="qform-wrap" style="display:none"></div>
  </div>`;
  _dstClick('PYQ',el.querySelector('.pill-tab'));
}

function _dstClick(tab,btn) {
  document.querySelectorAll('.pill-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');_dest=null;
  document.getElementById('qform-wrap').style.display='none';
  const ds=document.getElementById('dest-sel');if(!ds)return;
  if(tab==='PYQ')ds.innerHTML=_dstPYQ();
  else if(tab==='DPP')ds.innerHTML=_dstDPP();
  else if(tab==='Chapterwise')ds.innerHTML=_dstChap();
  else if(tab==='Mock Test')ds.innerHTML=_dstMock();
}

function _dstPYQ(){return`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px">
  <div class="form-group" style="margin:0"><label class="form-label">Exam</label><select id="p-exam" class="form-control" onchange="_pExCh()"><option value="">Select…</option>${AD.exams.map(e=>`<option value="${e.id}">${e.display_name}</option>`).join('')}</select></div>
  <div class="form-group" style="margin:0"><label class="form-label">Year</label><select id="p-year" class="form-control" onchange="_pYrCh()"><option value="">Select…</option></select></div>
  <div class="form-group" style="margin:0"><label class="form-label">Shift</label><select id="p-shift" class="form-control"><option value="">Select…</option></select></div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
  <div class="form-group" style="margin:0"><label class="form-label">Add Year</label><div style="display:flex;gap:6px"><input id="p-ny" type="number" class="form-control" placeholder="e.g. 2026" style="width:100px"><button class="btn btn-secondary btn-sm" onclick="_addYear()">Add</button></div></div>
  <div class="form-group" style="margin:0"><label class="form-label">Add Shift</label><div style="display:flex;gap:6px"><input id="p-ns" class="form-control" placeholder="e.g. Apr 26 Shift 1"><button class="btn btn-secondary btn-sm" onclick="_addShift()">Add</button></div></div>
</div>
<button class="btn btn-primary btn-sm" onclick="_cfmPYQ()">Use This Shift →</button>`;}

window._pExCh=function(){const e=AD.exams.find(e=>e.id==document.getElementById('p-exam').value);document.getElementById('p-year').innerHTML='<option value="">Select…</option>'+(e?.years||[]).sort((a,b)=>b.year-a.year).map(y=>`<option value="${y.id}">${y.year}</option>`).join('');document.getElementById('p-shift').innerHTML='<option value="">Select…</option>';};
window._pYrCh=function(){for(const e of AD.exams){const y=(e.years||[]).find(y=>y.id==document.getElementById('p-year').value);if(y){document.getElementById('p-shift').innerHTML='<option value="">Select…</option>'+(y.shifts||[]).map(s=>`<option value="${s.id}">${s.label}(${s.question_count}Q)</option>`).join('');return;}}};
window._addYear=async function(){const eid=document.getElementById('p-exam').value,yr=document.getElementById('p-ny').value;if(!eid||!yr){toast('Select exam+year','warn');return;}const fd=new FormData();fd.append('exam_id',eid);fd.append('year',yr);try{await _uploadFetch('/api/admin/years',fd);toast(`Year ${yr} added`,'ok');document.getElementById('p-ny').value='';await _adLoad();_pExCh();}catch(e){toast(e.message,'err');}};
window._addShift=async function(){const yid=document.getElementById('p-year').value,lbl=document.getElementById('p-ns').value.trim();if(!yid||!lbl){toast('Select year+label','warn');return;}const fd=new FormData();fd.append('year_id',yid);fd.append('label',lbl);try{await _uploadFetch('/api/admin/shifts',fd);toast(`Shift added`,'ok');document.getElementById('p-ns').value='';await _adLoad();_pYrCh();}catch(e){toast(e.message,'err');}};
window._cfmPYQ=function(){const se=document.getElementById('p-shift'),sid=se.value;if(!sid){toast('Select a shift','warn');return;}const ee=document.getElementById('p-exam');_dest={shift_id:parseInt(sid),label:`PYQ: ${ee.options[ee.selectedIndex]?.text} — ${se.options[se.selectedIndex]?.text}`};_showQForm();};

function _dstDPP(){return`<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:10px">
  <div class="form-group" style="margin:0"><label class="form-label">Track</label><select id="d-trk" class="form-control" onchange="_dTrkCh()"><option value="">Select…</option>${AD.tracks.map(t=>`<option value="${t.id}">${t.display_name}</option>`).join('')}</select></div>
  <div class="form-group" style="margin:0"><label class="form-label">Subject</label><select id="d-sub" class="form-control" onchange="_dSubCh()"><option value="">Select…</option></select></div>
  <div class="form-group" style="margin:0"><label class="form-label">DPP Set</label><select id="d-set" class="form-control" onchange="_dSetCh()"><option value="">Select…</option></select></div>
  <div class="form-group" style="margin:0"><label class="form-label">DPP</label><select id="d-dpp" class="form-control"><option value="">Select…</option></select></div>
</div><button class="btn btn-primary btn-sm" onclick="_cfmDPP()">Use This DPP →</button>`;}
window._dTrkCh=function(){const t=AD.tracks.find(t=>t.id==document.getElementById('d-trk').value);document.getElementById('d-sub').innerHTML='<option value="">Select…</option>'+(t?.subjects||[]).filter(s=>s.is_active).map(s=>`<option value="${s.id}">${s.name}</option>`).join('');document.getElementById('d-set').innerHTML=document.getElementById('d-dpp').innerHTML='<option value="">Select…</option>';};
window._dSubCh=function(){const sid=document.getElementById('d-sub').value,t=AD.tracks.find(t=>t.id==document.getElementById('d-trk').value),s=(t?.subjects||[]).find(s=>s.id==sid);window._curSets=s?.dpp_sets||[];document.getElementById('d-set').innerHTML='<option value="">Select…</option>'+(window._curSets||[]).map(ds=>`<option value="${ds.id}">${ds.name}</option>`).join('');document.getElementById('d-dpp').innerHTML='<option value="">Select…</option>';};
window._dSetCh=function(){const set=(window._curSets||[]).find(s=>s.id==document.getElementById('d-set').value);document.getElementById('d-dpp').innerHTML='<option value="">Select…</option>'+(set?.dpps||[]).sort((a,b)=>a.order_index-b.order_index).map(d=>`<option value="${d.id}">${d.chapter_name||d.title}(${d.question_count}Q)</option>`).join('');};
window._cfmDPP=function(){const de=document.getElementById('d-dpp'),did=de.value;if(!did){toast('Select a DPP','warn');return;}_dest={dpp_id:parseInt(did),label:'DPP: '+de.options[de.selectedIndex]?.text};_showQForm();};

function _dstChap(){return`<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:10px">
  <div class="form-group" style="margin:0"><label class="form-label">Track</label><select id="c-trk" class="form-control" onchange="_cTrkCh()"><option value="">Select…</option>${AD.tracks.map(t=>`<option value="${t.id}">${t.display_name}</option>`).join('')}</select></div>
  <div class="form-group" style="margin:0"><label class="form-label">Subject</label><select id="c-sub" class="form-control" onchange="_cSubCh()"><option value="">Select…</option></select></div>
  <div class="form-group" style="margin:0"><label class="form-label">Chapter</label><select id="c-ch" class="form-control" onchange="_cChCh()"><option value="">Select…</option></select></div>
  <div class="form-group" style="margin:0"><label class="form-label">Module</label><select id="c-mod" class="form-control"><option value="">Select…</option></select></div>
</div><button class="btn btn-primary btn-sm" onclick="_cfmChap()">Use This Module →</button>`;}
window._cTrkCh=function(){const t=AD.tracks.find(t=>t.id==document.getElementById('c-trk').value);document.getElementById('c-sub').innerHTML='<option value="">Select…</option>'+(t?.subjects||[]).filter(s=>s.is_active).map(s=>`<option value="${s.id}">${s.name}</option>`).join('');document.getElementById('c-ch').innerHTML=document.getElementById('c-mod').innerHTML='<option value="">Select…</option>';};
window._cSubCh=function(){const t=AD.tracks.find(t=>t.id==document.getElementById('c-trk').value),s=(t?.subjects||[]).find(s=>s.id==document.getElementById('c-sub').value);const chs=[];(s?.test_sets||[]).forEach(ts=>(ts.chapters||[]).forEach(ch=>chs.push({...ch,tsId:ts.id})));window._curChs=chs;window._curTsId=(s?.test_sets||[])[0]?.id;document.getElementById('c-ch').innerHTML='<option value="">Select…</option>'+chs.map(ch=>`<option value="${ch.id}">${ch.name}</option>`).join('');document.getElementById('c-mod').innerHTML='<option value="">Select…</option>';};
window._cChCh=function(){const ch=(window._curChs||[]).find(c=>c.id==document.getElementById('c-ch').value);document.getElementById('c-mod').innerHTML='<option value="">Select…</option>'+(ch?.modules||[]).map(m=>`<option value="${m.id}">${m.name}(${m.question_count}Q)</option>`).join('');};
window._cfmChap=function(){const me=document.getElementById('c-mod'),mid=me.value;if(!mid){toast('Select a module','warn');return;}_dest={module_id:parseInt(mid),label:'Module: '+me.options[me.selectedIndex]?.text};_showQForm();};

function _dstMock(){return`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px">
  <div class="form-group" style="margin:0"><label class="form-label">Track</label><select id="m-trk" class="form-control" onchange="_mTrkCh()"><option value="">Select…</option>${AD.tracks.map(t=>`<option value="${t.id}">${t.display_name}</option>`).join('')}</select></div>
  <div class="form-group" style="margin:0"><label class="form-label">Subject</label><select id="m-sub" class="form-control" onchange="_mSubCh()"><option value="">Select…</option></select></div>
  <div class="form-group" style="margin:0"><label class="form-label">Mock Test</label><select id="m-mt" class="form-control"><option value="">Select…</option></select></div>
</div><button class="btn btn-primary btn-sm" onclick="_cfmMock()">Use This Mock →</button>`;}
window._mTrkCh=function(){const t=AD.tracks.find(t=>t.id==document.getElementById('m-trk').value);document.getElementById('m-sub').innerHTML='<option value="">Select…</option>'+(t?.subjects||[]).filter(s=>s.is_active).map(s=>`<option value="${s.id}">${s.name}</option>`).join('');document.getElementById('m-mt').innerHTML='<option value="">Select…</option>';};
window._mSubCh=function(){const t=AD.tracks.find(t=>t.id==document.getElementById('m-trk').value),s=(t?.subjects||[]).find(s=>s.id==document.getElementById('m-sub').value);document.getElementById('m-mt').innerHTML='<option value="">Select…</option>'+(s?.mock_tests||[]).map(m=>`<option value="${m.id}">${m.title}</option>`).join('');};
window._cfmMock=function(){const me=document.getElementById('m-mt'),mid=me.value;if(!mid){toast('Select a mock','warn');return;}_dest={mock_test_id:parseInt(mid),label:'Mock: '+me.options[me.selectedIndex]?.text};_showQForm();};

/* ─── QUESTION FORM ───────────────────────────────────────────────────
   THE FIX: fid = 'qf-oi' + key  →  _imgs['qf-oiA'], ['qf-oiB'] etc.
   Payload maps _imgs['qf-oiA'] → option_a_image_path ONLY.
   Combined image uses 'qf-oiCOMB' → options_image_path (separate key).
   No shared upload button — every field has its own unique fid.
─────────────────────────────────────────────────────────────────────── */
function _btnSt(clr){return`display:flex;align-items:center;justify-content:center;width:68px;height:46px;background:${clr}18;border:2px solid ${clr};border-radius:var(--radius-sm);cursor:pointer;color:${clr};font-size:9px;font-weight:800;flex-direction:column;gap:2px;line-height:1.2;text-align:center`;}
function _prevSt(){return`width:68px;height:46px;border-radius:4px;overflow:hidden;border:1px solid var(--c-border);display:none;margin-top:4px`;}

function _showQForm(){
  const sec=document.getElementById('qform-wrap');if(!sec)return;
  sec.style.display='block';_qNum=1;_imgs={};
  sec.innerHTML=`<div class="card"><div class="card-body" style="padding:16px 18px">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
    <div><div style="font-size:13px;font-weight:800;color:var(--c-text)">Add Questions</div>
    <div style="font-size:11px;color:var(--c-blue);margin-top:2px">${_dest?.label||''}</div></div>
    <div style="display:flex;align-items:center;gap:8px"><span style="font-size:11px;color:var(--c-text3);font-weight:600">Q#</span>
    <input id="qf-num" type="number" class="form-control" style="width:60px" value="1"></div>
  </div>
  <div id="qf-err" style="display:none;background:var(--c-red-l);color:var(--c-red);padding:8px 12px;border-radius:var(--radius-sm);font-size:12px;margin-bottom:10px;border-left:3px solid var(--c-red)"></div>
  <div id="qf-ok"  style="display:none;padding:8px 12px;background:var(--c-green-l);color:var(--c-green);border-radius:var(--radius-sm);font-size:12px;margin-bottom:10px;border-left:3px solid var(--c-green)"></div>
  <div style="display:grid;grid-template-columns:1fr 1fr auto auto;gap:10px;margin-bottom:14px;align-items:end">
    <div class="form-group" style="margin:0"><label class="form-label">Subject</label>
      <select id="qf-subj" class="form-control"><option>PHYSICS</option><option>CHEMISTRY</option><option>MATHS</option><option>BIOLOGY</option></select></div>
    <div class="form-group" style="margin:0"><label class="form-label">Type</label>
      <select id="qf-type" class="form-control" onchange="_qfType()">
        <option value="MCQ_SINGLE">MCQ Single</option><option value="MCQ_MULTIPLE">MCQ Multiple</option><option value="NUMERICAL">Numerical</option>
      </select></div>
    <div class="form-group" style="margin:0"><label class="form-label">+Marks</label><input id="qf-mc" type="number" class="form-control" style="width:62px" value="4" step=".5"></div>
    <div class="form-group" style="margin:0"><label class="form-label">−Marks</label><input id="qf-mw" type="number" class="form-control" style="width:62px" value="-1" step=".5"></div>
  </div>
  <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--c-text4);margin-bottom:6px">Question</div>
  <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:14px">
    <textarea id="qf-qt" class="form-control" rows="3" placeholder="Question text" style="flex:1;resize:vertical"></textarea>
    <div style="flex-shrink:0"><label style="${_btnSt('#6366f1')}" title="Upload question image — qf-qi"><input type="file" accept="image/*" id="qf-qi-f" style="display:none" onchange="_imgUp('qf-qi',this)">🖼 Q IMG</label>
    <div id="qf-qi-p" style="${_prevSt()}"></div><div id="qf-qi-s" style="font-size:8px;color:#6366f1;max-width:68px;word-break:break-all;margin-top:2px"></div></div>
  </div>
  <div id="qf-opts-wrap">
    <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--c-text4);margin-bottom:8px">Options — each has its OWN image upload</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
      ${['A','B','C','D'].map(k=>_optField(k)).join('')}
    </div>
    <div style="padding:8px 10px;border:1px dashed var(--c-border);border-radius:var(--radius);background:var(--c-surface2)">
      <div style="font-size:9px;font-weight:700;color:var(--c-text4);margin-bottom:5px">Combined Options Image — use ONLY when all 4 options are one single image (rare)</div>
      <div style="display:flex;gap:8px;align-items:center">
        <label style="${_btnSt('#94a3b8')}" title="Combined options image — qf-oiCOMB → options_image_path"><input type="file" accept="image/*" id="qf-oiCOMB-f" style="display:none" onchange="_imgUp('qf-oiCOMB',this)">🖼 ALL 4</label>
        <div id="qf-oiCOMB-p" style="${_prevSt()}"></div>
        <div id="qf-oiCOMB-s" style="font-size:8px;color:#94a3b8;max-width:120px;word-break:break-all"></div>
      </div>
    </div>
  </div>
  <div class="form-group" style="margin-top:14px">
    <label class="form-label">Correct Answer <span style="color:var(--c-text4);font-weight:500">(A | A,C | 42.5)</span></label>
    <input id="qf-ans" class="form-control" placeholder="e.g. B or A,C or 12.5" style="font-weight:700;color:var(--c-green)">
  </div>
  <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--c-text4);margin-bottom:6px">Solution (optional)</div>
  <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:14px">
    <textarea id="qf-sol" class="form-control" rows="3" placeholder="Solution explanation" style="flex:1;resize:vertical"></textarea>
    <div style="flex-shrink:0"><label style="${_btnSt('#16a34a')}" title="Solution image — qf-si"><input type="file" accept="image/*" id="qf-si-f" style="display:none" onchange="_imgUp('qf-si',this)">🖼 SOL</label>
    <div id="qf-si-p" style="${_prevSt()}"></div><div id="qf-si-s" style="font-size:8px;color:#16a34a;max-width:68px;word-break:break-all;margin-top:2px"></div></div>
  </div>
  <div style="display:flex;gap:8px">
    <button class="btn btn-primary" id="qf-btn" onclick="_qfSub()">Add Question & Continue</button>
    <button class="btn btn-secondary" onclick="_qfClr()">Clear Form</button>
  </div>
</div></div>`;
}

/* Each option: unique fid = 'qf-oi' + key  (A/B/C/D)
   This fid is passed verbatim to _imgUp → stored in _imgs[fid]
   Payload reads _imgs['qf-oiA'] → option_a_image_path, etc. */
function _optField(key){
  const fid='qf-oi'+key;
  const oc={A:'#2563eb',B:'#16a34a',C:'#d97706',D:'#dc2626'};
  const clr=oc[key];
  return `<div style="border:2px solid ${clr}33;border-radius:var(--radius);padding:10px;background:var(--c-surface)">
    <div style="font-size:11px;font-weight:900;color:${clr};margin-bottom:7px;display:flex;align-items:center;gap:5px">
      <div style="width:20px;height:20px;border-radius:50%;background:${clr};color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900">${key}</div>
      Option ${key} <span style="font-size:8px;font-weight:400;color:var(--c-text4)">→ option_${key.toLowerCase()}_image_path</span>
    </div>
    <div style="display:flex;gap:6px;align-items:flex-start">
      <textarea id="qf-o${key}" class="form-control" rows="2" placeholder="Text for ${key} (blank if image only)" style="flex:1;resize:vertical;min-height:40px;border-color:${clr}55"></textarea>
      <div style="flex-shrink:0">
        <label style="${_btnSt(clr)}" title="Image for Option ${key} only — fid=${fid}">
          <input type="file" accept="image/*" id="${fid}-f" style="display:none" onchange="_imgUp('${fid}',this)">
          🖼 OPT ${key}
        </label>
        <div id="${fid}-p" style="${_prevSt()}"></div>
        <div id="${fid}-s" style="font-size:8px;color:${clr};max-width:68px;word-break:break-all;margin-top:2px"></div>
      </div>
    </div>
  </div>`;
}

/* Single _imgUp function — fid is always the UNIQUE per-field key */
window._imgUp=async function(fid,input){
  const file=input.files[0];if(!file)return;
  console.log('[imgUp] fid='+fid+' file='+file.name);
  const reader=new FileReader();
  reader.onload=e=>{const p=document.getElementById(fid+'-p');if(p){p.style.display='block';p.innerHTML=`<img src="${e.target.result}" style="width:100%;height:100%;object-fit:contain">`;}}; 
  reader.readAsDataURL(file);
  const s=document.getElementById(fid+'-s');if(s)s.textContent='Uploading…';
  try{
    const fd=new FormData();fd.append('file',file);
    const r=await _uploadFetch('/api/admin/upload/image',fd);
    _imgs[fid]=r.path;
    console.log('[imgUp] stored _imgs['+fid+']='+r.path);
    if(s)s.textContent='✓ '+r.path.split('/').pop();
  }catch(e){
    if(s)s.textContent='✗ '+e.message;
    const p=document.getElementById(fid+'-p');if(p){p.style.display='none';p.innerHTML='';}
    input.value='';toast('Upload failed: '+e.message,'err');
  }
};

window._qfType=function(){const t=document.getElementById('qf-type')?.value;const w=document.getElementById('qf-opts-wrap');if(w)w.style.display=t==='NUMERICAL'?'none':'';};

async function _qfSub(){
  const err=document.getElementById('qf-err'),ok=document.getElementById('qf-ok'),btn=document.getElementById('qf-btn');
  err.style.display='none';ok.style.display='none';
  if(!_dest){err.textContent='No destination. Complete Step 1.';err.style.display='block';return;}
  const ans=(document.getElementById('qf-ans')?.value||'').trim();
  const qt=document.getElementById('qf-qt')?.value||'';
  const qnum=parseInt(document.getElementById('qf-num')?.value)||_qNum;
  if(!ans){err.textContent='Correct answer required.';err.style.display='block';return;}
  if(!qt&&!_imgs['qf-qi']){err.textContent='Question text or question image required.';err.style.display='block';return;}
  const payload={
    ..._dest,
    subject:document.getElementById('qf-subj')?.value||'PHYSICS',
    question_type:document.getElementById('qf-type')?.value||'MCQ_SINGLE',
    question_number:qnum,
    question_format:(_imgs['qf-qi']&&!qt)?'IMAGE':'TEXT',
    question_text:qt||null,
    question_image_path:_imgs['qf-qi']||null,
    option_a:document.getElementById('qf-oA')?.value||null,
    option_b:document.getElementById('qf-oB')?.value||null,
    option_c:document.getElementById('qf-oC')?.value||null,
    option_d:document.getElementById('qf-oD')?.value||null,
    option_a_image_path:_imgs['qf-oiA']||null,
    option_b_image_path:_imgs['qf-oiB']||null,
    option_c_image_path:_imgs['qf-oiC']||null,
    option_d_image_path:_imgs['qf-oiD']||null,
    options_image_path:_imgs['qf-oiCOMB']||null,
    correct_answer:ans,
    marks_correct:parseFloat(document.getElementById('qf-mc')?.value)||4,
    marks_incorrect:parseFloat(document.getElementById('qf-mw')?.value)||-1,
    solution_format:(_imgs['qf-si']&&!document.getElementById('qf-sol')?.value)?'IMAGE':'TEXT',
    solution_text:document.getElementById('qf-sol')?.value||null,
    solution_image_path:_imgs['qf-si']||null,
  };
  delete payload.label;
  console.log('[qfSub] option image fields:',{a:payload.option_a_image_path,b:payload.option_b_image_path,c:payload.option_c_image_path,d:payload.option_d_image_path,comb:payload.options_image_path});
  if(btn){btn.disabled=true;btn.textContent='Adding…';}
  try{
    const r=await POST('/api/admin/questions',payload);
    _qNum=qnum+1;
    if(document.getElementById('qf-num'))document.getElementById('qf-num').value=_qNum;
    ok.textContent=`✓ Q${qnum} added (ID: ${r.id}). Ready for Q${_qNum}.`;ok.style.display='block';
    _qfClr();document.getElementById('qform-wrap')?.scrollIntoView({behavior:'smooth',block:'start'});
  }catch(e){err.textContent=e.message||String(e);err.style.display='block';}
  finally{if(btn){btn.disabled=false;btn.textContent='Add Question & Continue';}}
}

function _qfClr(){
  ['qf-qt','qf-oA','qf-oB','qf-oC','qf-oD','qf-ans','qf-sol'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  ['qf-qi','qf-oiA','qf-oiB','qf-oiC','qf-oiD','qf-oiCOMB','qf-si'].forEach(fid=>{
    const p=document.getElementById(fid+'-p');if(p){p.style.display='none';p.innerHTML='';}
    const s=document.getElementById(fid+'-s');if(s)s.textContent='';
    const f=document.getElementById(fid+'-f');if(f)f.value='';
  });
  _imgs={};
}

/* ═══ TAB 2: EDIT / DELETE — Google Forms style ═══ */
let _EQ={qs:[],param:{},tab:'PYQ',dragIdx:null};

function _adEditQs(el){
  el.innerHTML=`<div>
    <div class="card" style="margin-bottom:14px"><div class="card-body" style="padding:16px 18px">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--c-blue);margin-bottom:12px">Select Container</div>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap" id="eq-tabs">
        ${['PYQ','DPP','Module','Mock'].map((t,i)=>`<button class="pill-tab ${i===0?'active':''}" onclick="_eqTab('${t}',this)">${t}</button>`).join('')}
      </div>
      <div id="eq-sel"></div>
    </div></div>
    <div id="eq-list"></div>
  </div>`;
  _eqTab('PYQ',el.querySelector('.pill-tab'));
}

function _eqTab(tab,btn){
  document.querySelectorAll('#eq-tabs .pill-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');_EQ.tab=tab;document.getElementById('eq-list').innerHTML='';
  const ds=document.getElementById('eq-sel');if(!ds)return;
  if(tab==='PYQ')ds.innerHTML=_eqSelPYQ();
  else if(tab==='DPP')ds.innerHTML=_eqSelDPP();
  else if(tab==='Module')ds.innerHTML=_eqSelModule();
  else if(tab==='Mock')ds.innerHTML=_eqSelMock();
}

function _eqSelPYQ(){return`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
  <div class="form-group" style="margin:0"><label class="form-label">Exam</label><select id="eq-exam" class="form-control" onchange="_eqExCh()"><option value="">Select…</option>${AD.exams.map(e=>`<option value="${e.id}">${e.display_name}</option>`).join('')}</select></div>
  <div class="form-group" style="margin:0"><label class="form-label">Year</label><select id="eq-year" class="form-control" onchange="_eqYrCh()"><option value="">Select…</option></select></div>
  <div class="form-group" style="margin:0"><label class="form-label">Shift</label><select id="eq-shift" class="form-control"><option value="">Select…</option></select></div>
</div><button class="btn btn-primary btn-sm" style="margin-top:10px" onclick="_eqLoad()">Load Questions</button>`;}

function _eqSelDPP(){return`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
  <div class="form-group" style="margin:0"><label class="form-label">Track</label><select id="eq-trk" class="form-control" onchange="_eqTrkCh()"><option value="">Select…</option>${AD.tracks.map(t=>`<option value="${t.id}">${t.display_name}</option>`).join('')}</select></div>
  <div class="form-group" style="margin:0"><label class="form-label">Subject</label><select id="eq-sub" class="form-control" onchange="_eqSubDpp()"><option value="">Select…</option></select></div>
  <div class="form-group" style="margin:0"><label class="form-label">DPP</label><select id="eq-dpp" class="form-control"><option value="">Select…</option></select></div>
</div><button class="btn btn-primary btn-sm" style="margin-top:10px" onclick="_eqLoad()">Load Questions</button>`;}

function _eqSelModule(){return`<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px">
  <div class="form-group" style="margin:0"><label class="form-label">Track</label><select id="eq-trk" class="form-control" onchange="_eqTrkCh()"><option value="">Select…</option>${AD.tracks.map(t=>`<option value="${t.id}">${t.display_name}</option>`).join('')}</select></div>
  <div class="form-group" style="margin:0"><label class="form-label">Subject</label><select id="eq-sub" class="form-control" onchange="_eqSubChap()"><option value="">Select…</option></select></div>
  <div class="form-group" style="margin:0"><label class="form-label">Chapter</label><select id="eq-ch" class="form-control" onchange="_eqChCh()"><option value="">Select…</option></select></div>
  <div class="form-group" style="margin:0"><label class="form-label">Module</label><select id="eq-mod" class="form-control"><option value="">Select…</option></select></div>
</div><button class="btn btn-primary btn-sm" style="margin-top:10px" onclick="_eqLoad()">Load Questions</button>`;}

function _eqSelMock(){return`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
  <div class="form-group" style="margin:0"><label class="form-label">Track</label><select id="eq-trk" class="form-control" onchange="_eqTrkCh()"><option value="">Select…</option>${AD.tracks.map(t=>`<option value="${t.id}">${t.display_name}</option>`).join('')}</select></div>
  <div class="form-group" style="margin:0"><label class="form-label">Subject</label><select id="eq-sub" class="form-control" onchange="_eqSubMock()"><option value="">Select…</option></select></div>
  <div class="form-group" style="margin:0"><label class="form-label">Mock</label><select id="eq-mock" class="form-control"><option value="">Select…</option></select></div>
</div><button class="btn btn-primary btn-sm" style="margin-top:10px" onclick="_eqLoad()">Load Questions</button>`;}

window._eqExCh=function(){const e=AD.exams.find(e=>e.id==document.getElementById('eq-exam').value);document.getElementById('eq-year').innerHTML='<option value="">Select…</option>'+(e?.years||[]).sort((a,b)=>b.year-a.year).map(y=>`<option value="${y.id}">${y.year}</option>`).join('');const s=document.getElementById('eq-shift');if(s)s.innerHTML='<option value="">Select…</option>';};
window._eqYrCh=function(){for(const e of AD.exams){const y=(e.years||[]).find(y=>y.id==document.getElementById('eq-year').value);if(y){document.getElementById('eq-shift').innerHTML='<option value="">Select…</option>'+(y.shifts||[]).map(s=>`<option value="${s.id}">${s.label}</option>`).join('');return;}}};
window._eqTrkCh=function(){const t=AD.tracks.find(t=>t.id==document.getElementById('eq-trk').value);const el=document.getElementById('eq-sub');if(!el)return;el.innerHTML='<option value="">Select…</option>'+(t?.subjects||[]).filter(s=>s.is_active).map(s=>`<option value="${s.id}">${s.name}</option>`).join('');['eq-dpp','eq-ch','eq-mod','eq-mock'].forEach(id=>{const e=document.getElementById(id);if(e)e.innerHTML='<option value="">Select…</option>';});};
window._eqSubDpp=function(){const t=AD.tracks.find(t=>t.id==document.getElementById('eq-trk').value),s=(t?.subjects||[]).find(s=>s.id==document.getElementById('eq-sub').value);const dpps=(s?.dpp_sets||[]).flatMap(ds=>(ds.dpps||[]).map(d=>({...d})));const el=document.getElementById('eq-dpp');if(el)el.innerHTML='<option value="">Select…</option>'+dpps.map(d=>`<option value="${d.id}">${d.chapter_name||d.title}</option>`).join('');};
window._eqSubChap=function(){const t=AD.tracks.find(t=>t.id==document.getElementById('eq-trk').value),s=(t?.subjects||[]).find(s=>s.id==document.getElementById('eq-sub').value);window._eqChs=(s?.test_sets||[]).flatMap(ts=>(ts.chapters||[]).map(ch=>({...ch})));const el=document.getElementById('eq-ch');if(el)el.innerHTML='<option value="">Select…</option>'+window._eqChs.map(ch=>`<option value="${ch.id}">${ch.name}</option>`).join('');const m=document.getElementById('eq-mod');if(m)m.innerHTML='<option value="">Select…</option>';};
window._eqChCh=function(){const ch=(window._eqChs||[]).find(c=>c.id==document.getElementById('eq-ch').value);const el=document.getElementById('eq-mod');if(el)el.innerHTML='<option value="">Select…</option>'+(ch?.modules||[]).map(m=>`<option value="${m.id}">${m.name}</option>`).join('');};
window._eqSubMock=function(){const t=AD.tracks.find(t=>t.id==document.getElementById('eq-trk').value),s=(t?.subjects||[]).find(s=>s.id==document.getElementById('eq-sub').value);const el=document.getElementById('eq-mock');if(el)el.innerHTML='<option value="">Select…</option>'+(s?.mock_tests||[]).map(m=>`<option value="${m.id}">${m.title}</option>`).join('');};

window._eqLoad=async function(){
  const tab=_EQ.tab;let param={};
  if(tab==='PYQ'){const v=document.getElementById('eq-shift')?.value;if(!v){toast('Select shift','warn');return;}param={shift_id:v};}
  else if(tab==='DPP'){const v=document.getElementById('eq-dpp')?.value;if(!v){toast('Select DPP','warn');return;}param={dpp_id:v};}
  else if(tab==='Module'){const v=document.getElementById('eq-mod')?.value;if(!v){toast('Select module','warn');return;}param={module_id:v};}
  else if(tab==='Mock'){const v=document.getElementById('eq-mock')?.value;if(!v){toast('Select mock','warn');return;}param={mock_test_id:v};}
  _EQ.param=param;
  const qs=Object.entries(param).map(([k,v])=>`${k}=${v}`).join('&');
  const el=document.getElementById('eq-list');
  el.innerHTML='<div class="loading-center" style="padding:20px"><div class="spinner"></div></div>';
  try{_EQ.qs=await GET(`/api/admin/questions?${qs}`);_eqRender();}
  catch(e){el.innerHTML=`<div style="padding:14px;color:var(--c-red)">${e.message}</div>`;}
};

function _eqRender(){
  const el=document.getElementById('eq-list');if(!el)return;
  const qs=_EQ.qs,param=_EQ.param,key=Object.keys(param)[0],id=param[key];
  let bar='';
  if(key!=='shift_id'){
    const type=key==='dpp_id'?'dpps':key==='module_id'?'modules':'mock-tests';
    bar=`<div class="card" style="margin-bottom:10px"><div class="card-body" style="padding:12px 16px;display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
      <div style="font-size:11px;font-weight:800;color:var(--c-blue);align-self:center">Container Settings</div>
      <div class="form-group" style="margin:0"><label class="form-label">Duration (min)</label><input id="cnt-dur" type="number" class="form-control" style="width:80px" placeholder="mins"></div>
      <div class="form-group" style="margin:0"><label class="form-label">Access</label><select id="cnt-free" class="form-control" style="width:120px"><option value="false">🔒 Locked</option><option value="true">🔓 Free</option></select></div>
      ${type==='mock-tests'?`<div class="form-group" style="margin:0"><label class="form-label">Scheduled Date</label><input id="cnt-date" type="date" class="form-control" style="width:140px"></div>`:''}
      <button class="btn btn-primary btn-sm" onclick="_saveContainerSettings('${type}',${id})">Save</button>
    </div></div>`;
  }
  if(!qs.length){el.innerHTML=bar+`<div style="padding:40px;text-align:center;color:var(--c-text4);font-size:12px;background:var(--c-surface);border-radius:var(--radius-lg);border:2px dashed var(--c-border)">No questions yet — use Upload Qs tab to add some.</div>`;return;}
  el.innerHTML=bar+`<div class="card" style="overflow:visible">
    <div style="padding:10px 16px;background:var(--c-surface2);border-bottom:1px solid var(--c-border);font-size:12px;font-weight:800;display:flex;justify-content:space-between;align-items:center;border-radius:var(--radius-lg) var(--radius-lg) 0 0">
      <span>${qs.length} Questions — click to expand · drag ≡ to reorder</span>
      <button class="btn btn-secondary btn-sm" onclick="_eqLoad()">↺ Refresh</button>
    </div>
    <div id="eq-cards">${qs.map((q,i)=>_eqCard(q,i)).join('')}</div>
  </div>`;
}

function _eqCard(q,i){
  const tc={MCQ_SINGLE:'#2563eb',MCQ_MULTIPLE:'#7c3aed',NUMERICAL:'#d97706'}[q.question_type]||'#666';
  const sc={PHYSICS:'#0ea5e9',CHEMISTRY:'#16a34a',MATHS:'#9333ea',BIOLOGY:'#f59e0b'}[q.subject]||'#888';
  const optImgs=['A','B','C','D'].filter(k=>q['option_'+k.toLowerCase()+'_image_path']);
  return`<div class="eq-card" id="eqc-${q.id}" data-id="${q.id}" style="border-bottom:1px solid var(--c-border);background:var(--c-surface);transition:background .1s" draggable="true" ondragstart="_eqDS(event,${i})" ondragover="_eqDO(event,${i})" ondrop="_eqDP(event,${i})" ondragend="_eqDE()">
    <div onclick="_eqToggle(${q.id})" style="display:flex;align-items:flex-start;gap:10px;padding:12px 14px;cursor:pointer;user-select:none" onmouseover="this.parentElement.style.background='var(--c-surface2)'" onmouseout="this.parentElement.style.background='var(--c-surface)'">
      <div style="color:var(--c-text4);font-size:18px;padding-top:2px;cursor:grab" title="Drag to reorder">≡</div>
      <div style="width:30px;height:30px;border-radius:6px;background:var(--c-blue-l);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:var(--c-blue);flex-shrink:0">Q${q.question_number}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;color:var(--c-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px">${q.question_text||'[Image question]'}</div>
        <div style="display:flex;gap:5px;flex-wrap:wrap">
          <span style="padding:1px 7px;border-radius:99px;font-size:9px;font-weight:700;background:${sc}22;color:${sc}">${q.subject}</span>
          <span style="padding:1px 7px;border-radius:99px;font-size:9px;font-weight:700;background:${tc}22;color:${tc}">${q.question_type.replace('_',' ')}</span>
          <span style="font-size:10px;color:var(--c-text4)">+${q.marks_correct}/${q.marks_incorrect}</span>
          <span style="font-size:10px;font-weight:700;color:var(--c-green)">Ans: ${q.correct_answer}</span>
          ${q.question_image_path?'<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:#6366f122;color:#6366f1">Q-img</span>':''}
          ${optImgs.map(k=>`<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:#2563eb22;color:#2563eb">Opt-${k}-img</span>`).join('')}
          ${q.options_image_path?'<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:#94a3b822;color:#94a3b8">Combined-img</span>':''}
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;align-items:center">
        <button onclick="event.stopPropagation();_delQ(${q.id})" style="padding:4px 10px;border-radius:4px;border:1px solid var(--c-red);background:var(--c-red-l);color:var(--c-red);font-size:10px;font-weight:700;cursor:pointer">Delete</button>
        <span style="font-size:12px;color:var(--c-text4)" id="eq-arrow-${q.id}">▼</span>
      </div>
    </div>
    <div id="eqe-${q.id}" style="display:none;border-top:2px solid var(--c-blue);padding:16px;background:var(--c-bg)">${_eqEditor(q)}</div>
  </div>`;
}

function _thumb(path,label){
  if(!path)return'';
  const url='/static/uploads/'+path.replace(/^uploads[/\\]/,'');
  return`<div style="margin-top:5px;padding:5px;background:var(--c-surface);border-radius:4px;border:1px solid var(--c-border)">
    <div style="font-size:8px;color:var(--c-text4);margin-bottom:2px">${label}</div>
    <img src="${url}" style="max-height:60px;max-width:160px;border-radius:3px;object-fit:contain" onerror="this.parentElement.style.display='none'">
    <div style="font-size:8px;color:var(--c-text4);margin-top:1px">${path.split(/[/\\]/).pop()}</div>
  </div>`;}

function _eqEditor(q){
  const oc={A:'#2563eb',B:'#16a34a',C:'#d97706',D:'#dc2626'};
  return`<div style="display:flex;flex-direction:column;gap:12px">
  <div style="display:grid;grid-template-columns:80px 1fr 1fr auto auto;gap:10px;align-items:end">
    <div class="form-group" style="margin:0"><label class="form-label">Q #</label><input id="qe-qnum-${q.id}" type="number" class="form-control" value="${q.question_number}" style="font-size:11px"></div>
    <div class="form-group" style="margin:0"><label class="form-label">Type</label><select id="qe-type-${q.id}" class="form-control" style="font-size:11px">${['MCQ_SINGLE','MCQ_MULTIPLE','NUMERICAL'].map(t=>`<option ${t===q.question_type?'selected':''}>${t}</option>`).join('')}</select></div>
    <div class="form-group" style="margin:0"><label class="form-label">Correct Answer</label><input id="qe-ans-${q.id}" class="form-control" value="${q.correct_answer||''}" style="font-size:11px;font-weight:700;color:var(--c-green)"></div>
    <div class="form-group" style="margin:0"><label class="form-label">+Marks</label><input id="qe-mc-${q.id}" type="number" class="form-control" value="${q.marks_correct}" style="width:62px;font-size:11px" step=".5"></div>
    <div class="form-group" style="margin:0"><label class="form-label">−Marks</label><input id="qe-mw-${q.id}" type="number" class="form-control" value="${q.marks_incorrect}" style="width:62px;font-size:11px" step=".5"></div>
  </div>
  <div class="form-group" style="margin:0"><label class="form-label">Question Text</label>
    <textarea id="qe-qt-${q.id}" class="form-control" rows="3" style="font-size:11px">${q.question_text||''}</textarea>
    ${_thumb(q.question_image_path,'Current question image')}
  </div>
  <div><label class="form-label">Options</label>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${['A','B','C','D'].map(k=>{const kl=k.toLowerCase(),v=q['option_'+kl]||'',ip=q['option_'+kl+'_image_path']||'',clr=oc[k];
      return`<div style="padding:10px;border:2px solid ${clr}33;border-radius:var(--radius);background:var(--c-surface)">
        <div style="font-size:10px;font-weight:900;color:${clr};margin-bottom:5px;display:flex;align-items:center;gap:4px">
          <div style="width:18px;height:18px;border-radius:50%;background:${clr};color:#fff;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900">${k}</div>Option ${k}
        </div>
        <textarea id="qe-o${k}-${q.id}" class="form-control" rows="2" style="font-size:11px;border-color:${clr}44">${v}</textarea>
        ${_thumb(ip,'Current image for option '+k)}
        <label style="display:flex;align-items:center;gap:5px;margin-top:5px;font-size:8px;font-weight:700;color:${clr};cursor:pointer;padding:3px 7px;border:1px solid ${clr};border-radius:3px;width:fit-content;background:${clr}11">
          <input type="file" accept="image/*" style="display:none" onchange="_eqOptImg(${q.id},'${k}',this)">
          📷 ${ip?'Replace':'Add'} image for Opt ${k}
        </label>
        <div id="eqoi-${q.id}-${k}" style="font-size:8px;margin-top:2px;color:${clr}"></div>
      </div>`}).join('')}
    </div>
    ${q.options_image_path?`<div style="margin-top:8px">${_thumb(q.options_image_path,'Combined options image')}</div>`:''}
  </div>
  <div class="form-group" style="margin:0"><label class="form-label">Solution</label>
    <textarea id="qe-sol-${q.id}" class="form-control" rows="3" style="font-size:11px">${q.solution_text||''}</textarea>
    ${_thumb(q.solution_image_path,'Current solution image')}
  </div>
  <div style="display:flex;gap:8px;align-items:center">
    <button class="btn btn-primary btn-sm" onclick="_saveQ(${q.id})">💾 Save Changes</button>
    <button class="btn btn-secondary btn-sm" onclick="_eqToggle(${q.id})">Cancel</button>
    <div id="qe-msg-${q.id}" style="display:none;font-size:11px;padding:4px 10px;border-radius:4px;margin-left:8px"></div>
  </div>
</div>`;}

function _eqToggle(id){const p=document.getElementById('eqe-'+id),a=document.getElementById('eq-arrow-'+id);if(!p)return;const o=p.style.display==='none';p.style.display=o?'block':'none';if(a)a.textContent=o?'▲':'▼';}

window._eqOptImg=async function(qId,key,input){
  const file=input.files[0];if(!file)return;
  const si=document.getElementById(`eqoi-${qId}-${key}`);if(si)si.textContent='Uploading…';
  try{
    const fd=new FormData();fd.append('file',file);const r=await _uploadFetch('/api/admin/upload/image',fd);
    const field='option_'+key.toLowerCase()+'_image_path';
    await PUT(`/api/admin/questions/${qId}`,{[field]:r.path});
    if(si)si.textContent=`✓ Saved: ${r.path.split('/').pop()}`;
    toast(`Option ${key} image updated`,'ok',2000);
    const q=_EQ.qs.find(q=>q.id===qId);if(q)q[field]=r.path;
  }catch(e){if(si)si.textContent='✗ '+e.message;toast(e.message,'err');}
};

window._saveQ=async function(id){
  const msg=document.getElementById('qe-msg-'+id);
  const ans=document.getElementById(`qe-ans-${id}`)?.value?.trim();
  if(!ans){if(msg){msg.textContent='Answer required';msg.style.cssText='display:block;background:var(--c-red-l);color:var(--c-red)';}return;}
  const payload={
    question_number:parseInt(document.getElementById(`qe-qnum-${id}`)?.value)||undefined,
    question_type:document.getElementById(`qe-type-${id}`)?.value,
    question_text:document.getElementById(`qe-qt-${id}`)?.value||null,
    correct_answer:ans,
    marks_correct:parseFloat(document.getElementById(`qe-mc-${id}`)?.value),
    marks_incorrect:parseFloat(document.getElementById(`qe-mw-${id}`)?.value),
    option_a:document.getElementById(`qe-oA-${id}`)?.value||null,
    option_b:document.getElementById(`qe-oB-${id}`)?.value||null,
    option_c:document.getElementById(`qe-oC-${id}`)?.value||null,
    option_d:document.getElementById(`qe-oD-${id}`)?.value||null,
    solution_text:document.getElementById(`qe-sol-${id}`)?.value||null,
  };
  try{
    await PUT(`/api/admin/questions/${id}`,payload);
    if(msg){msg.textContent='✓ Saved';msg.style.cssText='display:block;background:var(--c-green-l);color:var(--c-green)';setTimeout(()=>msg.style.display='none',3000);}
    const q=_EQ.qs.find(q=>q.id===id);if(q)Object.assign(q,payload);
    toast('Saved','ok',1500);
  }catch(e){if(msg){msg.textContent=e.message;msg.style.cssText='display:block;background:var(--c-red-l);color:var(--c-red)';}}
};

window._delQ=async function(id){
  if(!confirm(`Delete Q${id}? Cannot be undone.`))return;
  try{await DEL(`/api/admin/questions/${id}`);toast('Deleted','ok');_EQ.qs=_EQ.qs.filter(q=>q.id!==id);const c=document.getElementById('eqc-'+id);if(c){c.style.opacity='0';c.style.transition='opacity .2s';setTimeout(()=>c.remove(),200);}}
  catch(e){toast(e.message,'err');}
};

window._eqDS=function(e,i){_EQ.dragIdx=i;e.currentTarget.style.opacity='.4';};
window._eqDE=function(){document.querySelectorAll('.eq-card').forEach(c=>{c.style.opacity='1';c.style.borderTop='';});};
window._eqDO=function(e,i){e.preventDefault();document.querySelectorAll('.eq-card').forEach(c=>c.style.borderTop='');if(i!==_EQ.dragIdx)e.currentTarget.style.borderTop='3px solid var(--c-blue)';};
window._eqDP=async function(e,to){
  e.preventDefault();const from=_EQ.dragIdx;if(from===null||from===to)return;
  const[m]=_EQ.qs.splice(from,1);_EQ.qs.splice(to,0,m);
  const patches=[];_EQ.qs.forEach((q,i)=>{const n=i+1;if(q.question_number!==n){q.question_number=n;patches.push(PUT(`/api/admin/questions/${q.id}`,{question_number:n}));}});
  try{await Promise.all(patches);toast('Reordered','ok',1500);}catch(e){toast('Reorder failed: '+e.message,'warn');}
  _eqRender();
};

window._saveContainerSettings=async function(type,id){
  const dur=document.getElementById('cnt-dur')?.value,free=document.getElementById('cnt-free')?.value==='true',date=document.getElementById('cnt-date')?.value;
  const p={is_free_for_non_premium:free};if(dur)p.duration_minutes=parseInt(dur);if(date)p.scheduled_date=date;
  try{await _patchFetch(`/api/admin/premium/${type}/${id}`,p);toast('Settings saved','ok');}catch(e){toast(e.message,'err');}
};

/* ═══ TABS 3-10 (compact) ═══ */
function _adDpp(el){el.innerHTML=`<div style="display:flex;flex-direction:column;gap:12px">${AD.tracks.map(trk=>`<div class="card"><div class="card-body"><div style="font-size:13px;font-weight:800;color:var(--c-blue);margin-bottom:10px">${trk.display_name}</div>${(trk.subjects||[]).map(s=>{const sets=s.dpp_sets||[];return`<div style="margin-bottom:10px;padding:10px;background:var(--c-surface2);border-radius:var(--radius);border:1px solid var(--c-border)"><div style="font-size:11px;font-weight:700;color:var(--c-text);margin-bottom:6px">${s.name}</div>${sets.map(ds=>`<div style="margin-bottom:4px;padding:4px 8px;background:var(--c-surface);border-radius:4px;border:1px solid var(--c-border)"><span style="font-size:11px;font-weight:600">${ds.name}</span>${(ds.dpps||[]).map(d=>`<div style="display:flex;align-items:center;gap:8px;padding:2px 4px;margin-top:2px"><span style="font-size:11px;flex:1;color:var(--c-text3)">${d.chapter_name||d.title}·${d.duration_minutes}min·${d.question_count}Q</span><button onclick="_dppFree(${d.id},${d.is_free_for_non_premium})" style="padding:2px 8px;border-radius:3px;border:1px solid;font-size:9px;font-weight:700;cursor:pointer;background:${d.is_free_for_non_premium?'var(--c-green-l)':'var(--c-surface2)'};color:${d.is_free_for_non_premium?'var(--c-green)':'var(--c-text4)'};border-color:${d.is_free_for_non_premium?'var(--c-green)':'var(--c-border)'}">${d.is_free_for_non_premium?'FREE ✓':'LOCKED'}</button></div>`).join('')}</div>`).join('')}<div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap"><input placeholder="New set name…" id="dsnew-${s.id}" style="padding:4px 8px;border:1px solid var(--c-border);border-radius:4px;font-size:11px;background:var(--c-surface);color:var(--c-text);flex:1"><button class="btn btn-secondary btn-sm" onclick="_mkDppSet2(${s.id},'dsnew-${s.id}')">+ Set</button>${sets.length?`<select id="dsid-${s.id}" style="padding:4px 8px;border:1px solid var(--c-border);border-radius:4px;font-size:11px;background:var(--c-surface);color:var(--c-text)">${sets.map(ds=>`<option value="${ds.id}">${ds.name}</option>`).join('')}</select><input placeholder="Chapter DPP name…" id="dchap-${s.id}" style="padding:4px 8px;border:1px solid var(--c-border);border-radius:4px;font-size:11px;background:var(--c-surface);color:var(--c-text);flex:1"><button class="btn btn-secondary btn-sm" onclick="_mkDpp2('dsid-${s.id}','dchap-${s.id}')">+ DPP</button>`:''}</div></div>`}).join('')}</div></div>`).join('')}</div>`;}
window._dppFree=async function(id,cur){try{await _patchFetch(`/api/admin/premium/dpps/${id}`,{is_free_for_non_premium:!cur});toast(!cur?'Set FREE':'Set LOCKED','ok',1500);await _adLoad();_adDpp(document.getElementById('admin-body'));}catch(e){toast(e.message,'err');}};
window._mkDppSet2=async function(sid,iid){const name=document.getElementById(iid)?.value.trim();if(!name){toast('Enter set name','warn');return;}const fd=new FormData();fd.append('subject_id',sid);fd.append('name',name);fd.append('questions_per_dpp','15');try{await _uploadFetch('/api/admin/premium/dpp-sets',fd);toast(`"${name}" created`,'ok');document.getElementById(iid).value='';await _adLoad();_adDpp(document.getElementById('admin-body'));}catch(e){toast(e.message,'err');}};
window._mkDpp2=async function(ssid,iid){const setId=document.getElementById(ssid)?.value,ch=document.getElementById(iid)?.value.trim();if(!setId||!ch){toast('Select set + enter name','warn');return;}const fd=new FormData();fd.append('dpp_set_id',setId);fd.append('title','DPP — '+ch);fd.append('chapter_name',ch);fd.append('order_index','99');fd.append('duration_minutes','30');try{await _uploadFetch('/api/admin/premium/dpps',fd);toast(`"${ch}" added`,'ok');document.getElementById(iid).value='';await _adLoad();_adDpp(document.getElementById('admin-body'));}catch(e){toast(e.message,'err');}};

function _adChap(el){el.innerHTML=`<div style="display:flex;flex-direction:column;gap:12px">${AD.tracks.map(trk=>`<div class="card"><div class="card-body"><div style="font-size:13px;font-weight:800;color:var(--c-blue);margin-bottom:10px">${trk.display_name}</div>${(trk.subjects||[]).map(s=>{const chs=(s.test_sets||[]).flatMap(ts=>(ts.chapters||[]).map(ch=>({...ch,tsId:ts.id})));const tsId=(s.test_sets||[])[0]?.id;return`<div style="margin-bottom:10px;padding:10px;background:var(--c-surface2);border-radius:var(--radius);border:1px solid var(--c-border)"><div style="font-size:11px;font-weight:700;color:var(--c-text);margin-bottom:6px">${s.name}—${chs.length} chapters</div>${chs.map(ch=>`<div style="margin-bottom:6px"><div style="font-size:10px;font-weight:700;color:var(--c-text3);margin-bottom:3px">${ch.name}</div><div style="display:flex;flex-wrap:wrap;gap:3px">${(ch.modules||[]).map(m=>`<div style="display:flex;align-items:center;gap:3px;padding:2px 7px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:3px"><span style="font-size:10px">${m.name}</span><button onclick="_modFree(${m.id},${m.is_free_for_non_premium})" style="padding:0px 5px;border-radius:2px;border:1px solid;font-size:8px;font-weight:700;cursor:pointer;background:${m.is_free_for_non_premium?'var(--c-green-l)':'var(--c-surface2)'};color:${m.is_free_for_non_premium?'var(--c-green)':'var(--c-text4)'};border-color:${m.is_free_for_non_premium?'var(--c-green)':'var(--c-border)'}">${m.is_free_for_non_premium?'FREE':'LOCK'}</button></div>`).join('')}</div><div style="display:flex;gap:4px;margin-top:4px"><input placeholder="New module…" id="chnm-${ch.id}" style="padding:3px 8px;border:1px solid var(--c-border);border-radius:3px;font-size:11px;background:var(--c-surface);color:var(--c-text);flex:1"><button class="btn btn-secondary btn-sm" onclick="_mkMod2(${ch.id},'chnm-${ch.id}')">+ Module</button></div></div>`).join('')}${tsId?`<div style="display:flex;gap:4px;margin-top:8px"><input placeholder="New chapter…" id="chnn-${s.id}" style="padding:3px 8px;border:1px solid var(--c-border);border-radius:3px;font-size:11px;background:var(--c-surface);color:var(--c-text);flex:1"><button class="btn btn-secondary btn-sm" onclick="_mkChap2(${tsId},'chnn-${s.id}')">+ Chapter</button></div>`:''}</div>`}).join('')}</div></div>`).join('')}</div>`;}
window._modFree=async function(id,cur){try{await _patchFetch(`/api/admin/premium/modules/${id}`,{is_free_for_non_premium:!cur});toast(!cur?'Module FREE':'Module LOCKED','ok',1500);await _adLoad();_adChap(document.getElementById('admin-body'));}catch(e){toast(e.message,'err');}};
window._mkChap2=async function(tsId,iid){const name=document.getElementById(iid)?.value.trim();if(!name){toast('Enter chapter name','warn');return;}const fd=new FormData();fd.append('test_set_id',tsId);fd.append('name',name);fd.append('order_index','99');try{await _uploadFetch('/api/admin/premium/chapters',fd);toast(`"${name}" added`,'ok');document.getElementById(iid).value='';await _adLoad();_adChap(document.getElementById('admin-body'));}catch(e){toast(e.message,'err');}};
window._mkMod2=async function(chId,iid){const name=document.getElementById(iid)?.value.trim();if(!name){toast('Enter module name','warn');return;}const fd=new FormData();fd.append('chapter_id',chId);fd.append('name',name);fd.append('order_index','99');fd.append('duration_minutes','30');try{await _uploadFetch('/api/admin/premium/modules',fd);toast(`"${name}" added`,'ok');document.getElementById(iid).value='';await _adLoad();_adChap(document.getElementById('admin-body'));}catch(e){toast(e.message,'err');}};

function _adMock(el){el.innerHTML=`<div style="display:flex;flex-direction:column;gap:12px">${AD.tracks.map(trk=>`<div class="card"><div class="card-body"><div style="font-size:13px;font-weight:800;color:var(--c-blue);margin-bottom:10px">${trk.display_name}</div>${(trk.subjects||[]).map(s=>`<div style="margin-bottom:10px;padding:10px;background:var(--c-surface2);border-radius:var(--radius);border:1px solid var(--c-border)"><div style="font-size:11px;font-weight:700;color:var(--c-text);margin-bottom:6px">${s.name}</div>${(s.mock_tests||[]).map(mt=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:4px;margin-bottom:4px"><div style="flex:1"><div style="font-size:11px;font-weight:600">${mt.title}</div><div style="font-size:10px;color:var(--c-text4)">${mt.duration_minutes}min·${mt.question_count}Q${mt.scheduled_date?'·'+mt.scheduled_date:''}</div></div><button onclick="_mockFree(${mt.id},${mt.is_free_for_non_premium})" style="padding:2px 8px;border-radius:3px;border:1px solid;font-size:9px;font-weight:700;cursor:pointer;background:${mt.is_free_for_non_premium?'var(--c-green-l)':'var(--c-surface2)'};color:${mt.is_free_for_non_premium?'var(--c-green)':'var(--c-text4)'};border-color:${mt.is_free_for_non_premium?'var(--c-green)':'var(--c-border)'}">${mt.is_free_for_non_premium?'FREE ✓':'LOCKED'}</button></div>`).join('')||'<div style="font-size:11px;color:var(--c-text4)">No mocks yet</div>'}<div style="display:flex;gap:4px;margin-top:8px;flex-wrap:wrap"><input placeholder="Mock title…" id="mtnq-${s.id}" style="padding:4px 8px;border:1px solid var(--c-border);border-radius:4px;font-size:11px;background:var(--c-surface);color:var(--c-text);flex:1"><input type="number" value="180" id="mtnd-${s.id}" style="padding:4px 8px;border:1px solid var(--c-border);border-radius:4px;font-size:11px;background:var(--c-surface);color:var(--c-text);width:70px"><button class="btn btn-secondary btn-sm" onclick="_mkMock2(${s.id},'mtnq-${s.id}','mtnd-${s.id}')">+ Mock</button></div></div>`).join('')}</div></div>`).join('')}</div>`;}
window._mockFree=async function(id,cur){try{await _patchFetch(`/api/admin/premium/mock-tests/${id}`,{is_free_for_non_premium:!cur});toast(!cur?'Mock FREE':'Mock LOCKED','ok',1500);await _adLoad();_adMock(document.getElementById('admin-body'));}catch(e){toast(e.message,'err');}};
window._mkMock2=async function(sid,tid,did){const title=document.getElementById(tid)?.value.trim(),dur=document.getElementById(did)?.value||180;if(!title){toast('Enter title','warn');return;}const fd=new FormData();fd.append('subject_id',sid);fd.append('title',title);fd.append('duration_minutes',dur);fd.append('order_index','99');try{await _uploadFetch('/api/admin/premium/mock-tests',fd);toast(`"${title}" created`,'ok');document.getElementById(tid).value='';await _adLoad();_adMock(document.getElementById('admin-body'));}catch(e){toast(e.message,'err');}};

function _adPyq(el){el.innerHTML=`<div style="display:flex;flex-direction:column;gap:12px"><div class="card"><div class="card-body"><div style="font-size:12px;font-weight:800;margin-bottom:10px">Current PYQ Structure</div><div style="max-height:250px;overflow-y:auto">${AD.exams.map(e=>`<div style="margin-bottom:8px"><div style="font-size:12px;font-weight:800;color:var(--c-blue)">${e.display_name}</div>${(e.years||[]).sort((a,b)=>b.year-a.year).map(y=>`<div style="padding-left:12px;margin-top:3px"><span style="font-size:11px;font-weight:700">${y.year}</span><span style="font-size:10px;color:var(--c-text4);margin-left:6px">${(y.shifts||[]).map(s=>s.label+'('+s.question_count+'Q)').join(', ')}</span></div>`).join('')}</div>`).join('')}</div></div></div><div class="card"><div class="card-body"><div style="font-size:12px;font-weight:800;margin-bottom:10px">Add Year</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="form-group" style="margin:0"><label class="form-label">Exam</label><select id="ps-ex" class="form-control">${AD.exams.map(e=>`<option value="${e.id}">${e.display_name}</option>`).join('')}</select></div><div class="form-group" style="margin:0"><label class="form-label">Year</label><input id="ps-yr" type="number" class="form-control" placeholder="e.g. 2027"></div></div><button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="_psAddYear()">Add Year</button></div></div><div class="card"><div class="card-body"><div style="font-size:12px;font-weight:800;margin-bottom:10px">Add Shift</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px"><div class="form-group" style="margin:0"><label class="form-label">Exam</label><select id="ps2-ex" class="form-control" onchange="_ps2ExCh()">${AD.exams.map(e=>`<option value="${e.id}">${e.display_name}</option>`).join('')}</select></div><div class="form-group" style="margin:0"><label class="form-label">Year</label><select id="ps2-yr" class="form-control"></select></div><div class="form-group" style="margin:0"><label class="form-label">Shift Label</label><input id="ps2-lbl" class="form-control" placeholder="e.g. Jan 26 Shift 1"></div></div><button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="_psAddShift()">Add Shift</button></div></div></div>`;setTimeout(_ps2ExCh,50);}
window._psAddYear=async function(){const eid=document.getElementById('ps-ex').value,yr=document.getElementById('ps-yr').value;if(!eid||!yr){toast('Fill all','warn');return;}const fd=new FormData();fd.append('exam_id',eid);fd.append('year',yr);try{await _uploadFetch('/api/admin/years',fd);toast(`Year ${yr} added`,'ok');document.getElementById('ps-yr').value='';await _adLoad();_adPyq(document.getElementById('admin-body'));}catch(e){toast(e.message,'err');}};
window._ps2ExCh=function(){const e=AD.exams.find(e=>e.id==document.getElementById('ps2-ex')?.value);const s=document.getElementById('ps2-yr');if(!s)return;s.innerHTML=(e?.years||[]).sort((a,b)=>b.year-a.year).map(y=>`<option value="${y.id}">${y.year}</option>`).join('');};
window._psAddShift=async function(){const yid=document.getElementById('ps2-yr').value,lbl=document.getElementById('ps2-lbl').value.trim();if(!yid||!lbl){toast('Fill all','warn');return;}const fd=new FormData();fd.append('year_id',yid);fd.append('label',lbl);try{await _uploadFetch('/api/admin/shifts',fd);toast('Shift added','ok');document.getElementById('ps2-lbl').value='';await _adLoad();_adPyq(document.getElementById('admin-body'));}catch(e){toast(e.message,'err');}};

function _adMedia(el){el.innerHTML=`<div style="display:flex;flex-direction:column;gap:12px"><div class="card"><div class="card-body"><div style="font-size:12px;font-weight:800;margin-bottom:4px">Upload Image</div><div style="font-size:11px;color:var(--c-text4);margin-bottom:10px">Path copied to clipboard after upload.</div><input id="mdi-f" type="file" accept="image/*" class="form-control" style="margin-bottom:8px"><button class="btn btn-primary btn-sm" onclick="_mdiUp()">Upload Image</button><div id="mdi-r" style="display:none;margin-top:8px;font-size:11px;font-weight:600;padding:8px;background:var(--c-green-l);color:var(--c-green);border-radius:var(--radius-sm);word-break:break-all"></div></div></div><div class="card"><div class="card-body"><div style="font-size:12px;font-weight:800;margin-bottom:4px">Upload PDF</div><input id="mdp-f" type="file" accept="application/pdf" class="form-control" style="margin-bottom:8px"><button class="btn btn-primary btn-sm" onclick="_mdpUp()">Upload PDF</button><div id="mdp-r" style="display:none;margin-top:8px;font-size:11px;font-weight:600;padding:8px;background:var(--c-green-l);color:var(--c-green);border-radius:var(--radius-sm);word-break:break-all"></div></div></div></div>`;}
window._mdiUp=async function(){const f=document.getElementById('mdi-f')?.files[0];if(!f){toast('Select an image','warn');return;}const btn=event?.target;if(btn){btn.disabled=true;btn.textContent='Uploading…';}try{const fd=new FormData();fd.append('file',f);const r=await _uploadFetch('/api/admin/upload/image',fd);const el=document.getElementById('mdi-r');if(el){el.textContent='✓ Path: '+r.path;el.style.display='block';}navigator.clipboard?.writeText(r.path).catch(()=>{});toast('Uploaded! Path copied.','ok');}catch(e){toast('Failed: '+e.message,'err');}finally{if(btn){btn.disabled=false;btn.textContent='Upload Image';}}};
window._mdpUp=async function(){const f=document.getElementById('mdp-f')?.files[0];if(!f){toast('Select a PDF','warn');return;}const btn=event?.target;if(btn){btn.disabled=true;btn.textContent='Uploading…';}try{const fd=new FormData();fd.append('file',f);const r=await _uploadFetch('/api/admin/upload/pdf',fd);const el=document.getElementById('mdp-r');if(el){el.textContent='✓ Path: '+r.path;el.style.display='block';}navigator.clipboard?.writeText(r.path).catch(()=>{});toast('PDF uploaded!','ok');}catch(e){toast('Failed: '+e.message,'err');}finally{if(btn){btn.disabled=false;btn.textContent='Upload PDF';}}};

function _adNews(el){el.innerHTML=`<div class="card"><div class="card-body"><div style="font-size:12px;font-weight:800;margin-bottom:12px">Post News</div><div class="form-group"><label class="form-label">Headline</label><input id="an-t" class="form-control" placeholder="e.g. JEE Main 2026 Answer Key Released"></div><div class="form-group"><label class="form-label">Category</label><select id="an-c" class="form-control"><option value="">General</option><option value="JEE_MAIN">JEE Main</option><option value="JEE_ADVANCED">JEE Advanced</option><option value="NEET">NEET</option></select></div><div class="form-group"><label class="form-label">Body</label><textarea id="an-b" class="form-control" rows="5"></textarea></div><button class="btn btn-primary btn-sm" onclick="_anPost()">Publish</button></div></div>`;}
window._anPost=async function(){const t=document.getElementById('an-t').value.trim();if(!t){toast('Headline required','warn');return;}try{await POST('/api/news/',{title:t,body:document.getElementById('an-b').value||null,exam_type:document.getElementById('an-c').value||null});toast('Published','ok');document.getElementById('an-t').value='';document.getElementById('an-b').value='';}catch(e){toast(e.message,'err');}};

function _adStats(el){const s=AD.stats||{};el.innerHTML=`<div class="stat-grid">${[['Users',s.total_users||0,'var(--c-blue)'],['Premium',s.active_premium||0,'var(--c-green)'],['Attempts',s.total_attempts||0,'var(--c-purple)'],['Questions',s.total_questions||0,'var(--c-amber)']].map(([l,v,c])=>`<div class="stat-card"><div class="stat-val" style="color:${c}">${v}</div><div class="stat-lbl">${l}</div></div>`).join('')}</div>`;}

async function _adUsers(el){
  el.innerHTML='<div class="loading-center"><div class="spinner"></div></div>';
  try{const[ov,da]=await Promise.all([GET('/api/leaderboard/overall?limit=20'),GET('/api/leaderboard/daily?limit=20')]);
  el.innerHTML=`<div style="display:flex;flex-direction:column;gap:14px"><div class="card" style="overflow:hidden"><div style="padding:10px 14px;background:var(--c-surface2);border-bottom:1px solid var(--c-border);font-size:12px;font-weight:800">Top Users</div><div style="overflow-x:auto"><table class="data-table"><thead><tr><th>#</th><th>User</th><th>Tests</th><th>Qs</th><th>Streak</th><th>Acc%</th></tr></thead><tbody>${ov.map(r=>`<tr><td style="font-weight:800">${r.rank}</td><td><div style="font-size:12px;font-weight:600">${r.full_name||'—'}</div><div style="font-size:10px;color:var(--c-text4)">${r.email}</div></td><td>${r.total_tests}</td><td>${r.total_questions}</td><td style="color:var(--c-amber);font-weight:700">${r.streak_days}d</td><td>${r.accuracy.toFixed(1)}%</td></tr>`).join('')}</tbody></table></div></div><div class="card" style="overflow:hidden"><div style="padding:10px 14px;background:var(--c-surface2);border-bottom:1px solid var(--c-border);font-size:12px;font-weight:800">Today</div><div style="overflow-x:auto"><table class="data-table"><thead><tr><th>#</th><th>User</th><th>Qs</th><th>Score</th></tr></thead><tbody>${da.map(r=>`<tr><td style="font-weight:800">${r.rank}</td><td><div style="font-size:12px;font-weight:600">${r.full_name||'—'}</div><div style="font-size:10px;color:var(--c-text4)">${r.email}</div></td><td style="font-weight:800;color:var(--c-blue)">${r.daily_questions_solved}</td><td>${r.daily_score.toFixed(1)}</td></tr>`).join('')}</tbody></table></div></div></div>`;}
  catch(e){el.innerHTML=`<div class="empty-state"><div class="empty-sub">${e.message}</div></div>`;}
}