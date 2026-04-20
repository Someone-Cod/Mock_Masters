import { sb } from './supabase.js'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

// workerSrc set above via vite import


const COLORS={Physics:'#2563EB',Chemistry:'#059669',Mathematics:'#7C3AED',Biology:'#D97706',General:'#64748B'}

let S={
  paperId:null,paper:null,pattern:null,answerKey:null,
  attemptId:null,user:null,
  answers:{},review:{},
  cur:1,total:0,
  isTwoPart:false,currentPart:1,part1Locked:false,
  activeSections:[],subsMap:{},
  pdfDoc:null,curPage:1,totalPages:0,scale:1.3,hideAfter:0,
  secs:0,interval:null
}

;(async()=>{
  const params=new URLSearchParams(window.location.search)
  S.paperId=params.get('paper')
  if(!S.paperId){showPdfMsg('No paper selected. Please go back and select a paper.');return}

  const {data:{session}}=await sb.auth.getSession()
  if(!session){window.location.href='/';return}
  S.user=session.user

  const {data:paper}=await sb.from('papers').select('*, exam_patterns(*)').eq('id',S.paperId).single()
  if(!paper){showPdfMsg('Paper not found.');return}
  S.paper=paper
  S.hideAfter=paper.hide_last_pages||0

  const {data:key}=await sb.from('answer_keys').select('*').eq('paper_id',S.paperId).single()
  S.answerKey=key

  // Auto-detect pattern
  let pattern=paper.exam_patterns
  if(!pattern){
    const {data:patterns}=await sb.from('exam_patterns').select('*')
    const t=paper.title.toLowerCase()
    if(t.includes('advanced')) pattern=patterns.find(p=>p.exam_name==='JEE Advanced')
    else if(paper.exam_type==='JEE') pattern=patterns.find(p=>p.exam_name==='JEE Main')
    else if(paper.exam_type==='MHT-CET'&&(t.includes('pcb')||t.includes('bio')))
      pattern=patterns.find(p=>p.exam_name==='MHT-CET PCB')
    else if(paper.exam_type==='MHT-CET') pattern=patterns.find(p=>p.exam_name==='MHT-CET PCM')
    else pattern=patterns[0]
  }
  S.pattern=pattern
  S.isTwoPart=pattern.pattern.two_part===true
  S.total=pattern.total_questions
  S.secs=(paper.duration_minutes||pattern.duration_minutes)*60

  // For two-part: start with part 1 duration only
  if(S.isTwoPart) S.secs=pattern.pattern.parts[0].duration_minutes*60

  // Set active sections for current part
  setActiveSections()

  // UI setup
  document.title=paper.title+' — MockMasters'
  document.getElementById('exam-title').textContent=paper.title
  document.getElementById('exam-meta').textContent=`${pattern.exam_name} · ${paper.year||''} · ${S.total} Qs · ${pattern.total_marks} Marks`
  document.getElementById('exam-badge').textContent=pattern.exam_name
  if(S.isTwoPart){
    document.getElementById('part-badge').style.display='block'
    document.getElementById('part-badge').textContent='Part 1'
    document.getElementById('end-early-btn').style.display='none' // hidden for two-part
  } else {
    document.getElementById('end-early-btn').style.display='block'
  }
  if(S.hideAfter>0) document.getElementById('hide-notice').textContent='⚠ Answer key pages hidden'

  // Start attempt
  const {data:att}=await sb.from('pdf_attempts').insert({
    user_id:S.user.id,paper_id:S.paperId,answers:{},total_questions:S.total
  }).select().single()
  S.attemptId=att?.id

  buildPalette()
  buildPatternInfo()
  goToQ(1)
  updateStats()
  updateTimerDisplay()
  S.interval=setInterval(tick,1000)

  if(paper.file_url) loadPDF(paper.file_url)
  else showPdfMsg('PDF not uploaded yet. Use the answer panel to record your responses.')
})()

