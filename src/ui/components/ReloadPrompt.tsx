import { useRegisterSW } from 'virtual:pwa-register/react';

import { UIState, useGameStore } from '../store';

function ReloadPrompt() {
  const uiState = useGameStore((state) => state.uiState);
  const isPlaying = uiState === UIState.PLAYING;

  const {
    offlineReady: [, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      console.log('SW Registered:', registration);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  const handleReload = () => {
    if (isPlaying) {
      // Don't reload while playing - just close the prompt
      // User can reload later when they're not playing
      return;
    }
    updateServiceWorker(true);
  };

  // Only show update prompt when there's a new version and user isn't playing
  const showPrompt = needRefresh && !isPlaying;

  return (
    <div className="pointer-events-none fixed right-0 bottom-4 left-0 z-[9999] flex justify-center px-4 md:justify-end">
      {showPrompt && (
        <div className="pointer-events-auto flex max-w-md flex-col gap-3 rounded-2xl border border-white/15 bg-white/90 px-4 py-3 text-sm font-semibold tracking-[0.08em] text-slate-900 uppercase shadow-xl backdrop-blur">
          <div className="text-xs font-semibold tracking-[0.14em] text-slate-600 uppercase">
            Update ready
          </div>
          <button
            className="rounded-lg bg-slate-900 px-3 py-2 text-white shadow hover:bg-slate-800 active:translate-y-[1px]"
            onClick={handleReload}
          >
            Reload
          </button>
          <button
            className="rounded-lg border border-slate-300 px-3 py-2 text-slate-800 transition hover:bg-slate-50 active:translate-y-[1px]"
            onClick={close}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

export default ReloadPrompt;
