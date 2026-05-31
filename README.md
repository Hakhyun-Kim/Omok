# 🏆 Premium Omok (프리미엄 터치 오목)

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/HTML5)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Web Audio API](https://img.shields.io/badge/Web_Audio_API-000000?style=for-the-badge&logo=waveform&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

> **윈도우 터치스크린 노트북** 및 다양한 모바일/데스크톱 기기에 최적화된 고품격 **오목(Gomoku) 웹 애플리케이션**입니다. 
> 별도의 설치나 가입 없이 더블 클릭 한 번으로 미려한 비주얼과 실감 나는 소리의 오목 대국을 즐기실 수 있습니다.

---

## 🌟 주요 특징 (Key Features)

### 1. 🎯 터치 노트북 특화 드래그 조준 & 스냅 (Touch Snapping)
손가락 터치 시 바둑판 눈금이 가려지는 불편함을 극복하기 위해 **하이브리드 조준 시스템**을 도입했습니다.
* **드래그 조준**: 바둑판 어디든 터치한 후 손가락을 밀어 움직이면, 가장 가까운 빈 교차점에 빛나는 링 형태의 가이드라인(Preview)이 매끄럽게 스냅되어 표시됩니다.
* **놓기(Release)**: 착수하려는 지점을 가이드링으로 확인한 뒤 손가락을 떼는 순간(`pointerup`) 정확하게 착수됩니다.
* **직접 탭**: 마우스 사용자 혹은 직관적인 플레이를 선호하는 사용자를 위해 비어있는 자리를 원터치로 직접 클릭하여 놓는 기존 방식도 완벽히 호환됩니다.

### 2. 🔊 실시간 웹 사운드 합성 (Web Audio API)
사운드 리소스 로딩에 따른 시간 지연이나 유실 문제를 방지하기 위해 브라우저의 내장 오시레이터를 사용한 **물리 기반 사운드 합성**을 구현했습니다.
* **흑돌 (slate)**: 묵직하고 단단한 밀도를 표현하는 180Hz 기반의 중저음 타격음.
* **백돌 (shell)**: 가볍고 맑은 조개껍질의 울림을 표현하는 220Hz 기반의 고음역 타격음.
* **울림통 효과**: 목재 재질 특유의 공명(Resonance Body) 필터를 가미하여 대국실의 나무 바둑판을 직접 타격하는 듯한 깊은 손맛을 선사합니다.

### 3. ⏱️ 30초 생각 시간 초읽기 (Countdown Timer)
대국의 긴장감을 높이고 템포를 원활히 조율해 주는 시간 제어 시스템을 구축했습니다.
* **초읽기 시각화**: 턴마다 30초의 카운트다운을 제공하며, 남은 시간에 비례하여 부드럽게 줄어드는 게이지 바가 표시됩니다.
* **위험 알림**: 시간이 **5초 이하**로 남을 경우 게이지 바와 숫자가 네온 레드로 변해 깜빡이며 강한 시각 경보를 줍니다.
* **오디오 경보음**: 5초 이하부터 매 초마다 800Hz 주파수의 비프음이 울리며, **마지막 2초** 동안은 더욱 급박한 1200Hz의 고음 비프음으로 자동 전환됩니다.
* **시간패 (Timeout)**: 30초가 경과하면 해당 플레이어가 즉시 **시간패**를 당하며 대국이 종료됩니다.

### 4. 🎨 듀얼 프리미엄 비주얼 테마 (Classic vs Cyber)
플레이어의 취향에 맞춰 한 번의 탭으로 대국실의 전반적인 분위기를 바꿀 수 있습니다.
* **클래식 우드 (Classic Wood)**: 전통적인 대나무/비자나무 바둑판을 현대적 감각으로 살려내어 나뭇결을 브라우저에 사실적으로 그려냅니다. 입체적인 명암과 드롭 섀도를 입힌 실감 나는 바둑돌이 특징입니다.
* **사이버 네온 (Cyber Neon)**: 공상과학 영화의 유리 홀로그램을 연상시키는 미래지향적 테마입니다. 암전된 필드 위로 빛나는 그리드선, 글로우 이펙트를 내는 광선 바둑돌과 게이지가 돋보입니다.

### 5. 🎁 선공 베네핏 설정 (Starting Advantage Options)
대국자 간 실력 격차를 보완하거나 특별한 룰을 구성할 수 있는 베네핏 기능을 장착했습니다.
* **선택형 베네핏**: 선공(흑돌)이 게임 첫 번째 턴에 추가로 몇 개의 바둑돌을 연달아 놓을지 설정할 수 있습니다. (기본 0개부터 최대 3개 추가 착수 지원 - 총 4수 가능)
* **스마트 턴 동기화**: 베네핏 수(예: 2개 추가 착수 = 총 3개 돌)만큼 선공이 돌을 다 놓으면, 자동으로 백돌의 차례로 넘어가 정상 대국으로 전환됩니다.
* **무르기 & 상태 연계**: 첫 번째 턴 착수 진행 도중 무르기를 하면 잔여 베네핏 개수가 완벽하게 소급 적용되며, 돌이 하나라도 놓이면 대국 도중 설정을 임의로 변경하지 못하도록 비활성화 처리되어 정합성을 유지합니다.

---

## 🛠️ 기술 스택 (Technical Stack)

* **프론트엔드**: HTML5, Vanilla JavaScript (ES6+), Vanilla CSS3
* **렌더링 엔진**: **HTML5 Canvas 2D Context** (High-DPI Retina 대응 ResizeObserver 설계)
* **오디오 엔진**: **Web Audio API** (OscillatorNode, GainNode, BiquadFilterNode 물리 사운드 실시간 합성)
* **입력 엔진**: **PointerEvents** (터치, 마우스, 스타일러스 펜의 통합 제어 및 setPointerCapture 경계 보존 지원)
* **데이터 관리**: **Web LocalStorage API** (비휘발성 전적/스코어 기록 보존)

---

## 🚀 실행 및 플레이 방법 (How to Run)

### 방법 A. 원클릭 바로 실행 (가장 간편함)
1. 본 저장소의 코드를 로컬 컴퓨터로 다운로드 또는 클론합니다.
2. 폴더 내에 있는 **`play.bat`** 파일을 찾아 더블 클릭합니다.
3. 기본 웹 브라우저가 실행되며 즉시 고해상도 오목판이 펼쳐집니다!

### 방법 B. 로컬 웹 서버 서빙 (개발 및 엄격한 브라우저 테스트용)
일부 브라우저(예: 구글 크롬 최신 보안 버전)에서 외부 리소스 또는 Web Audio API에 대한 엄격한 로컬 오리진 보안 제한이 활발할 경우, 다음 명령어로 로컬 서버를 가볍게 띄워 구동할 수 있습니다.
1. 터미널(PowerShell 또는 CMD)을 실행합니다.
2. 오목 폴더 경로로 이동하여 아래 명령어를 입력합니다:
   ```bash
   npx -y http-server . -o
   ```
3. 브라우저가 `http://localhost:8080` 포트로 자동 열리며 대국이 구동됩니다.

---

## 📂 프로젝트 파일 구조 (File Structure)

```
d:\Omok\
├── index.html       # 레이아웃 마크업, 타이머 위젯, 결과 안내 모달창
├── styles.css       # 전체 테마 스타일링, 글래스모피즘 코어, 애니메이션 프레임, 모바일/태블릿 반응형 뷰포트
├── app.js           # 15x15 오목 엔진, 4방향 5목 승리 탐지, Web Audio 효과음 합성, 터치 입력 핸들러
├── play.bat         # 윈도우 원클릭 자동 런처
└── README.md        # 프로젝트 설명 및 매뉴얼
```

---

## ⚖️ 라이선스 및 크레딧
* **제작사**: Antigravity Studio (Developer Pair Programming Assistant)
* **저작권**: Copyright &copy; 2026. Hakhyun Kim. All rights reserved.
