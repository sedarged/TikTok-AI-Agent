type StatusBarProps = {
  openaiConfigured: boolean;
  elevenlabsConfigured: boolean;
  ffmpegAvailable: boolean;
};

export function StatusBar({ openaiConfigured, elevenlabsConfigured, ffmpegAvailable }: StatusBarProps) {
  const statusBadge = (label: string, ok: boolean) => (
    <span
      className={`rounded-full px-2 py-1 text-xs font-semibold ${
        ok ? "bg-emerald-500/20 text-emerald-200" : "bg-rose-500/20 text-rose-200"
      }`}
    >
      {label}: {ok ? "configured" : "missing"}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {statusBadge("OpenAI", openaiConfigured)}
      {statusBadge("ElevenLabs", elevenlabsConfigured)}
      {statusBadge("FFmpeg", ffmpegAvailable)}
    </div>
  );
}
