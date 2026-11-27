# Night Studies · After Hours

Three short browser works set at night. Tear a poster, perform the sound for a silent film, or cut three photographs from a single frame.

**[Enter the exhibition](https://oyoungsoo97-hub.github.io/night-studies/)**

[![Three Night Studies covers: a torn transit print, a dim corridor and a rainy diner](media/night-studies.webp)](https://oyoungsoo97-hub.github.io/night-studies/)

| Work | How to play |
| --- | --- |
| [LAST TRAIN](https://oyoungsoo97-hub.github.io/night-studies/last-train/) | Drag across the printed poster to reveal a midnight platform. Capture the moment as a PNG. The one-touch control also opens the scene. |
| [FOLEY CLUB](https://oyoungsoo97-hub.github.io/night-studies/foley-club/) | Perform footsteps, keys and a hinge against the same eight-second film. Record two takes and listen to them back to back. |
| [LIGHT TABLE](https://oyoungsoo97-hub.github.io/night-studies/light-table/) | Inspect the diner through a loupe. Choose three crops, arrange them and print a 2400 × 1060 triptych. |

### 한국어

**막차**에서는 포스터 위를 길게 드래그하세요. 찢어진 자리에 승강장이 나타나고 12초 동안 막차가 지나갑니다. 손을 놓은 순간을 PNG로 저장할 수 있습니다. 카메라로 조작하려면 **손으로 찢기**를 누르고 양손을 모았다 벌리세요. 카메라 없이도 마우스, 터치 또는 키보드로 작품 전체를 체험할 수 있습니다.

**폴리 클럽**에서는 A 녹음을 시작하고 장면에 맞춰 자갈, 열쇠, 경첩을 연주하세요. 키보드의 1·2·3도 사용할 수 있습니다. 테이크 B에는 다른 타이밍으로 연주한 뒤 두 버전을 이어 들어보세요. 비교 링크를 복사하면 다른 사람도 같은 두 테이크를 들을 수 있습니다.

**라이트 테이블**에서는 빗속 식당 사진 위로 확대경을 움직여 세 컷을 고릅니다. 컷의 순서와 제목을 정하고 완성된 사진을 PNG로 저장하세요.

### 로컬에서 열기

Python 3가 설치된 컴퓨터에서 압축을 풀고 macOS에서는 **Start.command**를 열거나 폴더에서 다음 명령을 실행하세요.

```sh
python3 run.py
```

Windows에서는 `py -3 run.py`로 실행할 수 있습니다. 실행 중 표시되는 localhost 주소에서 작품을 엽니다. 터미널에서 Ctrl+C를 누르면 종료됩니다.

### Media and privacy

The stills and cutout figures were created for this collection with image generation. Train movement, paper tears, film staging, the loupe and the printable compositions are drawn in the browser. Foley effects are synthesized by Web Audio.

The camera is optional and is requested only in LAST TRAIN. Its frames are processed on the device. The first use downloads Google's pinned hand landmark model (about 8 MB), verifies its SHA-256 and reuses it when browser storage permits. Mouse, touch and keyboard play work from the local files without downloading a model. Foley tracks store effect timings and variations, with no microphone recording. Shared comparison links encode both takes in the URL fragment. The visitor can listen without overwriting their own saved performances. Browser storage holds takes and light-table edits locally when available.

[Asset sources and third-party notices](CREDITS.md)
