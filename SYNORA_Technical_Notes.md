# SYNORA HYPNEXIS26 Presentation Notes

## Deliverables

- `SYNORA_HYPNEXIS26_Final_Presentation.pptx` — editable PowerPoint generated from `HYPNEXIS26_Official_PPT_Template.pptx`.
- `SYNORA_HYPNEXIS26_Final_Presentation.pdf` — PowerPoint PDF export of the same nine-slide deck.
- `SYNORA_Technical_Notes.md` — this verification and limitation record.

## Source files inspected

- `package.json`
- `server.ts`
- `.env.example`
- `README.md`
- `src/App.tsx`
- `src/components/LandingPage.tsx`
- `src/components/IntroScreen.tsx`
- `src/components/UploadWorkspace.tsx`
- `src/components/OverviewDashboard.tsx`
- `src/components/AskDataLensView.tsx`
- `src/components/KnowledgeGraphView.tsx`
- `src/components/FilesSourcesView.tsx`
- `src/components/DataExplorerView.tsx`
- `src/components/DataQualityView.tsx`
- `src/components/QueryHistoryView.tsx`
- `src/services/fileIngestion.ts`
- `src/services/schemaProfiler.ts`
- `src/services/sqlEngine.ts`
- `src/services/accessControl.ts`
- `src/services/questionRouter.ts`
- `src/services/evidenceSynthesizer.ts`
- `src/services/documentIndexer.ts`
- `src/services/relationshipBuilder.ts`
- `src/services/soundEffects.ts`
- `HYPNEXIS26_Official_PPT_Template.pptx`

## Verified application state

The application was run locally with `npm run dev` and the production build was verified with `npm run build`.

The automated demo route `http://localhost:3000/?autostart=1` produced a working labelled synthetic workspace with:

- 5 sources.
- 2 relational tables.
- 27 processed rows.
- 42 graph nodes.
- 4 data-quality issues.
- Verified suggested questions.
- Extracted key insights.
- Discovered relational tables.
- Closed-world verification status.

The deck labels these screens as a synthetic demo rather than as customer or production data.

## Screenshot assets

Screenshots are stored under `presentation_assets/screenshots/`.

- `02_workspace_overview.png` — genuine SYNORA labelled demo workspace overview.
- `03_workspace_header.png` — crop showing the SYNORA workspace header, analysis-complete state, source/table/node counts, and audio control.
- `04_workspace_navigation.png` — crop showing the workspace navigation and closed-world mode panel.
- `05_workspace_insights.png` — crop showing extracted key insights and discovered relational tables.
- `06_workspace_questions.png` — crop showing verified suggested questions.
- `00_intro.png` and `01_landing.png` were captured during the launch/landing flow, but the final deck prioritizes the clearer working workspace captures.

The same genuine workspace capture is used in multiple carefully cropped placements where the current environment did not provide a reliable automated route to every tab without adding presentation-only behavior to the product.

## Technologies represented in the deck

The technology claims are based on the inspected source and `package.json`:

- React 19 and React DOM.
- TypeScript.
- Vite.
- Express.
- Three.js, `OrbitControls`, and `RoomEnvironment`.
- AlaSQL for browser-local read-only analysis.
- SheetJS / `xlsx` for spreadsheet ingestion.
- `papaparse` for CSV processing.
- `pdf-parse` for local PDF text extraction.
- `jszip` for document/package handling.
- Optional `@google/genai` server-side integration for OCR, PDF fallback, SQL generation, and model-assisted responses when credentials are configured.
- Server-side OAuth routes for Google, GitHub, and Microsoft, with provider credentials intentionally kept out of the browser.

## Claims intentionally excluded

- No benchmark score or performance superiority claim is made.
- No production-scale deployment claim is made.
- No customer, revenue, partnership, adoption, ranking, or award claim is made.
- OAuth was not presented as a successful real login because provider credentials were not configured in the capture environment.
- Optional Gemini use is distinguished from the local deterministic demo path.
- Environmental benefits are described as potential resource-efficiency strategies, not measured savings.

## Known limitations

- The available screenshot automation reliably captured the working overview route. It did not reliably capture every individual workspace tab without adding a presentation-only query hook to the application; therefore several placements are crops of the verified overview capture.
- Real Google, GitHub, and Microsoft authentication requires provider-console credentials, exact callback registration, and deployment environment variables.
- Scanned-PDF extraction and optional model-assisted processing require provider configuration when local text extraction is insufficient.
- The official template was edited through installed PowerPoint automation. Final slide PNG renders were exported from the final PPTX for visual inspection.

## Presentation QA performed

- Confirmed the final deck contains exactly 9 slides.
- Confirmed cover fields: BYTE BINDERS, UV19W 67A, AI-02, Data-Analyst Agent on Messy Databases, AI & Machine Learning, Software.
- Preserved HYPNEXIS26, Manipal University Jaipur, department branding, official backgrounds, footer, and page numbering.
- Exported all nine final slides as PNG renders under `presentation_assets/final_renders/`.
- Visually inspected the final slide renders for clipping, image stretching, unreadable overlap, and remaining placeholder text.
- Confirmed the supplied screenshots are real captures of the running SYNORA workspace and are labelled as synthetic demo evidence.
