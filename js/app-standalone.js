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

  async generateShortsScript(p, notes = '') {
    const sys = `당신은 100만 조회수 쇼츠를 만드는 (주)일신비츠온 전속 크리에이터입니다.
1인이 기획, 대본, 자막, 촬영, 출연, 편집까지 모두 진행하므로,
[화면 연출/행동 지문], [대사/나레이션], [화면 텍스트 자막]이 명확히 구분된 50초 내외 숏폼 스크립트를 작성하세요.`;
    const prompt = `[제품]: ${p.brandNm} ${p.productNm} (${p.standard || ''})
[모델]: ${p.modelName || ''}
[추가 메모]: ${notes || '빠르고 강렬한 전개'}

다음 구조로 50초 내외(공백 포함 350~450자) 숏폼 대본을 작성해 주세요:
1. [0~5초] 인트로 훅 (시선 사로잡는 오프닝 대사와 행동)
2. [5~20초] 문제 상황 & 공감대 형성
3. [20~40초] 비츠온/홈빛 제품 솔루션 & 스펙 실증
4. [40~50초] 아웃트로 및 CTA (비츠온MRO 구매 / 프로필 링크 유도)`;
    return await this.call(prompt, sys, 0.7);
  },

  async generateLongFormScript(p, notes = '') {
    const sys = `당신은 전기/조명/MRO 전문 리뷰 유튜버이자 (주)일신비츠온 콘텐츠 마스터입니다. 초보자도 쉽게 이해할 수 있는 3~4분 분량의 유튜브 롱폼 리뷰 및 설치/사용 가이드 대본을 작성합니다.`;
    const prompt = `[제품]: ${p.brandNm} ${p.productNm} (${p.standard || ''})
[모델]: ${p.modelName || ''}
[메모]: ${notes}
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
  { section: '본문', num: 2, script: '오늘은 큐브 멀티탭을 가지고 왔어요', scene: '인서트(상하좌우팬)' },
  { section: '본문', num: 3, script: '디자인이 예뻐요, 투박하고 칙칙하던 제 책상에 예쁜 오브제를 놓은 느낌이에요', scene: '클로즈업 컷 > 책상위에 올려둔 모습' },
  { section: '본문', num: 4, script: '큐브형태라 플러그 모양이 날씬하든 뚱뚱하든 별모양이든 상관없이 3개까지 꽂을 수 있어요', scene: '기존 안껴지는거 모습 > 다양한 모양 멀티탭 꽂는 모습' },
  { section: '본문', num: 5, script: '그리고 포트도 다양해요, USB 1개, C타입 2개 포트가 있는데, C타입은 PD형 20W 고속충전까지 지원해서,\n휴대폰 충전하는데 스트레스가 없어요', scene: '포트 클로즈업 > USB 꽂기 > C타입 꽂기 > 고속충전 뜨는거 보여주기 > 마음 편한 모습(짤)' },
  { section: '본문', num: 6, script: '이렇게 예쁜데 능력좋은 멀티탭이 두종류에요, 하나는 플러그 타입, 하나는 코드 타입이에요', scene: '양손에 두개 들고 있기 > 플러그 모습 > 코드 모습' },
  { section: '본문', num: 7, script: '플러그 타입은 벽에 딱 붙여서 깔끔하게 쓰고 싶을 때 좋고, 코드 타입은 책상이나 침대 옆에 두고 손 닿는 곳에서 편하게 쓰고 싶을 때 딱이에요', scene: '벽에 꽂는 모습 > 책상위에 두고 쓰는 모습' },
  { section: '본문', num: 8, script: '안전도 문제없어요, 과부하 차단 기능이 있어서 안심하고 쓸 수 있고', scene: '차단 기능 클로즈업 > 안심하는 표정' },
  { section: '본문', num: 9, script: '불에 잘 안 타는 난연 1등급 V-0 소재로 만들어져서 화재 걱정도 덜어줍니다', scene: '불에 안타는 짤 > 소재 인증 마크 or 텍스트 강조' },
  { section: '본문', num: 10, script: '게다가 KC 인증까지 완료된 제품이라 믿고 쓸 수 있어요', scene: 'KC인증 마크 강조' },
  { section: '본문', num: 11, script: '지금 비츠온MRO에서 특가로 만나보세요', scene: '제품 들고 손인사 > 비츠온MRO 로고 및 자막' },
  { section: '엔딩', num: 18, script: '작고 예쁜데 충전까지 빠른 루미앤 큐브 멀티탭', scene: '제품 연출 컷' },
  { section: '엔딩', num: 19, script: '지금 바로 사용해보세요!', scene: '구매링크 유도 컷' }
];

const DEFAULT_TEMPLATES = [
  {
    id: 'tpl_lumian_cube_multitab',
    title: '[실무 2단 콘티] 루미앤 큐브 멀티탭 (1분 22초 실전 샘플)',
    category: '비츠온/2단콘티',
    description: '실무 엑셀 콘티 포맷 (구성/번호/대본/장면) 실전 샘플 - 영상 실측 1분 22초 기준',
    content: `[00:00~00:05] 오프닝 도입
(화면: 인서트(상하좌우팬))
오늘은 큐브 멀티탭을 가지고 왔어요

[00:05~00:16] 디자인 & 첫인상
(화면: 클로즈업 컷 > 책상위에 올려둔 모습)
디자인이 예뻐요, 투박하고 칙칙하던 제 책상에 예쁜 오브제를 놓은 느낌이에요

[00:16~00:26] 큐브 형태 특장점
(화면: 기존 안껴지는거 모습 > 다양한 모양 멀티탭 꽂는 모습)
큐브형태라 플러그 모양이 날씬하든 뚱뚱하든 별모양이든 상관없이 3개까지 꽂을 수 있어요

[00:26~00:44] 고속 충전 포트
(화면: 포트 클로즈업 > USB 꽂기 > C타입 꽂기 > 고속충전 뜨는거 보여주기 > 마음 편한 모습(짤))
그리고 포트도 다양해요, USB 1개, C타입 2개 포트가 있는데, C타입은 PD형 20W 고속충전까지 지원해서,
휴대폰 충전하는데 스트레스가 없어요

[00:44~00:54] 2종 라인업 소개
(화면: 양손에 두개 들고 있기 > 플러그 모습 > 코드 모습)
이렇게 예쁜데 능력좋은 멀티탭이 두종류에요, 하나는 플러그 타입, 하나는 코드 타입이에요

[00:54~01:08] 사용 상황별 추천
(화면: 벽에 꽂는 모습 > 책상위에 두고 쓰는 모습)
플러그 타입은 벽에 딱 붙여서 깔끔하게 쓰고 싶을 때 좋고, 코드 타입은 책상이나 침대 옆에 두고 손 닿는 곳에서 편하게 쓰고 싶을 때 딱이에요

[01:08~01:14] 안전 장치 (과부하 차단)
(화면: 차단 기능 클로즈업 > 안심하는 표정)
안전도 문제없어요, 과부하 차단 기능이 있어서 안심하고 쓸 수 있고

[01:14~01:21] 난연 소재 안심
(화면: 불에 안타는 짤 > 소재 인증 마크 or 텍스트 강조)
불에 잘 안 타는 난연 1등급 V-0 소재로 만들어져서 화재 걱정도 덜어줍니다

[01:21~01:26] 국가 공인 KC 인증
(화면: KC인증 마크 강조)
게다가 KC 인증까지 완료된 제품이라 믿고 쓸 수 있어요

[01:26~01:30] MRO 프로모션 안내
(화면: 제품 들고 손인사 > 비츠온MRO 로고 및 자막)
지금 비츠온MRO에서 특가로 만나보세요

[01:30~01:35] 엔딩 요약
(화면: 제품 연출 컷)
작고 예쁜데 충전까지 빠른 루미앤 큐브 멀티탭

[01:35~01:40] 최종 CTA
(화면: 구매링크 유도 컷)
지금 바로 사용해보세요!`,
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

  initNew(p = null) {
    const isDefault = !p;
    this.currentScript = {
      id: 'script_' + Date.now(),
      title: p ? `[${p.brandNm}] ${p.productNm} 2단 콘티` : '[비츠온] 루미앤 큐브 멀티탭 (실전 2단 콘티)',
      content: '',
      notes: isDefault ? '💡 [2단 콘티(표)] 탭에서 각 셀을 직접 클릭하여 자유롭게 수정할 수 있습니다.\n💡 [🖨️ A4 1장 깔끔 인쇄]를 누르면 여백과 글자 크기가 1장에 딱 맞춰집니다.\n💡 기존 엑셀 대본이 있다면 [📋 엑셀 붙여넣기]를 눌러 복사한 표를 즉시 불러오세요.' : '',
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
      storyboard: isDefault ? JSON.parse(JSON.stringify(DEFAULT_STORYBOARD_SAMPLE)) : [
        { section: '도입', num: 1, script: `${p.productNm} 오프닝 및 문제제기`, scene: '제품 클로즈업 & 인서트' },
        { section: '본문', num: 2, script: `핵심 스펙: ${p.standard || '실용적인 규격과 디자인'}`, scene: '실사용 및 작동 시연' },
        { section: '엔딩', num: 3, script: '지금 비츠온MRO에서 특가로 만나보세요!', scene: '구매링크 및 엔딩 로고' }
      ],
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
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const rows = [];
    let autoNum = 1;

    for (let line of lines) {
      const cols = line.split('\t').map(c => c.trim().replace(/^"|"$/g, ''));
      if (cols.some(c => c === '대본' || c === '구성' || c === '장면' || c === '내용')) continue;
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
          section = cols[0];
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

// 6. UI App Controller
const App = {
  saveTimer: null,

  async init() {
    ScriptService.initNew();
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
    document.getElementById('btnInsertSpecs').addEventListener('click', () => this.insertSpecs());
    document.getElementById('btnToolbarInsertSpecs').addEventListener('click', () => this.insertSpecs());

    // AI Analysis
    document.getElementById('btnRunAiAnalysis').addEventListener('click', () => this.runAiAnalysis());

    // Title, Status, Content inputs
    document.getElementById('scriptTitleInput').addEventListener('input', e => {
      ScriptService.currentScript.title = e.target.value;
      this.debounceAutoSave();
    });
    document.getElementById('scriptStatusSelect').addEventListener('change', e => {
      ScriptService.currentScript.status = e.target.value;
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

    document.getElementById('btnAiShorts').addEventListener('click', () => this.runAiShorts());
    document.getElementById('btnAiLongform').addEventListener('click', () => this.runAiLongform());
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

    // 🎬 2-Column Storyboard Table Handlers
    document.getElementById('btnAddStoryboardRow')?.addEventListener('click', () => {
      this.addStoryboardRow();
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
      const rows = ScriptService.parseExcelText(raw);
      if (rows.length === 0) {
        alert('인식 가능한 대본 행이 없습니다. 탭 또는 줄바꿈으로 구분된 텍스트를 입력해주세요.');
        return;
      }
      ScriptService.currentScript.storyboard = rows;
      ScriptService.currentScript.content = ScriptService.storyboardToText(rows);
      this.renderStoryboardTable();
      this.updateStats();
      this.debounceAutoSave();
      document.getElementById('excelPasteModal')?.classList.remove('active');
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

      card.innerHTML = `
        <div class="rec-card-thumb">
          <img src="${item.pictureNm || 'https://vitsonimg.co.kr/images/productsNew/preparing.jpg'}" alt="${item.productNm}" onerror="this.src='https://vitsonimg.co.kr/images/productsNew/preparing.jpg'" />
        </div>
        <span class="rec-brand-badge ${badgeClass}">${item.brandNm}</span>
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

    const isNumeric = /^\d{3,8}$/.test(q);
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
        <strong>비츠온MRO 공식몰</strong>에서 실시간 확인하거나, 아래 <strong>[새 제품 정보 직접 입력]</strong>을 통해 제원을 붙여넣고 즉시 쇼츠/롱폼 대본을 작성할 수 있습니다.
      </p>
      <div class="fallback-actions">
        <a href="${mroUrl}" target="_blank" rel="noopener noreferrer" class="btn-mro-view-lg">
          🛒 비츠온MRO에서 ${isNumeric ? `상품코드 [${q}]` : `'${this.escapeHtml(q)}'`} 바로보기 ↗
        </a>
        <button id="btnOpenQuickAddFromFallback" class="btn-quick-add-lg">
          ➕ 이 제품 정보 직접 등록 & AI 즉시 기획 🚀
        </button>
      </div>
    `;

    strip.appendChild(card);

    document.getElementById('btnOpenQuickAddFromFallback')?.addEventListener('click', () => {
      this.openQuickProductModal(q);
    });
  },

  selectProduct(p) {
    ProductService.currentSelected = p;
    document.querySelectorAll('.rec-card').forEach(c => c.classList.remove('selected'));
    const cards = document.querySelectorAll('.rec-card');
    const idx = ProductService.currentRecommendations.findIndex(item => item.productCode === p.productCode);
    if (idx >= 0 && cards[idx]) cards[idx].classList.add('selected');

    this.renderProductDetail(p);

    if (!ScriptService.currentScript.content) {
      ScriptService.currentScript.product = {
        productCode: p.productCode,
        productNm: p.productNm,
        brandNm: p.brandNm,
        standard: p.standard,
        modelName: p.modelName,
        pictureNm: p.pictureNm
      };
      ScriptService.currentScript.title = `[${p.brandNm}] ${p.productNm} 콘텐츠 기획`;
      this.updateEditorUI();
    }
  },

  renderProductDetail(p) {
    let badgeClass = 'badge-mro';
    if (p.brandNm === '비츠온') badgeClass = 'badge-vitson';
    else if (p.brandNm === '홈빛') badgeClass = 'badge-homevit';

    document.getElementById('detailMainImg').src = p.pictureNm || 'https://vitsonimg.co.kr/images/productsNew/preparing.jpg';
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
        <span>📷 총 <strong>${p.detailImages.length}개</strong>의 고해상도 상세 이미지 (클릭 시 확대)</span>
        <a href="https://vitsonmro.com/mro/shop/productDetail.do?productCode=${p.productCode}" target="_blank" style="color: #60a5fa; text-decoration: underline; font-weight: 600;">비츠온MRO 원본 보기 ↗</a>
      `;
      imgGal.appendChild(topBar);

      p.detailImages.forEach(src => {
        const im = document.createElement('img');
        im.className = 'detail-gallery-img';
        im.src = src;
        im.loading = 'lazy';
        im.title = '클릭하여 새 탭에서 원본 크기로 보기';
        im.onerror = () => { im.style.display = 'none'; };
        im.onclick = () => window.open(src, '_blank');
        imgGal.appendChild(im);
      });
    } else {
      const mainImgSrc = p.pictureNm || 'https://vitsonimg.co.kr/images/productsNew/preparing.jpg';
      imgGal.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 20px; background: rgba(15, 23, 42, 0.4); border-radius: 8px; border: 1px solid var(--border-subtle);">
          <div style="font-size: 0.82rem; color: #94a3b8; margin-bottom: 12px; font-weight: 600;">
            📌 <strong>MRO 공식 대표 이미지</strong> (추가 상세 이미지 미등록 품목)
          </div>
          <img src="${mainImgSrc}" style="max-height: 250px; border-radius: 8px; margin: 0 auto; display: block; border: 1px solid var(--border-subtle); cursor: zoom-in;" onerror="this.src='https://vitsonimg.co.kr/images/productsNew/preparing.jpg'" onclick="window.open('${mainImgSrc}', '_blank')" title="클릭하여 원본 크기로 새 탭에서 보기" />
          <div style="margin-top: 14px;">
            <a href="https://vitsonmro.com/mro/shop/productDetail.do?productCode=${p.productCode}" target="_blank" class="btn-mro-view" style="display: inline-block; padding: 7px 16px; font-size: 0.82rem; text-decoration: none; border-radius: 6px;">
              🛒 비츠온MRO 공식몰에서 상세 도면 / 인증서 전체 확인 ↗
            </a>
          </div>
        </div>
      `;
    }

    document.getElementById('aiAnalysisResult').innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 0.85rem;">아래 <strong>[Gemini AI 제품 분석 실행]</strong> 버튼을 누르면<br>스펙 기반 핵심 셀링포인트, 타겟층, 바이럴 훅 5종이 도출됩니다.</div>`;
  },

  async runAiAnalysis() {
    const p = ProductService.currentSelected;
    if (!p) { this.showToast('제품을 먼저 선택해주세요.', 'error'); return; }
    const btn = document.getElementById('btnRunAiAnalysis');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Gemini가 제원 분석 중...`;

    try {
      const res = await GeminiService.analyzeProduct(p);
      let hooksHtml = (res.viralHooks || []).map(h => `
        <div class="viral-hook-item">
          <span>${h}</span>
          <button class="btn-copy-hook" onclick="navigator.clipboard.writeText('${h.replace(/'/g, "\\'")}'); App.showToast('복사되었습니다! 📋', 'success');">복사</button>
        </div>
      `).join('');
      let spHtml = (res.sellingPoints || []).map(s => `<li>${s}</li>`).join('');

      document.getElementById('aiAnalysisResult').innerHTML = `
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
          <ul>${spHtml}</ul>
        </div>
        <div class="ai-card-block">
          <h4>🔥 숏폼/릴스 추천 바이럴 훅 (Hook 5선)</h4>
          <div style="margin-top: 8px;">${hooksHtml}</div>
        </div>
      `;
      this.showToast('AI 분석이 완료되었습니다!', 'success');
    } catch (e) {
      this.showToast('AI 분석 에러: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `✨ Gemini AI 제품 분석 실행`;
    }
  },

  async runAiShorts() {
    const p = ProductService.currentSelected;
    if (!p) { this.showToast('제품을 선택해주세요.', 'error'); return; }
    const btn = document.getElementById('btnAiShorts');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> 대본 작성 중...`;
    try {
      const text = await GeminiService.generateShortsScript(p, ScriptService.currentScript.notes);
      ScriptService.currentScript.content = text;
      ScriptService.currentScript.storyboard = ScriptService.textToStoryboard(text);
      this.updateEditorUI();
      this.showToast('1분 쇼츠 대본 초안 및 2단 콘티가 생성되었습니다! 🎬', 'success');
      ScriptService.saveCurrent();
    } catch (e) {
      this.showToast('대본 생성 실패: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `⚡ AI 쇼츠 대본 (1분)`;
    }
  },

  async runAiLongform() {
    const p = ProductService.currentSelected;
    if (!p) { this.showToast('제품을 선택해주세요.', 'error'); return; }
    const btn = document.getElementById('btnAiLongform');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> 롱폼 작성 중...`;
    try {
      const text = await GeminiService.generateLongFormScript(p, ScriptService.currentScript.notes);
      ScriptService.currentScript.content = text;
      ScriptService.currentScript.storyboard = ScriptService.textToStoryboard(text);
      this.updateEditorUI();
      this.showToast('유튜브 롱폼 리뷰 대본 및 2단 콘티가 생성되었습니다! 🎥', 'success');
      ScriptService.saveCurrent();
    } catch (e) {
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
    try {
      const sub = await GeminiService.generateSubtitles(c);
      ScriptService.currentScript.subtitles = sub;
      document.getElementById('subtitlesOutput').textContent = sub;
      this.switchEditorTab('subtitles');
      this.showToast('자막 타임라인 분할 완료! 📝', 'success');
    } catch (e) {
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
    try {
      const vp = await GeminiService.generateVideoPrompts(p, c);
      ScriptService.currentScript.videoPrompts = vp;
      document.getElementById('videoPromptsOutput').textContent = vp;
      this.switchEditorTab('prompts');
      this.showToast('AI 비디오 프롬프트 생성 완료! 🤖', 'success');
    } catch (e) {
      this.showToast('프롬프트 생성 실패: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `🤖 AI 영상 프롬프트`;
    }
  },

  insertSpecs() {
    const p = ProductService.currentSelected;
    if (!p) { this.showToast('선택된 제품이 없습니다.', 'error'); return; }
    const text = ProductService.getSpecsSummaryText(p);
    const cur = document.getElementById('scriptContent').value;
    const newVal = cur ? `${cur}\n\n[제품 제원 요약]\n${text}` : `[제품 제원 요약]\n${text}`;
    ScriptService.currentScript.content = newVal;
    this.updateEditorUI();
    this.showToast('스펙 요약이 대본에 추가되었습니다.');
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
  renderStoryboardTable() {
    const tbody = document.getElementById('storyboardTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const rows = ScriptService.currentScript?.storyboard || [];

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

      // 2. 번호 (Row Number)
      const tdNum = document.createElement('td');
      tdNum.className = 'sb-row-no';
      tdNum.textContent = r.num !== undefined ? r.num : (idx + 1);

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
    const nextNum = rows.length > 0 ? (Math.max(...rows.map(r => parseInt(r.num, 10) || 0)) + 1) : 1;
    const newRow = { section, num: nextNum, script, scene };
    rows.push(newRow);
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
    const rows = ScriptService.textToStoryboard(content);
    if (rows.length === 0) {
      this.showToast('변환 가능한 문장이 없습니다.', 'error');
      return;
    }
    ScriptService.currentScript.storyboard = rows;
    this.renderStoryboardTable();
    this.switchEditorTab('storyboard');
    this.updateStats();
    this.debounceAutoSave();
    this.showToast(`대본 줄글을 콘티 표(${rows.length}개 행)로 변환했습니다! 🎬`, 'success');
  },

  syncStoryboardToScript() {
    const rows = ScriptService.currentScript?.storyboard || [];
    if (rows.length === 0) {
      this.showToast('동기화할 콘티 표가 없습니다.', 'error');
      return;
    }
    const text = ScriptService.storyboardToText(rows);
    ScriptService.currentScript.content = text;
    document.getElementById('scriptContent').value = text;
    this.switchEditorTab('script');
    this.updateStats();
    this.debounceAutoSave();
    this.showToast('콘티 표의 내용을 대본 줄글로 동기화했습니다! ✍️', 'success');
  },

  updatePrintHeader() {
    const s = ScriptService.currentScript;
    if (!s) return;
    const stats = ScriptService.calculateStats(s.storyboard?.length ? s.storyboard : s.content);
    const prodName = s.product ? `[${s.product.brandNm}] ${s.product.productNm}` : '일신비츠온 정품';
    const elTitle = document.getElementById('sbPrintTitle');
    const elProd = document.getElementById('sbPrintProduct');
    const elDur = document.getElementById('sbPrintDuration');
    const elChar = document.getElementById('sbPrintChar');
    const elDate = document.getElementById('sbPrintDate');

    if (elTitle) elTitle.textContent = s.title || '콘텐츠 제작 2단 콘티';
    if (elProd) elProd.textContent = `제품: ${prodName}`;
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
            <button class="btn-card-action btn-load">열기</button>
            <button class="btn-card-action btn-dup">복제</button>
            <button class="btn-card-action btn-del" style="color: #f87171;">삭제</button>
          </div>
        </div>
      `;

      card.querySelector('.btn-load').addEventListener('click', () => {
        ScriptService.currentScript = { ...s };
        if (!ScriptService.currentScript.storyboard || ScriptService.currentScript.storyboard.length === 0) {
          if (ScriptService.currentScript.content) {
            ScriptService.currentScript.storyboard = ScriptService.textToStoryboard(ScriptService.currentScript.content);
          }
        }
        if (s.product) {
          const m = ProductService.getByCode(s.product.productCode);
          if (m) ProductService.currentSelected = m;
        }
        this.updateEditorUI();
        this.switchView('studio');
        this.showToast(`[${s.title}] 대본을 불러왔습니다.`);
      });

      card.querySelector('.btn-dup').addEventListener('click', async () => {
        await ScriptService.duplicate(s.id);
        this.renderStorageList(keyword);
        this.showToast('대본이 복제되었습니다.');
      });

      card.querySelector('.btn-del').addEventListener('click', async () => {
        if (confirm(`'${s.title}' 대본을 삭제하시겠습니까?`)) {
          await ScriptService.delete(s.id);
          this.renderStorageList(keyword);
          this.showToast('대본이 삭제되었습니다.');
        }
      });

      container.appendChild(card);
    });
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