function setActiveSections(){
  S.activeSections=[]
  S.subsMap={}
  const p=S.pattern.pattern
  let sections
  if(S.isTwoPart) sections=p.parts[S.currentPart-1].sections
  else sections=p.sections
  S.activeSections=sections
  sections.forEach(sect=>{
    sect.subsections.forEach(sub=>{
      for(let q=sub.q_start;q<=sub.q_end;q++){
        S.subsMap[q]={
          type:sub.type,subject:sect.subject,
          marksCorrect:sub.marks_correct,marksWrong:sub.marks_wrong||0,
          attemptAny:sub.attempt_any||null,description:sub.description,
          sectionName:sect.name,subsectionName:sub.name
        }
      }
    })
  })
}

function getQInfo(q){return S.subsMap[q]||{type:'MCQ',subject:'General',marksCorrect:2,marksWrong:0,description:'Single correct answer',sectionName:'General',subsectionName:'General'}}
function isActiveQ(q){return !!S.subsMap[q]}

// ── PDF ────────────────────────────────────────────────────────────────────
async function loadPDF(url){
  try{
    S.pdfDoc=await pdfjsLib.getDocument(url).promise
    S.totalPages=S.pdfDoc.numPages
    const maxPg=S.hideAfter>0?S.totalPages-S.hideAfter:S.totalPages
    document.getElementById('pg-total').textContent=S.hideAfter>0?`${maxPg}*`:maxPg
    document.getElementById('pdf-msg').style.display='none'
    document.getElementById('pdf-canvas').style.display='block'
    renderPage(1)
  }catch(e){showPdfMsg('Failed to load PDF: '+e.message)}
}
async function renderPage(n){
  if(!S.pdfDoc) return
  const max=S.hideAfter>0?S.totalPages-S.hideAfter:S.totalPages
  if(n<1||n>max) return
  S.curPage=n
  document.getElementById('pg-num').textContent=n
  const page=await S.pdfDoc.getPage(n)
  const canvas=document.getElementById('pdf-canvas')
  const vp=page.getViewport({scale:S.scale})
  canvas.width=vp.width;canvas.height=vp.height
  await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise
}
function prevPage(){renderPage(S.curPage-1)}
function nextPage(){renderPage(S.curPage+1)}
function zoomIn(){S.scale=Math.min(S.scale+0.2,3.5);document.getElementById('zoom-lbl').textContent=Math.round(S.scale*100)+'%';renderPage(S.curPage)}
function zoomOut(){S.scale=Math.max(S.scale-0.2,0.5);document.getElementById('zoom-lbl').textContent=Math.round(S.scale*100)+'%';renderPage(S.curPage)}
function fitPage(){S.scale=1.3;document.getElementById('zoom-lbl').textContent='130%';renderPage(S.curPage)}
function toggleFullscreen(){if(!document.fullscreenElement)document.documentElement.requestFullscreen();else document.exitFullscreen()}
function showPdfMsg(t){document.getElementById('pdf-msg').innerHTML=`<div style="font-size:32px;margin-bottom:12px">📄</div><div style="font-weight:600;margin-bottom:6px">Paper Unavailable</div><div style="font-size:12px">${t}</div>`}

// ── TIMER ──────────────────────────────────────────────────────────────────
function tick(){
  S.secs--
  if(S.secs<=0){
    clearInterval(S.interval)
    if(S.isTwoPart&&S.currentPart===1) triggerPartTransition()
    else submitTest()
    return
  }
  updateTimerDisplay()
}
function updateTimerDisplay(){
  const h=Math.floor(S.secs/3600),m=Math.floor((S.secs%3600)/60),s=S.secs%60
  const el=document.getElementById('timer')
  el.textContent=pad(h)+':'+pad(m)+':'+pad(s)
  el.className='timer'+(S.secs<300?' urgent':'')
}
function pad(n){return n<10?'0'+n:''+n}

