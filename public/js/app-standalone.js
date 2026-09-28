// ==========================================
// VCL-Light Standalone Application Logic
// (주)일신비츠온 콘텐츠 제작 스튜디오
// ==========================================

const CONFIG = {
  gemini: {
    apiKey: "AQ.Ab8RN6LpZOKqlsOJI7xIU2LXgDRV0rO7ghNN1CEpBm3cneoAag",
    model: "gemini-3.6-flash",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models"
  },
  firebase: {
    apiKey: "AIzaSyAWzpRpyB5Xq1J-Z2t8sq9biGeMJMfGFb4",
    authDomain: "vcl-light.firebaseapp.com",
    projectId: "vcl-light",
    storageBucket: "vcl-light.firebasestorage.app",
    messagingSenderId: "1055284719368",
    appId: "1:1055284719368:web:71de664aa1afeb6674c6bd"
  }
};

// 1. Firebase Service (Compat Mode - Zero Build, Double-click ready)
let firebaseApp = null;
let firestoreDb = null;
try {
  if (typeof firebase !== 'undefined') {
    firebaseApp = firebase.initializeApp(CONFIG.firebase);
    firestoreDb = firebase.firestore();
    console.log("Firebase initialized successfully in compat mode.");
  }
} catch (e) {
  console.warn("Firebase initialization warning (local storage active):", e);
}

const StorageService = {
  async saveScript(script) {
    const id = script.id || 'script_' + Date.now();
    const data = {
      ...script,
      id,
      updatedAt: new Date().toISOString(),
      createdAt: script.createdAt || new Date().toISOString()
    };
    
    // 1. LocalStorage 저장 (오프라인 보호)
    this._saveLocalScript(data);

    // 2. Cloud Firestore 저장
    if (firestoreDb) {
      try {
        await firestoreDb.collection('scripts').doc(id).set(data, { merge: true });
      } catch (err) {
        console.warn("Firestore save warning (saved to local storage):", err);
      }
    }
    return data;
  },

  async getScripts() {
    let cloudList = [];
    if (firestoreDb) {
      try {
        const snap = await firestoreDb.collection('scripts').orderBy('updatedAt', 'desc').get();
        snap.forEach(doc => cloudList.push(doc.data()));
      } catch (err) {
        console.warn("Firestore get failed (using local):", err);
      }
    }
    const localList = this._getLocalScripts();
    const map = new Map();
    localList.forEach(s => map.set(s.id, s));
    cloudList.forEach(s => {
      const ex = map.get(s.id);
      if (!ex || new Date(s.updatedAt) >= new Date(ex.updatedAt)) {
        map.set(s.id, s);
      }
    });
    const merged = Array.from(map.values()).sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    localStorage.setItem('vcl_scripts', JSON.stringify(merged));
    return merged;
  },

  async deleteScript(id) {
    this._deleteLocalScript(id);
    if (firestoreDb) {
      try {
        await firestoreDb.collection('scripts').doc(id).delete();
      } catch (e) {}
    }
    return true;
  },

  _getLocalScripts() {
    try {
      const d = localStorage.getItem('vcl_scripts');
      return d ? JSON.parse(d) : [];
    } catch { return []; }
  },
  _saveLocalScript(s) {
    const list = this._getLocalScripts();
    const idx = list.findIndex(item => item.id === s.id);
    if (idx >= 0) list[idx] = s;
    else list.unshift(s);
    localStorage.setItem('vcl_scripts', JSON.stringify(list));
  },
  _deleteLocalScript(id) {
    const list = this._getLocalScripts().filter(item => item.id !== id);
    localStorage.setItem('vcl_scripts', JSON.stringify(list));
  },

  async saveTemplate(tpl) {
    const id = tpl.id || 'tpl_' + Date.now();
    const data = {
      ...tpl,
      id,
      updatedAt: new Date().toISOString(),
      createdAt: tpl.createdAt || new Date().toISOString()
    };
    this._saveLocalTemplate(data);
    if (firestoreDb) {
      try {
        await firestoreDb.collection('templates').doc(id).set(data, { merge: true });
      } catch (e) {}
    }
    return data;
  },

  async getTemplates() {
    let cloudList = [];
    if (firestoreDb) {
      try {
        const snap = await firestoreDb.collection('templates').orderBy('updatedAt', 'desc').get();
        snap.forEach(doc => cloudList.push(doc.data()));
      } catch (e) {}
    }
    const localList = this._getLocalTemplates();
    const map = new Map();
    localList.forEach(t => map.set(t.id, t));
    cloudList.forEach(t => map.set(t.id, t));
    const merged = Array.from(map.values());
    localStorage.setItem('vcl_templates', JSON.stringify(merged));
    return merged;
  },

  async deleteTemplate(id) {
    this._deleteLocalTemplate(id);
    if (firestoreDb) {
      try {
        await firestoreDb.collection('templates').doc(id).delete();
      } catch (e) {}
    }
    return true;
  },

  _getLocalTemplates() {
    try {
      const d = localStorage.getItem('vcl_templates');
      return d ? JSON.parse(d) : [];
    } catch { return []; }
  },
  _saveLocalTemplate(t) {
    const list = this._getLocalTemplates();
    const idx = list.findIndex(item => item.id === t.id);
    if (idx >= 0) list[idx] = t;
    else list.unshift(t);
    localStorage.setItem('vcl_templates', JSON.stringify(list));
  },
  _deleteLocalTemplate(id) {
    const list = this._getLocalTemplates().filter(item => item.id !== id);
    localStorage.setItem('vcl_templates', JSON.stringify(list));
  }
};

// 2. Gemini AI Service (Direct Browser Fetch - CORS Enabled by Google)
const GeminiService = {
  async call(prompt, systemInstruction = '', temperature = 0.7) {
    const url = `${CONFIG.gemini.endpoint}/${CONFIG.gemini.model}:generateContent?key=${CONFIG.gemini.apiKey}`;
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: temperature,
        maxOutputTokens: 2500
      }
    };
    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gemini API 에러 (${res.status})`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  },

  async analyzeProduct(p) {
    const sys = `당신은 (주)일신비츠온의 수석 유튜브/숏폼 콘텐츠 기획자입니다. 비츠온(전기/조명/공구)과 홈빛(감성 인테리어 조명/생활가전), 비츠온MRO 제품을 분석하여 조회수가 터지는 숏폼 기획 분석을 JSON 구조로만 반환하세요.`;
    const specs = p.specs ? Object.entries(p.specs).map(([k,v]) => `- ${k}: ${v}`).join('\n') : '(상세 규격 참조)';
    const prompt = `[제품 정보]
- 브랜드: ${p.brandNm}
- 품명: ${p.productNm}
- 규격: ${p.standard || '기본'}
- 모델: ${p.modelName || '기본'}
- 제원:
${specs}

다음 JSON 포맷으로만 답변하세요:
{
  "oneLineSummary": "제품의 핵심 가치를 담은 매력적인 1줄 요약",
  "targetAudience": "주요 타겟층 2~3개 (예: 셀프 인테리어족, 현장 전기기사, 상가 사장님 등)",
  "sellingPoints": ["핵심 셀링포인트 1", "핵심 셀링포인트 2", "핵심 셀링포인트 3"],
  "viralHooks": [
    "훅 1 (호기심 유발형 - '아직도 OO 쓰시나요?')",
    "훅 2 (비용/절약형 - '이거 바꾸고 전기세 OO% 아꼈습니다')",
    "훅 3 (시간/편의형 - '전문가 안 부르고 3분 만에 셀프 교체하는 법')",
    "훅 4 (비교/검증형 - '싸구려 제품과 비츠온 정품의 충격적 차이')",
    "훅 5 (인테리어/감성형 - '조명 하나 바꿨을 뿐인데 호텔 분위기 나는 꿀템')"
  ]
}`;
    const raw = await this.call(prompt, sys, 0.4);
    try {
      const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      return {
        oneLineSummary: `${p.brandNm} ${p.productNm} - 가성비와 품질을 갖춘 스마트 아이템`,
        targetAudience: '인테리어 시공 및 전기자재 사용자, 가성비 소비층',
        sellingPoints: [p.standard || '우수한 품질 규격', '비츠온 검증 부품 채용', '간편한 설치 및 A/S'],
        viralHooks: [
          `아직도 이거 모르고 그냥 쓰셨나요? ${p.productNm}!`,
          `전기세와 교체 스트레스 한 번에 날리는 법!`,
          `3분 만에 교체 끝! ${p.brandNm} 인기 아이템`
        ]
      };
    }
  },

  async generateShortsScript(p, notes = '', aiAnalysis = null, targetHook = '') {
    const sys = `당신은 100만 조회수 쇼츠를 만드는 (주)일신비츠온 전속 크리에이터입니다.
1인이 기획, 대본, 자막, 촬영, 출연, 편집까지 모두 진행하므로,
[화면 연출/행동 지문], [대사/나레이션], [화면 텍스트 자막]이 명확히 구분된 50초 내외 숏폼 스크립트를 작성하세요.`;

    let aiContext = '';
    if (aiAnalysis) {
      aiContext = `
[사전 AI 제품 제원 분석 데이터]
- 1줄 요약: ${aiAnalysis.oneLineSummary || ''}
- 타겟 고객: ${aiAnalysis.targetAudience || ''}
- 핵심 셀링포인트(USP): ${(aiAnalysis.sellingPoints || []).join(' / ')}
- 추천 바이럴 훅: ${(aiAnalysis.viralHooks || []).join(' | ')}
`;
    }
    if (targetHook) {
      aiContext += `\n[지정 오프닝 훅]: 반드시 다음 문장을 0~5초 오프닝 훅(첫 대사 및 행동 연출)으로 적극 사용하여 시작하세요:\n"${targetHook}"\n`;
    }

    const prompt = `[제품]: ${p.brandNm} ${p.productNm} (${p.standard || ''})
[모델]: ${p.modelName || ''}
[추가 메모]: ${notes || '빠르고 강렬한 전개'}
${aiContext}
다음 구조로 50초 내외(공백 포함 350~450자) 숏폼 대본을 작성해 주세요:
1. [0~5초] 인트로 훅 (시선 사로잡는 오프닝 대사와 행동)
2. [5~20초] 문제 상황 & 공감대 형성
3. [20~40초] 비츠온/홈빛 제품 솔루션 & 스펙 실증
4. [40~50초] 아웃트로 및 CTA (비츠온MRO 구매 / 프로필 링크 유도)`;
    return await this.call(prompt, sys, 0.7);
  },

  async generateLongFormScript(p, notes = '', aiAnalysis = null) {
    const sys = `당신은 전기/조명/MRO 전문 리뷰 유튜버이자 (주)일신비츠온 콘텐츠 마스터입니다. 초보자도 쉽게 이해할 수 있는 3~4분 분량의 유튜브 롱폼 리뷰 및 설치/사용 가이드 대본을 작성합니다.`;
    
    let aiContext = '';
    if (aiAnalysis) {
      aiContext = `
[사전 AI 제품 제원 분석 데이터]
- 1줄 요약: ${aiAnalysis.oneLineSummary || ''}
- 타겟 고객: ${aiAnalysis.targetAudience || ''}
- 핵심 셀링포인트(USP): ${(aiAnalysis.sellingPoints || []).join(' / ')}
`;
    }

    const prompt = `[제품]: ${p.brandNm} ${p.productNm} (${p.standard || ''})
[모델]: ${p.modelName || ''}
[메모]: ${notes}
${aiContext}
1. 인트로 (오늘 다룰 주제 및 시청 혜택)
2. 언박싱 & 외관 디자인/마감 디테일
3. 핵심 스펙 정밀 분석 (소비전력, 조도, 색온도, 방수 등 실생활 체감 위주)
4. 실제 설치 및 작동 시연 (안전 수칙 포함)
5. 장단점 솔직 비교 & 어떤 분께 추천하는지
6. 아웃트로 & 비츠온MRO 안내`;
    return await this.call(prompt, sys, 0.7);
  },

  async generateSubtitles(text) {
    const sys = `당신은 영상 자막 편집 전문가입니다. 대본을 호흡과 음절 길이에 맞춰 1줄당 15~20자 내외의 시각적 자막 블록으로 깔끔하게 나누고, 예상 타임코드([00:00.0])를 표시하세요.`;
    return await this.call(text, sys, 0.3);
  },

  async generateVideoPrompts(p, text) {
    const sys = `당신은 AI 영상 제작 감독입니다. Runway Gen-3 Alpha, Kling AI, Luma, Midjourney 등에 바로 입력할 수 있는 고품질 B-Roll 프롬프트를 작성하세요. 영문 프롬프트는 전문 영화/광고 스타일로 작성하세요.`;
    const prompt = `[제품]: ${p.brandNm} ${p.productNm}\n[대본]:\n${text}\n\n위 대본의 주요 장면을 위한 AI 영상 제작 프롬프트 4~5컷(오프닝 훅 샷, 제품 외관 클로즈업, 실제 작동/발광, 인테리어 공간 연출, 엔딩 브랜드 샷)을 작성해 주세요.`;
    return await this.call(prompt, sys, 0.6);
  }
};

// 3. Product Service
const ProductService = {
  get products() {
    return window.VCL_PRODUCTS || [];
  },
  currentFilter: 'all',
  currentSelected: null,
  currentRecommendations: [],

  getRandom5(filter = this.currentFilter) {
    this.currentFilter = filter;
    let pool = [...this.products];
    if (filter === 'vitson') pool = pool.filter(p => p.brandNm === '비츠온');
    else if (filter === 'homevit') pool = pool.filter(p => p.brandNm === '홈빛');
    else if (filter === 'mro') pool = pool.filter(p => p.brandNm !== '비츠온' && p.brandNm !== '홈빛');

    if (pool.length === 0) pool = [...this.products];

    // Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    if (filter === 'all') {
      const v = pool.filter(p => p.brandNm === '비츠온');
      const h = pool.filter(p => p.brandNm === '홈빛');
      const m = pool.filter(p => p.brandNm !== '비츠온' && p.brandNm !== '홈빛');
      const sel = [];
      if (v.length > 0) sel.push(v[0]);
      if (h.length > 0) sel.push(h[0]);
      if (v.length > 1) sel.push(v[1]);
      if (m.length > 0) sel.push(m[0]);
      while (sel.length < 5 && pool.length > 0) {
        const next = pool.pop();
        if (!sel.some(s => s.productCode === next.productCode)) sel.push(next);
      }
      this.currentRecommendations = sel.slice(0, 5);
      return this.currentRecommendations;
    }

    this.currentRecommendations = pool.slice(0, 5);
    return this.currentRecommendations;
  },

  search(q) {
    if (!q || !q.trim()) return [];
    const term = q.trim().toLowerCase();
    const matches = this.products.filter(p => {
      return (p.productNm && p.productNm.toLowerCase().includes(term)) ||
             (p.productCode && String(p.productCode).toLowerCase().includes(term)) ||
             (p.modelName && p.modelName.toLowerCase().includes(term)) ||
             (p.standard && p.standard.toLowerCase().includes(term)) ||
             (p.brandNm && p.brandNm.toLowerCase().includes(term));
    });

    // Exact match & brand prioritization (비츠온 1순위, 홈빛 2순위)
    matches.sort((a, b) => {
      const aCode = String(a.productCode).toLowerCase();
      const bCode = String(b.productCode).toLowerCase();
      if (aCode === term && bCode !== term) return -1;
      if (bCode === term && aCode !== term) return 1;

      const brandScore = brand => (brand === '비츠온' ? 3 : brand === '홈빛' ? 2 : 1);
      const scoreDiff = brandScore(b.brandNm) - brandScore(a.brandNm);
      if (scoreDiff !== 0) return scoreDiff;

      return 0;
    });

    return matches.slice(0, 30);
  },

  getByCode(c) {
    return this.products.find(p => String(p.productCode) === String(c));
  },

  getSpecsSummaryText(p) {
    if (!p) return '';
    let text = `[${p.brandNm}] ${p.productNm}\n`;
    text += `- 규격: ${p.standard || '기본 규격'}\n`;
    if (p.modelName) text += `- 모델명: ${p.modelName}\n`;
    if (p.specs) {
      for (const [k, v] of Object.entries(p.specs)) {
        if (v && v !== '해당사항없음') text += `- ${k}: ${v}\n`;
      }
    }
    text += `- 제조/판매: (주)일신비츠온 (비츠온MRO)\n`;
    text += `- 구매링크: https://vitsonmro.com/mro/shop/productDetail.do?productCode=${p.productCode}\n`;
    return text;
  }
};

