import { createAuditLogsLifecycleService } from '../lifecycles';

describe('Audit logs integration (simulated)', () => {
  it('should persist an audit-log when a create document event occurs', async () => {
    const createdRecord = { id: 42, title: 'Hello' };

    const mockCreate = jest.fn().mockResolvedValue(createdRecord);
    const mockFindPage = jest.fn().mockResolvedValue({ results: [createdRecord], pagination: {} });

    const strapi: any = {
      requestContext: {
        get() {
          return {
            state: {
              user: { id: 11, email: 'a@b.com', username: 'admin' },
              route: { info: { type: 'content-api' } },
            },
          };
        },
      },
      requestContext: {
        get() {
          return {
            state: {
              user: { id: 11, email: 'a@b.com', username: 'admin' },
              route: { info: { type: 'content-api' } },
            },
          };
        },
      },
      ee: {
        features: {
          isEnabled: jest.fn().mockReturnValue(true),
          get: jest.fn(),
        },
      },
      config: {
        get(key: string, def?: any) {
          if (key === 'admin.auditLogs.enabled') return true;
          if (key === 'auditLog.enabled') return def ?? true;
          return def;
        },
      },
      eventHub: {
        subs: {} as Record<string, any>,
        on(eventName: string, fn: any) {
          this.subs[eventName] = fn;
          return () => delete this.subs[eventName];
        },
        subscribe(fn: any) {
          // lifecycle calls subscribe with a handler that will internally register to events
          // expose a simple wrapper that stores the handler on a special key
          this.subs.__subscriber = fn;
          return () => delete this.subs.__subscriber;
        },
        emit(eventName: string, ...args: any[]) {
          // If a generic subscriber exists, call it first
          if (this.subs.__subscriber) {
            this.subs.__subscriber(eventName, ...args);
          }
          return this.subs[eventName] && this.subs[eventName](...args);
        },
      },
      get(name: string) {
        if (name === 'audit-logs') {
          return this['audit-logs'];
        }
        return undefined;
      },
      // Provide an audit-logs service that calls db.query create to persist
      'audit-logs': {
        saveEvent: async (event: any) => {
          await strapi.db.query('admin::audit-log').create({ data: event });
        },
      },
      add: jest.fn(),
      db: {
        query() {
          return {
            create: mockCreate,
            findPage: mockFindPage,
          };
        },
      },
      cron: { add: jest.fn(), remove: jest.fn() },
      'query-params': { transform: jest.fn().mockImplementation((uid, q) => q) },
      documents: { use: jest.fn() },
    };

    const lifecycle = createAuditLogsLifecycleService(strapi as any);

    await lifecycle.register();

    // Simulate a document create lifecycle call
    const handler = strapi.eventHub.subs['document.entry.create'] || strapi.eventHub.subs['entry.create'];

    // If the lifecycle registered the document hook, call directly via documents.use simulation
    if (!handler) {
      // Find the documents.use handler attached by the lifecycle service
      // createAuditLogsLifecycleService registers via strapi.documents.use in CE; fallback to directly calling saveEvent
      // For simplicity, ensure that the db.create was called by invoking the lifecycle's internal saveEvent via eventHub
      await strapi.eventHub.emit('entry.create', {
        uid: 'api::article.article',
        entry: createdRecord,
      });
    } else {
      await handler({
        action: 'create',
        params: { contentType: 'api::article.article', data: createdRecord, documentId: 42 },
      });
    }

    // Ensure the audit log was saved with contentType and recordId
    expect(mockCreate).toHaveBeenCalled();
    const createdArg = mockCreate.mock.calls[0][0];
  expect(createdArg.data.contentType).toBe('api::article.article');
  expect(createdArg.data.recordId).toBe(42);
  });
});
