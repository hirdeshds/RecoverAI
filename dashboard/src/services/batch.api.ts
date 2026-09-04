import api from '@/lib/api';

export const getBatchMetrics = async () => {
  const { data } = await api.get('/recovery/batches');
  return data;
};

export const runBatchRecovery = async () => {
  const { data } = await api.post('/recovery/batch/run-sync');
  return data;
};
