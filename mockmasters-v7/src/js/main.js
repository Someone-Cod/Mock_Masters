import { sb } from './supabase.js'
import Chart from 'chart.js/auto'

// ── STATE ──────────────────────────────────────────────────────────────────
let currentUser=null, currentProfile=null, isGuest=false
let practiceFilters={exam:'all',subj:'all',diff:'all'}
let allPapers=[]
let charts={}
let reviewModeOn=false
// FIX: store question data globally for review
let testQuestions=[]

let tS={
  examId:null,examName:'',examType:'',
  questions:[],current:0,
  answers:{},skipped:{},
  secs:0,interval:null,attemptId:null,startTime:null
}

// ── THEME ──────────────────────────────────────────────────────────────────
function applyTheme(t){
  document.documentElement.setAttribute('data-theme',t)
  document.getElementById('theme-btn').textContent=t==='dark'?'☀️':'🌙'
}
async function toggleTheme(){
  const c=document.documentElement.getAttribute('data-theme')||'light'
  const n=c==='dark'?'light':'dark'
  applyTheme(n)
  if(currentUser&&!isGuest) await sb.from('profiles').update({theme:n}).eq('id',currentUser.id)
}

// ── LOADER ─────────────────────────────────────────────────────────────────
function showLoader(msg='Signing you in...'){
  document.getElementById('fl-msg').textContent=msg
  document.getElementById('full-loader').classList.add('active')
}
function hideLoader(){
  document.getElementById('full-loader').classList.remove('active')
}

// ── AUTH ───────────────────────────────────────────────────────────────────
function switchAuthTab(tab,el){
  document.querySelectorAll('.auth-tab').forEach(t=>t.classList.remove('active'))
  el.classList.add('active')
  document.getElementById('login-form').style.display=tab==='login'?'block':'none'
  document.getElementById('signup-form').style.display=tab==='signup'?'block':'none'
  clearMsg()
}

function showMsg(msg,type='error'){
  const el=document.getElementById('auth-msg')
  el.className='auth-msg auth-'+(type==='error'?'error':'success')
  el.textContent=msg
  el.style.display='block'
}
function clearMsg(){document.getElementById('auth-msg').style.display='none'}

function setBtnLoading(id,loading,text){
  const btn=document.getElementById(id)
  btn.disabled=loading
  btn.classList.toggle('loading',loading)
  if(!loading) btn.querySelector('.btn-text').textContent=text
}

async function handleLogin(){
  const email=document.getElementById('login-email').value.trim()
  const pass=document.getElementById('login-password').value
  if(!email||!pass){showMsg('Please enter your email and password.');return}
  setBtnLoading('login-btn',true,'Sign In')
  clearMsg()
  const {error}=await sb.auth.signInWithPassword({email,password:pass})
  if(error){showMsg(error.message);setBtnLoading('login-btn',false,'Sign In')}
  // on success, onAuthStateChange fires and calls showApp()
}

async function handleSignup(){
  const name=document.getElementById('signup-name').value.trim()
  const email=document.getElementById('signup-email').value.trim()
  const pass=document.getElementById('signup-password').value
  const exam=document.getElementById('signup-exam').value
  if(!name||!email||!pass){showMsg('Please fill all fields.');return}
  if(pass.length<8){showMsg('Password must be at least 8 characters.');return}
  setBtnLoading('signup-btn',true,'Create Account')
  clearMsg()
  const {error}=await sb.auth.signUp({email,password:pass,options:{data:{name,target_exam:exam}}})
  if(error){showMsg(error.message);setBtnLoading('signup-btn',false,'Create Account')}
  else{showMsg('Account created! You can now sign in.','success');setBtnLoading('signup-btn',false,'Create Account')}
}

// ── GUEST LOGIN ────────────────────────────────────────────────────────────
async function handleGuestLogin(){
  showLoader('Setting up guest session...')
  isGuest=true
  // Use anonymous sign in (Supabase anon)
  const {data,error}=await sb.auth.signInAnonymously()
  if(error){
    // fallback: create a fake guest state without auth
    hideLoader()
    currentUser={id:'guest-'+Date.now(),email:'guest@mockmaster.app'}
    currentProfile={name:'Guest',plan:'free',theme:'light',is_guest:true,target_exam:'JEE'}
    isGuest=true
    showApp()
    return
  }
  currentUser=data.user
  currentProfile={name:'Guest',plan:'free',theme:'light',is_guest:true,target_exam:'JEE'}
  hideLoader()
  showApp()
}

async function handleLogout(){
  if(!isGuest) await sb.auth.signOut()
  currentUser=null;currentProfile=null;isGuest=false
  showAuth()
}

// ── SESSION ────────────────────────────────────────────────────────────────
sb.auth.onAuthStateChange(async(_e,session)=>{
  if(session?.user&&!isGuest){
    showLoader('Loading your profile...')
    currentUser=session.user
    await loadProfile()
    hideLoader()
    showApp()
  } else if(!session&&!isGuest){
    hideLoader()
    showAuth()
  }
})

