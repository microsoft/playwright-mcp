/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import * as fs from 'fs';
import * as path from 'path';

import type { ToolFactory } from './tool';
import type { Context } from '../context';
import type { CDPSession } from 'playwright';

// 타입 확장 - Window 객체에 사용할 커스텀 속성 추가
declare global {
  interface Window {
    __pwStartRecording?: () => void;
    __pwStopRecording?: () => void;
    __pwRecorderMessage?: (message: any) => void;
    __pwRecordAction?: (action: Action) => void;
    __pwMessageHandler?: (event: any) => void;
    __pwClickListenerActive?: boolean;
    __pwInputListenerActive?: boolean;
    __pwKeyboardListenerActive?: boolean;
    __pwPushStateOverridden?: boolean;
    __pwActionHandler?: (event: MessageEvent) => void;
  }
}

// 녹화된 액션을 저장할 전역 상태
const recorderState = {
  isRecording: false,
  recordedActions: [] as Action[],
  cdpSession: null as CDPSession | null,
  overlayInjected: false,
  lastActionTime: 0, // Track when the last action was recorded
  totalSessions: 0,  // Track how many recording sessions have occurred
};

// 녹화 가능한 액션 타입 정의
type Action = {
  action: 'click' | 'fill' | 'press' | 'navigate' | 'select' | 'check' | 'uncheck' | 'hover';
  selector?: string;
  value?: string;
  key?: string;
  url?: string;
  options?: Record<string, any>;
  timestamp: number;
};

// 오버레이 인젝션에 사용할 스타일
const overlayStyles = {
  container: `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: rgba(0, 0, 0, 0.8);
    border-radius: 4px;
    padding: 8px;
    display: flex;
    align-items: center;
    z-index: 999999;
    color: white;
    font-family: Arial, sans-serif;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  `,
  button: `
    background: #FF3B30;
    border: none;
    border-radius: 50%;
    width: 32px;
    height: 32px;
    display: flex;
    justify-content: center;
    align-items: center;
    margin-right: 8px;
    cursor: pointer;
    color: white;
    font-weight: bold;
  `,
  text: `
    font-size: 14px;
    margin-right: 8px;
  `
};

