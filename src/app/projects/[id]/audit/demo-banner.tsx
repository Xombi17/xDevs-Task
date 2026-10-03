export function DemoBanner() {
  return (
    <div role="note" className="rounded-lg border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad">
      <p className="flex flex-wrap items-center gap-2 font-semibold">
        <span className="rounded bg-bad px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
          DEMO ONLY
        </span>
        Tamper tools are enabled
      </p>
      <p className="mt-2 text-slate-700">
        These tools deliberately corrupt this local database by altering one entry&apos;s payload so you can watch
        Verify catch it. The database triggers stay in place. Never enable this in production.
      </p>
      <p className="mt-1 text-xs text-slate-600">
        How it works: drop the update trigger, change the payload only, recreate the trigger, all in one
        transaction. Hashes are never touched.
      </p>
    </div>
  );
}
