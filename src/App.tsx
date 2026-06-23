import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type DataPoint = { time: string; value: number };
type ViewMode = 'both' | 'text' | 'charts';
type StressDuration = 5 | 10 | 30;

const MAX_HISTORY = 60;

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('ru-RU', { hour12: false });
}

function useMemory() {
  const [used, setUsed] = useState(0);
  const [limit, setLimit] = useState(0);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mem = (window.performance as any).memory;
    if (!mem) return;

    setSupported(true);
    const update = () => {
      setUsed(mem.usedJSHeapSize || 0);
      setLimit(mem.jsHeapSizeLimit || 0);
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, []);

  return { used, limit, supported };
}

function useCpuLoad() {
  const [load, setLoad] = useState(0);
  const [cores] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 1 : 1
  );
  const samplesRef = useRef<number[]>([]);
  const lastRef = useRef<number>(
    typeof performance !== 'undefined' ? performance.now() : 0
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const sampleMs = 100;
    const sampleId = window.setInterval(() => {
      const now = performance.now();
      const lag = Math.max(0, now - lastRef.current - sampleMs);
      samplesRef.current.push(lag);
      if (samplesRef.current.length > 50) samplesRef.current.shift();
      lastRef.current = now;
    }, sampleMs);

    const updateId = window.setInterval(() => {
      const samples = samplesRef.current;
      const avg = samples.length
        ? samples.reduce((a, b) => a + b, 0) / samples.length
        : 0;
      const threshold = 25;
      const percent = Math.min(100, (avg / threshold) * 100);
      setLoad(percent);
    }, 1000);

    return () => {
      window.clearInterval(sampleId);
      window.clearInterval(updateId);
    };
  }, []);

  return { load, cores };
}

