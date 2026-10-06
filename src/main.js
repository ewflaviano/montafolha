import { PDFDocument, rgb } from 'pdf-lib';
import { layout, imagePlacement, pageImageRegion, seamPairs, PAPERS } from './geometry.js';
import { getChoice, setChoice, pageView, reportError } from './usage.js';
import './style.css';

const app = document.querySelector('#app');
const saved = (() => { try { return JSON.parse(localStorage.getItem('montafolha-config') || localStorage.getItem('mosaico-config') || '{}'); } catch { return {}; } })();
const imageFit = ['contain', 'cover'].includes(saved.imageFit) ? saved.imageFit : 'contain';
const state = { config: { paper: 'A4', orientation: 'landscape', cols: 2, rows: 2, mode: 'zero', overlap: 10, left: 5, right: 5, top: 5, bottom: 5, customW: 210, customH: 297, guide: true, ...saved, imageFit }, image: null, name: '', selected: 0, seamDirection: 'vertical', seamIndex: 0, cropPosition: 0.5, busy: false };

app.innerHTML = `
  <header class="topbar"><a class="brand" href="#/"><span class="brand-mark">▦</span><span>MontaFolha</span></a><nav class="top-links" aria-label="Navegação"><a href="#/">Criar pôster</a><a href="#/apoiar">Apoiar</a><a href="#/privacidade">Privacidade</a></nav><span class="local-pill">● Sem envio de imagens</span></header>
  <main class="workspace">
    <aside class="controls">
      <div class="aside-heading"><span class="eyebrow">PROJETO</span><h1>Monte seu pôster</h1><p>Escolha a imagem, o papel e como as folhas se encontram.</p></div>
      <section class="panel"><div class="section-title"><b>01</b><h2>Imagem</h2></div><label class="upload" for="file"><span class="upload-icon">↑</span><strong id="file-name">Clique ou arraste uma imagem</strong><small>PNG, JPEG ou WebP</small></label><input id="file" type="file" accept="image/png,image/jpeg,image/webp" hidden/><button id="try-example" class="example-button" type="button">Testar com imagem de exemplo →</button><div id="image-meta" class="micro"></div></section>
      <section class="panel"><div class="section-title"><b>02</b><h2>Divisão e papel</h2></div><div class="field-pair"><label>Colunas<input data-key="cols" type="number" min="1" max="6"/></label><label>Linhas<input data-key="rows" type="number" min="1" max="6"/></label></div><div class="field-pair"><label>Papel<select data-key="paper">${[...Object.keys(PAPERS), 'Personalizado'].map(x => `<option>${x}</option>`).join('')}</select></label><label>Orientação<select data-key="orientation"><option value="landscape">Paisagem</option><option value="portrait">Retrato</option></select></label></div><div id="custom-paper" class="field-pair"><label>Largura (mm)<input data-key="customW" type="number" min="50" max="1200"/></label><label>Altura (mm)<input data-key="customH" type="number" min="50" max="1200"/></label></div></section>
      <section class="panel"><div class="section-title"><b>03</b><h2>Encaixe</h2></div><div class="mode-list"><label class="mode"><input type="radio" name="mode" value="zero"/><span><strong>Sem margem no PDF</strong><small>Sem margem extra; áreas brancas do ajuste permanecem.</small></span></label><label class="mode"><input type="radio" name="mode" value="flap"/><span><strong>Aba única por encaixe</strong><small>Uma faixa branca fica sob a folha vizinha. Exige impressora sem bordas.</small></span></label><label class="mode"><input type="radio" name="mode" value="fold"/><span><strong>Dobrar, sem tesoura</strong><small>Para impressora comum. Dobre as faixas brancas para trás.</small></span></label></div><div id="flap-settings" class="subsettings"><label>Aba de cola (mm)<input data-key="overlap" type="number" min="1" max="40"/></label></div><div id="fold-settings" class="subsettings"><span class="micro">Área não imprimível da sua impressora (mm)</span><div class="field-pair"><label>Esquerda<input data-key="left" type="number" min="0" max="40" step="0.5"/></label><label>Direita<input data-key="right" type="number" min="0" max="40" step="0.5"/></label><label>Superior<input data-key="top" type="number" min="0" max="40" step="0.5"/></label><label>Inferior<input data-key="bottom" type="number" min="0" max="40" step="0.5"/></label></div></div><div id="mode-tip" class="tip"></div></section>
      <section class="panel"><label class="check"><input data-key="guide" type="checkbox"/> Incluir guia de montagem no PDF</label></section>
    </aside>
    <section class="preview-panel"><div class="preview-head"><div><span class="eyebrow">PRÉ-VISUALIZAÇÃO</span><h2 id="preview-title">Seu pôster</h2></div><div class="view-tabs" role="group" aria-label="Tipo de pré-visualização"><button id="tab-mosaic" class="active" type="button" aria-pressed="true">Montado</button><button id="tab-sheets" type="button" aria-pressed="false">Folhas</button><button id="tab-seams" type="button" aria-pressed="false">Junções</button></div></div><div id="crop-control" class="crop-control hidden"><h3>Ajuste da imagem</h3><fieldset class="fit-options"><legend class="sr-only">Como ajustar a imagem ao pôster</legend><label class="mode"><input type="radio" name="image-fit" value="contain"/><span><strong>Imagem inteira</strong><small>Sem corte; espaço restante em branco.</small></span></label><label class="mode"><input type="radio" name="image-fit" value="cover"/><span><strong>Preencher o pôster</strong><small>Ocupa toda a área; pode cortar bordas.</small></span></label></fieldset><p id="crop-help"></p><div id="crop-adjustments"><div class="crop-label"><label for="crop-position" id="crop-axis">Posição horizontal</label><output for="crop-position" id="crop-value">50%</output></div><input id="crop-position" type="range" min="0" max="100" step="1" value="50" aria-describedby="crop-help crop-ends"/><div id="crop-ends" class="crop-ends"><span id="crop-start">Esquerda</span><span id="crop-end">Direita</span></div><button id="crop-reset" type="button">Centralizar</button></div></div><div id="seam-options" class="seam-options hidden" role="group" aria-label="Direção das junções"><button id="seam-vertical" type="button" aria-pressed="true">↔ Verticais</button><button id="seam-horizontal" type="button" aria-pressed="false">↕ Horizontais</button></div><div id="preview-content" class="preview-content"><div class="empty"><div class="empty-icon">▦</div><h3>Comece com uma imagem</h3><p>Depois de escolher o arquivo, você verá o pôster montado e cada folha antes de gerar o PDF.</p></div></div><div id="sheet-nav" class="sheet-nav hidden"><button id="prev-sheet" type="button">← Anterior</button><span id="sheet-counter"></span><button id="next-sheet" type="button">Próxima →</button></div><div id="seam-nav" class="sheet-nav hidden"><button id="prev-seam" type="button">← Anterior</button><span id="seam-counter" role="status" aria-live="polite"></span><button id="next-seam" type="button">Próxima →</button></div></section>
    <aside class="summary"><span class="eyebrow">RESUMO</span><h2>Pronto para imprimir</h2><div class="summary-card"><div><span>Divisão</span><strong id="summary-grid">2 × 2 folhas</strong></div><div><span>Papel</span><strong id="summary-paper">A4 · Paisagem</strong></div><div><span>Pôster montado</span><strong id="summary-size">—</strong></div><div><span>Qualidade da imagem</span><strong id="summary-dpi">—</strong></div></div><div id="physical-note" class="physical-note"></div><button id="download" class="primary" type="button" disabled>↓ Gerar PDF</button><p id="status" class="status" role="status"></p><div class="mini-note">Imprima em <strong>tamanho real (100%)</strong>. Desative “ajustar à página” no diálogo de impressão.</div></aside>
  </main>
  <section id="info-page" class="info-page hidden"></section>
  <div id="consent-banner" class="consent-banner hidden" role="region" aria-label="Permissão para análise de uso"><div><strong>Ajude a melhorar o MontaFolha</strong><p>Com sua permissão, contamos visitas com Google Analytics e enviamos códigos técnicos de erro. Imagens, PDFs, nomes de arquivos e detalhes dos erros não são enviados. Você pode mudar a escolha depois.</p><a href="#/privacidade">Entenda a privacidade</a></div><div class="consent-actions"><button id="consent-reject" type="button">Recusar</button><button id="consent-accept" type="button">Permitir</button></div></div>`;

