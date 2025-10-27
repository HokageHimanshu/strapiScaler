import React from 'react';
import pluginPkg from '../../../../package.json';

export default {
  register(app) {
    app.addSettingsLink('admin', {
      title: 'Audit Logs',
      to: '/settings/audit-logs',
      permissions: [{ action: 'admin::audit-logs.read', subject: null }],
    });
  },
};
