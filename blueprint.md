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
9. **Dashboard Component Decomposition**: Broke the monolithic `dashboard.ts` (~607 lines) and `dashboard.html` (~705 lines) into 7 focused child components: `DashboardHeader`, `ContentModelsPanel`, `MediaLibraryPanel`, `EntriesPanel`, `EntryCard`, `AssetPicker`, and `ChatInput`. The dashboard remains a thin orchestrator (~287 lines TS, ~95 lines HTML). A shared `ChatMessage` model was extracted to `models/chat-message.model.ts`.
10. **Power Tools Panel**: Added a dedicated ⚡ Power Tools overlay with two tabs:
    - **Image Converter**: Select HEIC/HEIF/WebP/TIFF/BMP/AVIF files, choose output format (JPEG/PNG/WebP), adjust quality with a slider, preview before/after, view size comparison, then upload directly to Contentful or save to device.
    - **Bulk Upload**: Stage multiple images at once, auto-convert incompatible formats, and upload all to Contentful in parallel with per-file status tracking.
11. **Smart Chat Upload**: When attaching images via chat, HEIC/HEIF and other incompatible formats are auto-converted to JPEG before staging. Users see conversion status messages in the chat feed.
12. **Media Library Enhancements**: The Media Library lightbox now features a 2x2 action grid with: Download (saves asset to device), Rename (inline title editing with save/cancel), Copy ID, and Delete. The `renameAsset` method in ContentfulService auto-republishes renamed assets.
13. **Header Redesign**: Condensed the dashboard header to prioritize Entries & Media library buttons, moving Content Models, Power Tools, Settings, and Logout to a cleaner `⋮` overflow dropdown menu for better responsiveness.
14. **Editable Arrays & Links**: Enhanced `EntryCard` components to fully support editing `Array` and `Link` (entry reference) fields. Array fields can have items added (strings, entry links, mapped asset picker) or removed inline. Single entry references can be set or cleared via dedicated inputs.

## Next Steps
- Implement support for viewing and editing complex field types (Dates, Rich Text) within the entry cards.
- Add batch operations for entries (bulk publish/unpublish/delete).
