import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ParallelWorkflowService } from './parallelWorkflowService.js';
import db from '../config/database.js';

vi.mock('../config/database.js', () => ({
  default: {
    connect: vi.fn(),
  },
}));

describe('ParallelWorkflowService', () => {
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };
    (db.connect as any).mockResolvedValue(mockClient);
  });

  it('should successfully assign parallel tracks to agencies', async () => {
    mockClient.query.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('UPDATE c_information')) {
        return { rowCount: 1 };
      }
      if (sql.includes('admin') && sql.includes('parent_ag_id')) {
        // Fallback user resolver query
        return { rows: [{ a_id: 100 }] };
      }
      if (sql.includes('admin') && !sql.includes('parent_ag_id')) {
        // addHistory user query
        return { rows: [{ a_name: 'Mock User', a_position: 'Mock Staff', a_role: 'STAFF' }] };
      }
      return { rows: [] };
    });

    const docId = 1;
    const coordinatorId = 5;
    const tracks = [{ ag_id: 10, ag_name: 'Division A' }];

    const res = await ParallelWorkflowService.assignParallel(docId, coordinatorId, tracks);

    expect(res.success).toBe(true);
    expect(res.batchId).toBeDefined();
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('should delegate within parallel track successfully', async () => {
    mockClient.query.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('c_parallel_assignments') && sql.includes('SELECT')) {
        // Verification query
        return { rows: [{ pa_id: 123 }] };
      }
      if (sql.includes('admin')) {
        // addHistory user query
        return { rows: [{ a_name: 'Mock User', a_position: 'Mock Staff', a_role: 'STAFF' }] };
      }
      return { rows: [] };
    });

    const res = await ParallelWorkflowService.delegateWithinTrack(1, 123, 100, 101, 'Forwarding within track');

    expect(res.success).toBe(true);
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalled();
  });
});
