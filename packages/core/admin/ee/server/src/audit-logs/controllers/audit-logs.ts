import type { Context } from 'koa';

import { validateFindMany } from '../validation/audit-logs';

export default {
  async findMany(ctx: Context) {
    const rawQuery = ctx.request.query as any;
    await validateFindMany(rawQuery);

    // Build filters for query-params
    const filters: any = {};
    if (rawQuery.action) {
      filters.action = rawQuery.action;
    }
    if (rawQuery.userId) {
      filters.user = { id: rawQuery.userId };
    }
    if (rawQuery.contentType) {
      filters.contentType = rawQuery.contentType;
    }
    if (rawQuery.dateFrom || rawQuery.dateTo) {
      filters.date = {} as any;
      if (rawQuery.dateFrom) {
        filters.date.$gte = rawQuery.dateFrom;
      }
      if (rawQuery.dateTo) {
        filters.date.$lte = rawQuery.dateTo;
      }
    }

    const query = {
      pagination: rawQuery.page && rawQuery.pageSize ? { page: rawQuery.page, pageSize: rawQuery.pageSize } : undefined,
      sort: rawQuery.sort,
      filters,
    };

    const auditLogs = strapi.get('audit-logs');
    const body = await auditLogs.findMany(query);

    ctx.body = body;
  },

  async findOne(ctx: Context) {
    const { id } = ctx.params;

    const auditLogs = strapi.get('audit-logs');
    const body = await auditLogs.findOne(id);

    ctx.body = body;

    strapi.telemetry.send('didWatchAnAuditLog');
  },
};