// 4. Default Storyboard Sample & Templates
const DEFAULT_STORYBOARD_SAMPLE = [
  { section: '도입', num: 1, script: '어지럽고 지저분한 책상 위 멀티탭 때문에 스트레스 받으셨죠?', scene: '지저분한 전선들과 기존 투박한 멀티탭 클로즈업' },
  { section: '도입', num: 2, script: '오늘은 디자인과 실용성을 완벽히 잡은 루미앤 큐브 멀티탭을 가지고 왔어요', scene: '인서트(상하좌우팬) > 깔끔한 데스크테리어 제품 컷' },
  { section: '본문', num: 3, script: '디자인이 정말 예뻐요, 투박하고 칙칙하던 제 책상에 예쁜 오브제를 놓은 느낌이에요', scene: '클로즈업 컷 > 책상 위에 올려둔 감성적인 모습' },
  { section: '본문', num: 4, script: '큐브 형태라 플러그 모양이 날씬하든 뚱뚱하든 별모양이든 상관없이 3개까지 편하게 꽂을 수 있어요', scene: '기존 안 꽂히는 모습 > 다양한 모양 플러그 꽂는 시연' },
  { section: '본문', num: 5, script: '그리고 포트도 다양해요, USB 1개와 C타입 2개 포트가 탑재되어 있습니다', scene: '포트 클로즈업 > USB 꽂기 > C타입 케이블 꽂기' },
  { section: '본문', num: 6, script: 'C타입은 PD형 20W 초고속 충전까지 지원해서, 스마트폰 충전할 때 답답함이 전혀 없어요', scene: '고속충전 표시 뜨는 스마트폰 화면 > 안도하는 표정(짤)' },
  { section: '본문', num: 7, script: '이렇게 예쁜데 능력 좋은 멀티탭이 두 종류에요, 하나는 플러그 타입, 하나는 코드 타입이에요', scene: '양손에 두 종류 들고 비교 > 플러그 모습 > 코드 모습' },
  { section: '본문', num: 8, script: '플러그 타입은 벽에 딱 붙여서 깔끔하게 쓰고 싶을 때 좋고, 코드 타입은 책상이나 침대 옆에 두고 쓰기 딱이에요', scene: '벽에 꽂는 연출 > 침대 협탁에 두고 쓰는 연출' },
  { section: '본문', num: 9, script: '안전도 전혀 문제없어요, 과부하 차단 스위치가 내장되어 있어 이상 전류 발생 시 자동으로 셧다운됩니다', scene: '과부하 차단 스위치 클로즈업 > 안심하는 표정' },
  { section: '본문', num: 10, script: '불에 잘 안 타는 난연 1등급 V-0 최고급 소재로 만들어져서 화재 걱정도 덜어줍니다', scene: '난연 소재 인증 마크 or 불에 안 타는 그래픽 강조' },
  { section: '본문', num: 11, script: '각 콘센트 구멍마다 슬라이드 안전 커버가 적용되어 이물질 삽입과 감전 사고를 철저히 예방해요', scene: '슬라이드 안전 커버 디테일 클로즈업' },
  { section: '본문', num: 12, script: '게다가 국가 공인 KC 안전 인증까지 완료된 믿을 수 있는 일신비츠온 정품입니다', scene: 'KC 정식 인증 마크 강조' },
  { section: '본문', num: 13, script: '지금 비츠온MRO에서 특가와 빠른 총알 배송으로 만나보실 수 있습니다', scene: '제품 들고 손인사 > 비츠온MRO 로고 및 자막' },
  { section: '엔딩', num: 14, script: '작고 예쁜데 충전까지 빠른 루미앤 큐브 멀티탭', scene: '감성적인 최종 제품 연출 컷' },
  { section: '엔딩', num: 15, script: '지금 바로 구매하고 나만의 데스크테리어를 완성해보세요!', scene: '구매링크 유도 컷 및 프로필 링크 안내' }
];

const DEFAULT_TEMPLATES = [
  {
    id: 'tpl_lumian_cube_multitab',
    title: '[실무 2단 콘티] 루미앤 큐브 멀티탭 (1분 22초 실전 샘플)',
    category: '비츠온/2단콘티',
    description: '실무 엑셀 콘티 포맷 (구성/번호/대본/장면) 실전 샘플 - 영상 실측 1분 22초 기준 (표준 15행)',
    content: `[00:00~00:05] 오프닝 도입
(화면: 지저분한 전선들과 기존 투박한 멀티탭 클로즈업)
어지럽고 지저분한 책상 위 멀티탭 때문에 스트레스 받으셨죠?

[00:05~00:10] 제품 등장
(화면: 인서트(상하좌우팬) > 깔끔한 데스크테리어 제품 컷)
오늘은 디자인과 실용성을 완벽히 잡은 루미앤 큐브 멀티탭을 가지고 왔어요

[00:10~00:18] 디자인 & 첫인상
(화면: 클로즈업 컷 > 책상 위에 올려둔 감성적인 모습)
디자인이 정말 예뻐요, 투박하고 칙칙하던 제 책상에 예쁜 오브제를 놓은 느낌이에요

[00:18~00:26] 큐브 형태 특장점
(화면: 기존 안 꽂히는 모습 > 다양한 모양 플러그 꽂는 시연)
큐브 형태라 플러그 모양이 날씬하든 뚱뚱하든 별모양이든 상관없이 3개까지 편하게 꽂을 수 있어요

[00:26~00:34] 다양한 포트 탑재
(화면: 포트 클로즈업 > USB 꽂기 > C타입 케이블 꽂기)
그리고 포트도 다양해요, USB 1개와 C타입 2개 포트가 탑재되어 있습니다

[00:34~00:44] PD 20W 초고속 충전
(화면: 고속충전 표시 뜨는 스마트폰 화면 > 안도하는 표정(짤))
C타입은 PD형 20W 초고속 충전까지 지원해서, 스마트폰 충전할 때 답답함이 전혀 없어요

[00:44~00:52] 2종 라인업 소개
(화면: 양손에 두 종류 들고 비교 > 플러그 모습 > 코드 모습)
이렇게 예쁜데 능력 좋은 멀티탭이 두 종류에요, 하나는 플러그 타입, 하나는 코드 타입이에요

[00:52~01:00] 사용 상황별 추천
(화면: 벽에 꽂는 연출 > 침대 협탁에 두고 쓰는 연출)
플러그 타입은 벽에 딱 붙여서 깔끔하게 쓰고 싶을 때 좋고, 코드 타입은 책상이나 침대 옆에 두고 쓰기 딱이에요

[01:00~01:06] 안전 장치 (과부하 차단)
(화면: 과부하 차단 스위치 클로즈업 > 안심하는 표정)
안전도 전혀 문제없어요, 과부하 차단 스위치가 내장되어 있어 이상 전류 발생 시 자동으로 셧다운됩니다

[01:06~01:12] 난연 소재 안심
(화면: 난연 소재 인증 마크 or 불에 안 타는 그래픽 강조)
불에 잘 안 타는 난연 1등급 V-0 최고급 소재로 만들어져서 화재 걱정도 덜어줍니다

[01:12~01:17] 슬라이드 안전 커버
(화면: 슬라이드 안전 커버 디테일 클로즈업)
각 콘센트 구멍마다 슬라이드 안전 커버가 적용되어 이물질 삽입과 감전 사고를 철저히 예방해요

[01:17~01:21] 국가 공인 KC 인증
(화면: KC 정식 인증 마크 강조)
게다가 국가 공인 KC 안전 인증까지 완료된 믿을 수 있는 일신비츠온 정품입니다

[01:21~01:26] MRO 프로모션 안내
(화면: 제품 들고 손인사 > 비츠온MRO 로고 및 자막)
지금 비츠온MRO에서 특가와 빠른 총알 배송으로 만나보실 수 있습니다

[01:26~01:31] 엔딩 요약
(화면: 감성적인 최종 제품 연출 컷)
작고 예쁜데 충전까지 빠른 루미앤 큐브 멀티탭

[01:31~01:35] 최종 CTA
(화면: 구매링크 유도 컷 및 프로필 링크 안내)
지금 바로 구매하고 나만의 데스크테리어를 완성해보세요!`,
    storyboard: JSON.parse(JSON.stringify(DEFAULT_STORYBOARD_SAMPLE))
  },
  {
    id: 'tpl_vitson_shorts_1min',
    title: '[비츠온/쇼츠] 1분 완성 스펙 & 실사용 리뷰',
    category: '비츠온/숏폼',
    description: '후킹부터 스펙 소개, 현장 실사용, 비츠온MRO 구매 안내까지 50초 최적화',
    content: `[00:00~00:05] 강력한 오프닝 후킹
(화면: 제품을 손에 들고 카메라를 향해 정면 응시)
"아직도 형광등이나 구형 조명 쓰면서 전기세 날리고 계신가요? 오늘 소개할 제품은 일신비츠온의 {{브랜드}} {{제품명}}입니다!"

[00:05~00:18] 기존 문제점 & 공감대
(화면: 어둡거나 깜빡거리는 기존 조명 비교 화면)
"어둡고 침침한 방, 교체하려니 공구도 없고 복잡해서 미루셨죠? 이 제품은 누구나 3분 만에 셀프 교체가 가능합니다."

[00:18~00:35] 핵심 스펙 및 솔루션 시연
(화면: {{제품명}} 점등 시연 및 눈부심 없는 플리커프리 클로즈업)
"규격은 {{규격}}!
소비전력은 줄이고, 밝기는 훨씬 선명한 정격광속을 자랑합니다.
KC 정식 인증 부품으로 안전하고 눈 피로가 전혀 없는 플리커프리 설계!"

[00:35~00:45] 총평 및 CTA (구매 유도)
(화면: 밝아진 전체 공간 비포&애프터 샷)
"합리적인 가격에 확실한 밝기, 비츠온MRO에서 당일 출고로 만나보세요. 제품 상세 링크는 고정 댓글과 프로필에서 확인하세요!"`
  },
  {
    id: 'tpl_homevit_interior_aesthetic',
    title: '[홈빛/인테리어] 감성 조명 스타일링 & 비포애프터',
    category: '홈빛/인테리어',
    description: '식탁등, 실링팬, 팬던트 등 공간의 분위기를 바꾸는 감성 홈스타일링 대본',
    content: `[00:00~00:06] 감성 무드 오프닝
(화면: 은은한 불빛이 켜지며 카페 같은 무드가 연출되는 컷)
"조명 하나 바꿨을 뿐인데, 우리 집 거실이 5성급 호텔 라운지가 되었습니다. 프리미엄 홈라이프 브랜드 '홈빛'의 {{제품명}}!"

[00:06~00:20] 공간의 변화 (비포 & 애프터)
(화면: 밋밋했던 이전 인테리어와 현재 무드의 1:1 비교 분할 컷)
"밋밋하고 차가웠던 공간이 홈빛 조명을 켜는 순간 따뜻하고 아늑한 감성으로 가득 찹니다."

[00:20~00:38] 디테일 & 스펙 포인트
(화면: 마감 퀄리티, 스위치 조작, 디밍/색온도 변화 클로즈업)
"규격: {{규격}}
세련된 미니멀 디자인에 마감까지 완벽하고,
부드러운 빛 번짐으로 오래 켜두어도 눈이 편안합니다."

[00:38~00:50] 엔딩 & 추천 대상
(화면: 조명 아래서 차를 마시거나 휴식하는 자연스러운 컷)
"나만의 특별한 힐링 공간을 완성하고 싶다면? 지금 일신비츠온 홈빛에서 확인해보세요!"`
  },
  {
    id: 'tpl_b2b_field_pro',
    title: '[비츠온MRO/B2B] 전문가용 전기자재/공구 현장 검증',
    category: 'B2B/전문가',
    description: '전기기사, 인테리어 시공업자, 공장 관리자를 위한 스펙 중심의 신뢰형 대본',
    content: `[00:00~00:06] 현장 전문가 훅
(화면: 작업 현장에서 제품을 보여주며)
"현장에서 작업 속도 2배로 올려주는 실전 꿀템! 오늘은 {{브랜드}}의 {{제품명}}을 직접 뜯어보고 테스트해 봅니다."

[00:06~00:22] 현장 고민 & 제품 스펙
(화면: 결선 부위, 단자대, 재질 마감 클로즈업)
"시공할 때 제일 번거로운 게 내구성과 설치 편의성이죠.
- 규격: {{규격}}
- 모델명: {{모델명}}
직접 만져보면 체결감이 단단하고, 열 분산 설계가 아주 잘 되어 있습니다."

[00:22~00:40] 현장 테스트 및 성능 검증
(화면: 전압 측정기 또는 부하 테스트, 실제 장착 시연)
"실제 측정해보니 정격 수치가 안정적으로 나오고, 내구성 테스트도 거뜬합니다. 왜 수많은 현장 기사님들이 비츠온을 찾는지 알겠네요."

[00:40~00:50] MRO 대량 구매 안내
(화면: 비츠온MRO 화면 캡처 또는 자막)
"기업 전용 비츠온MRO 쇼핑몰에서 사업자 회원 특별 단가와 대량 주문 혜택으로 주문 가능합니다!"`
  },
  {
    id: 'tpl_speed_diy_solution',
    title: '[공통/DIY] 문제 제기 -> 스펙 해결 -> 3분 컷 설치',
    category: '실속/DIY',
    description: '소비자의 페인포인트를 짚고 3분 설치로 문제를 해결하는 빠른 전개 대본',
    content: `[00:00~00:05] 문제 제기 훅
"이거 아직도 전파사 부르시나요? 출장비 5만 원 아끼는 법 바로 알려드립니다!"

[00:05~00:15] 핵심 제품 소개
"오늘의 주인공은 (주)일신비츠온의 {{브랜드}} {{제품명}} ({{규격}})!"

[00:15~00:35] 초간단 3단계 설치법
"1단계: 기존 부품 떼어내기!
2단계: 원터치 브라켓 고정하고 선 연결!
3단계: 커버 씌우면 끝! 진짜 3분도 안 걸립니다."

[00:35~00:45] 총평
"가성비, 내구성, 간편함까지 3박자를 다 갖춘 일신비츠온 정품! 자세한 정보는 아래 링크에서 확인하세요!"`
  }
];

const TemplateService = {
  templates: [...DEFAULT_TEMPLATES],
  async loadTemplates() {
    try {
      const custom = await StorageService.getTemplates();
      const defIds = new Set(DEFAULT_TEMPLATES.map(t => t.id));
      const userCustom = custom.filter(t => !defIds.has(t.id));
      this.templates = [...DEFAULT_TEMPLATES, ...userCustom];
      return this.templates;
    } catch {
      this.templates = [...DEFAULT_TEMPLATES];
      return this.templates;
    }
  },
  getById(id) { return this.templates.find(t => t.id === id); },
  async createTemplate(data) {
    const saved = await StorageService.saveTemplate(data);
    this.templates.unshift(saved);
    return saved;
  },
  async updateTemplate(id, data) {
    const idx = this.templates.findIndex(t => t.id === id);
    if (idx >= 0) {
      const updated = { ...this.templates[idx], ...data, id };
      await StorageService.saveTemplate(updated);
      this.templates[idx] = updated;
      return updated;
    }
    return null;
  },
  async deleteTemplate(id) {
    await StorageService.deleteTemplate(id);
    this.templates = this.templates.filter(t => t.id !== id);
    return true;
  },
  applyVariables(content, p) {
    if (!p || !content) return content || '';
    let res = content;
    const reps = {
      '{{제품명}}': p.productNm || '제품',
      '{{브랜드}}': p.brandNm || '비츠온',
      '{{규격}}': p.standard || '기본 규격',
      '{{모델명}}': p.modelName || '기본 모델',
      '{{카테고리}}': p.category2 || p.category1 || '',
      '{{구매링크}}': `https://vitsonmro.com/mro/shop/productDetail.do?productCode=${p.productCode}`
    };
    if (p.specs) {
      for (const [k, v] of Object.entries(p.specs)) reps[`{{${k}}}`] = v;
    }
    for (const [k, v] of Object.entries(reps)) {
      res = res.replaceAll(k, v);
    }
    return res;
  },
  applyVariablesToStoryboard(rows, p) {
    if (!rows || !Array.isArray(rows)) return [];
    return rows.map(r => ({
      ...r,
      script: this.applyVariables(r.script || '', p),
      scene: this.applyVariables(r.scene || '', p)
    }));
  }
};

