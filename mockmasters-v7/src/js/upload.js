import { sb } from './supabase.js'

const PAPER_ID = '0f3feaa6-6dc5-4f03-9e00-01226f2a5dba'
const STORAGE_PATH = 'JEE/2025/JEE-Main-2025-22-Jan-Shift-1.pdf'

async function uploadPDF() {
  const file = document.getElementById('pdf-file').files[0]
  if (!file) { showMsg('Please select a PDF file first.', 'error'); return }

  const btn = document.getElementById('upload-btn')
  btn.disabled = true
  btn.textContent = 'Uploading...'
  showMsg('Uploading PDF to Supabase Storage...', 'info')

  try {
    // Upload to storage
    const { error: uploadError } = await sb.storage
      .from('papers')
      .upload(STORAGE_PATH, file, { upsert: true, contentType: 'application/pdf' })

    if (uploadError) throw uploadError

    // Get public URL
    const { data } = sb.storage.from('papers').getPublicUrl(STORAGE_PATH)
    const url = data.publicUrl

    // Update paper record with file URL
    const { error: updateError } = await sb
      .from('papers')
      .update({ file_url: url, processing_status: 'uploaded' })
      .eq('id', PAPER_ID)

    if (updateError) throw updateError

    showMsg(`✓ PDF uploaded successfully!\n\nURL: ${url}\n\nThe paper is now live on MockMasters. Students can attempt it from the Papers page.`, 'success')
  } catch (e) {
    showMsg('Error: ' + e.message, 'error')
  } finally {
    btn.disabled = false
    btn.textContent = 'Upload to Supabase Storage'
  }
}

function showMsg(text, type) {
  const el = document.getElementById('msg')
  el.className = 'msg ' + type
  el.textContent = text
  el.style.display = 'block'
}

// Expose to window so onclick="uploadPDF()" in HTML works from ES module
window.uploadPDF = uploadPDF