## Android Secure Module Viewer

The web client now calls a native bridge when the module viewer route mounts:

- `window.AndroidSecureModule.enableSecureScreen()`
- `window.AndroidSecureModule.disableSecureScreen()`
- fallback: `window.AndroidSecureModule.setSecureScreen(boolean)`

To actually block screenshots on Android, the native app hosting the WebView must set `FLAG_SECURE`.

### Example Activity Bridge

```kotlin
package com.example.mechalabx

import android.os.Bundle
import android.webkit.JavascriptInterface
import android.view.WindowManager
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        bridge.webView.addJavascriptInterface(object {
            @JavascriptInterface
            fun enableSecureScreen() {
                runOnUiThread {
                    window.setFlags(
                        WindowManager.LayoutParams.FLAG_SECURE,
                        WindowManager.LayoutParams.FLAG_SECURE
                    )
                }
            }

            @JavascriptInterface
            fun disableSecureScreen() {
                runOnUiThread {
                    window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
                }
            }

            @JavascriptInterface
            fun setSecureScreen(enabled: Boolean) {
                runOnUiThread {
                    if (enabled) {
                        window.setFlags(
                            WindowManager.LayoutParams.FLAG_SECURE,
                            WindowManager.LayoutParams.FLAG_SECURE
                        )
                    } else {
                        window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
                    }
                }
            }
        }, "AndroidSecureModule")
    }
}
```

### Notes

- This only works in a native Android host app or WebView shell.
- It cannot be enforced from Safari/Chrome mobile alone.
- The current web client toggles secure mode only on the module viewer page.
