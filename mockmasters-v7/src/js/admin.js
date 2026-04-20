import { sb } from './supabase.js'

let allPapers = []

;(async () => {
  const { data: { session } } = await sb.auth.getSession()
  if (!session) { window.location.href = 'index.html'; return }
  document.getElementById('admin-email').textContent = session.user.email
  await loadPapers()
})()

async function loadPapers() {
  const { data } = await sb.from('papers').select('*, answer_keys(id)').order('year', { ascending: false })
  allPapers = data || []
  document.getElementById('papers-count').textContent = `(${allPapers.length} papers)`

  // Populate select
  const select = document.getElementById('ak-paper')
  select.innerHTML = '<option value="">Select a paper...</option>' +
    allPapers.map(p => `<option value="${p.id}">${p.title} (${p.year})</option>`).join('')

  // Render table
  const tbody = document.getElementById('papers-tbody')
  if (allPapers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:20px">No papers yet. Add one above.</td></tr>'
    return
  }
  tbody.innerHTML = allPapers.map(p => `
    <tr>
      <td style="font-weight:600;max-width:200px">${p.title}</td>
      <td><span class="badge badge-${p.exam_type === 'JEE' ? 'jee' : 'mht'}">${p.exam_type}</span></td>
      <td>${p.year || '—'}</td>
      <td>${p.total_questions || '—'}</td>
      <td><span class="badge ${p.file_url ? 'badge-yes' : 'badge-no'}">${p.file_url ? 'Uploaded' : 'Missing'}</span></td>
      <td><span class="badge ${p.answer_keys?.length > 0 ? 'badge-yes' : 'badge-pending'}">${p.answer_keys?.length > 0 ? 'Added' : 'Pending'}</span></td>
      <td><span class="badge badge-pending" style="text-transform:uppercase">${p.requires_plan}</span></td>
      <td>
        <button class="action-btn" onclick="window.open('./pdf-simulator.html?paper=${p.id}','_blank')">Test</button>
        <button class="action-btn" onclick="prefillAnswerKey('${p.id}')">+ Key</button>
        <button class="action-btn" style="border-color:var(--red);color:var(--red)" onclick="deletePaper('${p.id}','${p.title.replace(/'/g,"\\'")}')">Delete</button>
      </td>
    </tr>`).join('')
}

function prefillAnswerKey(paperId) {
  document.getElementById('ak-paper').value = paperId
  document.getElementById('ak-answers').focus()
  document.querySelector('.card:nth-child(2)').scrollIntoView({ behavior: 'smooth' })
}

async function addPaper() {
  const title = document.getElementById('p-title').value.trim()
  const examType = document.getElementById('p-type').value
  const year = parseInt(document.getElementById('p-year').value)
  const shift = document.getElementById('p-shift').value.trim()
  const totalQ = parseInt(document.getElementById('p-total-q').value)
  const duration = parseInt(document.getElementById('p-duration').value)
  const plan = document.getElementById('p-plan').value
  const file = document.getElementById('p-pdf').files[0]

  if (!title) return showMsg('paper', 'error', 'Please enter a paper title.')
  if (!file) return showMsg('paper', 'error', 'Please select a PDF file to upload.')

  const btn = document.getElementById('add-paper-btn')
  btn.disabled = true; btn.textContent = 'Uploading...'

  const subjects = examType === 'MHT-CET'
    ? ['Physics','Chemistry','Mathematics','Biology']
    : ['Physics','Chemistry','Mathematics']

  try {
    // Upload PDF to storage
    document.getElementById('upload-progress').style.display = 'block'
    document.getElementById('progress-fill').style.width = '20%'

    const fileName = `${examType}/${year}/${Date.now()}-${file.name.replace(/\s+/g,'-')}`
    const { error: uploadError } = await sb.storage.from('papers').upload(fileName, file)
    if (uploadError) throw uploadError

    document.getElementById('progress-fill').style.width = '70%'

    const { data: urlData } = sb.storage.from('papers').getPublicUrl(fileName)

    // Insert paper record
    const { error: insertError } = await sb.from('papers').insert({
      title, exam_type: examType, year, shift: shift || null,
      subjects, total_questions: totalQ, duration_minutes: duration,
      file_url: urlData.publicUrl, is_public: true,
      requires_plan: plan, processing_status: 'uploaded',
      uploaded_at: new Date().toISOString()
    })
    if (insertError) throw insertError

    document.getElementById('progress-fill').style.width = '100%'
    showMsg('paper', 'success', `✓ "${title}" uploaded successfully!`)
    document.getElementById('p-title').value = ''
    document.getElementById('p-pdf').value = ''
    await loadPapers()
  } catch (e) {
    showMsg('paper', 'error', `Error: ${e.message}`)
  } finally {
    btn.disabled = false; btn.textContent = 'Upload Paper'
    setTimeout(() => { document.getElementById('upload-progress').style.display = 'none'; document.getElementById('progress-fill').style.width = '0%' }, 2000)
  }
}

