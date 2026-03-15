# Cypressful Blueprint

## Overview
Cypressful is a mobile-first, "headless dashboard" Progressive Web App (PWA) designed for managing Contentful CMS entries via a conversational interface. It replaces the complex desktop UI with a one-handed chat experience powered by Gemini 2.5 Flash.

## Application Architecture & Features
- **Frontend Framework:** Angular 19+ (100% Standalone, Signals, Control Flow)
- **Styling:** Tailwind CSS (Mobile-first, responsive, noise textures, glowing effects)
- **State Management:** Native Angular Signals (`signal()`, `computed()`)
- **Backend/Auth:** Firebase (Authentication, Hosting, Firestore, Cloud Functions)
- **CMS Integration:** Contentful Management API (CMA) SDK
- **AI Integration:** Google Gen AI SDK (via Firebase Callable Functions)
- **Voice Input:** Web Speech API integration

### Key UI Components
- `LoginComponent`: Google SSO login gateway
- `DashboardComponent`: Main layout featuring multi-org space switcher, interactive chat feed, and bottom-anchored text/voice input area.
- Visual elements feature "fade-in-up" chat animations and interactive pulse states when microphone is active.

## Current Progress (MVP Phase 1-6 Completed)
1. **Scaffolded Angular + Firebase App** mapped to specific PWA guidelines.
2. **Setup Chat UI Layout** tailored for the "thumb zone" interactions.
3. **Integrated Contentful Service** capable of parsing dynamic content schemas based on the active Space and Environment.
4. **Set up Firebase Callable function** (`processCommand`) utilizing Gemini 2.5 Flash to accept natural language alongside the schema to output Contentful SDK directives.
5. **Mobile layout polish** incorporating responsive margins and fade animations for a polished feel.
6. **Entry Management & Templates Integration**: Added an Entries Browser overlay, Templates popover, and interactive, inline entry editing cards inside the chat feed to manage Contentful records directly.
7. **Power-Up: Full Entry Lifecycle Control**: Added Unpublish and Delete capabilities to entry cards and the Entries Browser panel. Users can now unpublish published entries (revert to draft) and permanently delete entries — both via UI buttons and through chat AI commands.
8. **Power-Up: Inline Asset Picker**: Link (Asset) fields in entry cards now show an interactive "Choose Asset" button that opens a media library overlay. Users can browse, select, preview, and replace linked assets directly within entry templates. Linked assets show thumbnails with clear/swap controls.

## Next Steps
- Implement support for viewing and editing complex field types (Dates, Rich Text, Entry References) within the entry cards.
- Add batch operations for entries (bulk publish/unpublish/delete).
