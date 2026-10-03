import { shortHash } from "@/lib/format";
import { CopyButton } from "./copy-button";

export function HashText({ hash, short = false, copy = false }: { hash: string; short?: boolean; copy?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span title={hash} className="break-all rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">
        {short ? shortHash(hash) : hash}
      </span>
      {copy && <CopyButton value={hash} />}
    </span>
  );
}