// 오버레이 인젝션 함수 - 다른 파일에서 접근할 수 있도록 export
export async function injectOverlay(context: Context): Promise<boolean> {
  // 컨텍스트와 탭 확인
  try {
    const tab = context.currentTab();

    // 페이지가 완전히 로드되었는지 확인
    if (!tab || !tab.page) {
      console.warn('Tab or page not available for overlay injection');
      return false;
    }

    // DOM 상태 확인
    let domReady = false;
    try {
      domReady = await tab.page.evaluate(() => {
        return document.readyState === 'complete' || document.readyState === 'interactive';
      });

      if (!domReady) {
        console.log('DOM not ready yet, waiting...');
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (e) {
      console.log('Failed to check DOM state, proceeding anyway');
    }

    // 이미 페이지 내에 오버레이가 있는지 확인 (페이지 이동 후에도 확인)
    let hasOverlay = false;
    try {
      hasOverlay = await tab.page.evaluate(() => {
        return !!document.getElementById('pw-recorder-overlay');
      });
    } catch (e) {
      // DOM 상태가 불안정할 경우 무시하고 계속 진행
      console.log('Failed to check overlay existence, proceeding with injection');
    }

    if (hasOverlay && recorderState.overlayInjected) {
      console.log('Overlay already exists, skipping injection');
      return true;
    }

    // 핸들러를 다시 연결하기 위해 항상 오버레이를 제거하고 다시 생성
    const injectionResult = await tab.page.evaluate(styles => {
      try {
        // body 엘리먼트 확인
        if (!document.body) {
          console.log('Document body not available yet');
          return false;
        }

        // 기존 오버레이 제거 (있을 경우)
        const existingOverlay = document.getElementById('pw-recorder-overlay');
        if (existingOverlay) {
          existingOverlay.remove();
          console.log('Removed existing overlay for fresh injection');
        }

        const overlay = document.createElement('div');
        overlay.id = 'pw-recorder-overlay';
        overlay.style.cssText = styles.container;

        const button = document.createElement('button');
        button.id = 'pw-recorder-button';
        button.style.cssText = styles.button;
        button.innerHTML = '⚫';
        button.title = 'Start/Stop Recording';

        const text = document.createElement('span');
        text.id = 'pw-recorder-status';
        text.style.cssText = styles.text;
        text.textContent = 'Ready to Record';

        overlay.appendChild(button);
        overlay.appendChild(text);
        document.body.appendChild(overlay);

        // 클릭 이벤트 리스너 추가 전에 기존 리스너 제거 (중복 방지)
        const oldButton = button.cloneNode(true) as HTMLButtonElement;
        button.parentNode?.replaceChild(oldButton, button);

        // 새 버튼에 이벤트 리스너 추가
        oldButton.addEventListener('click', () => {
          const isRecording = oldButton.getAttribute('data-recording') === 'true';
          if (isRecording) {
            // 녹화 중지
            oldButton.setAttribute('data-recording', 'false');
            oldButton.style.background = '#FF3B30';
            oldButton.innerHTML = '⚫';
            text.textContent = 'Ready to Record';
            window.__pwStopRecording && window.__pwStopRecording();
          } else {
            // 녹화 시작
            oldButton.setAttribute('data-recording', 'true');
            oldButton.style.background = '#4CD964';
            oldButton.innerHTML = '■';
            text.textContent = 'Recording...';
            window.__pwStartRecording && window.__pwStartRecording();
          }
        });

        // 전역 함수 추가
        window.__pwStartRecording = () => {
          window.postMessage({ type: 'pw-recorder-start' }, '*');
        };

        window.__pwStopRecording = () => {
          window.postMessage({ type: 'pw-recorder-stop' }, '*');
        };

        return true;
      } catch (error) {
        console.error('Error in overlay injection script:', error);
        return false;
      }
    }, overlayStyles);

    if (!injectionResult) {
      console.log('Failed to inject overlay in page context, will retry later');
      return false;
    }

    // 메시지 리스너 추가 (페이지 이동 후에 다시 추가 필요)
    try {
      await tab.page.exposeFunction('__pwRecorderMessage', (message: any) => {
        if (message.type === 'pw-recorder-start')
          startRecording(context).catch(console.error);
        else if (message.type === 'pw-recorder-stop')
          stopRecording(context).catch(console.error);
      }).catch(() => {
        // 이미 정의된 경우 무시
        console.log('Recorder message function already exposed');
      });
    } catch (e) {
      console.log('Error exposing recorder message function, will try to proceed:', e);
    }

    // 이벤트 리스너 설정
    const messageHandlerResult = await tab.page.evaluate(() => {
      try {
        // 이벤트 리스너 중복 제거
        try {
          // @ts-ignore - 동적 속성 무시
          if (window.__pwMessageHandler)
            window.removeEventListener('message', window.__pwMessageHandler);
        } catch (e) {
          // 기존 핸들러가 없으면 무시
        }

        // 이벤트 핸들러를 전역 저장소에 저장하여 나중에 제거할 수 있도록 함
        window.__pwMessageHandler = (event: MessageEvent) => {
          if (event.data.type === 'pw-recorder-start' || event.data.type === 'pw-recorder-stop')
            window.__pwRecorderMessage && window.__pwRecorderMessage(event.data);
        };

        // 타입 체크 무시
        window.addEventListener('message', window.__pwMessageHandler as EventListener);
        console.log('Added message event listener for recorder');
        return true;
      } catch (error) {
        console.error('Error setting up message handler:', error);
        return false;
      }
    }).catch(e => {
      console.log('Error evaluating message handler script:', e);
      return false;
    });

    if (!messageHandlerResult)
      console.log('Failed to set up message handler, but continuing anyway');


    recorderState.overlayInjected = true;
    console.log('👉 녹화 버튼이 페이지에 추가되었습니다. 브라우저의 우측 하단에서 확인하세요.');
    return true;
  } catch (error) {
    console.error('Failed to inject recorder overlay:', error);
    return false;
  }
}

// 녹화 시작
async function startRecording(context: Context) {
  if (recorderState.isRecording)
    return;

  const tab = context.currentTab();
  // Don't clear previous actions - allow accumulating actions across sessions
  // recorderState.recordedActions = [];
  recorderState.isRecording = true;
  recorderState.totalSessions++;
  console.log(`Starting recording session #${recorderState.totalSessions}`);

  // CDP 세션 생성
  recorderState.cdpSession = await tab.page.context().newCDPSession(tab.page);

  // DOM 이벤트 리스너 설정
  await recorderState.cdpSession.send('Runtime.enable');
  await recorderState.cdpSession.send('DOM.enable');

  // 클릭, 입력, 키보드 이벤트 리스너 설정
  await setupPageEventListeners(tab);

  // 액션 리스너 추가
  await tab.page.exposeFunction('__pwRecordAction', (action: Action) => {
    console.log('Recording action:', action);
    recorderState.recordedActions.push(action);
    recorderState.lastActionTime = Date.now();
    console.log(`Total recorded actions: ${recorderState.recordedActions.length}`);
  }).catch(e => {
    // 이미 정의된 경우 무시
    console.log('Record action function already exposed');
  });

  // 메시지 리스너 추가 (이벤트 전달)
  await tab.page.evaluate(() => {
    // 기존 리스너 중복 제거
    try {
      // @ts-ignore - 동적 속성 무시
      if (window.__pwActionHandler)
        window.removeEventListener('message', window.__pwActionHandler);
    } catch (e) {
      // 무시
    }

    // 새 리스너 추가
    window.__pwActionHandler = (event: MessageEvent) => {
      if (event.data.type === 'pw-recorder-action')
        window.__pwRecordAction && window.__pwRecordAction(event.data);
    };

    window.addEventListener('message', window.__pwActionHandler as EventListener);
    console.log('Action message event listener set up');
  });

  // 페이지 네비게이션 감지 및 오버레이 재주입
  setupNavigationListener(context, tab);

  // 오버레이 상태 업데이트
  await tab.page.evaluate(() => {
    const button = document.getElementById('pw-recorder-button');
    const text = document.getElementById('pw-recorder-status');
    if (button && text) {
      button.dataset.recording = 'true';
      button.style.background = '#4CD964';
      button.innerHTML = '■';
      text.textContent = 'Recording...';
    }
  });
}

// 페이지 네비게이션 이벤트 처리 분리
function setupNavigationListener(context: Context, tab: any) {
  // 기존 리스너 제거
  tab.page.removeAllListeners('framenavigated');
  tab.page.removeAllListeners('domcontentloaded');
  tab.page.removeAllListeners('load');

  // 이미 처리된 URL을 추적하기 위한 세트
  const processedUrls = new Set<string>();

  // 재주입 시도 횟수를 제한하기 위한 맵
  const injectionAttempts = new Map<string, number>();
  const MAX_INJECTION_ATTEMPTS = 3;

  // 오버레이 주입 함수
  const injectOverlayWithRetry = async (url: string) => {
    // 이미 주입되었으면 스킵
    if (recorderState.overlayInjected) {
      console.log('Overlay already injected, skipping re-injection');
      return;
    }

    const attempts = injectionAttempts.get(url) || 0;
    if (attempts >= MAX_INJECTION_ATTEMPTS) {
      console.log(`Max injection attempts (${MAX_INJECTION_ATTEMPTS}) reached for URL: ${url}`);
      return;
    }

    injectionAttempts.set(url, attempts + 1);
    console.log(`Injection attempt ${attempts + 1}/${MAX_INJECTION_ATTEMPTS} for URL: ${url}`);

    try {
      const success = await injectOverlay(context);
      if (success) {
        console.log(`Successfully injected overlay on attempt ${attempts + 1} for URL: ${url}`);

        // 녹화 상태인 경우 오버레이 상태 복원
        if (recorderState.isRecording) {
          try {
            await tab.page.evaluate(() => {
              const button = document.getElementById('pw-recorder-button');
              const text = document.getElementById('pw-recorder-status');
              if (button && text) {
                button.dataset.recording = 'true';
                button.style.background = '#4CD964';
                button.innerHTML = '■';
                text.textContent = 'Recording...';
              }
            });

            // 페이지 이벤트 리스너 재설정
            await setupPageEventListeners(tab);
          } catch (e) {
            console.error('Failed to restore recording state after overlay injection:', e);
          }
        }
      } else {
        console.log(`Failed to inject overlay on attempt ${attempts + 1} for URL: ${url}`);

        // 약간의 지연 후 다시 시도 (페이지가 더 로드되도록)
        setTimeout(() => injectOverlayWithRetry(url), 500);
      }
    } catch (error) {
      console.error('Error during overlay injection retry:', error);

      // 에러가 발생해도 한 번 더 시도
      if (attempts < MAX_INJECTION_ATTEMPTS - 1)
        setTimeout(() => injectOverlayWithRetry(url), 1000);

    }
  };

  // 새 리스너 추가
  tab.page.on('framenavigated', async (frame: any) => {
    if (frame === tab.page.mainFrame()) {
      const url = frame.url();
      console.log('Frame navigated to:', url);

      // 녹화 중인 경우에만 네비게이션 액션 기록
      if (recorderState.isRecording) {
        // 네비게이션 액션 기록 (중복 방지)
        if (!processedUrls.has(url)) {
          processedUrls.add(url);
          recorderState.recordedActions.push({
            action: 'navigate',
            url,
            timestamp: Date.now()
          });
          console.log('Recorded navigation to:', url);
        } else {
          console.log('Skip duplicate navigation record to:', url);
        }
      }

      // 네비게이션 후 오버레이 상태 초기화
      recorderState.overlayInjected = false;

      // 리셋 후 새 주입을 위한 지연
      console.log('Navigation occurred, planning overlay re-injection');

      // URL 변경 즉시 시도하지 않고 페이지가 준비될 때까지 기다림
      // domcontentloaded 이벤트에서 처리
    }
  });

  // dom content loaded에서도 오버레이 주입
  tab.page.on('domcontentloaded', async () => {
    console.log('DOM content loaded event triggered');
    try {
      const url = tab.page.url();

      // 페이지가 로드된 즉시 시도
      setTimeout(() => injectOverlayWithRetry(url), 300);
    } catch (error) {
      console.error('Failed to inject overlay on domcontentloaded:', error);
    }
  });

  // load 이벤트에서도 오버레이 주입 재시도
  tab.page.on('load', async () => {
    console.log('Page load event triggered');
    if (!recorderState.overlayInjected) {
      try {
        const url = tab.page.url();

        // 페이지 완전 로드된 후 재시도 (마지막 기회)
        setTimeout(() => injectOverlayWithRetry(url), 500);
      } catch (error) {
        console.error('Failed to inject overlay on load:', error);
      }
    }
  });
}

// 페이지 이벤트 리스너 설정 함수 분리 (페이지 이동 후 재설정을 위해)
async function setupPageEventListeners(tab: any) {
  try {
    // 클릭 이벤트 감지 설정
    await tab.page.evaluate(() => {
      // 클릭 이벤트 리스너가 이미 있는지 체크
      if (window.__pwClickListenerActive)
        return;

      window.__pwClickListenerActive = true;

      const clickHandler = (event: MouseEvent) => {
        try {
          console.log('Click event captured', event.target);
          const target = event.target as HTMLElement;
          if (!target) {
            console.log('No target element found in click event');
            return;
          }

          // 녹화 버튼 자체 클릭은 무시
          if (target.closest('#pw-recorder-overlay')) {
            console.log('Ignoring click on recorder overlay');
            return;
          }

          // 셀렉터 계산
          let selector = '';

          // ID가 있으면 사용
          if (target.id) {
            selector = `#${target.id}`;
            console.log(`Using ID selector: ${selector}`);
          } else if (target.textContent && target.textContent.trim()) {
            // 텍스트 컨텐츠가 있으면 텍스트 셀렉터 사용
            const trimmedText = target.textContent.trim();
            if (trimmedText.length < 50) { // 너무 긴 텍스트는 사용하지 않음
              selector = `text=${trimmedText}`;
              console.log(`Using text selector: ${selector}`);
            } else {
              selector = target.tagName.toLowerCase();
              console.log(`Text too long, using tag name: ${selector}`);
            }
          } else if (target.className && typeof target.className === 'string') {
            // 클래스 이름이 있으면 사용
            const className = target.className.split(' ')[0];
            if (className && className.indexOf('[object ') === -1) {
              selector = `.${className}`;
              console.log(`Using class selector: ${selector}`);
            } else {
              selector = target.tagName.toLowerCase();
              console.log(`Invalid class name, using tag name: ${selector}`);
            }
          } else if (target.hasAttribute('type')) {
            // 타입 속성이 있으면 사용
            const type = target.getAttribute('type');
            selector = `${target.tagName.toLowerCase()}[type="${type}"]`;
            console.log(`Using type attribute selector: ${selector}`);
          } else {
            // 마지막 대안으로 태그 이름 사용
            selector = target.tagName.toLowerCase();
            console.log(`Using tagName selector: ${selector}`);
          }

          console.log(`Clicked element: ${selector}`);
          console.log('Posting click action message');
          window.postMessage({
            type: 'pw-recorder-action',
            action: 'click',
            selector,
            timestamp: Date.now()
          }, '*');
        } catch (e) {
          console.error('Error in click handler:', e);
        }
      };

      // 이벤트 캡처링으로 등록하여 버블링 단계 이전에 캡처
      document.addEventListener('click', clickHandler, {
        capture: true,
        passive: true // 성능 개선
      });

      // shadowDOM에도 이벤트 리스너 추가를 시도
      try {
        document.querySelectorAll('*').forEach(el => {
          if (el.shadowRoot) {
            console.log('Adding click listener to shadow root');
            el.shadowRoot.addEventListener('click', (e: Event) => {
              // 이벤트를 MouseEvent로 캐스팅
              const mouseEvent = e as MouseEvent;
              clickHandler(mouseEvent);
            }, {
              capture: true,
              passive: true
            });
          }
        });
      } catch (e) {
        console.log('Failed to add shadow DOM listeners:', e);
      }
    });

    // 입력 이벤트 감지 설정
    await tab.page.evaluate(() => {
      // 입력 이벤트 리스너가 이미 있는지 체크
      if (window.__pwInputListenerActive)
        return;

      window.__pwInputListenerActive = true;

      const inputHandler = (event: Event) => {
        try {
          const target = event.target as HTMLInputElement;
          if (!target || !('value' in target))
            return;

          let selector = '';

          if (target.id) {selector = `#${target.id}`;} else if (target.name) {selector = `[name="${target.name}"]`;} else if (target.className && typeof target.className === 'string') {
            const className = target.className.split(' ')[0];
            if (className && className.indexOf('[object ') === -1)
              selector = `.${className}`;
            else
              selector = target.tagName.toLowerCase();
          } else {selector = target.tagName.toLowerCase();}

          console.log(`Input to ${selector}: ${target.value}`);
          window.postMessage({
            type: 'pw-recorder-action',
            action: 'fill',
            selector,
            value: target.value,
            timestamp: Date.now()
          }, '*');
        } catch (e) {
          console.error('Error in input handler:', e);
        }
      };

      // 이벤트 전파를 보장하기 위해 캡처링 단계에서 등록
      document.addEventListener('input', inputHandler, {
        capture: true,
        passive: true
      });

      // change 이벤트도 감지 (일부 사이트에서는 input 대신 change 이벤트 사용)
      document.addEventListener('change', inputHandler, {
        capture: true,
        passive: true
      });

      // shadowDOM에도 이벤트 리스너 추가를 시도
      try {
        document.querySelectorAll('*').forEach(el => {
          if (el.shadowRoot) {
            console.log('Adding input listeners to shadow root');
            el.shadowRoot.addEventListener('input', inputHandler, {
              capture: true,
              passive: true
            });
            el.shadowRoot.addEventListener('change', inputHandler, {
              capture: true,
              passive: true
            });
          }
        });
      } catch (e) {
        console.log('Failed to add shadow DOM listeners:', e);
      }
    });

    // 키보드 이벤트 감지 설정
    await tab.page.evaluate(() => {
      // 키보드 이벤트 리스너가 이미 있는지 체크
      if (window.__pwKeyboardListenerActive)
        return;

      window.__pwKeyboardListenerActive = true;

      const keydownHandler = (event: KeyboardEvent) => {
        try {
          console.log(`Keydown detected: ${event.key}`);
          if (event.key === 'Enter' || event.key === 'Tab' || event.key === 'Escape') {
            console.log(`Recording key press: ${event.key}`);
            window.postMessage({
              type: 'pw-recorder-action',
              action: 'press',
              key: event.key,
              timestamp: Date.now()
            }, '*');
          } else {
            console.log(`Ignoring key press (not Enter/Tab/Escape): ${event.key}`);
          }
        } catch (e) {
          console.error('Error in keydown handler:', e);
        }
      };

      // 키보드 이벤트도 캡처링 단계에서 등록
      document.addEventListener('keydown', keydownHandler, {
        capture: true,
        passive: true
      });

      // shadowDOM에도 이벤트 리스너 추가를 시도
      try {
        document.querySelectorAll('*').forEach(el => {
          if (el.shadowRoot) {
            console.log('Adding keydown listener to shadow root');
            el.shadowRoot.addEventListener('keydown', (e: Event) => {
              // 이벤트를 KeyboardEvent로 캐스팅
              const keyEvent = e as KeyboardEvent;
              keydownHandler(keyEvent);
            }, {
              capture: true,
              passive: true
            });
          }
        });
      } catch (e) {
        console.log('Failed to add shadow DOM listeners:', e);
      }
    });

    // 네비게이션 이벤트 감지 설정
    await tab.page.evaluate(() => {
      // pushState 감지가 이미 설정되어 있는지 체크
      if (window.__pwPushStateOverridden)
        return;

      window.__pwPushStateOverridden = true;

      const originalPushState = history.pushState;
      history.pushState = function() {
        const result = originalPushState.apply(this, arguments as any);
        window.postMessage({
          type: 'pw-recorder-action',
          action: 'navigate',
          url: window.location.href,
          timestamp: Date.now()
        }, '*');
        return result;
      };
    });

    // iframe 내 이벤트도 캡처
    try {
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        if (iframe.contentDocument) {
          console.log('Adding iframe click listener');
          iframe.contentDocument.addEventListener('click', (e: Event) => {
            // 이벤트를 MouseEvent로 캐스팅
            const mouseEvent = e as MouseEvent;
            // iframe 내부 클릭에 대한 간단한 처리
            const target = mouseEvent.target as HTMLElement;
            if (!target)
              return;

            let selector = '';
            if (target.id) {
              selector = `#${target.id}`;
            } else if (target.className && typeof target.className === 'string') {
              const className = target.className.split(' ')[0];
              if (className)
                selector = `.${className}`;
              else
                selector = target.tagName.toLowerCase();
            } else {
              selector = target.tagName.toLowerCase();
            }

            console.log(`Iframe click: ${selector}`);
            // 메시지를 상위 창으로 전송
            window.parent.postMessage({
              type: 'pw-recorder-action',
              action: 'click',
              selector: `iframe >> ${selector}`,
              timestamp: Date.now()
            }, '*');
          }, {
            capture: true,
            passive: true
          });

          console.log('Adding iframe keydown listener');
          iframe.contentDocument.addEventListener('keydown', (e: Event) => {
            // 이벤트를 KeyboardEvent로 캐스팅
            const keyEvent = e as KeyboardEvent;
            // iframe 내부 키보드 이벤트에 대한 처리
            const target = keyEvent.target as HTMLElement;
            if (!target)
              return;

            console.log(`Iframe keydown: ${keyEvent.key}`);
            // 필요한 경우 상위 창으로 메시지 전송
          }, {
            capture: true,
            passive: true
          });
        }
      });
    } catch (e) {
      console.log('Cannot access iframe content, possibly due to cross-origin restrictions:', e);
    }

    console.log('Page event listeners re-established successfully');
  } catch (error) {
    console.error('Failed to setup page event listeners:', error);
  }
}

