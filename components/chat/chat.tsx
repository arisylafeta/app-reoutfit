import { useEffect, useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useStreamContext } from "@/providers/Stream";
import { Button } from "@/components/ui/button";
import { ChatHeader } from "@/components/chat/chat-header";
import { MultimodalInput } from "./multimodal-input";
import { ArrowDown } from "lucide-react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { Messages } from "@/components/messages/messages";
import { toast } from "sonner";
import { useFileUpload } from "@/hooks/use-file-upload";
import { ArtifactSidebar } from "@/components/artifact/artifact-sidebar";
import Suggested from "./suggested";
import { useChatArtifact } from "@/hooks/use-chat-artifact";
import { useChatSubmission } from "@/hooks/use-chat-submission";
import { useChatSidebar } from "@/hooks/use-chat-sidebar";
import { useThreads } from "@/providers/Thread";
import { createClient } from "@/utils/supabase/client";


function ScrollToBottom() {
  const { scrollToBottom } = useStickToBottomContext();
  const [isAtBottom, setIsAtBottom] = useState(true);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  // Manual scroll detection since use-stick-to-bottom isn't working
  useEffect(() => {
    const checkScroll = () => {
      if (scrollContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        const atBottom = scrollHeight - scrollTop <= clientHeight + 50;
        setIsAtBottom(atBottom);
      }
    };

    // Find the scroll container
    const scrollContainer = document.querySelector('.overflow-y-auto') as HTMLElement;
    if (scrollContainer) {
      scrollContainerRef.current = scrollContainer;
      
      // Check on mount
      checkScroll();
      
      // Listen to scroll events
      scrollContainer.addEventListener('scroll', checkScroll);
      
      // Also check on resize
      const resizeObserver = new ResizeObserver(checkScroll);
      resizeObserver.observe(scrollContainer);
      
      return () => {
        scrollContainer.removeEventListener('scroll', checkScroll);
        resizeObserver.disconnect();
      };
    }
  }, []);

  if (isAtBottom) {
    return null;
  }
  
  const handleClick = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    } else {
      scrollToBottom();
    }
  };
  
  return (
    <div 
      className="fixed bottom-36 left-1/2 -translate-x-1/2 pointer-events-auto z-50"
    >
      <Button
        variant="outline"
        size="icon"
        className="shadow-lg rounded-full h-10 w-10"
        onClick={handleClick}
      >
        <ArrowDown className="h-4 w-4" />
        <span className="sr-only">Scroll to bottom</span>
      </Button>
    </div>
  );
}

interface ThreadProps {
  initialQuery?: string;
}

