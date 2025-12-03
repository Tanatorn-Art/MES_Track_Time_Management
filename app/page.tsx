import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center py-32 px-16 bg-white dark:bg-black">
        <div className="flex flex-col items-center gap-8 text-center">
          <h1 className="text-4xl font-bold text-black dark:text-white">
            📊 MES Line Report
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-md">
            Create custom dashboards with live data from your APIs
          </p>

          <Link
            href="/dashboard"
            className="px-8 py-4 bg-blue-600 text-white rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg"
          >
            🎨 Open Dashboard Designer
          </Link>

          <div className="mt-8 text-sm text-zinc-500 dark:text-zinc-400">
            <p>Features:</p>
            <ul className="mt-2 space-y-1">
              <li>✅ Drag & drop blocks with API variables</li>
              <li>✅ Custom background images</li>
              <li>✅ Real-time data refresh</li>
              <li>✅ Export/Import configurations</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
