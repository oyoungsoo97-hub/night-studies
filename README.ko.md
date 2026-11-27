# Night Studies · After Hours

[English](README.md) · [한국어](README.ko.md) · [Deutsch](README.de.md)

[한국어로 Night Studies 열기](https://oyoungsoo97-hub.github.io/night-studies/?lang=ko)

카메라로 공연하는 두 무대와 포스터·효과음·사진을 다루는 세 편집실입니다. 작업 중에도 언어 메뉴로 화면 언어를 바꿀 수 있습니다. 직접 입력한 제목과 캡션, 파일 이름은 그대로 유지됩니다.

| 무대와 편집실 | 만들 수 있는 것 |
| --- | --- |
| [Astral Atelier](https://oyoungsoo97-hub.github.io/night-studies/spell-stage/?lang=ko) | 은빛 입자 구름을 한 손으로 모아 옮기고, 두 손 사이로 늘였다가 펼쳐 흩뿌립니다. 지팡이를 고르면 잿불을 날려 방패에 맞힐 수 있습니다. |
| [Portrait Loom](https://oyoungsoo97-hub.github.io/night-studies/portrait-stage/?lang=ko) | 올린 사진에서 재질이 입혀진 3D 인물을 만듭니다. 인물을 돌려 보고 조명을 바꾸거나, 카메라로 연기한 포즈를 GLB 모델로 저장할 수 있습니다. |
| [Last Train](https://oyoungsoo97-hub.github.io/night-studies/last-train/?edition=house&lang=ko) | 내 사진과 인쇄판, 찢어진 종이, 열차의 한 프레임을 합쳐 영화 포스터를 만들고 PNG로 내보냅니다. |
| [Foley Club](https://oyoungsoo97-hub.github.io/night-studies/foley-club/?edition=house&lang=ko) | 영화에 효과음 두 테이크를 입힙니다. 큐의 위치, 음량과 좌우 배치를 조절해 48 kHz 스테레오 WAV로 저장합니다. 60초·12 MiB 이하의 MP4나 WebM도 사용할 수 있습니다. |
| [Light Table](https://oyoungsoo97-hub.github.io/night-studies/light-table/?edition=house&lang=ko) | 내 사진을 최대 다섯 장 불러와 세 컷을 고르고, 구도·캡션·인화지를 편집한 뒤 PNG나 JPEG로 출력합니다. |

### 공연과 보관

Portrait Loom은 JPEG, PNG, WebP, GIF, BMP, AVIF를 불러옵니다. HEIC는 해당 형식을 읽을 수 있는 브라우저에서 열 수 있습니다. 움직이는 GIF는 첫 프레임을 사용합니다.

단체 사진에서는 한 사람을 고르고, 그림에서는 눈과 입을 직접 표시할 수 있습니다. 인물을 드래그하거나 회전 슬라이더를 움직여 옆과 뒤를 보세요. 조명을 바꾸면 코와 턱, 손가락에 맺히는 빛과 그림자가 달라집니다. 보이는 면에는 사진을 입히고, 가려진 면의 형태와 재질은 사진 한 장을 바탕으로 추정합니다. **3D 모델 저장**은 현재 포즈와 재질을 GLB로 저장합니다. **프로젝트 저장**으로 연기 설정을 다시 편집할 수 있습니다.

두 무대에서 PNG를 저장할 수 있고, 영상 녹화를 지원하는 브라우저에서는 최대 12초를 녹화할 수 있습니다. Astral Atelier는 현재 보이는 배경까지 담습니다. 녹화 전에 주문음을 켜면 스테레오 효과음도 함께 저장됩니다. 카메라 추적은 영상만 사용합니다.

**프로젝트 저장**은 이 브라우저의 작업 보관함에 작업을 남깁니다. 다른 기기로 옮기려면 보관함의 **관리 → 파일 내보내기**를 누르고 새 브라우저에서 **파일 가져오기**를 선택하세요. `.nightstudy` 파일에는 직접 추가한 자료와 편집 설정이 들어 있습니다. 카메라 영상, 가져온 사진과 얼굴·손·몸의 기준점은 기기 안에서 처리합니다.

### 로컬 실행

ZIP을 풀고 macOS에서 **Start.command**를 열거나, Python 3가 설치된 컴퓨터에서 압축을 푼 폴더로 이동해 `python3 run.py`를 실행하세요. Windows 명령은 `py -3 run.py`입니다. 기본 주소는 `http://127.0.0.1:17473/`이며, 같은 주소와 브라우저를 써야 보관함을 계속 쓸 수 있습니다. 끝내려면 터미널에서 Ctrl+C를 누르세요. 추적 모델과 글꼴은 ZIP에 포함되어 있습니다.

[이미지·모델 출처와 라이선스](CREDITS.md)
