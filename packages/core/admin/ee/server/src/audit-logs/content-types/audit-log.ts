export const auditLog = {
  schema: {
    kind: 'collectionType',
    collectionName: 'strapi_audit_logs',
    info: {
      singularName: 'audit-log',
      pluralName: 'audit-logs',
      displayName: 'Audit Log',
    },
    options: {
      timestamps: false,
    },
    pluginOptions: {
      'content-manager': {
        visible: false,
      },
      'content-type-builder': {
        visible: false,
      },
    },
    attributes: {
      action: {
        type: 'string',
        required: true,
      },
      date: {
        type: 'datetime',
        required: true,
      },
      contentType: {
        type: 'string',
      },
      recordId: {
        type: 'string',
      },
      user: {
        type: 'relation',
        relation: 'oneToOne',
        target: 'admin::user',
      },
      payload: {
        type: 'json',
      },
    },
    // Add DB indexes to speed common queries
    indexes: [
      {
        name: 'strapi_audit_logs_content_type_index',
        columns: ['content_type'],
        type: null,
      },
      {
        name: 'strapi_audit_logs_record_id_index',
        columns: ['record_id'],
        type: null,
      },
      {
        name: 'strapi_audit_logs_date_index',
        columns: ['date'],
        type: null,
      },
    ],
  },
};
