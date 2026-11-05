import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  AudioLines,
  Sparkles,
  Library,
  SlidersHorizontal,
  Plus,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Upload,
  Music2,
  Play,
  Pause,
  X,
  Scissors,
  Volume2,
  Check,
  Clock3,
  Download,
  RotateCcw,
  Save,
  Settings2,
  CircleHelp,
  Headphones,
  Radio,
  Waves,
  Disc3,
  ShieldCheck,
  LoaderCircle,
  Cable,
  Menu,
  Heart,
  Folder,
  Search,
} from "lucide-react";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/manrope/latin-500.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "./styles.css";
import {
  read,
  write,
  savedApi,
  saveApi,
  downloadRecipe,
  parseRecipe,
  activeStatuses,
} from "./studio.js";
const defaults = {
  mode: "beat",
  duration: 60,
  variations: 2,
  instrumental: true,
  creativity: 65,
  rhythm: 75,
  intensity: 70,
  originality: 85,
  instrument_changes: 60,
  energy: 70,
  mood_similarity: 75,
  emotional_intensity: 65,
  tempo: 120,
  seed: null,
  key_scale: "",
  time_signature: "",
  genre: "Auto-detect",
  instruments: "Let the model choose",
  instructions: "",
  mastering: true,
  gain_db: 0,
  preserve_source: false,
  rights_confirmed: false,
};
const fmt = (n) =>
  `${Math.floor((n || 0) / 60)}:${String(Math.floor((n || 0) % 60)).padStart(2, "0")}`;