// 녹화 중지
async function stopRecording(context: Context) {
  if (!recorderState.isRecording)
    return;

  const tab = context.currentTab();

  // CDP 세션 종료
  if (recorderState.cdpSession) {
    await recorderState.cdpSession.detach();
    recorderState.cdpSession = null;
  }

  // Log the number of actions before stopping
  console.log(`Stopping recording with ${recorderState.recordedActions.length} actions recorded`);

  // 오버레이 상태 업데이트
  await tab.page.evaluate(() => {
    const button = document.getElementById('pw-recorder-button');
    const text = document.getElementById('pw-recorder-status');
    if (button && text) {
      button.dataset.recording = 'false';
      button.style.background = '#FF3B30';
      button.innerHTML = '⚫';
      text.textContent = 'Ready to Record';
    }
  });

  // UI에서 중지된 경우에도 안내 메시지를 표시하기 위해 페이지에 메시지 추가
  const actionCount = recorderState.recordedActions.length;
  if (actionCount > 0) {
    try {
      // 현재 작업 디렉토리
      const workingDir = process.cwd();
      const testDirPath = path.resolve(workingDir, 'tests');
      let recommendedPath = '';

      // 추천 경로 찾기
      try {
        if (fs.existsSync(testDirPath)) {
          const testFiles = fs.readdirSync(testDirPath);

          // 마커가 있는 파일 또는 테스트 파일 찾기
          let markerFoundFile = null;
          let anyTestFile = null;

          for (const file of testFiles) {
            if (file.endsWith('.test.ts') || file.endsWith('.spec.ts') || file.endsWith('.test.js') || file.endsWith('.spec.js')) {
              if (!anyTestFile)
                anyTestFile = file;

              // 파일에 마커가 있는지 확인
              const filePath = path.join(testDirPath, file);
              try {
                const content = fs.readFileSync(filePath, 'utf-8');
                if (content.includes('@pw-codegen')) {
                  markerFoundFile = file;
                  break;
                }
              } catch (e) {
                // 파일 읽기 오류 무시
              }
            }
          }

          // 마커가 있는 파일이나 테스트 파일 추천
          if (markerFoundFile)
            recommendedPath = `code_generate({ target_file: "${path.resolve(testDirPath, markerFoundFile)}" })`;
          else if (anyTestFile)
            recommendedPath = `code_generate({ target_file: "${path.resolve(testDirPath, anyTestFile)}" })`;

        }
      } catch (e) {
        console.error('Failed to read tests directory:', e);
      }

      // 페이지에 안내 메시지 표시
      const helpText = recommendedPath ?
        `다음 명령으로 녹화된 코드를 테스트 파일에 삽입할 수 있습니다:\n${recommendedPath}` :
        `녹화된 코드를 테스트 파일에 삽입하려면 'code_generate' 명령을 사용하세요.`;

      await tab.page.evaluate(message => {
        // 알림 스타일 정의
        const notificationStyle = `
          position: fixed;
          bottom: 70px;
          right: 20px;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 10px 15px;
          border-radius: 4px;
          font-family: Arial, sans-serif;
          z-index: 999998;
          max-width: 400px;
          font-size: 14px;
          line-height: 1.4;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        `;

        // 기존 알림 제거
        const existingNotification = document.getElementById('pw-recorder-notification');
        if (existingNotification)
          existingNotification.remove();

        // 새 알림 생성
        const notification = document.createElement('div');
        notification.id = 'pw-recorder-notification';
        notification.style.cssText = notificationStyle;
        notification.innerText = message;

        // 닫기 버튼 추가
        const closeButton = document.createElement('button');
        closeButton.style.cssText = `
          position: absolute;
          top: 5px;
          right: 5px;
          background: transparent;
          border: none;
          color: white;
          font-size: 16px;
          cursor: pointer;
          padding: 0;
          margin: 0;
          line-height: 1;
        `;
        closeButton.innerHTML = '×';
        closeButton.onclick = () => notification.remove();
        notification.appendChild(closeButton);

        // 알림을 바디에 추가
        document.body.appendChild(notification);

        // 10초 후 자동으로 알림 제거
        setTimeout(() => {
          if (notification.parentNode)
            notification.remove();
        }, 10000);
      }, helpText);
    } catch (e) {
      console.error('Failed to show recommendation notification:', e);
    }
  }

  // Set recording state to false but DO NOT clear the recorded actions
  // This allows the code_generate tool to use them later
  recorderState.isRecording = false;
}