// ── TWO-PART TRANSITION ────────────────────────────────────────────────────
function triggerPartTransition(){
  // Lock part 1 answers
  S.part1Locked=true
  autoSave()

  // Count part 1 stats
  const p1sections=S.pattern.pattern.parts[0].sections
  let p1total=0,p1ans=0
  p1sections.forEach(sect=>sect.subsections.forEach(sub=>{
    for(let q=sub.q_start;q<=sub.q_end;q++){
      p1total++
      if(hasAnswer(q))p1ans++
    }
  }))
  const p1skip=p1total-p1ans

  const partName=S.pattern.pattern.parts[1].name
  document.getElementById('pt-title').textContent='Part 1 Complete!'
  document.getElementById('pt-sub').textContent=`${S.pattern.pattern.parts[0].name} has ended. Your answers are saved and locked. ${partName} begins next.`
  document.getElementById('pt-stats').innerHTML=`
    <div class="pt-stat"><div class="pt-val" style="color:var(--green)">${p1ans}</div><div class="pt-lbl">Answered</div></div>
    <div class="pt-stat"><div class="pt-val" style="color:var(--muted)">${p1skip}</div><div class="pt-lbl">Skipped</div></div>
    <div class="pt-stat"><div class="pt-val">${p1total}</div><div class="pt-lbl">Total Qs</div></div>`

  document.getElementById('part-transition').style.display='flex'

  // Countdown to auto-start part 2
  let cd=10
  const cdEl=document.getElementById('pt-countdown')
  const cdInt=setInterval(()=>{
    cd--
    cdEl.textContent=cd
    if(cd<=0){clearInterval(cdInt);startPart2()}
  },1000)
}

function startPart2(){
  document.getElementById('part-transition').style.display='none'
  S.currentPart=2
  setActiveSections()
  S.secs=S.pattern.pattern.parts[1].duration_minutes*60
  document.getElementById('part-badge').textContent='Part 2'
  buildPalette()
  buildPatternInfo()
  // Jump to first question of part 2
  const firstQ=S.pattern.pattern.parts[1].sections[0].subsections[0].q_start
  goToQ(firstQ)
  updateStats()
  S.interval=setInterval(tick,1000)
}

// ── PALETTE ────────────────────────────────────────────────────────────────
function buildPalette(){
  const wrap=document.getElementById('palette-wrap')
  let html=''
  const allSections=S.isTwoPart?S.pattern.pattern.parts.flatMap(p=>p.sections):S.pattern.pattern.sections
  allSections.forEach(sect=>{
    html+=`<div class="sect-lbl">${sect.name}</div>`
    sect.subsections.forEach(sub=>{
      const tc={'MCQ':'tp-mcq','MCQ_SINGLE':'tp-mcq','NUMERICAL':'tp-num','MCQ_MULTI':'tp-multi','INTEGER':'tp-int'}[sub.type]||'tp-mcq'
      html+=`<div class="subsect-lbl">${sub.name}<span class="tpill ${tc}">${sub.type}</span>`
      if(sub.attempt_any)html+=`<span style="font-size:9px;color:var(--amber)">Any ${sub.attempt_any}</span>`
      html+=`</div><div class="q-grid">`
      for(let q=sub.q_start;q<=sub.q_end;q++){
        const locked=S.isTwoPart&&S.currentPart===2&&isLockedPart1Q(q)
        html+=`<div class="qb${locked?' locked':''}" id="qb-${q}" onclick="${locked?'':' goToQ('+q+')'}">${q}</div>`
      }
      html+=`</div>`
    })
  })
  wrap.innerHTML=html
  updatePalette()
}

function isLockedPart1Q(q){
  const p1sects=S.pattern.pattern.parts[0].sections
  for(const sect of p1sects)
    for(const sub of sect.subsections)
      if(q>=sub.q_start&&q<=sub.q_end) return true
  return false
}

function updatePalette(){
  const allSections=S.isTwoPart?S.pattern.pattern.parts.flatMap(p=>p.sections):S.pattern.pattern.sections
  allSections.forEach(sect=>sect.subsections.forEach(sub=>{
    for(let q=sub.q_start;q<=sub.q_end;q++){
      const el=document.getElementById('qb-'+q);if(!el)return
      const ans=hasAnswer(q),rev=S.review[q]
      let cls='qb'
      if(S.isTwoPart&&S.currentPart===2&&isLockedPart1Q(q)) cls+=' locked'
      else cls+=(q===S.cur?' current':'')+(ans&&rev?' answered-review':ans?' answered':rev?' review':'')
      el.className=cls
    }
  }))
}

