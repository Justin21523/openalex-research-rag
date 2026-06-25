import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './i18n/LanguageContext.jsx';
import { TourProvider } from './tour/TourContext.jsx';
import GuidedTourOverlay from './tour/GuidedTourOverlay.jsx';
import TourLauncher from './tour/TourLauncher.jsx';
import Sidebar from './components/layout/Sidebar.jsx';
import MobileTopBar from './components/layout/MobileTopBar.jsx';
import PaperSearch from './pages/PaperSearch.jsx';
import AuthorDashboard from './pages/AuthorDashboard.jsx';
import CitationGraph from './pages/CitationGraph.jsx';
import TopicTrends from './pages/TopicTrends.jsx';
import RagQA from './pages/RagQA.jsx';
import PipelineVisualizer from './pages/PipelineVisualizer.jsx';
import Playground from './pages/Playground.jsx';
import WorkDetail from './pages/WorkDetail.jsx';
import IngestManager from './pages/IngestManager.jsx';
import ReadingList from './pages/ReadingList.jsx';
import LiteratureReview from './pages/LiteratureReview.jsx';
import JournalAnalysis from './pages/JournalAnalysis.jsx';
import ResearchVelocity from './pages/ResearchVelocity.jsx';
import Dashboard from './pages/Dashboard.jsx';
import InstitutionExplorer from './pages/InstitutionExplorer.jsx';
import AnalyticsDashboard from './pages/AnalyticsDashboard.jsx';
import PaperTimeline from './pages/PaperTimeline.jsx';
import DataStory from './pages/DataStory.jsx';

export default function App() {
  return (
    <LanguageProvider>
    <BrowserRouter>
      <TourProvider>
      <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <MobileTopBar />
          <main className="flex-1 overflow-y-auto">
            <div className="min-h-full px-6 py-6">
              <Routes>
                <Route path="/dashboard"   element={<Dashboard />} />
                <Route path="/"            element={<PaperSearch />} />
                <Route path="/search"      element={<PaperSearch />} />
                <Route path="/timeline"    element={<PaperTimeline />} />
                <Route path="/authors"     element={<AuthorDashboard />} />
                <Route path="/institutions" element={<InstitutionExplorer />} />
                <Route path="/citations"   element={<CitationGraph />} />
                <Route path="/topics"      element={<TopicTrends />} />
                <Route path="/rag"         element={<RagQA />} />
                <Route path="/pipeline"    element={<PipelineVisualizer />} />
                <Route path="/data-story"  element={<DataStory />} />
                <Route path="/playground"  element={<Playground />} />
                <Route path="/analytics"   element={<AnalyticsDashboard />} />
                <Route path="/works/:id"          element={<WorkDetail />} />
                <Route path="/ingest"             element={<IngestManager />} />
                <Route path="/reading-list"       element={<ReadingList />} />
                <Route path="/literature-review"  element={<LiteratureReview />} />
                <Route path="/journals"           element={<JournalAnalysis />} />
                <Route path="/velocity"           element={<ResearchVelocity />} />
              </Routes>
            </div>
          </main>
        </div>
        <GuidedTourOverlay />
        <TourLauncher />
      </div>
      </TourProvider>
    </BrowserRouter>
    </LanguageProvider>
  );
}
