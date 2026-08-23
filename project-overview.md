# Coffee Ratio Calculator Overview

## Project Purpose
A PWA and a Swift wrapper for measuring coffee brew parameters, styled after Japanese minimalist aesthetics. Used by the user to plan coffee rounds on a Moccamaster, which will also be used as a template for an upcoming second-edition coffee-app project.

## Architecture
The PWA (HTML/CSS/JS) is the source of truth for all business logic. The Swift app is a WKWebView shell.

### PWA
- index.html
- styles.css
- app.js
- manifest.json
- sw.js

### Swift Wrapper
- CoffeeCalculatorApp.swift
- ContentView.swift

## Design System
- **Palette:** Warm neutrals (#f5f0eb bg, #6b7c66 accent, #2c2c2c text)
- **Typography:** San Francisco (iOS/macOS) and system sans-serif; tabular numbers for all metrics
- **Components:** Cards with 20px rounded corners, subtle box shadows, spring animations on slider changes
- **Dark Mode:** Native `@media (prefers-color-scheme: dark)` override

## Key Logic
- **Ratio Calculation:** `total_water = grounds * brew_ratio`
- **Ice Split (100% hot / 0% ice when toggle off)**
- **Units:** Liter ↔ US Cup conversion via 4.22675
- **Maximum Batch:** Warning when total output > 1000g

## Future Extensions
- Coffee recipe pre-sets (Japanese iced, cold brew, americano, pourover)
- Timer functionality
- Grinder settings input
- Shot counter / tally
- Shot-timer (start/stop/interval)
- Coffee shopping list/inventory tracker
- Multi-user/multi-brew tracking
- Grind profile visualizer
- Espresso dial-in grader
- Shot-quality grading scale