// 코드 생성 함수
function generateCode(actions: Action[], language: 'javascript' | 'typescript' = 'javascript'): string {
  if (actions.length === 0)
    return '// No actions recorded';

  const lines: string[] = [];
  const addLine = (line: string) => lines.push(line);

  // 중복 fill 액션 제거를 위한 매핑
  const fillActions = new Map<string, string>();

  // 먼저 모든 fill 액션을 수집하여 셀렉터별 마지막 값만 저장
  actions.forEach(action => {
    if (action.action === 'fill' && action.selector && action.value !== undefined)
      fillActions.set(action.selector, action.value);

  });

  // 처리된 액션을 표시하기 위한 맵
  const processedFills = new Set<string>();

  // 액션을 코드로 변환
  actions.forEach(action => {
    switch (action.action) {
      case 'click':
        if (action.selector)
          addLine(`await page.click('${action.selector}');`);
        break;

      case 'fill':
        if (action.selector && action.value !== undefined) {
          // 이미 처리되지 않은 셀렉터이고, 마지막 값인 경우에만 추가
          if (!processedFills.has(action.selector) &&
              fillActions.get(action.selector) === action.value) {
            addLine(`await page.fill('${action.selector}', '${action.value.replace(/'/g, "\\'")}');`);
            processedFills.add(action.selector);
          }
        }
        break;

      case 'press':
        if (action.key)
          addLine(`await page.keyboard.press('${action.key}');`);
        break;

      case 'navigate':
        if (action.url)
          addLine(`await page.goto('${action.url}');`);
        break;

      case 'select':
        if (action.selector && action.value)
          addLine(`await page.selectOption('${action.selector}', '${action.value}');`);
        break;

      case 'check':
        if (action.selector)
          addLine(`await page.check('${action.selector}');`);
        break;

      case 'uncheck':
        if (action.selector)
          addLine(`await page.uncheck('${action.selector}');`);
        break;

      case 'hover':
        if (action.selector)
          addLine(`await page.hover('${action.selector}');`);
        break;
    }
  });

  return lines.join('\n');
}