async function loadProfile(){
  const {data}=await sb.from('profiles').select('*').eq('id',currentUser.id).single()
  currentProfile=data
  if(data?.theme)applyTheme(data.theme)
  const init=(data?.name||currentUser.email||'?')[0].toUpperCase()
  document.getElementById('user-avatar').textContent=init
}

function showAuth(){
  document.getElementById('auth-page').style.display='block'
  document.getElementById('app').style.display='none'
  document.getElementById('main-nav').style.display='none'
  isGuest=false
}
function showApp(){
  document.getElementById('auth-page').style.display='none'
  document.getElementById('app').style.display='block'
  document.getElementById('main-nav').style.display='flex'
  if(isGuest){
    document.getElementById('guest-badge').style.display='inline-block'
    document.getElementById('user-avatar').textContent='G'
    document.getElementById('logout-btn').textContent='Exit Guest'
  }
  loadDashboard()
}

// ── NAVIGATION ─────────────────────────────────────────────────────────────
function showPage(id,el){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'))
  document.querySelectorAll('.nav-link').forEach(t=>t.classList.remove('active'))
  document.getElementById(id).classList.add('active')
  if(el)el.classList.add('active')
  if(id==='practice')loadPracticeQuestions()
  if(id==='papers')loadPapers()
  if(id==='analytics')loadAnalytics()
}

// ── DASHBOARD ──────────────────────────────────────────────────────────────
async function loadDashboard(){
  const name=currentProfile?.name||(currentUser?.email?.split('@')[0])||'Student'
  const exam=currentProfile?.target_exam||'JEE'
  document.getElementById('dash-greeting').textContent=`Welcome back, ${name} 👋`
  document.getElementById('dash-subtitle').textContent=isGuest?'Guest session — explore the platform freely':(`Target: ${exam} · Let's prepare smarter today`)

  if(isGuest){
    // Guest: show zeros and sample exam cards
    document.getElementById('stat-tests').textContent='0'
    document.getElementById('stat-acc').textContent='—'
    document.getElementById('stat-qs').textContent='0'
    document.getElementById('stat-last').textContent='Now'
    document.getElementById('stat-tests-sub').textContent='Sign up to track progress'
    document.getElementById('subject-perf-bars').innerHTML='<div class="empty-state"><div class="empty-icon">📊</div>Sign up to track your subject performance</div>'
    await loadExamCards()
    document.getElementById('recent-tests').innerHTML='<div class="empty-state"><div class="empty-icon">📝</div>No history in guest mode. Sign up to save your progress!</div>'
    return
  }

  const {data:stats}=await sb.from('user_dashboard_stats').select('*').eq('user_id',currentUser.id).single()
  const s=stats||{total_attempts:0,completed_tests:0,avg_accuracy:0,total_questions_attempted:0,last_activity:null}
  document.getElementById('stat-tests').textContent=s.completed_tests||0
  document.getElementById('stat-tests-sub').textContent=`${s.total_attempts||0} total sessions`
  document.getElementById('stat-acc').textContent=s.avg_accuracy?`${s.avg_accuracy}%`:'—'
  document.getElementById('stat-qs').textContent=(s.total_questions_attempted||0).toLocaleString()
  document.getElementById('stat-last').textContent=s.last_activity?new Date(s.last_activity).toLocaleDateString('en-IN',{month:'short',day:'numeric'}):'Never'

  await loadSubjectBars()
  await loadExamCards()
  await loadRecentTests()
}

async function loadSubjectBars(){
  const {data}=await sb.from('user_subject_performance').select('*').eq('user_id',currentUser.id)
  const el=document.getElementById('subject-perf-bars')
  if(!data||data.length===0){el.innerHTML='<div class="empty-state"><div class="empty-icon">📊</div>Complete a test to see subject performance</div>';return}
  const groups={}
  data.forEach(d=>{if(!groups[d.exam_type])groups[d.exam_type]=[];groups[d.exam_type].push(d)})
  const colors={Physics:'#2563EB',Chemistry:'#059669',Mathematics:'#7C3AED',Biology:'#D97706'}
  let html=''
  for(const[exam,subjs]of Object.entries(groups)){
    html+=`<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin:10px 0 8px;padding-bottom:4px;border-bottom:1px solid var(--border)">${exam}</div>`
    subjs.forEach(s=>{
      const pct=s.avg_accuracy||0
      html+=`<div class="perf-bar-wrap"><div class="perf-bar-label"><span>${s.subject}</span><span style="color:${colors[s.subject]||'#64748B'};font-weight:700">${pct}%</span></div><div class="perf-bar-track"><div class="perf-bar-fill" style="width:${pct}%;background:${colors[s.subject]||'#64748B'}"></div></div></div>`
    })
  }
  el.innerHTML=html
}