function App() {
  const [s, setS] = useState(() => ({
    ...defaults,
    ...read("resona.settings", {}),
    rights_confirmed: false,
  }));
  const update = (k, v) => setS((p) => ({ ...p, [k]: v }));
  const [page, setPage] = useState("create"),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [advanced, setAdvanced] = useState(false),
    [mobile, setMobile] = useState(false);
  const [api, setApi] = useState(savedApi),
    [apiDraft, setApiDraft] = useState(api),
    [status, setStatus] = useState({
      available: false,
      backend: false,
      message: "Connect your generation engine",
    }),
    [connecting, setConnecting] = useState(false);
  const [file, setFile] = useState(null),
    [source, setSource] = useState(null),
    [peaks, setPeaks] = useState([]),
    [length, setLength] = useState(0),
    [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false),
    [volume, setVolume] = useState(0.75),
    [trim, setTrim] = useState(false),
    [trimStart, setTrimStart] = useState(0),
    [trimEnd, setTrimEnd] = useState(0),
    [drag, setDrag] = useState(false),
    [analysis, setAnalysis] = useState(null),
    [uploadId, setUploadId] = useState(null),
    [analyzing, setAnalyzing] = useState(false),
    [analysisRange, setAnalysisRange] = useState(null);
  const [job, setJob] = useState(null),
    [history, setHistory] = useState(() => read(`resona.history:${api}`, [])),
    [libraryBase, setLibraryBase] = useState(api),
    [hiddenJobs, setHiddenJobs] = useState(() => read("resona.hiddenJobs", [])),
    [presets, setPresets] = useState(() => read("resona.presets", [])),
    [presetName, setPresetName] = useState(""),
    [filter, setFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [submitting, setSubmitting] = useState(false);
  const input = useRef(),
    audio = useRef(),
    fileRef = useRef(),
    uploadSerial = useRef(0),
    probeSerial = useRef(0),
    apiRef = useRef(api),
    jobRef = useRef(job),
    submittingRef = useRef(false),
    analysisController = useRef(),
    browserDecoded = useRef(false),
    recipeInput = useRef();
  apiRef.current = api;
  jobRef.current = job;
  const notify = (msg) => setToast(msg);
  const active = job && activeStatuses.includes(job.status);
  const trimDirty =
    !!analysisRange &&
    (Math.abs(trimStart - analysisRange.start) > 0.05 ||
      Math.abs(trimEnd - analysisRange.end) > 0.05);
  const canGenerate =
    status.available &&
    uploadId &&
    !active &&
    !submitting &&
    !analyzing &&
    !trimDirty &&
    (!s.preserve_source || s.rights_confirmed);
  const visibleHistory = history.filter(
    (x) =>
      !hiddenJobs.includes(x.id) &&
      (filter !== "favorites" || x.favorite) &&
      (!query ||
        `${x.name || ""} ${x.settings?.genre || ""}`
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
  useEffect(() => {
    const fn = (e) => {
      if (e.key === "Escape") {
        setModal(null);
        setMobile(false);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);
  useEffect(() => {
    if (!modal) return;
    const old = document.activeElement,
      container = document.querySelector(".modal");
    const nodes = () =>
      Array.from(
        container?.querySelectorAll(
          "button:not(:disabled),a[href],input:not(:disabled),select,textarea",
        ) || [],
      );
    (container?.querySelector("[autofocus]") || nodes()[0])?.focus();
    const trap = (e) => {
      if (e.key !== "Tab") return;
      const list = nodes(),
        a = list[0],
        b = list.at(-1);
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        b?.focus();
      } else if (!e.shiftKey && document.activeElement === b) {
        e.preventDefault();
        a?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", trap);
      document.body.style.overflow = overflow;
      old?.focus();
    };
  }, [modal]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    write("resona.settings", { ...s, rights_confirmed: false });
  }, [s]);
  useEffect(() => {
    if (libraryBase === api)
      write(`resona.history:${api}`, history.slice(0, 100));
  }, [history, api, libraryBase]);
  useEffect(() => {
    write("resona.hiddenJobs", hiddenJobs);
  }, [hiddenJobs]);
  useEffect(() => {
    if (audio.current) audio.current.volume = volume;
  }, [volume, source]);
  useEffect(
    () => () => {
      if (source?.startsWith("blob:")) URL.revokeObjectURL(source);
    },
    [source],
  );
  useEffect(() => {
    const solo = (e) => {
      if (e.target.tagName === "AUDIO")
        document.querySelectorAll("audio").forEach((a) => {
          if (a !== e.target) a.pause();
        });
    };
    document.addEventListener("play", solo, true);
    return () => document.removeEventListener("play", solo, true);
  }, []);
  async function request(path, options = {}, base = api) {
    const res = await fetch(`${base.replace(/\/$/, "")}${path}`, {
      ...options,
      signal: options.signal || AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      let data;
      try {
        data = await res.json();
      } catch {}
      throw Error(
        typeof data?.detail === "string"
          ? data.detail
          : Array.isArray(data?.detail)
            ? data.detail.map((e) => `${e.loc?.at(-1)}: ${e.msg}`).join("; ")
            : `Request failed (${res.status})`,
      );
    }
    const data = await res.json();
    if (path === "/api/health" && typeof data.available !== "boolean")
      throw Error("This address is not a Resona backend.");
    return data;
  }
  async function probe(base = api) {
    const serial = ++probeSerial.current;
    setConnecting(true);
    try {
      const d = await request("/api/health", {}, base);
      if (serial === probeSerial.current) setStatus({ ...d, backend: true });
      return d;
    } catch {
      if (serial === probeSerial.current)
        setStatus({
          available: false,
          backend: false,
          message:
            "Cannot reach the backend. For local use, run START-RESONA.cmd and open http://localhost:5173. For a remote backend, check its HTTPS URL and allowed origins.",
        });
      return null;
    } finally {
      if (serial === probeSerial.current) setConnecting(false);
    }
  }
  useEffect(() => {
    uploadSerial.current++;
    analysisController.current?.abort();
    setAnalyzing(false);
    setUploadId(null);
    setAnalysis(null);
    setAnalysisRange(null);
    setJob(null);
    setHistory(read(`resona.history:${api}`, []));
    setLibraryBase(api);
    setStatus({
      available: false,
      backend: false,
      message: "Checking backend…",
    });
    probe(api);
    const t = setInterval(() => probe(api), 30000);
    return () => {
      probeSerial.current++;
      clearInterval(t);
    };
  }, [api]);
  useEffect(() => {
    if (!status.backend) return;
    let ignore = false,
      busy = false;
    const refresh = async () => {
      if (busy) return;
      busy = true;
      try {
        const rows = await request("/api/jobs");
        if (ignore || !Array.isArray(rows)) return;
        setHistory((old) =>
          rows.map((r) => ({
            ...r,
            favorite: old.find((h) => h.id === r.id)?.favorite || false,
          })),
        );
        const previous = jobRef.current;
        const match = rows.find((r) => r.id === previous?.id);
        const running = rows.find((r) => activeStatuses.includes(r.status));
        if (
          previous &&
          activeStatuses.includes(previous.status) &&
          match?.status === "failed"
        )
          notify(match.error || "Generation failed. Check the worker log.");
        if (match || running)
          setJob(
            match && activeStatuses.includes(match.status)
              ? match
              : running || match,
          );
      } catch {
      } finally {
        busy = false;
      }
    };
    refresh();
    const t = setInterval(refresh, 4000);
    return () => {
      ignore = true;
      clearInterval(t);
    };
  }, [api, status.backend]);
  function clearReference() {
    audio.current?.pause();
    fileRef.current = null;
    uploadSerial.current++;
    analysisController.current?.abort();
    setFile(null);
    setSource(null);
    setPeaks([]);
    setAnalysis(null);
    setAnalysisRange(null);
    setUploadId(null);
    setAnalyzing(false);
    setLength(0);
    setTime(0);
    setTrimStart(0);
    setTrimEnd(0);
    setPlaying(false);
    setTrim(false);
    update("rights_confirmed", false);
  }
  async function analyze(f, start = 0, end = 0) {
    if (!status.backend || !f) return;
    if (end > 0 && end - start < 1) {
      notify("Select at least one second of audio.");
      return;
    }
    const serial = ++uploadSerial.current;
    analysisController.current?.abort();
    const controller = new AbortController();
    analysisController.current = controller;
    const timer = setTimeout(() => controller.abort(), 180000);
    setAnalyzing(true);
    setUploadId(null);
    try {
      const body = new FormData();
      body.append("file", f);
      body.append("trim_start", start);
      if (end > start) body.append("trim_end", end);
      const d = await request("/api/uploads", {
        method: "POST",
        body,
        signal: controller.signal,
      });
      if (serial !== uploadSerial.current) return;
      setAnalysis(d.analysis);
      setUploadId(d.id);
      setAnalysisRange({ start, end: end || d.analysis.duration });
      if (d.analysis.bpm)
        update(
          "tempo",
          Math.max(30, Math.min(300, Math.round(d.analysis.bpm))),
        );
      if (!browserDecoded.current && start === 0) {
        setSource(`${api}${d.audio_url}`);
        setPeaks(d.analysis.waveform);
        setLength(d.analysis.duration);
        setTrimStart(0);
        setTrimEnd(d.analysis.duration);
      }
    } catch (e) {
      if (serial === uploadSerial.current)
        notify(
          e.name === "AbortError"
            ? "Analysis took too long. Try a shorter reference."
            : e.message,
        );
    } finally {
      clearTimeout(timer);
      if (serial === uploadSerial.current) setAnalyzing(false);
    }
  }
  async function loadFile(f) {
    if (!f) return;
    if (!/\.(mp3|wav|flac)$/i.test(f.name)) {
      notify("Please choose an MP3, WAV, or FLAC file.");
      return;
    }
    if (f.size > (status.max_upload_mb || 100) * 1024 * 1024) {
      notify(`Choose a file under ${status.max_upload_mb || 100} MB.`);
      return;
    }
    clearReference();
    fileRef.current = f;
    browserDecoded.current = false;
    setFile(f);
    setSource(URL.createObjectURL(f));
    try {
      const context = new AudioContext();
      try {
        const data = await context.decodeAudioData(await f.arrayBuffer());
        if (fileRef.current !== f) return;
        browserDecoded.current = true;
        const ch = data.getChannelData(0),
          n = 160,
          step = Math.max(1, Math.floor(ch.length / n));
        setPeaks(
          Array.from({ length: n }, (_, i) => {
            let m = 0;
            for (
              let j = i * step;
              j < Math.min(ch.length, (i + 1) * step);
              j += 8
            )
              m = Math.max(m, Math.abs(ch[j]));
            return m;
          }),
        );
        setLength(data.duration);
        setTrimEnd(data.duration);
      } finally {
        await context.close();
      }
    } catch {
      if (fileRef.current === f)
        notify(
          "Browser preview could not decode this audio. The backend can prepare a WAV preview.",
        );
    }
    if (fileRef.current === f) await analyze(f);
  }
  async function sample() {
    try {
      const r = await fetch("/studio-reference.wav");
      if (!r.ok) throw Error();
      await loadFile(
        new File([await r.blob()], "Night drive — studio reference.wav", {
          type: "audio/wav",
        }),
      );
    } catch {
      notify("Sample unavailable. Please upload audio.");
    }
  }
  async function togglePlay() {
    if (!audio.current) return;
    if (playing) audio.current.pause();
    else
      try {
        if (
          audio.current.currentTime < trimStart ||
          audio.current.currentTime >= trimEnd
        )
          audio.current.currentTime = trimStart;
        await audio.current.play();
      } catch {
        notify("Unable to play this audio. Check the backend connection.");
      }
  }
  async function generate(override, referenceId) {
    if (!status.available || submittingRef.current || active) return;
    if (!referenceId && trimDirty) {
      notify("Apply and analyze your trim before generating.");
      return;
    }
    if (!(referenceId || uploadId)) {
      notify("Upload and analyze a reference first.");
      return;
    }
    const base = api;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const d = await request("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upload_id: referenceId || uploadId,
          settings: override || s,
        }),
      });
      if (base !== apiRef.current) return;
      setJob(d);
      setHistory((h) => [d, ...h.filter((x) => x.id !== d.id)]);
      setPage("create");
      notify("Your generation is in the queue.");
    } catch (e) {
      notify(e.message);
      probe();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }
  async function cancelJob(id) {
    const base = api;
    try {
      const d = await request(`/api/jobs/${id}/cancel`, { method: "POST" });
      if (base !== apiRef.current) return;
      setJob(d);
      setHistory((h) => [d, ...h.filter((x) => x.id !== id)]);
      notify(
        d.status === "cancelled"
          ? "Queued job cancelled."
          : "Will stop after this variation. Finished audio will be saved.",
      );
    } catch (e) {
      notify(e.message);
    }
  }
  async function importRecipe(f) {
    if (!f) return;
    try {
      if (f.size > 50000) throw Error("Choose a recipe smaller than 50 KB.");
      const p = parseRecipe(await f.text(), defaults);
      setS(p.settings);
      setPage("create");
      notify(`Loaded ${p.name}. Select your reference before generating.`);
    } catch (e) {
      notify(e.message);
    }
  }
  function savePreset() {
    if (!presetName.trim()) return;
    const next = [
      {
        id: crypto.randomUUID(),
        name: presetName.trim(),
        settings: { ...s, rights_confirmed: false },
      },
      ...presets,
    ];
    setPresets(next);
    const saved = write("resona.presets", next);
    setPresetName("");
    setModal(null);
    notify(
      saved
        ? "Preset saved to this browser."
        : "Browser storage is full. Export your recipe to keep it.",
    );
  }
  function favorite(id) {
    setHistory((h) =>
      h.map((x) => (x.id === id ? { ...x, favorite: !x.favorite } : x)),
    );
  }
  function newSession() {
    clearReference();
    if (!active) setJob(null);
    setPage("create");
    setMobile(false);
    notify("A fresh session, ready for your next idea.");
  }
  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}

      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("create");
          }}
        >
          <span className="brand-mark">
            <AudioLines size={27} />
          </span>
          resona<span className="brand-dot">.</span>
        </a>
        <div className="workspace-switch">
          <div className="workspace-avatar">Y</div>
          <div>
            Your workspace<small>Personal studio</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">STUDIO</div>
        <nav>
          <button
            className={page === "create" ? "selected" : ""}
            onClick={() => {
              setPage("create");
              setMobile(false);
            }}
          >
            <Sparkles size={18} />
            Create music<span className="nav-plus">+</span>
          </button>
          <button
            className={page === "library" ? "selected" : ""}
            onClick={() => {
              setPage("library");
              setMobile(false);
            }}
          >
            <Library size={18} />
            My library
            {history.length > 0 && (
              <span className="count">{history.length}</span>
            )}
          </button>
          <button
            className={page === "presets" ? "selected" : ""}
            onClick={() => {
              setPage("presets");
              setMobile(false);
            }}
          >
            <SlidersHorizontal size={18} />
            Saved presets
          </button>
        </nav>
        <div className="nav-label projects-label">
          WORKSPACE
          <button aria-label="New session" onClick={newSession}>
            <Plus size={15} />
          </button>
        </div>
        <button className="session" onClick={() => setPage("create")}>
          <Folder size={16} />
          <span>Untitled session</span>
          <span className="session-dot" />
        </button>
        <div className="sidebar-bottom">
          <div className="engine-mini">
            <span
              className={`status-dot ${status.available ? "online" : ""}`}
            />
            <span>
              {status.available
                ? "Engine connected"
                : "Your studio. Your engine."}
            </span>
            <div>
              Create with open-source AI.
              <br />
              Keep your creative freedom.
            </div>
            <button
              onClick={() => {
                setApiDraft(api);
                setModal("connection");
              }}
            >
              {status.available ? "Manage connection" : "Connect engine"}
              <ArrowUpRight size={14} />
            </button>
          </div>
          <button className="help-link" onClick={() => setModal("help")}>
            <CircleHelp size={17} />
            Help & getting started
            <ArrowUpRight size={14} />
          </button>
          <div className="profile">
            <span className="avatar">YO</span>
            <div>
              Your personal studio<small>Made for making music</small>
            </div>
            <button
              className="icon-button"
              aria-label="Studio settings"
              onClick={() => {
                setApiDraft(api);
                setModal("connection");
              }}
            >
              <Settings2 size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setMobile(!mobile)}
            aria-label="Toggle navigation"
          >
            <Menu />
          </button>
          <span>Workspace</span>
          <ChevronRight size={13} />
          <strong>
            {page === "create"
              ? "Create music"
              : page === "library"
                ? "My library"
                : "Saved presets"}
          </strong>
          <div className="topbar-right">
            <button
              className={`connection-badge ${status.available ? "connected" : ""}`}
              onClick={() => {
                setApiDraft(api);
                setModal("connection");
              }}
            >
              <span
                className={`status-dot ${status.available ? "online" : ""}`}
              />
              {status.available ? "Engine connected" : "Inference offline"}
            </button>
            <span className="topbar-divider" />
            <button
              className="icon-button"
              aria-label="Help"
              onClick={() => setModal("help")}
            >
              <CircleHelp size={18} />
            </button>
            <span className="avatar small">YO</span>
          </div>
        </header>
        <main>
          {page === "create" ? (
            <>
              <section className="page-intro">
                <div>
                  <div className="eyebrow">
                    <span /> A NEW WAY TO FIND YOUR SOUND
                  </div>
                  <h1>
                    A familiar feeling.
                    <br />
                    An entirely <em>new sound.</em>
                  </h1>
                  <p>
                    Start with a track you love. Take it somewhere only you can.
                  </p>
                </div>
                <div className="intro-art" aria-hidden="true">
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />
                  <div className="art-wave">
                    {Array.from({ length: 35 }, (_, i) => (
                      <i
                        key={i}
                        style={{
                          height: `${12 + Math.pow(Math.sin(i * 0.31), 2) * 55 + Math.sin(i * 1.7) * 13}px`,
                          opacity: 0.3 + Math.sin(i * 0.13) * 0.6,
                        }}
                      />
                    ))}
                  </div>
                  <span className="art-plus">✦</span>
                  <div className="art-caption">
                    INSPIRED BY YOU. CREATED ANEW.
                  </div>
                </div>
              </section>
              <div className="studio-grid">
                <div className="creative-column">
                  <section className="panel reference-panel">
                    <div className="section-heading">
                      <span className="step">01</span>
                      <h2>Start with a reference</h2>
                      <span className="tiny-label">THE INSPIRATION</span>
                    </div>
                    <p className="section-description">
                      Give your next idea a starting point.
                    </p>
                    <div
                      className={`dropzone ${drag ? "dragging" : ""} ${file ? "has-file" : ""}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDrag(true);
                      }}
                      onDragLeave={() => setDrag(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDrag(false);
                        loadFile(e.dataTransfer.files[0]);
                      }}
                    >
                      {!file ? (
                        <>
                          <div className="upload-icon">
                            <Upload size={24} />
                            <span className="upload-spark">✦</span>
                          </div>
                          <h3>Drop a little inspiration here</h3>
                          <p>
                            Drag & drop your audio, or{" "}
                            <button
                              className="inline-link"
                              onClick={() => input.current.click()}
                            >
                              browse files
                            </button>
                          </p>
                          <div className="file-formats">
                            <span>MP3</span>
                            <span>WAV</span>
                            <span>FLAC</span>
                            <i />
                            Up to 100 MB
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="file-topline">
                            <span className="file-icon">
                              <Music2 size={20} />
                            </span>
                            <div>
                              <strong>{file.name}</strong>
                              <small>
                                {(file.size / 1024 / 1024).toFixed(1)} MB{" "}
                                <span>•</span> {fmt(length)} <span>•</span>{" "}
                                Original reference
                              </small>
                            </div>
                            <button
                              className="icon-button"
                              title="Replace audio"
                              onClick={() => input.current.click()}
                            >
                              <Upload size={16} />
                            </button>
                            <button
                              className="icon-button"
                              title="Remove audio"
                              onClick={clearReference}
                            >
                              <X size={16} />
                            </button>
                          </div>
                          <div className="waveform-row">
                            <button
                              className="play-circle"
                              onClick={togglePlay}
                              aria-label={
                                playing ? "Pause reference" : "Play reference"
                              }
                            >
                              {playing ? (
                                <Pause size={16} fill="currentColor" />
                              ) : (
                                <Play size={16} fill="currentColor" />
                              )}
                            </button>
                            <div
                              className="waveform"
                              role="slider"
                              tabIndex={0}
                              aria-label="Seek reference audio"
                              aria-valuemin={0}
                              aria-valuemax={Math.round(length)}
                              aria-valuenow={Math.round(time)}
                              onClick={(e) => {
                                if (audio.current)
                                  audio.current.currentTime = Math.max(
                                    trimStart,
                                    Math.min(
                                      trimEnd,
                                      ((e.clientX -
                                        e.currentTarget.getBoundingClientRect()
                                          .left) /
                                        e.currentTarget.clientWidth) *
                                        length,
                                    ),
                                  );
                              }}
                              onKeyDown={(e) => {
                                if (
                                  audio.current &&
                                  ["ArrowRight", "ArrowLeft"].includes(e.key)
                                ) {
                                  e.preventDefault();
                                  audio.current.currentTime = Math.min(
                                    trimEnd,
                                    Math.max(
                                      trimStart,
                                      time + (e.key === "ArrowRight" ? 5 : -5),
                                    ),
                                  );
                                }
                              }}
                            >
                              {peaks.length ? (
                                peaks.map((p, i) => (
                                  <i
                                    key={i}
                                    style={{
                                      height: `${Math.max(4, p * 52)}px`,
                                    }}
                                    className={
                                      i / peaks.length < time / length
                                        ? "played"
                                        : ""
                                    }
                                  />
                                ))
                              ) : (
                                <span className="muted">
                                  Preparing audio preview…
                                </span>
                              )}
                            </div>
                            <span className="audio-time">
                              {fmt(time)}
                              <small>{fmt(length)}</small>
                            </span>
                          </div>
                          <div className="preview-bottom">
                            <button
                              className={
                                trim ? "inline-link active" : "subtle-button"
                              }
                              onClick={() => setTrim(!trim)}
                            >
                              <Scissors size={13} />
                              Trim reference
                            </button>
                            <div className="volume-control">
                              <Volume2 size={14} />
                              <input
                                aria-label="Preview volume"
                                type="range"
                                min="0"
                                max="1"
                                step=".01"
                                value={volume}
                                onChange={(e) => setVolume(+e.target.value)}
                              />
                            </div>
                          </div>
                          {trim && (
                            <div className="trim-controls">
                              <label>
                                Start{" "}
                                <input
                                  aria-label="Trim start seconds"
                                  type="number"
                                  min="0"
                                  max={trimEnd - 0.1}
                                  step=".1"
                                  value={trimStart}
                                  onChange={(e) =>
                                    setTrimStart(
                                      Math.max(
                                        0,
                                        Math.min(
                                          trimEnd - 0.1,
                                          +e.target.value,
                                        ),
                                      ),
                                    )
                                  }
                                />
                                <span>sec</span>
                              </label>
                              <label>
                                End{" "}
                                <input
                                  aria-label="Trim end seconds"
                                  type="number"
                                  min={trimStart + 0.1}
                                  max={length}
                                  step=".1"
                                  value={+trimEnd.toFixed(1)}
                                  onChange={(e) =>
                                    setTrimEnd(
                                      Math.min(
                                        length,
                                        Math.max(
                                          trimStart + 0.1,
                                          +e.target.value,
                                        ),
                                      ),
                                    )
                                  }
                                />
                                <span>sec</span>
                              </label>
                              <button
                                disabled={!status.backend || analyzing}
                                onClick={() =>
                                  analyze(file, trimStart, trimEnd)
                                }
                              >
                                Apply & analyze
                              </button>
                            </div>
                          )}
                        </>
                      )}
                      <input
                        ref={input}
                        type="file"
                        accept=".mp3,.wav,.flac"
                        hidden
                        onChange={(e) => {
                          loadFile(e.target.files[0]);
                          e.target.value = "";
                        }}
                      />
                    </div>
                    <audio
                      ref={audio}
                      src={source || undefined}
                      onPlay={() => setPlaying(true)}
                      onPause={() => setPlaying(false)}
                      onEnded={() => setPlaying(false)}
                      onLoadedMetadata={(e) => {
                        if (!length) {
                          setLength(e.currentTarget.duration);
                          setTrimEnd(e.currentTarget.duration);
                        }
                      }}
                      onTimeUpdate={(e) => {
                        setTime(e.currentTarget.currentTime);
                        if (trimEnd && e.currentTarget.currentTime >= trimEnd) {
                          e.currentTarget.pause();
                          e.currentTarget.currentTime = trimStart;
                        }
                      }}
                    />
                    {!file && (
                      <div className="sample-line">
                        <Headphones size={14} />
                        <span>Just exploring?</span>
                        <button onClick={sample}>
                          Try a studio sample
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    )}
                    {file && !analyzing && (!analysis || trimDirty) && (
                      <div className="analysis-action">
                        <span>
                          {trimDirty
                            ? "Trim changed. Re-analyze to use this selection."
                            : "Ready for a closer listen."}
                        </span>
                        <button
                          className="button secondary"
                          disabled={
                            !status.backend ||
                            status.analysis_available === false
                          }
                          onClick={() => analyze(file, trimStart, trimEnd)}
                        >
                          Analyze reference
                        </button>
                      </div>
                    )}
                    <div className="analysis-header">
                      <span>
                        <AudioLines size={14} />
                        Reference insights
                      </span>
                      {analyzing ? (
                        <span>
                          <LoaderCircle size={12} className="spin" />
                          Analyzing audio
                        </span>
                      ) : analysis && !trimDirty ? (
                        <span className="analysis-ready">
                          <Check size={12} />
                          Analysis complete
                        </span>
                      ) : (
                        <span>
                          {file
                            ? "Analyze your reference to continue"
                            : "A closer listen, once you upload"}
                        </span>
                      )}
                    </div>
                    <div className="analysis-grid">
                      {[
                        [
                          "Tempo",
                          analysis?.bpm ? `${Math.round(analysis.bpm)}` : "—",
                          analysis?.bpm ? "BPM" : "BPM",
                        ],
                        ["Genre", analysis?.genre || "—", "Estimated"],
                        ["Mood", analysis?.mood || "—", "Estimated"],
                        [
                          "Energy",
                          analysis ? `${analysis.energy}%` : "—",
                          "Intensity",
                        ],
                      ].map(([a, b, c]) => (
                        <div key={a}>
                          <span>{a}</span>
                          <strong>
                            {b}
                            <small>{a === "Tempo" ? c : ""}</small>
                          </strong>
                          {a !== "Tempo" && <small>{c}</small>}
                        </div>
                      ))}
                    </div>
                    {analysis && (
                      <details className="analysis-details">
                        <summary>
                          Explore rhythm, instruments & structure
                          <ChevronDown size={13} />
                        </summary>
                        <p>
                          {analysis.groove} · {analysis.textures} · Beat
                          intensity: {analysis.beat_intensity}%
                        </p>
                        <p>
                          Instrument cues: {analysis.instrumentation.join(", ")}
                          . These are signal-based estimates.
                        </p>
                        <div className="signal-metrics">
                          <span>
                            Dominant pitch<b>{analysis.key_hint}</b>
                          </span>
                          <span>
                            Average level<b>{analysis.rms_db} dBFS</b>
                          </span>
                          <span>
                            Analyzed<b>{fmt(analysis.duration)}</b>
                          </span>
                        </div>
                        <p className="control-note">
                          Dominant pitch is a signal cue, not a detected musical
                          key.
                        </p>
                        <div className="structure">
                          {analysis.structure.map((a, i) => (
                            <span
                              key={i}
                              style={{ flex: Math.max(1, a.end - a.start) }}
                              title={`${fmt(a.start)}–${fmt(a.end)}`}
                            >
                              {a.label}
                            </span>
                          ))}
                        </div>
                      </details>
                    )}
                  </section>
                  <section className="panel mode-panel">
                    <div className="section-heading">
                      <span className="step">02</span>
                      <h2>Choose your direction</h2>
                    </div>
                    <p className="section-description">
                      What do you want to carry into your next creation?
                    </p>
                    <div className="mode-options">
                      <button
                        aria-pressed={s.mode === "beat"}
                        className={`mode-card ${s.mode === "beat" ? "chosen" : ""}`}
                        onClick={() => update("mode", "beat")}
                      >
                        <div className="mode-card-top">
                          <span className="mode-icon">
                            <AudioLines size={23} />
                          </span>
                          <span className="radio-dot" />
                        </div>
                        <h3>Same beat & energy</h3>
                        <p>
                          Keep the pulse. Reimagine
                          <br className="desktop-break" /> everything around it.
                        </p>
                        <span className="mode-tag">RHYTHM-INSPIRED</span>
                      </button>
                      <button
                        aria-pressed={s.mode === "vibe"}
                        className={`mode-card vibe ${s.mode === "vibe" ? "chosen" : ""}`}
                        onClick={() => update("mode", "vibe")}
                      >
                        <div className="mode-card-top">
                          <span className="mode-icon">
                            <Waves size={23} />
                          </span>
                          <span className="radio-dot" />
                        </div>
                        <h3>Same vibe & feel</h3>
                        <p>
                          Capture the atmosphere.
                          <br className="desktop-break" /> Find a new way to
                          feel it.
                        </p>
                        <span className="mode-tag">MOOD-INSPIRED</span>
                      </button>
                    </div>
                    <div className="original-note">
                      <ShieldCheck size={14} />
                      <span>
                        New melodies. New arrangements. Your own direction.
                      </span>
                    </div>
                  </section>
                  <section className="panel instructions-panel">
                    <div className="section-heading">
                      <span className="step">03</span>
                      <h2>Make it yours</h2>
                      <span className="tiny-label">OPTIONAL</span>
                    </div>
                    <p className="section-description">
                      A little creative direction goes a long way.
                    </p>
                    <div className="textarea-wrap">
                      <textarea
                        aria-label="Custom music instructions"
                        maxLength={2000}
                        placeholder="Warm analog synths, a driving bassline, a little late-night nostalgia…"
                        value={s.instructions}
                        onChange={(e) => update("instructions", e.target.value)}
                      />
                      <span>{s.instructions.length} / 2000</span>
                    </div>
                    <div className="prompt-chips">
                      <span>Try a touch of</span>
                      {[
                        "Analog warmth",
                        "Dreamy textures",
                        "Acoustic soul",
                      ].map((t) => (
                        <button
                          key={t}
                          onClick={() =>
                            update(
                              "instructions",
                              s.instructions
                                ? `${s.instructions}, ${t.toLowerCase()}`
                                : t,
                            )
                          }
                        >
                          <Plus size={11} />
                          {t}
                        </button>
                      ))}
                    </div>
                  </section>
                </div>
                <aside className="generation-column">
                  <section className="panel settings-panel">
                    <div className="settings-heading">
                      <h2>
                        <SlidersHorizontal size={17} />
                        Shape your sound
                      </h2>
                      <button
                        className="icon-button"
                        aria-label="Save current settings as preset"
                        title="Save preset"
                        onClick={() => setModal("save")}
                      >
                        <Save size={16} />
                      </button>
                    </div>
                    <div className="recipe-tools">
                      <button onClick={() => downloadRecipe(s)}>
                        <Download size={13} />
                        Export recipe
                      </button>
                      <button onClick={() => recipeInput.current.click()}>
                        <Upload size={13} />
                        Import recipe
                      </button>
                      <input
                        type="file"
                        accept=".json,application/json"
                        ref={recipeInput}
                        hidden
                        onChange={(e) => {
                          importRecipe(e.target.files[0]);
                          e.target.value = "";
                        }}
                      />
                    </div>
                    <div className="setting-block">
                      <label>
                        <Clock3 size={14} />
                        Track duration
                      </label>
                      <div className="segmented">
                        {[30, 60, 120].map((v) => (
                          <button
                            key={v}
                            className={s.duration === v ? "active" : ""}
                            onClick={() => update("duration", v)}
                          >
                            {v < 60 ? `${v} sec` : `${v / 60} min`}
                          </button>
                        ))}
                        <button
                          className={
                            ![30, 60, 120].includes(s.duration) ? "active" : ""
                          }
                          onClick={() => update("duration", 90)}
                        >
                          Custom
                        </button>
                      </div>
                      {![30, 60, 120].includes(s.duration) && (
                        <label className="custom-duration">
                          <input
                            aria-label="Custom duration seconds"
                            type="number"
                            min="10"
                            max="600"
                            value={s.duration}
                            onChange={(e) =>
                              update(
                                "duration",
                                Math.min(600, Math.max(10, +e.target.value)),
                              )
                            }
                          />{" "}
                          seconds
                        </label>
                      )}
                    </div>
                    <div className="setting-block">
                      <label>
                        <Disc3 size={14} />
                        Variations
                        <span className="field-hint">
                          Explore more possibilities
                        </span>
                      </label>
                      <div className="variation-options">
                        {[1, 2, 3, 4].map((v) => (
                          <button
                            className={s.variations === v ? "active" : ""}
                            key={v}
                            onClick={() => update("variations", v)}
                          >
                            {v}
                            <AudioLines size={13} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="toggle-row">
                      <span>
                        <Music2 size={15} />
                        Instrumental only
                        <small>Let the music do the talking</small>
                      </span>
                      <button
                        className={`toggle ${s.instrumental ? "on" : ""}`}
                        role="switch"
                        aria-checked={s.instrumental}
                        aria-label="Instrumental only"
                        onClick={() => update("instrumental", !s.instrumental)}
                      >
                        <i />
                      </button>
                    </div>
                    <div className="settings-divider" />
                    <Range
                      label="Creativity"
                      value={s.creativity}
                      set={(v) => update("creativity", v)}
                      left="Familiar"
                      right="Unexpected"
                    />
                    <Range
                      label={
                        s.mode === "beat"
                          ? "Rhythm similarity"
                          : "Mood similarity"
                      }
                      value={s.mode === "beat" ? s.rhythm : s.mood_similarity}
                      set={(v) =>
                        update(
                          s.mode === "beat" ? "rhythm" : "mood_similarity",
                          v,
                        )
                      }
                      left={s.mode === "beat" ? "New groove" : "Explore"}
                      right={s.mode === "beat" ? "Stay close" : "Stay close"}
                    />
                    <Range
                      label={
                        s.mode === "beat" ? "Energy" : "Emotional intensity"
                      }
                      value={
                        s.mode === "beat" ? s.energy : s.emotional_intensity
                      }
                      set={(v) =>
                        update(
                          s.mode === "beat" ? "energy" : "emotional_intensity",
                          v,
                        )
                      }
                      left={s.mode === "beat" ? "Laid-back" : "Subtle"}
                      right={s.mode === "beat" ? "All-out" : "Expressive"}
                    />
                    <button
                      className="advanced-button"
                      onClick={() => setAdvanced(!advanced)}
                    >
                      <Settings2 size={14} />
                      Advanced controls
                      <ChevronDown
                        size={14}
                        className={advanced ? "rotated" : ""}
                      />
                    </button>
                    {advanced && (
                      <div className="advanced-fields">
                        <div className="advanced-caption">
                          MUSICAL DIRECTION
                        </div>
                        <label>
                          Musical key
                          <select
                            aria-label="Musical key"
                            value={s.key_scale}
                            onChange={(e) =>
                              update("key_scale", e.target.value)
                            }
                          >
                            <option value="">Let the model choose</option>
                            {[
                              "C",
                              "C#",
                              "D",
                              "Eb",
                              "E",
                              "F",
                              "F#",
                              "G",
                              "Ab",
                              "A",
                              "Bb",
                              "B",
                            ].flatMap((k) =>
                              ["major", "minor"].map((scale) => (
                                <option
                                  key={`${k} ${scale}`}
                                  value={`${k} ${scale}`}
                                >
                                  {k} {scale}
                                </option>
                              )),
                            )}
                          </select>
                        </label>
                        <label>
                          Time signature
                          <select
                            aria-label="Time signature"
                            value={s.time_signature}
                            onChange={(e) =>
                              update("time_signature", e.target.value)
                            }
                          >
                            <option value="">Let the model choose</option>
                            <option value="2">2/4</option>
                            <option value="3">3/4</option>
                            <option value="4">4/4</option>
                            <option value="6">6/8</option>
                          </select>
                        </label>
                        <label>
                          Generation seed
                          <input
                            aria-label="Generation seed"
                            type="number"
                            min="0"
                            max="2147483647"
                            placeholder="Random for every variation"
                            value={s.seed ?? ""}
                            onChange={(e) =>
                              update(
                                "seed",
                                e.target.value === ""
                                  ? null
                                  : Math.min(
                                      2147483647,
                                      Math.max(0, Math.floor(+e.target.value)),
                                    ),
                              )
                            }
                          />
                        </label>
                        <p className="control-note">
                          A fixed seed helps repeat an experiment. Each
                          variation adds 1. Exact results also depend on model
                          version and hardware.
                        </p>
                        <label>
                          Tempo <span>BPM</span>
                          <input
                            type="number"
                            min="30"
                            max="300"
                            value={s.tempo}
                            onChange={(e) =>
                              update(
                                "tempo",
                                Math.max(30, Math.min(300, +e.target.value)),
                              )
                            }
                          />
                        </label>
                        <label>
                          Genre
                          <select
                            value={s.genre}
                            onChange={(e) => update("genre", e.target.value)}
                          >
                            {[
                              "Auto-detect",
                              "Electronic",
                              "Lo-fi",
                              "Jazz",
                              "Ambient",
                              "Rock",
                              "Pop",
                              "Hip-hop",
                              "Classical",
                              "Cinematic",
                            ].map((g) => (
                              <option key={g}>{g}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Instruments
                          <input
                            value={s.instruments}
                            onChange={(e) =>
                              update("instruments", e.target.value)
                            }
                            maxLength={300}
                          />
                        </label>
                        {s.mode === "beat" && (
                          <>
                            <Range
                              label="Beat intensity"
                              value={s.intensity}
                              set={(v) => update("intensity", v)}
                              left="Soft"
                              right="Punchy"
                            />
                            <Range
                              label="Melody originality"
                              value={s.originality}
                              set={(v) => update("originality", v)}
                              left="Subtle variation"
                              right="New direction"
                            />
                            <Range
                              label="Instrument changes"
                              value={s.instrument_changes}
                              set={(v) => update("instrument_changes", v)}
                              left="Similar palette"
                              right="Reinvent"
                            />
                          </>
                        )}
                        <div className="toggle-row compact">
                          <span>Basic mastering</span>
                          <button
                            className={`toggle ${s.mastering ? "on" : ""}`}
                            role="switch"
                            aria-checked={s.mastering}
                            aria-label="Basic mastering"
                            onClick={() => update("mastering", !s.mastering)}
                          >
                            <i />
                          </button>
                        </div>
                        <label>
                          Output gain <span>{s.gain_db} dB</span>
                          <input
                            aria-label="Output gain"
                            type="range"
                            min="-12"
                            max="6"
                            value={s.gain_db}
                            onChange={(e) => update("gain_db", +e.target.value)}
                          />
                        </label>
                        <label className="check-label">
                          <input
                            type="checkbox"
                            checked={s.preserve_source}
                            onChange={(e) =>
                              update("preserve_source", e.target.checked)
                            }
                          />
                          Use source audio for a closer transformation
                        </label>
                        {s.preserve_source && (
                          <label className="check-label rights">
                            <input
                              type="checkbox"
                              checked={s.rights_confirmed}
                              onChange={(e) =>
                                update("rights_confirmed", e.target.checked)
                              }
                            />
                            I own this recording or have permission to transform
                            it.
                          </label>
                        )}
                        <p className="control-note">
                          Similarity and emotion controls guide the model
                          through descriptive instructions; they are not exact
                          matching guarantees.
                        </p>
                      </div>
                    )}
                    <div className="generate-area">
                      <div className="generation-summary">
                        <span>{fmt(s.duration)} duration</span>
                        <i />
                        <span>
                          {s.variations} variation{s.variations > 1 ? "s" : ""}
                        </span>
                        <span className="model-label">ACE-Step 1.5</span>
                      </div>
                      <button
                        className="generate-button"
                        disabled={!canGenerate}
                        onClick={() => generate()}
                      >
                        {active ? (
                          <LoaderCircle size={17} className="spin" />
                        ) : (
                          <Sparkles size={17} />
                        )}{" "}
                        {submitting
                          ? "Adding to queue…"
                          : active
                            ? "Creating your sound…"
                            : "Generate music"}
                        <ArrowRight size={17} />
                      </button>
                      {!status.available ? (
                        <button
                          className="connect-prompt"
                          onClick={() => {
                            setApiDraft(api);
                            setModal("connection");
                          }}
                        >
                          <span className="status-dot" />
                          {status.backend
                            ? "Generation unavailable"
                            : "Connect your engine to start"}
                          <ArrowUpRight size={12} />
                        </button>
                      ) : (
                        <p className="ready-note">
                          {!uploadId
                            ? "Add a reference to start creating."
                            : "Your engine is ready to create."}
                        </p>
                      )}
                      {active && (
                        <div className="job-progress">
                          <div>
                            <span>{job.stage || job.status}</span>
                            <span>
                              {job.completed_variations || 0} /{" "}
                              {job.settings.variations}
                            </span>
                          </div>
                          <div className="progress-track">
                            <i
                              style={{
                                width: `${Math.max(0, ((job.completed_variations || 0) / job.settings.variations) * 100)}%`,
                              }}
                            />
                          </div>
                          <small>
                            Progress reflects completed variations. Inference
                            time depends on your inference service.
                          </small>
                          <div className="queue-actions">
                            <Elapsed since={job.created_at} />
                            <button
                              disabled={!!job.cancel_requested}
                              onClick={() => cancelJob(job.id)}
                            >
                              {job.cancel_requested
                                ? "Stopping after this variation…"
                                : job.status === "queued"
                                  ? "Cancel queued job"
                                  : "Stop after this variation"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                  <div className="creativity-note">
                    <span className="note-icon">
                      <Sparkles size={16} />
                    </span>
                    <div>
                      Inspiration is a starting point.
                      <p>
                        Every generation explores original melodies and
                        arrangements. Make something that feels like you.
                      </p>
                    </div>
                  </div>
                </aside>
              </div>
              {job && ["failed", "cancelled"].includes(job.status) && (
                <JobNotice
                  job={job}
                  onRetry={() =>
                    generate(
                      {
                        ...job.settings,
                        variations: Math.max(
                          1,
                          job.settings.variations -
                            (job.completed_variations || 0),
                        ),
                        seed: null,
                      },
                      job.upload_id,
                    )
                  }
                  canRetry={status.available && !active && !submitting}
                />
              )}
              <section className="recent-section">
                <div className="recent-heading">
                  <h2>
                    Your creations
                    <span>
                      {history.filter((x) => x.status === "completed").length}
                    </span>
                  </h2>
                  <button onClick={() => setPage("library")}>
                    View library
                    <ArrowRight size={14} />
                  </button>
                </div>
                {job?.outputs?.length > 0 ? (
                  <Results
                    job={job}
                    api={api}
                    onRegenerate={() =>
                      generate(
                        { ...job.settings, variations: 1, seed: null },
                        job.upload_id,
                      )
                    }
                    canRegenerate={status.available && !active && !submitting}
                  />
                ) : history.some(
                    (x) => x.outputs?.length > 0 && !hiddenJobs.includes(x.id),
                  ) ? (
                  <Results
                    job={history.find(
                      (x) =>
                        x.outputs?.length > 0 && !hiddenJobs.includes(x.id),
                    )}
                    api={api}
                    onRegenerate={() => {
                      const h = history.find(
                        (x) =>
                          x.outputs?.length > 0 && !hiddenJobs.includes(x.id),
                      );
                      generate(
                        { ...h.settings, variations: 1, seed: null },
                        h.upload_id,
                      );
                    }}
                    canRegenerate={status.available && !active && !submitting}
                  />
                ) : (
                  <div className="empty-creations">
                    <div className="empty-disc">
                      <AudioLines size={23} />
                    </div>
                    <div>
                      <h3>A space for your next great idea</h3>
                      <p>
                        Your generated tracks will find a home here. Let’s make
                        the first one.
                      </p>
                    </div>
                    <div className="empty-mini-wave" aria-hidden="true">
                      {Array.from({ length: 19 }, (_, i) => (
                        <i
                          key={i}
                          style={{
                            height: `${8 + Math.sin(i * 0.7) ** 2 * 24}px`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </section>
              <footer>
                <span>
                  <AudioLines size={13} />A little inspiration. Endless
                  possibilities.
                </span>
                <button onClick={() => setModal("originality")}>
                  Create responsibly
                  <ArrowUpRight size={12} />
                </button>
              </footer>
            </>
          ) : (
            <>
              <div className="collection-intro">
                <div className="eyebrow">YOUR PERSONAL STUDIO</div>
                <h1>
                  {page === "library"
                    ? "A home for your sound."
                    : "Your signature settings."}
                </h1>
                <p>
                  {page === "library"
                    ? "Every experiment, every new direction. All in one place."
                    : "Keep a creative starting point close. Make it yours again."}
                </p>
              </div>
              {page === "library" ? (
                <>
                  <div className="library-tools">
                    <div className="library-tabs">
                      <button
                        className={filter === "all" ? "active" : ""}
                        onClick={() => setFilter("all")}
                      >
                        All creations <span>{history.length}</span>
                      </button>
                      <button
                        className={filter === "favorites" ? "active" : ""}
                        onClick={() => setFilter("favorites")}
                      >
                        <Heart size={14} />
                        Favorites
                      </button>
                    </div>
                    <div className="search-input">
                      <Search size={16} />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Find a creation…"
                        aria-label="Search creations"
                      />
                    </div>
                  </div>
                  {!!hiddenJobs.length && (
                    <button
                      className="restore-history"
                      onClick={() => setHiddenJobs([])}
                    >
                      Restore hidden creations
                    </button>
                  )}
                  {visibleHistory.length ? (
                    visibleHistory.map((h) => (
                      <section className="panel library-item" key={h.id}>
                        <div className="library-item-heading">
                          <h3>{h.name || "Untitled creation"}</h3>
                          <span>
                            {new Date(h.created_at * 1000).toLocaleDateString()}
                          </span>
                          <button
                            className="icon-button"
                            onClick={() => favorite(h.id)}
                            aria-label="Favorite creation"
                          >
                            <Heart
                              size={16}
                              fill={h.favorite ? "currentColor" : "none"}
                            />
                          </button>
                          <button
                            className="icon-button"
                            aria-label="Hide creation"
                            disabled={activeStatuses.includes(h.status)}
                            onClick={() => setHiddenJobs((p) => [...p, h.id])}
                          >
                            <X size={16} />
                          </button>
                        </div>
                        {["failed", "cancelled"].includes(h.status) && (
                          <JobNotice
                            job={h}
                            onRetry={() =>
                              generate(
                                {
                                  ...h.settings,
                                  variations: Math.max(
                                    1,
                                    h.settings.variations -
                                      (h.completed_variations || 0),
                                  ),
                                  seed: null,
                                },
                                h.upload_id,
                              )
                            }
                            canRetry={
                              status.available && !active && !submitting
                            }
                          />
                        )}
                        {activeStatuses.includes(h.status) && (
                          <div className="library-queue">
                            <span>
                              {h.stage} · {h.completed_variations}/
                              {h.settings.variations}
                            </span>
                            <button
                              disabled={!!h.cancel_requested}
                              onClick={() => cancelJob(h.id)}
                            >
                              {h.cancel_requested
                                ? "Stop requested"
                                : "Cancel remaining"}
                            </button>
                          </div>
                        )}
                        {h.outputs?.length > 0 ? (
                          <Results
                            job={h}
                            api={api}
                            onRegenerate={() =>
                              generate(
                                { ...h.settings, variations: 1, seed: null },
                                h.upload_id,
                              )
                            }
                            canRegenerate={
                              status.available && !active && !submitting
                            }
                          />
                        ) : (
                          <p className="control-note">
                            No completed audio yet.
                          </p>
                        )}
                      </section>
                    ))
                  ) : (
                    <Empty
                      icon={<Library size={30} />}
                      title={
                        filter === "favorites"
                          ? "Your favorites will be here"
                          : "Your sound collection starts here"
                      }
                      text="Create a track in the studio, then come back to listen, compare, and download."
                      action="Go to the studio"
                      onClick={() => setPage("create")}
                    />
                  )}
                </>
              ) : (
                <>
                  <button
                    className="button primary"
                    onClick={() => setModal("save")}
                  >
                    <Plus size={16} />
                    Save current settings
                  </button>
                  <div className="preset-grid">
                    {presets.map((p) => (
                      <section className="panel preset" key={p.id}>
                        <div className="preset-icon">
                          <SlidersHorizontal size={23} />
                        </div>
                        <h3>{p.name}</h3>
                        <p>
                          {p.settings.mode === "beat"
                            ? "Same beat & energy"
                            : "Same vibe & feel"}{" "}
                          · {fmt(p.settings.duration)}
                        </p>
                        <div>
                          <button
                            onClick={() => {
                              setS({
                                ...defaults,
                                ...p.settings,
                                rights_confirmed: false,
                              });
                              setPage("create");
                              notify(`Loaded “${p.name}”`);
                            }}
                          >
                            Use preset
                            <ArrowRight size={14} />
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Delete ${p.name}`}
                            onClick={() => {
                              const next = presets.filter((x) => x.id !== p.id);
                              setPresets(next);
                              write("resona.presets", next);
                            }}
                          >
                            <X size={15} />
                          </button>
                        </div>
                      </section>
                    ))}
                  </div>
                  {!presets.length && (
                    <Empty
                      icon={<SlidersHorizontal size={30} />}
                      title="Find your flow. Save it for later."
                      text="Tune your settings in the studio, then save them as a preset for your next session."
                      action="Shape your sound"
                      onClick={() => setPage("create")}
                    />
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>
      {modal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <button
              className="modal-close icon-button"
              aria-label="Close dialog"
              onClick={() => setModal(null)}
            >
              <X size={20} />
            </button>
            {modal === "connection" ? (
              <>
                <div className="modal-symbol">
                  <Cable size={25} />
                </div>
                <h2 id="modal-title">Connect your studio engine</h2>
                <p>
                  Connect Resona to your FastAPI backend for audio analysis and
                  real ACE-Step generation.
                </p>
                <label className="modal-label">
                  Backend URL
                  <input
                    autoFocus
                    type="url"
                    placeholder="http://localhost:8000"
                    value={apiDraft}
                    onChange={(e) => setApiDraft(e.target.value)}
                  />
                </label>
                <small className="modal-hint">
                  Local setup: leave this blank to use the development proxy. On
                  this hosted website, enter your backend’s HTTPS URL. API keys
                  stay on your backend.
                </small>
                <div className="connection-state">
                  <span
                    className={`status-dot ${status.available ? "online" : ""}`}
                  />
                  {connecting
                    ? "Checking connection…"
                    : status.available
                      ? "Connected · generation available"
                      : status.backend
                        ? "Backend connected · generation unavailable"
                        : "No backend connected"}
                </div>
                <div className="engine-checks">
                  {[
                    ["Backend API", status.backend],
                    ["Audio tools", status.analysis_available],
                    ["Queue worker", status.worker_ready],
                    ["ACE-Step model", status.model_available],
                  ].map(([label, ready]) => (
                    <div key={label}>
                      <span className={`status-dot ${ready ? "online" : ""}`} />
                      <span>{label}</span>
                      <b>
                        {ready
                          ? "Ready"
                          : status.backend
                            ? "Not ready"
                            : "Not connected"}
                      </b>
                    </div>
                  ))}
                </div>
                <p className="diagnostic-message" role="status">
                  {status.message}
                </p>
                {status.backend && (
                  <small className="modal-hint">
                    Model: {status.model} · API {status.version || "1.0"}
                    {status.version !== "1.1.0" &&
                      " · Update the backend for all studio controls."}
                  </small>
                )}
                <button
                  className="button primary full"
                  disabled={connecting}
                  onClick={async () => {
                    const base = apiDraft.trim().replace(/\/$/, "");
                    if (base && !/^https?:\/\//i.test(base)) {
                      notify("Enter a URL starting with http:// or https://.");
                      return;
                    }
                    setApi(base);
                    saveApi(base);
                    const d = await probe(base);
                    if (d) {
                      notify(
                        d.available
                          ? "Engine connected. Ready to create."
                          : d.message,
                      );
                    }
                  }}
                >
                  {connecting ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <Cable size={16} />
                  )}
                  Save & test connection
                </button>
                {status.backend &&
                  status.analysis_available !== false &&
                  file && (
                    <button
                      className="button secondary full"
                      onClick={() => {
                        analyze(file, trimStart, trimEnd);
                        setModal(null);
                      }}
                    >
                      Analyze current reference
                    </button>
                  )}
                <a
                  className="docs-link"
                  href="/downloads/resona-source-1.1.0.zip"
                  download
                >
                  Download app & setup guide
                  <Download size={14} />
                </a>
              </>
            ) : modal === "save" ? (
              <>
                <div className="modal-symbol">
                  <Save size={24} />
                </div>
                <h2 id="modal-title">Save your creative starting point</h2>
                <p>
                  Your mode, sliders, duration, and creative direction will be
                  saved in this browser.
                </p>
                <label className="modal-label">
                  Preset name
                  <input
                    autoFocus
                    placeholder="e.g. Late-night electronic"
                    value={presetName}
                    maxLength={80}
                    onChange={(e) => setPresetName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && savePreset()}
                  />
                </label>
                <button
                  className="button primary full"
                  disabled={!presetName.trim()}
                  onClick={savePreset}
                >
                  <Save size={16} />
                  Save preset
                </button>
              </>
            ) : modal === "originality" ? (
              <>
                <div className="modal-symbol">
                  <ShieldCheck size={25} />
                </div>
                <h2 id="modal-title">Inspired. Always original.</h2>
                <p>
                  Resona uses high-level characteristics such as tempo, energy,
                  and atmosphere to guide new compositions. Originality is a
                  creative goal, not a legal guarantee.
                </p>
                <p>
                  Review generated tracks before publishing. If you enable
                  source-based transformation, confirm that you own the
                  recording or have the necessary permissions. No output is
                  guaranteed copyright-free or immune to copyright detection.
                </p>
                <button
                  className="button primary full"
                  onClick={() => setModal(null)}
                >
                  Back to creating
                  <ArrowRight size={16} />
                </button>
              </>
            ) : (
              <>
                <div className="modal-symbol">
                  <Headphones size={25} />
                </div>
                <h2 id="modal-title">From reference to your next sound</h2>
                <div className="guide-step">
                  <b>01</b>
                  <div>
                    <h3>Bring a little inspiration</h3>
                    <p>
                      Upload MP3, WAV, or FLAC audio, or try our original studio
                      sample. Preview it and trim your favorite section.
                    </p>
                  </div>
                </div>
                <div className="guide-step">
                  <b>02</b>
                  <div>
                    <h3>Choose what moves you</h3>
                    <p>
                      Carry over rhythmic characteristics with Same beat &
                      energy, or explore atmosphere with Same vibe & feel.
                    </p>
                  </div>
                </div>
                <div className="guide-step">
                  <b>03</b>
                  <div>
                    <h3>Connect. Shape. Create.</h3>
                    <p>
                      Run the included Python backend and an ACE-Step inference
                      service. Connect the backend, adjust your settings, and
                      generate real music.
                    </p>
                  </div>
                </div>
                <a
                  className="button primary full"
                  href="/downloads/resona-source-1.1.0.zip"
                  download
                >
                  <Download size={16} />
                  Download source & setup guide
                </a>
                <p className="privacy-note">
                  Settings and library records are saved in this browser. Audio
                  files and outputs are stored by your configured backend.
                </p>
              </>
            )}
          </section>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <span>
            <Check size={16} />
          </span>
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
function Range({ label, value, set, left, right }) {
  return (
    <div className="range-field">
      <label>
        {label}
        <span>{value}%</span>
      </label>
      <input
        type="range"
        aria-label={label}
        min="0"
        max="100"
        value={value}
        style={{ "--fill": `${value}%` }}
        onChange={(e) => set(+e.target.value)}
      />
      <div>
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  );
}
function Empty({ icon, title, text, action, onClick }) {
  return (
    <div className="empty-large">
      <span>{icon}</span>
      <h2>{title}</h2>
      <p>{text}</p>
      <button className="button secondary" onClick={onClick}>
        {action}
        <ArrowRight size={15} />
      </button>
    </div>
  );
}
function Results({ job, api, onRegenerate, canRegenerate }) {
  return (
    <div className="results">
      {job.outputs?.map((o, i) => (
        <div className="result-row" key={o.id}>
          <div className={`track-art art-${i % 3}`}>
            <AudioLines size={24} />
          </div>
          <div className="result-content">
            <h3>
              {job.name || "A new direction"}
              <span>Variation {i + 1}</span>
            </h3>
            <p>
              {job.settings?.mode === "beat"
                ? "Same beat & energy"
                : "Same vibe & feel"}{" "}
              · {fmt(job.settings?.duration)} · {o.model || "ACE-Step 1.5"}
              {o.seed != null && (
                <span className="seed-label">Seed {o.seed}</span>
              )}
            </p>
            <AudioPreview
              src={`${api}${o.wav_url}`}
              label={`Variation ${i + 1}`}
            />
          </div>
          <div className="download-options">
            <a href={`${api}${o.wav_url}?download=1`} download>
              <Download size={13} />
              WAV
            </a>
            <a href={`${api}${o.mp3_url}?download=1`} download>
              <Download size={13} />
              MP3
            </a>
            <button
              onClick={() =>
                downloadRecipe(
                  { ...job.settings, variations: 1, seed: o.seed ?? null },
                  job.name,
                  {
                    model: o.model,
                    thinking: o.thinking,
                    inference_steps: o.inference_steps,
                  },
                )
              }
            >
              <Save size={13} />
              Recipe
            </button>
            <button disabled={!canRegenerate} onClick={onRegenerate}>
              <RotateCcw size={13} />
              Regenerate
            </button>
          </div>
        </div>
      ))}
      {job.outputs?.length > 0 && job.source_url && (
        <details className="comparison">
          <summary>
            <Headphones size={14} />
            Compare with original reference
            <ChevronDown size={14} />
          </summary>
          <AudioPreview
            src={`${api}${job.source_url}`}
            label="Original reference"
          />
          <p className="control-note">
            Playing a track pauses the other players for an easy comparison.
          </p>
        </details>
      )}
    </div>
  );
}
function Elapsed({ since }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span>{fmt(Math.max(0, now / 1000 - since))} elapsed</span>;
}
function JobNotice({ job, onRetry, canRetry }) {
  return (
    <div className="job-notice" role="status">
      <div>
        <strong>
          {job.status === "failed"
            ? "Generation needs attention"
            : "Generation stopped"}
        </strong>
        <p>{job.error || job.stage}</p>
      </div>
      <button
        className="button secondary"
        disabled={!canRetry}
        onClick={onRetry}
      >
        <RotateCcw size={14} />
        Retry remaining
      </button>
    </div>
  );
}
function AudioPreview({ src, label }) {
  const [error, setError] = useState(false);
  useEffect(() => setError(false), [src]);
  return (
    <>
      <audio
        aria-label={label}
        controls
        preload="none"
        src={src}
        onError={() => setError(true)}
      />
      {error && (
        <p className="error-text">
          Audio unavailable. Check the backend connection and that the file
          still exists.
        </p>
      )}
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
