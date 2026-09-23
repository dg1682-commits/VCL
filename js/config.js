/**
 * VCL-Light Config
 * (주)일신비츠온 콘텐츠 기획 & 대본 제작 스튜디오
 */
export const CONFIG = {
  appName: 'VCL-Light',
  appVersion: '1.0.0',
  company: '(주)일신비츠온',
  brands: {
    vitson: {
      name: '비츠온',
      en: 'Vitson',
      color: '#1d6ece',
      description: 'LED 조명, 전기/배선자재, 전동공구, 스마트홈 대표 브랜드'
    },
    homevit: {
      name: '홈빛',
      en: 'Homevit',
      color: '#d97706',
      description: '프리미엄 인테리어 감성 조명, 소형 생활/계절 가전 브랜드'
    },
    mro: {
      name: 'MRO/기타',
      en: 'MRO Brands',
      color: '#059669',
      description: '3M, 디월트, 밀워키, 보쉬, 아남 등 비츠온MRO 공식 취급 브랜드'
    }
  },
  vitsonMroUrl: 'https://vitsonmro.com',
  vitsonImgBase: 'https://vitsonimg.co.kr',
  
  // Gemini API Configuration
  gemini: {
    apiKey: 'AQ.Ab8RN6LpZOKqlsOJI7xIU2LXgDRV0rO7ghNN1CEpBm3cneoAag',
    model: 'gemini-3.6-flash', // 최신 권장 고속 추론 모델
    fallbackModel: 'gemini-flash-latest',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models'
  },

  // Firebase Web SDK Configuration
  firebase: {
    apiKey: "AIzaSyAWzpRpyB5Xq1J-Z2t8sq9biGeMJMfGFb4",
    authDomain: "vcl-light.firebaseapp.com",
    projectId: "vcl-light",
    storageBucket: "vcl-light.firebasestorage.app",
    messagingSenderId: "1055284719368",
    appId: "1:1055284719368:web:71de664aa1afeb6674c6bd"
  }
};
