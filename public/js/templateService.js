/**
 * Template Service for VCL-Light
 * Manages script templates with dynamic product variable interpolation
 */
import { firebaseService } from './firebaseService.js';

export const DEFAULT_TEMPLATES = [
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

class TemplateService {
  constructor() {
    this.templates = [];
    this.isLoaded = false;
  }

  async loadTemplates() {
    try {
      const customTemplates = await firebaseService.getTemplates();
      // Combine default templates and custom templates
      const defaultIds = new Set(DEFAULT_TEMPLATES.map(t => t.id));
      const userCustom = customTemplates.filter(t => !defaultIds.has(t.id));
      this.templates = [...DEFAULT_TEMPLATES, ...userCustom];
      this.isLoaded = true;
      return this.templates;
    } catch (e) {
      console.warn('Failed to load cloud templates, using defaults:', e);
      this.templates = [...DEFAULT_TEMPLATES];
      return this.templates;
    }
  }

  getTemplates() {
    return this.templates;
  }

  getById(id) {
    return this.templates.find(t => t.id === id);
  }

  async createTemplate(templateData) {
    const saved = await firebaseService.saveTemplate(templateData);
    this.templates.unshift(saved);
    return saved;
  }

  async updateTemplate(id, templateData) {
    const idx = this.templates.findIndex(t => t.id === id);
    if (idx >= 0) {
      const updated = { ...this.templates[idx], ...templateData, id };
      await firebaseService.saveTemplate(updated);
      this.templates[idx] = updated;
      return updated;
    }
    return null;
  }

  async deleteTemplate(id) {
    await firebaseService.deleteTemplate(id);
    this.templates = this.templates.filter(t => t.id !== id);
    return true;
  }

  /**
   * 템플릿 내 변수 치환
   * {{제품명}}, {{브랜드}}, {{규격}}, {{모델명}}, {{구매링크}} 등
   */
  applyVariables(templateContent, product) {
    if (!product || !templateContent) return templateContent || '';
    
    let result = templateContent;
    const replacements = {
      '{{제품명}}': product.productNm || '제품',
      '{{브랜드}}': product.brandNm || '비츠온',
      '{{규격}}': product.standard || '기본 규격',
      '{{모델명}}': product.modelName || '기본 모델',
      '{{카테고리}}': product.category2 || product.category1 || '',
      '{{구매링크}}': `https://vitsonmro.com/mro/shop/productDetail.do?productCode=${product.productCode}`
    };

    if (product.specs) {
      for (const [k, v] of Object.entries(product.specs)) {
        replacements[`{{${k}}}`] = v;
      }
    }

    for (const [key, val] of Object.entries(replacements)) {
      result = result.replaceAll(key, val);
    }

    return result;
  }
}

export const templateService = new TemplateService();
