/**
 * VCL-Light Main Application Controller
 * (주)일신비츠온 올인원 콘텐츠 제작 스튜디오
 */
import { CONFIG } from './config.js';
import { productService } from './productService.js';
import { geminiService } from './geminiService.js';
import { templateService } from './templateService.js';
import { scriptService } from './scriptService.js';
import { firebaseService } from './firebaseService.js';

class AppController {
  constructor() {
    this.currentView = 'studio';
    this.currentEditorTab = 'script';
    this.currentDetailTab = 'specs';
    this.saveDebounceTimer = null;
  }

  async init() {
    console.log('Starting VCL-Light...');
    this.bindEvents();

    // Load initial data
    await productService.loadCatalog();
    await templateService.loadTemplates();
    await scriptService.loadAllScripts();

    // Render components
    this.renderRecommendations('all');
    this.renderTemplateDropdown();
    this.updateEditorUI();
    this.renderStorageList();
    this.renderTemplateList();

    // Auto-select first recommendation if available
    const recs = productService.currentRecommendations;
    if (recs && recs.length > 0) {
      this.selectProduct(recs[0]);
    }

    this.showToast('VCL-Light 스튜디오 준비 완료! (비츠온MRO 정품 카탈로그 로드됨)', 'success');
  }

  /* ================== EVENT BINDINGS ================== */
  bindEvents() {
    // Navigation Tabs
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = btn.dataset.view;
        this.switchView(view);
      });
    });

    // Brand Filter Pills
    document.querySelectorAll('.filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const filter = pill.dataset.filter;
        this.renderRecommendations(filter);
      });
    });

    // Re-roll Button
    const btnReroll = document.getElementById('btnReroll');
    if (btnReroll) {
      btnReroll.addEventListener('click', () => {
        const activeFilter = document.querySelector('.filter-pill.active')?.dataset.filter || 'all';
        this.renderRecommendations(activeFilter);
        this.showToast('새로운 추천 아이템 5종을 불러왔습니다! 🎲');
      });
    }

    // Product Search
    const searchInput = document.getElementById('productSearchInput');
    const btnSearch = document.getElementById('btnSearchProduct');
    if (btnSearch && searchInput) {
      const doSearch = () => {
        const q = searchInput.value.trim();
        if (!q) {
          this.renderRecommendations('all');
          return;
        }
        const results = productService.search(q);
        if (results.length > 0) {
          productService.currentRecommendations = results.slice(0, 5);
          this.renderRecommendationCards(productService.currentRecommendations);
          this.selectProduct(results[0]);
          this.showToast(`검색 결과 ${results.length}건 중 상위 5건을 표시합니다.`);
        } else {
          this.showToast('검색 결과가 없습니다. 비츠온MRO 추천 제품을 유지합니다.', 'error');
        }
      };
      btnSearch.addEventListener('click', doSearch);
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doSearch();
      });
    }

    // Product Detail Tabs
    document.querySelectorAll('.detail-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.detail-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.detail-tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        const target = document.getElementById(`detailTab_${tab}`);
        if (target) target.classList.add('active');
        this.currentDetailTab = tab;
      });
    });

    // Insert Specs Button in Detail Panel
    const btnInsertSpecs = document.getElementById('btnInsertSpecs');
    if (btnInsertSpecs) {
      btnInsertSpecs.addEventListener('click', () => {
        this.insertSpecsIntoScript();
      });
    }

    // AI Analysis Run Button
    const btnRunAiAnalysis = document.getElementById('btnRunAiAnalysis');
    if (btnRunAiAnalysis) {
      btnRunAiAnalysis.addEventListener('click', () => {
        this.runAiProductAnalysis();
      });
    }

    // Script Title & Status
    const scriptTitleInput = document.getElementById('scriptTitleInput');
    if (scriptTitleInput) {
      scriptTitleInput.addEventListener('input', (e) => {
        scriptService.updateCurrent({ title: e.target.value });
        this.debounceAutoSave();
      });
    }

    const scriptStatusSelect = document.getElementById('scriptStatusSelect');
    if (scriptStatusSelect) {
      scriptStatusSelect.addEventListener('change', (e) => {
        scriptService.updateCurrent({ status: e.target.value });
        this.debounceAutoSave();
      });
    }

    // Script Content Editor
    const scriptContent = document.getElementById('scriptContent');
    if (scriptContent) {
      scriptContent.addEventListener('input', (e) => {
        scriptService.updateCurrent({ content: e.target.value });
        this.updateStats();
        this.debounceAutoSave();
      });
    }

    // Notepad Content Editor
    const notepadContent = document.getElementById('notepadContent');
    if (notepadContent) {
      notepadContent.addEventListener('input', (e) => {
        scriptService.updateCurrent({ notes: e.target.value });
        this.debounceAutoSave();
      });
    }

    // Save Script Button
    const btnSaveScript = document.getElementById('btnSaveScript');
    if (btnSaveScript) {
      btnSaveScript.addEventListener('click', async () => {
        await this.saveCurrentScriptExplicit();
      });
    }

    // Studio Action Toolbar Buttons
    const btnToolbarInsertSpecs = document.getElementById('btnToolbarInsertSpecs');
    if (btnToolbarInsertSpecs) {
      btnToolbarInsertSpecs.addEventListener('click', () => this.insertSpecsIntoScript());
    }

    const templateSelectDropdown = document.getElementById('templateSelectDropdown');
    if (templateSelectDropdown) {
      templateSelectDropdown.addEventListener('change', (e) => {
        const tplId = e.target.value;
        if (!tplId) return;
        this.applyTemplateToScript(tplId);
        e.target.value = ''; // reset dropdown
      });
    }

    const btnAiShorts = document.getElementById('btnAiShorts');
    if (btnAiShorts) {
      btnAiShorts.addEventListener('click', () => this.generateAiShortsScript());
    }

    const btnAiLongform = document.getElementById('btnAiLongform');
    if (btnAiLongform) {
      btnAiLongform.addEventListener('click', () => this.generateAiLongFormScript());
    }

    const btnAiSubtitles = document.getElementById('btnAiSubtitles');
    if (btnAiSubtitles) {
      btnAiSubtitles.addEventListener('click', () => this.generateSubtitles());
    }

    const btnAiVideoPrompts = document.getElementById('btnAiVideoPrompts');
    if (btnAiVideoPrompts) {
      btnAiVideoPrompts.addEventListener('click', () => this.generateVideoPrompts());
    }

    const btnExportTxt = document.getElementById('btnExportTxt');
    if (btnExportTxt) {
      btnExportTxt.addEventListener('click', () => scriptService.exportScript('txt'));
    }

    const btnExportMd = document.getElementById('btnExportMd');
    if (btnExportMd) {
      btnExportMd.addEventListener('click', () => scriptService.exportScript('md'));
    }

    const btnCopyScript = document.getElementById('btnCopyScript');
    if (btnCopyScript) {
      btnCopyScript.addEventListener('click', () => {
        const text = scriptService.currentScript.content;
        if (!text) {
          this.showToast('복사할 대본 내용이 없습니다.', 'error');
          return;
        }
        navigator.clipboard.writeText(text);
        this.showToast('대본이 클립보드에 복사되었습니다! 📋', 'success');
      });
    }

    // Studio Editor Sub-Tabs
    document.querySelectorAll('.editor-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.editor-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.editor-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        const target = document.getElementById(`editorPane_${tab}`);
        if (target) target.classList.add('active');
        this.currentEditorTab = tab;
      });
    });

    // New Script Button
    const btnNewScript = document.getElementById('btnNewScript');
    if (btnNewScript) {
      btnNewScript.addEventListener('click', () => {
        scriptService.currentScript = scriptService.createNewScript(productService.currentSelected);
        this.updateEditorUI();
        this.switchView('studio');
        this.showToast('새 대본을 생성했습니다.');
      });
    }

    // Storage Search
    const storageSearchInput = document.getElementById('storageSearchInput');
    if (storageSearchInput) {
      storageSearchInput.addEventListener('input', (e) => {
        this.renderStorageList(e.target.value);
      });
    }

    // Template Modal Events
    const btnOpenNewTemplateModal = document.getElementById('btnOpenNewTemplateModal');
    const templateModal = document.getElementById('templateModal');
    const btnCloseTemplateModal = document.getElementById('btnCloseTemplateModal');
    const btnSaveTemplate = document.getElementById('btnSaveTemplate');

    if (btnOpenNewTemplateModal && templateModal) {
      btnOpenNewTemplateModal.addEventListener('click', () => {
        document.getElementById('templateModalTitle').textContent = '새 템플릿 등록';
        document.getElementById('tplInputId').value = '';
        document.getElementById('tplInputTitle').value = '';
        document.getElementById('tplInputCategory').value = '비츠온/숏폼';
        document.getElementById('tplInputDesc').value = '';
        document.getElementById('tplInputContent').value = '';
        templateModal.classList.add('active');
      });
    }

    if (btnCloseTemplateModal && templateModal) {
      btnCloseTemplateModal.addEventListener('click', () => {
        templateModal.classList.remove('active');
      });
    }

    if (btnSaveTemplate) {
      btnSaveTemplate.addEventListener('click', async () => {
        const id = document.getElementById('tplInputId').value;
        const title = document.getElementById('tplInputTitle').value.trim();
        const category = document.getElementById('tplInputCategory').value.trim();
        const description = document.getElementById('tplInputDesc').value.trim();
        const content = document.getElementById('tplInputContent').value.trim();

        if (!title || !content) {
          alert('템플릿 제목과 본문을 입력해주세요.');
          return;
        }

        if (id) {
          await templateService.updateTemplate(id, { title, category, description, content });
          this.showToast('템플릿이 수정되었습니다.', 'success');
        } else {
          await templateService.createTemplate({ title, category, description, content });
          this.showToast('새 템플릿이 등록되었습니다.', 'success');
        }

        templateModal.classList.remove('active');
        this.renderTemplateList();
        this.renderTemplateDropdown();
      });
    }
  }

  /* ================== NAVIGATION & VIEWS ================== */
  switchView(viewName) {
    this.currentView = viewName;
    document.querySelectorAll('.nav-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.view === viewName);
    });
    document.querySelectorAll('.app-view').forEach(v => {
      v.classList.remove('active');
    });
    const target = document.getElementById(`view_${viewName}`);
    if (target) target.classList.add('active');

    if (viewName === 'storage') {
      this.renderStorageList();
    } else if (viewName === 'templates') {
      this.renderTemplateList();
    }
  }

  /* ================== RECOMMENDATION SYSTEM ================== */
  renderRecommendations(filter = 'all') {
    const items = productService.getRandom5(filter);
    this.renderRecommendationCards(items);
  }

  renderRecommendationCards(items) {
    const strip = document.getElementById('recCardsStrip');
    if (!strip) return;
    strip.innerHTML = '';

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'rec-card';
      if (productService.currentSelected?.productCode === item.productCode) {
        card.classList.add('selected');
      }

      let badgeClass = 'badge-mro';
      if (item.brandNm === '비츠온') badgeClass = 'badge-vitson';
      else if (item.brandNm === '홈빛') badgeClass = 'badge-homevit';

      const thumbUrl = item.pictureNm || './images/preparing.jpg';

      card.innerHTML = `
        <div class="rec-card-thumb">
          <img src="${thumbUrl}" alt="${item.productNm}" onerror="this.src='https://vitsonimg.co.kr/images/productsNew/preparing.jpg'" />
        </div>
        <span class="rec-brand-badge ${badgeClass}">${item.brandNm}</span>
        <div class="rec-card-name" title="${item.productNm}">${item.productNm}</div>
        <div class="rec-card-standard" title="${item.standard || ''}">${item.standard || item.modelName || '기본 규격'}</div>
      `;

      card.addEventListener('click', () => {
        this.selectProduct(item);
      });

      strip.appendChild(card);
    });
  }

  selectProduct(product) {
    productService.currentSelected = product;

    // Update active highlight in cards
    document.querySelectorAll('.rec-card').forEach(c => c.classList.remove('selected'));
    const allCards = document.querySelectorAll('.rec-card');
    const idx = productService.currentRecommendations.findIndex(p => p.productCode === product.productCode);
    if (idx >= 0 && allCards[idx]) {
      allCards[idx].classList.add('selected');
    }

    // Render detail panel
    this.renderProductDetail(product);

    // Link product to current script if new or empty
    if (!scriptService.currentScript.product || !scriptService.currentScript.content) {
      scriptService.updateCurrent({
        product: {
          productCode: product.productCode,
          productNm: product.productNm,
          brandNm: product.brandNm,
          standard: product.standard,
          modelName: product.modelName,
          pictureNm: product.pictureNm
        },
        title: `[${product.brandNm}] ${product.productNm} 콘텐츠 기획`
      });
      this.updateEditorUI();
    }
  }

  renderProductDetail(product) {
    const detailPanel = document.getElementById('productDetailPanel');
    if (!detailPanel) return;

    let badgeClass = 'badge-mro';
    if (product.brandNm === '비츠온') badgeClass = 'badge-vitson';
    else if (product.brandNm === '홈빛') badgeClass = 'badge-homevit';

    document.getElementById('detailMainImg').src = product.pictureNm || 'https://vitsonimg.co.kr/images/productsNew/preparing.jpg';
    document.getElementById('detailBrandBadge').className = `detail-brand-badge ${badgeClass}`;
    document.getElementById('detailBrandBadge').textContent = product.brandNm;
    document.getElementById('detailTitle').textContent = product.productNm;
    document.getElementById('detailStandard').textContent = `규격: ${product.standard || '기본 규격'}`;
    document.getElementById('detailModel').textContent = `모델명: ${product.modelName || 'N/A'}`;
    document.getElementById('detailCode').textContent = `상품코드: ${product.productCode}`;

    const mroLink = document.getElementById('btnMroView');
    if (mroLink) {
      mroLink.href = `https://vitsonmro.com/mro/shop/productDetail.do?productCode=${product.productCode}`;
    }

    // Render Specs Table
    const tbody = document.getElementById('specsTableBody');
    if (tbody) {
      tbody.innerHTML = '';
      const baseSpecs = [
        { label: '브랜드', value: product.brandNm },
        { label: '품명', value: product.productNm },
        { label: '규격', value: product.standard || '-' },
        { label: '모델명', value: product.modelName || '-' },
        { label: '카테고리', value: `${product.category1 || ''} > ${product.category2 || ''}` },
        { label: '제조사/공급', value: product.maker || '(주)일신비츠온' }
      ];

      if (product.specs) {
        for (const [k, v] of Object.entries(product.specs)) {
          if (v && v !== '해당사항없음' && !baseSpecs.some(b => b.label === k)) {
            baseSpecs.push({ label: k, value: v });
          }
        }
      }

      baseSpecs.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<th>${s.label}</th><td>${s.value}</td>`;
        tbody.appendChild(tr);
      });
    }

    // Render Detail Images
    const imgGallery = document.getElementById('detailImagesGallery');
    if (imgGallery) {
      imgGallery.innerHTML = '';
      if (product.detailImages && product.detailImages.length > 0) {
        product.detailImages.forEach(imgUrl => {
          const img = document.createElement('img');
          img.className = 'detail-gallery-img';
          img.src = imgUrl;
          img.alt = product.productNm;
          imgGallery.appendChild(img);
        });
      } else {
        imgGallery.innerHTML = `
          <div style="grid-column: 1 / -1; padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
            등록된 상세페이지 추가 이미지가 없습니다.<br>
            <a href="https://vitsonmro.com/mro/shop/productDetail.do?productCode=${product.productCode}" target="_blank" style="color: #60a5fa; text-decoration: underline; margin-top: 6px; display: inline-block;">
              비츠온MRO 공식 상세페이지에서 바로 보기 ↗
            </a>
          </div>
        `;
      }
    }

    // Reset AI Box to ready state
    const aiOutput = document.getElementById('aiAnalysisResult');
    if (aiOutput) {
      aiOutput.innerHTML = `
        <div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 0.85rem;">
          아래 <strong>[Gemini AI 제품 분석 실행]</strong> 버튼을 누르면<br>
          스펙 기반 핵심 셀링포인트, 타겟층, 바이럴 훅 5종이 도출됩니다.
        </div>
      `;
    }
  }

  /* ================== GEMINI AI CALLS ================== */
  async runAiProductAnalysis() {
    const product = productService.currentSelected;
    if (!product) {
      this.showToast('먼저 분석할 제품을 선택해주세요.', 'error');
      return;
    }

    const aiOutput = document.getElementById('aiAnalysisResult');
    const btn = document.getElementById('btnRunAiAnalysis');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Gemini가 제원 분석 중...`;

    try {
      const res = await geminiService.analyzeProduct(product);
      this.renderAiAnalysisResult(res);
      this.showToast('AI 분석이 완료되었습니다!', 'success');
    } catch (e) {
      console.error(e);
      this.showToast('AI 분석 중 오류가 발생했습니다: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `✨ Gemini AI 제품 분석 실행`;
    }
  }

  renderAiAnalysisResult(res) {
    const aiOutput = document.getElementById('aiAnalysisResult');
    if (!aiOutput) return;

    let hooksHtml = '';
    if (res.viralHooks && res.viralHooks.length > 0) {
      hooksHtml = res.viralHooks.map(h => `
        <div class="viral-hook-item">
          <span>${h}</span>
          <button class="btn-copy-hook" onclick="window.vclApp.copyText('${h.replace(/'/g, "\\'")}')">복사</button>
        </div>
      `).join('');
    }

    let sellingPointsHtml = '';
    if (res.sellingPoints) {
      sellingPointsHtml = res.sellingPoints.map(sp => `<li>${sp}</li>`).join('');
    }

    aiOutput.innerHTML = `
      <div class="ai-card-block">
        <h4>💡 1줄 핵심 요약</h4>
        <p style="font-size: 0.88rem; color: #fff; font-weight: 600;">${res.oneLineSummary || ''}</p>
      </div>

      <div class="ai-card-block">
        <h4>🎯 추천 타겟 고객</h4>
        <p style="font-size: 0.82rem; color: #93c5fd;">${res.targetAudience || ''}</p>
      </div>

      <div class="ai-card-block">
        <h4>⭐ 스펙 기반 핵심 셀링포인트 (USP)</h4>
        <ul>${sellingPointsHtml}</ul>
      </div>

      <div class="ai-card-block">
        <h4>🔥 숏폼/릴스 추천 바이럴 훅 (Hook 5선)</h4>
        <div style="margin-top: 8px;">${hooksHtml}</div>
      </div>
    `;
  }

  async generateAiShortsScript() {
    const product = productService.currentSelected;
    if (!product) {
      this.showToast('먼저 제품을 선택해주세요.', 'error');
      return;
    }

    const btn = document.getElementById('btnAiShorts');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> 대본 작성 중...`;

    try {
      const scriptText = await geminiService.generateShortsScript(product, null, scriptService.currentScript.notes);
      scriptService.updateCurrent({ content: scriptText });
      this.updateEditorUI();
      this.showToast('1분 쇼츠 대본 초안이 생성되었습니다! 🎬', 'success');
      this.saveCurrentScriptExplicit();
    } catch (e) {
      this.showToast('대본 생성 실패: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `⚡ AI 쇼츠 대본 (1분)`;
    }
  }

  async generateAiLongFormScript() {
    const product = productService.currentSelected;
    if (!product) {
      this.showToast('먼저 제품을 선택해주세요.', 'error');
      return;
    }

    const btn = document.getElementById('btnAiLongform');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> 롱폼 작성 중...`;

    try {
      const scriptText = await geminiService.generateLongFormScript(product, null, scriptService.currentScript.notes);
      scriptService.updateCurrent({ content: scriptText });
      this.updateEditorUI();
      this.showToast('유튜브 롱폼 리뷰 대본이 생성되었습니다! 🎥', 'success');
      this.saveCurrentScriptExplicit();
    } catch (e) {
      this.showToast('대본 생성 실패: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `🎥 AI 롱폼 대본`;
    }
  }

  async generateSubtitles() {
    const content = scriptService.currentScript.content;
    if (!content || !content.trim()) {
      this.showToast('먼저 대본을 작성하거나 생성해주세요.', 'error');
      return;
    }

    const btn = document.getElementById('btnAiSubtitles');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> 자막 분할 중...`;

    try {
      const subtitles = await geminiService.generateSubtitles(content);
      scriptService.updateCurrent({ subtitles });
      document.getElementById('subtitlesOutput').textContent = subtitles;
      
      // Switch to subtitles tab
      this.switchEditorTab('subtitles');
      this.showToast('자막 타임라인 분할 완료! 📝', 'success');
    } catch (e) {
      this.showToast('자막 분할 실패: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `💬 자막 분할`;
    }
  }

  async generateVideoPrompts() {
    const product = productService.currentSelected;
    const content = scriptService.currentScript.content;
    if (!product || !content) {
      this.showToast('제품 선택 및 대본 작성이 필요합니다.', 'error');
      return;
    }

    const btn = document.getElementById('btnAiVideoPrompts');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> 프롬프트 생성 중...`;

    try {
      const videoPrompts = await geminiService.generateVideoPrompts(product, content);
      scriptService.updateCurrent({ videoPrompts });
      document.getElementById('videoPromptsOutput').textContent = videoPrompts;
      
      // Switch to video prompts tab
      this.switchEditorTab('prompts');
      this.showToast('AI 비디오 프롬프트 생성 완료! 🤖', 'success');
    } catch (e) {
      this.showToast('프롬프트 생성 실패: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `🤖 AI 영상 프롬프트`;
    }
  }

  /* ================== EDITOR INTERACTIONS ================== */
  insertSpecsIntoScript() {
    const product = productService.currentSelected;
    if (!product) {
      this.showToast('선택된 제품이 없습니다.', 'error');
      return;
    }

    const specsText = productService.getSpecsSummaryText(product);
    const scriptEditor = document.getElementById('scriptContent');
    const curVal = scriptEditor.value;
    const newVal = curVal ? `${curVal}\n\n[제품 제원 요약]\n${specsText}` : `[제품 제원 요약]\n${specsText}`;
    scriptService.updateCurrent({ content: newVal });
    this.updateEditorUI();
    this.showToast('스펙 요약이 대본에 추가되었습니다.');
  }

  applyTemplateToScript(templateId) {
    const tpl = templateService.getById(templateId);
    const product = productService.currentSelected;
    if (!tpl) return;

    let appliedContent = tpl.content;
    if (product) {
      appliedContent = templateService.applyVariables(tpl.content, product);
    }

    const scriptEditor = document.getElementById('scriptContent');
    scriptService.updateCurrent({ content: appliedContent });
    this.updateEditorUI();
    this.showToast(`[${tpl.title}] 템플릿이 적용되었습니다! 📑`, 'success');
    this.debounceAutoSave();
  }

  switchEditorTab(tabName) {
    document.querySelectorAll('.editor-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tabName);
    });
    document.querySelectorAll('.editor-pane').forEach(p => {
      p.classList.remove('active');
    });
    const target = document.getElementById(`editorPane_${tabName}`);
    if (target) target.classList.add('active');
    this.currentEditorTab = tabName;
  }

  updateEditorUI() {
    const s = scriptService.currentScript;
    const titleInput = document.getElementById('scriptTitleInput');
    const statusSelect = document.getElementById('scriptStatusSelect');
    const scriptContent = document.getElementById('scriptContent');
    const notepadContent = document.getElementById('notepadContent');
    const subtitlesOutput = document.getElementById('subtitlesOutput');
    const videoPromptsOutput = document.getElementById('videoPromptsOutput');

    if (titleInput) titleInput.value = s.title || '';
    if (statusSelect) statusSelect.value = s.status || 'planning';
    if (scriptContent) scriptContent.value = s.content || '';
    if (notepadContent) notepadContent.value = s.notes || '';
    if (subtitlesOutput) subtitlesOutput.textContent = s.subtitles || '대본 툴바의 [자막 분할] 버튼을 누르면 타임라인 자막이 생성됩니다.';
    if (videoPromptsOutput) videoPromptsOutput.textContent = s.videoPrompts || '대본 툴바의 [AI 영상 프롬프트] 버튼을 누르면 Runway/Kling용 프롬프트가 생성됩니다.';

    this.updateStats();
  }

  updateStats() {
    const content = scriptService.currentScript.content || '';
    const stats = scriptService.calculateStats(content);

    const charCountEl = document.getElementById('statCharCount');
    const durationEl = document.getElementById('statDuration');
    const badgeEl = document.getElementById('statBadge');
    const progressFill = document.getElementById('statProgressFill');

    if (charCountEl) charCountEl.textContent = `${stats.charCountWithSpaces}자`;
    if (durationEl) durationEl.textContent = stats.timeFormatted;
    if (badgeEl) {
      badgeEl.textContent = stats.recommendation;
      badgeEl.style.color = stats.progressColor;
    }
    if (progressFill) {
      progressFill.style.width = `${stats.percentage}%`;
      progressFill.style.background = stats.progressColor;
    }
  }

  debounceAutoSave() {
    clearTimeout(this.saveDebounceTimer);
    this.saveDebounceTimer = setTimeout(async () => {
      await scriptService.saveCurrent();
      console.log('Autosaved script to Firestore/Local:', scriptService.currentScript.id);
    }, 1500);
  }

  async saveCurrentScriptExplicit() {
    const saved = await scriptService.saveCurrent();
    this.showToast('대본이 파이어베이스에 안전하게 저장되었습니다! 💾', 'success');
    this.renderStorageList();
  }

  /* ================== STORAGE VIEW ================== */
  renderStorageList(keyword = '') {
    const listContainer = document.getElementById('storageGrid');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    const scripts = scriptService.getScripts();
    const filtered = keyword ? scripts.filter(s => 
      s.title.toLowerCase().includes(keyword.toLowerCase()) ||
      s.content.toLowerCase().includes(keyword.toLowerCase()) ||
      (s.product?.brandNm && s.product.brandNm.toLowerCase().includes(keyword.toLowerCase()))
    ) : scripts;

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
          저장된 대본이 없습니다. 스튜디오에서 첫 번째 대본을 작성하고 저장해보세요!
        </div>
      `;
      return;
    }

    filtered.forEach(s => {
      const stats = scriptService.calculateStats(s.content);
      const card = document.createElement('div');
      card.className = 'script-card';

      const dateStr = s.updatedAt ? new Date(s.updatedAt).toLocaleDateString('ko-KR') : '';

      card.innerHTML = `
        <div class="script-card-header">
          <span class="rec-brand-badge ${s.product?.brandNm === '홈빛' ? 'badge-homevit' : 'badge-vitson'}">
            ${s.product?.brandNm || '일신비츠온'}
          </span>
          <span style="font-size: 0.72rem; color: var(--text-muted);">${scriptService.getStatusLabel(s.status)}</span>
        </div>
        <div class="script-card-title">${s.title}</div>
        <div class="script-card-preview">${s.content || '(대본 본문 없음)'}</div>
        <div class="script-card-footer">
          <span>${stats.timeFormatted} (${stats.charCountWithSpaces}자) • ${dateStr}</span>
          <div class="script-card-btns">
            <button class="btn-card-action btn-load-script">열기</button>
            <button class="btn-card-action btn-dup-script">복제</button>
            <button class="btn-card-action btn-del-script" style="color: #f87171;">삭제</button>
          </div>
        </div>
      `;

      card.querySelector('.btn-load-script').addEventListener('click', () => {
        scriptService.setCurrentScript(s);
        if (s.product) {
          const matched = productService.getByCode(s.product.productCode);
          if (matched) productService.currentSelected = matched;
        }
        this.updateEditorUI();
        this.switchView('studio');
        this.showToast(`[${s.title}] 대본을 불러왔습니다.`);
      });

      card.querySelector('.btn-dup-script').addEventListener('click', async () => {
        await scriptService.duplicateScript(s.id);
        this.renderStorageList(keyword);
        this.showToast('대본이 복제되었습니다.');
      });

      card.querySelector('.btn-del-script').addEventListener('click', async () => {
        if (confirm(`'${s.title}' 대본을 삭제하시겠습니까?`)) {
          await scriptService.deleteScript(s.id);
          this.renderStorageList(keyword);
          this.showToast('대본이 삭제되었습니다.');
        }
      });

      listContainer.appendChild(card);
    });
  }

  /* ================== TEMPLATES VIEW ================== */
  renderTemplateDropdown() {
    const dropdown = document.getElementById('templateSelectDropdown');
    if (!dropdown) return;
    dropdown.innerHTML = '<option value="">📑 템플릿 선택하여 적용...</option>';
    const templates = templateService.getTemplates();
    templates.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.title;
      dropdown.appendChild(opt);
    });
  }

  renderTemplateList() {
    const container = document.getElementById('templateGrid');
    if (!container) return;
    container.innerHTML = '';

    const templates = templateService.getTemplates();
    templates.forEach(t => {
      const card = document.createElement('div');
      card.className = 'template-card';

      const isDefault = t.id.startsWith('tpl_vitson') || t.id.startsWith('tpl_homevit') || t.id.startsWith('tpl_b2b') || t.id.startsWith('tpl_speed');

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div class="template-card-title">${t.title}</div>
          <span class="rec-brand-badge badge-vitson">${t.category || '기본'}</span>
        </div>
        <div class="template-card-desc">${t.description || ''}</div>
        <div class="template-card-content">${t.content}</div>
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px;">
          <span style="font-size: 0.72rem; color: var(--text-muted);">${isDefault ? '기본 제공 템플릿' : '커스텀 템플릿'}</span>
          <div style="display: flex; gap: 6px;">
            <button class="btn-card-action btn-apply-tpl">스튜디오에 적용</button>
            ${!isDefault ? `<button class="btn-card-action btn-del-tpl" style="color: #f87171;">삭제</button>` : ''}
          </div>
        </div>
      `;

      card.querySelector('.btn-apply-tpl').addEventListener('click', () => {
        this.applyTemplateToScript(t.id);
        this.switchView('studio');
      });

      if (!isDefault) {
        const btnDel = card.querySelector('.btn-del-tpl');
        if (btnDel) {
          btnDel.addEventListener('click', async () => {
            if (confirm(`'${t.title}' 템플릿을 삭제하시겠습니까?`)) {
              await templateService.deleteTemplate(t.id);
              this.renderTemplateList();
              this.renderTemplateDropdown();
              this.showToast('템플릿이 삭제되었습니다.');
            }
          });
        }
      }

      container.appendChild(card);
    });
  }

  /* ================== UTILITIES ================== */
  copyText(text) {
    navigator.clipboard.writeText(text);
    this.showToast('텍스트가 복사되었습니다! 📋', 'success');
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 200);
    }, 3200);
  }
}

// Global instance for inline event hooks
window.vclApp = new AppController();
document.addEventListener('DOMContentLoaded', () => {
  window.vclApp.init();
});