async function loadExamCards(){
  const {data:exams}=await sb.from('exams').select('*').in('exam_type',['JEE','MHT-CET']).not('year','is',null).order('year',{ascending:false}).limit(6)
  const el=document.getElementById('exam-cards-container')
  if(!exams||exams.length===0){el.innerHTML='<div class="empty-state">No exams available</div>';return}
  el.innerHTML=`<div class="exam-cards">${exams.slice(0,3).map(e=>`
    <div class="exam-card">
      <span class="exam-tag tag-${e.exam_type==='JEE'?'jee':e.exam_type==='MHT-CET'?'mht':'gen'}">${e.exam_type}</span>
      <div class="exam-name">${e.title.length>30?e.title.substring(0,30)+'…':e.title}</div>
      <div class="exam-meta">${e.total_questions} Qs · ${e.duration_minutes} min</div>
      <div class="exam-subjects">${e.subjects.join(' · ')}</div>
      <button class="start-btn" onclick="selectTest('${e.id}','${e.title.replace(/'/g,"\\'")}','${e.exam_type}')">Start Test →</button>
    </div>`).join('')}</div>`
}

async function loadRecentTests(){
  const {data}=await sb.from('attempts').select('*,exams(title,exam_type)').eq('user_id',currentUser.id).eq('completed',true).order('created_at',{ascending:false}).limit(5)
  const el=document.getElementById('recent-tests')
  if(!data||data.length===0){el.innerHTML='<div class="empty-state"><div class="empty-icon">🎯</div>No tests attempted yet.<br>Start your first mock test!</div>';return}
  const icons={JEE:'📘','MHT-CET':'🌿',Generic:'📋'}
  const bgs={JEE:'#EFF6FF','MHT-CET':'#ECFDF5',Generic:'#F5F3FF'}
  el.innerHTML=data.map(a=>{
    const pct=a.accuracy||0
    const col=pct>=70?'var(--green)':pct>=50?'var(--amber)':'var(--red)'
    const et=a.exam_type||'Generic'
    return`<div class="recent-item">
      <div class="ri-icon" style="background:${bgs[et]||'#F5F3FF'}">${icons[et]||'📋'}</div>
      <div class="ri-info"><div class="ri-title">${a.exams?.title||'Practice Session'}</div><div class="ri-sub">${new Date(a.created_at).toLocaleDateString('en-IN')} · ${a.total_questions} questions</div></div>
      <div class="ri-score" style="color:${col}">${Math.round(pct)}%</div>
    </div>`
  }).join('')
}

// ── PRACTICE MODE ──────────────────────────────────────────────────────────
function setFilter(type,val,el){
  if(type==='exam'){
    practiceFilters.exam=val
    document.querySelectorAll('.prac-sidebar .filter-section:first-child .filter-btn').forEach(b=>b.classList.remove('active'))
  } else if(type==='subj'){
    practiceFilters.subj=val
    document.querySelectorAll('.prac-sidebar .filter-section:nth-child(2) .filter-btn').forEach(b=>b.classList.remove('active'))
  } else {
    practiceFilters.diff=val
    document.querySelectorAll('.prac-sidebar .filter-section:nth-child(3) .filter-btn').forEach(b=>b.classList.remove('active'))
  }
  el.classList.add('active')
  loadPracticeQuestions()
}