// 5. Script Service
const ScriptService = {
  currentScript: null,
  scripts: [],

  createBlankStoryboard(count = 15) {
    const rows = [];
    for (let i = 1; i <= count; i++) {
      let section = '본문';
      if (i <= 2) section = '도입';
      else if (i >= count - 1) section = '엔딩';
      rows.push({
        section: section,
        num: i,
        script: '',
        scene: ''
      });
    }
    return rows;
  },

  initNew(p = null) {
    const isDefault = !p;
    let storyboardRows = [];
    if (isDefault) {
      storyboardRows = JSON.parse(JSON.stringify(DEFAULT_STORYBOARD_SAMPLE));
    } else {
      storyboardRows = [
        { section: '도입', num: 1, script: `${p.productNm} 오프닝 및 주목 유도`, scene: '제품 클로즈업 & 인서트' },
        { section: '도입', num: 2, script: `기존 제품의 일상 속 불편함 및 공감대 형성`, scene: '문제 상황 및 일상 컷' },
        { section: '본문', num: 3, script: `[핵심 규격] ${p.standard || '정격 규격 안내'}`, scene: '제품 전체 외형 및 규격 표기' },
        { section: '본문', num: 4, script: `[특장점 1] ${p.modelName || p.brandNm} 정품 기술력과 성능`, scene: '작동 시연 및 상세 기능 클로즈업' },
        { section: '본문', num: 5, script: '', scene: '' },
        { section: '본문', num: 6, script: '', scene: '' },
        { section: '본문', num: 7, script: '', scene: '' },
        { section: '본문', num: 8, script: '', scene: '' },
        { section: '본문', num: 9, script: '', scene: '' },
        { section: '본문', num: 10, script: '', scene: '' },
        { section: '본문', num: 11, script: '', scene: '' },
        { section: '본문', num: 12, script: '', scene: '' },
        { section: '본문', num: 13, script: '', scene: '' },
        { section: '엔딩', num: 14, script: `${p.productNm} 핵심 장점 요약`, scene: '제품 연출 컷' },
        { section: '엔딩', num: 15, script: '지금 비츠온MRO에서 특가로 만나보세요!', scene: '구매링크 및 엔딩 로고' }
      ];
    }
    // Strict 1-based sequential re-indexing
    storyboardRows.forEach((r, idx) => { r.num = idx + 1; });

    this.currentScript = {
      id: 'script_' + Date.now(),
      title: p ? `[${p.brandNm}] ${p.productNm} 2단 콘티` : '[비츠온] 루미앤 큐브 멀티탭 (실전 2단 콘티)',
      content: '',
      notes: isDefault ? '💡 [2단 콘티(표)] 탭에서 각 셀을 직접 클릭하여 자유롭게 수정할 수 있습니다.\n💡 [🗑️ 표 비우기]를 누르면 언제든 기본 15칸 빈 표로 깨끗이 초기화됩니다.\n💡 [🖨️ A4 1장 깔끔 인쇄]를 누르면 여백과 글자 크기가 1장에 딱 맞춰집니다.\n💡 기존 엑셀 대본이 있다면 [📋 엑셀 붙여넣기]를 눌러 복사한 표를 즉시 불러오세요.' : '',
      product: p ? {
        productCode: p.productCode,
        productNm: p.productNm,
        brandNm: p.brandNm,
        standard: p.standard,
        modelName: p.modelName,
        pictureNm: p.pictureNm
      } : {
        productCode: '1010043332',
        productNm: '루미앤 큐브 멀티탭',
        brandNm: '비츠온',
        standard: '3구 멀티탭 + 20W PD C타입/USB 고속충전',
        modelName: '루미앤 큐브 멀티탭',
        pictureNm: 'https://mro3.vitson.com/product/1010043332_0.jpg'
      },
      status: 'planning',
      subtitles: '',
      videoPrompts: '',
      storyboard: storyboardRows,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.currentScript.content = this.storyboardToText(this.currentScript.storyboard);
    return this.currentScript;
  },

  async loadAll() {
    this.scripts = await StorageService.getScripts();
    return this.scripts;
  },

  async saveCurrent() {
    if (!this.currentScript.title || !this.currentScript.title.trim()) {
      this.currentScript.title = '제목 없는 대본';
    }
    const saved = await StorageService.saveScript(this.currentScript);
    this.currentScript = saved;
    const idx = this.scripts.findIndex(s => s.id === saved.id);
    if (idx >= 0) this.scripts[idx] = saved;
    else this.scripts.unshift(saved);
    return saved;
  },

  async delete(id) {
    await StorageService.deleteScript(id);
    this.scripts = this.scripts.filter(s => s.id !== id);
    if (this.currentScript?.id === id) this.initNew();
    return true;
  },

  async duplicate(id) {
    const orig = this.scripts.find(s => s.id === id);
    if (!orig) return null;
    const dup = {
      ...orig,
      id: 'script_' + Date.now(),
      title: `${orig.title} (복사본)`,
      storyboard: orig.storyboard ? JSON.parse(JSON.stringify(orig.storyboard)) : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const saved = await StorageService.saveScript(dup);
    this.scripts.unshift(saved);
    return saved;
  },

  storyboardToText(rows = []) {
    if (!rows || rows.length === 0) return '';
    return rows.map(r => `[${r.section || '본문'} ${r.num || ''}] ${r.script || ''}\n(장면: ${r.scene || ''})`).join('\n\n');
  },

  textToStoryboard(text = '') {
    if (!text || !text.trim()) return [];
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const rows = [];
    let curSec = '본문';
    let rowNum = 1;
    let pendingScene = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('[') && line.includes(']')) {
        const secMatch = line.match(/\[(.*?)\]/);
        if (secMatch) {
          const s = secMatch[1];
          if (s.includes('도입') || s.includes('오프닝') || s.includes('훅') || s.includes('00:00')) curSec = '도입';
          else if (s.includes('엔딩') || s.includes('아웃트로') || s.includes('마무리') || s.includes('CTA')) curSec = '엔딩';
          else curSec = '본문';
        }
        continue;
      }
      if (line.startsWith('(') && line.endsWith(')')) {
        const sc = line.replace(/^\(|\)$/g, '').replace(/^화면\s*:\s*/, '').trim();
        if (rows.length > 0 && !rows[rows.length - 1].scene) {
          rows[rows.length - 1].scene = sc;
        } else {
          pendingScene = sc;
        }
        continue;
      }
      const cleanScript = line.replace(/^"|"$/g, '').replace(/^\d+[\.\)]\s*/, '').trim();
      if (cleanScript) {
        rows.push({
          section: curSec,
          num: rowNum++,
          script: cleanScript,
          scene: pendingScene || '제품 시연 / 앵글 컷'
        });
        pendingScene = '';
      }
    }
    if (rows.length === 0 && lines.length > 0) {
      lines.forEach((l, idx) => {
        rows.push({ section: '본문', num: idx + 1, script: l, scene: '제품 연출' });
      });
    }
    return rows;
  },

  parseExcelText(rawText) {
    if (!rawText || !rawText.trim()) return [];

    // 1. Parse TSV respecting quotes and internal newlines (RFC 4180 state machine)
    const matrix = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;
    const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote: "" -> "
          currentCell += '"';
          i++;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === '\t' && !inQuotes) {
        // Tab column delimiter outside quotes
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\n' && !inQuotes) {
        // Row delimiter outside quotes
        currentRow.push(currentCell.trim());
        if (currentRow.some(c => Boolean(c))) {
          matrix.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    // Push remaining cell/row
    if (currentCell || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      if (currentRow.some(c => Boolean(c))) {
        matrix.push(currentRow);
      }
    }

    const rows = [];
    let autoNum = 1;

    for (let cols of matrix) {
      // Strip outer quotes if remaining, and trim
      cols = cols.map(c => c.replace(/^"|"$/g, '').trim());

      // Skip header row if it contains column labels
      if (cols.some(c => c === '대본' || c === '구성' || c === '장면' || c === '내용' || c === '번호')) {
        continue;
      }
      if (cols.length === 0 || (cols.length === 1 && !cols[0])) continue;

      let section = '본문';
      let num = autoNum;
      let script = '';
      let scene = '';

      if (cols.length >= 4) {
        section = cols[0] || '본문';
        num = parseInt(cols[1], 10) || autoNum;
        script = cols[2] || '';
        scene = cols[3] || '';
      } else if (cols.length === 3) {
        if (/^\d+$/.test(cols[0])) {
          num = parseInt(cols[0], 10);
          script = cols[1] || '';
          scene = cols[2] || '';
        } else {
          section = cols[0] || '본문';
          script = cols[1] || '';
          scene = cols[2] || '';
        }
      } else if (cols.length === 2) {
        script = cols[0] || '';
        scene = cols[1] || '';
      } else if (cols.length === 1) {
        script = cols[0] || '';
      }

      if (script || scene) {
        rows.push({
          section: section || '본문',
          num: num,
          script: script,
          scene: scene
        });
        autoNum++;
      }
    }
    // Strict 1-based sequential re-indexing
    rows.forEach((r, idx) => { r.num = idx + 1; });
    return rows;
  },

  calculateStats(input = '') {
    let raw = '';
    let isStoryboard = false;
    let sceneCount = 0;
    
    if (Array.isArray(input)) {
      isStoryboard = true;
      sceneCount = input.length;
      raw = input.map(r => r.script || '').join('\n');
    } else if (typeof input === 'string') {
      raw = input || '';
    } else if (input && typeof input === 'object') {
      if (Array.isArray(input.storyboard) && input.storyboard.length > 0) {
        isStoryboard = true;
        sceneCount = input.storyboard.length;
        raw = input.storyboard.map(r => r.script || '').join('\n');
      } else {
        raw = input.content || '';
      }
    }

    const charCountWithSpaces = raw.length;
    const charCountNoSpaces = raw.replace(/\s/g, '').length;
    const spoken = raw.replace(/\[[^\]]+\]/g, '').replace(/\([^)]+\)/g, '').replace(/“|”|"/g, '').trim();
    const spokenChars = spoken.replace(/\s/g, '').length;

    // 실측 캘리브레이션: 루미앤 큐브 멀티탭 12씬 (공백제외 379자 / 공백포함 502자 -> 실영상 82초 = 1분 22초)
    // 컷 전환, 인서트 짤, 시연 딜레이를 고려한 4.62자/초 기준
    const seconds = spokenChars > 0 ? Math.round(spokenChars / 4.62) : 0;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    const timeFormatted = m > 0 ? `${m}분 ${s}초` : `${s}초`;

    let recommendation = '숏폼 적합';
    let progressColor = '#10b981';
    let percentage = Math.min(100, Math.round((seconds / 60) * 100));

    if (seconds <= 30) {
      recommendation = '초단편 숏폼 (30초)';
      progressColor = '#3b82f6';
    } else if (seconds <= 60) {
      recommendation = '1분 쇼츠 최적 (45~60초)';
      progressColor = '#10b981';
    } else if (seconds <= 90) {
      recommendation = '실전 숏폼/릴스 (1분~1분30초)';
      progressColor = '#10b981';
    } else if (seconds <= 180) {
      recommendation = '미드폼/심층리뷰 (2~3분)';
      progressColor = '#f59e0b';
      percentage = 100;
    } else {
      recommendation = '유튜브 롱폼 리뷰 (3분+)';
      progressColor = '#8b5cf6';
      percentage = 100;
    }

    return {
      charCountWithSpaces,
      charCountNoSpaces,
      spokenChars,
      estimatedSeconds: seconds,
      timeFormatted,
      recommendation,
      progressColor,
      percentage,
      sceneCount
    };
  },

  export(fmt = 'txt') {
    const s = this.currentScript;
    const stats = this.calculateStats(s.storyboard?.length ? s.storyboard : s.content);
    let out = '';
    const rows = s.storyboard || [];

    if (fmt === 'md') {
      out = `# ${s.title}\n\n> **브랜드:** ${s.product?.brandNm || '일신비츠온'} | **예상시간:** ${stats.timeFormatted} (${stats.charCountWithSpaces}자, ${rows.length}개 씬)\n\n`;
      if (rows.length > 0) {
        out += `## 🎬 2단 콘티 (스토리보드)\n\n| 구성 | 번호 | 대본 (나레이션/대사) | 장면 (카메라/연출/짤) |\n|:---:|:---:|---|---|\n`;
        rows.forEach(r => {
          const scr = (r.script || '').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
          const scn = (r.scene || '').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
          out += `| ${r.section || '본문'} | ${r.num} | ${scr} | ${scn} |\n`;
        });
        out += `\n`;
      }
      out += `## ✍️ 대본 본문 (줄글)\n\n${s.content || ''}\n\n`;
      if (s.notes) out += `## 📒 제작 메모\n\n${s.notes}\n\n`;
      if (s.subtitles) out += `## 💬 자막 타임라인\n\n\`\`\`\n${s.subtitles}\n\`\`\`\n\n`;
      if (s.videoPrompts) out += `## 🤖 AI 영상 프롬프트\n\n${s.videoPrompts}\n`;
    } else {
      out = `==================================================\n[제목] ${s.title}\n[정보] 브랜드: ${s.product?.brandNm || '일신비츠온'} | 소요시간: ${stats.timeFormatted} (${stats.charCountWithSpaces}자)\n==================================================\n\n`;
      if (rows.length > 0) {
        out += `[2단 콘티 표]\n`;
        out += `구성\t번호\t대본\t장면\n`;
        rows.forEach(r => {
          const scr = (r.script || '').replace(/\t/g, ' ').replace(/\n/g, ' ');
          const scn = (r.scene || '').replace(/\t/g, ' ').replace(/\n/g, ' ');
          out += `${r.section || '본문'}\t${r.num}\t${scr}\t${scn}\n`;
        });
        out += `\n--------------------------------------------------\n\n`;
      }
      out += `[대본 본문]\n${s.content || ''}\n\n`;
      if (s.notes) out += `[메모장]\n${s.notes}\n\n`;
      if (s.subtitles) out += `[자막 타임라인]\n${s.subtitles}\n\n`;
      if (s.videoPrompts) out += `[AI 영상 프롬프트]\n${s.videoPrompts}\n`;
    }

    const blob = new Blob([out], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${s.title.replace(/[^\w\s가-힣]/g, '_')}.${fmt}`;
    a.click();
    URL.revokeObjectURL(url);
  },

  getStatusLabel(st) {
    const m = { planning: '기획중 📝', drafted: '대본완료 ✍️', filmed: '촬영완료 🎬', uploaded: '업로드완료 🚀' };
    return m[st] || '기획중 📝';
  }
};

// 6. Floating Progress Indicator Controller (Bottom-Left)
const ProgressIndicator = {
  activeTimer: null,

  start(title, initialSub = '작업 준비 중...', icon = '⚡') {
    const widget = document.getElementById('floatingProgressWidget');
    if (!widget) return;
    clearInterval(this.activeTimer);

    const iconEl = document.getElementById('fpwIcon');
    const titleEl = document.getElementById('fpwTitle');
    const subEl = document.getElementById('fpwSub');
    const percentEl = document.getElementById('fpwPercent');
    const fillEl = document.getElementById('fpwProgressFill');

    if (iconEl) iconEl.textContent = icon;
    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = initialSub;
    if (percentEl) percentEl.textContent = '8%';
    if (fillEl) {
      fillEl.style.width = '8%';
      fillEl.style.background = 'linear-gradient(90deg, #2563eb, #38bdf8)';
    }

    widget.classList.add('active');

    // Simulate progress smoothly from 8% up to ~88%
    let currentPct = 8;
    this.activeTimer = setInterval(() => {
      if (currentPct < 40) currentPct += Math.floor(Math.random() * 8) + 4;
      else if (currentPct < 72) currentPct += Math.floor(Math.random() * 4) + 2;
      else if (currentPct < 90) currentPct += 1;
      this.setProgress(currentPct);
    }, 300);
  },

  setProgress(pct, subText = null) {
    const clamped = Math.min(100, Math.max(0, Math.round(pct)));
    const percentEl = document.getElementById('fpwPercent');
    const fillEl = document.getElementById('fpwProgressFill');
    const subEl = document.getElementById('fpwSub');
    if (percentEl) percentEl.textContent = `${clamped}%`;
    if (fillEl) fillEl.style.width = `${clamped}%`;
    if (subText && subEl) subEl.textContent = subText;
  },

  complete(msg = '작업이 완료되었습니다! 👍') {
    clearInterval(this.activeTimer);
    this.setProgress(100, msg);
    const widget = document.getElementById('floatingProgressWidget');
    if (!widget) return;
    setTimeout(() => {
      widget.classList.remove('active');
    }, 1500);
  },

  error(msg = '작업 중 오류가 발생했습니다.') {
    clearInterval(this.activeTimer);
    const subEl = document.getElementById('fpwSub');
    if (subEl) subEl.textContent = msg;
    const fillEl = document.getElementById('fpwProgressFill');
    if (fillEl) fillEl.style.background = '#ef4444';
    const widget = document.getElementById('floatingProgressWidget');
    setTimeout(() => {
      widget?.classList.remove('active');
      if (fillEl) fillEl.style.background = '';
    }, 3000);
  }
};

// 7. MRO On-Demand Live Crawler Service
const MroCrawlerService = {
  getCachedProduct(code) {
    try {
      const cached = localStorage.getItem(`vcl_mro_crawl_${code}`);
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return null;
  },

  saveCachedProduct(p) {
    try {
      localStorage.setItem(`vcl_mro_crawl_${p.productCode}`, JSON.stringify(p));
    } catch (e) {}
  },

  getSavedProducts() {
    try {
      const raw = localStorage.getItem('vcl_crawled_db_products');
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) return list;
      }
    } catch (e) {}
    return [];
  },

  saveProductToDb(p) {
    if (!p || !p.productCode) return;
    p.isCrawled = true;
    p.isDb = true;

    // 1. Update in-memory window.VCL_PRODUCTS
    if (window.VCL_PRODUCTS) {
      const existingIdx = window.VCL_PRODUCTS.findIndex(item => String(item.productCode) === String(p.productCode));
      if (existingIdx >= 0) {
        window.VCL_PRODUCTS[existingIdx] = p;
      } else {
        window.VCL_PRODUCTS.unshift(p);
      }
    }

    // 2. Save to localStorage
    try {
      const list = this.getSavedProducts();
      const idx = list.findIndex(item => String(item.productCode) === String(p.productCode));
      if (idx >= 0) list[idx] = p;
      else list.unshift(p);
      localStorage.setItem('vcl_crawled_db_products', JSON.stringify(list));
      this.saveCachedProduct(p);
    } catch (e) {
      console.warn('localStorage save failed:', e);
    }

    // 3. Save to Firestore if available
    try {
      if (typeof firestoreDb !== 'undefined' && firestoreDb) {
        firestoreDb.collection('crawled_products').doc(String(p.productCode)).set(p).catch(err => {
          console.warn('Firestore crawl save error:', err);
        });
      }
    } catch (e) {}
  },

  initDbLoader() {
    // 1. Load from localStorage
    const saved = this.getSavedProducts();
    if (saved && saved.length > 0 && window.VCL_PRODUCTS) {
      saved.forEach(p => {
        p.isCrawled = true;
        p.isDb = true;
        if (!window.VCL_PRODUCTS.some(item => String(item.productCode) === String(p.productCode))) {
          window.VCL_PRODUCTS.unshift(p);
        }
      });
      console.log(`[VCL-Light] 로컬 DB에서 크롤링 상품 ${saved.length}종을 영구 로드했습니다.`);
    }

    // 2. Load from Firestore if online
    try {
      if (typeof firestoreDb !== 'undefined' && firestoreDb) {
        firestoreDb.collection('crawled_products').get().then(snap => {
          if (!snap.empty) {
            let count = 0;
            snap.forEach(doc => {
              const p = doc.data();
              if (p && p.productCode) {
                p.isCrawled = true;
                p.isDb = true;
                if (!window.VCL_PRODUCTS.some(item => String(item.productCode) === String(p.productCode))) {
                  window.VCL_PRODUCTS.unshift(p);
                  count++;
                }
              }
            });
            if (count > 0) {
              console.log(`[VCL-Light] Firestore에서 크롤링 상품 ${count}종을 동기화했습니다.`);
            }
          }
        }).catch(err => console.warn('Firestore load crawled error:', err));
      }
    } catch (e) {}
  },

  async fetchProductByCode(code) {
    const cleanCode = code.trim();
    if (!cleanCode) throw new Error('상품코드를 입력해주세요.');

    // 1. Check in-memory VCL_PRODUCTS first
    const inDb = ProductService.getByCode(cleanCode);
    if (inDb) return inDb;

    // 2. Check local cache
    const cached = this.getCachedProduct(cleanCode);
    if (cached) {
      this.saveProductToDb(cached);
      return cached;
    }

    // 3. Fetch HTML via CORS proxy
    const targetUrl = `https://vitsonmro.com/mro/shop/productDetail.do?productCode=${encodeURIComponent(cleanCode)}`;
    const proxies = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
      `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`
    ];

    let html = '';
    let lastError = null;

    for (const proxyUrl of proxies) {
      try {
        const resp = await fetch(proxyUrl, { headers: { 'Accept': 'text/html' } });
        if (resp.ok) {
          const text = await resp.text();
          if (text && text.includes('productCode')) {
            html = text;
            break;
          }
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (!html || !html.includes('productCode')) {
      throw new Error(`비츠온MRO에서 상품코드 [${cleanCode}]를 찾을 수 없거나 회원 전용 상품입니다.`);
    }

    // 4. Parse HTML
    const product = this.parseMroHtml(html, cleanCode);
    if (!product || !product.productNm) {
      throw new Error('상품 제원을 추출하지 못했습니다.');
    }

    this.saveProductToDb(product);
    return product;
  },

  parseMroHtml(html, code) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Title / Name
    let productNm = '';
    const nmMatch = html.match(/productNm\s*:\s*['"]([^'"]+)['"]/);
    if (nmMatch) productNm = nmMatch[1];
    if (!productNm) {
      const nameEl = doc.querySelector('.product-name, .vits-product-summary .product-name, h3.title, .pd-title');
      if (nameEl) productNm = nameEl.textContent.trim();
    }
    if (!productNm) {
      const ogTitle = doc.querySelector('meta[property="og:title"]');
      if (ogTitle && ogTitle.content && !ogTitle.content.includes('온라인 쇼핑몰')) {
        productNm = ogTitle.content.trim();
      }
    }
    if (!productNm) productNm = `MRO 상품 [${code}]`;

    // Picture
    let pictureNm = '';
    const picMatch = html.match(/pictureNm\s*:\s*['"]([^'"]+)['"]/);
    if (picMatch) pictureNm = picMatch[1];
    if (!pictureNm) {
      const imgEl = doc.querySelector('.swiper-slide img[data-main-img], .pd-gallery img, .vits-deal-gallery img');
      if (imgEl && imgEl.src) pictureNm = imgEl.src;
    }
    if (!pictureNm || pictureNm.includes('preparing')) {
      pictureNm = `https://vitsonimg.co.kr/images/productsNew/${code.slice(0, 2)}/${code}.jpg`;
    }

    // Brand
    let brandNm = '비츠온';
    const brandMatch = html.match(/brandNm\s*:\s*['"]([^'"]+)['"]/);
    if (brandMatch) brandNm = brandMatch[1];
    else if (html.includes('홈빛')) brandNm = '홈빛';

    // Model & Standard
    let modelName = code;
    const modelMatch = html.match(/modelName\s*:\s*['"]([^'"]+)['"]/);
    if (modelMatch) modelName = modelMatch[1];

    let standard = '';
    const stdMatch = html.match(/standard\s*:\s*['"]([^'"]+)['"]/);
    if (stdMatch) standard = stdMatch[1];

    // Category Breadcrumbs
    const crumbs = [];
    doc.querySelectorAll('.vits-breadcrumb-menu a').forEach(a => {
      const txt = a.textContent.trim();
      if (txt && txt !== '홈') crumbs.push(txt);
    });

    // Detail Images
    const detailImages = [];
    const imgMatches = html.matchAll(/https:\/\/vitsonimg\.co\.kr\/images\/[^\s"'>]+/g);
    const seen = new Set();
    for (const m of imgMatches) {
      let src = m[0].replace(/[\\)]+$/, '');
      if (!seen.has(src) && !src.includes('preparing') && !src.includes('banner')) {
        seen.add(src);
        detailImages.push(src);
      }
    }

    // Specs
    const specs = {
      '상품코드': code,
      '브랜드': brandNm,
      '모델명': modelName,
      '규격': standard || 'MRO 정품 규격'
    };

    doc.querySelectorAll('.filter-box-item').forEach(item => {
      const title = item.querySelector('.title-text')?.textContent.trim();
      const activeChip = item.querySelector(`.filter-chip[data-product-code*="${code}"]`);
      if (title && activeChip) {
        specs[title] = activeChip.textContent.trim();
      }
    });

    return {
      productCode: code,
      productNm: productNm,
      brandNm: brandNm,
      modelName: modelName,
      standard: standard || (brandNm + ' 정품'),
      pictureNm: pictureNm,
      category1: crumbs[0] || 'MRO 크롤링',
      category2: crumbs[1] || '실시간 수집 품목',
      category3: crumbs[2] || '',
      maker: brandNm,
      unitPrice: '-',
      weightKg: '-',
      icons: '<span class="basic_ic" style="background:#2563eb; color:#fff;">MRO실시간</span>',
      specs: specs,
      detailImages: detailImages,
      detailUrl: `https://vitsonmro.com/mro/shop/productDetail.do?productCode=${code}`
    };
  }
};

// 8. UI App Controller
const App = {
  saveTimer: null,

  async init() {
    MroCrawlerService.initDbLoader();
    ScriptService.initNew();
    this.reindexStoryboard();
    this.bindEvents();

    await TemplateService.loadTemplates();
    await ScriptService.loadAll();

    this.renderRecommendations('all');
    this.renderTemplateDropdown();
    this.updateEditorUI();
    this.renderStorageList();
    this.renderTemplateList();

    const recs = ProductService.currentRecommendations;
    if (recs && recs.length > 0) {
      this.selectProduct(recs[0]);
    }
    this.showToast('VCL-Light 준비 완료! (비츠온MRO 정품 220여 종 탑재)', 'success');
  },

  bindEvents() {
    // Navigation
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchView(btn.dataset.view);
      });
    });

    // Filters
    document.querySelectorAll('.filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.renderRecommendations(pill.dataset.filter);
      });
    });

    // Reroll
    document.getElementById('btnReroll').addEventListener('click', () => {
      const activeFilter = document.querySelector('.filter-pill.active')?.dataset.filter || 'all';
      this.renderRecommendations(activeFilter);
      this.showToast('새로운 추천 아이템 5종을 셔플했습니다! 🎲');
    });

    // Search
    const searchInput = document.getElementById('productSearchInput');
    const btnSearch = document.getElementById('btnSearchProduct');
    const doSearch = () => {
      const q = searchInput.value.trim();
      if (!q) { this.renderRecommendations('all'); return; }
      const results = ProductService.search(q);
      if (results.length > 0) {
        ProductService.currentRecommendations = results.slice(0, 5);
        this.renderRecommendationCards(ProductService.currentRecommendations);
        this.selectProduct(results[0]);
        this.showToast(`검색 결과 ${results.length}건 중 상위 5건을 표시합니다.`);
      } else {
        this.renderSearchFallback(q);
      }
    };
    btnSearch.addEventListener('click', doSearch);
    searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

    // Detail Tabs
    document.querySelectorAll('.detail-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.detail-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.detail-tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`detailTab_${btn.dataset.tab}`).classList.add('active');
      });
    });

    // Insert Specs
    document.getElementById('btnInsertSpecs').addEventListener('click', () => {
      this.promptScriptInsertion('specs', mode => this.insertSpecs(mode));
    });
    document.getElementById('btnToolbarInsertSpecs').addEventListener('click', () => {
      this.promptScriptInsertion('specs', mode => this.insertSpecs(mode));
    });

    // AI Analysis
    document.getElementById('btnRunAiAnalysis').addEventListener('click', () => this.runAiAnalysis());

    // Title, Status, Content inputs
    document.getElementById('scriptTitleInput').addEventListener('input', e => {
      ScriptService.currentScript.title = e.target.value;
      this.updatePrintHeader();
      this.debounceAutoSave();
    });
    document.getElementById('scriptStatusSelect').addEventListener('change', e => {
      ScriptService.currentScript.status = e.target.value;
      this.debounceAutoSave();
    });

    // Product Link & Name Input
    document.getElementById('scriptProductInput')?.addEventListener('input', e => {
      const val = e.target.value.trim();
      if (!ScriptService.currentScript.product) ScriptService.currentScript.product = {};
      ScriptService.currentScript.product.productNm = val;
      this.updatePrintHeader();
      this.debounceAutoSave();
    });

    document.getElementById('btnSyncCurrentProduct')?.addEventListener('click', () => {
      const p = ProductService.currentSelected;
      if (!p) {
        this.showToast('왼쪽 추천/검색창에서 선택된 제품이 없습니다.', 'error');
        return;
      }
      ScriptService.currentScript.product = {
        productCode: p.productCode,
        productNm: p.productNm,
        brandNm: p.brandNm,
        standard: p.standard,
        modelName: p.modelName,
        pictureNm: p.pictureNm
      };
      const prodInput = document.getElementById('scriptProductInput');
      if (prodInput) prodInput.value = `[${p.brandNm}] ${p.productNm}`;
      this.updatePrintHeader();
      this.debounceAutoSave();
      this.showToast(`대상 제품을 [${p.brandNm}] ${p.productNm}(으)로 변경했습니다! 🔄`, 'success');
    });

    document.getElementById('btnClearProductLink')?.addEventListener('click', () => {
      if (ScriptService.currentScript.product) {
        ScriptService.currentScript.product.productNm = '';
      }
      const prodInput = document.getElementById('scriptProductInput');
      if (prodInput) prodInput.value = '';
      this.updatePrintHeader();
      this.debounceAutoSave();
      this.showToast('제품명 표시를 숨김 처리했습니다. (인쇄 시 제품명 미출력)', 'info');
    });

    // Directly editable Print Header Product text
    document.getElementById('sbPrintProduct')?.addEventListener('input', e => {
      let text = e.target.innerText.replace(/^제품:\s*/, '').trim();
      const prodInput = document.getElementById('scriptProductInput');
      if (prodInput) prodInput.value = text;
      if (!ScriptService.currentScript.product) ScriptService.currentScript.product = {};
      ScriptService.currentScript.product.productNm = text;
      if (!text) {
        e.target.classList.add('hidden-print');
      } else {
        e.target.classList.remove('hidden-print');
      }
      this.debounceAutoSave();
    });
    document.getElementById('scriptContent').addEventListener('input', e => {
      ScriptService.currentScript.content = e.target.value;
      this.updateStats();
      this.debounceAutoSave();
    });
    document.getElementById('notepadContent').addEventListener('input', e => {
      ScriptService.currentScript.notes = e.target.value;
      this.debounceAutoSave();
    });

    // Save
    document.getElementById('btnSaveScript').addEventListener('click', async () => {
      await ScriptService.saveCurrent();
      this.showToast('대본이 안전하게 저장되었습니다! 💾', 'success');
      this.renderStorageList();
    });

    // Toolbar actions
    document.getElementById('templateSelectDropdown').addEventListener('change', e => {
      if (e.target.value) {
        this.applyTemplate(e.target.value);
        e.target.value = '';
      }
    });

    document.getElementById('btnAiShorts').addEventListener('click', () => {
      this.promptScriptInsertion('shorts', mode => this.runAiShorts(mode));
    });
    document.getElementById('btnAiLongform').addEventListener('click', () => {
      this.promptScriptInsertion('longform', mode => this.runAiLongform(mode));
    });
    document.getElementById('btnAiSubtitles').addEventListener('click', () => this.runAiSubtitles());
    document.getElementById('btnAiVideoPrompts').addEventListener('click', () => this.runAiPrompts());

    document.getElementById('btnCopyScript').addEventListener('click', () => {
      const c = ScriptService.currentScript.content;
      if (!c) { this.showToast('복사할 대본이 없습니다.', 'error'); return; }
      navigator.clipboard.writeText(c);
      this.showToast('대본이 클립보드에 복사되었습니다! 📋', 'success');
    });

    document.getElementById('btnExportTxt').addEventListener('click', () => ScriptService.export('txt'));
    document.getElementById('btnExportMd').addEventListener('click', () => ScriptService.export('md'));

    // Editor Sub-Tabs
    document.querySelectorAll('.editor-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.editor-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.editor-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`editorPane_${btn.dataset.tab}`).classList.add('active');
      });
    });

    // Storage View
    document.getElementById('btnNewScript').addEventListener('click', () => {
      ScriptService.initNew(ProductService.currentSelected);
      this.updateEditorUI();
      this.switchView('studio');
      this.showToast('새 대본을 생성했습니다.');
    });

    document.getElementById('storageSearchInput').addEventListener('input', e => {
      this.renderStorageList(e.target.value);
    });

    // Template Modal
    document.getElementById('btnOpenNewTemplateModal').addEventListener('click', () => {
      document.getElementById('templateModalTitle').textContent = '새 템플릿 등록';
      document.getElementById('tplInputId').value = '';
      document.getElementById('tplInputTitle').value = '';
      document.getElementById('tplInputCategory').value = '비츠온/숏폼';
      document.getElementById('tplInputDesc').value = '';
      document.getElementById('tplInputContent').value = '';
      document.getElementById('templateModal').classList.add('active');
    });

    document.getElementById('btnCloseTemplateModal').addEventListener('click', () => {
      document.getElementById('templateModal').classList.remove('active');
    });

    document.getElementById('btnSaveTemplate').addEventListener('click', async () => {
      const id = document.getElementById('tplInputId').value;
      const title = document.getElementById('tplInputTitle').value.trim();
      const category = document.getElementById('tplInputCategory').value.trim();
      const description = document.getElementById('tplInputDesc').value.trim();
      const content = document.getElementById('tplInputContent').value.trim();
      if (!title || !content) { alert('제목과 본문을 입력해주세요.'); return; }
      if (id) {
        await TemplateService.updateTemplate(id, { title, category, description, content });
        this.showToast('템플릿이 수정되었습니다.', 'success');
      } else {
        await TemplateService.createTemplate({ title, category, description, content });
        this.showToast('새 템플릿이 등록되었습니다.', 'success');
      }
      document.getElementById('templateModal').classList.remove('active');
      this.renderTemplateList();
      this.renderTemplateDropdown();
    });

    // Quick Add Custom Product Handlers
    document.getElementById('btnOpenQuickProductModal')?.addEventListener('click', () => {
      const q = document.getElementById('productSearchInput')?.value.trim() || '';
      this.openQuickProductModal(q);
    });

    document.getElementById('btnCloseCustomProductModal')?.addEventListener('click', () => {
      document.getElementById('customProductModal')?.classList.remove('active');
    });

    document.getElementById('btnSaveCustomProduct')?.addEventListener('click', () => {
      const name = document.getElementById('cpInputName').value.trim();
      const brand = document.getElementById('cpSelectBrand').value;
      const code = document.getElementById('cpInputCode').value.trim();
      const standard = document.getElementById('cpInputStandard').value.trim();
      const specsRaw = document.getElementById('cpInputSpecs').value.trim();

      if (!name) {
        alert('제품명을 입력해주세요.');
        return;
      }

      // Parse specs lines
      const specsObj = {};
      if (specsRaw) {
        specsRaw.split('\n').forEach(line => {
          const trimmed = line.trim();
          if (!trimmed) return;
          const colonIdx = trimmed.indexOf(':');
          if (colonIdx > 0) {
            const k = trimmed.substring(0, colonIdx).trim();
            const v = trimmed.substring(colonIdx + 1).trim();
            if (k && v) specsObj[k] = v;
          } else {
            specsObj[`특징_${Object.keys(specsObj).length + 1}`] = trimmed;
          }
        });
      }

      const generatedCode = code || ('CUSTOM_' + Date.now().toString().slice(-6));
      const customP = {
        productCode: generatedCode,
        productNm: name,
        brandNm: brand,
        modelName: code || '직접입력',
        standard: standard || (brand + ' 정품'),
        pictureNm: 'https://vitsonimg.co.kr/images/productsNew/preparing.jpg',
        maker: brand,
        unitPrice: '-',
        weightKg: '-',
        icons: '<span class="basic_ic" style="background:#10b981; color:#fff;">직접등록</span>',
        specs: specsObj,
        detailImages: [],
        detailUrl: code ? `https://vitsonmro.com/mro/shop/productDetail.do?productCode=${code}` : ''
      };

      if (window.VCL_PRODUCTS) {
        window.VCL_PRODUCTS.unshift(customP);
      }

      document.getElementById('customProductModal')?.classList.remove('active');
      this.selectProduct(customP);
      this.renderRecommendationCards([customP, ...ProductService.products.slice(0, 4)]);
      this.showToast(`[${name}] 제품이 성공적으로 등록되어 기획 스튜디오에 선택되었습니다! 🚀`, 'success');
    });

    // 📢 Changelog Modal Handlers
    document.getElementById('btnOpenChangelog')?.addEventListener('click', () => {
      document.getElementById('changelogModal')?.classList.add('active');
    });
    document.getElementById('btnCloseChangelogModal')?.addEventListener('click', () => {
      document.getElementById('changelogModal')?.classList.remove('active');
    });
    document.getElementById('btnCloseChangelogFooter')?.addEventListener('click', () => {
      document.getElementById('changelogModal')?.classList.remove('active');
    });

    // 📖 User Guide Modal Handlers
    document.getElementById('btnOpenUserGuide')?.addEventListener('click', () => {
      document.getElementById('userGuideModal')?.classList.add('active');
    });
    document.getElementById('btnCloseUserGuideModal')?.addEventListener('click', () => {
      document.getElementById('userGuideModal')?.classList.remove('active');
    });
    document.getElementById('btnCloseUserGuideFooter')?.addEventListener('click', () => {
      document.getElementById('userGuideModal')?.classList.remove('active');
    });

    // 🖼️ Image Lightbox Modal Handlers
    document.getElementById('btnCloseImageViewerModal')?.addEventListener('click', () => {
      this.closeImageViewer();
    });
    document.getElementById('imageViewerModal')?.addEventListener('click', e => {
      if (e.target.id === 'imageViewerModal') {
        this.closeImageViewer();
      }
    });

    // ESC Key to close all modals
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        this.closeImageViewer();
        document.getElementById('changelogModal')?.classList.remove('active');
        document.getElementById('userGuideModal')?.classList.remove('active');
        document.getElementById('confirmScriptOverwriteModal')?.classList.remove('active');
        document.getElementById('excelPasteModal')?.classList.remove('active');
        document.getElementById('customProductModal')?.classList.remove('active');
      }
    });

    // ⚠️ Script Overwrite Modal Close Handlers
    document.getElementById('btnCloseOverwriteModal')?.addEventListener('click', () => {
      document.getElementById('confirmScriptOverwriteModal')?.classList.remove('active');
    });
    document.getElementById('btnOverwriteCancel')?.addEventListener('click', () => {
      document.getElementById('confirmScriptOverwriteModal')?.classList.remove('active');
    });

    // 🎬 2-Column Storyboard Table Handlers
    document.getElementById('btnAddStoryboardRow')?.addEventListener('click', () => {
      this.addStoryboardRow();
    });

    document.getElementById('btnClearStoryboardTable')?.addEventListener('click', () => {
      this.clearStoryboardTable();
    });

    document.getElementById('btnOpenPasteExcelModal')?.addEventListener('click', () => {
      const modal = document.getElementById('excelPasteModal');
      const input = document.getElementById('excelPasteInput');
      if (input) input.value = '';
      if (modal) modal.classList.add('active');
      setTimeout(() => input?.focus(), 100);
    });

    document.getElementById('btnCloseExcelPasteModal')?.addEventListener('click', () => {
      document.getElementById('excelPasteModal')?.classList.remove('active');
    });

    document.getElementById('btnApplyExcelPaste')?.addEventListener('click', () => {
      const input = document.getElementById('excelPasteInput');
      const raw = input?.value || '';
      if (!raw.trim()) {
        alert('붙여넣을 엑셀 대본 내용을 입력해주세요.');
        return;
      }
      ProgressIndicator.start('📋 엑셀 대본 표 변환', '셀 줄바꿈 보존 및 콘티 표 동기화 중...', '📋');
      const rows = ScriptService.parseExcelText(raw);
      if (rows.length === 0) {
        ProgressIndicator.error('대본 행을 인식하지 못했습니다.');
        alert('인식 가능한 대본 행이 없습니다. 탭 또는 줄바꿈으로 구분된 텍스트를 입력해주세요.');
        return;
      }
      ScriptService.currentScript.storyboard = rows;
      this.reindexStoryboard();
      ScriptService.currentScript.content = ScriptService.storyboardToText(rows);
      this.renderStoryboardTable();
      this.updateStats();
      this.debounceAutoSave();
      document.getElementById('excelPasteModal')?.classList.remove('active');
      ProgressIndicator.complete(`총 ${rows.length}개 씬을 콘티 표로 완벽 동기화했습니다!`);
      this.showToast(`엑셀 대본 ${rows.length}개 행을 콘티 표로 성공적으로 가져왔습니다! 📋`, 'success');
    });

    document.getElementById('btnCopyStoryboardExcel')?.addEventListener('click', () => {
      this.copyStoryboardToExcel();
    });

    document.getElementById('btnSyncScriptToStoryboard')?.addEventListener('click', () => {
      this.syncScriptToStoryboard();
    });

    document.getElementById('btnSyncStoryboardToScript')?.addEventListener('click', () => {
      this.syncStoryboardToScript();
    });

    // 🖨️ Clean A4 1-Page Print Buttons (Toolbar & Tab)
    document.getElementById('btnPrintStoryboardBtn')?.addEventListener('click', () => {
      this.printStoryboard();
    });

    document.getElementById('btnPrintStoryboardToolbar')?.addEventListener('click', () => {
      this.printStoryboard();
    });

    // Script Preview Modal Handlers
    document.getElementById('btnCloseScriptPreviewModal')?.addEventListener('click', () => {
      document.getElementById('scriptPreviewModal')?.classList.remove('active');
    });

    document.getElementById('btnPreviewLoadToStudio')?.addEventListener('click', () => {
      if (this.previewingScript) {
        this.loadScriptToStudio(this.previewingScript);
      }
    });

    document.getElementById('btnPreviewPrint')?.addEventListener('click', () => {
      if (this.previewingScript) {
        this.loadScriptToStudio(this.previewingScript);
        this.switchEditorTab('storyboard');
        setTimeout(() => window.print(), 300);
      }
    });
  },

  switchView(v) {
    document.querySelectorAll('.nav-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.view === v));
    document.querySelectorAll('.app-view').forEach(view => view.classList.remove('active'));
    document.getElementById(`view_${v}`).classList.add('active');
    if (v === 'storage') this.renderStorageList();
    else if (v === 'templates') this.renderTemplateList();
  },

  renderRecommendations(filter = 'all') {
    const items = ProductService.getRandom5(filter);
    this.renderRecommendationCards(items);
  },

  renderRecommendationCards(items) {
    const strip = document.getElementById('recCardsStrip');
    strip.innerHTML = '';
    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'rec-card';
      if (ProductService.currentSelected?.productCode === item.productCode) card.classList.add('selected');

      let badgeClass = 'badge-mro';
      if (item.brandNm === '비츠온') badgeClass = 'badge-vitson';
      else if (item.brandNm === '홈빛') badgeClass = 'badge-homevit';

      const isCrawled = item.isCrawled || item.category1 === 'MRO 크롤링';
      const dbBadgeHtml = isCrawled 
        ? `<span class="rec-db-badge badge-mro-db" title="MRO 수집 후 DB 저장된 상품">DB(MRO)</span>`
        : `<span class="rec-db-badge" title="VCL 표준 DB 등록 상품">DB</span>`;

      card.innerHTML = `
        <div class="rec-card-thumb">
          <img src="${item.pictureNm || 'https://vitsonimg.co.kr/images/productsNew/preparing.jpg'}" alt="${item.productNm}" onerror="this.src='https://vitsonimg.co.kr/images/productsNew/preparing.jpg'" />
        </div>
        <div class="rec-card-badges">
          <span class="rec-brand-badge ${badgeClass}">${item.brandNm}</span>
          ${dbBadgeHtml}
        </div>
        <div class="rec-card-name" title="${item.productNm}">${item.productNm}</div>
        <div class="rec-card-standard">${item.standard || item.modelName || '기본 규격'}</div>
      `;
      card.addEventListener('click', () => this.selectProduct(item));
      strip.appendChild(card);
    });
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  openQuickProductModal(prefill = '') {
    const modal = document.getElementById('customProductModal');
    if (!modal) return;

    const isNumeric = /^\d{3,8}$/.test(prefill);
    document.getElementById('cpInputName').value = isNumeric ? '' : prefill;
    document.getElementById('cpInputCode').value = isNumeric ? prefill : '';
    document.getElementById('cpInputStandard').value = '';
    document.getElementById('cpInputSpecs').value = '';

    const hint = document.getElementById('cpMroLinkHint');
    if (isNumeric && hint) {
      hint.innerHTML = `<a href="https://vitsonmro.com/mro/shop/productDetail.do?productCode=${prefill}" target="_blank" style="color: #60a5fa; text-decoration: underline;">비츠온MRO 상품페이지 열기 ↗</a>`;
    } else if (hint) {
      hint.innerHTML = '';
    }

    modal.classList.add('active');
  },

  renderSearchFallback(q) {
    const strip = document.getElementById('recCardsStrip');
    strip.innerHTML = '';

    const isNumeric = /^\d{3,10}$/.test(q);
    const mroUrl = isNumeric 
      ? `https://vitsonmro.com/mro/shop/productDetail.do?productCode=${q}`
      : `https://vitsonmro.com/mro/shop/productList.do?keyword=${encodeURIComponent(q)}`;

    const card = document.createElement('div');
    card.className = 'search-fallback-card';
    card.innerHTML = `
      <div class="fallback-badge">⚡ 비츠온MRO 하이브리드 연동 & AI 즉시 기획</div>
      <h4 class="fallback-title">🔍 '${this.escapeHtml(q)}' 검색 결과 (VCL 로컬 DB 미포함)</h4>
      <p class="fallback-desc">
        현재 로컬 DB에 등록되지 않은 비츠온/홈빛/MRO 상품입니다.<br>
        <strong>비츠온MRO 공식몰</strong>에서 1초 만에 제원과 이미지를 실시간 수집하거나, 직접 입력하여 AI 대본을 작성할 수 있습니다.
      </p>
      <div class="fallback-actions">
        ${isNumeric ? `
          <button id="btnCrawlMroFallback" class="btn-mro-view-lg" style="background: linear-gradient(135deg, #2563eb, #1d4ed8); border: none; cursor: pointer; color: #fff; font-weight: 700; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);">
            ⚡ 비츠온MRO에서 상품코드 [${q}] 실시간 스펙 긁어오기 🚀
          </button>
        ` : ''}
        <a href="${mroUrl}" target="_blank" rel="noopener noreferrer" class="btn-mro-view-lg">
          🛒 MRO 공식몰에서 ${isNumeric ? `[${q}]` : `'${this.escapeHtml(q)}'`} 직접 열기 ↗
        </a>
        <button id="btnOpenQuickAddFromFallback" class="btn-quick-add-lg">
          ➕ 제원 직접 입력 & AI 기획
        </button>
      </div>
    `;

    strip.appendChild(card);

    document.getElementById('btnCrawlMroFallback')?.addEventListener('click', () => {
      this.crawlMroProduct(q);
    });

    document.getElementById('btnOpenQuickAddFromFallback')?.addEventListener('click', () => {
      this.openQuickProductModal(q);
    });
  },

  async crawlMroProduct(code) {
    const existing = ProductService.getByCode(code);
    if (existing) {
      this.selectProduct(existing);
      ProductService.currentRecommendations = [existing, ...ProductService.currentRecommendations.filter(x => x.productCode !== existing.productCode).slice(0, 4)];
      this.renderRecommendationCards(ProductService.currentRecommendations);
      this.showToast(`[${existing.productNm}] 이미 DB에 등록된 상품입니다! 즉시 로드했습니다. 👍`, 'success');
      return;
    }

    ProgressIndicator.start('🌐 비츠온MRO 실시간 크롤링', `상품코드 [${code}] 상세페이지 수집 중...`, '🌐');
    try {
      ProgressIndicator.setProgress(35, 'CORS 프록시 연결 및 MRO 페이지 로딩...');
      const p = await MroCrawlerService.fetchProductByCode(code);
      ProgressIndicator.setProgress(80, '제원 및 고해상도 이미지 파싱 완료...');
      
      MroCrawlerService.saveProductToDb(p);
      ProductService.currentRecommendations = [p, ...ProductService.currentRecommendations.filter(x => x.productCode !== p.productCode).slice(0, 4)];
      this.renderRecommendationCards(ProductService.currentRecommendations);
      this.selectProduct(p);
      ProgressIndicator.complete(`[${p.productNm}] 수집 및 DB 영구 저장 완료!`);
      this.showToast(`비츠온MRO에서 [${p.productNm}] 스펙을 성공적으로 긁어와 DB에 저장했습니다! 🚀`, 'success');
    } catch (err) {
      ProgressIndicator.error(err.message);
      this.showToast(`MRO 크롤링 실패: ${err.message}`, 'error');
    }
  },

  openImageViewer(src, title = '제품 상세 이미지') {
    const modal = document.getElementById('imageViewerModal');
    const img = document.getElementById('imageViewerImg');
    const titleEl = document.getElementById('imageViewerTitle');
    const linkEl = document.getElementById('btnImageViewerOpenOriginal');
    if (!modal || !img) return;

    img.src = src;
    if (titleEl) titleEl.textContent = title;
    if (linkEl) linkEl.href = src;
    modal.classList.add('active');
  },

  closeImageViewer() {
    document.getElementById('imageViewerModal')?.classList.remove('active');
  },

  selectProduct(p) {
    ProductService.currentSelected = p;
    document.querySelectorAll('.rec-card').forEach(c => c.classList.remove('selected'));
    const cards = document.querySelectorAll('.rec-card');
    const idx = ProductService.currentRecommendations.findIndex(item => item.productCode === p.productCode);
    if (idx >= 0 && cards[idx]) cards[idx].classList.add('selected');

    this.renderProductDetail(p);

    const s = ScriptService.currentScript;
    if (s) {
      // If current script has no content, OR if its product was the default sample (1010043332), OR if no product is attached:
      const isDefaultSample = s.product?.productCode === '1010043332' || !s.product?.productNm;
      if (!s.content || isDefaultSample) {
        s.product = {
          productCode: p.productCode,
          productNm: p.productNm,
          brandNm: p.brandNm,
          standard: p.standard,
          modelName: p.modelName,
          pictureNm: p.pictureNm
        };
        if (!s.content || s.title?.includes('루미앤 큐브 멀티탭') || !s.title) {
          s.title = `[${p.brandNm}] ${p.productNm} 콘텐츠 기획`;
        }
        this.updateEditorUI();
      }
    }
  },

  renderProductDetail(p) {
    let badgeClass = 'badge-mro';
    if (p.brandNm === '비츠온') badgeClass = 'badge-vitson';
    else if (p.brandNm === '홈빛') badgeClass = 'badge-homevit';

    const mainImgEl = document.getElementById('detailMainImg');
    mainImgEl.src = p.pictureNm || 'https://vitsonimg.co.kr/images/productsNew/preparing.jpg';
    mainImgEl.style.cursor = 'zoom-in';
    mainImgEl.title = '클릭하여 확대 모달로 보기';
    mainImgEl.onclick = () => this.openImageViewer(mainImgEl.src, p.productNm);

    document.getElementById('detailBrandBadge').className = `detail-brand-badge ${badgeClass}`;
    document.getElementById('detailBrandBadge').textContent = p.brandNm;
    document.getElementById('detailTitle').textContent = p.productNm;
    document.getElementById('detailStandard').textContent = `규격: ${p.standard || '기본 규격'}`;
    document.getElementById('detailModel').textContent = `모델명: ${p.modelName || 'N/A'}`;
    document.getElementById('detailCode').textContent = `상품코드: ${p.productCode}`;
    document.getElementById('btnMroView').href = `https://vitsonmro.com/mro/shop/productDetail.do?productCode=${p.productCode}`;

    // Specs
    const tbody = document.getElementById('specsTableBody');
    tbody.innerHTML = '';
    const baseSpecs = [
      { label: '브랜드', value: p.brandNm },
      { label: '품명', value: p.productNm },
      { label: '규격', value: p.standard || '-' },
      { label: '모델명', value: p.modelName || '-' },
      { label: '카테고리', value: `${p.category1 || ''} > ${p.category2 || ''}` },
      { label: '제조사/공급', value: p.maker || '(주)일신비츠온' }
    ];
    if (p.specs) {
      for (const [k, v] of Object.entries(p.specs)) {
        if (v && v !== '해당사항없음' && !baseSpecs.some(b => b.label === k)) baseSpecs.push({ label: k, value: v });
      }
    }
    baseSpecs.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<th>${s.label}</th><td>${s.value}</td>`;
      tbody.appendChild(tr);
    });

    // Images
    const imgGal = document.getElementById('detailImagesGallery');
    imgGal.innerHTML = '';
    const hasDetailImgs = p.detailImages && p.detailImages.length > 0;

    if (hasDetailImgs) {
      const topBar = document.createElement('div');
      topBar.style.cssText = 'grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 0.82rem; color: var(--text-muted); background: rgba(15, 23, 42, 0.6); padding: 8px 14px; border-radius: 6px; border: 1px solid var(--border-subtle);';
      topBar.innerHTML = `
        <span>📷 총 <strong>${p.detailImages.length}개</strong>의 고해상도 상세 이미지 (클릭 시 확대 모달)</span>
        <a href="https://vitsonmro.com/mro/shop/productDetail.do?productCode=${p.productCode}" target="_blank" style="color: #60a5fa; text-decoration: underline; font-weight: 600;">비츠온MRO 원본 보기 ↗</a>
      `;
      imgGal.appendChild(topBar);

      p.detailImages.forEach(src => {
        const im = document.createElement('img');
        im.className = 'detail-gallery-img';
        im.src = src;
        im.loading = 'lazy';
        im.title = '클릭하여 화면 중앙 모달로 크게 보기';
        im.style.cursor = 'zoom-in';
        im.onerror = () => { im.style.display = 'none'; };
        im.onclick = () => this.openImageViewer(src, `${p.productNm} 상세 이미지`);
        imgGal.appendChild(im);
      });
    } else {
      const mainImgSrc = p.pictureNm || 'https://vitsonimg.co.kr/images/productsNew/preparing.jpg';
      imgGal.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 20px; background: rgba(15, 23, 42, 0.4); border-radius: 8px; border: 1px solid var(--border-subtle);">
          <div style="font-size: 0.82rem; color: #94a3b8; margin-bottom: 12px; font-weight: 600;">
            📌 <strong>MRO 공식 대표 이미지</strong> (추가 상세 이미지 미등록 품목)
          </div>
          <img src="${mainImgSrc}" style="max-height: 250px; border-radius: 8px; margin: 0 auto; display: block; border: 1px solid var(--border-subtle); cursor: zoom-in;" onerror="this.src='https://vitsonimg.co.kr/images/productsNew/preparing.jpg'" onclick="App.openImageViewer('${mainImgSrc}', '${p.productNm}')" title="클릭하여 확대 모달로 보기" />
          <div style="margin-top: 14px;">
            <a href="https://vitsonmro.com/mro/shop/productDetail.do?productCode=${p.productCode}" target="_blank" class="btn-mro-view" style="display: inline-block; padding: 7px 16px; font-size: 0.82rem; text-decoration: none; border-radius: 6px;">
              🛒 비츠온MRO 공식몰에서 상세 도면 / 인증서 전체 확인 ↗
            </a>
          </div>
        </div>
      `;
    }

    if (p.aiAnalysis) {
      this.renderAiAnalysisResult(p.aiAnalysis);
    } else {
      document.getElementById('aiAnalysisResult').innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 0.85rem;">아래 <strong>[Gemini AI 제품 분석 실행]</strong> 버튼을 누르면<br>스펙 기반 핵심 셀링포인트, 타겟층, 바이럴 훅 5종이 도출됩니다.</div>`;
    }
  },

  renderAiAnalysisResult(res) {
    if (!res) return;
    const container = document.getElementById('aiAnalysisResult');
    if (!container) return;

    let hooksHtml = (res.viralHooks || []).map((h, idx) => `
      <div class="viral-hook-item" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; padding: 8px 10px; background: rgba(30, 41, 59, 0.6); border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.08);">
        <span style="flex: 1; font-size: 0.82rem; color: #f1f5f9; line-height: 1.4;">${h}</span>
        <div style="display: flex; gap: 4px; flex-shrink: 0;">
          <button class="btn-copy-hook" onclick="navigator.clipboard.writeText('${h.replace(/'/g, "\\'")}'); App.showToast('복사되었습니다! 📋', 'success');" style="padding: 4px 8px; font-size: 0.72rem; border-radius: 4px; background: rgba(255,255,255,0.1); border: none; color: #cbd5e1; cursor: pointer;">복사</button>
          <button class="btn-hook-to-script" onclick="App.createScriptFromHook('${h.replace(/'/g, "\\'")}')" style="padding: 4px 8px; font-size: 0.72rem; border-radius: 4px; background: #2563eb; border: none; color: #fff; cursor: pointer; font-weight: 600;" title="이 훅을 첫 문장으로 쇼츠 대본 작성">⚡ 이 훅으로 작성</button>
        </div>
      </div>
    `).join('');
    let spHtml = (res.sellingPoints || []).map(s => `<li style="margin-bottom: 4px; font-size: 0.82rem; color: #e2e8f0;">${s}</li>`).join('');

    container.innerHTML = `
      <div class="ai-card-block" style="background: rgba(30, 41, 59, 0.7); border-radius: 8px; padding: 12px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.08);">
        <h4 style="font-size: 0.86rem; color: #fbbf24; margin-bottom: 6px;">💡 1줄 핵심 요약</h4>
        <p style="font-size: 0.86rem; color: #fff; font-weight: 600; line-height: 1.4; margin: 0;">${res.oneLineSummary || ''}</p>
      </div>
      <div class="ai-card-block" style="background: rgba(30, 41, 59, 0.7); border-radius: 8px; padding: 12px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.08);">
        <h4 style="font-size: 0.86rem; color: #60a5fa; margin-bottom: 6px;">🎯 추천 타겟 고객</h4>
        <p style="font-size: 0.82rem; color: #93c5fd; line-height: 1.4; margin: 0;">${res.targetAudience || ''}</p>
      </div>
      <div class="ai-card-block" style="background: rgba(30, 41, 59, 0.7); border-radius: 8px; padding: 12px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.08);">
        <h4 style="font-size: 0.86rem; color: #34d399; margin-bottom: 6px;">⭐ 스펙 기반 핵심 셀링포인트 (USP)</h4>
        <ul style="padding-left: 18px; margin: 0;">${spHtml}</ul>
      </div>
      <div class="ai-card-block" style="background: rgba(30, 41, 59, 0.7); border-radius: 8px; padding: 12px; margin-bottom: 12px; border: 1px solid rgba(255,255,255,0.08);">
        <h4 style="font-size: 0.86rem; color: #f87171; margin-bottom: 8px;">🔥 숏폼/릴스 추천 바이럴 훅 (Hook 5선)</h4>
        <div>${hooksHtml}</div>
      </div>

      <!-- 🚀 Direct Actions from Analysis -->
      <div class="ai-analysis-actions" style="display: flex; gap: 8px; margin-top: 10px;">
        <button id="btnAiShortsFromAnalysis" class="btn-save-script" style="flex: 1; padding: 9px; font-size: 0.82rem; background: #2563eb; display: flex; align-items: center; justify-content: center; gap: 5px; cursor: pointer;">
          🎬 이 분석으로 쇼츠 작성
        </button>
        <button id="btnAiLongformFromAnalysis" class="btn-save-script" style="flex: 1; padding: 9px; font-size: 0.82rem; background: #4f46e5; display: flex; align-items: center; justify-content: center; gap: 5px; cursor: pointer;">
          🎥 이 분석으로 롱폼 작성
        </button>
      </div>
    `;

    document.getElementById('btnAiShortsFromAnalysis')?.addEventListener('click', () => {
      this.promptScriptInsertion('shorts', mode => this.runAiShorts(mode));
    });
    document.getElementById('btnAiLongformFromAnalysis')?.addEventListener('click', () => {
      this.promptScriptInsertion('longform', mode => this.runAiLongform(mode));
    });
  },

  async runAiAnalysis() {
    const p = ProductService.currentSelected;
    if (!p) { this.showToast('제품을 먼저 선택해주세요.', 'error'); return; }
    const btn = document.getElementById('btnRunAiAnalysis');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Gemini가 제원 분석 중...`;
    ProgressIndicator.start('✨ Gemini AI 제품 제원 분석', '핵심 USP 및 바이럴 훅 도출 중...', '✨');

    try {
      const res = await GeminiService.analyzeProduct(p);
      p.aiAnalysis = res;
      ProductService.currentAiAnalysis = res;
      this.renderAiAnalysisResult(res);
      ProgressIndicator.complete('AI 제원 분석 완료! 🚀');
      this.showToast('AI 제원 분석이 완료되었습니다! 아래 버튼으로 대본을 즉시 작성할 수 있습니다. 🚀', 'success');
    } catch (e) {
      ProgressIndicator.error('AI 분석 실패: ' + e.message);
      this.showToast('AI 분석 에러: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `✨ Gemini AI 제품 분석 실행`;
    }
  },

  createScriptFromHook(hookText) {
    this.promptScriptInsertion('hook', mode => this.runAiShortsWithHook(mode, hookText));
  },

  async runAiShortsWithHook(mode = 'replace', hookText = '') {
    const p = ProductService.currentSelected;
    if (!p) { this.showToast('제품을 선택해주세요.', 'error'); return; }
    const btn = document.getElementById('btnAiShorts');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> 훅 기반 대본 작성 중...`;
    ProgressIndicator.start('🔥 바이럴 훅 기반 쇼츠 대본', '오프닝 문구 및 2단 콘티 대본 생성 중...', '🔥');
    try {
      const aiAnalysis = p.aiAnalysis || ProductService.currentAiAnalysis || null;
      const text = await GeminiService.generateShortsScript(p, ScriptService.currentScript.notes, aiAnalysis, hookText);
      if (mode === 'append' && ScriptService.currentScript.content) {
        ScriptService.currentScript.content = `${ScriptService.currentScript.content}\n\n[추가 생성 대본: 훅 적용]\n${text}`.trim();
      } else {
        ScriptService.currentScript.content = text;
      }
      ScriptService.currentScript.title = `[쇼츠] ${p.brandNm} ${p.productNm} - ${hookText.slice(0, 15)}...`;
      this.updateEditorUI();
      this.switchEditorTab('script');
      ProgressIndicator.complete('쇼츠 대본 작성 완료! ⚡');
      this.showToast(`선택하신 훅으로 쇼츠 대본이 [대본 줄글]에 성공적으로 작성되었습니다! ⚡`, 'success');
      this.debounceAutoSave();
    } catch (e) {
      ProgressIndicator.error('쇼츠 대본 작성 실패: ' + e.message);
      this.showToast('쇼츠 대본 작성 에러: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `⚡ AI 쇼츠 대본 (1분)`;
    }
  },

  promptScriptInsertion(type, onConfirm) {
    const curContent = (ScriptService.currentScript?.content || '').trim();
    const modal = document.getElementById('confirmScriptOverwriteModal');
    if (!modal) {
      if (curContent && !confirm('현재 대본 줄글에 내용이 있습니다. 덮어쓰시겠습니까? (취소 시 아래에 이어붙임)')) {
        onConfirm('append');
      } else {
        onConfirm('replace');
      }
      return;
    }

    const titleEl = document.getElementById('overwriteModalTitle');
    const warnTitleEl = document.getElementById('overwriteWarningTitle');
    const warnMsgEl = document.getElementById('overwriteWarningMsg');
    const warnBox = document.getElementById('overwriteWarningBox');
    const btnReplace = document.getElementById('btnOverwriteReplace');
    const btnAppend = document.getElementById('btnOverwriteAppend');
    const btnCancel = document.getElementById('btnOverwriteCancel');
    const btnClose = document.getElementById('btnCloseOverwriteModal');

    const typeNames = {
      shorts: '⚡ AI 쇼츠 대본 (1분)',
      longform: '🎥 AI 롱폼 대본',
      specs: '📋 제품 제원 요약 스펙',
      hook: '🔥 바이럴 훅 기반 쇼츠 대본'
    };
    const actionName = typeNames[type] || '새 대본';

    if (titleEl) titleEl.textContent = `📌 [대본 줄글] ${actionName} 적용 안내`;

    if (!curContent) {
      // Empty content: confirm creation
      if (warnBox) {
        warnBox.style.display = 'block';
        warnBox.style.borderColor = 'rgba(59, 130, 246, 0.4)';
        warnBox.style.background = 'rgba(30, 58, 138, 0.25)';
      }
      if (warnTitleEl) {
        warnTitleEl.textContent = `📝 새 대본을 [대본 줄글]에 작성하시겠습니까?`;
        warnTitleEl.style.color = '#93c5fd';
      }
      if (warnMsgEl) {
        warnMsgEl.innerHTML = `선택하신 <strong>[${actionName}]</strong>이(가) <strong>[✍️ 대본 줄글]</strong> 탭에 즉시 작성됩니다.<br><span style="font-size: 0.8rem; color: #cbd5e1;">(작성 후 상단 [🔄 줄글 ➔ 표 변환]을 누르면 2단 콘티 표로 자동 변환됩니다.)</span>`;
      }
      if (btnAppend) btnAppend.style.display = 'none';
      if (btnReplace) {
        btnReplace.textContent = '🚀 대본 작성 시작';
        btnReplace.style.background = '#2563eb';
      }
    } else {
      // Content exists: ask overwrite vs append
      if (warnBox) {
        warnBox.style.display = 'block';
        warnBox.style.borderColor = 'rgba(239, 68, 68, 0.4)';
        warnBox.style.background = 'rgba(239, 68, 68, 0.1)';
      }
      if (warnTitleEl) {
        warnTitleEl.textContent = `⚠️ 현재 작성 중인 대본 (${curContent.length}자)이 있습니다!`;
        warnTitleEl.style.color = '#fca5a5';
      }
      if (warnMsgEl) {
        warnMsgEl.innerHTML = `선택하신 <strong>[${actionName}]</strong> 내용이 <strong>[✍️ 대본 줄글]</strong> 탭에 추가됩니다.<br>기존 작업 내용을 어떻게 처리할까요?`;
      }
      if (btnAppend) {
        btnAppend.style.display = 'inline-block';
        btnAppend.textContent = '➕ 아래에 이어붙이기';
      }
      if (btnReplace) {
        btnReplace.textContent = '🔄 덮어쓰기 (새로 작성)';
        btnReplace.style.background = '#dc2626';
      }
    }

    const newBtnReplace = btnReplace.cloneNode(true);
    const newBtnAppend = btnAppend ? btnAppend.cloneNode(true) : null;
    const newBtnCancel = btnCancel.cloneNode(true);
    const newBtnClose = btnClose.cloneNode(true);

    btnReplace.parentNode.replaceChild(newBtnReplace, btnReplace);
    if (newBtnAppend && btnAppend) btnAppend.parentNode.replaceChild(newBtnAppend, btnAppend);
    btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
    btnClose.parentNode.replaceChild(newBtnClose, btnClose);

    const closeModal = () => modal.classList.remove('active');

    newBtnReplace.addEventListener('click', () => {
      closeModal();
      onConfirm('replace');
    });

    if (newBtnAppend) {
      newBtnAppend.addEventListener('click', () => {
        closeModal();
        onConfirm('append');
      });
    }

    newBtnCancel.addEventListener('click', closeModal);
    newBtnClose.addEventListener('click', closeModal);

    modal.classList.add('active');
  },

  async runAiShorts(mode = 'replace') {
    const p = ProductService.currentSelected;
    if (!p) { this.showToast('제품을 선택해주세요.', 'error'); return; }
    const btn = document.getElementById('btnAiShorts');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> 대본 작성 중...`;
    ProgressIndicator.start('⚡ AI 쇼츠 대본 작성', '50초 숏폼 4단계 대본 작성 중...', '⚡');
    try {
      const aiAnalysis = p.aiAnalysis || ProductService.currentAiAnalysis || null;
      const text = await GeminiService.generateShortsScript(p, ScriptService.currentScript.notes, aiAnalysis);
      if (mode === 'append' && ScriptService.currentScript.content) {
        ScriptService.currentScript.content = `${ScriptService.currentScript.content}\n\n[추가 생성 대본]\n${text}`.trim();
      } else {
        ScriptService.currentScript.content = text;
      }
      this.updateEditorUI();
      this.switchEditorTab('script');
      const analysisNotice = aiAnalysis ? ' (✨ AI 제품 분석 결과 반영)' : '';
      ProgressIndicator.complete('AI 쇼츠 대본 작성 완료! ⚡');
      this.showToast(`AI 쇼츠 대본이 [대본 줄글] 탭에 작성되었습니다! ✍️${analysisNotice}`, 'success');
      this.debounceAutoSave();
    } catch (e) {
      ProgressIndicator.error('대본 생성 실패: ' + e.message);
      this.showToast('대본 생성 실패: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `⚡ AI 쇼츠 대본 (1분)`;
    }
  },

  async runAiLongform(mode = 'replace') {
    const p = ProductService.currentSelected;
    if (!p) { this.showToast('제품을 선택해주세요.', 'error'); return; }
    const btn = document.getElementById('btnAiLongform');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> 롱폼 작성 중...`;
    ProgressIndicator.start('🎥 AI 롱폼 대본 작성', '3~4분 유튜브 심층 리뷰 대본 작성 중...', '🎥');
    try {
      const aiAnalysis = p.aiAnalysis || ProductService.currentAiAnalysis || null;
      const text = await GeminiService.generateLongFormScript(p, ScriptService.currentScript.notes, aiAnalysis);
      if (mode === 'append' && ScriptService.currentScript.content) {
        ScriptService.currentScript.content = `${ScriptService.currentScript.content}\n\n[추가 롱폼 대본]\n${text}`.trim();
      } else {
        ScriptService.currentScript.content = text;
      }
      this.updateEditorUI();
      this.switchEditorTab('script');
      const analysisNotice = aiAnalysis ? ' (✨ AI 제품 분석 결과 반영)' : '';
      ProgressIndicator.complete('AI 롱폼 대본 작성 완료! 🎥');
      this.showToast(`AI 롱폼 대본이 [대본 줄글] 탭에 작성되었습니다! ✍️${analysisNotice}`, 'success');
      this.debounceAutoSave();
    } catch (e) {
      ProgressIndicator.error('대본 생성 실패: ' + e.message);
      this.showToast('대본 생성 실패: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `🎥 AI 롱폼 대본`;
    }
  },

  async runAiSubtitles() {
    const c = ScriptService.currentScript.content;
    if (!c) { this.showToast('대본 본문을 먼저 작성해주세요.', 'error'); return; }
    const btn = document.getElementById('btnAiSubtitles');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> 자막 분할 중...`;
    ProgressIndicator.start('💬 자막 타임라인 분할', '대본 문장 단위 자막 분할 및 싱크 계산 중...', '💬');
    try {
      const sub = await GeminiService.generateSubtitles(c);
      ScriptService.currentScript.subtitles = sub;
      document.getElementById('subtitlesOutput').textContent = sub;
      this.switchEditorTab('subtitles');
      ProgressIndicator.complete('자막 타임라인 분할 완료! 💬');
      this.showToast('자막 타임라인 분할 완료! 📝', 'success');
    } catch (e) {
      ProgressIndicator.error('자막 분할 실패: ' + e.message);
      this.showToast('자막 분할 실패: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `💬 자막 분할`;
    }
  },

  async runAiPrompts() {
    const p = ProductService.currentSelected;
    const c = ScriptService.currentScript.content;
    if (!p || !c) { this.showToast('제품 선택 및 대본 작성이 필요합니다.', 'error'); return; }
    const btn = document.getElementById('btnAiVideoPrompts');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> 프롬프트 생성 중...`;
    ProgressIndicator.start('🤖 AI 영상 프롬프트 생성', 'Runway/Kling 비디오 프롬프트 생성 중...', '🤖');
    try {
      const vp = await GeminiService.generateVideoPrompts(p, c);
      ScriptService.currentScript.videoPrompts = vp;
      document.getElementById('videoPromptsOutput').textContent = vp;
      this.switchEditorTab('prompts');
      ProgressIndicator.complete('영상 프롬프트 생성 완료! 🤖');
      this.showToast('AI 비디오 프롬프트 생성 완료! 🤖', 'success');
    } catch (e) {
      ProgressIndicator.error('프롬프트 생성 실패: ' + e.message);
      this.showToast('프롬프트 생성 실패: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `🤖 AI 영상 프롬프트`;
    }
  },

  insertSpecs(mode = 'append') {
    const p = ProductService.currentSelected;
    if (!p) { this.showToast('선택된 제품이 없습니다.', 'error'); return; }
    ProgressIndicator.start('📋 제품 제원 요약', '제원 스펙 대본 줄글로 삽입 중...', '📋');
    const text = ProductService.getSpecsSummaryText(p);
    const cur = ScriptService.currentScript.content || '';
    if (mode === 'replace') {
      ScriptService.currentScript.content = `[제품 제원 요약]\n${text}`;
    } else {
      ScriptService.currentScript.content = cur ? `${cur}\n\n[제품 제원 요약]\n${text}` : `[제품 제원 요약]\n${text}`;
    }
    this.updateEditorUI();
    this.switchEditorTab('script');
    ProgressIndicator.complete('제품 제원 요약 삽입 완료! 📋');
    this.showToast('제품 스펙이 [✍️ 대본 줄글] 탭에 추가되었습니다! 📋', 'success');
    this.debounceAutoSave();
  },

  applyTemplate(id) {
    const tpl = TemplateService.getById(id);
    const p = ProductService.currentSelected;
    if (!tpl) return;
    const content = p ? TemplateService.applyVariables(tpl.content, p) : tpl.content;
    ScriptService.currentScript.content = content;
    if (tpl.storyboard && Array.isArray(tpl.storyboard)) {
      ScriptService.currentScript.storyboard = p ? TemplateService.applyVariablesToStoryboard(tpl.storyboard, p) : JSON.parse(JSON.stringify(tpl.storyboard));
    } else {
      ScriptService.currentScript.storyboard = ScriptService.textToStoryboard(content);
    }
    this.updateEditorUI();
    this.showToast(`[${tpl.title}] 템플릿 적용 완료!`, 'success');
    this.debounceAutoSave();
  },

  switchEditorTab(t) {
    document.querySelectorAll('.editor-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
    document.querySelectorAll('.editor-pane').forEach(p => p.classList.remove('active'));
    document.getElementById(`editorPane_${t}`)?.classList.add('active');
  },

  updateEditorUI() {
    const s = ScriptService.currentScript;
    document.getElementById('scriptTitleInput').value = s.title || '';
    document.getElementById('scriptStatusSelect').value = s.status || 'planning';

    const prodInput = document.getElementById('scriptProductInput');
    if (prodInput) {
      if (s.product && s.product.productNm) {
        prodInput.value = s.product.brandNm ? `[${s.product.brandNm}] ${s.product.productNm}` : s.product.productNm;
      } else {
        prodInput.value = '';
      }
    }
    document.getElementById('scriptContent').value = s.content || '';
    document.getElementById('notepadContent').value = s.notes || '';
    document.getElementById('subtitlesOutput').textContent = s.subtitles || '대본 툴바의 [자막 분할] 버튼을 누르면 타임라인 자막이 생성됩니다.';
    document.getElementById('videoPromptsOutput').textContent = s.videoPrompts || '대본 툴바의 [AI 영상 프롬프트] 버튼을 누르면 Runway/Kling용 프롬프트가 생성됩니다.';
    this.renderStoryboardTable();
    this.updateStats();
  },

  updateStats() {
    const s = ScriptService.currentScript;
    const stats = ScriptService.calculateStats(s.storyboard?.length ? s.storyboard : s.content);
    document.getElementById('statCharCount').textContent = `${stats.charCountWithSpaces}자`;
    document.getElementById('statDuration').textContent = stats.timeFormatted;
    const badge = document.getElementById('statBadge');
    badge.textContent = stats.recommendation;
    badge.style.color = stats.progressColor;
    const fill = document.getElementById('statProgressFill');
    fill.style.width = `${stats.percentage}%`;
    fill.style.background = stats.progressColor;
    this.updatePrintHeader();
  },

  // 🎬 Storyboard Table Renderer & Management
  reindexStoryboard() {
    const rows = ScriptService.currentScript?.storyboard;
    if (Array.isArray(rows)) {
      rows.forEach((r, idx) => {
        r.num = idx + 1;
      });
    }
  },

  clearStoryboardTable() {
    if (confirm('콘티 표의 모든 내용을 지우고 기본 15칸 빈 표로 초기화하시겠습니까?\n(작성 중이던 대본과 연출 내용이 모두 비워집니다)')) {
      ScriptService.currentScript.storyboard = ScriptService.createBlankStoryboard(15);
      this.reindexStoryboard();
      this.renderStoryboardTable();
      this.updateStats();
      this.debounceAutoSave();
      this.showToast('콘티 표를 기본 15칸 빈 표로 초기화했습니다. 🗑️', 'info');
    }
  },

  renderStoryboardTable() {
    const tbody = document.getElementById('storyboardTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const rows = ScriptService.currentScript?.storyboard || [];
    this.reindexStoryboard();

    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px;">콘티 행이 없습니다. 상단의 [➕ 행 추가] 또는 [📋 엑셀 붙여넣기]를 눌러보세요.</td></tr>`;
      this.updatePrintHeader();
      return;
    }

    rows.forEach((r, idx) => {
      const tr = document.createElement('tr');
      tr.dataset.index = idx;

      // 1. 구성 (Section Dropdown)
      const tdSec = document.createElement('td');
      tdSec.style.textAlign = 'center';
      const secSelect = document.createElement('select');
      secSelect.className = 'sb-select-section';
      ['도입', '본문', '엔딩'].forEach(sec => {
        const opt = document.createElement('option');
        opt.value = sec;
        opt.textContent = sec;
        if ((r.section || '본문') === sec) opt.selected = true;
        secSelect.appendChild(opt);
      });
      secSelect.addEventListener('change', (e) => {
        r.section = e.target.value;
        this.debounceAutoSave();
      });
      tdSec.appendChild(secSelect);

      // 2. 번호 (Row Number - Strictly 1-based index)
      const tdNum = document.createElement('td');
      tdNum.className = 'sb-row-no';
      tdNum.textContent = idx + 1;

      // 3. 대본 (Script Cell - editable)
      const tdScript = document.createElement('td');
      const divScript = document.createElement('div');
      divScript.className = 'sb-cell-editable sb-cell-script';
      divScript.contentEditable = 'true';
      divScript.textContent = r.script || '';
      divScript.addEventListener('input', () => {
        r.script = divScript.innerText;
        this.updateStats();
        this.debounceAutoSave();
      });
      tdScript.appendChild(divScript);

      // 4. 장면 (Scene Cell - editable)
      const tdScene = document.createElement('td');
      const divScene = document.createElement('div');
      divScene.className = 'sb-cell-editable sb-cell-scene';
      divScene.contentEditable = 'true';
      divScene.textContent = r.scene || '';
      divScene.addEventListener('input', () => {
        r.scene = divScene.innerText;
        this.debounceAutoSave();
      });
      tdScene.appendChild(divScene);

      // 5. 관리 (Actions Cell)
      const tdAct = document.createElement('td');
      tdAct.className = 'col-actions';
      tdAct.innerHTML = `
        <div style="display: flex; gap: 2px; justify-content: center;">
          <button class="btn-row-action up" title="위로 이동" ${idx === 0 ? 'disabled style="opacity:0.3"' : ''}>▲</button>
          <button class="btn-row-action down" title="아래로 이동" ${idx === rows.length - 1 ? 'disabled style="opacity:0.3"' : ''}>▼</button>
          <button class="btn-row-action delete" title="행 삭제" style="color: #f87171;">✕</button>
        </div>
      `;

      tdAct.querySelector('.up')?.addEventListener('click', () => this.moveStoryboardRow(idx, -1));
      tdAct.querySelector('.down')?.addEventListener('click', () => this.moveStoryboardRow(idx, 1));
      tdAct.querySelector('.delete')?.addEventListener('click', () => this.deleteStoryboardRow(idx));

      tr.appendChild(tdSec);
      tr.appendChild(tdNum);
      tr.appendChild(tdScript);
      tr.appendChild(tdScene);
      tr.appendChild(tdAct);
      tbody.appendChild(tr);
    });

    this.updatePrintHeader();
  },

  addStoryboardRow(section = '본문', script = '', scene = '') {
    if (!ScriptService.currentScript.storyboard) {
      ScriptService.currentScript.storyboard = [];
    }
    const rows = ScriptService.currentScript.storyboard;
    const newRow = { section, num: rows.length + 1, script, scene };
    rows.push(newRow);
    this.reindexStoryboard();
    this.renderStoryboardTable();
    this.updateStats();
    this.debounceAutoSave();

    const lastRowDiv = document.querySelector('#storyboardTableBody tr:last-child .sb-cell-script');
    if (lastRowDiv) {
      lastRowDiv.focus();
    }
  },

  deleteStoryboardRow(idx) {
    const rows = ScriptService.currentScript?.storyboard;
    if (!rows || idx < 0 || idx >= rows.length) return;
    rows.splice(idx, 1);
    this.reindexStoryboard();
    this.renderStoryboardTable();
    this.updateStats();
    this.debounceAutoSave();
    this.showToast('콘티 행이 삭제되었습니다.');
  },

  moveStoryboardRow(idx, dir) {
    const rows = ScriptService.currentScript?.storyboard;
    if (!rows) return;
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= rows.length) return;
    const temp = rows[idx];
    rows[idx] = rows[targetIdx];
    rows[targetIdx] = temp;
    this.reindexStoryboard();
    this.renderStoryboardTable();
    this.debounceAutoSave();
  },

  copyStoryboardToExcel() {
    const rows = ScriptService.currentScript?.storyboard || [];
    if (rows.length === 0) {
      this.showToast('복사할 콘티 표가 없습니다.', 'error');
      return;
    }
    const header = ['구성', '번호', '대본', '장면'].join('\t');
    const lines = rows.map(r => {
      const scr = (r.script || '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
      const scn = (r.scene || '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
      return [r.section || '본문', r.num, scr, scn].join('\t');
    });
    const tsv = header + '\n' + lines.join('\n');
    navigator.clipboard.writeText(tsv).then(() => {
      this.showToast('콘티 표가 엑셀 형식으로 복사되었습니다! 엑셀에서 Ctrl+V 하세요. 📋', 'success');
    }).catch(() => {
      this.showToast('클립보드 복사 실패', 'error');
    });
  },

  syncScriptToStoryboard() {
    const content = ScriptService.currentScript?.content || '';
    if (!content.trim()) {
      this.showToast('변환할 대본 줄글이 없습니다.', 'error');
      return;
    }
    ProgressIndicator.start('🎬 줄글 ➔ 콘티 표 변환', '문장별 대본 및 촬영 구도 분석 중...', '🎬');
    const rows = ScriptService.textToStoryboard(content);
    if (rows.length === 0) {
      ProgressIndicator.error('변환 가능한 문장이 없습니다.');
      this.showToast('변환 가능한 문장이 없습니다.', 'error');
      return;
    }
    ScriptService.currentScript.storyboard = rows;
    this.renderStoryboardTable();
    this.switchEditorTab('storyboard');
    this.updateStats();
    this.debounceAutoSave();
    ProgressIndicator.complete(`콘티 표(${rows.length}개 행) 변환 완료!`);
    this.showToast(`대본 줄글을 콘티 표(${rows.length}개 행)로 변환했습니다! 🎬`, 'success');
  },

  syncStoryboardToScript() {
    const rows = ScriptService.currentScript?.storyboard || [];
    if (rows.length === 0) {
      this.showToast('동기화할 콘티 표가 없습니다.', 'error');
      return;
    }
    ProgressIndicator.start('✍️ 콘티 표 ➔ 줄글 동기화', '대본 줄글 텍스트 재구성 중...', '✍️');
    const text = ScriptService.storyboardToText(rows);
    ScriptService.currentScript.content = text;
    document.getElementById('scriptContent').value = text;
    this.switchEditorTab('script');
    this.updateStats();
    this.debounceAutoSave();
    ProgressIndicator.complete('대본 줄글 동기화 완료! ✍️');
    this.showToast('콘티 표의 내용을 대본 줄글로 동기화했습니다! ✍️', 'success');
  },

  updatePrintHeader() {
    const s = ScriptService.currentScript;
    if (!s) return;
    const stats = ScriptService.calculateStats(s.storyboard?.length ? s.storyboard : s.content);
    
    // Check if custom product text or s.product
    let rawProdName = '';
    const prodInput = document.getElementById('scriptProductInput');
    if (prodInput && prodInput.value.trim()) {
      rawProdName = prodInput.value.trim();
    } else if (s.product && s.product.productNm) {
      rawProdName = s.product.brandNm ? `[${s.product.brandNm}] ${s.product.productNm}` : s.product.productNm;
    }

    const elTitle = document.getElementById('sbPrintTitle');
    const elProd = document.getElementById('sbPrintProduct');
    const elDur = document.getElementById('sbPrintDuration');
    const elChar = document.getElementById('sbPrintChar');
    const elDate = document.getElementById('sbPrintDate');

    if (elTitle) elTitle.textContent = s.title || '콘텐츠 제작 2단 콘티';
    
    if (elProd) {
      if (!rawProdName || rawProdName === '-' || rawProdName.toLowerCase() === 'none') {
        elProd.textContent = '';
        elProd.classList.add('hidden-print');
        elProd.style.display = 'none';
      } else {
        elProd.classList.remove('hidden-print');
        elProd.style.display = '';
        elProd.textContent = rawProdName.startsWith('제품:') ? rawProdName : `제품: ${rawProdName}`;
      }
    }
    if (elDur) elDur.textContent = `예상 소요 시간: ${stats.timeFormatted}`;
    if (elChar) elChar.textContent = `글자 수: ${stats.charCountWithSpaces}자 (${s.storyboard?.length || 0}개 씬)`;
    if (elDate) elDate.textContent = `(주)일신비츠온 콘텐츠랩 • ${new Date().toLocaleDateString('ko-KR')}`;
  },

  printStoryboard() {
    this.switchEditorTab('storyboard');
    this.updatePrintHeader();
    setTimeout(() => {
      window.print();
    }, 150);
  },

  debounceAutoSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(async () => {
      await ScriptService.saveCurrent();
      console.log('Autosaved.');
    }, 1500);
  },

  renderStorageList(keyword = '') {
    const container = document.getElementById('storageGrid');
    container.innerHTML = '';
    const scripts = ScriptService.scripts;
    const filtered = keyword ? scripts.filter(s =>
      s.title.toLowerCase().includes(keyword.toLowerCase()) ||
      s.content.toLowerCase().includes(keyword.toLowerCase()) ||
      (s.product?.brandNm && s.product.brandNm.toLowerCase().includes(keyword.toLowerCase()))
    ) : scripts;

    if (filtered.length === 0) {
      container.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">저장된 대본이 없습니다. 스튜디오에서 대본을 작성해보세요!</div>`;
      return;
    }

    filtered.forEach(s => {
      const stats = ScriptService.calculateStats(s.storyboard?.length ? s.storyboard : s.content);
      const card = document.createElement('div');
      card.className = 'script-card';
      const dateStr = s.updatedAt ? new Date(s.updatedAt).toLocaleDateString('ko-KR') : '';

      card.innerHTML = `
        <div class="script-card-header">
          <span class="rec-brand-badge ${s.product?.brandNm === '홈빛' ? 'badge-homevit' : 'badge-vitson'}">${s.product?.brandNm || '일신비츠온'}</span>
          <span style="font-size: 0.72rem; color: var(--text-muted);">${ScriptService.getStatusLabel(s.status)}</span>
        </div>
        <div class="script-card-title">${s.title}</div>
        <div class="script-card-preview">${s.content || '(대본 본문 없음)'}</div>
        <div class="script-card-footer">
          <span>${stats.timeFormatted} (${stats.charCountWithSpaces}자) • ${dateStr}</span>
          <div class="script-card-btns">
            <button class="btn-card-action btn-preview" style="background: rgba(37, 99, 235, 0.2); color: #60a5fa; border: 1px solid rgba(37, 99, 235, 0.4);">👁️ 미리보기</button>
            <button class="btn-card-action btn-load">열기</button>
            <button class="btn-card-action btn-dup">복제</button>
            <button class="btn-card-action btn-del" style="color: #f87171;">삭제</button>
          </div>
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.closest('.script-card-btns')) return;
        this.openScriptPreview(s);
      });

      card.querySelector('.btn-preview').addEventListener('click', (e) => {
        e.stopPropagation();
        this.openScriptPreview(s);
      });

      card.querySelector('.btn-load').addEventListener('click', (e) => {
        e.stopPropagation();
        this.loadScriptToStudio(s);
      });

      card.querySelector('.btn-dup').addEventListener('click', async (e) => {
        e.stopPropagation();
        await ScriptService.duplicate(s.id);
        this.renderStorageList(keyword);
        this.showToast('대본이 복제되었습니다.');
      });

      card.querySelector('.btn-del').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`'${s.title}' 대본을 삭제하시겠습니까?`)) {
          await ScriptService.delete(s.id);
          this.renderStorageList(keyword);
          this.showToast('대본이 삭제되었습니다.');
        }
      });

      container.appendChild(card);
    });
  },

  previewingScript: null,

  openScriptPreview(s) {
    if (!s) return;
    this.previewingScript = s;
    const modal = document.getElementById('scriptPreviewModal');
    if (!modal) return;

    // 1. Title & Badges
    document.getElementById('previewModalTitle').textContent = s.title || '대본 미리보기';
    const badgesContainer = document.getElementById('previewModalBadges');
    const brandNm = s.product?.brandNm || '일신비츠온';
    badgesContainer.innerHTML = `
      <span class="rec-brand-badge ${brandNm === '홈빛' ? 'badge-homevit' : 'badge-vitson'}">${brandNm}</span>
      <span style="font-size: 0.72rem; background: #334155; color: #94a3b8; padding: 2px 7px; border-radius: 4px; font-weight: 600;">${ScriptService.getStatusLabel(s.status)}</span>
    `;

    // 2. Meta
    const stats = ScriptService.calculateStats(s.storyboard?.length ? s.storyboard : s.content);
    const dateStr = s.updatedAt ? new Date(s.updatedAt).toLocaleString('ko-KR') : '-';
    const prodStr = s.product ? `[${s.product.brandNm || ''}] ${s.product.productNm || ''} (${s.product.productCode || '-'})` : '지정된 제품 없음';

    document.getElementById('previewModalMeta').innerHTML = `
      <div class="script-preview-meta-item">⏱️ 예상 소요: <strong>${stats.timeFormatted}</strong></div>
      <div class="script-preview-meta-item">📝 글자 수: <strong>${stats.charCountWithSpaces}자</strong></div>
      <div class="script-preview-meta-item">📦 제품: <strong>${this.escapeHtml(prodStr)}</strong></div>
      <div class="script-preview-meta-item">📅 최종 수정: <strong>${dateStr}</strong></div>
    `;

    // 3. Storyboard Rows
    let rows = s.storyboard;
    if (!rows || rows.length === 0) {
      if (s.content) rows = ScriptService.textToStoryboard(s.content);
      else rows = [];
    }
    const tbody = document.getElementById('previewStoryboardTbody');
    tbody.innerHTML = '';
    document.getElementById('previewSbRowCount').textContent = `(${rows.length}행)`;

    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 25px;">콘티 표 데이터가 없습니다.</td></tr>`;
    } else {
      rows.forEach((r, idx) => {
        const tr = document.createElement('tr');
        const secColor = r.section === '도입' ? '#38bdf8' : r.section === '엔딩' ? '#a78bfa' : '#94a3b8';
        tr.innerHTML = `
          <td style="text-align:center; font-weight:700; color:${secColor};">${r.section || '본문'}</td>
          <td style="text-align:center; color:#64748b; font-weight:700;">${idx + 1}</td>
          <td style="white-space:pre-wrap; line-height:1.5;">${this.escapeHtml(r.script || '-')}</td>
          <td style="white-space:pre-wrap; color:#94a3b8; line-height:1.5;">${this.escapeHtml(r.scene || '-')}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    // 4. Script Text
    const textEl = document.getElementById('previewScriptText');
    const textContent = s.content || (rows.length > 0 ? ScriptService.storyboardToText(rows) : '');
    textEl.textContent = textContent || '(작성된 대본 줄글이 없습니다)';

    // Open modal
    modal.classList.add('active');
  },

  loadScriptToStudio(s) {
    if (!s) return;
    ScriptService.currentScript = JSON.parse(JSON.stringify(s));
    if (!ScriptService.currentScript.storyboard || ScriptService.currentScript.storyboard.length === 0) {
      if (ScriptService.currentScript.content) {
        ScriptService.currentScript.storyboard = ScriptService.textToStoryboard(ScriptService.currentScript.content);
      } else {
        ScriptService.currentScript.storyboard = ScriptService.createBlankStoryboard(15);
      }
    }
    this.reindexStoryboard();
    if (s.product) {
      const m = ProductService.getByCode(s.product.productCode);
      if (m) ProductService.currentSelected = m;
      else ProductService.currentSelected = s.product;
    }
    this.updateEditorUI();
    this.switchView('studio');
    document.getElementById('scriptPreviewModal')?.classList.remove('active');
    this.showToast(`[${s.title}] 대본을 스튜디오로 불러왔습니다.`);
  },

  renderTemplateDropdown() {
    const dd = document.getElementById('templateSelectDropdown');
    dd.innerHTML = '<option value="">📑 템플릿 선택하여 적용...</option>';
    TemplateService.templates.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.title;
      dd.appendChild(opt);
    });
  },

  renderTemplateList() {
    const container = document.getElementById('templateGrid');
    container.innerHTML = '';
    TemplateService.templates.forEach(t => {
      const card = document.createElement('div');
      card.className = 'template-card';
      const isDef = t.id.startsWith('tpl_');
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div class="template-card-title">${t.title}</div>
          <span class="rec-brand-badge badge-vitson">${t.category || '기본'}</span>
        </div>
        <div class="template-card-desc">${t.description || ''}</div>
        <div class="template-card-content">${t.content}</div>
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px;">
          <span style="font-size: 0.72rem; color: var(--text-muted);">${isDef ? '기본 제공 템플릿' : '커스텀 템플릿'}</span>
          <div style="display: flex; gap: 6px;">
            <button class="btn-card-action btn-apply">스튜디오에 적용</button>
            ${!isDef ? '<button class="btn-card-action btn-del-tpl" style="color: #f87171;">삭제</button>' : ''}
          </div>
        </div>
      `;
      card.querySelector('.btn-apply').addEventListener('click', () => {
        this.applyTemplate(t.id);
        this.switchView('studio');
      });
      if (!isDef) {
        const delBtn = card.querySelector('.btn-del-tpl');
        if (delBtn) {
          delBtn.addEventListener('click', async () => {
            if (confirm(`'${t.title}' 템플릿을 삭제하시겠습니까?`)) {
              await TemplateService.deleteTemplate(t.id);
              this.renderTemplateList();
              this.renderTemplateDropdown();
              this.showToast('템플릿이 삭제되었습니다.');
            }
          });
        }
      }
      container.appendChild(card);
    });
  },

  showToast(msg, type = 'info') {
    const cont = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    cont.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateY(10px)';
      setTimeout(() => t.remove(), 200);
    }, 3200);
  }
};

window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());
