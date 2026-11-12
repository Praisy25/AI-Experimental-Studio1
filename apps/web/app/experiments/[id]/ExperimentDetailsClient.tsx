
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiFetch as fetch } from "../../lib/api";

type Experiment = {
  id: string;
  name: string;
  description: string | null;
  modelName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type RunResult = {
  experimentId: string;
  experimentName: string;
  model: string;
  provider?: string;
  prompt: string;
  response: string;
  settings: RunSettings;
  done: boolean;
  runId?: string;
  status?: string;
  durationMs?: number | null;
};

type RunSettings = {
  temperature: number;
  topP: number;
  maxTokens: number;
  frequencyPenalty: number;
  presencePenalty: number;
};

type ExperimentRun = {
  id: string;
  experimentId: string;
  promptVersionId: string | null;
  promptVersion: { id: string; title: string; version: number } | null;
  providerConnection: { provider: string; displayName: string } | null;
  prompt: string;
  response: string | null;
  modelName: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  frequencyPenalty: number;
  presencePenalty: number;
  precisionScore: number | null;
  concisenessScore: number | null;
  status: string;
  error: string | null;
  durationMs: number | null;
  createdAt: string;
};

type OllamaModel = {
  name: string;
  size: number;
  averageResponseMs?: number | null;
  responseSamples?: number;
};

type ProviderConnection = { id: string; provider: string; displayName: string; defaultModel: string | null; baseUrl: string | null };

type PromptTemplate = {
  id: string;
  title: string;
  prompt: string;
  category: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type PromptVersion = {
  id: string;
  promptTemplateId: string;
  version: number;
  title: string;
  prompt: string;
  category: string;
  tags: string[];
  createdAt: string;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function formatModelSize(size: number) {
  const gibibytes = size / 1024 ** 3;
  return gibibytes >= 1
    ? `${gibibytes.toFixed(1)} GB`
    : `${(size / 1024 ** 2).toFixed(0)} MB`;
}

function promptDiff(olderText: string, newerText: string) {
  const older = olderText.split("\n");
  const newer = newerText.split("\n");
  let start = 0;
  while (start < older.length && start < newer.length && older[start] === newer[start]) start++;
  let oldEnd = older.length - 1;
  let newEnd = newer.length - 1;
  while (oldEnd >= start && newEnd >= start && older[oldEnd] === newer[newEnd]) { oldEnd--; newEnd--; }
  return { removed: older.slice(start, oldEnd + 1), added: newer.slice(start, newEnd + 1) };
}

export default function ExperimentDetailsClient() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  // Experiment details
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Edit experiment form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [modelName, setModelName] = useState("not-configured");

  // Run experiment form
  const [prompt, setPrompt] = useState(
    "Explain customer segmentation in three simple sentences."
  );
  const [selectedPromptVersionId, setSelectedPromptVersionId] = useState<string | null>(null);
  const [benchmarkVersions, setBenchmarkVersions] = useState<PromptVersion[]>([]);
  const [benchmarkVersionIds, setBenchmarkVersionIds] = useState<[string, string]>(["", ""]);
  const [benchmarkQuestions, setBenchmarkQuestions] = useState(
    "Explain machine learning versus traditional programming in exactly three short bullet points.\nExplain how a database index speeds up a search in two concise sentences.\nWhat is a binary search tree? Give a simple definition and one practical example in no more than 80 words."
  );
  const [benchmarkLoadingVersions, setBenchmarkLoadingVersions] = useState(true);
  const [benchmarkRunning, setBenchmarkRunning] = useState(false);
  const [benchmarkError, setBenchmarkError] = useState("");
  const [benchmarkMessage, setBenchmarkMessage] = useState("");
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [providerConnections, setProviderConnections] = useState<ProviderConnection[]>([]);
  const [selectedProviderConnectionId, setSelectedProviderConnectionId] = useState("");
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState("");
  const [selectedRunModel, setSelectedRunModel] = useState("");
  const selectedProviderConnection = providerConnections.find((provider) => provider.id === selectedProviderConnectionId) ?? null;
  const usesLocalOllama = !selectedProviderConnection;
  const selectedModelIsValid = Boolean(selectedRunModel.trim()) && (!usesLocalOllama || models.some((availableModel) => availableModel.name === selectedRunModel));
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.9);
  const [maxTokens, setMaxTokens] = useState(256);
  const [frequencyPenalty, setFrequencyPenalty] = useState(0);
  const [presencePenalty, setPresencePenalty] = useState(0);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [improvingPrompt, setImprovingPrompt] = useState(false);
  const [improveError, setImproveError] = useState("");
  const [improvedPrompt, setImprovedPrompt] = useState<string | null>(null);

  // Persistent run history
  const [runs, setRuns] = useState<ExperimentRun[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [comparisonRunIds, setComparisonRunIds] = useState<string[]>([]);
  const [ratingSavingRunId, setRatingSavingRunId] = useState<string | null>(null);
  const [ratingError, setRatingError] = useState("");
  const [promptLibrary, setPromptLibrary] = useState<PromptTemplate[]>([]);
  const [promptLibraryLoading, setPromptLibraryLoading] = useState(true);
  const [promptLibrarySaving, setPromptLibrarySaving] = useState(false);
  const [promptLibraryError, setPromptLibraryError] = useState("");
  const [promptSearch, setPromptSearch] = useState("");
  const [promptTitle, setPromptTitle] = useState("");
  const [promptCategory, setPromptCategory] = useState("General");
  const [promptTagsInput, setPromptTagsInput] = useState("");
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [editingPromptTitle, setEditingPromptTitle] = useState("");
  const [editingPromptText, setEditingPromptText] = useState("");
  const [editingPromptCategory, setEditingPromptCategory] = useState("General");
  const [editingPromptTagsInput, setEditingPromptTagsInput] = useState("");
  const [promptVersions, setPromptVersions] = useState<Record<string, PromptVersion[]>>({});
  const [expandedPromptId, setExpandedPromptId] = useState<string | null>(null);
  const [versionsLoadingId, setVersionsLoadingId] = useState<string | null>(null);
  const [versionsError, setVersionsError] = useState("");
  const [promptUpdateSaving, setPromptUpdateSaving] = useState(false);

  const loadExperiment = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/experiments/${encodeURIComponent(id)}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load experiment");
      }

      setExperiment(data);
      setName(data.name);
      setDescription(data.description || "");
      setModelName(data.modelName);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load experiment"
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadRunHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      setHistoryError("");

      const response = await fetch(
        `${API_URL}/api/experiments/${encodeURIComponent(id)}/runs`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load run history");
      }

      if (!Array.isArray(data)) {
        throw new Error("The API returned an invalid run history.");
      }

      setRuns(data);
      setComparisonRunIds((selectedIds) =>
        selectedIds.filter((selectedId) =>
          data.some((run: ExperimentRun) => run.id === selectedId)
        )
      );
    } catch (err) {
      setHistoryError(
        err instanceof Error
          ? err.message
          : "Could not load run history"
      );
    } finally {
      setHistoryLoading(false);
    }
  }, [id]);

  const loadModels = useCallback(async () => {
    try {
      setModelsLoading(true);
      setModelsError("");

      const response = await fetch(`${API_URL}/api/models`, {
        cache: "no-store",
      });
      const data: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof data === "object" && data !== null && "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "Could not load Ollama models";
        throw new Error(message);
      }

      if (
        !Array.isArray(data) ||
        !data.every(
          (model) =>
            typeof model === "object" &&
            model !== null &&
            typeof model.name === "string" &&
            typeof model.size === "number"
        )
      ) {
        throw new Error("The API returned an invalid model list.");
      }

      const availableModels = data as OllamaModel[];
      setModels(availableModels);
      setSelectedRunModel((currentModel) =>
        availableModels.some((model) => model.name === currentModel)
          ? currentModel
          : availableModels[0]?.name ?? ""
      );
    } catch (err) {
      setModels([]);
      setSelectedRunModel("");
      setModelsError(
        err instanceof Error ? err.message : "Could not load Ollama models"
      );
    } finally {
      setModelsLoading(false);
    }
  }, []);

  const loadProviderConnections = useCallback(async () => {
    try {
      const [response, configResponse] = await Promise.all([fetch(`${API_URL}/api/providers`, { cache: "no-store" }), fetch(`${API_URL}/api/runtime-config`, { cache: "no-store" })]);
      const data: unknown = await response.json();
      const config = configResponse.ok ? await configResponse.json() as { externalAiEnabled?: boolean } : { externalAiEnabled: false };
      if (!response.ok) throw new Error("Could not load saved provider connections.");
      if (!Array.isArray(data)) throw new Error("The API returned an invalid provider list.");
      setProviderConnections((data as ProviderConnection[]).filter((provider) => config.externalAiEnabled === true || provider.provider === "ollama"));
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Could not load provider connections.");
    }
  }, []);

  const loadPromptLibrary = useCallback(async () => {
    try {
      setPromptLibraryLoading(true);
      setPromptLibraryError("");
      const response = await fetch(`${API_URL}/api/prompts`, {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load saved prompts");
      }

      if (!Array.isArray(data)) {
        throw new Error("The API returned an invalid prompt library.");
      }

      setPromptLibrary(data as PromptTemplate[]);
    } catch (err) {
      setPromptLibraryError(
        err instanceof Error ? err.message : "Could not load saved prompts"
      );
    } finally {
      setPromptLibraryLoading(false);
    }
  }, []);

  const loadBenchmarkVersions = useCallback(async () => {
    try {
      setBenchmarkLoadingVersions(true);
      const response = await fetch(`${API_URL}/api/prompt-versions`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load prompt versions");
      if (!Array.isArray(data)) throw new Error("The API returned an invalid prompt version list.");
      setBenchmarkVersions(data as PromptVersion[]);
    } catch (err) {
      setBenchmarkError(err instanceof Error ? err.message : "Could not load prompt versions");
    } finally {
      setBenchmarkLoadingVersions(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => Promise.all([loadExperiment(), loadRunHistory(), loadModels(), loadProviderConnections(), loadPromptLibrary(), loadBenchmarkVersions()]));
  }, [loadExperiment, loadRunHistory, loadModels, loadProviderConnections, loadPromptLibrary, loadBenchmarkVersions]);

  async function handleUpdate(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/api/experiments/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, modelName }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not update experiment");
      }

      setExperiment(data);
      setName(data.name);
      setDescription(data.description || "");
      setModelName(data.modelName);
      setEditing(false);
      setMessage("Experiment updated successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update experiment"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${experiment?.name}"? This cannot be undone.`
    );

    if (!confirmed) return;

    setDeleting(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/experiments/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Could not delete experiment");
      }

      router.push("/experiments");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete experiment"
      );
      setDeleting(false);
    }
  }

  async function handleRunExperiment(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!prompt.trim()) {
      setRunError("Please enter a prompt before running the experiment.");
      return;
    }

    if (!selectedModelIsValid) {
      setRunError(usesLocalOllama ? "Select an installed Ollama model before running the experiment." : "Enter a model name for this provider.");
      return;
    }

    setRunning(true);
    setRunError("");
    setRunResult(null);

    try {
      const response = await fetch(
        `${API_URL}/api/experiments/${encodeURIComponent(id)}/run`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: prompt.trim(),
            promptVersionId: selectedPromptVersionId,
            model: selectedRunModel,
            providerConnectionId: selectedProviderConnectionId || null,
            temperature,
            topP,
            maxTokens,
            frequencyPenalty,
            presencePenalty,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "The experiment could not be run."
        );
      }

      setRunResult(data as RunResult);

      // Reload history after the backend saves the run.
      await loadRunHistory();
    } catch (err) {
      setRunError(
        err instanceof Error
          ? err.message
          : "Something went wrong while running the experiment."
      );

      // Also refresh history in case the backend saved a failed run.
      await loadRunHistory();
    } finally {
      setRunning(false);
    }
  }

  async function handleRunBenchmark(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const questions = benchmarkQuestions.split(/\r?\n/).map((question) => question.trim()).filter(Boolean);
    if (!benchmarkVersionIds[0] || !benchmarkVersionIds[1] || benchmarkVersionIds[0] === benchmarkVersionIds[1]) {
      setBenchmarkError("Select two different saved prompt versions.");
      return;
    }
    if (questions.length < 1 || questions.length > 5) {
      setBenchmarkError("Enter between 1 and 5 questions, one per line.");
      return;
    }
    if (!selectedModelIsValid) {
      setBenchmarkError(usesLocalOllama ? "Select an installed Ollama model before starting the benchmark." : "Enter a model name for this provider.");
      return;
    }

    setBenchmarkRunning(true);
    setBenchmarkError("");
    setBenchmarkMessage("");
    try {
      const response = await fetch(`${API_URL}/api/experiments/${encodeURIComponent(id)}/benchmark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptVersionIds: benchmarkVersionIds,
          questions,
          model: selectedRunModel,
          providerConnectionId: selectedProviderConnectionId || null,
          temperature,
          topP,
          maxTokens,
          frequencyPenalty,
          presencePenalty,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not run the benchmark");
      setBenchmarkMessage(
        `Benchmark finished: ${data.completed} completed, ${data.failed} failed. Rate the saved runs in Run History.`
      );
      await loadRunHistory();
    } catch (err) {
      setBenchmarkError(err instanceof Error ? err.message : "Could not run the benchmark");
      await loadRunHistory();
    } finally {
      setBenchmarkRunning(false);
    }
  }

  async function handleImprovePrompt() {
    if (!prompt.trim()) {
      setImproveError("Enter a prompt before asking Ollama to improve it.");
      return;
    }
    if (!usesLocalOllama || !models.some((model) => model.name === selectedRunModel)) {
      setImproveError("Select an installed Ollama model first.");
      return;
    }

    setImprovingPrompt(true);
    setImproveError("");
    setImprovedPrompt(null);

    try {
      const response = await fetch(`${API_URL}/api/prompts/improve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), model: selectedRunModel }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not improve the prompt");
      }
      if (typeof data.improvedPrompt !== "string" || !data.improvedPrompt.trim()) {
        throw new Error("The API returned an invalid prompt suggestion.");
      }

      setImprovedPrompt(data.improvedPrompt.trim());
    } catch (err) {
      setImproveError(
        err instanceof Error ? err.message : "Could not improve the prompt"
      );
    } finally {
      setImprovingPrompt(false);
    }
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Copied to clipboard.");
    } catch {
      setRunError(
        "Could not copy automatically. Select the text and copy it manually."
      );
    }
  }

  function exportExperimentMarkdown() {
    if (!experiment || runs.length === 0) return;

    const quoteBlock = (value: string) =>
      value
        .split(/\r?\n/)
        .map((line) => `> ${line}`)
        .join("\n");
    const average = (value: number | null) =>
      value == null ? "Not rated" : `${value.toFixed(1)} / 5`;

    const markdown = [
      `# ${experiment.name}`,
      "",
      `Exported: ${new Date().toLocaleString()}`,
      experiment.description ? `\n${experiment.description}` : "",
      "",
      "## Analytics Summary",
      "",
      `- Total runs: ${runs.length}`,
      `- Average precision: ${average(averagePrecision)}`,
      `- Average conciseness: ${average(averageConciseness)}`,
      highestRatedRun
        ? `- Highest-rated run: ${((highestRatedRun.precisionScore! + highestRatedRun.concisenessScore!) / 2).toFixed(1)} / 5 (${highestRatedRun.modelName})`
        : "- Highest-rated run: Not available yet",
      "",
      "## Prompt Version Performance",
      "",
      ...(promptVersionAnalytics.length > 0
        ? promptVersionAnalytics.flatMap((version) => {
            const precisionAverage = version.precision.length
              ? version.precision.reduce((sum, score) => sum + score, 0) / version.precision.length
              : null;
            const concisenessAverage = version.conciseness.length
              ? version.conciseness.reduce((sum, score) => sum + score, 0) / version.conciseness.length
              : null;
            return [
              `### ${version.title} (v${version.version})`,
              "",
              `- Linked runs: ${version.runCount}`,
              `- Average precision: ${average(precisionAverage)}`,
              `- Average conciseness: ${average(concisenessAverage)}`,
              "",
            ];
          })
        : ["No runs are linked to saved prompt versions yet.", ""]),
      "## Run History",
      ...runs.flatMap((run, index) => [
        "",
        `### Run ${runs.length - index} — ${run.status}`,
        "",
        `- Date: ${new Date(run.createdAt).toLocaleString()}`,
        `- Model: ${run.modelName}`,
        ...(run.providerConnection ? [`- Provider: ${run.providerConnection.displayName} (${run.providerConnection.provider})`] : []),
        ...(run.promptVersion
          ? [`- Prompt version: ${run.promptVersion.title} (v${run.promptVersion.version})`]
          : []),
        `- Duration: ${run.durationMs == null ? "Not available" : `${(run.durationMs / 1000).toFixed(2)} seconds`}`,
        `- Temperature: ${run.temperature}`,
        `- Top P: ${run.topP}`,
        `- Maximum tokens: ${run.maxTokens}`,
        `- Frequency penalty: ${run.frequencyPenalty}`,
        `- Presence penalty: ${run.presencePenalty}`,
        `- Precision: ${run.precisionScore == null ? "Not rated" : `${run.precisionScore} / 5`}`,
        `- Conciseness: ${run.concisenessScore == null ? "Not rated" : `${run.concisenessScore} / 5`}`,
        "",
        "#### Prompt",
        "",
        quoteBlock(run.prompt),
        "",
        "#### Response",
        "",
        quoteBlock(run.response || run.error || "No response saved."),
      ]),
      "",
    ].filter((line) => line !== undefined);

    const blob = new Blob([markdown.join("\n")], {
      type: "text/markdown;charset=utf-8",
    });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const fileName = experiment.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "experiment";
    link.href = downloadUrl;
    link.download = `${fileName}-report.md`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  }

  function toggleRunComparison(runId: string) {
    setComparisonRunIds((selectedIds) => {
      if (selectedIds.includes(runId)) {
        return selectedIds.filter((selectedId) => selectedId !== runId);
      }

      return selectedIds.length < 2 ? [...selectedIds, runId] : selectedIds;
    });
  }

  async function saveRunRating(
    runId: string,
    field: "precisionScore" | "concisenessScore",
    score: number
  ) {
    setRatingSavingRunId(runId);
    setRatingError("");

    try {
      const response = await fetch(
        `${API_URL}/api/experiments/${encodeURIComponent(id)}/runs/${encodeURIComponent(runId)}/ratings`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: score }),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not save this rating");
      }

      const updatedRun = data as ExperimentRun;
      setRuns((currentRuns) =>
        currentRuns.map((run) => (run.id === updatedRun.id ? updatedRun : run))
      );
    } catch (err) {
      setRatingError(
        err instanceof Error ? err.message : "Could not save this rating"
      );
    } finally {
      setRatingSavingRunId(null);
    }
  }

  async function handleSavePrompt(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPromptLibrarySaving(true);
    setPromptLibraryError("");

    try {
      const response = await fetch(`${API_URL}/api/prompts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: promptTitle,
          prompt,
          category: promptCategory,
          tags: promptTagsInput.split(",").map((tag) => tag.trim()).filter(Boolean),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not save prompt");
      }

      setPromptLibrary((currentPrompts) => [
        data as PromptTemplate,
        ...currentPrompts,
      ]);
      setPromptTitle("");
    } catch (err) {
      setPromptLibraryError(
        err instanceof Error ? err.message : "Could not save prompt"
      );
    } finally {
      setPromptLibrarySaving(false);
    }
  }

  async function handleDeleteSavedPrompt(promptId: string) {
    if (!window.confirm("Delete this saved prompt from your library?")) return;

    setPromptLibraryError("");

    try {
      const response = await fetch(
        `${API_URL}/api/prompts/${encodeURIComponent(promptId)}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Could not delete saved prompt");
      }

      setPromptLibrary((currentPrompts) =>
        currentPrompts.filter((item) => item.id !== promptId)
      );
    } catch (err) {
      setPromptLibraryError(
        err instanceof Error ? err.message : "Could not delete saved prompt"
      );
    }
  }

  function startEditingPrompt(savedPrompt: PromptTemplate) {
    setEditingPromptId(savedPrompt.id);
    setEditingPromptTitle(savedPrompt.title);
    setEditingPromptText(savedPrompt.prompt);
    setEditingPromptCategory(savedPrompt.category);
    setEditingPromptTagsInput((savedPrompt.tags ?? []).join(", "));
    setPromptLibraryError("");
  }

  async function handleUpdateSavedPrompt(
    event: React.FormEvent<HTMLFormElement>,
    promptId: string
  ) {
    event.preventDefault();
    setPromptUpdateSaving(true);
    setPromptLibraryError("");

    try {
      const response = await fetch(
        `${API_URL}/api/prompts/${encodeURIComponent(promptId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editingPromptTitle,
            prompt: editingPromptText,
            category: editingPromptCategory,
            tags: editingPromptTagsInput.split(",").map((tag) => tag.trim()).filter(Boolean),
          }),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not update saved prompt");
      }

      const updatedPrompt = data.prompt as PromptTemplate;
      const newVersion = data.version as PromptVersion;
      setPromptLibrary((currentPrompts) =>
        currentPrompts.map((item) =>
          item.id === updatedPrompt.id ? updatedPrompt : item
        )
      );
      setPromptVersions((currentVersions) =>
        currentVersions[promptId]
          ? {
              ...currentVersions,
              [promptId]: [newVersion, ...currentVersions[promptId]],
            }
          : currentVersions
      );
      setEditingPromptId(null);
    } catch (err) {
      setPromptLibraryError(
        err instanceof Error ? err.message : "Could not update saved prompt"
      );
    } finally {
      setPromptUpdateSaving(false);
    }
  }

  async function togglePromptVersions(promptId: string) {
    if (expandedPromptId === promptId) {
      setExpandedPromptId(null);
      return;
    }

    setExpandedPromptId(promptId);
    setVersionsError("");
    if (promptVersions[promptId]) return;

    setVersionsLoadingId(promptId);
    try {
      const response = await fetch(
        `${API_URL}/api/prompts/${encodeURIComponent(promptId)}/versions`,
        { cache: "no-store" }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not load prompt versions");
      }
      if (!Array.isArray(data)) {
        throw new Error("The API returned an invalid version history.");
      }
      setPromptVersions((currentVersions) => ({
        ...currentVersions,
        [promptId]: data as PromptVersion[],
      }));
    } catch (err) {
      setVersionsError(
        err instanceof Error ? err.message : "Could not load prompt versions"
      );
    } finally {
      setVersionsLoadingId(null);
    }
  }

  async function applySavedPrompt(savedPrompt: PromptTemplate) {
    setPrompt(savedPrompt.prompt);
    setSelectedPromptVersionId(null);
    setRunError("");
    const cachedVersions = promptVersions[savedPrompt.id];
    if (cachedVersions?.length) {
      const latestVersion = cachedVersions[0];
      if (latestVersion.prompt === savedPrompt.prompt) {
        setSelectedPromptVersionId(latestVersion.id);
      }
    } else {
      try {
        const response = await fetch(
          `${API_URL}/api/prompts/${encodeURIComponent(savedPrompt.id)}/versions`,
          { cache: "no-store" }
        );
        const data = await response.json();
        if (response.ok && Array.isArray(data)) {
          const versions = data as PromptVersion[];
          setPromptVersions((currentVersions) => ({
            ...currentVersions,
            [savedPrompt.id]: versions,
          }));
          const latestVersion = versions[0];
          if (latestVersion?.prompt === savedPrompt.prompt) {
            setSelectedPromptVersionId(latestVersion.id);
          }
        }
      } catch (err) {
        console.error("Could not load saved prompt version:", err);
      }
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const filteredPromptLibrary = promptLibrary.filter((savedPrompt) => {
    const query = promptSearch.trim().toLocaleLowerCase();
    return (
      !query ||
      savedPrompt.title.toLocaleLowerCase().includes(query) ||
      savedPrompt.prompt.toLocaleLowerCase().includes(query) ||
      savedPrompt.category.toLocaleLowerCase().includes(query) ||
      (savedPrompt.tags ?? []).some((tag) => tag.toLocaleLowerCase().includes(query))
    );
  });

  const precisionRatings = runs.flatMap((run) =>
    run.precisionScore == null ? [] : [run.precisionScore]
  );
  const concisenessRatings = runs.flatMap((run) =>
    run.concisenessScore == null ? [] : [run.concisenessScore]
  );
  const averagePrecision = precisionRatings.length
    ? precisionRatings.reduce((sum, score) => sum + score, 0) /
      precisionRatings.length
    : null;
  const averageConciseness = concisenessRatings.length
    ? concisenessRatings.reduce((sum, score) => sum + score, 0) /
      concisenessRatings.length
    : null;
  const promptVersionAnalytics = Array.from(
    runs.reduce((versions, run) => {
      if (!run.promptVersion) return versions;
      const current = versions.get(run.promptVersion.id) ?? {
        id: run.promptVersion.id,
        title: run.promptVersion.title,
        version: run.promptVersion.version,
        runCount: 0,
        precision: [] as number[],
        conciseness: [] as number[],
      };
      current.runCount += 1;
      if (run.precisionScore != null) current.precision.push(run.precisionScore);
      if (run.concisenessScore != null) current.conciseness.push(run.concisenessScore);
      versions.set(run.promptVersion.id, current);
      return versions;
    }, new Map<string, {
      id: string;
      title: string;
      version: number;
      runCount: number;
      precision: number[];
      conciseness: number[];
    }>()).values()
  ).sort((a, b) => a.title.localeCompare(b.title) || a.version - b.version);
  const highestRatedRun = runs
    .filter(
      (run) => run.precisionScore != null && run.concisenessScore != null
    )
    .reduce<ExperimentRun | null>((best, run) => {
      if (!best) return run;
      const runScore = (run.precisionScore! + run.concisenessScore!) / 2;
      const bestScore = (best.precisionScore! + best.concisenessScore!) / 2;
      return runScore > bestScore ? run : best;
    }, null);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0b0d12] p-8 text-slate-100">
        Loading experiment...
      </main>
    );
  }

  if (!experiment) {
    return (
      <main className="min-h-screen bg-[#0b0d12] p-8 text-slate-100">
        <Link href="/experiments" className="text-violet-300">
          ← Back to Experiments
        </Link>
        <p role="alert" className="mt-6 text-red-400">
          {error || "Experiment not found"}
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0b0d12] px-5 py-8 text-slate-100 md:px-10">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/experiments"
          className="text-sm text-violet-300 hover:text-violet-200"
        >
          ← Back to Experiments
        </Link>

        {/* Experiment heading */}
        <header className="mt-8">
          <p className="text-sm uppercase tracking-widest text-violet-300">
            Experiment Details
          </p>

          <h1 className="mt-3 break-words text-3xl font-semibold">
            {experiment.name}
          </h1>

          <span className="mt-4 inline-block rounded-full bg-violet-400/10 px-3 py-1 text-sm text-violet-300">
            {experiment.status}
          </span>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setEditing(!editing);
                setError("");
                setMessage("");
              }}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium hover:bg-violet-500"
            >
              {editing ? "Cancel editing" : "Edit experiment"}
            </button>

            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="rounded-lg border border-red-400/30 px-4 py-2 text-sm text-red-300 hover:bg-red-400/10 disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete experiment"}
            </button>
          </div>
        </header>

        {error && (
          <p role="alert" className="mt-5 text-sm text-red-400">
            {error}
          </p>
        )}

        {message && (
          <p role="status" className="mt-5 text-sm text-emerald-400">
            {message}
          </p>
        )}

        {/* Run Experiment */}
        <section className="mt-8 rounded-2xl border border-violet-400/20 bg-violet-400/[0.04] p-6">
          <div className="mb-5">
            <p className="text-sm uppercase tracking-widest text-violet-300">
              AI Playground
            </p>
            <h2 className="mt-2 text-xl font-semibold">
              Run Experiment
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Send a prompt through Ollama or one of your saved provider connections.
            </p>
          </div>

          <form onSubmit={handleRunExperiment} className="space-y-5">
            <div>
              <label htmlFor="run-provider" className="mb-2 block text-sm text-slate-300">AI provider</label>
              <select id="run-provider" value={selectedProviderConnectionId} disabled={running} onChange={(event) => {
                const nextId = event.target.value;
                setSelectedProviderConnectionId(nextId);
                setSelectedRunModel(nextId ? providerConnections.find((provider) => provider.id === nextId)?.defaultModel || "" : models[0]?.name || "");
                setImprovedPrompt(null);
              }} className="w-full rounded-lg border border-white/10 bg-[#15171d] px-4 py-3 outline-none focus:border-violet-400 disabled:opacity-50">
                <option value="">Local Ollama</option>
                {providerConnections.map((provider) => <option key={provider.id} value={provider.id}>{provider.displayName} ({provider.provider})</option>)}
              </select>

              <label htmlFor="run-model" className="mb-2 mt-4 block text-sm text-slate-300">Model name</label>
              {usesLocalOllama ? <select id="run-model" value={selectedRunModel} onChange={(event) => { setSelectedRunModel(event.target.value); setImprovedPrompt(null); }} disabled={running || modelsLoading || models.length === 0 || !!modelsError} className="w-full rounded-lg border border-white/10 bg-[#15171d] px-4 py-3 outline-none focus:border-violet-400 disabled:opacity-50">
                {modelsLoading ? <option value="">Loading installed models...</option> : modelsError ? <option value="">Could not load models</option> : models.length === 0 ? <option value="">No Ollama models installed</option> : models.map((model) => <option key={model.name} value={model.name}>{model.name} ({formatModelSize(model.size)}){model.responseSamples ? ` · avg ${(model.averageResponseMs! / 1000).toFixed(1)}s` : ""}</option>)}
              </select> : <input id="run-model" value={selectedRunModel} onChange={(event) => setSelectedRunModel(event.target.value)} disabled={running} placeholder={selectedProviderConnection?.defaultModel || "Enter the model name from your provider"} className="w-full rounded-lg border border-white/10 bg-[#15171d] px-4 py-3 outline-none focus:border-violet-400 disabled:opacity-50" />}

              {usesLocalOllama && modelsLoading && <p role="status" className="mt-2 text-xs text-slate-400">Loading installed Ollama models...</p>}
              {usesLocalOllama && !modelsLoading && modelsError && <div className="mt-2 flex flex-wrap items-center gap-2"><p role="alert" className="text-xs text-red-400">{modelsError}</p><button type="button" onClick={() => void loadModels()} className="text-xs text-violet-300 hover:text-violet-200">Retry</button></div>}
              {usesLocalOllama && !modelsLoading && !modelsError && models.length === 0 && <p role="status" className="mt-2 text-xs text-amber-300">No Ollama models are installed. Add one in Ollama, then refresh this page.</p>}
              <p className="mt-2 text-xs text-slate-500">{usesLocalOllama ? "Runs locally through Ollama." : `Requests are sent to ${selectedProviderConnection?.provider}; the saved API key stays on the server.`}</p>
              <Link href="/providers" className="mt-2 inline-block text-xs text-violet-300 hover:text-violet-200">Add or manage provider connections</Link>
            </div>

            <fieldset disabled={running} className="space-y-4 rounded-xl border border-white/10 bg-black/20 p-4 disabled:opacity-60">
              <legend className="px-2 text-sm font-medium text-slate-300">
                Inference settings
              </legend>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-300">
                  <span className="flex justify-between">
                    <span>Temperature</span>
                    <span>{temperature.toFixed(1)}</span>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={temperature}
                    onChange={(event) => setTemperature(Number(event.target.value))}
                    className="w-full accent-violet-500"
                  />
                  <span className="block text-xs text-slate-500">
                    Lower is more predictable; higher is more varied.
                  </span>
                </label>

                <label className="space-y-2 text-sm text-slate-300">
                  <span className="flex justify-between">
                    <span>Top P</span>
                    <span>{topP.toFixed(2)}</span>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={topP}
                    onChange={(event) => setTopP(Number(event.target.value))}
                    className="w-full accent-violet-500"
                  />
                  <span className="block text-xs text-slate-500">
                    Limits token choices to the most likely options.
                  </span>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-300">
                  <span className="flex justify-between">
                    <span>Frequency penalty</span>
                    <span>{frequencyPenalty.toFixed(1)}</span>
                  </span>
                  <input type="range" min="-2" max="2" step="0.1" value={frequencyPenalty} onChange={(event) => setFrequencyPenalty(Number(event.target.value))} className="w-full accent-violet-500" />
                  <span className="block text-xs text-slate-500">Discourages words that have already appeared often.</span>
                </label>
                <label className="space-y-2 text-sm text-slate-300">
                  <span className="flex justify-between">
                    <span>Presence penalty</span>
                    <span>{presencePenalty.toFixed(1)}</span>
                  </span>
                  <input type="range" min="-2" max="2" step="0.1" value={presencePenalty} onChange={(event) => setPresencePenalty(Number(event.target.value))} className="w-full accent-violet-500" />
                  <span className="block text-xs text-slate-500">Encourages introducing topics that have not appeared yet.</span>
                </label>
              </div>

              <label className="block max-w-xs space-y-2 text-sm text-slate-300">
                <span>Maximum response tokens</span>
                <input
                  type="number"
                  min="1"
                  max="4096"
                  step="1"
                  required
                  value={maxTokens}
                  onChange={(event) => setMaxTokens(Number(event.target.value))}
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-violet-400"
                />
              </label>
            </fieldset>

            <div>
              <label
                htmlFor="run-prompt"
                className="mb-2 block text-sm text-slate-300"
              >
                Prompt *
              </label>

              <textarea
                id="run-prompt"
                required
                rows={5}
                maxLength={10000}
                value={prompt}
                onChange={(event) => {
                  setPrompt(event.target.value);
                  setSelectedPromptVersionId(null);
                  setImprovedPrompt(null);
                  setImproveError("");
                }}
                disabled={running}
                placeholder="Enter the instructions you want the AI model to follow..."
                className="w-full resize-y rounded-lg border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-violet-400 disabled:opacity-50"
              />

              <p className="mt-1 text-right text-xs text-slate-500">
                {prompt.length}/10000 characters
              </p>

              <button
                type="button"
                onClick={() => void handleImprovePrompt()}
                disabled={
                  improvingPrompt ||
                  running ||
                  !usesLocalOllama || modelsLoading ||
                  !!modelsError ||
                  !prompt.trim() ||
                  !models.some((model) => model.name === selectedRunModel)
                }
                className="mt-3 rounded-lg border border-violet-400/30 px-4 py-2 text-sm text-violet-200 hover:bg-violet-400/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {improvingPrompt ? "Improving prompt locally..." : "✨ Improve Prompt"}
              </button>

              {improveError && (
                <p role="alert" className="mt-3 text-sm text-red-400">
                  {improveError}
                </p>
              )}

              {improvedPrompt && (
                <div className="mt-4 rounded-xl border border-violet-400/20 bg-violet-400/[0.04] p-4">
                  <h3 className="font-medium text-violet-200">
                    Review improved prompt
                  </h3>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                      <p className="text-xs uppercase tracking-wider text-slate-500">
                        Original
                      </p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-300">
                        {prompt}
                      </p>
                    </div>
                    <div className="rounded-lg border border-violet-400/20 bg-black/20 p-3">
                      <p className="text-xs uppercase tracking-wider text-violet-300">
                        Suggested
                      </p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-100">
                        {improvedPrompt}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPrompt(improvedPrompt);
                        setSelectedPromptVersionId(null);
                        setImprovedPrompt(null);
                        setImproveError("");
                      }}
                      className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium hover:bg-violet-500"
                    >
                      Accept suggestion
                    </button>
                    <button
                      type="button"
                      onClick={() => setImprovedPrompt(null)}
                      className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </div>

            {runError && (
              <p
                role="alert"
                className="rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-300"
              >
                {runError}
              </p>
            )}

            <button
              type="submit"
              disabled={
                running ||
                !prompt.trim() ||
                (usesLocalOllama && (modelsLoading || !!modelsError)) ||
                !selectedModelIsValid
              }
              className="rounded-lg bg-violet-600 px-5 py-3 font-medium hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {running ? "Running model..." : "▶ Run Experiment"}
            </button>

            {running && (
              <p role="status" className="text-sm text-violet-300">
                The local model is generating a response. This may take a
                little time on your laptop.
              </p>
            )}
          </form>

          {/* Latest model response */}
          {runResult && (
            <div className="mt-6 rounded-xl border border-emerald-400/20 bg-black/20 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold text-emerald-300">
                  Model Output
                </h3>

                <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
                  {runResult.status || "completed"}
                </span>
              </div>

              <div className="mt-4">
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  Model
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  {runResult.model}
                </p>
                {runResult.provider && <p className="mt-1 text-xs text-slate-500">Provider: {runResult.provider}</p>}
              </div>

              <p className="mt-3 text-xs text-slate-500">
                Settings: temperature {runResult.settings.temperature}, top P {runResult.settings.topP}, max tokens {runResult.settings.maxTokens}, frequency penalty {runResult.settings.frequencyPenalty}, presence penalty {runResult.settings.presencePenalty}
              </p>

              {runResult.durationMs != null && (
                <div className="mt-3">
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    Execution time
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {(runResult.durationMs / 1000).toFixed(2)} seconds
                  </p>
                </div>
              )}

              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  Your prompt
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-300">
                  {runResult.prompt}
                </p>
              </div>

              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  Response
                </p>
                <div className="mt-3 whitespace-pre-wrap break-words leading-7 text-slate-100">
                  {runResult.response}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setPrompt(runResult.prompt);
                    setSelectedPromptVersionId(null);
                    setRunResult(null);
                    setRunError("");
                  }}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
                >
                  Run again
                </button>

                <button
                  type="button"
                  onClick={() => void copyText(runResult.response)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
                >
                  Copy response
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Controlled prompt version benchmark */}
        <section className="mt-8 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.03] p-6">
          <p className="text-sm uppercase tracking-widest text-cyan-300">
            Controlled evaluation
          </p>
          <h2 className="mt-2 text-xl font-semibold">Prompt version benchmark</h2>
          <p className="mt-2 text-sm text-slate-400">
            Run the same questions with two saved versions, using the model and inference settings above. Runs are sequential to keep local memory use low.
          </p>

          <form onSubmit={handleRunBenchmark} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1].map((slot) => (
                <label key={slot} className="block text-sm text-slate-300">
                  <span className="mb-2 block">Prompt version {slot + 1}</span>
                  <select
                    value={benchmarkVersionIds[slot]}
                    onChange={(event) => {
                      const nextIds: [string, string] = [...benchmarkVersionIds];
                      nextIds[slot] = event.target.value;
                      setBenchmarkVersionIds(nextIds);
                    }}
                    disabled={benchmarkLoadingVersions || benchmarkRunning || benchmarkVersions.length === 0}
                    className="w-full rounded-lg border border-white/10 bg-[#15171d] px-3 py-3 outline-none focus:border-cyan-400 disabled:opacity-50"
                  >
                    <option value="">
                      {benchmarkLoadingVersions ? "Loading saved versions..." : "Choose a saved version"}
                    </option>
                    {benchmarkVersions.map((version) => (
                      <option key={version.id} value={version.id}>
                        {version.title} (v{version.version})
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            {!benchmarkLoadingVersions && benchmarkVersions.length === 0 && (
              <p className="text-sm text-amber-300">
                Save a prompt in Prompt Library first; its versions will appear here.
              </p>
            )}

            <label className="block text-sm text-slate-300">
              <span className="mb-2 block">Test questions (one per line, up to 5)</span>
              <textarea
                rows={5}
                maxLength={5000}
                value={benchmarkQuestions}
                onChange={(event) => setBenchmarkQuestions(event.target.value)}
                disabled={benchmarkRunning}
                className="w-full resize-y rounded-lg border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-cyan-400 disabled:opacity-50"
              />
              <span className="mt-1 block text-xs text-slate-500">
                {benchmarkQuestions.split(/\r?\n/).filter((question) => question.trim()).length} questions · each version gets the same list
              </span>
            </label>

            {benchmarkError && (
              <p role="alert" className="text-sm text-red-400">{benchmarkError}</p>
            )}
            {benchmarkMessage && (
              <p role="status" className="text-sm text-emerald-300">{benchmarkMessage}</p>
            )}

            <button
              type="submit"
              disabled={
                benchmarkRunning || running || benchmarkLoadingVersions ||
                benchmarkVersionIds.some((versionId) => !versionId) ||
                benchmarkVersionIds[0] === benchmarkVersionIds[1] ||
                !selectedModelIsValid ||
                benchmarkQuestions.split(/\r?\n/).filter((question) => question.trim()).length < 1 ||
                benchmarkQuestions.split(/\r?\n/).filter((question) => question.trim()).length > 5
              }
              className="rounded-lg bg-cyan-600 px-5 py-3 font-medium text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {benchmarkRunning ? "Running benchmark sequentially..." : "Run benchmark"}
            </button>
            {benchmarkRunning && (
              <p role="status" className="text-sm text-cyan-200">
                Running {2 * benchmarkQuestions.split(/\r?\n/).filter((question) => question.trim()).length} model calls sequentially. Results will appear in Run History as each version finishes.
              </p>
            )}
          </form>
        </section>

        {/* Prompt Library */}
        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div>
            <p className="text-sm uppercase tracking-widest text-violet-300">
              Saved Workspace Prompts
            </p>
            <h2 className="mt-2 text-xl font-semibold">Prompt Library</h2>
            <p className="mt-2 text-sm text-slate-400">
              Save useful prompts and reuse them in this experiment.
            </p>
          </div>

          <form
            onSubmit={handleSavePrompt}
            className="mt-5 grid gap-3 sm:grid-cols-[1fr_180px_1fr_auto] sm:items-end"
          >
            <div>
              <label htmlFor="saved-prompt-title" className="mb-2 block text-sm text-slate-300">
                Prompt title
              </label>
              <input
                id="saved-prompt-title"
                required
                maxLength={120}
                value={promptTitle}
                onChange={(event) => setPromptTitle(event.target.value)}
                placeholder="e.g. Explain a concept simply"
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-violet-400"
              />
            </div>

            <div>
              <label htmlFor="saved-prompt-tags" className="mb-2 block text-sm text-slate-300">Tags</label>
              <input id="saved-prompt-tags" maxLength={330} value={promptTagsInput} onChange={(event) => setPromptTagsInput(event.target.value)} placeholder="e.g. interview, beginner, typescript" className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-violet-400" />
              <p className="mt-1 text-xs text-slate-500">Comma-separated, up to 10 tags.</p>
            </div>

            <div>
              <label htmlFor="saved-prompt-category" className="mb-2 block text-sm text-slate-300">
                Category
              </label>
              <select
                id="saved-prompt-category"
                value={promptCategory}
                onChange={(event) => setPromptCategory(event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#15171d] px-3 py-2 outline-none focus:border-violet-400"
              >
                <option>General</option>
                <option>Coding</option>
                <option>SQL</option>
                <option>Resume</option>
                <option>Marketing</option>
                <option>Writing</option>
                <option>Research</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={promptLibrarySaving || !prompt.trim()}
              className="rounded-lg bg-violet-600 px-4 py-2 font-medium hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {promptLibrarySaving ? "Saving..." : "Save current prompt"}
            </button>
          </form>

          <div className="mt-6">
            <label htmlFor="prompt-library-search" className="mb-2 block text-sm text-slate-300">
              Search saved prompts
            </label>
            <input
              id="prompt-library-search"
              type="search"
              value={promptSearch}
              onChange={(event) => setPromptSearch(event.target.value)}
              placeholder="Search title, prompt, or category"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-violet-400"
            />
          </div>

          {promptLibraryError && (
            <p role="alert" className="mt-4 text-sm text-red-400">
              {promptLibraryError}
            </p>
          )}

          {promptLibraryLoading ? (
            <p role="status" className="mt-5 text-sm text-slate-400">
              Loading saved prompts...
            </p>
          ) : filteredPromptLibrary.length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-slate-400">
              {promptLibrary.length === 0
                ? "Your prompt library is empty. Save the current prompt to get started."
                : "No saved prompts match your search."}
            </p>
          ) : (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {filteredPromptLibrary.map((savedPrompt) => (
                <article
                  key={savedPrompt.id}
                  className="rounded-xl border border-white/10 bg-black/20 p-4"
                >
                  {editingPromptId === savedPrompt.id ? (
                    <form
                      onSubmit={(event) =>
                        void handleUpdateSavedPrompt(event, savedPrompt.id)
                      }
                      className="space-y-3"
                    >
                      <label className="block text-sm text-slate-300">
                        Title
                        <input
                          required
                          maxLength={120}
                          value={editingPromptTitle}
                          onChange={(event) => setEditingPromptTitle(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2"
                        />
                      </label>
                      <label className="block text-sm text-slate-300">
                        Prompt text
                        <textarea
                          required
                          maxLength={10000}
                          rows={5}
                          value={editingPromptText}
                          onChange={(event) => setEditingPromptText(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2"
                        />
                      </label>
                      <label className="block text-sm text-slate-300">
                        Category
                        <select
                          value={editingPromptCategory}
                          onChange={(event) => setEditingPromptCategory(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-[#15171d] px-3 py-2"
                        >
                          {["General", "Coding", "SQL", "Resume", "Marketing", "Writing", "Research"].map((category) => (
                            <option key={category}>{category}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm text-slate-300">
                        Tags (comma-separated)
                        <input maxLength={330} value={editingPromptTagsInput} onChange={(event) => setEditingPromptTagsInput(event.target.value)} placeholder="interview, beginner, typescript" className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2" />
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={promptUpdateSaving}
                          className="rounded-lg bg-violet-600 px-3 py-2 text-sm hover:bg-violet-500 disabled:opacity-50"
                        >
                          {promptUpdateSaving ? "Saving version..." : "Save new version"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingPromptId(null)}
                          className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="break-words font-medium">{savedPrompt.title}</h3>
                          <p className="mt-1 text-xs text-violet-300">
                            {savedPrompt.category}
                          </p>
                          {(savedPrompt.tags ?? []).length > 0 && <div className="mt-2 flex flex-wrap gap-1">{savedPrompt.tags.map((tag) => <span key={tag} className="rounded-full border border-violet-300/15 bg-violet-300/5 px-2 py-0.5 text-[10px] text-violet-200">#{tag}</span>)}</div>}
                        </div>
                        <span className="shrink-0 text-xs text-slate-500">
                          Updated {new Date(savedPrompt.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="mt-3 line-clamp-3 whitespace-pre-wrap break-words text-sm text-slate-400">
                        {savedPrompt.prompt}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void applySavedPrompt(savedPrompt)}
                          className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
                        >
                          Use prompt
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditingPrompt(savedPrompt)}
                          className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void togglePromptVersions(savedPrompt.id)}
                          className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
                        >
                          {expandedPromptId === savedPrompt.id ? "Hide versions" : "Version history"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteSavedPrompt(savedPrompt.id)}
                          className="rounded-lg border border-red-400/20 px-3 py-2 text-sm text-red-300 hover:bg-red-400/10"
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}

                  {expandedPromptId === savedPrompt.id && (
                    <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                      <h4 className="font-medium">Version history</h4>
                      {versionsLoadingId === savedPrompt.id ? (
                        <p role="status" className="text-sm text-slate-400">
                          Loading versions...
                        </p>
                      ) : versionsError ? (
                        <p role="alert" className="text-sm text-red-400">
                          {versionsError}
                        </p>
                      ) : (promptVersions[savedPrompt.id] ?? []).map((version, versionIndex, allVersions) => (
                        <article
                          key={version.id}
                          className="rounded-lg border border-white/10 bg-black/20 p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium">
                                Version {version.version}: {version.title}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {version.category} · {new Date(version.createdAt).toLocaleString()}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setPrompt(version.prompt);
                                setSelectedPromptVersionId(version.id);
                                setRunError("");
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                              className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/5"
                            >
                              Use this version
                            </button>
                          </div>
                          <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-300">
                            {version.prompt}
                          </p>
                          {allVersions[versionIndex + 1] && (() => { const diff = promptDiff(allVersions[versionIndex + 1].prompt, version.prompt); return (diff.removed.length || diff.added.length) ? <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3"><p className="mb-2 text-xs font-medium text-slate-400">Changes from version {allVersions[versionIndex + 1].version}</p>{diff.removed.map((line, index) => <p key={`removed-${index}`} className="whitespace-pre-wrap break-words text-xs text-rose-300">− {line || "(blank line)"}</p>)}{diff.added.map((line, index) => <p key={`added-${index}`} className="whitespace-pre-wrap break-words text-xs text-emerald-300">+ {line || "(blank line)"}</p>)}</div> : <p className="mt-3 text-xs text-slate-500">No text changes from the previous version.</p>; })()}
                        </article>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Experiment Analytics */}
        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <p className="text-sm uppercase tracking-widest text-violet-300">
            Experiment Insights
          </p>
          <h2 className="mt-2 text-xl font-semibold">Analytics Summary</h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <article className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm text-slate-400">Total runs</p>
              <p className="mt-2 text-2xl font-semibold">{runs.length}</p>
            </article>
            <article className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm text-slate-400">
                Average precision
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {averagePrecision == null
                  ? "—"
                  : `${averagePrecision.toFixed(1)} / 5`}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {precisionRatings.length} rated {precisionRatings.length === 1 ? "run" : "runs"}
              </p>
            </article>
            <article className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm text-slate-400">
                Average conciseness
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {averageConciseness == null
                  ? "—"
                  : `${averageConciseness.toFixed(1)} / 5`}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {concisenessRatings.length} rated {concisenessRatings.length === 1 ? "run" : "runs"}
              </p>
            </article>
          </div>

          <div className="mt-6">
            <h3 className="font-medium">Prompt version performance</h3>
            <p className="mt-1 text-sm text-slate-400">
              Ratings are averaged from runs linked to each saved version.
            </p>
            {promptVersionAnalytics.length > 0 ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {promptVersionAnalytics.map((version) => {
                  const precisionAverage = version.precision.length
                    ? version.precision.reduce((sum, score) => sum + score, 0) / version.precision.length
                    : null;
                  const concisenessAverage = version.conciseness.length
                    ? version.conciseness.reduce((sum, score) => sum + score, 0) / version.conciseness.length
                    : null;
                  return (
                    <article key={version.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <h4 className="font-medium">{version.title} (v{version.version})</h4>
                      <p className="mt-2 text-xs text-slate-500">
                        {version.runCount} linked {version.runCount === 1 ? "run" : "runs"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-300">
                        <span>Precision: {precisionAverage == null ? "Not rated" : `${precisionAverage.toFixed(1)} / 5`}</span>
                        <span>Conciseness: {concisenessAverage == null ? "Not rated" : `${concisenessAverage.toFixed(1)} / 5`}</span>
                      </div>
                      <div className="mt-4 space-y-3">
                        {([
                          ["Precision", precisionAverage, "bg-violet-400"],
                          ["Conciseness", concisenessAverage, "bg-cyan-400"],
                        ] as const).map(([label, score, color]) => (
                          <div key={label}>
                            <div className="mb-1 flex justify-between text-xs text-slate-400">
                              <span>{label}</span>
                              <span>{score == null ? "Not rated" : `${score.toFixed(1)} / 5`}</span>
                            </div>
                            <div
                              role="meter"
                              aria-label={`${version.title} version ${version.version} ${label.toLowerCase()} average`}
                              aria-valuemin={0}
                              aria-valuemax={5}
                              aria-valuenow={score ?? 0}
                              className="h-2 overflow-hidden rounded-full bg-white/10"
                            >
                              {score != null && (
                                <div
                                  className={`h-full rounded-full transition-[width] ${color}`}
                                  style={{ width: `${(score / 5) * 100}%` }}
                                />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 rounded-lg border border-dashed border-white/10 p-4 text-sm text-slate-400">
                Run a saved prompt version to start comparing version performance.
              </p>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-violet-400/20 bg-violet-400/[0.04] p-4">
            <h3 className="font-medium text-violet-200">Highest-rated run</h3>
            {highestRatedRun ? (
              <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="whitespace-pre-wrap break-words text-sm text-slate-200">
                    {highestRatedRun.prompt}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    {highestRatedRun.modelName} · Precision {highestRatedRun.precisionScore}/5 · Conciseness {highestRatedRun.concisenessScore}/5
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-violet-400/10 px-3 py-1 text-sm text-violet-200">
                  {((highestRatedRun.precisionScore! + highestRatedRun.concisenessScore!) / 2).toFixed(1)} / 5
                </span>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-400">
                Rate both precision and conciseness on a run to see your highest-rated result.
              </p>
            )}
          </div>
        </section>

        {/* Persistent Run History */}
        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-widest text-violet-300">
                Experiment Records
              </p>
              <h2 className="mt-2 text-xl font-semibold">
                Run History
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Previously saved prompts and model responses.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={exportExperimentMarkdown}
                disabled={historyLoading || runs.length === 0}
                className="rounded-lg border border-violet-400/30 px-4 py-2 text-sm text-violet-200 hover:bg-violet-400/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Export Markdown
              </button>
              <button
                type="button"
                onClick={() => void loadRunHistory()}
                disabled={historyLoading}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
              >
                {historyLoading ? "Refreshing..." : "Refresh history"}
              </button>
            </div>
          </div>

          {ratingError && (
            <p role="alert" className="mt-4 text-sm text-red-400">
              {ratingError}
            </p>
          )}

          <div className="mt-5">
            {historyLoading ? (
              <p className="text-sm text-slate-400">
                Loading saved runs...
              </p>
            ) : historyError ? (
              <div>
                <p role="alert" className="text-sm text-red-400">
                  {historyError}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Check that the API server is running and the run-history
                  endpoint is available.
                </p>
              </div>
            ) : runs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/15 p-8 text-center">
                <p className="font-medium">No saved runs yet</p>
                <p className="mt-2 text-sm text-slate-400">
                  Run your first experiment above. Completed and failed runs
                  will appear here when saved by the API.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-400">
                  <span>
                    {runs.length} saved {runs.length === 1 ? "run" : "runs"}
                  </span>
                  <span>
                    {comparisonRunIds.length}/2 selected to compare · Newest first
                  </span>
                </div>

                {comparisonRunIds.length > 0 && (
                  <section className="rounded-xl border border-violet-400/20 bg-violet-400/[0.04] p-4">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-violet-200">
                          Run comparison
                        </h3>
                        <p className="mt-1 text-sm text-slate-400">
                          {comparisonRunIds.length === 1
                            ? "Select one more run to compare side by side."
                            : "Compare the settings, timing, and model responses."}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setComparisonRunIds([])}
                        className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
                      >
                        Clear selection
                      </button>
                    </div>

                    {comparisonRunIds.length === 2 && (
                      <div className="grid gap-4 lg:grid-cols-2">
                        {comparisonRunIds.map((runId, index) => {
                          const run = runs.find((item) => item.id === runId);
                          if (!run) return null;

                          return (
                            <article
                              key={run.id}
                              className="min-w-0 rounded-lg border border-white/10 bg-black/20 p-4"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <h4 className="font-medium">Run {index + 1}</h4>
                                <span className="text-xs text-slate-400">
                                  {run.status}
                                </span>
                              </div>
                              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <dt className="text-xs text-slate-500">Model</dt>
                                  <dd className="mt-1 break-words">{run.modelName}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs text-slate-500">Duration</dt>
                                  <dd className="mt-1">
                                    {run.durationMs == null
                                      ? "—"
                                      : `${(run.durationMs / 1000).toFixed(2)} s`}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-xs text-slate-500">Temperature</dt>
                                  <dd className="mt-1">{run.temperature}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs text-slate-500">Top P</dt>
                                  <dd className="mt-1">{run.topP}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs text-slate-500">Max tokens</dt>
                                  <dd className="mt-1">{run.maxTokens}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs text-slate-500">Frequency penalty</dt>
                                  <dd className="mt-1">{run.frequencyPenalty}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs text-slate-500">Presence penalty</dt>
                                  <dd className="mt-1">{run.presencePenalty}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs text-slate-500">Precision</dt>
                                  <dd className="mt-1">{run.precisionScore ?? "Not rated"}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs text-slate-500">Conciseness</dt>
                                  <dd className="mt-1">{run.concisenessScore ?? "Not rated"}</dd>
                                </div>
                              </dl>
                              <div className="mt-4 border-t border-white/10 pt-4">
                                <h5 className="text-xs uppercase tracking-wider text-slate-500">
                                  Prompt
                                </h5>
                                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-300">
                                  {run.prompt}
                                </p>
                              </div>
                              <div className="mt-4 border-t border-white/10 pt-4">
                                <h5 className="text-xs uppercase tracking-wider text-slate-500">
                                  Response
                                </h5>
                                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-100">
                                  {run.response || run.error || "No response saved."}
                                </p>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </section>
                )}

                {runs.map((run, index) => {
                  const expanded = expandedRunId === run.id;
                  const selectedForComparison = comparisonRunIds.includes(run.id);
                  const comparisonFull = comparisonRunIds.length === 2;

                  const statusStyle =
                    run.status === "completed"
                      ? "bg-emerald-400/10 text-emerald-300"
                      : run.status === "failed"
                        ? "bg-red-400/10 text-red-300"
                        : "bg-amber-400/10 text-amber-300";

                  return (
                    <article
                      key={run.id}
                      className="rounded-xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-slate-500">
                            Run #{runs.length - index}
                          </p>

                          <p className="mt-2 whitespace-pre-wrap break-words font-medium">
                            {run.prompt}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400">
                            <span>Model: {run.modelName}</span>
                            {run.providerConnection && <span>Provider: {run.providerConnection.displayName}</span>}
                            <span>Temperature: {run.temperature}</span>
                            <span>Top P: {run.topP}</span>
                            <span>Max tokens: {run.maxTokens}</span>
                            <span>Frequency penalty: {run.frequencyPenalty}</span>
                            <span>Presence penalty: {run.presencePenalty}</span>
                            {run.promptVersion && (
                              <span>
                                Prompt version: {run.promptVersion.title} (v{run.promptVersion.version})
                              </span>
                            )}

                            {run.durationMs != null && (
                              <span>
                                Time: {(run.durationMs / 1000).toFixed(2)} s
                              </span>
                            )}

                            <span>
                              {new Date(run.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`rounded-full px-3 py-1 text-xs ${statusStyle}`}
                        >
                          {run.status}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/10 pt-4">
                        {(
                          [
                            ["Precision", "precisionScore", run.precisionScore],
                            ["Conciseness", "concisenessScore", run.concisenessScore],
                          ] as const
                        ).map(([label, field, score]) => (
                          <div key={field}>
                            <p className="mb-2 text-xs text-slate-400">
                              {label} (1–5)
                            </p>
                            <div
                              role="group"
                              aria-label={`${label} rating`}
                              className="flex gap-1"
                            >
                              {[1, 2, 3, 4, 5].map((value) => (
                                <button
                                  key={value}
                                  type="button"
                                  aria-label={`${label}: ${value} out of 5`}
                                  aria-pressed={score === value}
                                  disabled={ratingSavingRunId === run.id}
                                  onClick={() =>
                                    void saveRunRating(run.id, field, value)
                                  }
                                  className={`h-8 w-8 rounded-md border text-sm disabled:opacity-50 ${
                                    score === value
                                      ? "border-violet-400 bg-violet-500/30 text-violet-100"
                                      : "border-white/10 text-slate-400 hover:bg-white/5"
                                  }`}
                                >
                                  {value}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                        {ratingSavingRunId === run.id && (
                          <p role="status" className="self-end text-xs text-slate-400">
                            Saving rating...
                          </p>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          aria-pressed={selectedForComparison}
                          disabled={comparisonFull && !selectedForComparison}
                          onClick={() => toggleRunComparison(run.id)}
                          className={`rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40 ${
                            selectedForComparison
                              ? "border-violet-400/40 bg-violet-400/10 text-violet-200"
                              : "border-white/10 hover:bg-white/5"
                          }`}
                        >
                          {selectedForComparison
                            ? "Selected for comparison"
                            : "Compare"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setExpandedRunId(expanded ? null : run.id)
                          }
                          className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
                        >
                          {expanded ? "Hide details" : "View details"}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setPrompt(run.prompt);
                            setSelectedPromptVersionId(null);
                            setRunError("");
                            window.scrollTo({
                              top: 0,
                              behavior: "smooth",
                            });
                          }}
                          className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
                        >
                          Reuse prompt
                        </button>
                      </div>

                      {expanded && (
                        <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
                          <div>
                            <p className="text-xs uppercase tracking-wider text-slate-500">
                              Run ID
                            </p>
                            <p className="mt-2 break-all font-mono text-xs text-slate-400">
                              {run.id}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs uppercase tracking-wider text-slate-500">
                              Full prompt
                            </p>
                            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-300">
                              {run.prompt}
                            </p>
                          </div>

                          {run.response ? (
                            <div>
                              <p className="text-xs uppercase tracking-wider text-slate-500">
                                Model response
                              </p>
                              <div className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-white/[0.03] p-4 text-sm leading-7 text-slate-200">
                                {run.response}
                              </div>

                              <button
                                type="button"
                                onClick={() => void copyText(run.response!)}
                                className="mt-3 rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
                              >
                                Copy saved response
                              </button>
                            </div>
                          ) : (
                            <div>
                              <p className="text-xs uppercase tracking-wider text-slate-500">
                                Model response
                              </p>
                              <p className="mt-2 text-sm text-slate-400">
                                No response was saved for this run.
                              </p>
                            </div>
                          )}

                          {run.error && (
                            <div>
                              <p className="text-xs uppercase tracking-wider text-red-300">
                                Error
                              </p>
                              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-red-300">
                                {run.error}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Edit experiment */}
        {editing ? (
          <form
            onSubmit={handleUpdate}
            className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
          >
            <h2 className="text-lg font-semibold">Edit experiment</h2>

            <div>
              <label
                htmlFor="edit-name"
                className="mb-2 block text-sm text-slate-300"
              >
                Experiment name *
              </label>
              <input
                id="edit-name"
                required
                maxLength={120}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-violet-400"
              />
            </div>

            <div>
              <label
                htmlFor="edit-description"
                className="mb-2 block text-sm text-slate-300"
              >
                Description
              </label>
              <textarea
                id="edit-description"
                rows={3}
                maxLength={2000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-violet-400"
              />
            </div>

            <div>
              <label
                htmlFor="edit-model"
                className="mb-2 block text-sm text-slate-300"
              >
                Configured model provider
              </label>
              <select
                id="edit-model"
                value={modelName}
                onChange={(event) => setModelName(event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#15171d] px-4 py-3 outline-none focus:border-violet-400"
              >
                <option value="not-configured">Not configured yet</option>
                <option value="ollama">Ollama (local model)</option>
                <option value="custom">Custom model</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-violet-600 px-5 py-3 font-medium hover:bg-violet-500 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </form>
        ) : (
          /* Experiment information */
          <section className="mt-8 space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div>
              <h2 className="text-sm text-slate-400">Description</h2>
              <p className="mt-2 whitespace-pre-wrap break-words">
                {experiment.description || "No description provided."}
              </p>
            </div>

            <div className="border-t border-white/10 pt-5">
              <h2 className="text-sm text-slate-400">
                Configured model provider
              </h2>
              <p className="mt-2">{experiment.modelName}</p>
            </div>

            <div className="border-t border-white/10 pt-5">
              <h2 className="text-sm text-slate-400">Experiment ID</h2>
              <p className="mt-2 break-all font-mono text-sm">
                {experiment.id}
              </p>
            </div>

            <div className="grid gap-5 border-t border-white/10 pt-5 sm:grid-cols-2">
              <div>
                <h2 className="text-sm text-slate-400">Created</h2>
                <p className="mt-2 text-sm">
                  {new Date(experiment.createdAt).toLocaleString()}
                </p>
              </div>

              <div>
                <h2 className="text-sm text-slate-400">Last updated</h2>
                <p className="mt-2 text-sm">
                  {new Date(experiment.updatedAt).toLocaleString()}
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
