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

  it('should persist changedFields on update and handle truncated diffs', async () => {
    const mockCreate = jest.fn().mockResolvedValue({});

    const strapi: any = {
      requestContext: {
        get() {
          return {
            state: {
              user: { id: 12, email: 'u@u.com' },
              route: { info: { type: 'content-api' } },
            },
          };
        },
      },
      ee: { features: { isEnabled: jest.fn().mockReturnValue(true), get: jest.fn().mockReturnValue({ options: {} }) } },
      config: {
        get(key: string, def?: any) {
          if (key === 'admin.auditLogs.enabled') return true;
          if (key === 'auditLog.enabled') return def ?? true;
          if (key === 'auditLog.excludeContentTypes') return [];
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
          this.subs.__subscriber = fn;
          return () => delete this.subs.__subscriber;
        },
        emit(eventName: string, ...args: any[]) {
          if (this.subs.__subscriber) this.subs.__subscriber(eventName, ...args);
          return this.subs[eventName] && this.subs[eventName](...args);
        },
      },
      get(name: string) {
        if (name === 'audit-logs') return this['audit-logs'];
        return undefined;
      },
      'audit-logs': { saveEvent: async (event: any) => { await strapi.db.query('admin::audit-log').create({ data: event }); } },
      db: { query() { return { create: mockCreate }; } },
      cron: { add: jest.fn(), remove: jest.fn() },
      'query-params': { transform: jest.fn().mockImplementation((uid, q) => q) },
    };

    const lifecycle = createAuditLogsLifecycleService(strapi as any);

    await lifecycle.register();

    // Simulate an update with previous/result pairs
    const previous = { title: 'old', nested: { a: 1 } };
    const current = { title: 'new', nested: { a: 2 } };

    await strapi.eventHub.emit('entry.update', { uid: 'api::article.article', entry: current, payload: { previous, result: current } });

    expect(mockCreate).toHaveBeenCalled();
    const createdArg = mockCreate.mock.calls[0][0];
    expect(createdArg.data.payload).toBeDefined();
    const json = JSON.stringify(createdArg.data.payload.changedFields || createdArg.data.payload);
    const hasTruncated = json.includes('__truncated');
    const hasFromTo = json.includes('"from"') && json.includes('"to"');
    expect(hasTruncated || hasFromTo).toBe(true);
  });

  it('should persist deletedPayload on delete events', async () => {
    const mockCreate = jest.fn().mockResolvedValue({});

    const strapi: any = {
      requestContext: {
        get() {
          return { state: { user: { id: 13 }, route: { info: { type: 'content-api' } } } };
        },
      },
      ee: { features: { isEnabled: jest.fn().mockReturnValue(true), get: jest.fn().mockReturnValue({ options: {} }) } },
      config: { get(key: string, def?: any) { if (key === 'admin.auditLogs.enabled') return true; if (key === 'auditLog.enabled') return def ?? true; if (key === 'auditLog.excludeContentTypes') return []; return def; } },
      eventHub: { subs: {} as Record<string, any>, on(eventName: string, fn: any) { this.subs[eventName] = fn; return () => delete this.subs[eventName]; }, subscribe(fn: any) { this.subs.__subscriber = fn; return () => delete this.subs.__subscriber; }, emit(eventName: string, ...args: any[]) { if (this.subs.__subscriber) this.subs.__subscriber(eventName, ...args); return this.subs[eventName] && this.subs[eventName](...args); } },
      get(name: string) { if (name === 'audit-logs') return this['audit-logs']; return undefined; },
      'audit-logs': { saveEvent: async (event: any) => { await strapi.db.query('admin::audit-log').create({ data: event }); } },
      db: { query() { return { create: mockCreate }; } },
      cron: { add: jest.fn(), remove: jest.fn() },
      'query-params': { transform: jest.fn().mockImplementation((uid, q) => q) },
    };

    const lifecycle = createAuditLogsLifecycleService(strapi as any);
    await lifecycle.register();

    const deleted = { id: 99, title: 'to remove' };
    await strapi.eventHub.emit('entry.delete', { uid: 'api::article.article', entry: deleted });

    expect(mockCreate).toHaveBeenCalled();
    const createdArg = mockCreate.mock.calls[0][0];
    expect(createdArg.data.payload.deletedPayload).toBeDefined();
    expect(createdArg.data.recordId).toBe(99);
  });

  it('should NOT persist logs for excluded content types', async () => {
    const mockCreate = jest.fn().mockResolvedValue({});

    const strapi: any = {
      requestContext: { get() { return { state: { user: { id: 21 }, route: { info: { type: 'content-api' } } } }; } },
      ee: { features: { isEnabled: jest.fn().mockReturnValue(true), get: jest.fn().mockReturnValue({ options: {} }) } },
      config: { get(key: string, def?: any) { if (key === 'admin.auditLogs.enabled') return true; if (key === 'auditLog.enabled') return def ?? true; if (key === 'auditLog.excludeContentTypes') return ['api::secret.secret']; return def; } },
      eventHub: { subs: {} as Record<string, any>, on(eventName: string, fn: any) { this.subs[eventName] = fn; return () => delete this.subs[eventName]; }, subscribe(fn: any) { this.subs.__subscriber = fn; return () => delete this.subs.__subscriber; }, emit(eventName: string, ...args: any[]) { if (this.subs.__subscriber) this.subs.__subscriber(eventName, ...args); return this.subs[eventName] && this.subs[eventName](...args); } },
      get(name: string) { if (name === 'audit-logs') return this['audit-logs']; return undefined; },
      'audit-logs': { saveEvent: async (event: any) => { await strapi.db.query('admin::audit-log').create({ data: event }); } },
      db: { query() { return { create: mockCreate }; } },
      cron: { add: jest.fn(), remove: jest.fn() },
    };

    const lifecycle = createAuditLogsLifecycleService(strapi as any);
    await lifecycle.register();

    // Emit an event for an excluded content-type uid
    await strapi.eventHub.emit('entry.create', { uid: 'api::secret.secret', entry: { id: 1 } });

    expect(mockCreate).not.toHaveBeenCalled();
  });
});
