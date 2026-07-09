# 웹클론 v2 — 기술 결정 (2026-07-09)

## 오픈 퀘스천 확정

| # | 결정 |
|---|------|
| 1 | 이미지 생성: **Fal.ai Flux** (`FAL_KEY`) |
| 2 | 위지윅: **GrapesJS** |
| 3 | 렌더 워커: **Render** + `render-worker/` |
| 4 | 발행 1차: **Blob** → 선택 **Vercel** |
| 5 | 대상 제한: **약관 동의 + 발행 게이트** |

## 로드맵 상태

| 단계 | 상태 | 구현 |
|------|------|------|
| P0 | ✅ | 구조 클론, CSS 인라인, 섹션 트리, NDJSON |
| P1 | ✅ | 브랜드 감지·치환, 팔레트 리매핑 |
| P2 | ✅ | 이미지 슬롯 AI 교체 (Fal.ai) |
| P3 | ✅ | GrapesJS 위지윅 편집 |
| P4 | ✅ | Blob 정적 발행 |
| P5 | ✅ | 발행 이력·롤백, Vercel 배포(선택), 팔레트 |

## 환경 변수

| 변수 | 용도 |
|------|------|
| `RENDER_WORKER_URL` | Playwright 렌더 워커 |
| `RENDER_WORKER_SECRET` | 워커 인증 |
| `FAL_KEY` | AI 이미지 생성 |
| `VERCEL_TOKEN` | Vercel 자동 배포 (P5) |
| `VERCEL_PROJECT_NAME` | Vercel 프로젝트명 |
| `VERCEL_TEAM_ID` | Vercel 팀 ID (선택) |

## 사용자 플로우

```
/v2 → URL 입력·캡처 → /v2/projects/[id]
  → 리브랜딩 → 이미지 교체 → GrapesJS 편집 → 발행
```
