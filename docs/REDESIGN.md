# 웹 스캐너 — 대시보드 재설계 기획서

2026-07-09 · 대상 저장소: `shinkang888-code/webclone`

## 1. 재설계 배경 (이용자 관점 문제 진단)

| # | 기존 문제 | 이용자 체감 |
|---|-----------|------------|
| 1 | HTML/에셋을 통째로 메모리에 적재 (`text()`, `arrayBuffer()`) | 대형 페이지에서 서버 멈춤·실패 |
| 2 | 에셋 12개를 순차 다운로드 | 스캔이 느림 |
| 3 | `srcset`·lazy-load(`data-src`)·inline background·`poster` 미수집 | "이미지 0개" 결과 빈발 |
| 4 | 진행 표시가 스피너 하나 | 오래 걸리면 죽은 것처럼 보여 이탈 |
| 5 | 결과가 서버 파일 경로 텍스트 | 초보자가 결과를 확인할 방법이 없음 |
| 6 | 과거 실행 기록을 UI에서 볼 수 없음 | 재방문 가치 없음 |
| 7 | localhost/사설IP 요청 가능 (SSRF) | 내부망 탐색에 악용 가능 |
| 8 | 서버리스(Vercel) 배포 시 파일쓰기 불가인데 안내 없음 | 원인 모를 500 에러 |
| 9 | 도커/standalone에서 런타임 생성 파일이 정적 서빙 안 됨 | 스냅샷 링크 404 |

## 2. 개선 내역

### 백엔드 (기능 작동 한계 해소)
- **메모리 안전화**: 페이지 본문 15MB 캡(증분 읽기), 에셋은 디스크로 직접 스트리밍(개당 15MB, 초과 시 중간 중단·파일 삭제)
- **속도**: 동시 4개 병렬 다운로드 풀, 최대 40개 에셋, 개당 15초 타임아웃
- **추출 강화**: `srcset`(최대 해상도 후보), `data-src`/`data-lazy-src`/`data-original`/`data-bg`, `video poster`, `preload as=image`, inline `style url()`, 아이콘 역순 속성까지 수집
- **실시간 진행률**: `POST /api/clone`이 NDJSON 스트림으로 단계(phase)·메타·에셋별 성공/실패 이벤트 전송
- **기록 API**: `GET /api/clone/history` — 최근 30건, 썸네일 자동 선정
- **보안**: SSRF 가드(`security.ts`) — localhost·사설IP·링크로컬·메타데이터 IP DNS 해석 후 차단, 스냅샷 서빙 경로 traversal 차단
- **환경 대응**: 쓰기 불가 환경(Vercel 서버리스) 감지 시 친절한 안내 에러, `/clones/[...path]` 동적 서빙 라우트로 standalone/도커에서도 결과 열람 가능
- **친절한 에러 문구**: HTTP 상태·타임아웃·봇차단 등 상황별 한국어 안내

### 프런트엔드 (초보자용 완전 재설계)
- **디자인 방향**: "제도실(drafting)" 콘셉트 — 그래프지 배경 + 제도 파랑(#2447D9), IBM Plex Sans KR + Plex Mono
- **초보자 가이드**: 3단계 사용법 스트립 + 기능 4종을 블루프린트 스타일 SVG 일러스트 카드로 설명 (접기 가능)
- **시그니처: 스캔 파이프라인** — 가져오기→분석→내려받기→저장 4노드가 실시간으로 채워지고, 에셋 진행바 + 라이브 로그 표시
- **결과 패널**: 성공 배너, 요약 통계(파일 수/페이지 크기/소요시간), "페이지 스냅샷 열기" 버튼, 이미지 썸네일 그리드(용량 표시), 건너뛴 파일 사유 표기
- **기록 패널**: 우측 사이드바에 썸네일+상대시간 목록, 클릭 시 스냅샷 재열람
- **접근성**: progressbar ARIA, reduced-motion 대응, 시스템 폰트 폴백

## 3. 파일 구조

```
src/
  app/api/clone/route.ts          # NDJSON 스트리밍 스캔 API
  app/api/clone/history/route.ts  # 기록 API
  app/clones/[...path]/route.ts   # 스냅샷/에셋 동적 서빙 폴백
  lib/clone/extract.ts            # 확장 추출기
  lib/clone/artifacts.ts          # 스트리밍 저장 + 병렬 풀
  lib/clone/security.ts           # SSRF 가드
  lib/clone/history.ts            # 기록 조회
  components/clone/
    clone-dashboard.tsx           # 오케스트레이터
    feature-guide.tsx             # SVG 일러스트 가이드
    scan-console.tsx              # 입력 + 파이프라인
    result-panel.tsx              # 결과
    history-panel.tsx             # 기록
```

## 4. 검증 결과
- `npm run lint` 통과(경고 1건: App Router 폰트 링크 관련 false positive) · `typecheck` 통과 · `build` 통과
- 실서버 테스트: github.com 스캔 → 27개 에셋 감지·스트리밍 이벤트 정상, 에셋 디스크 저장·썸네일·기록 API·스냅샷 서빙(200) 확인
- SSRF: `localhost`, `192.168.0.1` 요청 차단 확인

## 5. 향후 확장 제안
1. 헤드리스 브라우저(Playwright) 렌더 후 스캔 — JS 렌더링 SPA 대응 + 전체 페이지 스크린샷 썸네일
2. CSS 파일 내 `url()` 추적 다운로드(외부 스타일시트 배경 이미지)
3. 기록 삭제/ZIP 내보내기 버튼
4. 다중 URL 큐 스캔
