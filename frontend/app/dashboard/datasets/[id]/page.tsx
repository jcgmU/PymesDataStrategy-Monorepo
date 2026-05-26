"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useDataset, useTransformDataset } from "@/hooks/api";
import { useJobPoller } from "@/hooks/useJobPoller";
import { DATASET_STATUS, type DatasetStatus } from "@/types/dataset";
import type { TransformationType } from "@/types/api";
import { cn } from "@/lib/utils";

// ─── Status config (same as DashboardPage) ──────────────────────────────────
const statusConfig: Record<DatasetStatus, { label: string; bg: string }> = {
  [DATASET_STATUS.PENDING]: { label: "PENDIENTE", bg: "bg-gray-300" },
  [DATASET_STATUS.PROCESSING]: { label: "PROCESANDO", bg: "bg-blue-300" },
  [DATASET_STATUS.READY]: { label: "LISTO", bg: "bg-green-300" },
  [DATASET_STATUS.ERROR]: { label: "ERROR", bg: "bg-red-300" },
  [DATASET_STATUS.ARCHIVED]: { label: "ARCHIVADO", bg: "bg-gray-200" },
};

// ─── Transform options ───────────────────────────────────────────────────────
const TRANSFORM_OPTIONS: { value: TransformationType; label: string }[] = [
  { value: "CLEAN_NULLS", label: "Limpiar valores nulos" },
  { value: "NORMALIZE", label: "Normalizar datos" },
  { value: "AGGREGATE", label: "Agregar/Agrupar" },
  { value: "FILTER", label: "Filtrar registros" },
  { value: "MERGE", label: "Combinar columnas" },
  { value: "CUSTOM", label: "Transformación personalizada" },
];

