/**
 * Product Service for VCL-Light
 * Manages product recommendations from vitsonmro.com, spec extraction & catalog searching
 */
import { CONFIG } from './config.js';

class ProductService {
  constructor() {
    this.products = [];
    this.isLoaded = false;
    this.currentSelected = null;
    this.currentRecommendations = [];
    this.currentFilter = 'all'; // 'all' | 'vitson' | 'homevit' | 'mro'
  }

  async loadCatalog() {
    if (this.isLoaded && this.products.length > 0) return this.products;
    try {
      const res = await fetch('./data/products.json');
      if (!res.ok) throw new Error('Failed to load products.json');
      this.products = await res.json();
      this.isLoaded = true;
      console.log(`Loaded ${this.products.length} products from vitsonmro.com catalog.`);
      return this.products;
    } catch (e) {
      console.error('Error loading product catalog:', e);
      return [];
    }
  }

  /**
   * 5개 제품 랜덤 추천 및 셔플 (필터 적용)
   */
  getRandom5(filter = this.currentFilter) {
    this.currentFilter = filter;
    let pool = [...this.products];

    if (filter === 'vitson') {
      pool = pool.filter(p => p.brandNm === '비츠온');
    } else if (filter === 'homevit') {
      pool = pool.filter(p => p.brandNm === '홈빛');
    } else if (filter === 'mro') {
      pool = pool.filter(p => p.brandNm !== '비츠온' && p.brandNm !== '홈빛');
    }

    if (pool.length === 0) pool = [...this.products];

    // Shuffle algorithm (Fisher-Yates)
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // 균형 추천: 전체 필터일 경우 가급적 비츠온/홈빛을 포함하도록 구성
    if (filter === 'all') {
      const vitsonItems = pool.filter(p => p.brandNm === '비츠온');
      const homevitItems = pool.filter(p => p.brandNm === '홈빛');
      const mroItems = pool.filter(p => p.brandNm !== '비츠온' && p.brandNm !== '홈빛');

      const selected = [];
      if (vitsonItems.length > 0) selected.push(vitsonItems[0]);
      if (homevitItems.length > 0) selected.push(homevitItems[0]);
      if (vitsonItems.length > 1) selected.push(vitsonItems[1]);
      if (mroItems.length > 0) selected.push(mroItems[0]);
      
      while (selected.length < 5 && pool.length > 0) {
        const next = pool.pop();
        if (!selected.some(s => s.productCode === next.productCode)) {
          selected.push(next);
        }
      }
      this.currentRecommendations = selected.slice(0, 5);
      return this.currentRecommendations;
    }

    this.currentRecommendations = pool.slice(0, 5);
    return this.currentRecommendations;
  }

  /**
   * 상품 키워드/코드 검색
   */
  search(keyword) {
    if (!keyword || !keyword.trim()) return [];
    const q = keyword.trim().toLowerCase();
    return this.products.filter(p => {
      return (p.productNm && p.productNm.toLowerCase().includes(q)) ||
             (p.productCode && p.productCode.includes(q)) ||
             (p.modelName && p.modelName.toLowerCase().includes(q)) ||
             (p.standard && p.standard.toLowerCase().includes(q)) ||
             (p.brandNm && p.brandNm.toLowerCase().includes(q)) ||
             (p.category1 && p.category1.toLowerCase().includes(q)) ||
             (p.category2 && p.category2.toLowerCase().includes(q)) ||
             (p.category3 && p.category3.toLowerCase().includes(q));
    }).slice(0, 20);
  }

  /**
   * 상품코드로 단일 상품 조회
   */
  getByCode(code) {
    return this.products.find(p => String(p.productCode) === String(code));
  }

  /**
   * 제원 정보 텍스트 포맷 (대본에 원클릭 삽입용)
   */
  getSpecsSummaryText(product) {
    if (!product) return '';
    let text = `[${product.brandNm}] ${product.productNm}\n`;
    text += `- 규격: ${product.standard || '기본 규격'}\n`;
    if (product.modelName) text += `- 모델명: ${product.modelName}\n`;
    if (product.specs) {
      for (const [k, v] of Object.entries(product.specs)) {
        if (v && v !== '해당사항없음') {
          text += `- ${k}: ${v}\n`;
        }
      }
    }
    text += `- 제조/판매: (주)일신비츠온 (비츠온MRO)\n`;
    text += `- 구매링크: https://vitsonmro.com/mro/shop/productDetail.do?productCode=${product.productCode}\n`;
    return text;
  }
}

export const productService = new ProductService();
