const words={
 dust:['은하 먼지','Silver Drift','Silberstaub'],dustPractice:['누른 채 움직여 입자를 모으고, 손을 떼어 흩뿌리세요.','Hold and sweep to gather particles. Release to scatter them.','Halte und ziehe, um Partikel zu sammeln. Lass los, um sie zu verstreuen.'],
 dustLive:['엄지와 검지를 맞대어 모으고 손바닥을 펴서 흩뿌리세요.','Pinch to gather a cloud. Open your palm to scatter it.','Sammle mit Daumen und Zeigefinger eine Wolke. Öffne die Hand, um sie zu verstreuen.'],
 dustReady:['입자가 흐르고 있어요.','Silver Drift is flowing.','Der Silberstaub strömt.'],dustGather:['손끝에 입자가 모이고 있어요.','Gathering at your fingertips.','Die Partikel sammeln sich an deinen Fingerspitzen.'],dustFan:['입자가 흩어집니다.','Particles scattering.','Die Partikel zerstreuen sich.'],
 dustBrush:['손의 움직임을 따라 흐릅니다.','Following your movement.','Der Staub folgt deiner Bewegung.'],dustUndo:['이전 입자 흐름으로 돌아왔어요.','Previous drift restored.','Vorherige Strömung wiederhergestellt.'],
 dustCount:['개의 입자','particles','Partikel'],dustClear:['입자 흐름과 배치한 주문을 초기화할까요?','Reset the drift and clear your placed spells?','Die Strömung zurücksetzen und gesetzte Zauber entfernen?'],
 dustIntensity:['입자 밀도','Particle density','Partikeldichte'],dustProject:['나의 은하 먼지','My Silver Drift','Mein Silberstaub'],
 dustKeys:['누른 채로 움직인 뒤 놓으세요. 키보드는 Enter로 모으고 방향키로 움직인 뒤 Enter로 흩뿌립니다.','Hold, sweep, then release. On a keyboard, press Enter to gather, move with the arrow keys and press Enter to scatter.','Halte, ziehe und lass los. Mit der Tastatur sammelst du mit Enter, bewegst die Wolke mit den Pfeiltasten und verstreust sie mit Enter.'],

 bolt:['잿불 채찍','Cinderlash','Glutpeitsche'],shield:['유리결 방패','Glass Ward','Glaswehr'],
 boltPractice:['누르고 마력을 모은 뒤, 날릴 방향으로 휘두르며 놓으세요.','Hold to charge, flick toward a target and release.','Halte zum Aufladen, wische zum Ziel und lass los.'],
 shieldPractice:['누른 채 움직여 방패를 펼치고 자리를 잡으세요.','Hold to raise a shield. Move it into the path of a bolt.','Halte, um einen Schild zu heben. Schiebe ihn in die Flugbahn eines Blitzes.'],
 boltLive:['검지만 앞으로 뻗어 마력을 모으고 손목을 휘두르세요.','Point one index finger to charge, then flick your wrist.','Strecke nur den Zeigefinger zum Aufladen und schnippe mit dem Handgelenk.'],
 shieldLive:['검지와 중지를 V자로 펼쳐 방패를 유지하세요.','Hold up two fingers in a V to raise and steer a shield.','Halte zwei Finger als V hoch, um einen Schild zu heben und zu lenken.'],
 boltCast:['잿불이 날아갑니다.','Cinderlash away.','Glutpeitsche abgefeuert.'],shieldCast:['방패가 자리 잡았어요.','Glass Ward set.','Glaswehr gesetzt.'],
 charging:['마력 충전','Charging','Lädt'],shielding:['방패 유지','Shield raised','Schild aktiv'],hit:['잿불이 충돌했어요.','Cinderlash struck.','Glutpeitsche eingeschlagen.'],deflect:['방패가 잿불을 막았어요.','The ward caught the bolt.','Der Schild hat den Blitz abgefangen.'],
 soundOn:['주문음 켬','Sound on','Klang an'],soundOff:['주문음 끔','Sound off','Klang aus'],
 soundFail:['이 브라우저에서 소리를 켤 수 없어요.','Sound is unavailable in this browser.','Der Klang ist in diesem Browser nicht verfügbar.'],
 castKey:['방향키로 조준하고 Enter로 발사하세요.','Aim with the arrow keys, then press Enter to release.','Ziele mit den Pfeiltasten und drücke zum Auslösen Enter.'],

 library:['작업 보관함','Library','Archiv'],saveProject:['프로젝트 저장','Save project','Projekt speichern'],
 intro:['밤하늘을 손으로 연주하세요. 별빛을 잇고, 신성을 터뜨리고, 두 손 사이에 차원문을 여세요.','Perform with the night sky. Trace starlight, cast a nova and open a portal between your palms.','Spiele mit dem Nachthimmel. Ziehe Sternenspuren, entfache eine Nova und öffne ein Portal zwischen deinen Händen.'],
 expand:['전체 화면','Full screen','Vollbild'],collapse:['전체 화면 닫기','Exit full screen','Vollbild beenden'],
 grimoire:['마법서','Grimoire','Zauberbuch'],guide:['주문을 고른 뒤 무대에서 시험해 보세요.','Choose a spell and try it on the stage.','Wähle einen Zauber und probiere ihn auf der Bühne aus.'],
 guideLive:['카메라 앞에서 아래 손동작으로 주문을 바꾸세요.','Use these hand shapes to switch spells in the air.','Wechsle mit diesen Handgesten zwischen den Zaubern.'],
 ink:['별잉크','Star Ink','Sternentinte'],nova:['신성','Nova','Nova'],gate:['차원문','Orbital Gate','Orbitaltor'],
 inkPractice:['누른 채 움직여 별자리를 그리세요.','Drag to leave a trail of stars.','Ziehe, um eine Sternenspur zu zeichnen.'],
 novaPractice:['빛을 터뜨릴 곳을 한 번 누르세요.','Tap anywhere to cast a burst of light.','Tippe, um einen Lichtausbruch auszulösen.'],
 gatePractice:['중심에서 바깥으로 드래그해 문을 여세요.','Drag outward from the centre of a portal.','Ziehe von der Mitte nach außen, um ein Tor zu öffnen.'],
 inkLive:['엄지와 검지를 맞대고 움직여 그리세요.','Pinch thumb and index finger, then draw.','Lege Daumen und Zeigefinger zusammen und zeichne.'],
 novaLive:['한 손바닥을 카메라에 펴서 빛을 터뜨리세요.','Open one palm toward the camera to cast.','Öffne eine Handfläche vor der Kamera.'],
 gateLive:['두 손바닥을 펼쳐 문을 만들고 간격을 조절하세요.','Open both palms and vary the distance between them.','Öffne beide Hände und verändere ihren Abstand.'],
 spectrum:['빛의 색','Light spectrum','Lichtspektrum'],vesper:['황혼','Vesper','Vesper'],solar:['태양','Solar','Solar'],tide:['조수','Tide','Gezeiten'],
 power:['주문 강도','Spell intensity','Zauberstärke'],scope:['마법 무대. 방향키로 이동하고 엔터로 주문을 쓰세요. 별잉크는 엔터로 시작하고 끝냅니다.','Spell stage. Move with arrow keys and cast with Enter. Enter starts and ends Star Ink.','Zauberbühne. Mit Pfeiltasten bewegen und mit Enter zaubern. Enter startet und beendet die Sternentinte.'],
 practice:['연습 무대','Practice stage','Übungsbühne'],live:['손동작 무대','Gesture stage','Gestenbühne'],start:['손동작 카메라 켜기','Start gesture camera','Gestenkamera starten'],stop:['카메라 끄기','Stop camera','Kamera stoppen'],cancelCamera:['시작 취소','Cancel start','Start abbrechen'],
 capture:['장면 PNG 저장','Capture PNG','PNG aufnehmen'],undo:['되돌리기','Undo','Rückgängig'],clear:['무대 비우기','Clear stage','Bühne leeren'],clearAsk:['그린 주문을 모두 지울까요?','Clear all the spells you placed?','Alle gesetzten Zauber entfernen?'],cancel:['취소','Cancel','Abbrechen'],cleared:['무대를 비웠어요.','Stage cleared.','Bühne geleert.'],undone:['마지막 주문을 지웠어요.','Last spell removed.','Letzter Zauber entfernt.'],
 cameraBackdrop:['카메라 영상을 무대에 표시','Show camera as backdrop','Kamerabild als Hintergrund'],calibrate:['손 크기 보정','Calibrate hand size','Handgröße kalibrieren'],
 first:['별잉크가 준비됐어요.','Star Ink is ready.','Sternentinte ist bereit.'],inkCast:['별자리를 남겼어요.','Constellation traced.','Sternbild gezeichnet.'],novaCast:['신성이 터졌어요.','Nova cast.','Nova entfacht.'],gateCast:['차원문이 열렸어요.','Portal opened.','Portal geöffnet.'],
 idleNotice:['카메라 없이 연습할 수 있어요. 방향키로 이동하고 Enter로 주문을 쓸 수도 있어요.','Practice without a camera. You can also move with the arrow keys and cast with Enter.','Übe ohne Kamera. Du kannst dich auch mit den Pfeiltasten bewegen und mit Enter zaubern.'],
 permission:['브라우저에서 카메라 사용을 허용하세요.','Allow camera access in your browser.','Erlaube den Kamerazugriff im Browser.'],
 loading:['손동작 모델을 불러오고 있어요.','Loading the hand model.','Das Handmodell wird geladen.'],
 ready:['손이 보이도록 카메라 앞에 서세요. 영상은 이 기기에서 처리됩니다.','Place your hands in view. Video is processed on this device.','Halte deine Hände ins Bild. Das Video wird auf diesem Gerät verarbeitet.'],
 readyBackdrop:['거울 화면이 켜졌어요. 현재 보이는 카메라 영상은 PNG와 녹화에 포함됩니다. 프로젝트 파일에는 주문이 저장돼요.','Your mirror is live. PNGs and recordings include the visible camera backdrop. Projects store only your spells.','Dein Spiegelbild ist aktiv. PNGs und Aufnahmen enthalten das sichtbare Kamerabild. Projekte speichern nur deine Zauber.'],
 lost:['손을 카메라 안으로 다시 가져오세요.','Bring your hands back into view.','Halte deine Hände wieder ins Bild.'],
 ended:['카메라를 껐어요. 무대에서 바로 연습할 수 있어요.','Camera stopped. You can keep practising on the stage.','Kamera beendet. Du kannst auf der Bühne weiterüben.'],
 error:['카메라나 손동작 모델을 열지 못했어요. 네트워크와 카메라 권한을 확인하거나 연습 무대를 사용하세요.','Could not open the camera or its hand model. Check the connection and camera permission, or use the practice stage.','Kamera oder Handmodell konnte nicht geöffnet werden. Prüfe Verbindung und Kamerazugriff oder nutze die Übungsbühne.'],
 denied:['카메라 접근이 차단됐어요. 브라우저의 사이트 설정에서 허용하거나 연습 무대를 사용하세요.','Camera access is blocked. Allow it in site settings or use the practice stage.','Kamerazugriff ist gesperrt. Erlaube ihn in den Website-Einstellungen oder nutze die Übungsbühne.'],
 calibrating:['손바닥 한쪽을 카메라에 펴고 잠시 유지하세요.','Hold one open palm still toward the camera.','Halte eine offene Handfläche ruhig vor die Kamera.'],
 calibrated:['손 크기를 맞췄어요. 엄지와 검지를 맞대서 그려 보세요.','Hand size calibrated. Pinch your thumb and index finger to draw.','Handgröße kalibriert. Lege Daumen und Zeigefinger zum Zeichnen zusammen.'],
 calibrationFailed:['손을 측정하지 못했어요. 더 밝은 곳에서 다시 시도하세요.','The hand could not be measured. Try again in better light.','Die Hand konnte nicht gemessen werden. Versuche es bei besserem Licht erneut.'],
 saving:['장면을 인화하고 있어요.','Preparing your still.','Das Bild wird vorbereitet.'],saved:['장면을 PNG로 저장했어요.','Scene captured as a PNG.','Szene als PNG gespeichert.'],saveFail:['장면을 저장하지 못했어요. 다시 시도하세요.','Could not save the still. Please try again.','Das Bild konnte nicht gespeichert werden. Versuche es erneut.'],
 backdropOn:['화면에 보이는 카메라 영상은 PNG와 녹화에 포함됩니다. 프로젝트에는 주문만 저장됩니다.','PNGs and recordings include the visible camera backdrop. Projects store only your spells.','Das sichtbare Kamerabild erscheint in PNGs und Aufnahmen. Projekte speichern nur deine Zauber.'],
 max:['주문 72개를 모두 사용했어요. 새 주문을 추가하려면 하나를 되돌리세요.','All 72 spell slots are filled. Undo a spell to make room.','Alle 72 Zauberplätze sind belegt. Entferne einen Zauber, um Platz zu schaffen.'],
 restored:['저장한 별자리와 주문을 열었어요.','Your spell composition is open.','Deine Zauberkomposition ist geöffnet.'],
 bad:['이 주문 프로젝트를 읽을 수 없어요.','This spell project could not be read.','Dieses Zauberprojekt kann nicht gelesen werden.'],
 example:['베스퍼의 문','The Vesper Passage','Die Vesperpforte'],project:['나의 천체 무대','My astral stage','Meine Astralbühne'],
 inkKey:['방향키로 선을 그리고 Enter로 마치세요.','Draw with the arrow keys, then press Enter to finish.','Zeichne mit den Pfeiltasten und schließe mit Enter ab.'],
 expandFail:['이 브라우저에서는 전체 화면을 열 수 없어요.','Full screen is unavailable in this browser.','Vollbild wird in diesem Browser nicht unterstützt.']
};
Object.assign(words,{
 intro:['손끝을 지팡이로 바꾸세요. 잿불을 날리고 방패를 들어 소용돌이 속으로 빛을 쏘세요.','Turn your hand into a wand. Sling embers, raise a glass shield and send a bolt into the vortex.','Verwandle deine Hand in einen Zauberstab. Schleudere Glut, hebe den Glasschild und ziele in den Strudel.'],
 first:['지팡이가 준비됐어요.','Wand ready.','Zauberstab bereit.'],
 idleNotice:['무대를 누른 채 마력을 모으고 휘둘러 놓으세요. 키보드는 Enter로 시작하고 방향키로 조준한 뒤 Enter로 발사합니다.','Hold on the stage, flick and release. On a keyboard, press Enter, aim with the arrow keys, then press Enter to cast.','Halte auf der Bühne, wische und lass los. Mit der Tastatur startest du mit Enter, zielst mit den Pfeiltasten und löst mit Enter aus.'],
 scope:['마법 무대. 방향키로 조준하고 Enter로 시작하거나 발사합니다.','Spell stage. Aim with the arrow keys. Enter starts or releases your spell.','Zauberbühne. Ziele mit den Pfeiltasten. Enter beginnt den Zauber oder löst ihn aus.']
});
words.intro=['카메라 앞에서 은빛 입자를 모아 흩뿌리거나, 손끝으로 방패와 차원문을 여세요.','Gather silver dust in your hands, scatter it across the mirror, or switch to a shield or a portal.','Sammle Silberstaub mit den Händen, verstreue ihn im Spiegel oder wechsle zum Schild oder Portal.'];
Object.assign(words,{
 dustPractice:['길게 눌러 모으고 놓아 흩뿌리세요. 두 손가락이나 Shift+드래그로 구름을 늘일 수 있어요.','Hold to gather, release to scatter. Use two fingers or Shift-drag to stretch the cloud.','Halte zum Sammeln und lass zum Verstreuen los. Mit zwei Fingern oder Umschalt-Ziehen dehnst du die Wolke.'],
 dustLive:['두 손 사이에서 구름을 늘이고, 한 손으로 옮기세요. 손끝을 맞대 모은 뒤 손바닥을 펴면 흩어집니다.','Stretch the cloud between your palms or carry it with one hand. Pinch to charge, then open to scatter.','Spanne die Wolke zwischen beiden Händen oder trage sie mit einer. Kneife zum Aufladen und öffne die Hand zum Verstreuen.'],
 dustKeys:['터치나 마우스를 누른 채 움직이세요. 키보드는 Enter로 모으고 방향키로 이동합니다. X로 한쪽 끝을 고정하고 Enter로 흩뿌리세요.','Hold and move on the stage. With a keyboard, press Enter to gather, use the arrows to move and X to anchor one end. Press Enter to scatter.','Halte und ziehe auf der Bühne. Per Tastatur sammelst du mit Enter, bewegst dich mit den Pfeiltasten und fixierst ein Ende mit X. Enter verstreut die Wolke.'],
 dustCarry:['손바닥 위에 구름이 떠 있어요.','Cloud resting in your palm.','Die Wolke schwebt über deiner Hand.'],
 dustStretch:['두 손 사이에서 구름이 늘어납니다.','Cloud suspended between your hands.','Die Wolke spannt sich zwischen deinen Händen.'],
});
export const lang=()=>window.NightI18n?.lang||'ko';
export const T=key=>{const value=words[key];if(!value)return '';return window.NightI18n?.t?.(...value)||value[{ko:0,en:1,de:2}[lang()]??0];};
export function counter(count){return lang()==='de'?count+' '+(count===1?'Zauber':'Zauber'):lang()==='en'?count+' '+(count===1?'spell':'spells'):'주문 '+count+'개';}

export const dustCounter=count=>lang()==='ko'?'입자 '+count+'개':count+' '+T('dustCount');