function hasAnswer(q){const a=S.answers[q];if(!a)return false;if(Array.isArray(a))return a.length>0;return a!==''&&a!==null&&a!==undefined}

// ── NAVIGATION ─────────────────────────────────────────────────────────────
function goToQ(n){
  if(n<1||n>S.total)return
  if(S.isTwoPart&&S.currentPart===2&&isLockedPart1Q(n))return
  S.cur=n
  const info=getQInfo(n)
  document.getElementById('q-bignum').textContent='Q'+n
  document.getElementById('q-subj-lbl').textContent=`${info.subject} · ${info.subsectionName}`
  document.getElementById('q-desc').textContent=info.description

  ;['mcq','multi','numerical','integer'].forEach(t=>document.getElementById('input-'+t).style.display='none')

  if(info.type==='MCQ'||info.type==='MCQ_SINGLE'){
    document.getElementById('input-mcq').style.display='block'
    const ans=S.answers[n]||null
    ;['A','B','C','D'].forEach(l=>{document.getElementById('opt-'+l).className='opt-btn'+(ans===l?' sel':'')})
  } else if(info.type==='MCQ_MULTI'){
    document.getElementById('input-multi').style.display='block'
    const sel=S.answers[n]||[]
    ;['A','B','C','D'].forEach(l=>{document.getElementById('mopt-'+l).className='opt-btn'+(sel.includes(l)?' sel-multi':'')})
  } else if(info.type==='NUMERICAL'){
    document.getElementById('input-numerical').style.display='block'
    document.getElementById('num-val').value=S.answers[n]||''
  } else if(info.type==='INTEGER'){
    document.getElementById('input-integer').style.display='block'
    document.getElementById('int-val').value=S.answers[n]||''
  }

  const mb=document.getElementById('mark-btn')
  mb.className='mark-btn'+(S.review[n]?' marked':'')
  mb.textContent=S.review[n]?'⚑ Marked for Review':'⚑ Mark for Review'
  updatePalette()
  switchTab('answer',document.querySelectorAll('.ptab')[1])
}

function prevQ(){goToQ(S.cur-1)}
function nextQ(){goToQ(S.cur+1)}
function jumpToQ(n){if(n>=1&&n<=S.total)goToQ(n)}

// ── INPUTS ─────────────────────────────────────────────────────────────────
function selectMCQ(l){
  S.answers[S.cur]=l
  ;['A','B','C','D'].forEach(x=>{document.getElementById('opt-'+x).className='opt-btn'+(x===l?' sel':'')})
  updatePalette();updateStats();autoSave()
}
function toggleMulti(l){
  if(!Array.isArray(S.answers[S.cur]))S.answers[S.cur]=[]
  const i=S.answers[S.cur].indexOf(l)
  if(i>=0)S.answers[S.cur].splice(i,1);else S.answers[S.cur].push(l)
  ;['A','B','C','D'].forEach(x=>{document.getElementById('mopt-'+x).className='opt-btn'+(S.answers[S.cur].includes(x)?' sel-multi':'')})
  updatePalette();updateStats();autoSave()
}
function saveNumerical(v){S.answers[S.cur]=v;updatePalette();updateStats();autoSave()}
function kpad(k){
  let c=document.getElementById('int-val').value||''
  if(k==='DEL')c=c.slice(0,-1)
  else if(k==='CLR')c=''
  else if(c.length<6)c+=k
  document.getElementById('int-val').value=c
  S.answers[S.cur]=c;updatePalette();updateStats();autoSave()
}
function toggleReview(){
  if(S.review[S.cur])delete S.review[S.cur];else S.review[S.cur]=true
  const mb=document.getElementById('mark-btn')
  mb.className='mark-btn'+(S.review[S.cur]?' marked':'')
  mb.textContent=S.review[S.cur]?'⚑ Marked for Review':'⚑ Mark for Review'
  updatePalette()
}
function clearAnswer(){delete S.answers[S.cur];delete S.review[S.cur];goToQ(S.cur);updateStats()}

