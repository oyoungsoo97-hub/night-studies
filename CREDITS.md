# Credits · 제작 정보 · Bildnachweise

**English.** The station, carriage, corridor, figures, diner, original studio portrait, lake and spell textures are original generated imagery for Night Studies. The original Atelier No. 1 portrait shows a fictional adult with both palms visible, photographed against a teal studio backdrop. It was generated for this release with the built-in ImageGen tool. The Foley instruments and the stereo spell sounds are synthesized. The camera stages use local landmark detection.

**한국어.** 승강장·열차·복도·인물·식당·초상·호수·주문 텍스처 이미지는 Night Studies를 위해 생성했습니다. 이전 기본 예시인 아틀리에 1번은 청록색 스튜디오 배경 앞에서 양손을 편 가상의 성인을 묘사합니다. 이번 배포용으로 내장 ImageGen을 사용했습니다. 폴리 악기와 스테레오 주문음은 직접 합성했으며, 카메라 무대의 좌표 추적은 기기 안에서 실행됩니다.

**Deutsch.** Bahnhof, Zug, Flur, Figuren, Diner, Porträt, See und Zaubertexturen wurden für Night Studies generiert. Das ursprüngliche, mit dem integrierten ImageGen erstellte Atelierporträt zeigt eine fiktive erwachsene Person mit offenen Handflächen vor einem petrolfarbenen Studiohintergrund. Die Foley-Instrumente und die Stereo-Zauberklänge werden synthetisiert. Die Kamerabühnen erfassen Bewegungspunkte lokal.

## Winter (aespa) · 에스파 윈터

**한국어.** 기본 예시는 2025년 3월 26일 폴로 랄프 로렌 행사에서 윈터가 손인사하는 티비텐(TV10) 영상의 한 장면입니다. 사진을 상반신 중심으로 잘라 WebP로 변환하고 인물의 3D 메시와 텍스처를 재구성했습니다.

**English.** The default study uses a frame of Winter waving at the Polo Ralph Lauren photo call on 26 March 2025. The source frame by TV10 was cropped and converted to WebP, then used for the reconstructed mesh, textures and gallery views.

**Deutsch.** Die Standardstudie zeigt Winter beim Winken auf dem Fototermin von Polo Ralph Lauren am 26. März 2025. Das Standbild von TV10 wurde zugeschnitten, in WebP umgewandelt und als Grundlage für das 3D-Modell, seine Texturen und die Galerieansichten verwendet.

[Original · 티비텐 (TV10) · Wikimedia Commons](https://commons.wikimedia.org/?curid=162907797) · [Creative Commons Attribution 3.0](https://creativecommons.org/licenses/by/3.0/)

## MediaPipe · 얼굴·손·몸 추적 · Gesichts-, Hand- und Körpertracking

[Google MediaPipe Tasks Vision 0.10.14](https://www.npmjs.com/package/@mediapipe/tasks-vision/v/0.10.14) · [Notices / 라이선스 / Lizenz](docs/assets/hands/LICENSE.txt)

| Model / 모델 / Modell | Original | SHA-256 |
| --- | --- | --- |
| Hands | [Google · float16/1](https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task) | `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1` |
| Face | [Google · float16/1](https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task) | `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff` |
| Pose Lite | [Google · float16/1](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task) | `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a` |

[Face Mesh model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Face%20Mesh%20V2.pdf) · [Blendshape model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Blendshape%20V2.pdf) · [Hand tracking model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Hand%20Tracking%20%28Lite_Full%29%20with%20Fairness%20Oct%202021.pdf)

The 3D face uses the landmark ordering and triangles of Google’s [MediaPipe canonical face model](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model.obj) under [Apache 2.0](docs/assets/hands/LICENSE.txt). The mesh positions, skull, materials, body and pose are fitted in the browser. Source OBJ SHA-256: `8bac80443397e113f41a8b565ea72c59390bc031d9defab289dba7bc0c54e618`.

은하 먼지의 양손 입자 연출은 Grace의 손 추적 작업에서 영감을 받았습니다. Silver Drift’s hand choreography was inspired by Grace’s particle performance. Die Handchoreografie für Silberstaub ist von Graces Partikel-Performance inspiriert. [GraceFX · @gracengo_](https://www.instagram.com/p/DfRBhLuhKV9/)

## Fonts · 글꼴 · Schriften

[Barlow Condensed — SIL Open Font License](docs/assets/fonts/barlow-OFL.txt) · [Instrument Serif — SIL Open Font License](docs/assets/fonts/instrument-OFL.txt)