const $ = s => app.querySelector(s);
const fmt = n => `${Math.round(n * 10) / 10}`.replace('.', ',');
let view = 'mosaic';
let currentLayout;
let cropRenderFrame = null;

function placementFor(l, image = state.image) {
  return imagePlacement(image.naturalWidth, image.naturalHeight, l.posterW, l.posterH, state.config.imageFit, state.cropPosition);
}

function updateCropControl(placement) {
  const { source } = placement;
  const spareX = state.image.naturalWidth - source.w;
  const spareY = state.image.naturalHeight - source.h;
  // Evita oferecer um controle quando a diferença de proporção é quase invisível.
  const hasCrop = placement.fit === 'cover' && Math.max(spareX / state.image.naturalWidth, spareY / state.image.naturalHeight) >= 0.01;
  const horizontal = spareX > spareY;
  $('#crop-help').textContent = placement.fit === 'contain'
    ? 'A imagem inteira fica centralizada. As áreas restantes serão brancas no PDF.'
    : hasCrop ? 'Mova o recorte para manter a parte importante da imagem no pôster.'
      : 'Não há recorte perceptível para ajustar nesta proporção.';
  $('#crop-adjustments').classList.toggle('hidden', !hasCrop);
  $('#crop-axis').textContent = horizontal ? 'Posição horizontal' : 'Posição vertical';
  $('#crop-start').textContent = horizontal ? 'Esquerda' : 'Topo';
  $('#crop-end').textContent = horizontal ? 'Direita' : 'Base';
  $('#crop-position').value = Math.round(state.cropPosition * 100);
  $('#crop-value').textContent = `${Math.round(state.cropPosition * 100)}%`;
  $('#crop-position').disabled = state.busy;
  $('#crop-reset').disabled = state.busy;
  app.querySelectorAll('input[name="image-fit"]').forEach(el => { el.disabled = state.busy; });
}