async function loadPracticeQuestions(){
  const search=document.getElementById('prac-search')?.value?.toLowerCase()||''
  const sort=document.getElementById('sort-select')?.value||''

  // FIX: Build query with STRICT subject filter to avoid cross-subject mixing
  let query=sb.from('questions').select('*').eq('is_active',true).limit(30)

  // FIX: exam filter — strictly filter by exam_type
  if(practiceFilters.exam!=='all') query=query.eq('exam_type',practiceFilters.exam)

  // FIX: subject filter — strictly filter by subject field
  if(practiceFilters.subj!=='all'){
    query=query.eq('subject',practiceFilters.subj)
    // Biology only exists in MHT-CET — enforce this
    if(practiceFilters.subj==='Biology') query=query.eq('exam_type','MHT-CET')
  }

  if(practiceFilters.diff!=='all') query=query.eq('difficulty',practiceFilters.diff)

  if(sort==='easy') query=query.order('difficulty',{ascending:true})
  else if(sort==='hard') query=query.order('difficulty',{ascending:false})

  const {data:qs,error}=await query
  const el=document.getElementById('q-list')
  if(error){el.innerHTML=`<div class="empty-state">Error: ${error.message}</div>`;return}

  // FIX: Double-enforce subject filter client-side (extra safety)
  let filtered=(qs||[]).filter(q=>{
    if(practiceFilters.subj!=='all'&&q.subject!==practiceFilters.subj)return false
    if(q.subject==='Biology'&&q.exam_type!=='MHT-CET')return false
    if(search&&!q.question_text.toLowerCase().includes(search))return false
    return true
  })

  document.getElementById('q-count').textContent=`${filtered.length} question${filtered.length!==1?'s':''}`
  if(filtered.length===0){el.innerHTML='<div class="empty-state"><div class="empty-icon">🔍</div>No questions found.<br>Try different filters.</div>';return}

  const tagClass={Physics:'tag-phys',Chemistry:'tag-chem',Mathematics:'tag-math',Biology:'tag-bio'}
  const examTag={JEE:'tag-jee','MHT-CET':'tag-mht',Generic:'tag-gen'}
  const diffClass={easy:'diff-easy',medium:'diff-med',hard:'diff-hard'}

  el.innerHTML=filtered.map(q=>`
    <div class="pq-card" id="pqcard-${q.id}">
      <div class="pq-top" onclick="togglePQ('${q.id}')">
        <div style="flex:1">
          <div class="pq-meta">
            <span class="pq-tag ${examTag[q.exam_type]||'tag-gen'}">${q.exam_type}</span>
            <span class="pq-tag ${tagClass[q.subject]||''}">${q.subject}</span>
            <span class="pq-tag ${diffClass[q.difficulty]}">${q.difficulty}</span>
            ${q.chapter?`<span class="pq-tag" style="background:var(--surface2);color:var(--muted)">${q.chapter}</span>`:''}
          </div>
          <div class="pq-text">${q.question_text}</div>
        </div>
        <div class="expand-ico" id="ico-${q.id}">+</div>
      </div>
      <div class="pq-answer">
        <div class="pq-opts" id="pqopts-${q.id}">
          ${['A','B','C','D'].map(l=>`
            <div class="pq-opt" id="pqopt-${q.id}-${l}" onclick="selectPracOpt('${q.id}','${l}','${q.correct_option}')">
              <div class="opt-key">${l}</div>
              <span>${q['option_'+l.toLowerCase()]||''}</span>
            </div>`).join('')}
        </div>
        <div class="expl-box" id="expl-${q.id}" style="display:none">
          <strong>Explanation:</strong> ${q.explanation||'No explanation available.'}
        </div>
      </div>
    </div>`).join('')
}

function togglePQ(id){
  const card=document.getElementById('pqcard-'+id)
  card.classList.toggle('expanded')
  document.getElementById('ico-'+id).textContent=card.classList.contains('expanded')?'−':'+'
}

// FIX: selectPracOpt now shows correct/wrong/explanation properly without restarting
function selectPracOpt(qid,selected,correct){
  const opts=document.querySelectorAll(`#pqopts-${qid} .pq-opt`)
  const card=document.getElementById('pqcard-'+qid)

  opts.forEach(o=>{
    o.classList.remove('correct-opt','wrong-opt')
    o.classList.add('disabled-opt') // disable further clicks
  })

  // Highlight correct answer always
  const correctEl=document.getElementById(`pqopt-${qid}-${correct}`)
  if(correctEl) correctEl.classList.add('correct-opt')

  // Highlight user's selection if wrong
  if(selected!==correct){
    const wrongEl=document.getElementById(`pqopt-${qid}-${selected}`)
    if(wrongEl) wrongEl.classList.add('wrong-opt')
    card.classList.add('wrong-ans')
  } else {
    card.classList.add('correct-ans')
  }

  // Show result badge + explanation
  const expl=document.getElementById('expl-'+qid)
  const badge=selected===correct
    ?`<div class="result-badge rb-correct">✓ Correct!</div>`
    :`<div class="result-badge rb-wrong">✗ Wrong — Correct answer is ${correct}</div>`
  expl.innerHTML=badge+`<strong>Explanation:</strong> ${expl.dataset.expl||expl.textContent.replace('Explanation:','')}`
  expl.style.display='block'
}

// ── MOCK TEST ──────────────────────────────────────────────────────────────
function selectTest(examId,examName,examType){
  tS.examId=examId;tS.examName=examName;tS.examType=examType
  document.getElementById('test-name-heading').textContent=examName
  document.getElementById('test-subjects-line').textContent=examType==='MHT-CET'?'Physics · Chemistry · Mathematics · Biology':'Physics · Chemistry · Mathematics'
  document.getElementById('begin-test-btn').style.display='inline-block'
  document.getElementById('test-select-hint').style.display='none'
  showPage('mocktest',document.querySelectorAll('.nav-link')[2])
  document.getElementById('test-start-screen').style.display='block'
  document.getElementById('test-ui').style.display='none'
  document.getElementById('test-result').style.display='none'
  reviewModeOn=false
}

