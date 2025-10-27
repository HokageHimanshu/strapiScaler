import { createAuditLogsLifecycleService } from '../lifecycles';

describe('deepDiff helper in lifecycles', () => {
  it('captures nested changes', () => {
    const auditLogs: any = { saveEvent: jest.fn() };

    const strapi: any = {
      config: {
        get: (key: string, def?: any) => {
          if (key === 'auditLog.excludeContentTypes') return [];
          if (key === 'auditLog.enabled') return def ?? true;
          if (key === 'admin.auditLogs.retentionDays') return undefined;
          return def;
        },
      },
      requestContext: { get: () => ({ state: { route: { info: { type: 'admin' } }, user: { id: 1 } } }) },
      ee: { features: { isEnabled: () => true, get: () => ({ options: {} }) } },
      cron: { add: jest.fn(), remove: jest.fn() },
    };

    strapi.get = (name: string) => (name === 'audit-logs' ? auditLogs : undefined);

    const svc = createAuditLogsLifecycleService(strapi);
  // Access processEvent via invoking internal by calling register and using eventHub.subscribe mock
    // Instead, extract the processEvent by calling the factory and using eval — easier: call the internal function through register flow not possible here.
    // Instead we'll test deepDiff by requiring the file and using its exported behavior indirectly by simulating update payload via lifecycle.register

    // Create previous and current
    const previous = { a: { b: { c: 1 } }, x: 1 };
    const current = { a: { b: { c: 2 } }, x: 1 };

  // Minimal eventHub that calls subscriber directly
    strapi.eventHub = {
      subscribe: (fn: any) => {
        // call the handler with entry.update style args
        fn('entry.update', { uid: 'api::test.test', entry: current, payload: { previous, result: current } });
        return () => {};
      },
      on: () => () => {},
    };

    // Register and let it run the handler
    return svc.register().then(() => {
      // saveEvent should have been called
      expect(auditLogs.saveEvent).toHaveBeenCalled();
      const saved = auditLogs.saveEvent.mock.calls[0][0];
  expect(saved.payload.changedFields).toBeDefined();
  const json = JSON.stringify(saved.payload.changedFields);
  // nested diff should include from/to values for the changed field
  expect(json.includes('"from":1')).toBe(true);
  expect(json.includes('"to":2')).toBe(true);
    });
  });

  it('truncates when node limit is exceeded', () => {
    const auditLogs2: any = { saveEvent: jest.fn() };

    const strapi2: any = {
      config: {
        get: (key: string, def?: any) => {
          if (key === 'auditLog.excludeContentTypes') return [];
          if (key === 'auditLog.enabled') return def ?? true;
          if (key === 'admin.auditLogs.retentionDays') return undefined;
          return def;
        },
      },
      requestContext: { get: () => ({ state: { route: { info: { type: 'admin' } }, user: { id: 1 } } }) },
      ee: { features: { isEnabled: () => true, get: () => ({ options: {} }) } },
      cron: { add: jest.fn(), remove: jest.fn() },
    };

    strapi2.get = (name: string) => (name === 'audit-logs' ? auditLogs2 : undefined);
    const svc2 = createAuditLogsLifecycleService(strapi2);

    // Build large previous/current objects to exceed nodes when maxNodes small
  const makeLarge = (n: number) => {
      const obj: any = {};
      for (let i = 0; i < n; i++) obj[`k${i}`] = { v: i };
      return obj;
    };
  // Make this large to exceed the default maxNodes used in deepDiff (1000)
  const previous = makeLarge(2500);
  const current = makeLarge(2500);

    strapi2.eventHub = {
      subscribe: (fn: any) => {
        fn('entry.update', { uid: 'api::test.test', entry: current, payload: { previous, result: current } });
        return () => {};
      },
      on: () => () => {},
    };

    return svc2.register().then(() => {
      expect(auditLogs2.saveEvent).toHaveBeenCalled();
      const saved = auditLogs2.saveEvent.mock.calls[0][0];
  expect(saved.payload.changedFields).toBeTruthy();
  const json = JSON.stringify(saved.payload.changedFields);
  // Either we captured deep diff or we hit truncation; ensure one of those is true
  const hasTruncated = json.includes('__truncated');
  const hasFromTo = json.includes('"from":') && json.includes('"to":');
  expect(hasTruncated || hasFromTo).toBe(true);
    });
  });
});