function setStatus(message, error = false) { $('#status').textContent = message; $('#status').classList.toggle('error', error); }
function saveConfig() { try { localStorage.setItem('montafolha-config', JSON.stringify(state.config)); } catch { reportError('storage_unavailable'); setStatus('Não foi possível guardar as configurações neste navegador.', true); } }
const pixCode = '00020126580014BR.GOV.BCB.PIX013662897130-e6bf-43c8-aa1c-33551be2e6835204000053039865802BR5925INOVAPROG DESENVOLVIMENTO6009SAO PAULO61080540900062250521P61bUEbLp00zJ84dx4hgd6304E808';
function renderInfoPage() {
  const route = location.hash === '#/apoiar' ? 'apoiar' : location.hash === '#/privacidade' ? 'privacidade' : 'home';
  $('.workspace').classList.toggle('hidden', route !== 'home');
  $('#info-page').classList.toggle('hidden', route === 'home');
  if (route === 'apoiar') {
    $('#info-page').innerHTML = `<a class="back-link" href="#/">← Voltar ao pôster</a><span class="eyebrow">APOIO AO PROJETO</span><h1>Ajude a manter o MontaFolha gratuito</h1><p>O MontaFolha é gratuito e de código aberto. Uma contribuição opcional ajuda a pagar a hospedagem e manter o projeto.</p><div class="support-grid"><div class="panel"><h2>Apoiar com Pix</h2><p>Copie o código abaixo no aplicativo do seu banco ou leia o QR Code. Escolha o valor no banco e confira o recebedor antes de confirmar.</p><label for="pix-code">Pix copia e cola</label><textarea id="pix-code" readonly>${pixCode}</textarea><button id="copy-pix" class="primary" type="button">Copiar código Pix</button><p id="pix-status" role="status"></p><p><strong>Recebedor:</strong> Inovaprog Desenvolvimento<br><strong>CNPJ:</strong> 64.420.635/0001-20</p><p>Chave Pix: <code>62897130-e6bf-43c8-aa1c-33551be2e683</code></p></div><div class="panel qr-panel"><img src="/pix-montafolha.svg" alt="QR Code Pix para apoiar o MontaFolha"/><p>O pagamento acontece apenas no seu banco. O MontaFolha não vê nem processa a contribuição.</p></div></div><p>Também pode ajudar com ideias e código no <a href="https://github.com/ewflaviano/montafolha">repositório do projeto</a>.</p>`;
    $('#copy-pix').addEventListener('click', async () => { try { await navigator.clipboard.writeText(pixCode); $('#pix-status').textContent = 'Código copiado. Cole no aplicativo do seu banco.'; } catch { $('#pix-status').textContent = 'Não foi possível copiar automaticamente. Selecione o código acima para copiar.'; $('#pix-code').focus(); $('#pix-code').select(); } });
  } else if (route === 'privacidade') {
    $('#info-page').innerHTML = `<a class="back-link" href="#/">← Voltar ao pôster</a><span class="eyebrow">PRIVACIDADE</span><h1>Seus arquivos ficam no navegador</h1><p>A imagem escolhida e o PDF são processados no seu dispositivo. O MontaFolha não os envia para a AWS nem para o Google. As configurações e a permissão de uso ficam no armazenamento local deste navegador.</p><h2>Google Analytics e diagnóstico</h2><p>Se você permitir, o navegador carrega o Google Analytics para contar visitas às páginas do MontaFolha. O mesmo aceite permite enviar à nossa API somente uma categoria e um código fixo de erro, com limite de envios. Não enviamos nome de arquivo, imagem, PDF, mensagem, stack, URL ou identificador do erro. A API grava contagens técnicas no CloudWatch por 30 dias. A infraestrutura de rede recebe os dados necessários para entregar a solicitação, como o IP.</p><p>Antes de aceitar ou após recusar, o script do Analytics não é carregado e o navegador não envia diagnósticos. Revogar interrompe novas medições e remove os cookies do Analytics acessíveis a este site. Dados já agregados no Google ou na AWS não podem ser retirados individualmente.</p><div class="panel"><h2>Sua escolha</h2><p id="consent-state"></p><div class="privacy-actions"><button id="privacy-accept" type="button">Permitir análise e diagnóstico</button><button id="privacy-reject" type="button">Recusar ou revogar</button></div><p id="privacy-status" role="status"></p></div><p>O app continua disponível independentemente dessa escolha. Para colaborar, veja o <a href="https://github.com/ewflaviano/montafolha/blob/main/CONTRIBUTING.md">guia de contribuição</a>.</p>`;
    updateConsentState();
    $('#privacy-accept').addEventListener('click', () => chooseConsent('accepted'));
    $('#privacy-reject').addEventListener('click', () => chooseConsent('rejected'));
  }
  pageView();
  window.scrollTo(0, 0);
}
function updateConsentState() { const el = $('#consent-state'); if (el) el.textContent = getChoice() === 'accepted' ? 'Você permitiu análise e diagnóstico.' : getChoice() === 'rejected' ? 'Você recusou análise e diagnóstico.' : 'Você ainda não escolheu.'; }
function updateConsentBanner() { $('#consent-banner').classList.toggle('hidden', getChoice() !== null); updateConsentState(); }
function chooseConsent(value) { if (!setChoice(value)) { const el = $('#privacy-status'); if (el) el.textContent = 'Não foi possível salvar sua escolha. A análise permanece desativada.'; return; } updateConsentBanner(); const el = $('#privacy-status'); if (el) el.textContent = value === 'accepted' ? 'Permissão salva.' : 'Permissão recusada. Novas medições foram interrompidas.'; }
function syncControls() {
  app.querySelectorAll('[data-key]').forEach(el => { const v = state.config[el.dataset.key]; if (el.type === 'checkbox') el.checked = !!v; else el.value = v; });
  app.querySelector(`input[name="mode"][value="${state.config.mode}"]`).checked = true;
  app.querySelector(`input[name="image-fit"][value="${state.config.imageFit}"]`).checked = true;
  $('#custom-paper').classList.toggle('hidden', state.config.paper !== 'Personalizado');
  $('#flap-settings').classList.toggle('hidden', state.config.mode !== 'flap');
  $('#fold-settings').classList.toggle('hidden', state.config.mode !== 'fold');
  $('#mode-tip').textContent = state.config.mode === 'zero' ? 'O PDF não terá margem. A impressora só imprimirá até a borda se oferecer modo sem bordas.' : state.config.mode === 'flap' ? 'Aba à esquerda e acima das novas folhas. A arte das folhas vizinhas precisa chegar à borda física; use impressora sem bordas.' : 'Dobre todas as faixas brancas para trás na linha pontilhada. Em encaixes internos, as duas folhas terão dobra.';
}

