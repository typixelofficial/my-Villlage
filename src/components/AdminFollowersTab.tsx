import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Instagram,
  RefreshCw,
  Trash2,
  Upload,
  UserCheck,
} from 'lucide-react';
import {
  auth,
  listVerifiedFollowersAdmin,
  removeVerifiedFollowerAdmin,
  sanitizeInstagramId,
  saveVerifiedFollowersAdmin,
  type VerifiedFollowerRecord,
} from '../lib/firebase.ts';

interface PendingFollowRequest {
  instagramId: string;
  requestedAt: number;
}

/**
 * Parses Instagram official JSON export (followers_1.json), HTML, CSV, or plain newline/comma lists
 * into a deduplicated array of sanitized lowercase Instagram usernames.
 */
function parseFollowerInput(rawText: string): string[] {
  const out = new Set<string>();
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  // Attempt Instagram official JSON export parsing first
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const walk = (node: unknown) => {
        if (!node) return;
        if (Array.isArray(node)) {
          for (const item of node) walk(item);
          return;
        }
        if (typeof node === 'object') {
          const obj = node as Record<string, unknown>;
          if (typeof obj.value === 'string') {
            const clean = sanitizeInstagramId(obj.value).toLowerCase();
            if (clean) out.add(clean);
          }
          if (typeof obj.username === 'string') {
            const clean = sanitizeInstagramId(obj.username).toLowerCase();
            if (clean) out.add(clean);
          }
          for (const val of Object.values(obj)) {
            if (val && typeof val === 'object') walk(val);
          }
        }
      };
      walk(parsed);
      if (out.size > 0) return Array.from(out);
    } catch {
      // Fallback to plain text parsing below
    }
  }

  // Fallback: extract @handles or newline/comma/space separated usernames
  const tokens = trimmed.split(/[\s,;]+/);
  for (const tok of tokens) {
    const clean = sanitizeInstagramId(tok).toLowerCase();
    if (clean.length >= 2) out.add(clean);
  }
  return Array.from(out);
}

