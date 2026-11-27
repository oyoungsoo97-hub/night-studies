# Night Studies · After Hours

[English](README.md) · [한국어](README.ko.md) · [Deutsch](README.de.md)

[한국어로 Night Studies 열기](https://oyoungsoo97-hub.github.io/night-studies/?lang=ko)

카메라로 공연하는 두 무대와 포스터·효과음·사진을 다루는 세 편집실입니다. 작업 중에도 언어 메뉴로 화면 언어를 바꿀 수 있습니다. 직접 입력한 제목과 캡션, 파일 이름은 그대로 유지됩니다.

| 무대와 편집실 | 만들 수 있는 것 |
| --- | --- |
| [Astral Atelier](https://oyoungsoo97-hub.github.io/night-studies/spell-stage/?lang=ko) | 검지만 뻗어 잿불 채찍을 충전하고 손목을 휘둘러 날립니다. 두 손가락을 V자로 펴 방패를 들거나 두 손바닥 사이에 차원문을 엽니다. 마우스·터치·키보드도 지원합니다. |
| [Portrait Loom](https://oyoungsoo97-hub.github.io/night-studies/portrait-stage/?lang=ko) | 사진에서 인물을 선택하고 편안한 자세를 보정한 뒤 시선, 표정, 손가락과 몸 관절로 움직입니다. 얼굴의 비율을 살펴보고 그림이나 일부만 보이는 손에도 기준점을 직접 찍을 수 있습니다. |
| [Last Train](https://oyoungsoo97-hub.github.io/night-studies/last-train/?edition=house&lang=ko) | 내 사진과 인쇄판, 찢어진 종이, 열차의 한 프레임을 합쳐 영화 포스터를 만들고 PNG로 내보냅니다. |
| [Foley Club](https://oyoungsoo97-hub.github.io/night-studies/foley-club/?edition=house&lang=ko) | 영화에 효과음 두 테이크를 입힙니다. 큐의 위치, 음량과 좌우 배치를 조절해 48 kHz 스테레오 WAV로 저장합니다. 60초·12 MiB 이하의 MP4나 WebM도 사용할 수 있습니다. |
| [Light Table](https://oyoungsoo97-hub.github.io/night-studies/light-table/?edition=house&lang=ko) | 내 사진을 최대 다섯 장 불러와 세 컷을 고르고, 구도·캡션·인화지를 편집한 뒤 PNG나 JPEG로 출력합니다. |

### 공연과 보관

Portrait Loom은 JPEG, PNG, WebP, GIF, BMP, AVIF를 불러옵니다. HEIC는 해당 형식을 읽을 수 있는 브라우저에서 열 수 있습니다. 움직이는 GIF는 첫 프레임을 사용합니다.

단체 사진에서는 검출된 인물을 선택하거나 원하는 인물 주위에 영역을 그리세요. 눈, 입꼬리, 보이는 손가락 끝은 직접 지정할 수 있습니다. 얼굴 측정값은 사진 속 비율을 나타냅니다. 공연 중에는 사진에 보이는 면이 내 동작을 따라 변형됩니다.

두 무대에서 PNG를 저장할 수 있고, 영상 녹화를 지원하는 브라우저에서는 최대 12초를 녹화할 수 있습니다. Astral Atelier는 현재 보이는 배경까지 담습니다. 녹화 전에 주문음을 켜면 스테레오 효과음도 함께 저장됩니다. 카메라 추적은 영상만 사용합니다.

**프로젝트 저장**은 이 브라우저의 작업 보관함에 작업을 남깁니다. 다른 기기로 옮기려면 보관함의 **관리 → 파일 내보내기**를 누르고 새 브라우저에서 **파일 가져오기**를 선택하세요. `.nightstudy` 파일에는 직접 추가한 자료와 편집 설정이 들어 있습니다. 카메라 영상, 가져온 사진과 얼굴·손·몸의 기준점은 기기 안에서 처리합니다.

### 로컬 실행

ZIP을 풀고 macOS에서 **Start.command**를 열거나, Python 3가 설치된 컴퓨터에서 압축을 푼 폴더로 이동해 `python3 run.py`를 실행하세요. Windows 명령은 `py -3 run.py`입니다. 기본 주소는 `http://127.0.0.1:17473/`이며, 같은 주소와 브라우저를 써야 보관함을 계속 쓸 수 있습니다. 끝내려면 터미널에서 Ctrl+C를 누르세요. 추적 모델과 글꼴은 ZIP에 포함되어 있습니다.

[이미지·모델 출처와 라이선스](CREDITS.md)