function drawPage(canvas, page, l, resolution = 2, markings = true, placement = null, image = state.image) {
  const scale = resolution;
  canvas.width = Math.round(l.W * scale);
  canvas.height = Math.round(l.H * scale);
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!image) return;
  const region = pageImageRegion(placement || placementFor(l, image), page);
  if (region) {
    const { source, paper } = region;
    ctx.drawImage(image, source.x, source.y, source.w, source.h, paper.x * scale, paper.y * scale, paper.w * scale, paper.h * scale);
  }
  if (markings && l.mode !== 'zero') {
    ctx.save(); ctx.strokeStyle = '#e27b56'; ctx.lineWidth = Math.max(1, scale * .22); ctx.setLineDash([2 * scale, 2 * scale]);
    ctx.strokeRect(page.art.x * scale, page.art.y * scale, page.art.w * scale, page.art.h * scale); ctx.restore();
  }
}

function sheetLabel(page) { return `folha ${page.number} · ${String.fromCharCode(65 + page.col)}${page.row + 1}`; }

function drawSeamPart(ctx, page, window, destination, placement) {
  const region = pageImageRegion(placement, page);
  if (!region) return;
  const { paper, source } = region;
  ctx.save();
  ctx.beginPath(); ctx.rect(destination.x, destination.y, destination.w, destination.h); ctx.clip();
  ctx.drawImage(state.image, source.x, source.y, source.w, source.h,
    destination.x + (paper.x - window.x) * destination.w / window.w,
    destination.y + (paper.y - window.y) * destination.h / window.h,
    paper.w * destination.w / window.w, paper.h * destination.h / window.h);
  ctx.restore();
}

