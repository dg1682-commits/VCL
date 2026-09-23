/**
 * Script Service for VCL-Light
 * Manages active script editing, estimated video duration, and script storage CRUD
 */
import { firebaseService } from './firebaseService.js';

class ScriptService {
  constructor() {
    this.currentScript = this.createNewScript();
    this.scripts = [];
    this.isLoaded = false;
  }

  createNewScript(product = null) {
    return {
      id: 'script_' + Date.now(),
      title: product ? `[${product.brandNm}] ${product.productNm} 콘텐츠 기획` : '새로운 콘텐츠 대본',
      content: '',
      notes: '',
      product: product ? {
        productCode: product.productCode,
        productNm: product.productNm,
        brandNm: product.brandNm,
        standard: product.standard,
        modelName: product.modelName,
        pictureNm: product.pictureNm
      } : null,
      status: 'planning', // 'planning' | 'drafted' | 'filmed' | 'uploaded'
      subtitles: '',
      videoPrompts: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  async loadAllScripts() {
    try {
      this.scripts = await firebaseService.getScripts();
      this.isLoaded = true;
      return this.scripts;
    } catch (e) {
      console.error('Failed to load scripts:', e);
      return [];
    }
  }

  getScripts() {
    return this.scripts;
  }

  getScriptById(id) {
    return this.scripts.find(s => s.id === id);
  }

  setCurrentScript(script) {
    this.currentScript = { ...script };
  }

  updateCurrent(fields) {
    this.currentScript = {
      ...this.currentScript,
      ...fields,
      updatedAt: new Date().toISOString()
    };
  }

  async saveCurrent() {
    if (!this.currentScript.title || !this.currentScript.title.trim()) {
      this.currentScript.title = '제목 없는 대본';
    }
    const saved = await firebaseService.saveScript(this.currentScript);
    this.currentScript = saved;

    // Refresh list
    const idx = this.scripts.findIndex(s => s.id === saved.id);
    if (idx >= 0) {
      this.scripts[idx] = saved;
    } else {
      this.scripts.unshift(saved);
    }
    return saved;
  }

  async deleteScript(id) {
    await firebaseService.deleteScript(id);
    this.scripts = this.scripts.filter(s => s.id !== id);
    if (this.currentScript && this.currentScript.id === id) {
      this.currentScript = this.createNewScript();
    }
    return true;
  }

  async duplicateScript(id) {
    const target = this.getScriptById(id);
    if (!target) return null;
    const duplicated = {
      ...target,
      id: 'script_' + Date.now(),
      title: `${target.title} (복사본)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const saved = await firebaseService.saveScript(duplicated);
    this.scripts.unshift(saved);
    return saved;
  }

  /**
   * 한국어 음절 및 공백 기반 예상 재생 시간 계산
   * 평균 유튜브/쇼츠 한국어 발화 속도: 초당 약 5~6음절 (1분 약 330~360자)
   */
  calculateStats(text = '') {
    const raw = text || '';
    const charCountWithSpaces = raw.length;
    const charCountNoSpaces = raw.replace(/\s/g, '').length;
    
    // 지문([지문] 또는 (지문)) 제외한 실제 발화 음절 수 추정
    const spokenText = raw.replace(/\[[^\]]+\]/g, '').replace(/\([^)]+\)/g, '').replace(/“|”|"/g, '').trim();
    const spokenChars = spokenText.replace(/\s/g, '').length;

    // 초당 5.2음절 기준
    const estimatedSeconds = Math.round(spokenChars / 5.2);
    const minutes = Math.floor(estimatedSeconds / 60);
    const seconds = estimatedSeconds % 60;
    const timeFormatted = minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;

    // 추천 플랫폼 판정
    let recommendation = '숏폼 적합';
    let progressColor = '#10b981'; // green
    let percentage = Math.min(100, Math.round((estimatedSeconds / 60) * 100));

    if (estimatedSeconds <= 30) {
      recommendation = '초단편 숏폼 (30초)';
      progressColor = '#3b82f6';
    } else if (estimatedSeconds <= 60) {
      recommendation = '1분 쇼츠 최적 (45~60초)';
      progressColor = '#10b981';
    } else if (estimatedSeconds <= 120) {
      recommendation = '롱 쇼츠/릴스 (1~2분)';
      progressColor = '#f59e0b';
    } else {
      recommendation = '유튜브 롱폼 리뷰 (3분 이상)';
      progressColor = '#8b5cf6';
      percentage = 100;
    }

    return {
      charCountWithSpaces,
      charCountNoSpaces,
      spokenChars,
      estimatedSeconds,
      timeFormatted,
      recommendation,
      progressColor,
      percentage
    };
  }

  /**
   * 대본 파일 내보내기 (TXT / MD)
   */
  exportScript(format = 'txt') {
    const s = this.currentScript;
    let content = '';
    const stats = this.calculateStats(s.content);

    if (format === 'md') {
      content = `# ${s.title}\n\n`;
      content += `> **브랜드:** ${s.product?.brandNm || '일신비츠온'} | **상태:** ${this.getStatusLabel(s.status)} | **예상시간:** ${stats.timeFormatted} (${stats.charCountWithSpaces}자)\n\n`;
      if (s.product) {
        content += `### 연결 제품 정보\n- **제품명:** ${s.product.productNm}\n- **규격:** ${s.product.standard || ''}\n- **코드:** ${s.product.productCode}\n\n`;
      }
      content += `## 대본 본문\n\n${s.content}\n\n`;
      if (s.notes) {
        content += `## 제작 메모\n\n${s.notes}\n\n`;
      }
      if (s.subtitles) {
        content += `## 자막 타임라인\n\n\`\`\`\n${s.subtitles}\n\`\`\`\n\n`;
      }
      if (s.videoPrompts) {
        content += `## AI 비디오 프롬프트\n\n${s.videoPrompts}\n\n`;
      }
    } else {
      content = `[제목] ${s.title}\n`;
      content += `[정보] 브랜드: ${s.product?.brandNm || '일신비츠온'} | 예상 소요시간: ${stats.timeFormatted}\n`;
      content += `--------------------------------------------------\n\n`;
      content += `[대본 본문]\n${s.content}\n\n`;
      if (s.notes) {
        content += `--------------------------------------------------\n[메모장]\n${s.notes}\n\n`;
      }
      if (s.subtitles) {
        content += `--------------------------------------------------\n[자막 타임라인]\n${s.subtitles}\n\n`;
      }
      if (s.videoPrompts) {
        content += `--------------------------------------------------\n[AI 영상 프롬프트]\n${s.videoPrompts}\n`;
      }
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${s.title.replace(/[^\w\s가-힣]/g, '_')}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  getStatusLabel(status) {
    const labels = {
      planning: '기획중 📝',
      drafted: '대본완료 ✍️',
      filmed: '촬영완료 🎬',
      uploaded: '업로드완료 🚀'
    };
    return labels[status] || '기획중 📝';
  }
}

export const scriptService = new ScriptService();
