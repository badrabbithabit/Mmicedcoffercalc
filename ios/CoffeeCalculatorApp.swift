// CoffeeCalculatorApp.swift — SwiftUI App Entry Point
//
// This is the @main entry point for the iOS app.
// It creates a single WindowGroup that hosts ContentView (a WKWebView).
//
// ── Setup ───────────────────────────────────────────────────────
// 1. Add this file + ContentView.swift to your Xcode iOS project
// 2. Add the entire pwa/ folder as a folder reference in Xcode
// 3. Build & run — the WKWebView loads index.html from the bundle
// 4. The app launches fullscreen with no URL bar or toolbar
//
// ── Why SwiftUI WindowGroup? ───────────────────────────────────
// It's the modern SwiftUI way to define the app's root content.
// No NavigationView, no UITabBarController — just a bare window
// hosting ContentView = WKWebView = the PWA.

import SwiftUI

@main
struct CoffeeCalculatorApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