function renderSeam(l, pair, placement) {
  const { first, second, firstWindow, secondWindow } = pair;
  const vertical = state.seamDirection === 'vertical';
  const width = vertical ? firstWindow.w + secondWindow.w : firstWindow.w;
  const height = vertical ? firstWindow.h : firstWindow.h + secondWindow.h;
  const scale = Math.min(3, 760 / width, 520 / height);
  const firstSize = Math.max(1, Math.round((vertical ? firstWindow.w : firstWindow.h) * scale));
  const secondSize = Math.max(1, Math.round((vertical ? secondWindow.w : secondWindow.h) * scale));
  const spanSize = Math.max(1, Math.round((vertical ? height : width) * scale));
  $('#preview-content').innerHTML = '<div class="seam-preview"><h3 id="seam-title"></h3><p>Compare as bordas da arte das folhas vizinhas.</p><div class="seam-canvas-wrap"><canvas id="seam-canvas" role="img"></canvas></div><div id="seam-labels" class="seam-labels"></div><p class="seam-warning">Esta é a junção digital. Imprima em tamanho real (100%) e confira as bordas físicas da impressora.</p></div>';
  $('#seam-title').textContent = `Emenda ${vertical ? 'vertical' : 'horizontal'}`;
  const canvas = $('#seam-canvas');
  canvas.width = vertical ? firstSize + secondSize : spanSize;
  canvas.height = vertical ? spanSize : firstSize + secondSize;
  canvas.setAttribute('aria-label', `Junção entre ${sheetLabel(first)} e ${sheetLabel(second)}; a linha laranja marca o encontro da arte.`);
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawSeamPart(ctx, first, firstWindow, { x: 0, y: 0, w: vertical ? firstSize : spanSize, h: vertical ? spanSize : firstSize }, placement);
  drawSeamPart(ctx, second, secondWindow, { x: vertical ? firstSize : 0, y: vertical ? 0 : firstSize, w: vertical ? secondSize : spanSize, h: vertical ? spanSize : secondSize }, placement);
  ctx.save(); ctx.strokeStyle = '#cf633f'; ctx.lineWidth = 2; ctx.setLineDash([7, 5]); ctx.beginPath();
  if (vertical) { ctx.moveTo(firstSize, 0); ctx.lineTo(firstSize, canvas.height); }
  else { ctx.moveTo(0, firstSize); ctx.lineTo(canvas.width, firstSize); }
  ctx.stroke(); ctx.restore();
  $('#seam-labels').textContent = `${sheetLabel(first)}  |  ${sheetLabel(second)}`;
}