// ─── Job status config ───────────────────────────────────────────────────────
const jobStatusConfig: Record<string, { label: string; color: string }> = {
  QUEUED: { label: "EN COLA", color: "text-gray-700" },
  PROCESSING: { label: "PROCESANDO", color: "text-blue-700" },
  COMPLETED: { label: "COMPLETADO", color: "text-green-700" },
  FAILED: { label: "FALLIDO", color: "text-red-700" },
  CANCELLED: { label: "CANCELADO", color: "text-gray-500" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Schema renderer ─────────────────────────────────────────────────────────
function SchemaSection({ schema }: { schema: unknown }) {
  // Try to render as table if it's an array of objects with name/type
  if (Array.isArray(schema)) {
    const isTableFormat = schema.length > 0 && typeof schema[0] === "object" && schema[0] !== null;
    if (isTableFormat) {
      const cols = Object.keys(schema[0] as Record<string, unknown>);
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-black text-white">
                {cols.map((col) => (
                  <th key={col} className="px-3 py-2 text-left font-bold uppercase border border-black">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(schema as Record<string, unknown>[]).map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  {cols.map((col) => (
                    <td key={col} className="px-3 py-2 border border-black font-mono">
                      {String(row[col] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
  }

  // Fallback: formatted JSON
  return (
    <pre className="bg-gray-50 border-2 border-black p-4 rounded text-xs font-mono overflow-auto max-h-64 whitespace-pre-wrap">
      {JSON.stringify(schema, null, 2)}
    </pre>
  );
}

// ─── Statistics renderer ──────────────────────────────────────────────────────
function StatisticsSection({ statistics }: { statistics: unknown }) {
  if (!statistics || typeof statistics !== "object") return null;

  const entries = Object.entries(statistics as Record<string, unknown>);
  if (entries.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="bg-white border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
        >
          <p className="text-xs font-bold uppercase text-gray-600 truncate">{key}</p>
          <p className="text-lg font-black mt-1 truncate">
            {typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Transform Form ───────────────────────────────────────────────────────────
function TransformForm({ datasetId }: { datasetId: string }) {
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<TransformationType>("CLEAN_NULLS");
  const [jobId, setJobId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const transform = useTransformDataset(datasetId);
  const poller = useJobPoller(jobId);

  // When job completes, invalidate dataset query to refresh statistics
  useEffect(() => {
    if (poller.isCompleted) {
      queryClient.invalidateQueries({ queryKey: ["datasets", datasetId] });
    }
  }, [poller.isCompleted, queryClient, datasetId]);

  function handleSubmit() {
    setMutationError(null);
    setJobId(null);
    transform.mutate(
      { transformationType: selectedType },
      {
        onSuccess: (data: unknown) => {
          const response = data as { success: boolean; data: { jobId: string } };
          if (response?.data?.jobId) {
            setJobId(response.data.jobId);
          }
        },
        onError: (err: unknown) => {
          const error = err as { message?: string };
          setMutationError(error?.message ?? "Error al ejecutar la transformación");
        },
      }
    );
  }

  const jobStatusInfo = poller.jobStatus ? jobStatusConfig[poller.jobStatus] : null;

  return (
    <div className="space-y-4">
      {/* Select */}
      <div>
        <label className="block text-xs font-bold uppercase mb-1 text-gray-700">
          Tipo de transformación
        </label>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as TransformationType)}
          disabled={transform.isPending}
          className="w-full border-2 border-black px-3 py-2 font-medium bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Tipo de transformación"
        >
          {TRANSFORM_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Execute button */}
      <button
        onClick={handleSubmit}
        disabled={transform.isPending}
        className={cn(
          "w-full font-bold py-2 px-4 border-2 border-black",
          "bg-[#FF6B00] text-white uppercase",
          "shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
          "transition-all duration-150",
          !transform.isPending && [
            "hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
            "hover:translate-x-[2px] hover:translate-y-[2px]",
            "active:shadow-none active:translate-x-[4px] active:translate-y-[4px]",
          ],
          transform.isPending && "opacity-50 cursor-not-allowed"
        )}
      >
        {transform.isPending ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            Ejecutando...
          </span>
        ) : (
          "Ejecutar Transformación"
        )}
      </button>

      {/* Mutation error */}
      {mutationError && (
        <div className="border-2 border-red-500 bg-red-50 p-3">
          <p className="text-sm font-bold text-red-700">{mutationError}</p>
        </div>
      )}

      {/* Job status */}
      {jobId && jobStatusInfo && (
        <div
          className={cn(
            "border-2 border-black p-3 bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
          )}
        >
          <p className="text-xs font-bold uppercase text-gray-500 mb-1">Estado del trabajo</p>
          <p className={cn("font-black text-sm", jobStatusInfo.color)}>
            Job #{jobId} — {jobStatusInfo.label}
          </p>
          {poller.isPolling && (
            <div className="flex items-center gap-2 mt-2">
              <span className="animate-spin h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full" />
              <span className="text-xs text-gray-600">Consultando estado...</span>
            </div>
          )}
          {poller.isFailed && poller.error && (
            <p className="text-xs text-red-600 mt-2 font-medium">{poller.error}</p>
          )}
          {poller.isCompleted && (
            <p className="text-xs text-green-600 mt-2 font-medium">
              Transformación completada. Los datos han sido actualizados.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DatasetDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const { data, isLoading, isError } = useDataset(id);
  const dataset = data?.data;

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="flex-1 p-8 overflow-auto">
        <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-8 text-center max-w-md mx-auto mt-20">
          <div className="animate-spin h-8 w-8 border-4 border-[#0033A0] border-t-transparent rounded-full mx-auto mb-4" />
          <p className="font-bold text-gray-600">Cargando dataset...</p>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (isError || !dataset) {
    return (
      <div className="flex-1 p-8 overflow-auto">
        <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-8 text-center max-w-md mx-auto mt-20">
          <p className="font-bold text-red-600 mb-4">
            Error al cargar el dataset. Por favor, inténtalo de nuevo.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="font-bold py-2 px-4 border-2 border-black bg-[#0033A0] text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all duration-150"
          >
            ← Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  const config = statusConfig[dataset.status];

  // ── Data state ──
  return (
    <div className="flex-1 p-8 overflow-auto">
      {/* Back link */}
      <button
        onClick={() => router.push("/dashboard")}
        className="flex items-center gap-2 font-bold text-sm mb-6 hover:underline text-[#0033A0]"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al Dashboard
      </button>

      {/* Dataset Header Card */}
      <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-black uppercase truncate">{dataset.name}</h1>
            {dataset.description && (
              <p className="text-gray-600 mt-1">{dataset.description}</p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-gray-600 mt-2">
              <span>{dataset.originalFileName}</span>
              <span>&bull;</span>
              <span>{formatFileSize(dataset.fileSizeBytes)}</span>
              <span>&bull;</span>
              <span>{dataset.mimeType}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 mt-2">
              <span>Creado: {formatDate(dataset.createdAt)}</span>
              <span>|</span>
              <span>Usuario: {dataset.userId}</span>
            </div>
          </div>
          <span
            className={cn(
              "px-3 py-1 text-xs font-bold border-2 border-black text-center whitespace-nowrap self-start",
              config.bg
            )}
          >
            {config.label}
          </span>
        </div>
      </div>

      {/* Middle row: Statistics + Transform */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Statistics panel */}
        <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6">
          <h2 className="text-xl font-black uppercase border-b-2 border-black pb-2 mb-4">
            Estadísticas
          </h2>
          {dataset.statistics ? (
            <StatisticsSection statistics={dataset.statistics} />
          ) : (
            <p className="text-gray-500 text-sm font-medium">
              No hay estadísticas disponibles para este dataset.
            </p>
          )}
        </div>

        {/* Transform panel */}
        <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6">
          <h2 className="text-xl font-black uppercase border-b-2 border-black pb-2 mb-4">
            Transformar
          </h2>
          <TransformForm datasetId={id} />
        </div>
      </div>

      {/* Schema panel */}
      {!!dataset.schema && (
        <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6">
          <h2 className="text-xl font-black uppercase border-b-2 border-black pb-2 mb-4">
            Esquema
          </h2>
          <SchemaSection schema={dataset.schema} />
        </div>
      )}
    </div>
  );
}
