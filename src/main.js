import { PDFDocument, rgb } from 'pdf-lib';
import { layout, imageCrop, PAPERS } from './geometry.js';
import './style.css';

const app = document.querySelector('#app');
const saved = (() => { try { return JSON.parse(localStorage.getItem('montafolha-config') || localStorage.getItem('mosaico-config') || '{}'); } catch { return {}; } })();
const state = { config: { paper: 'A4', orientation: 'landscape', cols: 2, rows: 2, mode: 'zero', overlap: 10, left: 5, right: 5, top: 5, bottom: 5, customW: 210, customH: 297, guide: true, ...saved }, image: null, name: '', selected: 0, busy: false };

app.innerHTML = `
  <header class="topbar"><div class="brand"><span class="brand-mark">▦</span><span>MontaFolha</span></div><span class="top-note">Pôster em folhas · local e privado</span><span class="local-pill">● Sem envio de imagens</span></header>
  <main class="workspace">
    <aside class="controls">
      <div class="aside-heading"><span class="eyebrow">PROJETO</span><h1>Monte seu pôster</h1><p>Escolha a imagem, o papel e como as folhas se encontram.</p></div>
      <section class="panel"><div class="section-title"><b>01</b><h2>Imagem</h2></div><label class="upload" for="file"><span class="upload-icon">↑</span><strong id="file-name">Clique ou arraste uma imagem</strong><small>PNG, JPEG ou WebP</small></label><input id="file" type="file" accept="image/png,image/jpeg,image/webp" hidden/><button id="try-example" class="example-button" type="button">Testar com imagem de exemplo →</button><div id="image-meta" class="micro"></div></section>
      <section class="panel"><div class="section-title"><b>02</b><h2>Divisão e papel</h2></div><div class="field-pair"><label>Colunas<input data-key="cols" type="number" min="1" max="6"/></label><label>Linhas<input data-key="rows" type="number" min="1" max="6"/></label></div><div class="field-pair"><label>Papel<select data-key="paper">${[...Object.keys(PAPERS), 'Personalizado'].map(x => `<option>${x}</option>`).join('')}</select></label><label>Orientação<select data-key="orientation"><option value="landscape">Paisagem</option><option value="portrait">Retrato</option></select></label></div><div id="custom-paper" class="field-pair"><label>Largura (mm)<input data-key="customW" type="number" min="50" max="1200"/></label><label>Altura (mm)<input data-key="customH" type="number" min="50" max="1200"/></label></div></section>
      <section class="panel"><div class="section-title"><b>03</b><h2>Encaixe</h2></div><div class="mode-list"><label class="mode"><input type="radio" name="mode" value="zero"/><span><strong>Sem margem no PDF</strong><small>Arte até as quatro bordas digitais.</small></span></label><label class="mode"><input type="radio" name="mode" value="flap"/><span><strong>Aba única por encaixe</strong><small>Uma faixa branca fica sob a folha vizinha. Exige impressora sem bordas.</small></span></label><label class="mode"><input type="radio" name="mode" value="fold"/><span><strong>Dobrar, sem tesoura</strong><small>Para impressora comum. Dobre as faixas brancas para trás.</small></span></label></div><div id="flap-settings" class="subsettings"><label>Aba de cola (mm)<input data-key="overlap" type="number" min="1" max="40"/></label></div><div id="fold-settings" class="subsettings"><span class="micro">Área não imprimível da sua impressora (mm)</span><div class="field-pair"><label>Esquerda<input data-key="left" type="number" min="0" max="40" step="0.5"/></label><label>Direita<input data-key="right" type="number" min="0" max="40" step="0.5"/></label><label>Superior<input data-key="top" type="number" min="0" max="40" step="0.5"/></label><label>Inferior<input data-key="bottom" type="number" min="0" max="40" step="0.5"/></label></div></div><div id="mode-tip" class="tip"></div></section>
      <section class="panel"><label class="check"><input data-key="guide" type="checkbox"/> Incluir guia de montagem no PDF</label></section>
    </aside>
    <section class="preview-panel"><div class="preview-head"><div><span class="eyebrow">PRÉ-VISUALIZAÇÃO</span><h2 id="preview-title">Seu pôster</h2></div><div class="view-tabs"><button id="tab-mosaic" class="active" type="button">Montado</button><button id="tab-sheets" type="button">Folhas</button></div></div><div id="preview-content" class="preview-content"><div class="empty"><div class="empty-icon">▦</div><h3>Comece com uma imagem</h3><p>Depois de escolher o arquivo, você verá o pôster montado e cada folha antes de gerar o PDF.</p></div></div><div id="sheet-nav" class="sheet-nav hidden"><button id="prev-sheet" type="button">← Anterior</button><span id="sheet-counter"></span><button id="next-sheet" type="button">Próxima →</button></div></section>
    <aside class="summary"><span class="eyebrow">RESUMO</span><h2>Pronto para imprimir</h2><div class="summary-card"><div><span>Divisão</span><strong id="summary-grid">2 × 2 folhas</strong></div><div><span>Papel</span><strong id="summary-paper">A4 · Paisagem</strong></div><div><span>Pôster montado</span><strong id="summary-size">—</strong></div><div><span>Qualidade da imagem</span><strong id="summary-dpi">—</strong></div></div><div id="physical-note" class="physical-note"></div><button id="download" class="primary" type="button" disabled>↓ Gerar PDF</button><p id="status" class="status" role="status"></p><div class="mini-note">Imprima em <strong>tamanho real (100%)</strong>. Desative “ajustar à página” no diálogo de impressão.</div></aside>
  </main>`;