function render() {
  syncControls();
  try { currentLayout = layout(state.config); setStatus(''); } catch (e) { currentLayout = null; setStatus(e.message, true); }
  const l = currentLayout;
  $('#crop-control').classList.toggle('hidden', !l || !state.image);
  $('#download').disabled = !l || !state.image || state.busy;
  if (!l) {
    $('#sheet-nav').classList.add('hidden');
    $('#seam-nav').classList.add('hidden');
    $('#preview-content').innerHTML = '<div class="empty"><h3>Confira as medidas do papel</h3><p>Corrija a configuração para ver a prévia.</p></div>';
    return;
  }
  const sheetNoun = l.pages.length === 1 ? 'folha' : 'folhas';
  $('#summary-grid').textContent = `${l.cols} × ${l.rows} ${sheetNoun}`;
  $('#summary-paper').textContent = `${state.config.paper} · ${state.config.orientation === 'landscape' ? 'Paisagem' : 'Retrato'}`;
  $('#summary-size').textContent = `${fmt(l.posterW / 10)} × ${fmt(l.posterH / 10)} cm`;
  $('#preview-title').textContent = `${l.cols} × ${l.rows} ${sheetNoun} · ${fmt(l.posterW / 10)} × ${fmt(l.posterH / 10)} cm`;
  if (state.image) {
    const placement = placementFor(l);
    updateCropControl(placement);
    const dpi = Math.round(Math.min(placement.source.w / (placement.poster.w / 25.4), placement.source.h / (placement.poster.h / 25.4)));
    $('#summary-dpi').innerHTML = `${dpi} DPI <em class="${dpi >= 150 ? 'good' : 'low'}">${dpi >= 150 ? 'Boa' : 'Baixa'}</em>`;
  } else $('#summary-dpi').textContent = '—';
  $('#physical-note').innerHTML = state.config.mode === 'zero'
    ? state.config.imageFit === 'contain'
      ? '<strong>Bordas físicas</strong><p>As áreas brancas fazem parte do pôster. Onde a imagem alcança a borda, a impressora precisa aceitar impressão sem bordas.</p>'
      : '<strong>Bordas físicas</strong><p>O arquivo ocupa a página inteira. Confira se sua impressora aceita impressão sem bordas.</p>'
    : state.config.mode === 'flap' ? '<strong>Uma aba por junção</strong><p>Cole a faixa branca da folha nova atrás da folha anterior. Este modo exige impressão sem bordas nas outras extremidades.</p>'
      : '<strong>Montagem sem corte</strong><p>Dobre as margens brancas para trás. Nos encaixes internos, dobre as duas folhas antes de aproximar as linhas da imagem.</p>';
  $('#sheet-nav').classList.toggle('hidden', view !== 'sheets' || !state.image);
  $('#seam-nav').classList.toggle('hidden', view !== 'seams' || !state.image);
  $('#seam-options').classList.toggle('hidden', view !== 'seams');
  for (const [id, name] of [['tab-mosaic', 'mosaic'], ['tab-sheets', 'sheets'], ['tab-seams', 'seams']]) {
    const active = view === name;
    $(`#${id}`).classList.toggle('active', active);
    $(`#${id}`).setAttribute('aria-pressed', String(active));
  }
  for (const [id, direction] of [['seam-vertical', 'vertical'], ['seam-horizontal', 'horizontal']]) {
    $(`#${id}`).setAttribute('aria-pressed', String(state.seamDirection === direction));
  }
  if (!state.image) {
    $('#seam-nav').classList.add('hidden');
    $('#preview-content').innerHTML = '<div class="empty"><div class="empty-icon">▦</div><h3>Comece com uma imagem</h3><p>Depois de escolher o arquivo, você poderá conferir o pôster, as folhas e as junções antes de gerar o PDF.</p></div>';
    return;
  }
  if (view === 'mosaic') {
    $('#preview-content').innerHTML = '<div class="mosaic-wrap"><canvas id="mosaic"></canvas></div><div class="preview-caption">As linhas mostram onde as folhas se encontram.</div>';
    const canvas = $('#mosaic'); const scale = Math.min(1.3, 740 / l.posterW, 490 / l.posterH);
    canvas.width = Math.max(1, Math.round(l.posterW * scale)); canvas.height = Math.max(1, Math.round(l.posterH * scale));
    const ctx = canvas.getContext('2d'); const placement = placementFor(l);
    const { source, poster } = placement;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(state.image, source.x, source.y, source.w, source.h, poster.x * canvas.width / l.posterW, poster.y * canvas.height / l.posterH, poster.w * canvas.width / l.posterW, poster.h * canvas.height / l.posterH);
    ctx.strokeStyle = 'rgba(35,95,96,.85)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
    l.pages.forEach(p => ctx.strokeRect(p.source.x * scale, p.source.y * scale, p.source.w * scale, p.source.h * scale));
  } else if (view === 'sheets') {
    state.selected = Math.min(state.selected, l.pages.length - 1);
    const page = l.pages[state.selected];
    $('#preview-content').innerHTML = '<div class="sheet-wrap"><canvas id="sheet"></canvas></div><div class="preview-caption">Linha laranja: dobre a faixa branca ou use como aba, conforme o modo.</div>';
    drawPage($('#sheet'), page, l, Math.min(2, 620 / l.W, 470 / l.H));
    $('#sheet-counter').textContent = `Folha ${page.number} de ${l.pages.length} · coluna ${page.col + 1}, linha ${page.row + 1}`;
  } else {
    const pairs = seamPairs(l, state.seamDirection);
    state.seamIndex = Math.min(state.seamIndex, Math.max(0, pairs.length - 1));
    $('#seam-nav').classList.toggle('hidden', pairs.length === 0);
    if (!pairs.length) {
      $('#preview-content').innerHTML = `<div class="empty"><div class="empty-icon">▦</div><h3>Sem junções ${state.seamDirection === 'vertical' ? 'verticais' : 'horizontais'}</h3><p>${state.seamDirection === 'vertical' ? 'Use pelo menos duas colunas' : 'Use pelo menos duas linhas'} para conferir uma emenda nesta direção.</p></div>`;
      return;
    }
    renderSeam(l, pairs[state.seamIndex], placementFor(l));
    $('#seam-counter').textContent = `Junção ${state.seamIndex + 1} de ${pairs.length}`;
  }
}

