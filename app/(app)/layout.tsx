import { Header } from "@/components/layout/header";
import { BackgroundPaths } from "@/components/layout/background-paths";
import { ChatProvider } from "@/components/providers/chat-provider";
import { ChatbotPanel } from "@/components/ui/chatbot-panel";
import { OnboardingGuard } from "@/components/providers/onboarding-guard";
import { DisconnectOverlay } from "@/components/onboarding/disconnect-overlay";
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OnboardingGuard />
      <DisconnectOverlay />
      <ChatProvider>
        <BackgroundPaths />
        <div className="flex flex-col h-screen overflow-hidden">
          {/* Header - full width at top */}
          <Header />
          {/* Content area - flex row with main content and chat */}
          <div className="flex flex-1 overflow-hidden">
            {/* Main content area - shrinks when chat opens */}
            <main className="flex-1 overflow-y-auto transition-all duration-300">
              {children}
            </main>
            {/* Chat panel - stays fixed, doesn't scroll */}
            <ChatbotPanel />
          </div>
        </div>
      </ChatProvider>
    </>
  );
}