// 테스트 파일 검색 함수 추가
async function findTestFiles(): Promise<string> {
  const testDirs = ['tests', 'test', 'e2e', 'specs', '__tests__', 'src/tests'];
  const testExts = ['.test.ts', '.test.js', '.spec.ts', '.spec.js', '.ts', '.js'];
  const results: string[] = [];

  // 현재 디렉토리에서 시작
  let currentDir = process.cwd();

  // 사용자 프로젝트 루트 찾기 시도
  for (let i = 0; i < 5; i++) { // 최대 5단계까지만 상위 디렉토리 확인
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir)
      break; // 루트에 도달함
    currentDir = parentDir;

    // package.json이 있는지 확인 (프로젝트 루트일 가능성 높음)
    if (fs.existsSync(path.join(currentDir, 'package.json')))
      break;

  }

  // 가능한 테스트 디렉토리 확인
  for (const dir of testDirs) {
    const testDirPath = path.resolve(currentDir, dir);
    if (!fs.existsSync(testDirPath))
      continue;

    try {
      const files = fs.readdirSync(testDirPath);
      for (const file of files) {
        // 테스트 파일 확장자 확인
        if (testExts.some(ext => file.endsWith(ext))) {
          // 마커가 있는지 확인
          const filePath = path.join(testDirPath, file);
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            if (content.includes('@pw-codegen')) {
              // 마커가 있는 파일 우선
              results.unshift(`- ${path.relative(currentDir, filePath)} (✓ @pw-codegen 마커 포함)`);
            } else {
              results.push(`- ${path.relative(currentDir, filePath)}`);
            }
          } catch (e) {
            // 파일 읽기 실패, 무시
          }
        }
      }
    } catch (e) {
      // 디렉토리 읽기 실패, 무시
    }
  }

  if (results.length === 0)
    return '테스트 파일을 찾을 수 없습니다. 테스트 파일을 생성하고 @pw-codegen 마커를 추가하세요.';


  return results.join('\n');
}

