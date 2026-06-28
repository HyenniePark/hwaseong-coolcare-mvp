# 화성 쿨케어

화성 쿨케어는 사용자의 기본 정보, 현재 활동 상태, 증상 입력을 바탕으로 무더위쉼터와 의료기관 후보를 추천하는 공모전용 모바일 웹앱 MVP입니다.

현재 버전은 React + Vite + TypeScript + Tailwind CSS 프론트엔드와 Python FastAPI 백엔드를 사용합니다. 발표 안정성을 위해 실제 API가 실패해도 mockData fallback으로 앱이 죽지 않도록 구성했습니다.

## 현재 연결 상태

- 프론트엔드: React + Vite + TypeScript + Tailwind CSS
- 백엔드: Python FastAPI
- 날씨: 기상청 초단기실황 API 연결
- 의료기관: 화성시 의료기관 CSV에서 생성한 정적 데이터 사용
- 무더위쉼터: API 승인 전이므로 mockData 사용
- 지도: 지도 SDK 없이 카카오맵 외부 검색 링크 사용
- Supabase: 아직 연결하지 않음
- 회원가입/문자 발송/실시간 병원 운영 여부/쉼터 혼잡도: MVP 제외

## 가장 쉬운 실행 방법

프로젝트 폴더에 실행 파일을 추가했습니다.

- start-all.bat: 백엔드와 프론트엔드를 새 창으로 같이 실행
- start-backend.bat: 백엔드만 실행
- start-frontend.bat: 프론트엔드만 실행

처음에는 start-all.bat을 더블클릭하는 방식이 가장 쉽습니다. 실행 후 검은 창 2개가 열려 있어야 합니다.

- 백엔드 창: 기상청 API를 불러오는 서버
- 프론트엔드 창: 브라우저 앱을 띄우는 서버

둘 중 하나를 닫으면 해당 기능이 꺼집니다.

## 수동 실행 방법

PowerShell 보안 오류를 피하기 위해 activate와 npm run dev 대신 아래 명령을 권장합니다.

### 1. 백엔드 실행

프로젝트 폴더에서 실행합니다.

    cd C:\Users\prett\Documents\Codex\2026-06-27\mvp-react-supabase-api-api-api
    .\backend\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --reload --port 8000

확인 주소:

- http://127.0.0.1:8000/api/health
- http://127.0.0.1:8000/api/weather

### 2. 프론트엔드 실행

새 CMD 또는 PowerShell 창을 열고 프로젝트 폴더에서 실행합니다.

    cd C:\Users\prett\Documents\Codex\2026-06-27\mvp-react-supabase-api-api-api
    npm.cmd run dev

앱 주소:

- http://127.0.0.1:5173

## 필요한 환경변수

실제 값은 README에 적지 않습니다.

### 프론트엔드

파일: .env.local

    VITE_API_BASE_URL=http://127.0.0.1:8000
    VITE_KAKAO_MAP_KEY=카카오_JavaScript_키

### 백엔드

파일: backend/.env

    KMA_SHORT_TERM_FORECAST_KEY=본인_기상청_인증키
    PUBLIC_DATA_SERVICE_KEY=본인_공공데이터포털_인증키
    KMA_BASE_NX=57
    KMA_BASE_NY=119
    CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

주의: 실제 인증키는 채팅창, README, 코드 파일에 직접 넣지 않습니다. backend/.env에만 보관합니다.

VITE_KAKAO_MAP_KEY는 선택사항입니다. 설정하면 GPS/주소를 실제 좌표로 보정하고, 없거나 실패하면 기존 행정구역 중심 fallback을 사용합니다.

## 앱 안에서 상태 확인하기

기본 모드 왼쪽 메뉴에서 연동 상태를 열면 현재 데이터 연결 상태를 볼 수 있습니다.

- 기상청 날씨 API가 실제로 연결되었는지
- 화성시 의료기관 CSV가 몇 개 로드되었는지
- 무더위쉼터가 mockData인지
- 지도 기능이 외부 링크 fallback인지
- 백엔드 주소가 무엇인지