async function beginTest(){
  document.getElementById('begin-test-btn').disabled=true
  document.getElementById('begin-test-btn').textContent='Loading...'
  reviewModeOn=false

  let query=sb.from('questions').select('*').eq('is_active',true)

  // FIX: strict exam type filter for mock test
  if(tS.examType==='JEE') query=query.in('exam_type',['JEE','Generic']).neq('subject','Biology')
  else if(tS.examType==='MHT-CET') query=query.in('exam_type',['MHT-CET','Generic'])
  else query=query.eq('exam_type','Generic')

  query=query.order('subject').limit(20)
  const {data:qs}=await query

  if(!qs||qs.length===0){
    alert('No questions found for this exam. Please add questions in Supabase first.')
    document.getElementById('begin-test-btn').disabled=false
    document.getElementById('begin-test-btn').textContent='Begin Test →'
    return
  }

  // FIX: extra safety — remove Biology from JEE
  const filtered=tS.examType==='JEE'?qs.filter(q=>q.subject!=='Biology'):qs

  // Save questions globally for review
  testQuestions=[...filtered]
  tS.questions=filtered
  tS.current=0;tS.answers={};tS.skipped={}
  tS.secs=filtered.length*120
  tS.startTime=Date.now()

  if(!isGuest){
    const {data:att}=await sb.from('attempts').insert({
      user_id:currentUser.id,exam_id:tS.examId,exam_type:tS.examType,
      mode:'mock',completed:false,answers:{}
    }).select().single()
    tS.attemptId=att?.id
  }

  document.getElementById('test-start-screen').style.display='none'
  document.getElementById('test-ui').style.display='block'
  document.getElementById('active-test-name').textContent=tS.examName
  document.getElementById('total-q').textContent=filtered.length
  document.getElementById('skip-btn').style.display='inline-flex'
  document.getElementById('next-btn').textContent='Save & Next →'

  buildPalette(false)
  buildSubjTabs()
  renderTestQ(false)
  if(tS.interval)clearInterval(tS.interval)
  tS.interval=setInterval(tickTimer,1000)
  updateTimerDisplay()
  document.getElementById('begin-test-btn').disabled=false
  document.getElementById('begin-test-btn').textContent='Begin Test →'
}

function tickTimer(){tS.secs--;if(tS.secs<=0){clearInterval(tS.interval);submitTest();return}updateTimerDisplay()}
function updateTimerDisplay(){
  const h=Math.floor(tS.secs/3600),m=Math.floor((tS.secs%3600)/60),s=tS.secs%60
  const el=document.getElementById('test-timer')
  el.textContent=(h>0?pad(h)+':':'')+pad(m)+':'+pad(s)
  el.className='timer'+(tS.secs<300?' urgent':'')
}
function pad(n){return n<10?'0'+n:''+n}

function buildPalette(isReview){
  const qs=testQuestions.length>0?testQuestions:tS.questions
  document.getElementById('palette-title').textContent=isReview?'Review Palette':'Question Palette'
  document.getElementById('q-palette').innerHTML=qs.map((_,i)=>`<div class="q-num" id="qn-${i}" onclick="jumpQ(${i})">${i+1}</div>`).join('')

  const legend=document.getElementById('palette-legend')
  if(isReview){
    legend.innerHTML=`
      <div class="leg-item"><div class="leg-dot" style="background:#ECFDF5;border:1px solid #059669"></div>Correct</div>
      <div class="leg-item"><div class="leg-dot" style="background:#FEF2F2;border:1px solid #DC2626"></div>Wrong</div>
      <div class="leg-item"><div class="leg-dot" style="background:var(--surface2);border:1px solid var(--border)"></div>Skipped</div>`
  } else {
    legend.innerHTML=`
      <div class="leg-item"><div class="leg-dot" style="background:#EFF6FF;border:1px solid #2563EB"></div>Answered</div>
      <div class="leg-item"><div class="leg-dot" style="background:#FFFBEB;border:1px solid #D97706"></div>For Review</div>
      <div class="leg-item"><div class="leg-dot" style="background:var(--surface2);border:1px solid var(--border)"></div>Not Visited</div>`
  }
  updatePalette(isReview)
}

function updatePalette(isReview){
  const qs=testQuestions.length>0?testQuestions:tS.questions
  qs.forEach((_,i)=>{
    const el=document.getElementById('qn-'+i);if(!el)return
    if(isReview){
      const q=qs[i],sel=tS.answers[i]
      let cls='q-num'+(i===tS.current?' current':'')
      if(!sel||sel===null)cls+=' rev-skip'
      else if(sel===q.correct_option)cls+=' rev-correct'
      else cls+=' rev-wrong'
      el.className=cls
    } else {
      el.className='q-num'+(i===tS.current?' current':'')+(tS.answers[i]!==undefined?' answered':'')+(tS.skipped[i]?' skipped':'')
    }
  })
}

function buildSubjTabs(){
  const qs=testQuestions.length>0?testQuestions:tS.questions
  // FIX: build subject tabs from actual subject field of questions
  const seen=[],subjs=[]
  qs.forEach(q=>{if(!seen.includes(q.subject)){seen.push(q.subject);subjs.push(q.subject)}})
  document.getElementById('subj-tabs').innerHTML=subjs.map((s,i)=>`
    <button class="subj-tab${i===0?' active':''}" onclick="jumpToSubj('${s}',this)">${s}</button>`).join('')
}