// 파일 경로 찾기 함수
async function resolveFilePath(filePath: string, context: Context): Promise<string | null> {
  // 1. 주어진 경로가 절대 경로라면 그대로 사용
  if (path.isAbsolute(filePath) && fs.existsSync(filePath)) {
    console.log(`File found with absolute path: ${filePath}`);
    return filePath;
  }

  // 2. 현재 작업 디렉토리(MCP가 실행되는 디렉토리) 기준으로 찾기
  const currentDirPath = path.resolve(process.cwd(), filePath);
  if (fs.existsSync(currentDirPath)) {
    console.log(`File found in current directory: ${currentDirPath}`);
    return currentDirPath;
  }

  // 3. playwright-mcp 모듈을 사용하는 프로젝트의 루트 디렉토리 찾기 시도
  let userProjectRoot = process.cwd();
  const maxDepth = 5; // 최대 5단계까지만 상위 디렉토리 확인

  for (let i = 0; i < maxDepth; i++) {
    const parentDir = path.dirname(userProjectRoot);
    if (parentDir === userProjectRoot)
      break; // 루트에 도달함

    userProjectRoot = parentDir;
    const packageJsonPath = path.join(userProjectRoot, 'package.json');

    if (fs.existsSync(packageJsonPath)) {
      const userFilePath = path.resolve(userProjectRoot, filePath);
      if (fs.existsSync(userFilePath)) {
        console.log(`File found in user project root: ${userFilePath}`);
        return userFilePath;
      }
    }
  }

  // 4. 브라우저 URL에서 정보 추출 시도
  try {
    const tab = context.currentTab();
    const url = tab.page.url();
    console.log(`Current browser URL: ${url}`);

    // 가능한 테스트 디렉토리들
    const possibleDirs = ['tests', 'test', 'e2e', 'examples', 'src/tests'];
    for (const dir of possibleDirs) {
      const testFilePath = path.resolve(userProjectRoot, dir, path.basename(filePath));
      if (fs.existsSync(testFilePath)) {
        console.log(`File found in possible test directory: ${testFilePath}`);
        return testFilePath;
      }
    }
  } catch (e) {
    console.error('Error trying to extract path from URL:', e);
  }

  // 5. 마지막으로 환경 변수 확인
  if (process.env.PLAYWRIGHT_TEST_DIR) {
    const envDirPath = path.resolve(process.env.PLAYWRIGHT_TEST_DIR, filePath);
    if (fs.existsSync(envDirPath)) {
      console.log(`File found using PLAYWRIGHT_TEST_DIR env var: ${envDirPath}`);
      return envDirPath;
    }
  }

  // 파일을 찾지 못함
  console.error(`Failed to find file: ${filePath}`);
  return null;
}

// 지정된 파일에 코드 삽입
async function insertCodeToFile(filePath: string, code: string): Promise<boolean> {
  try {
    console.log(`Attempting to insert code into file: ${filePath}`);

    // 파일 경로 정규화
    const normalizedPath = filePath.trim();

    // 파일이 존재하는지 확인
    if (!fs.existsSync(normalizedPath)) {
      console.error(`File does not exist: ${normalizedPath}`);
      return false;
    }

    // 파일 내용 읽기
    const content = fs.readFileSync(normalizedPath, 'utf-8');
    console.log(`File content loaded, length: ${content.length} bytes`);
    const lines = content.split('\n');
    console.log(`File contains ${lines.length} lines`);

    // 마커 패턴을 정의하고 각 패턴에 대해 로깅
    const markerPatterns = ['//@pw-codegen', '// @pw-codegen', '@pw-codegen'];
    let markerIndex = -1;
    let matchedPattern = '';

    // 모든 라인과 패턴 조합에 대해 확인
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      console.log(`Line ${i + 1}: ${line}`);

      for (const pattern of markerPatterns) {
        if (line.includes(pattern)) {
          markerIndex = i;
          matchedPattern = pattern;
          console.log(`✅ Found marker pattern '${pattern}' at line ${i + 1}`);
          break;
        }
      }

      if (markerIndex !== -1)
        break;
    }

    if (markerIndex === -1) {
      console.error(`❌ Marker not found in file: ${normalizedPath}`);
      return false;
    }

    console.log(`Marker '${matchedPattern}' found at line ${markerIndex + 1}`);

    // Find any existing generated code between this marker and the next expected comment
    // Look for comments that might indicate the end of generated code and start of existing code
    const endPatterns = [
      '여기서부터는 기존 코드가 유지됩니다',
      '// 여기서부터',
      '// 기존 코드'
    ];

    let nextCommentOrEndIndex = -1;

    for (let i = markerIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of endPatterns) {
        if (line.includes(pattern)) {
          nextCommentOrEndIndex = i;
          console.log(`Found end marker '${pattern}' at line ${i + 1}`);
          break;
        }
      }

      // 일반 주석 중에 '기존'이라는 단어가 포함된 것도 확인
      if (nextCommentOrEndIndex === -1 && line.trim().startsWith('//') && line.includes('기존')) {
        nextCommentOrEndIndex = i;
        console.log(`Found general comment with '기존' at line ${i + 1}`);
      }

      if (nextCommentOrEndIndex !== -1)
        break;
    }

    // Prepare the final content by combining the lines before marker, the marker itself,
    // the new generated code, and any existing code after the generated section
    console.log(`Generated code length: ${code.split('\n').length} lines`);
    let result;
    if (nextCommentOrEndIndex !== -1) {
      console.log(`Using existing comment at line ${nextCommentOrEndIndex + 1} as end marker`);
      // If there's a comment indicating the end of generated code, preserve everything after it
      result = [
        ...lines.slice(0, markerIndex + 1), // up to and including marker
        code, // new generated code
        '', // empty line for readability
        ...lines.slice(nextCommentOrEndIndex) // everything from the next comment onwards
      ].join('\n');
    } else {
      console.log('No end marker found, appending code after the marker line');
      // No clear end marker, so insert code after marker and keep everything else
      result = [
        ...lines.slice(0, markerIndex + 1), // up to and including marker
        code, // new generated code
        '', // empty line for readability
        ...lines.slice(markerIndex + 1) // everything after the marker
      ].join('\n');
    }

    // 파일에 저장
    console.log(`Writing updated content (${result.length} bytes) to file: ${normalizedPath}`);
    try {
      fs.writeFileSync(normalizedPath, result, 'utf-8');

      // 저장 후 확인
      const newContent = fs.readFileSync(normalizedPath, 'utf-8');
      console.log(`File written successfully. New content length: ${newContent.length} bytes`);

      // 삽입된 코드가 있는지 확인
      if (newContent.includes(code))
        console.log('Successfully verified that the code was inserted');
      else
        console.warn('Code may not have been properly inserted - not found in file content after write');


      return true;
    } catch (writeError) {
      console.error(`Error writing to file: ${normalizedPath}`, writeError);
      // 파일 권한 확인
      try {
        const stats = fs.statSync(normalizedPath);
        console.log(`File permissions: ${stats.mode.toString(8)}`);
        console.log(`File owner: ${stats.uid}, group: ${stats.gid}`);
      } catch (statError) {
        console.error('Unable to check file permissions:', statError);
      }
      return false;
    }
  } catch (error) {
    console.error('Failed to insert code:', error);
    return false;
  }
}