발표 전에는 이 화면에서 기상청 날씨 API: 연결됨이 보이는지 확인하면 됩니다.

## 주요 화면 흐름

1. 계정 정보
   - 이름 또는 별명, 나이, 주 활동 지역, 주요 이동수단을 입력합니다.
   - 나이가 65세 이상이면 쉬운 안내 사용 여부를 묻는 팝업이 뜹니다.

2. 쉼터 찾기
   - 실내/실외/외출 예정 여부를 입력합니다.
   - 실외일 때만 바깥 활동 시간이 표시됩니다.
   - 위치 기준은 GPS 현재 위치, 활동 지역 중심, 주소 검색 중 선택합니다.
   - 응급 위험 신호가 있으면 자가 진단으로 이동하는 팝업이 뜹니다.

3. 자가 진단
   - 증상이 있는지 먼저 선택합니다.
   - 선택한 증상만 1~5점 강도로 입력합니다.
   - 응급 위험 신호가 강하면 119 전화 버튼을 먼저 보여줍니다.

4. 쉬운 안내
   - 큰 글씨, 큰 버튼, 아이콘 중심으로 행동 안내를 보여줍니다.
   - 기본 모드로 돌아갈 때도 팝업으로 확인합니다.

5. 연동 상태
   - API, CSV, mockData, 지도 fallback 상태를 확인합니다.

## 데이터 위치

- 무더위쉼터 mockData: src/data/mockData.ts
- 의료기관 mockData: src/data/mockData.ts
- 의료기관 CSV 원본: data/raw/hwaseong_hospitals.csv
- CSV 변환 결과: src/data/generatedHospitals.ts
- 데이터 fallback 서비스: src/services/dataService.ts
- 날씨 API 서비스: src/services/weatherService.ts
- 추천 알고리즘: src/lib/recommendation.ts
- FastAPI 백엔드: backend/app/main.py, backend/app/weather.py

## 의료기관 CSV 갱신 방법

새 CSV를 같은 위치에 넣습니다.

    data/raw/hwaseong_hospitals.csv

그다음 프로젝트 폴더에서 실행합니다.

    npm.cmd run generate:hospitals

성공하면 src/data/generatedHospitals.ts가 갱신됩니다.

## 추천 알고리즘 요약

이 MVP는 의료 진단을 하지 않습니다. 입력값을 바탕으로 온열질환 위험 신호와 이동 우선순위를 계산해 안내합니다.

### 날씨 점수

- 기온 35도 이상: +3
- 기온 33도 이상: +2
- 기온 30도 이상: +1
- 습도 75% 이상: +2
- 습도 65% 이상: +1
- 폭염 위험이 높음: +2

### 사용자 취약도 점수

- 75세 이상: +3
- 65세 이상: +2
- 만성질환 있음: +2
- 자택 냉방기 없음: +1.5
- 도보 이동: +1.5
- 야외노동자: +2
- 이동 불편: +1
- 증상 있음: +2

### 쉼터 추천

쉼터는 아래 요소를 함께 봅니다.

- 현재 위치와 쉼터 거리
- 이동수단에 따른 거리 부담
- 현재 날씨에 따른 거리 부담
- 에어컨 수, 선풍기 수, 이용가능인원, 면적
- 쉼터 주변 가장 가까운 병원 거리
- 나이, 만성질환, 도보 이동, 야외노동 여부

추천 결과는 3가지 이유로 나눠 보여줍니다.

- 가장 빠른 쉼터
- 가장 쾌적한 쉼터
- 의료기관과 가까운 쉼터

### 자가 진단 및 병원 추천

- 응급 위험 신호가 있으면 119 상담을 먼저 권장합니다.
- 주의 단계면 가까운 의료기관 후보를 보여줍니다.
- 비교적 경미하면 예방 안내와 쉼터 추천을 우선합니다.
- 병원 추천은 거리, 진료과목, 병원급 여부, 사용자 나이와 만성질환 여부를 반영합니다.

