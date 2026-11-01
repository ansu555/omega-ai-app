import { Header } from "@/components/layout/header";
import { BackgroundPaths } from "@/components/layout/background-paths";
import { ChatProvider } from "@/components/providers/chat-provider";
import { ChatbotPanel } from "@/components/ui/chatbot-panel";
import { OnboardingGuard } from "@/components/providers/onboarding-guard";

export const dynamic = "force-dynamic";

export default function BuilderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <OnboardingGuard />
      <ChatProvider>
        <BackgroundPaths />
        <div className="flex flex-col h-screen overflow-hidden">
          <Header />
          <div className="flex flex-1 overflow-hidden">
            <main className="flex-1 overflow-y-auto transition-all duration-300">
              {children}
            </main>
            <ChatbotPanel />
          </div>
        </div>
      </ChatProvider>
    </>
  );
}