// 시작 녹화 도구
const startRecordSchema = z.object({});

const startRecord: ToolFactory = captureSnapshot => ({
  capability: 'core',
  schema: {
    name: 'start_record',
    description: 'Start recording user actions in the browser',
    inputSchema: zodToJsonSchema(startRecordSchema),
  },
  handle: async context => {
    try {
      // 브라우저 탭 확인
      await context.ensureTab();

      // 오버레이 주입
      await injectOverlay(context);

      // 녹화 시작
      await startRecording(context);

      return {
        content: [{ type: 'text', text: '녹화가 시작되었습니다. 브라우저에서 액션을 수행하세요.' }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `녹화 시작 실패: ${error}` }],
        isError: true,
      };
    }
  },
});

// 중지 녹화 도구
const stopRecordSchema = z.object({});

const stopRecord: ToolFactory = captureSnapshot => ({
  capability: 'core',
  schema: {
    name: 'stop_record',
    description: 'Stop recording user actions in the browser',
    inputSchema: zodToJsonSchema(stopRecordSchema),
  },
  handle: async context => {
    try {
      // 브라우저 탭 확인
      await context.ensureTab();

      // 녹화 중지
      await stopRecording(context);

      // Record action count for logging
      const actionCount = recorderState.recordedActions.length;
      console.log(`Recording stopped with ${actionCount} actions recorded`);

      // 파일 경로 추천 메시지 생성
      let recommendedPath = '';
      if (actionCount > 0) {
        // 현재 작업 디렉토리
        const workingDir = process.cwd();
        const testDirPath = path.resolve(workingDir, 'tests');

        try {
          if (fs.existsSync(testDirPath)) {
            const testFiles = fs.readdirSync(testDirPath);
            console.log(`Tests directory exists at: ${testDirPath}, found files:`, testFiles);

            // 마커가 있는 파일 찾기
            let markerFoundFile = null;
            let anyTestFile = null;

            for (const file of testFiles) {
              if (file.endsWith('.test.ts') || file.endsWith('.spec.ts') || file.endsWith('.test.js') || file.endsWith('.spec.js')) {
                if (!anyTestFile)
                  anyTestFile = file;

                // 파일에 마커가 있는지 확인
                const filePath = path.join(testDirPath, file);
                try {
                  const content = fs.readFileSync(filePath, 'utf-8');
                  if (content.includes('@pw-codegen')) {
                    markerFoundFile = file;
                    break;
                  }
                } catch (e) {
                  // 파일 읽기 오류 무시
                }
              }
            }

            // 마커가 있는 파일이나 테스트 파일 추천
            if (markerFoundFile) {
              recommendedPath = `code_generate({ target_file: "${path.resolve(testDirPath, markerFoundFile)}" })`;
            } else if (anyTestFile) {
              recommendedPath = `code_generate({ target_file: "${path.resolve(testDirPath, anyTestFile)}" })`;
            } else if (testFiles.length > 0) {
              // 일반 파일이라도 추천
              recommendedPath = `code_generate({ target_file: "${path.resolve(testDirPath, testFiles[0])}" })`;
            }
          } else {
            console.log(`Tests directory does not exist at: ${testDirPath}`);
          }
        } catch (e) {
          console.error('Failed to read tests directory:', e);
        }
      }

      // 액션이 있는 경우에만 도움말 표시
      let helpText = '';
      if (actionCount > 0) {
        if (recommendedPath) {
          helpText = `\n\n녹화된 코드를 테스트 파일에 삽입하려면 다음 명령을 사용하세요:\n${recommendedPath}\n\n주의: 테스트 파일에 //@pw-codegen 또는 // @pw-codegen 마커가 있어야 합니다.`;
        } else {
          // 추천 경로가 없으면 기본 안내 메시지 제공
          helpText = `\n\n녹화된 코드를 테스트 파일에 삽입하려면 다음 명령을 사용하세요:\ncode_generate({ target_file: "your_test_file_path.test.ts" })\n\n주의: 테스트 파일에 //@pw-codegen 또는 // @pw-codegen 마커가 있어야 합니다.\n상대 경로보다는 전체 경로(절대 경로)를 사용하는 것이 더 안정적입니다.`;
        }
      }

      return {
        content: [{
          type: 'text',
          text: `녹화가 중지되었습니다. ${actionCount}개의 액션이 기록되었습니다.${helpText}`
        }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `녹화 중지 실패: ${error}` }],
        isError: true,
      };
    }
  },
});

// 코드 생성 도구
const codeGenerateSchema = z.object({
  target_file: z.string().optional().describe('경로가 지정된 파일에 코드를 삽입합니다. 지정하지 않으면 코드만 반환합니다.'),
  language: z.enum(['javascript', 'typescript']).optional().default('javascript').describe('생성할 코드의 언어'),
});

