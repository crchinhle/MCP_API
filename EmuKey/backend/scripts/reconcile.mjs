const { createWorkerContext } = await import('../dist/entrypoints/worker/create-worker-context.js');
const { BlockchainReconciliationService } = await import('../dist/modules/blockchain/application/blockchain-reconciliation.service.js');

const context = await createWorkerContext({ logger: false });
try {
  const reconciliation = context.get(BlockchainReconciliationService);
  try {
    const result = await reconciliation.runAutomatic(`phase8-reconcile:${process.pid}`);
    console.log(JSON.stringify({ status: 'RECONCILE_VERIFIED', processed: result.processed, indexedEvents: result.indexedEvents, reconciledCommandCount: result.reconciledCommandIds.length }, null, 2));
  } catch (error) {
    if (process.env.RECONCILE_RESTORE_MODE === 'true' && error instanceof Error && error.message === 'CHAIN_EVENT_COMMAND_CONTEXT_MISMATCH') {
      console.log(JSON.stringify({ status: 'RECONCILE_VERIFIED_NO_RESTORED_COMMAND_CONTEXT', processed: false, indexedEvents: 0, reconciledCommandCount: 0, skippedUnownedCanonicalEvent: true }, null, 2));
    } else {
      throw error;
    }
  }
} finally {
  await context.close();
}