async function addAnswerKey() {
  const paperId = document.getElementById('ak-paper').value
  const raw = document.getElementById('ak-answers').value.trim()
  const subjRaw = document.getElementById('ak-subjects').value.trim()
  const marksCorrect = parseInt(document.getElementById('ak-correct').value) || 4
  const marksWrong = parseInt(document.getElementById('ak-wrong').value) || 1

  if (!paperId) return showMsg('ak', 'error', 'Please select a paper.')
  if (!raw) return showMsg('ak', 'error', 'Please paste the answer key.')

  // Parse answers — supports multiple formats
  const answers = parseAnswerKey(raw)
  if (Object.keys(answers).length === 0) return showMsg('ak', 'error', 'Could not parse answers. Please check the format.')

  let subjectMap = null
  if (subjRaw) {
    try { subjectMap = JSON.parse(subjRaw) } catch(e) { return showMsg('ak', 'error', 'Invalid JSON in subject ranges.') }
  }

  const { error } = await sb.from('answer_keys').upsert({
    paper_id: paperId,
    answers,
    total_questions: Object.keys(answers).length,
    subject_map: subjectMap,
    marks_per_correct: marksCorrect,
    marks_per_wrong: marksWrong,
    updated_at: new Date().toISOString()
  }, { onConflict: 'paper_id' })

  if (error) return showMsg('ak', 'error', `Error: ${error.message}`)

  showMsg('ak', 'success', `✓ Answer key saved! ${Object.keys(answers).length} answers added.`)
  document.getElementById('ak-answers').value = ''
  await loadPapers()
}

function parseAnswerKey(raw) {
  const answers = {}
  // Try format: "1-A, 2-B, 3-C" or "1:A 2:B" or "1. A 2. B" or "1) A"
  const pattern = /(\d+)[\.\-\:\)]\s*([ABCD])/gi
  let match
  while ((match = pattern.exec(raw)) !== null) {
    answers[match[1]] = match[2].toUpperCase()
  }
  if (Object.keys(answers).length > 0) return answers

  // Try plain sequence: "A B C D A B C..." (one letter per line or space-separated)
  const letters = raw.match(/\b[ABCD]\b/gi)
  if (letters) {
    letters.forEach((l, i) => { answers[String(i+1)] = l.toUpperCase() })
  }
  return answers
}

async function deletePaper(id, title) {
  if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
  await sb.from('papers').delete().eq('id', id)
  await loadPapers()
}

function showMsg(section, type, msg) {
  const el = document.getElementById(`${section}-${type}`)
  const other = document.getElementById(`${section}-${type === 'success' ? 'error' : 'success'}`)
  el.textContent = msg; el.style.display = 'block'
  other.style.display = 'none'
  setTimeout(() => { el.style.display = 'none' }, 5000)
}
// Expose to window so onclick= in admin.html works from ES module
Object.assign(window, {
  loadPapers, prefillAnswerKey, addPaper, addAnswerKey, deletePaper
})