const codeGenerate: ToolFactory = captureSnapshot => ({
  capability: 'core',
  schema: {
    name: 'code_generate',
    description: 'Generate Playwright test code from recorded actions',
    inputSchema: zodToJsonSchema(codeGenerateSchema),
  },
  handle: async (context, params) => {
    try {
      const validatedParams = codeGenerateSchema.parse(params);

      // Log the current state of recorded actions
      console.log(`Attempting to generate code with ${recorderState.recordedActions.length} recorded actions`);
      console.log(`Last recording session #${recorderState.totalSessions}, last action time: ${new Date(recorderState.lastActionTime).toISOString()}`);

      // Log a summary of action types
      const actionTypes = recorderState.recordedActions.reduce((acc, action) => {
        acc[action.action] = (acc[action.action] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log('Action type summary:', JSON.stringify(actionTypes));

      // 녹화된 액션이 없으면 오류 반환
      if (recorderState.recordedActions.length === 0) {
        return {
          content: [{ type: 'text', text: '녹화된 액션이 없습니다. "start_record" 도구를 사용하여 먼저 액션을 녹화하세요.' }],
          isError: true,
        };
      }

      // 코드 생성
      const code = generateCode(recorderState.recordedActions, validatedParams.language);
      console.log(`Generated code: ${code.length > 100 ? code.substring(0, 100) + '...' : code}`);

      // 현재 작업 디렉토리와 가능한 테스트 파일 위치를 로깅
      const workingDir = process.cwd();
      console.log(`Current working directory: ${workingDir}`);

      // 테스트 디렉토리 존재하는지 확인
      const testDirPath = path.resolve(workingDir, 'tests');
      let testDirExists = false;
      let testFiles: string[] = [];

      try {
        if (fs.existsSync(testDirPath)) {
          testDirExists = true;
          testFiles = fs.readdirSync(testDirPath);
          console.log(`Tests directory exists at: ${testDirPath}`);
          console.log(`Tests directory contents:`, testFiles);
        } else {
          console.log(`Tests directory does not exist at: ${testDirPath}`);
        }
      } catch (e) {
        console.error('Failed to read tests directory:', e);
      }

      // 파일이 지정된 경우 파일에 코드 삽입
      if (validatedParams.target_file) {
        console.log(`Attempting to insert code into file: ${validatedParams.target_file}`);

        // 파일 경로 찾기 시도
        const resolvedPath = await resolveFilePath(validatedParams.target_file, context);

        if (!resolvedPath) {
          // 테스트 파일 검색 결과를 반환
          const searchResult = await findTestFiles();

          // 절대 경로 제안 메시지 생성
          let absolutePathSuggestion = '';
          if (testDirExists && testFiles.length > 0) {
            // 테스트 디렉토리 내 유효한 테스트 파일 추천
            const testFileExample = testFiles.find(f => f.endsWith('.test.ts') || f.endsWith('.spec.ts')) || testFiles[0];
            if (testFileExample)
              absolutePathSuggestion = `다음과 같이 절대 경로를 사용해 보세요:\n\ncode_generate({ target_file: "${path.resolve(testDirPath, testFileExample)}" })\n\n`;

          }

          return {
            content: [{
              type: 'text',
              text: `파일을 찾을 수 없습니다: ${validatedParams.target_file}\n\n상대 경로 대신 절대 경로를 사용하는 것이 더 안정적입니다.\n\n${absolutePathSuggestion}또는 다음 테스트 파일 중 하나를 사용해보세요:\n${searchResult}\n\n생성된 코드:\n\n${code}`
            }],
            isError: true,
          };
        }

        // 파일 처리
        const success = await insertCodeToFile(resolvedPath, code);

        if (success) {
          return {
            content: [{
              type: 'text',
              text: `코드가 성공적으로 생성되어 ${resolvedPath} 파일에 삽입되었습니다.\n\n생성된 코드:\n\n${code}`
            }],
          };
        } else {
          // 절대 경로 제안 메시지 생성
          let absolutePathSuggestion = '';
          if (testDirExists && testFiles.length > 0) {
            // 테스트 디렉토리 내 유효한 테스트 파일 추천
            const testFileExample = testFiles.find(f => f.endsWith('.test.ts') || f.endsWith('.spec.ts')) || testFiles[0];
            if (testFileExample)
              absolutePathSuggestion = `다음과 같이 절대 경로를 사용해 보세요:\n\ncode_generate({ target_file: "${path.resolve(testDirPath, testFileExample)}" })\n\n`;

          }

          return {
            content: [{
              type: 'text',
              text: `파일에 코드를 삽입하지 못했습니다. 파일이 존재하고 //@pw-codegen 마커가 있는지 확인하세요.\n\n상대 경로 대신 절대 경로를 사용하는 것이 더 안정적입니다.\n\n${absolutePathSuggestion}생성된 코드:\n\n${code}`
            }],
            isError: true,
          };
        }
      }

      // 파일이 지정되지 않은 경우, 테스트 파일에 코드를 삽입하는 방법 안내
      let suggestionText = '';
      if (testDirExists && testFiles.length > 0) {
        // 테스트 디렉토리 내 유효한 테스트 파일 추천
        const testFileExample = testFiles.find(f => f.endsWith('.test.ts') || f.endsWith('.spec.ts')) || testFiles[0];
        if (testFileExample)
          suggestionText = `\n\n테스트 파일에 코드를 삽입하려면 다음 명령을 사용하세요:\n\ncode_generate({ target_file: "${path.resolve(testDirPath, testFileExample)}" })\n\n주의: 테스트 파일에 //@pw-codegen 또는 // @pw-codegen 마커가 있어야 합니다.`;

      }

      // 파일이 지정되지 않은 경우 코드만 반환
      return {
        content: [{
          type: 'text',
          text: `생성된 코드:${suggestionText}\n\n${code}`
        }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `코드 생성 실패: ${error}` }],
        isError: true,
      };
    }
  },
});

// 오버레이 상태 초기화 함수 추가
export function resetOverlayState(clearActions = false): void {
  recorderState.overlayInjected = false;
  recorderState.isRecording = false;
  if (recorderState.cdpSession) {
    try {
      recorderState.cdpSession.detach().catch(console.error);
    } catch (e) {
      // 무시
    }
    recorderState.cdpSession = null;
  }

  // Only clear recorded actions if explicitly requested
  if (clearActions) {
    console.log('Clearing recorded actions as requested');
    recorderState.recordedActions = [];
  } else {
    console.log(`Preserving ${recorderState.recordedActions.length} recorded actions`);
  }
}

export default (captureSnapshot: boolean) => [
  startRecord(captureSnapshot),
  stopRecord(captureSnapshot),
  codeGenerate(captureSnapshot),
];
