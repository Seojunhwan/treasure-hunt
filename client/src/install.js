// Getting rid of browser bars. iPhone Safari has no fullscreen API, so the only way is
// "Add to Home Screen"; Android Chrome can go fullscreen on a tap and can offer a real install prompt.
const ua = navigator.userAgent;
const isIOS = /iPhone|iPod/.test(ua); // iPad Safari supports the fullscreen API, so it takes the Android path
export const isStandalone = navigator.standalone === true || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;

let deferredPrompt = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; showBanner(); });

export function showBanner() {
  const box = document.getElementById('install');
  if (isStandalone) return void (box.hidden = true);
  if (isIOS) {
    box.innerHTML = '<b>전체화면으로 즐기려면</b><br>Safari <b>공유 버튼</b> → <b>홈 화면에 추가</b>를 누른 뒤, 홈 화면의 <b>보물찾기</b> 아이콘으로 열어주세요';
    box.hidden = false;
  } else if (deferredPrompt) {
    box.innerHTML = '<b>앱으로 설치</b>하면 주소창 없이 즐길 수 있어요<br><button type="button">설치하기</button>';
    box.querySelector('button').onclick = async () => {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      box.hidden = true;
    };
    box.hidden = false;
  }
}

// Must run inside a tap handler. Fails quietly where unsupported (iPhone).
export function goFullscreen() {
  if (isStandalone || document.fullscreenElement) return;
  document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })
    .then(() => screen.orientation?.lock?.('landscape'))
    .catch(() => {});
}
