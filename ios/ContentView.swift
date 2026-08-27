// ContentView.swift — minimal WKWebView wrapper for the Coffee Ratio PWA
//
// Loads the local pwa/ bundle folder (folder reference, not a file group)
// and displays the PWA fullscreen with no chrome. The PWA is the single
// source of truth — no JS bridging is needed.

import SwiftUI
import WebKit

struct ContentView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView(frame: .zero)
        webView.configuration.allowsInlineMediaPlayback = true
        webView.scrollView.bounces = false
        webView.isMultipleTouchEnabled = true
        webView.navigationDelegate = context.coordinator

        let pwaURL = Bundle.main.url(forResource: "pwa", withExtension: nil)
            ?? URL(fileURLWithPath: Bundle.main.bundlePath).appendingPathComponent("pwa")
        let indexURL = pwaURL.appendingPathComponent("index.html")
        webView.loadFileURL(indexURL, allowingReadAccessTo: pwaURL)
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
        func webView(_ webView: WKWebView,
                     didFail navigation: WKNavigation!,
                     withError error: Error) {
            // The page is local; nothing to recover.
        }

        func webView(_ webView: WKWebView,
                     didFailProvisionalNavigation navigation: WKNavigation!,
                     withError error: Error) {
            // The page is local; nothing to recover.
        }
    }
}