function StatCard({
  title,
  value,
  subtext,
  variant,
  icon,
}: {
  title: string;
  value: number;
  subtext: string;
  variant: 'cpu' | 'memory';
  icon: React.ReactNode;
}) {
  const isCpu = variant === 'cpu';
  const glow = isCpu
    ? 'shadow-violet-500/20 hover:shadow-violet-500/30'
    : 'shadow-emerald-500/20 hover:shadow-emerald-500/30';

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-slate-700/40 bg-gradient-to-br from-slate-800/80 to-slate-900/80 p-6 shadow-xl backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-2xl ${glow}`}
    >
      <div
        className={`absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20 blur-2xl ${
          isCpu ? 'bg-violet-500' : 'bg-emerald-500'
        }`}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            {title}
          </h2>
          <div
            className={`mt-2 text-5xl font-extrabold tracking-tight ${
              isCpu ? 'text-violet-300' : 'text-emerald-300'
            }`}
          >
            {value.toFixed(1)}%
          </div>
          <p className="mt-2 text-sm text-slate-400">{subtext}</p>
        </div>
        <div
          className={`rounded-2xl p-3 ${
            isCpu
              ? 'bg-violet-500/15 text-violet-300'
              : 'bg-emerald-500/15 text-emerald-300'
          }`}
        >
          {icon}
        </div>
      </div>
      <div className="relative mt-6 h-3 overflow-hidden rounded-full bg-slate-700/60">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${
            isCpu
              ? 'bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-500'
              : 'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

function ChartPanel({
  title,
  data,
  variant,
}: {
  title: string;
  data: DataPoint[];
  variant: 'cpu' | 'memory';
}) {
  const isCpu = variant === 'cpu';
  const stroke = isCpu ? '#a78bfa' : '#34d399';
  const gradientId = isCpu ? 'cpuGradient' : 'memGradient';

  return (
    <div className="rounded-3xl border border-slate-700/40 bg-gradient-to-br from-slate-800/80 to-slate-900/80 p-5 shadow-xl backdrop-blur">
      <div className="mb-4 flex items-center gap-3">
        <div
          className={`h-3 w-3 rounded-full ${
            isCpu ? 'bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.8)]' : 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]'
          }`}
        />
        <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={stroke} stopOpacity={0.4} />
                <stop offset="95%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
            <XAxis
              dataKey="time"
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              interval="preserveStartEnd"
              stroke="#475569"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              stroke="#475569"
              unit="%"
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(15, 23, 42, 0.95)',
                border: `1px solid ${isCpu ? '#7c3aed' : '#059669'}`,
                borderRadius: '0.75rem',
                color: '#e2e8f0',
                boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
              }}
              labelStyle={{ color: '#94a3b8' }}
              formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Загрузка']}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={stroke}
              strokeWidth={3}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function HistoryTable({
  title,
  data,
  variant,
}: {
  title: string;
  data: DataPoint[];
  variant: 'cpu' | 'memory';
}) {
  const rows = useMemo(() => [...data].reverse().slice(0, 20), [data]);
  const isCpu = variant === 'cpu';

  return (
    <div className="rounded-3xl border border-slate-700/40 bg-gradient-to-br from-slate-800/80 to-slate-900/80 p-5 shadow-xl backdrop-blur">
      <div className="mb-4 flex items-center gap-3">
        <div
          className={`h-3 w-3 rounded-full ${
            isCpu ? 'bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.8)]' : 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]'
          }`}
        />
        <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
      </div>
      <div className="max-h-72 overflow-auto rounded-xl border border-slate-700/30">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-900/95 text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Время</th>
              <th className="px-4 py-3 font-medium">Значение</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/40">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-5 text-center text-slate-500">
                  Собираю данные…
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-700/20">
                  <td className="px-4 py-2.5 text-slate-300">{row.time}</td>
                  <td
                    className={`px-4 py-2.5 font-semibold ${
                      isCpu ? 'text-violet-300' : 'text-emerald-300'
                    }`}
                  >
                    {row.value.toFixed(1)}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function App() {
  const { load: cpuLoad, cores } = useCpuLoad();
  const { used: memUsed, limit: memLimit, supported: memSupported } = useMemory();
  const [cpuHistory, setCpuHistory] = useState<DataPoint[]>([]);
  const [memHistory, setMemHistory] = useState<DataPoint[]>([]);
  const [view, setView] = useState<ViewMode>('both');
  const [isActive, setIsActive] = useState(true);
  const [stressing, setStressing] = useState(false);
  const [stressProgress, setStressProgress] = useState(0);
  const [stressDuration, setStressDuration] = useState<StressDuration>(10);
  const [stressRemaining, setStressRemaining] = useState(0);
  const stressWorkersRef = useRef<Worker[]>([]);

  const memPercent = memSupported && memLimit > 0 ? (memUsed / memLimit) * 100 : 0;

  const latestRef = useRef({ cpu: cpuLoad, mem: memPercent });
  useEffect(() => {
    latestRef.current = { cpu: cpuLoad, mem: memPercent };
  }, [cpuLoad, memPercent]);

  useEffect(() => {
    const onVisibility = () => setIsActive(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) return;
      const time = formatTime(new Date());
      setCpuHistory((prev) =>
        [...prev.slice(-MAX_HISTORY + 1), { time, value: Number(latestRef.current.cpu.toFixed(1)) }]
      );
      setMemHistory((prev) =>
        [...prev.slice(-MAX_HISTORY + 1), { time, value: Number(latestRef.current.mem.toFixed(1)) }]
      );
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const modeButton = (mode: ViewMode, label: string) => {
    const active = view === mode;
    return (
      <button
        key={mode}
        onClick={() => setView(mode)}
        className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
          active
            ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-900/40'
            : 'border border-slate-600/50 bg-slate-800/60 text-slate-300 hover:border-slate-500 hover:bg-slate-700/60'
        }`}
      >
        {label}
      </button>
    );
  };

  const startStressTest = (durationSec: StressDuration) => {
    if (stressing) return;
    setStressing(true);
    setStressProgress(0);
    setStressRemaining(durationSec);

    const workerCount = Math.min(cores || 4, 8);
    const workers: Worker[] = [];
    const blob = new Blob(
      [
        `self.onmessage = function () {
          const end = performance.now() + 60000;
          while (performance.now() < end) {
            Math.sqrt(Math.random() * Math.random());
          }
          self.postMessage('done');
        };`,
      ],
      { type: 'application/javascript' }
    );
    const workerUrl = URL.createObjectURL(blob);

    for (let i = 0; i < workerCount; i++) {
      const worker = new Worker(workerUrl);
      worker.onmessage = () => worker.terminate();
      worker.postMessage('start');
      workers.push(worker);
    }
    stressWorkersRef.current = workers;

    const startTime = Date.now();
    const totalMs = durationSec * 1000;
    const progressId = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, (elapsed / totalMs) * 100);
      const remaining = Math.max(0, Math.ceil((totalMs - elapsed) / 1000));
      setStressProgress(progress);
      setStressRemaining(remaining);
      if (elapsed >= totalMs) {
        window.clearInterval(progressId);
      }
    }, 100);

    window.setTimeout(() => {
      stressWorkersRef.current.forEach((w) => w.terminate());
      stressWorkersRef.current = [];
      URL.revokeObjectURL(workerUrl);
      setStressing(false);
      setStressProgress(0);
      setStressRemaining(0);
      window.clearInterval(progressId);
    }, totalMs);
  };

  const durationButton = (sec: StressDuration, label: string) => {
    const active = stressDuration === sec;
    return (
      <button
        key={sec}
        onClick={() => setStressDuration(sec)}
        disabled={stressing}
        className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
          active
            ? 'bg-rose-500/30 text-rose-200 ring-1 ring-rose-500/50'
            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
        } ${stressing ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#050505] p-4 text-slate-100 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-6 rounded-3xl border border-slate-700/30 bg-slate-900/40 p-6 shadow-2xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-lg shadow-violet-900/40">
              <svg
                className="h-7 w-7 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <path d="M9 9h6v6H9z" />
                <path d="M9 1v3" />
                <path d="M15 1v3" />
                <path d="M9 20v3" />
                <path d="M15 20v3" />
                <path d="M20 9h3" />
                <path d="M20 14h3" />
                <path d="M1 9h3" />
                <path d="M1 14h3" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white">
                Мониторинг системы
              </h1>
              <p className="mt-1 text-slate-400">
                Загрузка CPU и памяти в реальном времени
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {modeButton('both', 'Всё')}
            {modeButton('text', 'Текст')}
            {modeButton('charts', 'Графики')}
          </div>
        </header>

        <div className="rounded-3xl border border-rose-500/20 bg-gradient-to-br from-rose-950/40 to-slate-900/60 p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.25)]">
                <svg
                  className="h-6 w-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">Стресс-тест CPU</h3>
                <p className="mt-1 max-w-md text-sm text-slate-400">
                  Создаёт вычислительную нагрузку на все логические ядра. Используйте для проверки графиков.
                </p>
              </div>
            </div>
            <div className="flex min-w-[16rem] flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-400">Длительность:</span>
                <div className="flex gap-2">
                  {durationButton(5, '5 с')}
                  {durationButton(10, '10 с')}
                  {durationButton(30, '30 с')}
                </div>
              </div>
              <button
                onClick={() => startStressTest(stressDuration)}
                disabled={stressing}
                className={`relative overflow-hidden rounded-xl px-6 py-3 text-sm font-bold transition-all ${
                  stressing
                    ? 'cursor-not-allowed bg-slate-700 text-slate-400'
                    : 'bg-gradient-to-r from-rose-600 to-orange-500 text-white shadow-lg shadow-rose-900/40 hover:from-rose-500 hover:to-orange-400 hover:shadow-rose-900/60'
                }`}
              >
                {stressing
                  ? `Тест запущен — ${stressRemaining} с`
                  : `Запустить на ${stressDuration} секунд`}
                {stressing && (
                  <span
                    className="absolute bottom-0 left-0 h-1 bg-white/40 transition-all duration-100 ease-linear"
                    style={{ width: `${stressProgress}%` }}
                  />
                )}
              </button>
            </div>
          </div>
        </div>

        {!isActive && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Вкладка неактивна — обновление данных приостановлено.
          </div>
        )}

        {(view === 'both' || view === 'text') && (
          <div className="grid gap-5 sm:grid-cols-2">
            <StatCard
              title="Загрузка CPU"
              value={cpuLoad}
              subtext={`Логических ядер: ${cores}`}
              variant="cpu"
              icon={
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                  <path d="M9 9h6v6H9z" />
                  <path d="M9 1v3" />
                  <path d="M15 1v3" />
                  <path d="M9 20v3" />
                  <path d="M15 20v3" />
                  <path d="M20 9h3" />
                  <path d="M20 14h3" />
                  <path d="M1 9h3" />
                  <path d="M1 14h3" />
                </svg>
              }
            />
            <StatCard
              title="Использование памяти"
              value={memPercent}
              subtext={
                memSupported
                  ? `${formatBytes(memUsed)} из ${formatBytes(memLimit)}`
                  : 'API памяти недоступно в этом браузере'
              }
              variant="memory"
              icon={
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12h20" />
                  <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6" />
                  <path d="M12 2v10" />
                  <path d="m9 5 3-3 3 3" />
                </svg>
              }
            />
          </div>
        )}

        {(view === 'both' || view === 'charts') && (
          <div className="grid gap-5 lg:grid-cols-2">
            <ChartPanel title="График загрузки CPU" data={cpuHistory} variant="cpu" />
            <ChartPanel title="График использования памяти" data={memHistory} variant="memory" />
          </div>
        )}

        {view === 'text' && (
          <div className="grid gap-5 lg:grid-cols-2">
            <HistoryTable title="История CPU" data={cpuHistory} variant="cpu" />
            <HistoryTable title="История памяти" data={memHistory} variant="memory" />
          </div>
        )}

       
      </div>
    </div>
  );
}