// ── STATS ──────────────────────────────────────────────────────────────────
function updateStats(){
  const activeSects=S.isTwoPart?S.pattern.pattern.parts[S.currentPart-1].sections:S.pattern.pattern.sections
  let totalActive=0,ansActive=0,revActive=0
  activeSects.forEach(sect=>sect.subsections.forEach(sub=>{
    for(let q=sub.q_start;q<=sub.q_end;q++){
      totalActive++
      if(hasAnswer(q))ansActive++
      if(S.review[q])revActive++
    }
  }))
  document.getElementById('s-ans').textContent=ansActive
  document.getElementById('s-rev').textContent=revActive
  document.getElementById('s-skip').textContent=totalActive-ansActive
  document.getElementById('s-tot').textContent=totalActive

  let progHtml=''
  activeSects.forEach(sect=>{
    let tot=0,done=0
    sect.subsections.forEach(sub=>{for(let q=sub.q_start;q<=sub.q_end;q++){tot++;if(hasAnswer(q))done++}})
    const pct=tot>0?Math.round(done/tot*100):0
    const col=COLORS[sect.subject]||'#64748B'
    progHtml+=`<div class="sp-wrap"><div class="sp-lbl"><span>${sect.name}</span><span style="color:${col};font-weight:700">${done}/${tot}</span></div><div class="sp-track"><div class="sp-fill" style="width:${pct}%;background:${col}"></div></div></div>`
  })
  document.getElementById('sect-prog').innerHTML=progHtml
}

function buildPatternInfo(){
  const allSects=S.isTwoPart?S.pattern.pattern.parts.flatMap((p,i)=>{
    const label=`<div style="color:var(--accent);font-weight:700;margin-top:6px">${p.name} · ${p.duration_minutes} min</div>`
    return [{_label:label},...p.sections]
  }):S.pattern.pattern.sections
  let html=''
  allSects.forEach(sect=>{
    if(sect._label){html+=sect._label;return}
    html+=`<div style="color:var(--text);font-weight:600;margin-top:4px">${sect.name}</div>`
    sect.subsections.forEach(sub=>{
      html+=`<div>• Q${sub.q_start}–${sub.q_end} (${sub.type}) +${sub.marks_correct}${sub.marks_wrong<0?' '+sub.marks_wrong:' no −ve'}`
      if(sub.attempt_any)html+=` Any ${sub.attempt_any}`
      html+=`</div>`
    })
  })
  document.getElementById('pattern-info').innerHTML=html
}

// ── AUTOSAVE ───────────────────────────────────────────────────────────────
let saveTO
function autoSave(){
  clearTimeout(saveTO)
  saveTO=setTimeout(async()=>{
    if(!S.attemptId)return
    await sb.from('pdf_attempts').update({answers:S.answers,marked_for_review:S.review}).eq('id',S.attemptId)
  },2000)
}

// ── END EARLY (for non-two-part exams only) ────────────────────────────────
function confirmEndEarly(){
  const ans=Object.keys(S.answers).filter(k=>hasAnswer(+k)).length
  const left=S.total-ans
  if(!confirm(`You have ${left} unanswered questions.\n\nAre you sure you want to end the test early? This cannot be undone.`))return
  submitTest()
}