export function Thread({ initialQuery }: ThreadProps = {}) {
  const router = useRouter();
  const {
    artifactContext,
    setArtifactContext,
    artifactOpen,
    closeArtifact,
    onArtifactClose,
  } = useChatArtifact();

  const { currentThreadId: threadId } = useThreads();
  const [currentThreadIsPublic, setCurrentThreadIsPublic] = useState(false);
  
  // Fetch thread's is_public status directly from Supabase
  const fetchThreadPrivacy = useCallback(async () => {
    if (!threadId) {
      setCurrentThreadIsPublic(false);
      return;
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('thread')
        .select('is_public')
        .eq('thread_id', threadId)
        .single();

      if (error) {
        console.error('Error fetching thread privacy:', error);
        return;
      }

      console.log('[fetchThreadPrivacy] Thread:', threadId, 'is_public:', data?.is_public);
      setCurrentThreadIsPublic(data?.is_public ?? false);
    } catch (error) {
      console.error('Failed to fetch thread privacy:', error);
    }
  }, [threadId]);

  // Fetch on thread change
  useEffect(() => {
    fetchThreadPrivacy();
  }, [fetchThreadPrivacy]);
  
  const {
    chatHistoryOpen,
    toggleSidebar,
    isLargeScreen,
  } = useChatSidebar();

  // Auto-close sidebar when artifact opens
  useEffect(() => {
    if (artifactOpen && chatHistoryOpen && isLargeScreen) {
      toggleSidebar();
    }
  }, [artifactOpen, chatHistoryOpen, isLargeScreen, toggleSidebar]);
  const {
    contentBlocks,
    setContentBlocks,
    handleFileUpload,
    dropRef,
    removeBlock,
    resetBlocks: _resetBlocks,
    dragOver,
    handlePaste,
  } = useFileUpload();
  const stream = useStreamContext();
  const {
    input,
    setInput,
    firstTokenReceived,
    handleSubmit,
    handleRegenerate,
  } = useChatSubmission({
    stream,
    artifactContext,
    contentBlocks,
    setContentBlocks,
  });

  const messages = stream.messages;
  const isLoading = stream.isLoading;

  const lastError = useRef<string | undefined>(undefined);
  const prevMessagesLength = useRef(messages.length);
  const hasAutoSent = useRef(false);

  // Auto-send initial query from landing page
  useEffect(() => {
    if (initialQuery && !hasAutoSent.current && !isLoading && messages.length === 0) {
      hasAutoSent.current = true;
      setInput(initialQuery);
      // Small delay to ensure input is set before submitting
      setTimeout(() => {
        const form = document.querySelector('form');
        if (form) {
          form.requestSubmit();
        }
      }, 100);
    }
  }, [initialQuery, isLoading, messages.length, setInput]);

  // Auto-scroll to bottom when new messages arrive or when loading starts
  useEffect(() => {
    const scrollContainer = document.querySelector('.overflow-y-auto') as HTMLElement;
    if (!scrollContainer) return;

    // Check if we should auto-scroll (user was at bottom or new message added)
    const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
    const wasAtBottom = scrollHeight - scrollTop <= clientHeight + 100;
    const newMessageAdded = messages.length > prevMessagesLength.current;

    if (wasAtBottom || newMessageAdded || isLoading) {
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: 'smooth'
      });
    }

    prevMessagesLength.current = messages.length;
  }, [messages.length, isLoading]);

  const setThreadId = useCallback((id: string | null) => {
    // close artifact and reset artifact context
    closeArtifact();
    setArtifactContext({});
    
    // Navigate to appropriate route
    if (id === null) {
      router.push('/');
    } else {
      router.push(`/chat/${id}`);
    }
  }, [router, closeArtifact, setArtifactContext]);

  useEffect(() => {
    if (!stream.error) {
      lastError.current = undefined;
      return;
    }
    try {
      const message = (stream.error as any).message;
      if (!message || lastError.current === message) {
        // Message has already been logged. do not modify ref, return early.
        return;
      }

      // Check if error is related to thread not found or access denied
      const isThreadNotFound = 
        message.toLowerCase().includes('thread not found') ||
        message.toLowerCase().includes('thread does not exist') ||
        message.toLowerCase().includes('404');
      
      const isAccessDenied = 
        message.toLowerCase().includes('access denied') ||
        message.toLowerCase().includes('403') ||
        message.toLowerCase().includes('unauthorized');

      if ((isThreadNotFound || isAccessDenied) && threadId) {
        // Reset to new chat when thread is not found or access denied
        lastError.current = message;
        toast.info(isAccessDenied ? "Access denied" : "Thread not found", {
          description: "Starting a new chat instead.",
          closeButton: true,
        });
        router.push('/');
        return;
      }

      // Message is defined, and it has not been logged yet. Save it, and send the error
      lastError.current = message;
      toast.error("An error occurred. Please try again.", {
        description: (
          <p>
            <strong>Error:</strong> <code>{message}</code>
          </p>
        ),
        richColors: true,
        closeButton: true,
      });
    } catch {
      // no-op
    }
  }, [stream.error, threadId, router]);

  const chatStarted = !!threadId || !!messages.length;
  const hasNoAIOrToolMessages = !messages.find(
    (m) => m.type === "ai" || m.type === "tool",
  );

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <div className={cn("grid w-full grid-cols-[1fr_0fr] transition-all duration-500")}
      >
        <div
          className={cn(
            "relative flex min-w-0 flex-1 flex-col overflow-hidden",
            !chatStarted && "grid-rows-[1fr]",
          )}
        >
          <ChatHeader
            chatStarted={chatStarted}
            isOverlayLayout={artifactOpen}
            isLargeScreen={isLargeScreen}
            chatHistoryOpen={chatHistoryOpen}
            onToggleSidebar={toggleSidebar}
            onNewThread={() => setThreadId(null)}
            threadId={threadId || undefined}
            isPublic={currentThreadIsPublic}
            onPrivacyChange={() => {
              // Refetch privacy status from database
              fetchThreadPrivacy();
              // Trigger thread list refresh
              window.dispatchEvent(new Event('thread-updated'));
            }}
            opened={chatHistoryOpen}
          />

          <StickToBottom 
            className={cn(
              "relative flex-1 overflow-y-auto overflow-x-hidden",
              artifactOpen ? "md:pr-[420px]" : "px-4",
            )}
            resize="smooth"
          >
            <div
              className={cn(
                "pt-6 pb-8 flex flex-col gap-4 w-full min-w-0",
                artifactOpen ? "px-4 md:max-w-[400px]" : "max-w-3xl mx-auto",
                !chatStarted && "mt-[25vh]",
              )}
            >
              <Messages
                messages={messages}
                isLoading={isLoading}
                firstTokenReceived={firstTokenReceived}
                hasNoAIOrToolMessages={hasNoAIOrToolMessages}
                streamInterrupt={stream.interrupt}
                handleRegenerate={handleRegenerate}
              />
            </div>
            <ScrollToBottom />
          </StickToBottom>

          <div className="absolute inset-0 m-auto md:px-10 px-3 flex items-center justify-center pointer-events-none">
            {!chatStarted && (
              <Suggested/>
            )}
          </div>
          {/* Static bottom input panel (outside scroll container) */}
          <div
            className={cn(
              "flex flex-col items-center gap-8 bg-background w-full min-w-0 overflow-x-hidden px-3 sm:px-4",
              artifactOpen ? "px-4 md:max-w-[400px]" : "max-w-3xl mx-auto",
            )}
          >
            <div
              ref={dropRef}
              className={cn(
                "bg-background relative z-10 mb-8 w-full rounded-2xl shadow-xs transition-all",
                dragOver
                  ? "border-primary border-2 border-dashed"
                  : "border border-solid",
              )}
            >
              <MultimodalInput
                input={input}
                setInput={setInput}
                onPaste={handlePaste}
                onSubmit={handleSubmit}
                contentBlocks={contentBlocks}
                onRemoveBlock={removeBlock}
                onFileChange={handleFileUpload}
                isLoading={isLoading}
                onStop={() => stream.stop()}
              />
            </div>
          </div>
        </div>

        {/* Artifact Sidebar */}
        <ArtifactSidebar
          onClose={() => onArtifactClose({ wait: 150 })}
          open={artifactOpen}
          isSidebarOpen={chatHistoryOpen}
          blankBackground={false}
        />
      </div>
    </div>
  );
}