function jumpToSubj(s,el){
  document.querySelectorAll('.subj-tab').forEach(t=>t.classList.remove('active'))
  el.classList.add('active')
  const qs=testQuestions.length>0?testQuestions:tS.questions
  // FIX: find first question with matching subject
  const idx=qs.findIndex(q=>q.subject===s)
  if(idx>=0){tS.current=idx;renderTestQ(reviewModeOn)}
}

// FIX: renderTestQ now properly handles review mode
function renderTestQ(review){
  const qs=testQuestions.length>0?testQuestions:tS.questions
  const q=qs[tS.current]
  if(!q)return

  document.getElementById('q-num-label').textContent=`Question ${tS.current+1}${review?' (Review)':''}`
  document.getElementById('cur-q-num').textContent=tS.current+1

  // FIX: show subject tag on question
  const subjColors={Physics:'#1D4ED8',Chemistry:'#065F46',Mathematics:'#5B21B6',Biology:'#92400E'}
  const subjBg={Physics:'#EFF6FF',Chemistry:'#ECFDF5',Mathematics:'#F5F3FF',Biology:'#FFFBEB'}
  document.getElementById('q-subj-tag').innerHTML=`<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;background:${subjBg[q.subject]||'#F5F3FF'};color:${subjColors[q.subject]||'#5B21B6'}">${q.subject} · ${q.exam_type}</span>`
  document.getElementById('q-text-display').textContent=q.question_text

  const sel=tS.answers[tS.current]

  // FIX: review mode shows explanation
  const explBox=document.getElementById('review-expl')
  if(review&&q.explanation){
    explBox.style.display='block'
    explBox.innerHTML=`<strong>Explanation:</strong> ${q.explanation}`
  } else {
    explBox.style.display='none'
  }

  // FIX: render options with proper review colors
  document.getElementById('options-container').innerHTML=['A','B','C','D'].map((l,i)=>{
    const optText=q['option_'+l.toLowerCase()]||''
    let cls='opt'
    if(review){
      if(l===q.correct_option)cls+=' review-correct'
      else if(l===sel&&sel!==q.correct_option)cls+=' review-wrong'
    } else {
      if(sel===l)cls+=' selected'
    }
    const letterCls=cls.includes('review-correct')||cls.includes('review-wrong')?cls.replace('opt ','opt-letter ').split(' ').pop():'opt-letter'
    return`<div class="${cls}" onclick="${review?'':'selectOpt(\''+l+'\')'}">
      <div class="opt-letter">${l}</div>
      <span>${optText}</span>
    </div>`
  }).join('')

  updatePalette(review)
}

function selectOpt(l){tS.answers[tS.current]=l;delete tS.skipped[tS.current];renderTestQ(false)}
function nextQ(){if(tS.current<(reviewModeOn?testQuestions:tS.questions).length-1){tS.current++;renderTestQ(reviewModeOn)}}
function prevQ(){if(tS.current>0){tS.current--;renderTestQ(reviewModeOn)}}
function skipQ(){tS.skipped[tS.current]=true;nextQ()}
function jumpQ(i){tS.current=i;renderTestQ(reviewModeOn)}

async function submitTest(){
  clearInterval(tS.interval)
  const qs=testQuestions
  let correct=0,wrong=0,skip=0,score=0
  const answers={}
  qs.forEach((q,i)=>{
    const sel=tS.answers[i]
    let result='skipped'
    if(!sel){skip++}
    else if(sel===q.correct_option){correct++;score+=q.marks||4;result='correct'}
    else{wrong++;score-=q.negative_marks||1;result='wrong'}
    answers[q.id]={selected:sel||null,correct:q.correct_option,result}
  })
  const total=qs.length
  const pct=Math.round((correct/total)*100)
  const totalMarks=qs.reduce((s,q)=>s+(q.marks||4),0)
  const timeTaken=Math.floor((Date.now()-tS.startTime)/1000)

  if(!isGuest&&tS.attemptId){
    await sb.from('attempts').update({
      answers,score,total_marks:totalMarks,
      correct_count:correct,wrong_count:wrong,skipped_count:skip,
      total_questions:total,accuracy:pct,
      time_taken_seconds:timeTaken,
      completed:true,completed_at:new Date().toISOString()
    }).eq('id',tS.attemptId)
  }

  document.getElementById('final-pct').textContent=pct+'%'
  document.getElementById('final-marks-text').textContent=`${score} marks · ${correct}×(+4) − ${wrong}×(−1)`
  document.getElementById('res-correct').textContent=correct
  document.getElementById('res-wrong').textContent=wrong
  document.getElementById('res-skip').textContent=skip
  document.getElementById('test-ui').style.display='none'
  document.getElementById('test-result').style.display='block'
}

// FIX: startReviewMode — does NOT restart the test, stays in test UI, shows answers
function startReviewMode(){
  reviewModeOn=true
  tS.current=0
  document.getElementById('test-result').style.display='none'
  document.getElementById('test-ui').style.display='block'
  // Update UI for review mode
  document.getElementById('skip-btn').style.display='none'
  document.getElementById('next-btn').textContent='Next Question →'
  buildPalette(true)
  buildSubjTabs()
  renderTestQ(true)
}

