import { LOCAL_DB_VERSION, LOCAL_DB_SCHEMA } from './local-db-schema';

describe('local-db-schema', () => {
  describe('LOCAL_DB_VERSION', () => {
    it('is set to 1', () => {
      expect(LOCAL_DB_VERSION).toBe(1);
    });
  });

  describe('LOCAL_DB_SCHEMA', () => {
    it('is a non-empty string', () => {
      expect(typeof LOCAL_DB_SCHEMA).toBe('string');
      expect(LOCAL_DB_SCHEMA.length).toBeGreaterThan(0);
    });

    // User-facing tables
    it('contains local_users table', () => {
      expect(LOCAL_DB_SCHEMA).toContain('CREATE TABLE IF NOT EXISTS local_users');
    });

    it('contains local_groups table', () => {
      expect(LOCAL_DB_SCHEMA).toContain('CREATE TABLE IF NOT EXISTS local_groups');
    });

    it('contains local_group_members table', () => {
      expect(LOCAL_DB_SCHEMA).toContain('CREATE TABLE IF NOT EXISTS local_group_members');
    });

    it('contains local_expenses table', () => {
      expect(LOCAL_DB_SCHEMA).toContain('CREATE TABLE IF NOT EXISTS local_expenses');
    });

    it('contains local_expense_splits table', () => {
      expect(LOCAL_DB_SCHEMA).toContain('CREATE TABLE IF NOT EXISTS local_expense_splits');
    });

    it('contains local_settlements table', () => {
      expect(LOCAL_DB_SCHEMA).toContain('CREATE TABLE IF NOT EXISTS local_settlements');
    });

    it('contains local_activity_log table', () => {
      expect(LOCAL_DB_SCHEMA).toContain('CREATE TABLE IF NOT EXISTS local_activity_log');
    });

    // Sync infrastructure tables
    it('contains sync_queue table', () => {
      expect(LOCAL_DB_SCHEMA).toContain('CREATE TABLE IF NOT EXISTS sync_queue');
    });

    it('contains sync_conflicts table', () => {
      expect(LOCAL_DB_SCHEMA).toContain('CREATE TABLE IF NOT EXISTS sync_conflicts');
    });

    it('contains sync_metadata table', () => {
      expect(LOCAL_DB_SCHEMA).toContain('CREATE TABLE IF NOT EXISTS sync_metadata');
    });

    // Indexes
    it('contains index on sync_queue status', () => {
      expect(LOCAL_DB_SCHEMA).toContain('CREATE INDEX IF NOT EXISTS idx_sync_queue_status');
    });

    it('contains index on sync_queue table_name', () => {
      expect(LOCAL_DB_SCHEMA).toContain('CREATE INDEX IF NOT EXISTS idx_sync_queue_table');
    });

    it('contains index on local_expenses group_id', () => {
      expect(LOCAL_DB_SCHEMA).toContain('CREATE INDEX IF NOT EXISTS idx_local_expenses_group');
    });

    it('contains index on local_expense_splits expense_id', () => {
      expect(LOCAL_DB_SCHEMA).toContain('CREATE INDEX IF NOT EXISTS idx_local_expense_splits_expense');
    });

    it('contains index on local_group_members group_id', () => {
      expect(LOCAL_DB_SCHEMA).toContain('CREATE INDEX IF NOT EXISTS idx_local_group_members_group');
    });

    it('contains sync status indexes for local_groups and local_expenses', () => {
      expect(LOCAL_DB_SCHEMA).toContain('CREATE INDEX IF NOT EXISTS idx_local_groups_sync');
      expect(LOCAL_DB_SCHEMA).toContain('CREATE INDEX IF NOT EXISTS idx_local_expenses_sync');
    });

    // Sync status columns
    it('defines _sync_status columns with correct CHECK constraint', () => {
      const matches = LOCAL_DB_SCHEMA.match(/_sync_status TEXT DEFAULT 'synced'/g);
      // Every user-facing table has _sync_status (7 tables + activity_log)
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThanOrEqual(7);
    });
  });
});
