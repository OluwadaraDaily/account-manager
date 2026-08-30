import type { ImportJobStore } from "../db/repositories/importJobStore.js";

type RunGmailImportJob = (jobId: string, googleSubject: string) => Promise<void>;

type GmailImportJobQueueDependencies = {
  importJobStorePromise: Promise<ImportJobStore>;
  maxConcurrentImports?: number;
};

export function createGmailImportJobQueue({
  importJobStorePromise,
  maxConcurrentImports = 2,
}: GmailImportJobQueueDependencies) {
  const pendingImportJobs: Array<{ id: string; googleSubject: string }> = [];
  let activeImportCount = 0;
  let runGmailImportJob: RunGmailImportJob | null = null;

  function enqueue(id: string, googleSubject: string, delayMs = 0): Promise<void> {
    if (delayMs > 0) {
      setTimeout(() => void enqueue(id, googleSubject), delayMs);
      return Promise.resolve();
    }

    pendingImportJobs.push({ id, googleSubject });
    void drain();
    return Promise.resolve();
  }

  async function drain() {
    if (!runGmailImportJob) return;

    while (activeImportCount < maxConcurrentImports && pendingImportJobs.length > 0) {
      const nextJob = pendingImportJobs.shift();
      if (!nextJob) return;

      activeImportCount += 1;
      void runGmailImportJob(nextJob.id, nextJob.googleSubject).finally(() => {
        activeImportCount -= 1;
        void drain();
      });
    }
  }

  function setRunner(runner: RunGmailImportJob) {
    runGmailImportJob = runner;
    void drain();
  }

  async function start() {
    const importJobStore = await importJobStorePromise;
    await importJobStore.requeueRunning();
    const unfinishedJobs = await importJobStore.listUnfinished();

    unfinishedJobs.forEach((job) => {
      const delayMs = job.nextAttemptAt
        ? Math.max(0, Date.parse(job.nextAttemptAt) - Date.now())
        : 0;
      void enqueue(job.id, job.googleSubject, delayMs);
    });
  }

  return { enqueue, setRunner, start };
}