const $ = s => app.querySelector(s);
const fmt = n => `${Math.round(n * 10) / 10}`.replace('.', ',');
let view = 'mosaic';
let currentLayout;

function setStatus(message, error = false) { $('#status').textContent = message; $('#status').classList.toggle('error', error); }
function syncControls() {
  app.querySelectorAll('[data-key]').forEach(el => { const v = state.config[el.dataset.key]; if (el.type === 'checkbox') el.checked = !!v; else el.value = v; });
  app.querySelector(`input[name="mode"][value="${state.config.mode}"]`).checked = true;
  $('#custom-paper').classList.toggle('hidden', state.config.paper !== 'Personalizado');
  $('#flap-settings').classList.toggle('hidden', state.config.mode !== 'flap');
  $('#fold-settings').classList.toggle('hidden', state.config.mode !== 'fold');
  $('#mode-tip').textContent = state.config.mode === 'zero' ? 'O PDF não terá margem. A impressora só imprimirá até a borda se oferecer modo sem bordas.' : state.config.mode === 'flap' ? 'Aba à esquerda e acima das novas folhas. A arte das folhas vizinhas precisa chegar à borda física; use impressora sem bordas.' : 'Dobre todas as faixas brancas para trás na linha pontilhada. Em encaixes internos, as duas folhas terão dobra.';
}

function drawPage(canvas, page, l, resolution = 2, markings = true) {
  const scale = resolution;
  canvas.width = Math.round(l.W * scale);
  canvas.height = Math.round(l.H * scale);
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!state.image) return;
  const crop = imageCrop(state.image.naturalWidth, state.image.naturalHeight, l.posterW, l.posterH);
  const sx = crop.x + crop.w * page.source.x / l.posterW;
  const sy = crop.y + crop.h * page.source.y / l.posterH;
  const sw = crop.w * page.source.w / l.posterW;
  const sh = crop.h * page.source.h / l.posterH;
  ctx.drawImage(state.image, sx, sy, sw, sh, page.art.x * scale, page.art.y * scale, page.art.w * scale, page.art.h * scale);
  if (markings && l.mode !== 'zero') {
    ctx.save(); ctx.strokeStyle = '#e27b56'; ctx.lineWidth = Math.max(1, scale * .22); ctx.setLineDash([2 * scale, 2 * scale]);
    ctx.strokeRect(page.art.x * scale, page.art.y * scale, page.art.w * scale, page.art.h * scale); ctx.restore();
  }
}

