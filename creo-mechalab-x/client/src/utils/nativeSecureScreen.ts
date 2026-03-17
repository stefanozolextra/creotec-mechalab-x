type AndroidSecureBridge = {
  enableSecureScreen?: () => void;
  disableSecureScreen?: () => void;
  setSecureScreen?: (enabled: boolean) => void;
};

type WebkitSecureBridge = {
  postMessage?: (message: string | { enabled: boolean }) => void;
};

type NativeWindow = Window & {
  AndroidSecureModule?: AndroidSecureBridge;
  webkit?: {
    messageHandlers?: {
      secureScreen?: WebkitSecureBridge;
    };
  };
};

export const setNativeSecureScreen = (enabled: boolean): boolean => {
  if (typeof window === 'undefined') return false;

  const nativeWindow = window as NativeWindow;
  let signaled = false;

  try {
    if (enabled) {
      if (typeof nativeWindow.AndroidSecureModule?.enableSecureScreen === 'function') {
        nativeWindow.AndroidSecureModule.enableSecureScreen();
        signaled = true;
      } else if (typeof nativeWindow.AndroidSecureModule?.setSecureScreen === 'function') {
        nativeWindow.AndroidSecureModule.setSecureScreen(true);
        signaled = true;
      }
    } else if (typeof nativeWindow.AndroidSecureModule?.disableSecureScreen === 'function') {
      nativeWindow.AndroidSecureModule.disableSecureScreen();
      signaled = true;
    } else if (typeof nativeWindow.AndroidSecureModule?.setSecureScreen === 'function') {
      nativeWindow.AndroidSecureModule.setSecureScreen(false);
      signaled = true;
    }
  } catch {
    // Ignore bridge failures so the web app stays functional outside native.
  }

  try {
    const secureScreenHandler = nativeWindow.webkit?.messageHandlers?.secureScreen;
    if (typeof secureScreenHandler?.postMessage === 'function') {
      secureScreenHandler.postMessage({ enabled });
      signaled = true;
    }
  } catch {
    // Ignore bridge failures so the web app stays functional outside native.
  }

  window.dispatchEvent(new CustomEvent('native-secure-screen-change', { detail: { enabled } }));
  return signaled;
};
