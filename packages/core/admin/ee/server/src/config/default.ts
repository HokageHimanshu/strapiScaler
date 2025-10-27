export default {
  admin: {
    auditLogs: {
      enabled: true,
      retentionDays: undefined, // fallback to license or default in lifecycle
    },
    ai: {
      enabled: true,
    },
  },
  // Backwards-compatible top-level config used by lifecycle processor
  auditLog: {
    enabled: true,
    excludeContentTypes: [],
  },
};