## fallback 원칙

발표 중 외부 API가 실패해도 앱이 멈추지 않도록 아래 fallback을 유지합니다.

- 기상청 API 실패: mockWeather 사용
- 의료기관 CSV 실패: mockHospitals 사용
- 무더위쉼터 API 미연결: mockShelters 사용
- 지도 SDK 미연결: 카카오맵 검색 링크 사용

## 다음 작업 후보

1. 무더위쉼터 API 승인 후 실제 데이터 연결
2. API 상태 화면에 쉼터 API 상태 추가
3. Supabase 스키마와 CSV import 흐름 설계
4. 지도 SDK 연결 여부 결정
5. 배포 방식 선택: Vercel + Render/Railway 등


## 제출용 배포 절차

공모전 제출 링크는 Vercel 프론트엔드 주소를 사용합니다. 기상청 API 키는 브라우저에 노출되면 안 되므로 Render 백엔드 환경변수에만 넣습니다.

### 1. GitHub에 올리기

1. GitHub에서 새 저장소를 만듭니다.
2. 이 프로젝트 폴더를 저장소에 올립니다.
3. 아래 파일은 절대 올리지 않습니다.
   - .env
   - .env.local
   - backend/.env
   - backend/.venv
   - node_modules

.gitignore에 위 항목이 들어가 있으므로, GitHub에 올리기 전에 포함되지 않았는지만 확인합니다.

### 2. Render 백엔드 배포

Render에서 새 Web Service를 만듭니다.

- Root Directory: 비워둠
- Build Command: pip install -r backend/requirements.txt
- Start Command: python -m uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT

Render 환경변수에는 아래 이름을 추가합니다. 실제 값은 Render 화면에 직접 입력합니다.

    KMA_SHORT_TERM_FORECAST_KEY=본인_기상청_인증키
    PUBLIC_DATA_SERVICE_KEY=본인_공공데이터포털_인증키
    KMA_BASE_NX=57
    KMA_BASE_NY=119
    CORS_ORIGINS=https://프론트엔드주소.vercel.app,http://localhost:5173,http://127.0.0.1:5173

처음 Render를 배포할 때는 Vercel 주소가 아직 없을 수 있습니다. 이 경우 일단 localhost만 넣고 배포한 뒤, Vercel 주소가 생기면 CORS_ORIGINS에 다시 추가합니다.

백엔드 배포 후 아래 주소가 열리면 성공입니다.

    https://Render백엔드주소.onrender.com/api/health
    https://Render백엔드주소.onrender.com/api/weather

### 3. Vercel 프론트엔드 배포

Vercel에서 GitHub 저장소를 Import합니다.

- Framework Preset: Vite
- Build Command: npm run build
- Output Directory: dist

Vercel 환경변수에는 아래 이름을 추가합니다.

    VITE_API_BASE_URL=https://Render백엔드주소.onrender.com

주의: Vercel에는 기상청 API 키나 공공데이터포털 키를 넣지 않습니다.

### 4. 제출 전 확인

Vercel 배포 주소에서 아래 항목을 확인합니다.

- 첫 화면이 정상 표시되는지
- 쉼터 찾기 결과가 표시되는지
- 자가 진단 결과가 표시되는지
- 연동 상태 화면에서 기상청 날씨 API가 연결됨으로 뜨는지
- 무더위쉼터 데이터가 mockData로 표시되는지
- 지도 버튼이 외부 카카오맵 링크로 열리는지

### 5. 수정 후 다시 배포하기

한 번 배포 링크를 만들면 이후에는 같은 링크를 계속 사용할 수 있습니다. 코드를 수정하고 GitHub에 다시 올리면 Vercel이 새 버전을 자동 배포합니다. 백엔드 코드나 환경변수를 바꾸면 Render도 다시 배포되었는지 확인합니다.