// ── SUBMIT ─────────────────────────────────────────────────────────────────
async function submitTest(){
  clearInterval(S.interval)
  const partDuration=S.isTwoPart
    ?(S.pattern.pattern.parts[0].duration_minutes+S.pattern.pattern.parts[1].duration_minutes)*60
    :(S.paper.duration_minutes||S.pattern.duration_minutes)*60
  const timeTaken=partDuration-S.secs

  const hasKey=S.answerKey&&Object.keys(S.answerKey.answers||{}).length>0
  const keyAns=S.answerKey?.answers||{}
  let correct=0,wrong=0,skipped=0,score=0
  const subjAna={}

  const allSects=S.isTwoPart?S.pattern.pattern.parts.flatMap(p=>p.sections):S.pattern.pattern.sections
  allSects.forEach(sect=>{
    const subj=sect.subject
    if(!subjAna[subj])subjAna[subj]={correct:0,wrong:0,skipped:0,total:0,score:0}
    sect.subsections.forEach(sub=>{
      for(let q=sub.q_start;q<=sub.q_end;q++){
        subjAna[subj].total++
        const ua=S.answers[q],ca=keyAns[String(q)]
        if(!hasAnswer(q)){skipped++;subjAna[subj].skipped++;continue}
        if(!hasKey)continue
        if(sub.type==='MCQ'||sub.type==='MCQ_SINGLE'||sub.type==='NUMERICAL'||sub.type==='INTEGER'){
          if(String(ua)===String(ca)){correct++;score+=sub.marks_correct;subjAna[subj].correct++;subjAna[subj].score+=sub.marks_correct}
          else{wrong++;score+=sub.marks_wrong;subjAna[subj].wrong++;subjAna[subj].score+=sub.marks_wrong}
        } else if(sub.type==='MCQ_MULTI'){
          const us=Array.isArray(ua)?[...ua]:[];const cs=Array.isArray(ca)?ca:(ca||'').split(',').map(x=>x.trim())
          const allRight=cs.every(c=>us.includes(c))&&us.every(u=>cs.includes(u))
          const anyWrong=us.some(u=>!cs.includes(u))
          if(allRight){correct++;score+=sub.marks_correct;subjAna[subj].correct++}
          else if(anyWrong){wrong++;score+=sub.marks_wrong;subjAna[subj].wrong++}
          else{score+=1;subjAna[subj].score+=1}
        }
      }
    })
  })

  const accuracy=hasKey&&S.total>0?Math.round((correct/S.total)*100):0
  if(S.attemptId){
    await sb.from('pdf_attempts').update({
      answers:S.answers,marked_for_review:S.review,
      score,total_marks:S.pattern.total_marks,
      correct_count:correct,wrong_count:wrong,skipped_count:skipped,
      total_questions:S.total,accuracy,subject_analysis:subjAna,
      time_taken_seconds:timeTaken,completed:true,completed_at:new Date().toISOString()
    }).eq('id',S.attemptId)
  }
  showResult({correct,wrong,skipped,score,accuracy,subjAna,hasKey,timeTaken})
}

// ── RESULT ─────────────────────────────────────────────────────────────────
function showResult({correct,wrong,skipped,score,accuracy,subjAna,hasKey,timeTaken}){
  document.getElementById('result-screen').style.display='block'
  document.getElementById('exam-main').style.display='none'
  document.getElementById('res-sub').textContent=S.paper.title+' · '+S.pattern.exam_name

  const mins=Math.floor(timeTaken/60),secs=timeTaken%60
  let html=''

  if(hasKey){
    html+=`<div class="res-hero">
      <div class="res-pct">${accuracy}%</div>
      <div style="color:var(--muted);font-size:14px;margin-top:4px">${score} / ${S.pattern.total_marks} marks</div>
      <div class="res-grid">
        <div class="res-item"><div class="res-val" style="color:var(--green)">${correct}</div><div class="res-lbl">Correct</div></div>
        <div class="res-item"><div class="res-val" style="color:var(--red)">${wrong}</div><div class="res-lbl">Wrong</div></div>
        <div class="res-item"><div class="res-val" style="color:var(--muted)">${skipped}</div><div class="res-lbl">Skipped</div></div>
        <div class="res-item"><div class="res-val" style="color:var(--amber)">${mins}m ${secs}s</div><div class="res-lbl">Time</div></div>
      </div>
    </div>`
    html+=`<div class="subj-grid">${Object.entries(subjAna).map(([subj,d])=>{
      const col=COLORS[subj]||'#64748B'
      const pct=d.total>0?Math.round(d.correct/d.total*100):0
      return`<div class="subj-card">
        <div class="sc-name">${subj}</div>
        <div><div class="sc-bar-lbl"><span>Accuracy</span><span style="color:${col};font-weight:700">${pct}%</span></div>
        <div class="sc-bar-track"><div class="sc-bar-fill" style="width:${pct}%;background:${col}"></div></div></div>
        <div class="sc-stats"><span style="color:var(--green)">✓ ${d.correct}</span><span style="color:var(--red)">✗ ${d.wrong}</span><span>— ${d.skipped}</span><span style="margin-left:auto;color:${col};font-weight:700">${d.score} pts</span></div>
      </div>`}).join('')}</div>`
  } else {
    html+=`<div class="no-key-card">
      <div style="font-size:40px;margin-bottom:10px">📝</div>
      <div style="font-size:17px;font-weight:700;margin-bottom:6px">Attempt Saved!</div>
      <div style="font-size:13px;color:#93C5FD;line-height:1.6">No answer key added yet for this paper.<br>Your responses are saved. Analysis will appear once the admin adds the answer key.</div>
      <div class="res-grid" style="margin-top:14px">
        <div class="res-item"><div class="res-val">${Object.keys(S.answers).filter(k=>hasAnswer(+k)).length}</div><div class="res-lbl">Answered</div></div>
        <div class="res-item"><div class="res-val" style="color:var(--muted)">${skipped}</div><div class="res-lbl">Skipped</div></div>
        <div class="res-item"><div class="res-val" style="color:var(--amber)">${mins}m ${secs}s</div><div class="res-lbl">Time Taken</div></div>
        <div class="res-item"><div class="res-val">${S.total}</div><div class="res-lbl">Total Qs</div></div>
      </div>
    </div>`
  }
  document.getElementById('res-body').innerHTML=html
}