async function loadFile(file) {
  if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setStatus('Escolha uma imagem PNG, JPEG ou WebP.', true); return; }
  if (file.size > 80 * 1024 * 1024) { setStatus('Imagem acima de 80 MB. Escolha um arquivo menor.', true); return; }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { state.image = img; state.name = file.name; state.cropPosition = 0.5; $('#file-name').textContent = file.name; $('#image-meta').textContent = `${img.naturalWidth} × ${img.naturalHeight} px`; render(); };
  img.onerror = () => { URL.revokeObjectURL(url); reportError('image_decode_failed'); setStatus('Não foi possível ler a imagem.', true); };
  img.src = url;
}

const mmToPt = mm => mm * 72 / 25.4;

async function addAssemblyGuide(pdf, l, placement = placementFor(l), image = state.image) {
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
  const { source, poster } = placement;
  ctx.drawImage(image, source.x, source.y, source.w, source.h, poster.x * canvas.width / l.posterW, poster.y * canvas.height / l.posterH, poster.w * canvas.width / l.posterW, poster.h * canvas.height / l.posterH);
  const thumbnail = await pdf.embedJpg(await (await fetch(canvas.toDataURL('image/jpeg', .86))).arrayBuffer());
  guide.drawImage(thumbnail, { x: gridX, y: gridY, width: gridW, height: gridH });

  for (const tile of l.pages) {
    const x = gridX + tile.source.x * scale;
    const y = gridY + gridH - (tile.source.y + tile.source.h) * scale;
    const w = tile.source.w * scale;
    const h = tile.source.h * scale;
    guide.drawRectangle({ x, y, width: w, height: h, borderColor: rgb(.38, .55, .57), borderWidth: 1 });
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
    l.mode === 'zero' && placement.fit === 'contain' ? '4. Areas brancas sao intencionais; use sem bordas onde houver arte.' :
      l.mode === 'zero' ? '4. Use impressao sem bordas para evitar faixas brancas.' :
      l.mode === 'flap' ? '4. Cole a aba branca atras da folha anterior; use sem bordas.' :
        '4. Dobre as faixas brancas para tras. Junte as bordas impressas.',
  ];
  instructions.forEach((line, i) => guide.drawText(line, { x: 48, y: 118 - i * 21, size: 9.4, font: regular, color: ink }));
}