function render() {
  syncControls();
  try { currentLayout = layout(state.config); setStatus(''); } catch (e) { currentLayout = null; setStatus(e.message, true); }
  const l = currentLayout;
  $('#download').disabled = !l || !state.image || state.busy;
  if (!l) return;
  $('#summary-grid').textContent = `${l.cols} × ${l.rows} folhas`;
  $('#summary-paper').textContent = `${state.config.paper} · ${state.config.orientation === 'landscape' ? 'Paisagem' : 'Retrato'}`;
  $('#summary-size').textContent = `${fmt(l.posterW / 10)} × ${fmt(l.posterH / 10)} cm`;
  $('#preview-title').textContent = `${l.cols} × ${l.rows} folhas · ${fmt(l.posterW / 10)} × ${fmt(l.posterH / 10)} cm`;
  if (state.image) {
    const crop = imageCrop(state.image.naturalWidth, state.image.naturalHeight, l.posterW, l.posterH);
    const dpi = Math.round(Math.min(crop.w / (l.posterW / 25.4), crop.h / (l.posterH / 25.4)));
    $('#summary-dpi').innerHTML = `${dpi} DPI <em class="${dpi >= 150 ? 'good' : 'low'}">${dpi >= 150 ? 'Boa' : 'Baixa'}</em>`;
  } else $('#summary-dpi').textContent = '—';
  $('#physical-note').innerHTML = state.config.mode === 'zero' ? '<strong>Bordas físicas</strong><p>O arquivo ocupa a página inteira. Confira se sua impressora aceita impressão sem bordas.</p>' : state.config.mode === 'flap' ? '<strong>Uma aba por junção</strong><p>Cole a faixa branca da folha nova atrás da folha anterior. Este modo exige impressão sem bordas nas outras extremidades.</p>' : '<strong>Montagem sem corte</strong><p>Dobre as margens brancas para trás. Nos encaixes internos, dobre as duas folhas antes de aproximar as linhas da imagem.</p>';
  $('#sheet-nav').classList.toggle('hidden', view !== 'sheets' || !state.image);
  $('#tab-mosaic').classList.toggle('active', view === 'mosaic'); $('#tab-sheets').classList.toggle('active', view === 'sheets');
  if (!state.image) return;
  if (view === 'mosaic') {
    $('#preview-content').innerHTML = '<div class="mosaic-wrap"><canvas id="mosaic"></canvas></div><div class="preview-caption">As linhas mostram onde as folhas se encontram.</div>';
    const canvas = $('#mosaic'); const scale = Math.min(1.3, 740 / l.posterW, 490 / l.posterH);
    canvas.width = Math.max(1, Math.round(l.posterW * scale)); canvas.height = Math.max(1, Math.round(l.posterH * scale));
    const ctx = canvas.getContext('2d'); const crop = imageCrop(state.image.naturalWidth, state.image.naturalHeight, l.posterW, l.posterH);
    ctx.drawImage(state.image, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
    l.pages.forEach(p => ctx.strokeRect(p.source.x * scale, p.source.y * scale, p.source.w * scale, p.source.h * scale));
  } else {
    state.selected = Math.min(state.selected, l.pages.length - 1);
    const page = l.pages[state.selected];
    $('#preview-content').innerHTML = '<div class="sheet-wrap"><canvas id="sheet"></canvas></div><div class="preview-caption">Linha laranja: dobre a faixa branca ou use como aba, conforme o modo.</div>';
    drawPage($('#sheet'), page, l, Math.min(2, 620 / l.W, 470 / l.H));
    $('#sheet-counter').textContent = `Folha ${page.number} de ${l.pages.length} · coluna ${page.col + 1}, linha ${page.row + 1}`;
  }
}

async function loadFile(file) {
  if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setStatus('Escolha uma imagem PNG, JPEG ou WebP.', true); return; }
  if (file.size > 80 * 1024 * 1024) { setStatus('Imagem acima de 80 MB. Escolha um arquivo menor.', true); return; }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { state.image = img; state.name = file.name; $('#file-name').textContent = file.name; $('#image-meta').textContent = `${img.naturalWidth} × ${img.naturalHeight} px`; render(); };
  img.onerror = () => { URL.revokeObjectURL(url); setStatus('Não foi possível ler a imagem.', true); };
  img.src = url;
}

const mmToPt = mm => mm * 72 / 25.4;

