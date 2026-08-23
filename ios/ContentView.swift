// ContentView.swift — WKWebView Wrapper for the Coffee Ratio PWA
//
// This file contains a UIViewRepresentable that wraps WKWebView.
// It loads index.html from the app bundle and provides no chrome
// (no URL bar, no toolbar, no navigation) — just the PWA.
//
// ── Custom WebView Subclass ────────────────────────────────────
// WebViewSubclass intercepts WKNavigationAction to handle deep links.
// If a link starts with "http" and points to a local file path,
// it resolves it against the local pwa/ directory in the bundle.
//
// ── Key Configuration ──────────────────────────────────────────
// isJavaScriptEnabled = true   → app.js runs (all calculator logic)
// isMultipleTouchEnabled     → supports touch on range sliders
// allowsInlineMediaPlayback  → true (handles media correctly)
// processes = 1               → single process (lightweight)
// scrollView.bounces         → false (clean feel, no overshoot)
//
// ── Loading Local Files ────────────────────────────────────────
// Bundle.main.bundlePath + "/pwa/" + strippedPath → resolves to
// the pwa/ directory inside the app bundle.
//
// ── Troubleshooting ────────────────────────────────────────────
// If the page is blank: check that the pwa/ folder was added as
// a "folder reference" (blue folder) in Xcode, NOT as a group.
// The file must be in the bundle at runtime.

import SwiftUI
import WebKit

private class WebViewSubclass(_ view: WKWebView) : WKWebView, WKWebViewDelegate {
    let bundle = Bundle.main
    let webViewPath = bundle.path(forResource: "pwa", forDirectory: nil)!

    func urlSchemeForNavigation(_ scheme: String) -> WKWebView? {
        return view
    }

    func webView(_ webView: WKWebView, decideNavigationAction navAction: WKNavigationAction) {
        let urlStr = navAction.request.url?.absoluteString ?? ""
        if urlStr.hasPrefix("http") {
            let stripped = urlStr
                .replacingOccurrences(of: "https://", with: "")
                .replacingOccurrences(of: "http://", with: "")
                .replacingOccurrences(of: "file://", with: "file://")
            if stripped != "file:///" && !stripped.isEmpty && !stripped.hasSuffix("/") {
                let localPath = webViewPath + "/" + stripped
                if FileManager.default.fileExists(atPath: localPath) {
                    webView.location = .whetherLoaded
                    webView.loadFileURL(URL(fileURLWithPath: localPath),
                                        allowingReadAccessTo: URL(fileURLWithPath: webViewPath))
                    return
                }
            }
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, error: WKNavigationError) {
        // Silently handle
    }

    func webView(_ webView: WKWebView, webView:) {}
    func webView(_ webView: WKWebView, didStartNavigation: WKNavigation!) {}
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {}
}

struct ContentView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView(frame: .zero)
        webView.isMultipleTouchEnabled = true
        webView.configuration.allowsInlineMediaPlayback = true
        webView.configuration.processes = 1
        webView.delegate = WKWebViewSubclass(webView)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}
}