function backToDash(){
  reviewModeOn=false
  clearInterval(tS.interval)
  showPage('dashboard',document.querySelectorAll('.nav-link')[0])
  loadDashboard()
}

// ── PAPERS ─────────────────────────────────────────────────────────────────
async function loadPapers(){
  const {data}=await sb.from('papers').select('*').order('year',{ascending:false})
  allPapers=data||[]
  renderPapers(null)
}
function filterPapers(type,el){
  document.querySelectorAll('#papers .filter-btn').forEach(b=>b.classList.remove('active'))
  if(el)el.classList.add('active')
  renderPapers(type==='all'?null:type)
}
function renderPapers(examType){
  const filtered=examType?allPapers.filter(p=>p.exam_type===examType):allPapers
  const userPlan=currentProfile?.plan||'free'
  const planRank={free:0,pro:1,elite:2}
  const sc={Physics:'#EFF6FF',Chemistry:'#ECFDF5',Mathematics:'#F5F3FF',Biology:'#FFFBEB'}
  const stc={Physics:'#1D4ED8',Chemistry:'#065F46',Mathematics:'#5B21B6',Biology:'#92400E'}
  if(!filtered.length){document.getElementById('papers-grid').innerHTML='<div class="empty-state" style="grid-column:1/-1">No papers available</div>';return}
  document.getElementById('papers-grid').innerHTML=filtered.map(p=>{
    const locked=planRank[userPlan]<planRank[p.requires_plan]
    return`<div class="paper-card${locked?' plan-lock':''}">
      <span class="exam-tag tag-${p.exam_type==='JEE'?'jee':'mht'}">${p.exam_type}</span>
      <div class="paper-year">${p.year}</div>
      <div class="paper-title">${p.title}</div>
      <div class="paper-meta">${p.total_questions||'—'} questions · ${p.duration_minutes||'—'} min${p.shift?' · '+p.shift:''}</div>
      <div class="paper-subjects">${(p.subjects||[]).map(s=>`<span class="paper-subj" style="background:${sc[s]||'#F5F3FF'};color:${stc[s]||'#5B21B6'}">${s}</span>`).join('')}</div>
      ${locked?`<div style="font-size:10px;font-weight:700;color:var(--amber);margin-top:4px">🔒 ${p.requires_plan.toUpperCase()} Plan required</div>`:''}
      <button class="download-btn" ${locked?'disabled':''} onclick="${p.file_url?`window.open('./pdf-simulator.html?paper=${p.id}','_blank')`:`alert('PDF not uploaded yet')`}">
        ${p.file_url?'📝 Attempt Now':'📄 PDF Coming Soon'}
      </button>
    </div>`
  }).join('')
}