async function addAssemblyGuide(pdf, l) {
  const guide = pdf.addPage([mmToPt(210), mmToPt(297)]);
  const pageW = guide.getWidth();
  const pageH = guide.getHeight();
  const regular = await pdf.embedFont('Helvetica');
  const bold = await pdf.embedFont('Helvetica-Bold');
  const ink = rgb(.10, .19, .25);
  const muted = rgb(.37, .43, .47);
  const orange = rgb(.84, .40, .24);
  const left = 48;
  const maxW = pageW - left * 2;
  const maxH = 500;
  const scale = Math.min(maxW / l.posterW, maxH / l.posterH);
  const gridW = l.posterW * scale;
  const gridH = l.posterH * scale;
  const gridX = (pageW - gridW) / 2;
  const gridY = 718 - gridH;

  const title = 'Guia de Montagem';
  guide.drawText(title, { x: (pageW - bold.widthOfTextAtSize(title, 21)) / 2, y: 790, size: 21, font: bold, color: ink });
  const subtitle = `${l.cols} colunas x ${l.rows} linhas  |  ${l.pages.length} folhas  |  ${fmt(l.posterW / 10)} x ${fmt(l.posterH / 10)} cm`;
  guide.drawText(subtitle, { x: (pageW - regular.widthOfTextAtSize(subtitle, 10)) / 2, y: 771, size: 10, font: regular, color: muted });

  const canvas = document.createElement('canvas');
  const canvasScale = Math.min(3, 1800 / l.posterW, 1800 / l.posterH);
  canvas.width = Math.max(1, Math.round(l.posterW * canvasScale));
  canvas.height = Math.max(1, Math.round(l.posterH * canvasScale));
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const crop = imageCrop(state.image.naturalWidth, state.image.naturalHeight, l.posterW, l.posterH);
  ctx.drawImage(state.image, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height);
  const thumbnail = await pdf.embedJpg(await (await fetch(canvas.toDataURL('image/jpeg', .86))).arrayBuffer());
  guide.drawImage(thumbnail, { x: gridX, y: gridY, width: gridW, height: gridH });

  for (const tile of l.pages) {
    const x = gridX + tile.source.x * scale;
    const y = gridY + gridH - (tile.source.y + tile.source.h) * scale;
    const w = tile.source.w * scale;
    const h = tile.source.h * scale;
    guide.drawRectangle({ x, y, width: w, height: h, borderColor: rgb(.95, .95, .93), borderWidth: 1.7 });
    const radius = Math.max(10, Math.min(22, w * .22, h * .22));
    const cx = x + w / 2, cy = y + h / 2;
    guide.drawCircle({ x: cx, y: cy, size: radius, color: ink, opacity: .90 });
    const label = String(tile.number);
    const numberSize = radius < 14 ? 10 : 13;
    guide.drawText(label, { x: cx - bold.widthOfTextAtSize(label, numberSize) / 2, y: cy - numberSize * .34, size: numberSize, font: bold, color: rgb(1, 1, 1) });
  }
  for (let col = 0; col < l.cols; col++) {
    const tile = l.pages[col];
    const x = gridX + (tile.source.x + tile.source.w / 2) * scale;
    const letter = String.fromCharCode(65 + col);
    guide.drawText(letter, { x: x - bold.widthOfTextAtSize(letter, 10) / 2, y: gridY + gridH + 11, size: 10, font: bold, color: muted });
  }
  for (let row = 0; row < l.rows; row++) {
    const tile = l.pages[row * l.cols];
    const y = gridY + gridH - (tile.source.y + tile.source.h / 2) * scale;
    guide.drawText(String(row + 1), { x: gridX - 18, y: y - 3, size: 10, font: bold, color: muted });
  }
  guide.drawRectangle({ x: gridX, y: gridY, width: gridW, height: gridH, borderColor: orange, borderWidth: 1.4 });
  guide.drawRectangle({ x: gridX + 4, y: gridY + gridH + 25, width: 81, height: 16, color: rgb(.16, .70, .52) });
  guide.drawText('COMECE AQUI', { x: gridX + 11, y: gridY + gridH + 30, size: 8, font: bold, color: rgb(1, 1, 1) });

  const foot = 'Monte da esquerda para a direita, de cima para baixo. Localize cada folha pela coordenada (ex.: B3).';
  guide.drawText(foot, { x: (pageW - regular.widthOfTextAtSize(foot, 9)) / 2, y: 174, size: 9, font: regular, color: muted });
  guide.drawRectangle({ x: 34, y: 35, width: pageW - 68, height: 124, color: rgb(.96, .97, .97), borderColor: rgb(.78, .83, .85), borderWidth: .7 });
  guide.drawText('Antes de imprimir', { x: 48, y: 138, size: 13, font: bold, color: ink });
  const instructions = [
    '1. Escolha o mesmo papel e a mesma orientacao usados no projeto.',
    '2. Imprima em 100% (tamanho real); desative Ajustar a pagina.',
    '3. Confira a ordem das folhas pelo numero e coordenada.',
    l.mode === 'zero' ? '4. Use impressao sem bordas para evitar faixas brancas.' :
      l.mode === 'flap' ? '4. Cole a aba branca atras da folha anterior; use sem bordas.' :
        '4. Dobre as faixas brancas para tras. Junte as bordas impressas.',
  ];
  instructions.forEach((line, i) => guide.drawText(line, { x: 48, y: 118 - i * 21, size: 9.4, font: regular, color: ink }));
}