// ── REVIEW ─────────────────────────────────────────────────────────────────
function showReview(){
  const hasKey=S.answerKey&&Object.keys(S.answerKey.answers||{}).length>0
  const keyAns=S.answerKey?.answers||{}
  let html=''
  const allSects=S.isTwoPart?S.pattern.pattern.parts.flatMap(p=>p.sections):S.pattern.pattern.sections
  allSects.forEach(sect=>{
    html+=`<div style="font-size:12px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px;padding:8px 0 4px;border-bottom:1px solid var(--border);margin-bottom:8px">${sect.name}</div>`
    sect.subsections.forEach(sub=>{
      for(let q=sub.q_start;q<=sub.q_end;q++){
        const ua=S.answers[q],ca=keyAns[String(q)]
        let cls='rs',lbl='Not attempted'
        if(hasAnswer(q)){
          if(!hasKey){cls='rp';lbl=`Answered: ${Array.isArray(ua)?ua.join(','):ua}`}
          else{
            const us=Array.isArray(ua)?ua.sort().join(','):String(ua||'')
            const cs=Array.isArray(ca)?ca.sort().join(','):String(ca||'')
            if(us===cs){cls='rc';lbl=`Correct (${us})`}
            else{cls='rw';lbl=`Wrong — You: ${us}, Correct: ${cs}`}
          }
        }
        html+=`<div class="rev-q"><div class="rev-num ${cls}">Q${q}</div><div style="flex:1;font-size:12px"><span style="font-weight:600">Q${q}</span> · ${sect.subject} · ${sub.type}<div style="color:var(--muted);margin-top:2px">${lbl}</div></div></div>`
      }
    })
  })
  document.getElementById('rev-list').innerHTML=html
  document.getElementById('review-overlay').style.display='block'
}

function goBack(){window.location.href='/'}

function switchTab(id,el){
  document.querySelectorAll('.ptab').forEach(t=>t.classList.remove('active'))
  document.querySelectorAll('.tab-body').forEach(t=>t.classList.remove('active'))
  if(el)el.classList.add('active')
  document.getElementById('tab-'+id).classList.add('active')
}

// ── EXPOSE TO WINDOW (required for onclick= in HTML with ES modules) ──────
Object.assign(window,{
  prevPage,nextPage,zoomIn,zoomOut,fitPage,toggleFullscreen,
  prevQ,nextQ,jumpToQ,goToQ,
  selectMCQ,toggleMulti,saveNumerical,kpad,
  toggleReview,clearAnswer,
  startPart2,confirmEndEarly,
  showReview,goBack,switchTab,
})