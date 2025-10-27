/* Migration: add indexes for audit logs table
   Creates indexes on content_type, record_id and date columns for the admin audit logs table
   Supports Postgres and MySQL via Knex schema builder.
*/

import type { Migration } from '@strapi/database';

const AUDIT_TABLE = 'strapi_audit_logs';

export const addAuditLogIndexes: Migration = {
  name: 'core::2025-10-27-add-audit-logs-indexes',
  async up(knex) {
    const hasTable = await knex.schema.hasTable(AUDIT_TABLE);
    if (!hasTable) return;

    // Add indexes if they don't exist. Knex doesn't expose "if not exists" for index creation
    // so we attempt to create and ignore failures if index already exists.
    try {
      await knex.schema.alterTable(AUDIT_TABLE, (table) => {
        table.index('content_type', `${AUDIT_TABLE}_content_type_idx`);
        table.index('record_id', `${AUDIT_TABLE}_record_id_idx`);
        table.index('date', `${AUDIT_TABLE}_date_idx`);
      });
    } catch (e) {
      // If indexes already exist or DB-specific error, log and continue
      // eslint-disable-next-line no-console
      console.warn('[migrations] add-audit-logs-indexes: could not create indexes', e.message || e);
    }
  },

  async down(knex) {
    const hasTable = await knex.schema.hasTable(AUDIT_TABLE);
    if (!hasTable) return;

    try {
      await knex.schema.alterTable(AUDIT_TABLE, (table) => {
        table.dropIndex('content_type', `${AUDIT_TABLE}_content_type_idx`);
        table.dropIndex('record_id', `${AUDIT_TABLE}_record_id_idx`);
        table.dropIndex('date', `${AUDIT_TABLE}_date_idx`);
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[migrations] add-audit-logs-indexes: could not drop indexes', e.message || e);
    }
  },
};

export default addAuditLogIndexes;