export function AdminFollowersTab() {
  const [records, setRecords] = useState<VerifiedFollowerRecord[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingFollowRequest[]>([]);
  const [liveApiConfigured, setLiveApiConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [officialText, setOfficialText] = useState('');
  const [studioText, setStudioText] = useState('');
  const [quickUsername, setQuickUsername] = useState('');
  const [search, setSearch] = useState('');

  const getAdminToken = async (): Promise<string | null> => {
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
  };

  const syncServerDirectory = useCallback(async (allRecords: VerifiedFollowerRecord[]) => {
    const token = await getAdminToken();
    if (!token) return;
    const official = allRecords.filter((r) => r.followsOfficial).map((r) => r.instagramId);
    const studio = allRecords.filter((r) => r.followsStudio).map((r) => r.instagramId);
    await fetch('/api/instagram/admin/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ official, studio }),
    }).catch(() => {});
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [firestoreList, token] = await Promise.all([
        listVerifiedFollowersAdmin(),
        getAdminToken(),
      ]);
      setRecords(firestoreList);
      await syncServerDirectory(firestoreList);

      if (token) {
        const resp = await fetch('/api/instagram/admin/state', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.ok) {
          const data = (await resp.json()) as {
            pendingRequests?: PendingFollowRequest[];
            liveApiConfigured?: boolean;
          };
          setPendingRequests(Array.isArray(data.pendingRequests) ? data.pendingRequests : []);
          setLiveApiConfigured(Boolean(data.liveApiConfigured));
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load verified followers.');
    } finally {
      setLoading(false);
    }
  }, [syncServerDirectory]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const handleFileUpload = async (
    target: 'official' | 'studio',
    file: File | null,
  ) => {
    if (!file) return;
    const text = await file.text();
    const parsed = parseFollowerInput(text);
    if (target === 'official') {
      setOfficialText(parsed.join('\n'));
    } else {
      setStudioText(parsed.join('\n'));
    }
    setStatusMsg(
      `Loaded ${parsed.length} usernames from ${file.name} for @${target === 'official' ? 'typixelofficial' : 'typixel.studio'}. Click "Sync Follower Lists" to save.`,
    );
  };

  const handleSyncLists = async () => {
    const offList = parseFollowerInput(officialText);
    const stuList = parseFollowerInput(studioText);
    if (offList.length === 0 && stuList.length === 0) {
      setErrorMsg('Paste follower usernames or upload followers_1.json for at least one page.');
      return;
    }

    setBusy(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const mergedMap = new Map<string, VerifiedFollowerRecord>();
      for (const existing of records) {
        mergedMap.set(existing.instagramId, { ...existing });
      }
      for (const ig of offList) {
        const cur = mergedMap.get(ig) || {
          instagramId: ig,
          followsOfficial: false,
          followsStudio: false,
          source: 'instagram_export' as const,
        };
        cur.followsOfficial = true;
        cur.source = 'instagram_export';
        mergedMap.set(ig, cur);
      }
      for (const ig of stuList) {
        const cur = mergedMap.get(ig) || {
          instagramId: ig,
          followsOfficial: false,
          followsStudio: false,
          source: 'instagram_export' as const,
        };
        cur.followsStudio = true;
        cur.source = 'instagram_export';
        mergedMap.set(ig, cur);
      }

      const toWrite: VerifiedFollowerRecord[] = [];
      const touched = new Set([...offList, ...stuList]);
      for (const ig of touched) {
        const rec = mergedMap.get(ig);
        if (rec) toWrite.push(rec);
      }

      const count = await saveVerifiedFollowersAdmin(toWrite);
      const nextAll = Array.from(mergedMap.values()).sort((a, b) =>
        a.instagramId.localeCompare(b.instagramId),
      );
      setRecords(nextAll);
      await syncServerDirectory(nextAll);
      setOfficialText('');
      setStudioText('');
      setStatusMsg(`Synced ${count} Instagram follower records to Firestore & server!`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not sync follower lists.');
    } finally {
      setBusy(false);
    }
  };

  const handleApproveBoth = async (rawIg: string) => {
    const ig = sanitizeInstagramId(rawIg).toLowerCase();
    if (ig.length < 2) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const rec: VerifiedFollowerRecord = {
        instagramId: ig,
        followsOfficial: true,
        followsStudio: true,
        source: 'admin_sync',
      };
      await saveVerifiedFollowersAdmin([rec]);
      const nextAll = [
        ...records.filter((r) => r.instagramId !== ig),
        rec,
      ].sort((a, b) => a.instagramId.localeCompare(b.instagramId));
      setRecords(nextAll);
      await syncServerDirectory(nextAll);

      const token = await getAdminToken();
      if (token) {
        await fetch('/api/instagram/admin/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            official: nextAll.filter((r) => r.followsOfficial).map((r) => r.instagramId),
            studio: nextAll.filter((r) => r.followsStudio).map((r) => r.instagramId),
            clearPending: [ig],
          }),
        }).catch(() => {});
      }
      setPendingRequests((prev) => prev.filter((p) => p.instagramId !== ig));
      setQuickUsername('');
      setStatusMsg(`Verified @${ig} as follower of both @typixelofficial & @typixel.studio.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not verify username.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (ig: string) => {
    setBusy(true);
    try {
      await removeVerifiedFollowerAdmin(ig);
      const nextAll = records.filter((r) => r.instagramId !== ig);
      setRecords(nextAll);
      await syncServerDirectory(nextAll);
      setStatusMsg(`Removed @${ig} from verified followers.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to remove record.');
    } finally {
      setBusy(false);
    }
  };

  const bothCount = records.filter((r) => r.followsOfficial && r.followsStudio).length;
  const filtered = records.filter((r) =>
    !search.trim() ? true : r.instagramId.includes(search.trim().toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="p-4 bg-[#131d25] border border-pink-500/25 rounded-lg space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Instagram className="w-4 h-4 text-pink-400" />
            Real Follower Verification Registry
          </div>
          <button
            type="button"
            onClick={() => void refreshAll()}
            disabled={loading}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/8 hover:bg-white/15 text-slate-200 text-[11px] rounded-md cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          Upload Instagram&apos;s official <code className="text-pink-300">followers_1.json</code>{' '}
          export (or paste follower usernames) for <strong>@typixelofficial</strong> and{' '}
          <strong>@typixel.studio</strong>. Login strictly checks both lists before unlocking access.
        </p>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-1">
          <span>
            Verified Both: <strong className="text-emerald-400">{bothCount}</strong>
          </span>
          <span>·</span>
          <span>
            Total Tracked: <strong className="text-white">{records.length}</strong>
          </span>
          <span>·</span>
          <span>
            Live API:{' '}
            <strong className={liveApiConfigured ? 'text-emerald-400' : 'text-amber-300'}>
              {liveApiConfigured ? 'Connected' : 'Using Synced Firestore Lists'}
            </strong>
          </span>
        </div>
      </div>

      {/* Pending Verification Requests from Login Screen */}
      {pendingRequests.length > 0 && (
        <div className="p-3.5 bg-amber-950/35 border border-amber-500/35 rounded-lg space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            Pending Follow Verification Requests ({pendingRequests.length})
          </div>
          <div className="space-y-1.5">
            {pendingRequests.map((req) => (
              <div
                key={req.instagramId}
                className="flex items-center justify-between gap-2 px-3 py-2 bg-[#0a1015] border border-white/10 rounded-lg"
              >
                <span className="text-xs font-semibold text-white">@{req.instagramId}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleApproveBoth(req.instagramId)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold rounded-md cursor-pointer"
                >
                  <UserCheck className="w-3 h-3" />
                  Approve Both
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Single-Username Verify */}
      <div className="p-3.5 bg-[#131d25] border border-white/10 rounded-lg flex items-center gap-2">
        <input
          type="text"
          value={quickUsername}
          onChange={(e) => setQuickUsername(e.target.value.replace(/^@+/, ''))}
          placeholder="Quick-verify @instagram_id (follows both)"
          className="flex-1 px-3 py-2 bg-[#0a1015] border border-white/15 focus:border-emerald-500 rounded-lg text-xs text-white placeholder-slate-500 outline-none"
        />
        <button
          type="button"
          disabled={busy || sanitizeInstagramId(quickUsername).length < 2}
          onClick={() => void handleApproveBoth(quickUsername)}
          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
        >
          Add Follower
        </button>
      </div>

      {/* Upload / Paste Official Follower Lists for BOTH Pages */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3.5 bg-[#131d25] border border-white/10 rounded-lg space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-pink-300">@typixelofficial Followers</span>
            <label className="inline-flex items-center gap-1 px-2 py-1 bg-white/8 hover:bg-white/15 text-[11px] text-slate-200 rounded cursor-pointer">
              <Upload className="w-3 h-3" />
              JSON / TXT
              <input
                type="file"
                accept=".json,.txt,.csv"
                className="hidden"
                onChange={(e) => void handleFileUpload('official', e.target.files?.[0] || null)}
              />
            </label>
          </div>
          <textarea
            rows={4}
            value={officialText}
            onChange={(e) => setOfficialText(e.target.value)}
            placeholder="Paste @typixelofficial follower usernames (one per line) or upload followers_1.json"
            className="w-full p-2.5 bg-[#0a1015] border border-white/15 rounded-lg text-xs text-white placeholder-slate-500 outline-none resize-none"
          />
        </div>

        <div className="p-3.5 bg-[#131d25] border border-white/10 rounded-lg space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-pink-300">@typixel.studio Followers</span>
            <label className="inline-flex items-center gap-1 px-2 py-1 bg-white/8 hover:bg-white/15 text-[11px] text-slate-200 rounded cursor-pointer">
              <Upload className="w-3 h-3" />
              JSON / TXT
              <input
                type="file"
                accept=".json,.txt,.csv"
                className="hidden"
                onChange={(e) => void handleFileUpload('studio', e.target.files?.[0] || null)}
              />
            </label>
          </div>
          <textarea
            rows={4}
            value={studioText}
            onChange={(e) => setStudioText(e.target.value)}
            placeholder="Paste @typixel.studio follower usernames (one per line) or upload followers_1.json"
            className="w-full p-2.5 bg-[#0a1015] border border-white/15 rounded-lg text-xs text-white placeholder-slate-500 outline-none resize-none"
          />
        </div>
      </div>

      <button
        type="button"
        disabled={busy || (!officialText.trim() && !studioText.trim())}
        onClick={() => void handleSyncLists()}
        className="w-full py-2.5 bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg cursor-pointer"
      >
        {busy ? 'Syncing Followers...' : 'Sync Follower Lists to Firestore'}
      </button>

      {statusMsg && (
        <div className="text-xs text-emerald-200 bg-emerald-950/60 border border-emerald-500/35 rounded-lg px-3 py-2">
          {statusMsg}
        </div>
      )}
      {errorMsg && (
        <div className="text-xs text-rose-200 bg-rose-950/60 border border-rose-500/35 rounded-lg px-3 py-2">
          {errorMsg}
        </div>
      )}

      {/* Searchable Verified Followers List */}
      <div className="space-y-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search verified followers..."
          className="w-full px-3 py-2 bg-[#0a1015] border border-white/15 rounded-lg text-xs text-white placeholder-slate-500 outline-none"
        />
        <div className="max-h-48 overflow-y-auto space-y-1.5">
          {filtered.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">
              No synced followers yet. Upload followers_1.json or add usernames above.
            </p>
          ) : (
            filtered.slice(0, 60).map((rec) => (
              <div
                key={rec.instagramId}
                className="flex items-center justify-between gap-2 px-3 py-2 bg-[#131d25] border border-white/10 rounded-lg text-xs"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <span className="font-semibold text-white truncate">@{rec.instagramId}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      rec.followsOfficial
                        ? 'bg-emerald-950 text-emerald-300'
                        : 'bg-rose-950 text-rose-300'
                    }`}
                  >
                    official {rec.followsOfficial ? '✓' : '✗'}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      rec.followsStudio
                        ? 'bg-emerald-950 text-emerald-300'
                        : 'bg-rose-950 text-rose-300'
                    }`}
                  >
                    studio {rec.followsStudio ? '✓' : '✗'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!(rec.followsOfficial && rec.followsStudio) && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleApproveBoth(rec.instagramId)}
                      className="p-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                      title="Mark following both"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleRemove(rec.instagramId)}
                    className="p-1 text-rose-400 hover:text-rose-300 cursor-pointer"
                    title="Remove follower"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