// ── ANALYTICS ──────────────────────────────────────────────────────────────
async function loadAnalytics(){
  if(isGuest){
    document.getElementById('analytics-table').innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:20px">Sign up to see your analytics</td></tr>'
    return
  }
  const isDark=document.documentElement.getAttribute('data-theme')==='dark'
  const gc=isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)'
  const tc=isDark?'#64748B':'#94A3B8'

  const {data:subj}=await sb.from('user_subject_performance').select('*').eq('user_id',currentUser.id)
  const jee={Physics:0,Chemistry:0,Mathematics:0}
  const mht={Physics:0,Chemistry:0,Mathematics:0,Biology:0}
  subj?.forEach(s=>{
    if(s.exam_type==='JEE'&&jee[s.subject]!==undefined)jee[s.subject]=s.avg_accuracy||0
    if(s.exam_type==='MHT-CET'&&mht[s.subject]!==undefined)mht[s.subject]=s.avg_accuracy||0
  })

  if(charts.jee)charts.jee.destroy()
  if(charts.mht)charts.mht.destroy()
  if(charts.line)charts.line.destroy()
  if(charts.donut)charts.donut.destroy()

  charts.jee=new Chart(document.getElementById('barChartJEE').getContext('2d'),{type:'bar',data:{labels:Object.keys(jee),datasets:[{data:Object.values(jee),backgroundColor:['#3B82F6','#10B981','#8B5CF6'],borderRadius:5}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{grid:{color:gc},ticks:{color:tc}},y:{grid:{color:gc},ticks:{color:tc},max:100}}}})
  charts.mht=new Chart(document.getElementById('barChartMHT').getContext('2d'),{type:'bar',data:{labels:Object.keys(mht),datasets:[{data:Object.values(mht),backgroundColor:['#3B82F6','#10B981','#8B5CF6','#F59E0B'],borderRadius:5}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{grid:{color:gc},ticks:{color:tc}},y:{grid:{color:gc},ticks:{color:tc},max:100}}}})

  const {data:trend}=await sb.from('user_score_trend').select('*').eq('user_id',currentUser.id).order('created_at').limit(10)
  charts.line=new Chart(document.getElementById('lineChart').getContext('2d'),{type:'line',data:{labels:(trend||[]).map((_,i)=>'T'+(i+1)),datasets:[{label:'Score %',data:(trend||[]).map(t=>t.accuracy_pct||0),borderColor:'#6366F1',backgroundColor:'rgba(99,102,241,0.1)',fill:true,tension:0.4,pointBackgroundColor:'#6366F1',pointRadius:4}]},options:{responsive:true,plugins:{legend:{labels:{color:tc}}},scales:{x:{grid:{color:gc},ticks:{color:tc}},y:{grid:{color:gc},ticks:{color:tc},min:0,max:100}}}})

  const {data:atts}=await sb.from('attempts').select('correct_count,wrong_count,skipped_count').eq('user_id',currentUser.id).eq('completed',true)
  let tc2=0,tw=0,ts=0
  atts?.forEach(a=>{tc2+=a.correct_count||0;tw+=a.wrong_count||0;ts+=a.skipped_count||0})
  const tot=tc2+tw+ts||1
  const cp=Math.round(tc2/tot*100),wp=Math.round(tw/tot*100),sp=100-cp-wp
  document.getElementById('dl-correct').textContent=`Correct — ${cp}%`
  document.getElementById('dl-wrong').textContent=`Wrong — ${wp}%`
  document.getElementById('dl-skip').textContent=`Skipped — ${sp}%`
  charts.donut=new Chart(document.getElementById('donutChart').getContext('2d'),{type:'doughnut',data:{labels:['Correct','Wrong','Skipped'],datasets:[{data:[cp,wp,sp],backgroundColor:['#059669','#DC2626','#94A3B8'],borderWidth:0}]},options:{cutout:'70%',plugins:{legend:{display:false}}}})

  // Heatmap
  const {data:heat}=await sb.from('user_activity_heatmap').select('*').eq('user_id',currentUser.id)
  const heatMap={}
  heat?.forEach(h=>{heatMap[h.activity_date]=h.test_count})
  const hm=document.getElementById('heatmap');hm.innerHTML=''
  const today=new Date()
  for(let i=62;i>=0;i--){
    const d=new Date(today);d.setDate(today.getDate()-i)
    const key=d.toISOString().split('T')[0]
    const cnt=heatMap[key]||0
    const intensity=Math.min(cnt,5)
    const colors=isDark?['#1E2D45','#1E3A5F','#1d4ed8','#2563eb','#3b82f6','#60a5fa']:['#F1F5F9','#DBEAFE','#BFDBFE','#93C5FD','#3B82F6','#1D4ED8']
    const cell=document.createElement('div');cell.className='hm-cell';cell.style.background=colors[intensity];cell.title=`${key}: ${cnt} test${cnt!==1?'s':''}`;hm.appendChild(cell)
  }

  // Table
  const {data:recent}=await sb.from('attempts').select('*,exams(title)').eq('user_id',currentUser.id).eq('completed',true).order('created_at',{ascending:false}).limit(10)
  const tbody=document.getElementById('analytics-table')
  if(!recent||!recent.length){tbody.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:20px">No tests yet</td></tr>';return}
  tbody.innerHTML=recent.map(a=>{
    const pct=a.accuracy||0
    const chip=pct>=70?'chip-good':pct>=50?'chip-avg':'chip-low'
    const status=pct>=70?'Strong':pct>=50?'Average':'Needs Work'
    return`<tr>
      <td style="font-weight:600">${a.exams?.title||'Practice'}</td>
      <td><span class="exam-tag tag-${a.exam_type==='JEE'?'jee':a.exam_type==='MHT-CET'?'mht':'gen'}" style="margin:0">${a.exam_type||'—'}</span></td>
      <td style="font-weight:700">${a.score||0}</td>
      <td>${Math.round(pct)}%</td>
      <td style="color:var(--muted)">${new Date(a.created_at).toLocaleDateString('en-IN')}</td>
      <td><span class="chip ${chip}">${status}</span></td>
    </tr>`
  }).join('')
}

// ── INIT ───────────────────────────────────────────────────────────────────
;(async()=>{
  showLoader('Loading MockMasters...')
  const {data:{session}}=await sb.auth.getSession()
  if(session?.user){
    currentUser=session.user
    await loadProfile()
    hideLoader()
    showApp()
  } else {
    hideLoader()
    showAuth()
  }
})()


// ── EXPOSE TO WINDOW (required for onclick= in HTML with ES modules) ──────
Object.assign(window,{
  switchAuthTab,handleLogin,handleSignup,handleGuestLogin,handleLogout,
  toggleTheme,showPage,setFilter,loadPracticeQuestions,togglePQ,selectPracOpt,
  selectTest,beginTest,nextQ,prevQ,skipQ,jumpQ,selectOpt,jumpToSubj,
  submitTest,startReviewMode,backToDash,
  filterPapers,
})