async function downloadPdf() {
  if (!state.image || !currentLayout || state.busy) return;
  state.busy = true; $('#download').disabled = true; $('#download').textContent = 'Gerando PDF…'; setStatus('Preparando as folhas no seu dispositivo…');
  $('#crop-position').disabled = true; $('#crop-reset').disabled = true;
  app.querySelectorAll('input[name="image-fit"]').forEach(el => { el.disabled = true; });
  try {
    const l = currentLayout; const image = state.image; const placement = placementFor(l, image);
    const includeGuide = state.config.guide; const paper = state.config.paper;
    const pdf = await PDFDocument.create();
    for (const page of l.pages) {
      const canvas = document.createElement('canvas');
      // 150 DPI para limitar uso de memória; nunca altera as medidas físicas.
      drawPage(canvas, page, l, 150 / 25.4, false, placement, image);
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
    if (includeGuide) await addAssemblyGuide(pdf, l, placement, image);
    const bytes = await pdf.save(); const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const a = document.createElement('a'); a.href = url; a.download = `montafolha-${l.cols}x${l.rows}-${paper.toLowerCase()}.pdf`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    setStatus(`PDF gerado: ${l.pages.length} ${l.pages.length === 1 ? 'folha' : 'folhas'}${includeGuide ? ' + guia' : ''}.`);
  } catch (e) { console.error(e); reportError('pdf_generation_failed'); setStatus('Falha ao gerar PDF. Tente uma imagem menor ou outra configuração.', true); }
  finally { state.busy = false; $('#download').textContent = '↓ Gerar PDF'; $('#download').disabled = !state.image || !currentLayout; $('#crop-position').disabled = false; $('#crop-reset').disabled = false; app.querySelectorAll('input[name="image-fit"]').forEach(el => { el.disabled = false; }); }
}

app.addEventListener('change', e => {
  if (e.target.dataset.key) {
    const key = e.target.dataset.key; state.config[key] = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    saveConfig(); render();
  }
  if (e.target.name === 'mode') { state.config.mode = e.target.value; saveConfig(); render(); }
  if (e.target.name === 'image-fit') { state.config.imageFit = e.target.value; saveConfig(); render(); }
});
$('#file').addEventListener('change', e => loadFile(e.target.files[0]));
$('#crop-position').addEventListener('input', e => {
  state.cropPosition = Number(e.target.value) / 100;
  $('#crop-value').textContent = `${e.target.value}%`;
  if (cropRenderFrame !== null) return;
  cropRenderFrame = requestAnimationFrame(() => { cropRenderFrame = null; render(); });
});
$('#crop-reset').addEventListener('click', () => { state.cropPosition = 0.5; render(); $('#crop-position').focus(); });
$('#try-example').addEventListener('click', () => {
  const img = new Image();
  img.onload = () => { state.image = img; state.name = 'exemplo-grade.png'; state.cropPosition = 0.5; $('#file-name').textContent = 'Imagem de exemplo'; $('#image-meta').textContent = `${img.naturalWidth} × ${img.naturalHeight} px`; render(); };
  img.onerror = () => { reportError('example_load_failed'); setStatus('Não foi possível carregar a imagem de exemplo.', true); };
  img.src = '/exemplo-grade.png';
});
$('.upload').addEventListener('dragover', e => { e.preventDefault(); $('.upload').classList.add('drag'); });
$('.upload').addEventListener('dragleave', () => $('.upload').classList.remove('drag'));
$('.upload').addEventListener('drop', e => { e.preventDefault(); $('.upload').classList.remove('drag'); loadFile(e.dataTransfer.files[0]); });
$('#tab-mosaic').addEventListener('click', () => { view = 'mosaic'; render(); });
$('#tab-sheets').addEventListener('click', () => { view = 'sheets'; render(); });
$('#tab-seams').addEventListener('click', () => { view = 'seams'; render(); });
$('#seam-vertical').addEventListener('click', () => { state.seamDirection = 'vertical'; state.seamIndex = 0; render(); });
$('#seam-horizontal').addEventListener('click', () => { state.seamDirection = 'horizontal'; state.seamIndex = 0; render(); });
$('#prev-seam').addEventListener('click', () => { const count = currentLayout ? seamPairs(currentLayout, state.seamDirection).length : 0; if (count) { state.seamIndex = (state.seamIndex - 1 + count) % count; render(); } });
$('#next-seam').addEventListener('click', () => { const count = currentLayout ? seamPairs(currentLayout, state.seamDirection).length : 0; if (count) { state.seamIndex = (state.seamIndex + 1) % count; render(); } });
$('#prev-sheet').addEventListener('click', () => { state.selected = (state.selected - 1 + currentLayout.pages.length) % currentLayout.pages.length; render(); });
$('#next-sheet').addEventListener('click', () => { state.selected = (state.selected + 1) % currentLayout.pages.length; render(); });
$('#download').addEventListener('click', downloadPdf);
$('#consent-accept').addEventListener('click', () => chooseConsent('accepted'));
$('#consent-reject').addEventListener('click', () => chooseConsent('rejected'));
window.addEventListener('usage-choice-changed', updateConsentBanner);
window.addEventListener('hashchange', renderInfoPage);
render();
renderInfoPage();
updateConsentBanner();