async function downloadPdf() {
  if (!state.image || !currentLayout || state.busy) return;
  state.busy = true; $('#download').disabled = true; $('#download').textContent = 'Gerando PDF…'; setStatus('Preparando as folhas no seu dispositivo…');
  try {
    const l = currentLayout; const pdf = await PDFDocument.create();
    for (const page of l.pages) {
      const canvas = document.createElement('canvas');
      // 150 DPI para limitar uso de memória; nunca altera as medidas físicas.
      drawPage(canvas, page, l, 150 / 25.4, false);
      const bytes = await (await fetch(canvas.toDataURL('image/jpeg', .93))).arrayBuffer();
      const embedded = await pdf.embedJpg(bytes);
      const sheet = pdf.addPage([mmToPt(l.W), mmToPt(l.H)]);
      sheet.drawImage(embedded, { x: 0, y: 0, width: mmToPt(l.W), height: mmToPt(l.H) });
      if (l.mode !== 'zero') {
        const a = page.art;
        const line = { color: rgb(.88, .43, .3), thickness: .55, dashArray: [2, 2] };
        if (a.x > 0) sheet.drawLine({ start: { x: mmToPt(a.x), y: 0 }, end: { x: mmToPt(a.x), y: mmToPt(l.H) }, ...line });
        if (a.y > 0) sheet.drawLine({ start: { x: 0, y: mmToPt(l.H - a.y) }, end: { x: mmToPt(l.W), y: mmToPt(l.H - a.y) }, ...line });
        if (l.mode === 'fold') {
          sheet.drawRectangle({ x: mmToPt(a.x), y: mmToPt(l.H - a.y - a.h), width: mmToPt(a.w), height: mmToPt(a.h), borderColor: rgb(.88, .43, .3), borderWidth: .55, borderDashArray: [2, 2] });
        }
      }
    }
    if (state.config.guide) await addAssemblyGuide(pdf, l);
    const bytes = await pdf.save(); const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const a = document.createElement('a'); a.href = url; a.download = `montafolha-${l.cols}x${l.rows}-${state.config.paper.toLowerCase()}.pdf`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    setStatus(`PDF gerado: ${l.pages.length} folhas${state.config.guide ? ' + guia' : ''}.`);
  } catch (e) { console.error(e); setStatus(`Falha ao gerar PDF: ${e.message}`, true); }
  finally { state.busy = false; $('#download').textContent = '↓ Gerar PDF'; $('#download').disabled = false; }
}

app.addEventListener('change', e => {
  if (e.target.dataset.key) {
    const key = e.target.dataset.key; state.config[key] = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    localStorage.setItem('montafolha-config', JSON.stringify(state.config)); render();
  }
  if (e.target.name === 'mode') { state.config.mode = e.target.value; localStorage.setItem('montafolha-config', JSON.stringify(state.config)); render(); }
});
$('#file').addEventListener('change', e => loadFile(e.target.files[0]));
$('#try-example').addEventListener('click', () => {
  const img = new Image();
  img.onload = () => { state.image = img; state.name = 'exemplo-grade.png'; $('#file-name').textContent = 'Imagem de exemplo'; $('#image-meta').textContent = `${img.naturalWidth} × ${img.naturalHeight} px`; render(); };
  img.src = '/exemplo-grade.png';
});
$('.upload').addEventListener('dragover', e => { e.preventDefault(); $('.upload').classList.add('drag'); });
$('.upload').addEventListener('dragleave', () => $('.upload').classList.remove('drag'));
$('.upload').addEventListener('drop', e => { e.preventDefault(); $('.upload').classList.remove('drag'); loadFile(e.dataTransfer.files[0]); });
$('#tab-mosaic').addEventListener('click', () => { view = 'mosaic'; render(); });
$('#tab-sheets').addEventListener('click', () => { view = 'sheets'; render(); });
$('#prev-sheet').addEventListener('click', () => { state.selected = (state.selected - 1 + currentLayout.pages.length) % currentLayout.pages.length; render(); });
$('#next-sheet').addEventListener('click', () => { state.selected = (state.selected + 1) % currentLayout.pages.length; render(); });
$('#download').addEventListener('click', downloadPdf);
render();
