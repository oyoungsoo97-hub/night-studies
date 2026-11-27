# Night Studies · After Hours

영화 포스터, 폴리 사운드트랙, 사진 시퀀스를 만드는 세 개의 브라우저 편집실. 각 편집실의 하우스 에디션을 고쳐 쓰거나, 자기 사진과 영상으로 시작할 수 있습니다.

**[Night Studies 열기](https://oyoungsoo97-hub.github.io/night-studies/)**

[![Night Studies 편집실과 실제 출력한 마지막 안내방송 포스터](media/night-studies.webp)](https://oyoungsoo97-hub.github.io/night-studies/)

| 편집실 | 작업과 출력 |
| --- | --- |
| [Last Train](https://oyoungsoo97-hub.github.io/night-studies/last-train/?edition=house) | 종이를 찢어 드러낼 장면을 정하고 12초의 필름에서 한 프레임을 고릅니다. 배경에 내 사진을 넣고 제목, 부제, 인쇄판, 판형을 편집해 PNG로 출력합니다. |
| [Foley Club](https://oyoungsoo97-hub.github.io/night-studies/foley-club/?edition=house) | 무성 장면에 두 테이크의 효과음을 입힙니다. 큐의 시간, 음량, 좌우 위치를 조절하고 선택한 테이크를 48 kHz 스테레오 WAV로 출력합니다. MP4·WebM 클립도 사용할 수 있습니다(최대 60초, 12 MiB). |
| [Light Table](https://oyoungsoo97-hub.github.io/night-studies/light-table/?edition=house) | 원판에서 세 컷을 골라 구도와 캡션을 편집합니다. 내 사진 다섯 장까지 더할 수 있고, 가로·세로·표지 레이아웃과 인화지를 골라 PNG 또는 JPEG로 출력합니다. |

### 저장과 기기 간 이동

편집실에서 **프로젝트 저장**을 누르면 이름을 붙여 현재 브라우저의 작업 보관함에 남길 수 있습니다. 기존 작업을 열면 변경사항을 저장하거나 사본을 만들 수 있습니다. 홈의 최근 작업에서 이어서 편집하세요.

다른 브라우저나 기기로 옮기려면 보관함의 **관리 → 파일 내보내기**로 프로젝트 파일(`.nightstudy`)을 내려받고, 새 기기의 **작업 보관함 → 파일 가져오기**로 엽니다. 직접 추가한 사진과 영상도 파일에 포함됩니다. 사이트 데이터를 지우기 전에는 프로젝트 파일을 보관해 주세요. 포스터·사진·WAV는 완성본이고, 프로젝트 파일에는 다시 편집할 수 있는 원본과 설정이 들어갑니다.

### 로컬 실행

Python 3를 설치한 컴퓨터에서 압축을 풀고 macOS의 **Start.command**를 열거나, 압축을 푼 폴더에서 실행하세요.

```sh
python3 run.py
```

Windows에서는 `py -3 run.py`를 사용할 수 있습니다. 기본 로컬 주소는 `http://127.0.0.1:17473/`입니다. 같은 브라우저와 주소로 열면 작업 보관함을 계속 쓸 수 있습니다. 종료하려면 터미널에서 Ctrl+C를 누르세요.

### Media and privacy

Night Studies runs locally in the browser. Imported media and named projects are kept on the device. A Foley comparison link for the built-in film contains sound cue data in its URL fragment. To share a custom film, export its project file.

Hand tracking in Last Train is optional. The browser asks for the camera only when you enable it. Its first use downloads Google's pinned hand landmark model (about 8 MB), verifies its SHA-256, and caches it when browser storage permits. Camera frames are processed on the device. The pointer, keyboard and touch controls work without the model. Foley effects are synthesized with Web Audio.

[Artwork, fonts, and third-party credits](CREDITS.md)
