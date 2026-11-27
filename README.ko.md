# Night Studies · After Hours

[English](README.md) · [한국어](README.ko.md) · [Deutsch](README.de.md)

[한국어로 Night Studies 열기](https://oyoungsoo97-hub.github.io/night-studies/?lang=ko)

카메라로 공연하는 두 무대와 포스터·효과음·사진을 다루는 세 편집실입니다. 작업 중에도 언어 메뉴로 화면 언어를 바꿀 수 있습니다. 직접 입력한 제목과 캡션, 파일 이름은 그대로 유지됩니다.

| 무대와 편집실 | 만들 수 있는 것 |
| --- | --- |
| [Astral Atelier](https://oyoungsoo97-hub.github.io/night-studies/spell-stage/?lang=ko) | 손가락을 모아 별빛 선을 긋고, 손바닥을 펴 신성을 터뜨리고, 양손으로 차원문을 엽니다. 마우스나 터치로도 연주할 수 있습니다. |
| [Portrait Loom](https://oyoungsoo97-hub.github.io/night-studies/portrait-stage/?lang=ko) | 정면 인물 사진을 열고 얼굴의 기하 구조와 삼각망을 살펴봅니다. 내 무표정을 기준으로 잡은 뒤 고개, 표정과 손가락으로 사진 속 인물을 움직입니다. 카메라 없이 조절판으로도 포즈를 만들 수 있습니다. |
| [Last Train](https://oyoungsoo97-hub.github.io/night-studies/last-train/?edition=house&lang=ko) | 내 사진과 인쇄판, 찢어진 종이, 열차의 한 프레임을 합쳐 영화 포스터를 만들고 PNG로 내보냅니다. |
| [Foley Club](https://oyoungsoo97-hub.github.io/night-studies/foley-club/?edition=house&lang=ko) | 영화에 효과음 두 테이크를 입힙니다. 큐의 위치, 음량과 좌우 배치를 조절해 48 kHz 스테레오 WAV로 저장합니다. 60초·12 MiB 이하의 MP4나 WebM도 사용할 수 있습니다. |
| [Light Table](https://oyoungsoo97-hub.github.io/night-studies/light-table/?edition=house&lang=ko) | 내 사진을 최대 다섯 장 불러와 세 컷을 고르고, 구도·캡션·인화지를 편집한 뒤 PNG나 JPEG로 출력합니다. |

### 공연과 보관

Portrait Loom은 얼굴이 밝고 정면을 향한 사진에서 시작하기 좋습니다. 사진에 손가락이 보이면 원본 손을 움직이고, 얼굴 사진만 있을 때는 그림 손을 쓸 수 있습니다. 얼굴이 검출되지 않으면 기준점을 직접 지정할 수 있습니다. 두 무대 모두 PNG 저장을 지원하며, 브라우저가 영상 녹화를 지원하면 무대 화면을 최대 12초까지 저장할 수 있습니다.

**프로젝트 저장**은 이 브라우저의 작업 보관함에 작업을 남깁니다. 다른 기기로 옮기려면 보관함의 **관리 → 파일 내보내기**를 누르고 새 브라우저에서 **파일 가져오기**를 선택하세요. `.nightstudy` 파일에는 직접 추가한 자료와 편집 설정이 들어 있습니다. 카메라는 선택 사항이고, 카메라 프레임과 사진, 얼굴·손 좌표는 기기 안에서 처리합니다. 녹화에는 무대 화면만 담깁니다.

### 로컬 실행

ZIP을 풀고 macOS에서 **Start.command**를 열거나, Python 3가 설치된 컴퓨터에서 압축을 푼 폴더로 이동해 `python3 run.py`를 실행하세요. Windows 명령은 `py -3 run.py`입니다. 기본 주소는 `http://127.0.0.1:17473/`이며, 같은 주소와 브라우저를 써야 보관함을 계속 쓸 수 있습니다. 끝내려면 터미널에서 Ctrl+C를 누르세요. 추적 모델과 글꼴은 ZIP에 포함되어 있습니다.

[이미지·모델 출처와 라이선스](CREDITS.md)
