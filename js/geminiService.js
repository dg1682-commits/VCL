/**
 * Gemini AI Service for VCL-Light
 * Powered by Google Gemini 3.6 Flash / 3.8 Flash
 */
import { CONFIG } from './config.js';

class GeminiService {
  constructor() {
    this.apiKey = CONFIG.gemini.apiKey;
    this.model = CONFIG.gemini.model;
    this.endpoint = CONFIG.gemini.endpoint;
  }

  setApiKey(key) {
    if (key && key.trim()) {
      this.apiKey = key.trim();
    }
  }

  async callGemini(contents, systemInstruction = '', temperature = 0.7) {
    const url = `${this.endpoint}/${this.model}:generateContent?key=${this.apiKey}`;
    
    const requestBody = {
      contents: Array.isArray(contents) ? contents : [{ parts: [{ text: contents }] }],
      generationConfig: {
        temperature: temperature,
        maxOutputTokens: 2500,
      }
    };

    if (systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Gemini API 호출 실패 (Status: ${response.status})`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('Gemini로부터 유효한 텍스트 응답을 받지 못했습니다.');
      }
      return text;
    } catch (err) {
      console.error('Gemini Service Error:', err);
      throw err;
    }
  }

  /**
   * 제품 상세 제원 기반 핵심 셀링포인트, 타겟층, 바이럴 훅 5종 도출
   */
  async analyzeProduct(product) {
    const systemPrompt = `당신은 (주)일신비츠온의 수석 유튜브/숏폼 콘텐츠 기획자입니다.
회사 브랜드인 비츠온(Vitson, 전기/조명/공구/배선자재 전문)과 홈빛(Homevit, 감성 인테리어 조명/생활가전), 그리고 비츠온MRO 제품에 대한 깊은 이해를 가지고 있습니다.
사용자가 제공하는 제품의 품명, 규격, 모델명, 제원정보를 분석하여 조회수가 터지는 숏폼/릴스/유튜브 기획용 분석 결과를 JSON 형식으로 반환하세요.`;

    const specsText = product.specs ? Object.entries(product.specs).map(([k, v]) => `- ${k}: ${v}`).join('\n') : '(기본 규격 참조)';

    const userPrompt = `[제품 정보]
- 브랜드: ${product.brandNm}
- 품명: ${product.productNm}
- 규격: ${product.standard || '기본 규격'}
- 모델명: ${product.modelName || '상세 규격 참조'}
- 카테고리: ${product.category1 || ''} > ${product.category2 || ''} > ${product.category3 || ''}
- 상세스펙:
${specsText}

위 제품의 장점을 극대화할 수 있도록 아래 JSON 구조로만 정확하게 답변해 주세요:
{
  "oneLineSummary": "제품의 핵심 가치를 담은 매력적인 1줄 요약",
  "targetAudience": "주요 타겟층 2~3개 (예: 셀프 인테리어 초보자, 현장 전기기사, 상가 사장님 등)",
  "sellingPoints": [
    "핵심 셀링포인트 1 (스펙 기반 차별점)",
    "핵심 셀링포인트 2 (실사용 편의성)",
    "핵심 셀링포인트 3 (가성비 및 안전성/인증)"
  ],
  "viralHooks": [
    "훅 1 (호기심 유발형 - '아직도 OO 쓰시나요?')",
    "훅 2 (비용/절약형 - '이거 바꾸고 전기세 OO% 아꼈습니다')",
    "훅 3 (시간/편의형 - '전문가 안 부르고 3분 만에 셀프 교체하는 법')",
    "훅 4 (비교/검증형 - '싸구려 제품과 비츠온 정품의 충격적 차이')",
    "훅 5 (인테리어/감성형 - '조명 하나 바꿨을 뿐인데 호텔 분위기 나는 꿀템')"
  ],
  "recommendedAngles": [
    "추천 콘텐츠 방향 1 (예: 비포&애프터 비교 숏폼)",
    "추천 콘텐츠 방향 2 (예: 현장 시공 꿀팁)"
  ]
}`;

    const raw = await this.callGemini(userPrompt, systemPrompt, 0.4);
    try {
      const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      return {
        oneLineSummary: `${product.brandNm} ${product.productNm} - 가성비와 품질을 갖춘 스마트 아이템`,
        targetAudience: '인테리어 시공 및 전기자재 사용자, 가성비 소비층',
        sellingPoints: [product.standard || '우수한 품질 규격', '비츠온 검증 부품 채용', '간편한 설치 및 A/S'],
        viralHooks: [
          `아직도 이거 모르고 그냥 쓰셨나요? ${product.productNm}!`,
          `전기세와 교체 스트레스 한 번에 날리는 법!`,
          `3분 만에 교체 끝! ${product.brandNm} 인기 아이템`
        ],
        rawText: raw
      };
    }
  }

  /**
   * 쇼츠/릴스/틱톡용 1분 미만 완결형 대본 생성
   */
  async generateShortsScript(product, analysis, customNotes = '') {
    const systemPrompt = `당신은 100만 조회수 쇼츠를 만드는 일신비츠온 전속 크리에이터입니다.
1인이 기획, 대본, 자막, 촬영, 출연, 편집까지 모두 진행하므로,
[화면 연출/행동 지문], [대사/나레이션], [화면 텍스트 자막]이 명확히 구분된 50초 내외 숏폼 스크립트를 작성하세요.
말투는 유튜브 숏폼에 최적화된 친근하면서도 신뢰감 있는 구어체(해요체/반말섞인 친근한 톤)를 사용하세요.`;

    const userPrompt = `[제품 정보]
브랜드: ${product.brandNm}
제품명: ${product.productNm}
규격: ${product.standard || ''}
모델: ${product.modelName || ''}

[분석 포인트]
요약: ${analysis?.oneLineSummary || ''}
셀링포인트: ${analysis?.sellingPoints?.join(', ') || ''}
추가 요청 메모: ${customNotes || '빠르고 강렬한 전개'}

다음 구조에 맞춰 50초 내외(공백 포함 350~450자) 대본을 작성해 주세요:
1. [0~5초] 인트로 훅 (시선 사로잡는 오프닝 대사와 행동)
2. [5~20초] 문제 상황 & 공감대 형성
3. [20~40초] 비츠온/홈빛 제품 솔루션 & 스펙 실증
4. [40~50초] 아웃트로 및 CTA (비츠온MRO 구매 / 프로필 링크 유도)`;

    return await this.callGemini(userPrompt, systemPrompt, 0.7);
  }

  /**
   * 유튜브 롱폼(리뷰/상세 사용법) 대본 생성
   */
  async generateLongFormScript(product, analysis, customNotes = '') {
    const systemPrompt = `당신은 전기/조명/MRO 전문 리뷰 유튜버이자 (주)일신비츠온 콘텐츠 마스터입니다.
전문적이면서도 초보자도 쉽게 이해할 수 있는 3~4분 분량의 유튜브 롱폼 리뷰 및 설치/사용 가이드 대본을 작성합니다.`;

    const userPrompt = `[제품 정보]
브랜드: ${product.brandNm}
제품명: ${product.productNm}
규격: ${product.standard || ''}
모델: ${product.modelName || ''}
스펙정보: ${JSON.stringify(product.specs || {})}
추가 메모: ${customNotes || ''}

[구성 가이드]
1. 인트로 (오늘 다룰 주제 및 시청 혜택)
2. 언박싱 & 외관 디자인/마감 디테일
3. 핵심 스펙 정밀 분석 (소비전력, 조도, 색온도, 방수 등 실생활 체감 위주)
4. 실제 설치 및 작동 시연 (전기 작업 시 안전 수칙 포함)
5. 장단점 솔직 비교 & 어떤 분께 추천하는지
6. 아웃트로 & 비츠온MRO 안내`;

    return await this.callGemini(userPrompt, systemPrompt, 0.7);
  }

  /**
   * 자막(Subtitle) 스크립트 분할 생성
   * Premiere Pro, Vrew, CapCut 등 영상 편집 툴에 바로 붙여넣을 수 있는 호흡별 분할
   */
  async generateSubtitles(scriptText) {
    const systemPrompt = `당신은 영상 자막 편집 전문가입니다.
주어진 대본 텍스트를 호흡과 음절 길이에 맞춰 1줄당 15~20자 내외의 시각적 자막 블록으로 깔끔하게 나누고,
예상 타임코드([00:00.0] 형식)와 강조 키워드를 표시하세요.`;

    const userPrompt = `아래 대본을 영상 자막용 타임라인으로 분할해 주세요:

${scriptText}`;

    return await this.callGemini(userPrompt, systemPrompt, 0.3);
  }

  /**
   * AI 비디오 생성 프롬프트 도출 (Runway Gen-3, Kling, Sora, Midjourney)
   * 대본 각 장면(B-roll)에 필요한 고화질 AI 생성 프롬프트 영문+한글 생성
   */
  async generateVideoPrompts(product, scriptText) {
    const systemPrompt = `당신은 AI 영상 제작 감독입니다.
Runway Gen-3 Alpha, Kling AI, Luma Dream Machine, Midjourney 등 최신 AI 비디오/이미지 툴에 바로 입력할 수 있는
고품질 B-Roll 및 제품 컷 프롬프트를 작성합니다. 영문 프롬프트는 전문 영화/광고 프롬프트 스타일(시네마틱 라이팅, 카메라 무빙, 4K 디테일)로 작성하세요.`;

    const userPrompt = `[제품]: ${product.brandNm} ${product.productNm} (${product.standard || ''})
[대본 내용]:
${scriptText}

위 대본의 주요 장면을 위한 AI 영상 제작 프롬프트 4~5컷을 아래 형식으로 작성해 주세요:
- Cut 1 [오프닝 훅 샷]: (장면설명) / Prompt: (영문 프롬프트) / Camera: (카메라 무빙)
- Cut 2 [제품 외관 클로즈업]: (장면설명) / Prompt: (영문 프롬프트) / Camera: (카메라 무빙)
- Cut 3 [실제 작동/발광/시연]: (장면설명) / Prompt: (영문 프롬프트) / Camera: (카메라 무빙)
- Cut 4 [인테리어 공간 연출 샷]: (장면설명) / Prompt: (영문 프롬프트) / Camera: (카메라 무빙)
- Cut 5 [엔딩 브랜드 샷]: (장면설명) / Prompt: (영문 프롬프트) / Camera: (카메라 무빙)`;

    return await this.callGemini(userPrompt, systemPrompt, 0.6);
  }

  /**
   * 상세페이지 이미지 AI 시각 분석 (Gemini Vision)
   */
  async analyzeDetailImage(base64Data, mimeType = 'image/jpeg') {
    const systemPrompt = `당신은 (주)일신비츠온 상세페이지 분석 AI입니다.
업로드된 상품 상세페이지 이미지에서 도면, 제원표, 핵심 소구 문구, 인증 마크 등을 정밀하게 읽어내어 요약 정리해 주세요.`;

    const contents = [{
      parts: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        },
        {
          text: '이 상세페이지 이미지에서 제품의 핵심 스펙(치수, 소비전력, 규격 등)과 소비자가 끌릴 만한 소구점 텍스트를 모두 추출해서 정리해줘.'
        }
      ]
    }];

    return await this.callGemini(contents, systemPrompt, 0.3);
  }
}

export const geminiService = new GeminiService();
